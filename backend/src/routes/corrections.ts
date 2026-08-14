import express, { Request, Response } from "express";
import mongoose from "mongoose";
import { CategorizationRule, Correction, Expense, LlmFallbackLog } from "../db/models";
import { extractMerchantPattern, invalidateCategorizerCache } from "../services/categorizer";
import { validateObjectId, sanitize } from "../middleware/validation";

const router = express.Router();

/**
 * POST /api/expenses/:id/correct
 * Corrects expense category, saves Correction log, and auto-promotes pattern to CategorizationRule when N >= 3.
 */
router.post("/expenses/:id/correct", validateObjectId(), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const body = sanitize(req.body);
        const { new_category_id } = body;

        if (!new_category_id || !mongoose.Types.ObjectId.isValid(new_category_id)) {
            return res.status(400).json({ error: "A valid new_category_id is required" });
        }

        const expense = await Expense.findById(id);
        if (!expense) {
            return res.status(404).json({ error: "Expense not found" });
        }

        const old_category_id = expense.category_id;
        const merchant_pattern = extractMerchantPattern(expense.description);

        // Update expense category
        expense.category_id = new_category_id;
        expense.auto_categorized = false;
        await expense.save();

        // Create Correction entry
        const correction = new Correction({
            expense_id: expense._id,
            old_category_id,
            new_category_id,
            merchant_pattern
        });
        await correction.save();

        // Count corrections matching merchant_pattern & new_category_id
        const correctionCount = await Correction.countDocuments({
            merchant_pattern,
            new_category_id
        });

        let promotedRule = false;
        if (correctionCount >= 3) {
            // Check if rule already exists for this pattern
            const existingRule = await CategorizationRule.findOne({ pattern: merchant_pattern });
            if (!existingRule) {
                const newRule = new CategorizationRule({
                    pattern: merchant_pattern,
                    category_id: new_category_id,
                    confidence_score: 1
                });
                await newRule.save();
                promotedRule = true;
                invalidateCategorizerCache();
            } else if (existingRule.category_id.toString() !== new_category_id.toString()) {
                existingRule.category_id = new_category_id;
                existingRule.confidence_score += 1;
                await existingRule.save();
                promotedRule = true;
                invalidateCategorizerCache();
            }
        }

        const updatedExpense = await Expense.findById(expense._id).populate("category_id");

        return res.json({
            expense: updatedExpense,
            merchantPattern: merchant_pattern,
            correctionCount,
            promotedRule
        });
    } catch (error: any) {
        return res.status(500).json({ error: error.message || "Failed to process correction" });
    }
});

/**
 * GET /api/llm-logs
 * Returns audit log history of LLM fallback calls.
 */
router.get("/llm-logs", async (_req: Request, res: Response) => {
    try {
        const logs = await LlmFallbackLog.find().sort({ created_at: -1 }).limit(50);
        return res.json(logs);
    } catch (error: any) {
        return res.status(500).json({ error: error.message || "Failed to fetch LLM fallback logs" });
    }
});

/**
 * GET /api/rules
 * Returns all active categorization rules.
 */
router.get("/rules", async (_req: Request, res: Response) => {
    try {
        const rules = await CategorizationRule.find().populate("category_id");
        return res.json(rules);
    } catch (error: any) {
        return res.status(500).json({ error: error.message || "Failed to fetch categorization rules" });
    }
});

export default router;
