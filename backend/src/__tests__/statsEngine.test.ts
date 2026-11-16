import mongoose from "mongoose";
import { startTestDb, stopTestDb } from "./testDb";
import { Category, Expense } from "../db/models";
import { computeStatsSummary } from "../services/statsEngine";
import express from "express";
import request from "supertest";
import advisorRouter from "../routes/advisor";

const USER_ID = new mongoose.Types.ObjectId().toString();
const OTHER_USER_ID = new mongoose.Types.ObjectId().toString();

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
    req.userId = USER_ID;
    next();
});
app.use("/api/stats", advisorRouter);

beforeAll(async () => {
    delete process.env.GEMINI_API_KEY;
    await startTestDb();
});

afterAll(async () => {
    await stopTestDb();
});

beforeEach(async () => {
    await Category.deleteMany({});
    await Expense.deleteMany({});
});

describe("Stats Engine & Aggregations", () => {
    it("computes monthly spending totals, 3-month trailing averages, and MoM changes", async () => {
        const foodCat = await Category.create({ name: "Food & Dining", user_id: USER_ID });
        const utilCat = await Category.create({ name: "Utilities", user_id: USER_ID });

        // Aug 2026 expenses (Current Month)
        await Expense.create({
            user_id: USER_ID,
            amount: 500,
            description: "Swiggy Food",
            date: new Date("2026-08-10T12:00:00.000Z"),
            category_id: foodCat._id,
            payment_method: "UPI"
        });
        await Expense.create({
            user_id: USER_ID,
            amount: 300,
            description: "Electricity Bill",
            date: new Date("2026-08-15T12:00:00.000Z"),
            category_id: utilCat._id,
            payment_method: "Credit Card"
        });

        // July 2026 expenses (Previous Month)
        await Expense.create({
            user_id: USER_ID,
            amount: 400,
            description: "Zomato Food",
            date: new Date("2026-07-20T12:00:00.000Z"),
            category_id: foodCat._id,
            payment_method: "UPI"
        });

        // June 2026 & May 2026 expenses (Trailing window)
        await Expense.create({
            user_id: USER_ID,
            amount: 600,
            description: "Restaurant",
            date: new Date("2026-06-10T12:00:00.000Z"),
            category_id: foodCat._id,
            payment_method: "Cash"
        });
        await Expense.create({
            user_id: USER_ID,
            amount: 200,
            description: "Water Bill",
            date: new Date("2026-05-05T12:00:00.000Z"),
            category_id: utilCat._id,
            payment_method: "UPI"
        });

        // Another user's spending in the same month must not leak into the totals
        const otherCat = await Category.create({ name: "Food & Dining", user_id: OTHER_USER_ID });
        await Expense.create({
            user_id: OTHER_USER_ID,
            amount: 9999,
            description: "Someone else's dinner",
            date: new Date("2026-08-11T12:00:00.000Z"),
            category_id: otherCat._id,
            payment_method: "UPI"
        });

        const summary = await computeStatsSummary(USER_ID, 2026, 8);

        expect(summary.period).toBe("2026-08");
        expect(summary.totalCurrentMonthSpend).toBe(800);
        expect(summary.totalPreviousMonthSpend).toBe(400);
        expect(summary.totalMomPercentageChange).toBe(100); // 400 -> 800 is +100%
        expect(summary.topCategory?.name).toBe("Food & Dining");

        const foodStat = summary.categories.find(c => c.categoryName === "Food & Dining");
        expect(foodStat).toBeDefined();
        expect(foodStat?.currentMonthSpend).toBe(500);
        expect(foodStat?.previousMonthSpend).toBe(400);
        expect(foodStat?.momPercentageChange).toBe(25); // (500 - 400) / 400 = 25%
        // Trailing 3 months for food: July (400) + June (600) + May (0) = 1000 / 3 = 333.33
        expect(foodStat?.trailing3MonthAvg).toBeCloseTo(333.33, 1);
    });

    it("GET /api/stats/summary returns statistics payload", async () => {
        const foodCat = await Category.create({ name: "Food & Dining", user_id: USER_ID });
        await Expense.create({
            user_id: USER_ID,
            amount: 250,
            description: "Lunch",
            date: new Date("2026-08-01T10:00:00.000Z"),
            category_id: foodCat._id,
            payment_method: "UPI"
        });

        const res = await request(app).get("/api/stats/summary?month=2026-08");
        expect(res.status).toBe(200);
        expect(res.body.totalCurrentMonthSpend).toBe(250);
    });

    it("POST /api/stats/explain returns Gemini AI spending advice", async () => {
        const foodCat = await Category.create({ name: "Food & Dining", user_id: USER_ID });
        await Expense.create({
            user_id: USER_ID,
            amount: 1500,
            description: "Fine Dining",
            date: new Date("2026-08-05T10:00:00.000Z"),
            category_id: foodCat._id,
            payment_method: "Credit Card"
        });

        const res = await request(app)
            .post("/api/stats/explain")
            .send({ month: "2026-08" });

        expect(res.status).toBe(200);
        expect(res.body.advisorExplanation).toBeDefined();
        expect(res.body.advisorExplanation.explanation).toBeDefined();
        expect(Array.isArray(res.body.advisorExplanation.actionableTips)).toBe(true);
    });

    it("ignores a client-supplied statsSummary and rejects a bad month", async () => {
        const res = await request(app)
            .post("/api/stats/explain")
            .send({ month: "2026-08", statsSummary: { period: "FAKE", totalCurrentMonthSpend: 123456, topCategory: { name: "x" } } });
        expect(res.status).toBe(200);
        expect(res.body.statsSummary.period).toBe("2026-08");
        expect(res.body.statsSummary.totalCurrentMonthSpend).toBe(0);

        const bad = await request(app).get("/api/stats/summary?month=2026-13");
        expect(bad.status).toBe(400);
    });
});
