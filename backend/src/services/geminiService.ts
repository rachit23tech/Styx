import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

export interface CategorizationResult {
    categoryName: string;
    promptTokens: number;
    latencyMs: number;
}

export interface AdvisorExplanationResult {
    explanation: string;
    actionableTips: string[];
    latencyMs: number;
    promptTokens: number;
}

// Model is configurable so a retired model can be swapped via env var without a code change.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// ─── Singleton Gemini Client ─────────────────────────────────────────
// Instantiated once at module load, reused across all requests.
let genAIInstance: GoogleGenerativeAI | null = null;
let modelInstance: GenerativeModel | null = null;

function getModel(): GenerativeModel | null {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    if (!genAIInstance) {
        genAIInstance = new GoogleGenerativeAI(apiKey);
        modelInstance = genAIInstance.getGenerativeModel({ model: GEMINI_MODEL });
    }
    return modelInstance;
}

export async function categorizeExpense(
    description: string,
    amount: number,
    availableCategories: string[]
): Promise<CategorizationResult> {
    const startTime = Date.now();

    if (!availableCategories || availableCategories.length === 0) {
        return {
            categoryName: "General",
            promptTokens: 0,
            latencyMs: Date.now() - startTime
        };
    }

    const fallbackCategory = availableCategories[0] || "General";
    const model = getModel();

    if (!model) {
        // Deterministic keyword fallback when Gemini API key is missing.
        // Keywords match whole words, so "Coca Cola" is not read as "OLA" (a cab).
        const words = new Set(description.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean));
        const hasAny = (keywords: string[]) => keywords.some(k => words.has(k));
        const pick = (matchers: string[], fallbackName: string) =>
            availableCategories.find(c => matchers.some(m => c.toLowerCase().includes(m))) || fallbackName;
        let selectedCategory = "General";

        if (hasAny(["IRCTC", "RAIL", "RAILWAY", "RAILWAYS", "TRAIN", "UBER", "OLA", "RAPIDO", "CAB", "CABS", "TAXI", "FUEL", "PETROL", "DIESEL", "METRO", "FLIGHT", "FLIGHTS", "INDIGO", "MAKEMYTRIP", "IXIGO", "BUS"])) {
            selectedCategory = pick(["transport", "travel"], "Transportation");
        } else if (hasAny(["SWIGGY", "ZOMATO", "RESTAURANT", "RESTAURANTS", "FOOD", "DINER", "DINING", "DINNER", "LUNCH", "BREAKFAST", "COFFEE", "CAFE", "STARBUCKS", "PIZZA", "DOMINOS"])) {
            selectedCategory = pick(["food", "dining"], "Food & Dining");
        } else if (hasAny(["BILL", "BILLS", "POWER", "WIFI", "INTERNET", "BROADBAND", "AIRTEL", "JIO", "ELECTRICITY", "RECHARGE"])) {
            selectedCategory = pick(["util"], "Utilities");
        } else if (hasAny(["AMAZON", "FLIPKART", "SHOP", "SHOPPING", "STORE", "CLOTH", "CLOTHES", "CLOTHING", "MYNTRA", "MALL"])) {
            selectedCategory = pick(["shop"], "Shopping");
        } else if (hasAny(["NETFLIX", "SPOTIFY", "HOTSTAR", "CINEMA", "MOVIE", "MOVIES", "BOOKMYSHOW"])) {
            selectedCategory = pick(["entertain"], "Entertainment");
        } else {
            selectedCategory = availableCategories.find(c => c.toLowerCase() === "general") || availableCategories[0] || "General";
        }

        return {
            categoryName: selectedCategory,
            promptTokens: Math.ceil(description.length / 4) + 15,
            latencyMs: Date.now() - startTime
        };
    }

    try {
        const prompt = `You are an expert financial expense classification assistant.
Categorize the following transaction into the most appropriate category based on merchant intent (e.g. IRCTC = Transportation, Swiggy = Food & Dining, Amazon = Shopping).

Preferred Categories: ${JSON.stringify(availableCategories)}

Transaction Description: "${description}"
Amount: ${amount}

Reply ONLY with the exact single category name (e.g., Transportation, Food & Dining, Shopping, Utilities, Entertainment, Healthcare, General). Do not add explanations or extra words.

Category:`;

        const result = await model.generateContent(prompt);
        const latencyMs = Date.now() - startTime;
        let responseText = result.response.text().trim().replace(/^category:\s*/i, '').replace(/["']/g, '');

        const usageMetadata = result.response.usageMetadata;
        const promptTokens = usageMetadata?.promptTokenCount || Math.ceil(prompt.length / 4);

        const matchedCategory = availableCategories.find(
            c => c.toLowerCase() === responseText.toLowerCase()
        ) || availableCategories.find(
            c => responseText.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(responseText.toLowerCase())
        ) || responseText || "General";

        return {
            categoryName: matchedCategory,
            promptTokens,
            latencyMs
        };
    } catch (error: any) {
        console.error("Gemini API Error:", error.message || error);
        return {
            categoryName: availableCategories.find(c => c.toLowerCase() === "general") || availableCategories[0] || "General",
            promptTokens: Math.ceil(description.length / 4) + 10,
            latencyMs: Date.now() - startTime
        };
    }
}

export async function explainSpendingStats(statsSummary: any): Promise<AdvisorExplanationResult> {
    const startTime = Date.now();

    const generateMockExplanation = (): AdvisorExplanationResult => {
        const total = Number(statsSummary.totalCurrentMonthSpend) || 0;
        const mom = Number(statsSummary.totalMomPercentageChange) || 0;
        const top = statsSummary.topCategory ? `${statsSummary.topCategory.name} (₹${Number(statsSummary.topCategory.amount || 0).toFixed(2)})` : "N/A";

        let summaryText = `In ${statsSummary.period}, total spending reached ₹${total.toFixed(2)}. `;
        if (mom > 0) {
            summaryText += `Your overall spending increased by ${mom}% compared to last month, driven primarily by your top spending category: ${top}.`;
        } else if (mom < 0) {
            summaryText += `Great job! Your spending decreased by ${Math.abs(mom)}% compared to last month. Your top category remained ${top}.`;
        } else {
            summaryText += `Your spending remained stable compared to last month, with your top category being ${top}.`;
        }

        const tips: string[] = [];
        if (statsSummary.topCategory) {
            tips.push(`Monitor ${statsSummary.topCategory.name} expenses as it accounts for your largest monthly outlay.`);
        }
        if (mom > 15) {
            tips.push(`Your spending jumped by ${mom}% MoM — review non-essential purchases to keep your monthly budget balanced.`);
        } else {
            tips.push("Maintain your current savings rate and review 3-month category averages for further optimization.");
        }

        return {
            explanation: summaryText,
            actionableTips: tips,
            latencyMs: Date.now() - startTime,
            promptTokens: Math.ceil(JSON.stringify(statsSummary).length / 4) + 40
        };
    };

    const model = getModel();
    if (!model) {
        return generateMockExplanation();
    }

    try {
        const prompt = `You are a personal financial advisor AI analyzing pre-computed monthly spending statistics.
CRITICAL RULE: Rely ONLY on the exact pre-computed numbers provided in the JSON payload below. Do NOT invent, recalculate, or alter any numbers.

Input Spending Statistics:
${JSON.stringify(statsSummary, null, 2)}

Provide a clear, encouraging 2-sentence summary of spending trends and 2 actionable bullet points for budget optimization. Format your response strictly as JSON:
{
  "explanation": "concise overview sentence...",
  "actionableTips": ["tip 1...", "tip 2..."]
}`;

        const result = await model.generateContent(prompt);
        const latencyMs = Date.now() - startTime;
        const text = result.response.text().trim();
        const usageMetadata = result.response.usageMetadata;
        const promptTokens = usageMetadata?.promptTokenCount || Math.ceil(prompt.length / 4);

        let parsedJson;
        try {
            const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
            parsedJson = JSON.parse(cleanText);
        } catch {
            parsedJson = {
                explanation: text,
                actionableTips: ["Keep track of category budgets", "Compare spending against 3-month trailing averages"]
            };
        }

        return {
            explanation: parsedJson.explanation || "Spending analysis completed.",
            actionableTips: Array.isArray(parsedJson.actionableTips) ? parsedJson.actionableTips : [],
            latencyMs,
            promptTokens
        };
    } catch (error: any) {
        console.error("Gemini API Advisor Error:", error.message || error);
        return generateMockExplanation();
    }
}
