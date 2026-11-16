import express, { Request, Response } from "express";
import { CategorizationRule, Category, Expense } from "../db/models";
import { validateObjectId, sanitize } from "../middleware/validation";
import { invalidateCategorizerCache } from "../services/categorizer";

const router = express.Router();

const DUPLICATE_MESSAGE = "Category with this name already exists";

// GET all of the user's categories
router.get("/", async (req: Request, res: Response) => {
    try {
        const categories = await Category.find({ user_id: req.userId! }).sort({ name: 1 });
        return res.json(categories);
    } catch (error: any) {
        return res.status(500).json({ error: error.message || "Failed to fetch categories" });
    }
});

// POST create category
router.post("/", async (req: Request, res: Response) => {
    try {
        const userId = req.userId!;
        const body = sanitize(req.body) || {};
        const { name } = body;
        if (!name || typeof name !== "string" || !name.trim()) {
            return res.status(400).json({ error: "Category name is required" });
        }
        if (name.trim().length > 100) {
            return res.status(400).json({ error: "Category name must be 100 characters or less" });
        }
        const category = new Category({ name: name.trim(), user_id: userId });
        await category.save();
        invalidateCategorizerCache(userId);
        return res.status(201).json(category);
    } catch (error: any) {
        if (error.code === 11000) {
            return res.status(400).json({ error: DUPLICATE_MESSAGE });
        }
        return res.status(500).json({ error: error.message || "Failed to create category" });
    }
});

// PUT update category
router.put("/:id", validateObjectId(), async (req: Request, res: Response) => {
    try {
        const userId = req.userId!;
        const { id } = req.params;
        const body = sanitize(req.body) || {};
        const { name } = body;
        if (!name || typeof name !== "string" || !name.trim()) {
            return res.status(400).json({ error: "Category name is required" });
        }
        if (name.trim().length > 100) {
            return res.status(400).json({ error: "Category name must be 100 characters or less" });
        }
        const clash = await Category.exists({ user_id: userId, name: name.trim(), _id: { $ne: id } });
        if (clash) {
            return res.status(400).json({ error: DUPLICATE_MESSAGE });
        }
        const category = await Category.findOneAndUpdate(
            { _id: id, user_id: userId },
            { name: name.trim() },
            { new: true, runValidators: true }
        );
        if (!category) {
            return res.status(404).json({ error: "Category not found" });
        }
        invalidateCategorizerCache(userId);
        return res.json(category);
    } catch (error: any) {
        if (error.code === 11000) {
            return res.status(400).json({ error: DUPLICATE_MESSAGE });
        }
        return res.status(500).json({ error: error.message || "Failed to update category" });
    }
});

// DELETE category — expenses that use it are moved to the user's "General" category
router.delete("/:id", validateObjectId(), async (req: Request, res: Response) => {
    try {
        const userId = req.userId!;
        const { id } = req.params;

        const category = await Category.findOne({ _id: id, user_id: userId });
        if (!category) {
            return res.status(404).json({ error: "Category not found" });
        }

        // Check if any expenses reference this category
        const referencingCount = await Expense.countDocuments({ user_id: userId, category_id: id });
        if (referencingCount > 0) {
            // Find or create a "General" fallback category
            let fallback = await Category.findOne({ user_id: userId, name: "General" });
            if (!fallback) {
                fallback = await Category.create({ name: "General", user_id: userId });
            }

            if (String(fallback._id) === id) {
                return res.status(400).json({
                    error: `Cannot delete "General" category — ${referencingCount} expense(s) depend on it. Reassign them first.`
                });
            }

            // Reassign all referencing expenses to the General category
            await Expense.updateMany(
                { user_id: userId, category_id: id },
                { $set: { category_id: fallback._id } }
            );
        }

        // Rules that pointed at this category no longer have a target
        await CategorizationRule.deleteMany({ user_id: userId, category_id: id });
        await Category.deleteOne({ _id: id, user_id: userId });
        invalidateCategorizerCache(userId);
        return res.json({
            message: "Category deleted successfully",
            category,
            reassignedExpenses: referencingCount
        });
    } catch (error: any) {
        return res.status(500).json({ error: error.message || "Failed to delete category" });
    }
});

export default router;
