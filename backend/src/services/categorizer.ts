import { CategorizationRule, Category, LlmFallbackLog } from "../db/models";
import { categorizeExpense as geminiCategorize } from "./geminiService";
import { Types } from "mongoose";

export interface CategorizationOutcome {
    categoryId: Types.ObjectId;
    categoryName: string;
    autoCategorized: boolean;
    source: "rule" | "ai" | "manual";
}

/** Uppercases a description and splits it into alphanumeric words. */
function toWords(description: string): string[] {
    return description.trim().toUpperCase().replace(/[^A-Z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

/**
 * Extracts a normalized main merchant pattern token from a transaction description.
 * e.g., "Swiggy Order #1234" -> "SWIGGY"
 */
export function extractMerchantPattern(description: string): string {
    const cleaned = description.trim().toUpperCase().replace(/[^A-Z0-9\s]/g, " ");
    const words = cleaned.split(/\s+/).filter(w => w.length > 2);
    // Return first meaningful word (e.g., SWIGGY, ZOMATO, UBER, AMAZON, WALMART, NETFLIX)
    return words[0] || cleaned.trim().slice(0, 15) || "UNKNOWN";
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ─── Per-User In-Memory Cache with TTL ───────────────────────────────
// Prevents fetching a user's rules and categories from MongoDB on every request.
const CACHE_TTL_MS = 60_000; // 60 seconds
const MAX_CACHED_USERS = 500;

interface UserCache {
    rules: any[] | null;
    rulesLastFetch: number;
    categories: any[] | null;
    categoriesLastFetch: number;
}

const cache = new Map<string, UserCache>();

function getUserCache(userId: string): UserCache {
    let entry = cache.get(userId);
    if (!entry) {
        if (cache.size >= MAX_CACHED_USERS) cache.clear();
        entry = { rules: null, rulesLastFetch: 0, categories: null, categoriesLastFetch: 0 };
        cache.set(userId, entry);
    }
    return entry;
}

async function getCachedRules(userId: string): Promise<any[]> {
    const entry = getUserCache(userId);
    const now = Date.now();
    if (!entry.rules || now - entry.rulesLastFetch > CACHE_TTL_MS) {
        entry.rules = await CategorizationRule.find({ user_id: userId }).lean();
        entry.rulesLastFetch = now;
    }
    return entry.rules;
}

async function getCachedCategories(userId: string): Promise<any[]> {
    const entry = getUserCache(userId);
    const now = Date.now();
    if (!entry.categories || now - entry.categoriesLastFetch > CACHE_TTL_MS) {
        entry.categories = await Category.find({ user_id: userId }).lean();
        entry.categoriesLastFetch = now;
    }
    return entry.categories;
}

/** Invalidate one user's cache after rule/category mutations (all users if no id is given) */
export function invalidateCategorizerCache(userId?: string): void {
    if (userId) {
        cache.delete(userId);
    } else {
        cache.clear();
    }
}

export async function categorize(userId: string, description: string, amount: number): Promise<CategorizationOutcome> {
    const categories = await getCachedCategories(userId);
    if (!categories || categories.length === 0) {
        throw new Error("No categories exist yet. Create a category first.");
    }

    const descUpper = description.toUpperCase();
    const descWords = toWords(description);

    // Tier 1: Check categorization rules (cached). A rule matches a whole word,
    // so a rule for "PAY" does not fire on "PAYTM" or "PAYMENT".
    const rules = await getCachedRules(userId);
    for (const rule of rules) {
        const pattern = String(rule.pattern || "").toUpperCase();
        if (!pattern) continue;
        const matches = /\s/.test(pattern) ? descUpper.includes(pattern) : descWords.includes(pattern);
        if (matches) {
            const cat = categories.find(c => c._id.toString() === String(rule.category_id));
            if (cat) {
                return {
                    categoryId: cat._id as Types.ObjectId,
                    categoryName: cat.name,
                    autoCategorized: true,
                    source: "rule"
                };
            }
        }
    }

    // Tier 2: LLM Fallback (Gemini)
    const categoryNames = categories.map(c => c.name);
    const geminiResult = await geminiCategorize(description, amount, categoryNames);
    const suggested = (geminiResult.categoryName || "").trim().slice(0, 100);
    const suggestedLower = suggested.toLowerCase();

    let matchedCat = suggested
        ? categories.find(c => c.name.toLowerCase() === suggestedLower)
            || categories.find(c => suggestedLower.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(suggestedLower))
        : undefined;

    // If the suggested category does not exist for this user yet, create it
    if (!matchedCat && suggested) {
        let newCatDoc = await Category.findOne({
            user_id: userId,
            name: new RegExp(`^${escapeRegExp(suggested)}$`, "i")
        });
        if (!newCatDoc) {
            newCatDoc = await Category.create({ name: suggested, user_id: userId });
            invalidateCategorizerCache(userId);
        }
        matchedCat = {
            _id: newCatDoc._id,
            name: newCatDoc.name
        };
    }

    if (!matchedCat) {
        matchedCat = categories.find(c => c.name.toLowerCase() === "general") || categories[0];
    }

    // Log the LLM fallback call
    const log = new LlmFallbackLog({
        user_id: userId,
        prompt_tokens: geminiResult.promptTokens,
        response_category: matchedCat.name,
        latency_ms: geminiResult.latencyMs
    });
    await log.save();

    return {
        categoryId: matchedCat._id as Types.ObjectId,
        categoryName: matchedCat.name,
        autoCategorized: true,
        source: "ai"
    };
}
