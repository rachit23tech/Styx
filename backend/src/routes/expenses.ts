import express, { Request, Response } from "express";
import mongoose from "mongoose";
import { Expense } from "../db/models";
import { categorize } from "../services/categorizer";
import { validateObjectId, sanitize } from "../middleware/validation";

const router = express.Router();

// GET expenses with optional ?month=YYYY-MM filtering, pagination, and category populate
router.get("/", async (req: Request, res: Response) => {
    try {
        const { month, year, page, limit: limitStr } = req.query;
        let queryFilter: any = {};

        if (month) {
            const dateStr = String(month); // e.g. "2026-08"
            if (!/^\d{4}-\d{2}$/.test(dateStr)) {
                return res.status(400).json({ error: "Invalid month format. Expected YYYY-MM" });
            }
            const startDate = new Date(`${dateStr}-01T00:00:00.000Z`);
            const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);
            queryFilter.date = { $gte: startDate, $lte: endDate };
        } else if (year) {
            const yearNum = Number(year);
            if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
                return res.status(400).json({ error: "Invalid year" });
            }
            const startDate = new Date(`${yearNum}-01-01T00:00:00.000Z`);
            const endDate = new Date(`${yearNum}-12-31T23:59:59.999Z`);
            queryFilter.date = { $gte: startDate, $lte: endDate };
        }

        const pageNum = Math.max(1, Number(page) || 1);
        const perPage = Math.min(200, Math.max(1, Number(limitStr) || 100));

        const expenses = await Expense.find(queryFilter)
            .populate("category_id")
            .sort({ date: -1 })
            .skip((pageNum - 1) * perPage)
            .limit(perPage);

        const total = await Expense.countDocuments(queryFilter);

        res.json({
            data: expenses,
            pagination: { page: pageNum, limit: perPage, total, totalPages: Math.ceil(total / perPage) }
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Failed to fetch expenses" });
    }
});

// POST create expense
router.post("/", async (req: Request, res: Response) => {
    try {
        const body = sanitize(req.body);
        const { amount, description, date, category_id, payment_method } = body;

        if (amount === undefined || typeof amount !== "number" || amount <= 0) {
            return res.status(400).json({ error: "Amount must be a positive number" });
        }
        if (!description || typeof description !== "string" || !description.trim()) {
            return res.status(400).json({ error: "Description is required" });
        }
        if (description.trim().length > 500) {
            return res.status(400).json({ error: "Description must be 500 characters or less" });
        }

        let assignedCategoryId = category_id;
        let isAutoCategorized = false;

        if (!assignedCategoryId || assignedCategoryId === "auto") {
            const result = await categorize(description.trim(), Number(amount));
            assignedCategoryId = result.categoryId;
            isAutoCategorized = true;
        } else {
            // Validate provided category_id is a valid ObjectId
            if (!mongoose.Types.ObjectId.isValid(assignedCategoryId)) {
                return res.status(400).json({ error: "Invalid category_id format" });
            }
        }

        const expense = new Expense({
            amount,
            description: description.trim(),
            date: date ? new Date(date) : new Date(),
            category_id: assignedCategoryId,
            payment_method: payment_method || "Cash",
            auto_categorized: isAutoCategorized
        });

        await expense.save();
        const populatedExpense = await Expense.findById(expense._id).populate("category_id");
        return res.status(201).json(populatedExpense);
    } catch (error: any) {
        return res.status(500).json({ error: error.message || "Failed to create expense" });
    }
});

// PUT update expense
router.put("/:id", validateObjectId(), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const body = sanitize(req.body);
        const { amount, description, date, category_id, payment_method, auto_categorized } = body;

        const updateData: any = {};

        if (amount !== undefined) {
            if (typeof amount !== "number" || amount <= 0) {
                return res.status(400).json({ error: "Amount must be a positive number" });
            }
            updateData.amount = amount;
        }
        if (description) {
            if (typeof description !== "string" || description.trim().length === 0) {
                return res.status(400).json({ error: "Description cannot be empty" });
            }
            if (description.trim().length > 500) {
                return res.status(400).json({ error: "Description must be 500 characters or less" });
            }
            updateData.description = description.trim();
        }
        if (date) updateData.date = new Date(date);
        if (category_id) {
            if (!mongoose.Types.ObjectId.isValid(category_id)) {
                return res.status(400).json({ error: "Invalid category_id format" });
            }
            updateData.category_id = category_id;
        }
        if (payment_method) updateData.payment_method = payment_method;
        if (auto_categorized !== undefined) updateData.auto_categorized = auto_categorized;

        const expense = await Expense.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).populate("category_id");
        if (!expense) {
            return res.status(404).json({ error: "Expense not found" });
        }
        return res.json(expense);
    } catch (error: any) {
        return res.status(500).json({ error: error.message || "Failed to update expense" });
    }
});

// DELETE expense
router.delete("/:id", validateObjectId(), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const expense = await Expense.findByIdAndDelete(id);
        if (!expense) {
            return res.status(404).json({ error: "Expense not found" });
        }
        return res.json({ message: "Expense deleted successfully", expense });
    } catch (error: any) {
        return res.status(500).json({ error: error.message || "Failed to delete expense" });
    }
});

export default router;
