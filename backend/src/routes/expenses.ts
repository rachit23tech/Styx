import express, { Request, Response } from "express";
import mongoose from "mongoose";
import { Category, Expense } from "../db/models";
import { categorize } from "../services/categorizer";
import { validateObjectId, sanitize, parseMonth, parseDate } from "../middleware/validation";

const router = express.Router();

const MAX_PAYMENT_METHOD_LENGTH = 50;

/** True if the category id is well-formed and belongs to this user. */
async function ownsCategory(userId: string, categoryId: unknown): Promise<boolean> {
    if (typeof categoryId !== "string" || !mongoose.Types.ObjectId.isValid(categoryId)) return false;
    return !!(await Category.exists({ _id: categoryId, user_id: userId }));
}

// GET expenses with optional ?month=YYYY-MM filtering, pagination, and category populate
router.get("/", async (req: Request, res: Response) => {
    try {
        const userId = req.userId!;
        const { month, year, page, limit: limitStr } = req.query;
        const queryFilter: any = { user_id: userId };

        if (month) {
            const parsed = parseMonth(String(month));
            if (!parsed) {
                return res.status(400).json({ error: "Invalid month format. Expected YYYY-MM" });
            }
            // Month boundaries in UTC, independent of the server's timezone
            const startDate = new Date(Date.UTC(parsed.year, parsed.month - 1, 1));
            const endDate = new Date(Date.UTC(parsed.year, parsed.month, 1));
            queryFilter.date = { $gte: startDate, $lt: endDate };
        } else if (year) {
            const yearNum = Number(year);
            if (!Number.isInteger(yearNum) || yearNum < 2000 || yearNum > 2100) {
                return res.status(400).json({ error: "Invalid year" });
            }
            const startDate = new Date(Date.UTC(yearNum, 0, 1));
            const endDate = new Date(Date.UTC(yearNum + 1, 0, 1));
            queryFilter.date = { $gte: startDate, $lt: endDate };
        }

        const pageNum = Math.max(1, Math.floor(Number(page)) || 1);
        const perPage = Math.min(200, Math.max(1, Math.floor(Number(limitStr)) || 100));

        const expenses = await Expense.find(queryFilter)
            .populate("category_id")
            .sort({ date: -1, _id: -1 })
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
        const userId = req.userId!;
        const body = sanitize(req.body) || {};
        const { amount, description, date, category_id, payment_method } = body;

        if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({ error: "Amount must be a positive number" });
        }
        if (!description || typeof description !== "string" || !description.trim()) {
            return res.status(400).json({ error: "Description is required" });
        }
        if (description.trim().length > 500) {
            return res.status(400).json({ error: "Description must be 500 characters or less" });
        }

        let expenseDate = new Date();
        if (date !== undefined && date !== null && date !== "") {
            const parsed = parseDate(date);
            if (!parsed) {
                return res.status(400).json({ error: "Invalid date" });
            }
            expenseDate = parsed;
        }

        if (payment_method !== undefined && payment_method !== null &&
            (typeof payment_method !== "string" || payment_method.trim().length > MAX_PAYMENT_METHOD_LENGTH)) {
            return res.status(400).json({ error: `Payment method must be text of ${MAX_PAYMENT_METHOD_LENGTH} characters or less` });
        }

        let assignedCategoryId = category_id;
        let isAutoCategorized = false;

        if (!assignedCategoryId || assignedCategoryId === "auto") {
            const result = await categorize(userId, description.trim(), amount);
            assignedCategoryId = result.categoryId;
            isAutoCategorized = true;
        } else if (!(await ownsCategory(userId, assignedCategoryId))) {
            return res.status(400).json({ error: "Category not found" });
        }

        const expense = new Expense({
            user_id: userId,
            amount,
            description: description.trim(),
            date: expenseDate,
            category_id: assignedCategoryId,
            payment_method: (typeof payment_method === "string" && payment_method.trim()) || "Cash",
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
        const userId = req.userId!;
        const { id } = req.params;
        const body = sanitize(req.body) || {};
        const { amount, description, date, category_id, payment_method, auto_categorized } = body;

        const updateData: any = {};

        if (amount !== undefined) {
            if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
                return res.status(400).json({ error: "Amount must be a positive number" });
            }
            updateData.amount = amount;
        }
        if (description !== undefined) {
            if (typeof description !== "string" || description.trim().length === 0) {
                return res.status(400).json({ error: "Description cannot be empty" });
            }
            if (description.trim().length > 500) {
                return res.status(400).json({ error: "Description must be 500 characters or less" });
            }
            updateData.description = description.trim();
        }
        if (date !== undefined && date !== null && date !== "") {
            const parsed = parseDate(date);
            if (!parsed) {
                return res.status(400).json({ error: "Invalid date" });
            }
            updateData.date = parsed;
        }
        if (category_id !== undefined && category_id !== null && category_id !== "") {
            if (!(await ownsCategory(userId, category_id))) {
                return res.status(400).json({ error: "Category not found" });
            }
            updateData.category_id = category_id;
        }
        if (payment_method !== undefined && payment_method !== null && payment_method !== "") {
            if (typeof payment_method !== "string" || payment_method.trim().length > MAX_PAYMENT_METHOD_LENGTH) {
                return res.status(400).json({ error: `Payment method must be text of ${MAX_PAYMENT_METHOD_LENGTH} characters or less` });
            }
            updateData.payment_method = payment_method.trim();
        }
        if (auto_categorized !== undefined) {
            if (typeof auto_categorized !== "boolean") {
                return res.status(400).json({ error: "auto_categorized must be true or false" });
            }
            updateData.auto_categorized = auto_categorized;
        }

        const expense = await Expense.findOneAndUpdate(
            { _id: id, user_id: userId },
            updateData,
            { new: true, runValidators: true }
        ).populate("category_id");
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
        const expense = await Expense.findOneAndDelete({ _id: id, user_id: req.userId! });
        if (!expense) {
            return res.status(404).json({ error: "Expense not found" });
        }
        return res.json({ message: "Expense deleted successfully", expense });
    } catch (error: any) {
        return res.status(500).json({ error: error.message || "Failed to delete expense" });
    }
});

export default router;
