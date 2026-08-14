import { CategorizationRule, Category, LlmFallbackLog } from "../db/models";
import { categorizeExpense as geminiCategorize } from "./geminiService";
import { Types } from "mongoose";

export interface CategorizationOutcome {
    categoryId: Types.ObjectId;
    categoryName: string;
    autoCategorized: boolean;
    source: "rule" | "ai" | "manual";
}

/**
 * Extracts a normalized main merchant pattern token from a transaction description.
 * e.g., "Swiggy Order #1234" -> "SWIGGY"
 */
export function extractMerchantPattern(description: string): string {
    const cleaned = description.trim().toUpperCase().replace(/[^A-Z0-9\s]/g, " ");
    const words = cleaned.split(/\s+/).filter(w => w.length > 2);
    // Return first meaningful word (e.g., SWIGGY, ZOMATO, UBER, AMAZON, WALMART, NETFLIX)
    return words[0] || cleaned.slice(0, 15) || "UNKNOWN";
}

// ─── In-Memory Cache with TTL ────────────────────────────────────────
// Prevents fetching all rules and categories from MongoDB on every single request.
const CACHE_TTL_MS = 60_000; // 60 seconds

let cachedRules: any[] | null = null;
let rulesLastFetch = 0;

let cachedCategories: any[] | null = null;
let categoriesLastFetch = 0;

async function getCachedRules(): Promise<any[]> {
    const now = Date.now();
    if (!cachedRules || now - rulesLastFetch > CACHE_TTL_MS) {
        cachedRules = await CategorizationRule.find().populate("category_id").lean();
        rulesLastFetch = now;
    }
    return cachedRules;
}

async function getCachedCategories(): Promise<any[]> {
    const now = Date.now();
    if (!cachedCategories || now - categoriesLastFetch > CACHE_TTL_MS) {
        cachedCategories = await Category.find().lean();
        categoriesLastFetch = now;
    }
    return cachedCategories;
}

/** Call this to invalidate caches after rule/category mutations */
export function invalidateCategorizerCache(): void {
    cachedRules = null;
    cachedCategories = null;
}

export async function categorize(description: string, amount: number): Promise<CategorizationOutcome> {
    const categories = await getCachedCategories();
    if (!categories || categories.length === 0) {
        throw new Error("No categories exist in the database");
    }

    const descUpper = description.toUpperCase();

    // Tier 1: Check categorization rules (cached)
    const rules = await getCachedRules();
    for (const rule of rules) {
        if (rule.pattern && descUpper.includes(rule.pattern.toUpperCase())) {
            const cat = categories.find(c => c._id.toString() === (rule.category_id as any)?._id?.toString() || c._id.toString() === rule.category_id.toString());
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

    // Tier 2: LLM Fallback (Gemini 1.5 Flash)
    const categoryNames = categories.map(c => c.name);
    const geminiResult = await geminiCategorize(description, amount, categoryNames);

    const matchedCat = categories.find(
        c => c.name.toLowerCase() === geminiResult.categoryName.toLowerCase()
    ) || categories[0];

    // Log the LLM fallback call
    const log = new LlmFallbackLog({
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
