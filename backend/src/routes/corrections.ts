import express, { Request, Response } from "express";
import mongoose from "mongoose";
import { CategorizationRule, Category, Correction, Expense, LlmFallbackLog } from "../db/models";
import { extractMerchantPattern, invalidateCategorizerCache } from "../services/categorizer";
import { validateObjectId, sanitize } from "../middleware/validation";

const router = express.Router();

/**
 * POST /api/expenses/:id/correct
 * Corrects expense category, saves Correction log, and auto-promotes pattern to CategorizationRule when N >= 3.
 */
router.post("/expenses/:id/correct", validateObjectId(), async (req: Request, res: Response) => {
    try {
        const userId = req.userId!;
        const { id } = req.params;
        const body = sanitize(req.body) || {};
        const { new_category_id } = body;

        if (typeof new_category_id !== "string" || !mongoose.Types.ObjectId.isValid(new_category_id)) {
            return res.status(400).json({ error: "A valid new_category_id is required" });
        }
        const newCategory = await Category.findOne({ _id: new_category_id, user_id: userId });
        if (!newCategory) {
            return res.status(400).json({ error: "Category not found" });
        }

        const expense = await Expense.findOne({ _id: id, user_id: userId });
        if (!expense) {
            return res.status(404).json({ error: "Expense not found" });
        }

        const old_category_id = expense.category_id;
        const merchant_pattern = extractMerchantPattern(expense.description);

        // Update expense category
        expense.category_id = newCategory._id as mongoose.Types.ObjectId;
        expense.auto_categorized = false;
        await expense.save();

        // Create Correction entry
        const correction = new Correction({
            user_id: userId,
            expense_id: expense._id,
            old_category_id,
            new_category_id: newCategory._id,
            merchant_pattern
        });
        await correction.save();

        // Count this user's corrections matching merchant_pattern & new_category_id
        const correctionCount = await Correction.countDocuments({
            user_id: userId,
            merchant_pattern,
            new_category_id: newCategory._id
        });

        let promotedRule = false;
        if (correctionCount >= 3) {
            // Check if rule already exists for this pattern
            const existingRule = await CategorizationRule.findOne({ user_id: userId, pattern: merchant_pattern });
            if (!existingRule) {
                const newRule = new CategorizationRule({
                    user_id: userId,
                    pattern: merchant_pattern,
                    category_id: newCategory._id,
                    confidence_score: 1
                });
                await newRule.save();
                promotedRule = true;
                invalidateCategorizerCache(userId);
            } else if (existingRule.category_id.toString() !== String(newCategory._id)) {
                existingRule.category_id = newCategory._id as mongoose.Types.ObjectId;
                existingRule.confidence_score += 1;
                await existingRule.save();
                promotedRule = true;
                invalidateCategorizerCache(userId);
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
 * Returns audit log history of the user's LLM fallback calls.
 */
router.get("/llm-logs", async (req: Request, res: Response) => {
    try {
        const logs = await LlmFallbackLog.find({ user_id: req.userId! }).sort({ created_at: -1 }).limit(50);
        return res.json(logs);
    } catch (error: any) {
        return res.status(500).json({ error: error.message || "Failed to fetch LLM fallback logs" });
    }
});

/**
 * GET /api/rules
 * Returns all of the user's active categorization rules.
 */
router.get("/rules", async (req: Request, res: Response) => {
    try {
        const rules = await CategorizationRule.find({ user_id: req.userId! }).populate("category_id");
        return res.json(rules);
    } catch (error: any) {
        return res.status(500).json({ error: error.message || "Failed to fetch categorization rules" });
    }
});

export default router;
