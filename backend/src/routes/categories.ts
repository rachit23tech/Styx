import express, { Request, Response } from "express";
import { Category } from "../db/models";

const router = express.Router();

// GET all categories
router.get("/", async (req: Request, res: Response) => {
    try {
        const categories = await Category.find().sort({ name: 1 });
        res.json(categories);
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Failed to fetch categories" });
    }
});

// POST create category
router.post("/", async (req: Request, res: Response) => {
    try {
        const { name } = req.body;
        if (!name || typeof name !== "string") {
            return res.status(400).json({ error: "Category name is required" });
        }
        const category = new Category({ name: name.trim() });
        await category.save();
        res.status(201).json(category);
    } catch (error: any) {
        if (error.code === 11000) {
            return res.status(400).json({ error: "Category with this name already exists" });
        }
        res.status(500).json({ error: error.message || "Failed to create category" });
    }
});

// PUT update category
router.put("/:id", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        if (!name || typeof name !== "string") {
            return res.status(400).json({ error: "Category name is required" });
        }
        const category = await Category.findByIdAndUpdate(
            id,
            { name: name.trim() },
            { new: true, runValidators: true }
        );
        if (!category) {
            return res.status(404).json({ error: "Category not found" });
        }
        res.json(category);
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Failed to update category" });
    }
});

// DELETE category
router.delete("/:id", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const category = await Category.findByIdAndDelete(id);
        if (!category) {
            return res.status(404).json({ error: "Category not found" });
        }
        res.json({ message: "Category deleted successfully", category });
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Failed to delete category" });
    }
});

export default router;