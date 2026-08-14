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

// ─── Singleton Gemini Client ─────────────────────────────────────────
// Instantiated once at module load, reused across all requests.
let genAIInstance: GoogleGenerativeAI | null = null;
let modelInstance: GenerativeModel | null = null;

function getModel(): GenerativeModel | null {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    if (!genAIInstance) {
        genAIInstance = new GoogleGenerativeAI(apiKey);
        modelInstance = genAIInstance.getGenerativeModel({ model: "gemini-1.5-flash" });
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
        // Deterministic mock fallback when Gemini API key is missing
        const descUpper = description.toUpperCase();
        let selectedCategory = "General";

        if (descUpper.includes("IRCTC") || descUpper.includes("RAIL") || descUpper.includes("TRAIN") || descUpper.includes("UBER") || descUpper.includes("OLA") || descUpper.includes("CAB") || descUpper.includes("FUEL") || descUpper.includes("PETROL") || descUpper.includes("METRO") || descUpper.includes("FLIGHT") || descUpper.includes("INDIGO") || descUpper.includes("MAKEMYTRIP") || descUpper.includes("IXIGO") || descUpper.includes("BUS")) {
            selectedCategory = availableCategories.find(c => c.toLowerCase().includes("transport") || c.toLowerCase().includes("travel")) || "Transportation";
        } else if (descUpper.includes("SWIGGY") || descUpper.includes("ZOMATO") || descUpper.includes("REST") || descUpper.includes("FOOD") || descUpper.includes("DINER") || descUpper.includes("COFFEE") || descUpper.includes("STARBUCKS") || descUpper.includes("PIZZA") || descUpper.includes("DOMINOS")) {
            selectedCategory = availableCategories.find(c => c.toLowerCase().includes("food") || c.toLowerCase().includes("dining")) || "Food & Dining";
        } else if (descUpper.includes("BILL") || descUpper.includes("POWER") || descUpper.includes("WIFI") || descUpper.includes("INTERNET") || descUpper.includes("AIRTEL") || descUpper.includes("JIO") || descUpper.includes("ELECTRICITY")) {
            selectedCategory = availableCategories.find(c => c.toLowerCase().includes("util")) || "Utilities";
        } else if (descUpper.includes("AMAZON") || descUpper.includes("FLIPKART") || descUpper.includes("SHOP") || descUpper.includes("STORE") || descUpper.includes("CLOTH") || descUpper.includes("MYNTRA")) {
            selectedCategory = availableCategories.find(c => c.toLowerCase().includes("shop")) || "Shopping";
        } else if (descUpper.includes("NETFLIX") || descUpper.includes("SPOTIFY") || descUpper.includes("CINEMA") || descUpper.includes("MOVIE") || descUpper.includes("BOOKMYSHOW")) {
            selectedCategory = availableCategories.find(c => c.toLowerCase().includes("entertain")) || "Entertainment";
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
        const total = statsSummary.totalCurrentMonthSpend || 0;
        const mom = statsSummary.totalMomPercentageChange || 0;
        const top = statsSummary.topCategory ? `${statsSummary.topCategory.name} (₹${statsSummary.topCategory.amount.toFixed(2)})` : "N/A";

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
