import express, { Request, Response } from "express";
import { Expense } from "../db/models";

const router = express.Router();

// GET expenses with optional ?month=YYYY-MM filtering and category populate
router.get("/", async (req: Request, res: Response) => {
    try {
        const { month, year } = req.query;
        let queryFilter: any = {};

        if (month) {
            const dateStr = String(month); // e.g. "2026-08"
            const startDate = new Date(`${dateStr}-01T00:00:00.000Z`);
            const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);
            queryFilter.date = { $gte: startDate, $lte: endDate };
        } else if (year) {
            const yearNum = Number(year);
            const startDate = new Date(`${yearNum}-01-01T00:00:00.000Z`);
            const endDate = new Date(`${yearNum}-12-31T23:59:59.999Z`);
            queryFilter.date = { $gte: startDate, $lte: endDate };
        }

        const expenses = await Expense.find(queryFilter)
            .populate("category_id")
            .sort({ date: -1 });

        res.json(expenses);
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Failed to fetch expenses" });
    }
});

// POST create expense
router.post("/", async (req: Request, res: Response) => {
    try {
        const { amount, description, date, category_id, payment_method, auto_categorized } = req.body;

        if (amount === undefined || amount <= 0) {
            return res.status(400).json({ error: "Amount must be a positive number" });
        }
        if (!description) {
            return res.status(400).json({ error: "Description is required" });
        }
        if (!category_id) {
            return res.status(400).json({ error: "Category ID is required" });
        }

        const expense = new Expense({
            amount,
            description: description.trim(),
            date: date ? new Date(date) : new Date(),
            category_id,
            payment_method: payment_method || "Cash",
            auto_categorized: auto_categorized || false
        });

        await expense.save();
        const populatedExpense = await Expense.findById(expense._id).populate("category_id");
        res.status(201).json(populatedExpense);
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Failed to create expense" });
    }
});

// PUT update expense
router.put("/:id", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { amount, description, date, category_id, payment_method, auto_categorized } = req.body;

        const updateData: any = {};
        if (amount !== undefined) updateData.amount = amount;
        if (description) updateData.description = description.trim();
        if (date) updateData.date = new Date(date);
        if (category_id) updateData.category_id = category_id;
        if (payment_method) updateData.payment_method = payment_method;
        if (auto_categorized !== undefined) updateData.auto_categorized = auto_categorized;

        const expense = await Expense.findByIdAndUpdate(id, updateData, { new: true }).populate("category_id");
        if (!expense) {
            return res.status(404).json({ error: "Expense not found" });
        }
        res.json(expense);
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Failed to update expense" });
    }
});

// DELETE expense
router.delete("/:id", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const expense = await Expense.findByIdAndDelete(id);
        if (!expense) {
            return res.status(404).json({ error: "Expense not found" });
        }
        res.json({ message: "Expense deleted successfully", expense });
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Failed to delete expense" });
    }
});

export default router;
