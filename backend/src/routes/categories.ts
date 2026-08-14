import express, { Request, Response } from "express";
import { Category, Expense } from "../db/models";
import { validateObjectId, sanitize } from "../middleware/validation";
import { invalidateCategorizerCache } from "../services/categorizer";

const router = express.Router();

// GET all categories
router.get("/", async (_req: Request, res: Response) => {
    try {
        const categories = await Category.find().sort({ name: 1 });
        return res.json(categories);
    } catch (error: any) {
        return res.status(500).json({ error: error.message || "Failed to fetch categories" });
    }
});

// POST create category
router.post("/", async (req: Request, res: Response) => {
    try {
        const body = sanitize(req.body);
        const { name } = body;
        if (!name || typeof name !== "string" || !name.trim()) {
            return res.status(400).json({ error: "Category name is required" });
        }
        if (name.trim().length > 100) {
            return res.status(400).json({ error: "Category name must be 100 characters or less" });
        }
        const category = new Category({ name: name.trim() });
        await category.save();
        invalidateCategorizerCache();
        return res.status(201).json(category);
    } catch (error: any) {
        if (error.code === 11000) {
            return res.status(400).json({ error: "Category with this name already exists" });
        }
        return res.status(500).json({ error: error.message || "Failed to create category" });
    }
});

// PUT update category
router.put("/:id", validateObjectId(), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const body = sanitize(req.body);
        const { name } = body;
        if (!name || typeof name !== "string" || !name.trim()) {
            return res.status(400).json({ error: "Category name is required" });
        }
        if (name.trim().length > 100) {
            return res.status(400).json({ error: "Category name must be 100 characters or less" });
        }
        const category = await Category.findByIdAndUpdate(
            id,
            { name: name.trim() },
            { new: true, runValidators: true }
        );
        if (!category) {
            return res.status(404).json({ error: "Category not found" });
        }
        invalidateCategorizerCache();
        return res.json(category);
    } catch (error: any) {
        return res.status(500).json({ error: error.message || "Failed to update category" });
    }
});

// DELETE category — blocks if expenses reference it, or reassigns to General
router.delete("/:id", validateObjectId(), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const category = await Category.findById(id);
        if (!category) {
            return res.status(404).json({ error: "Category not found" });
        }

        // Check if any expenses reference this category
        const referencingCount = await Expense.countDocuments({ category_id: id });
        if (referencingCount > 0) {
            // Find or create a "General" fallback category
            let fallback = await Category.findOne({ name: "General" });
            if (!fallback) {
                fallback = await Category.create({ name: "General" });
            }

            if (fallback._id.toString() === id) {
                return res.status(400).json({
                    error: `Cannot delete "General" category — ${referencingCount} expense(s) depend on it. Reassign them first.`
                });
            }

            // Reassign all referencing expenses to the General category
            await Expense.updateMany(
                { category_id: id },
                { $set: { category_id: fallback._id } }
            );
        }

        await Category.findByIdAndDelete(id);
        invalidateCategorizerCache();
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