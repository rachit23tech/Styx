import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Category, Expense } from "../db/models";
import { computeStatsSummary } from "../services/statsEngine";
import express from "express";
import request from "supertest";
import advisorRouter from "../routes/advisor";

let mongoServer: MongoMemoryServer;
const app = express();
app.use(express.json());
app.use("/api/stats", advisorRouter);

beforeAll(async () => {
    delete process.env.GEMINI_API_KEY;
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    await Category.deleteMany({});
    await Expense.deleteMany({});
});

describe("Stats Engine & Aggregations", () => {
    it("computes monthly spending totals, 3-month trailing averages, and MoM changes", async () => {
        const foodCat = await Category.create({ name: "Food & Dining" });
        const utilCat = await Category.create({ name: "Utilities" });

        // Aug 2026 expenses (Current Month)
        await Expense.create({
            amount: 500,
            description: "Swiggy Food",
            date: new Date("2026-08-10T12:00:00.000Z"),
            category_id: foodCat._id,
            payment_method: "UPI"
        });
        await Expense.create({
            amount: 300,
            description: "Electricity Bill",
            date: new Date("2026-08-15T12:00:00.000Z"),
            category_id: utilCat._id,
            payment_method: "Credit Card"
        });

        // July 2026 expenses (Previous Month)
        await Expense.create({
            amount: 400,
            description: "Zomato Food",
            date: new Date("2026-07-20T12:00:00.000Z"),
            category_id: foodCat._id,
            payment_method: "UPI"
        });

        // June 2026 & May 2026 expenses (Trailing window)
        await Expense.create({
            amount: 600,
            description: "Restaurant",
            date: new Date("2026-06-10T12:00:00.000Z"),
            category_id: foodCat._id,
            payment_method: "Cash"
        });
        await Expense.create({
            amount: 200,
            description: "Water Bill",
            date: new Date("2026-05-05T12:00:00.000Z"),
            category_id: utilCat._id,
            payment_method: "UPI"
        });

        const summary = await computeStatsSummary(2026, 8);

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
        const foodCat = await Category.create({ name: "Food & Dining" });
        await Expense.create({
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
        const foodCat = await Category.create({ name: "Food & Dining" });
        await Expense.create({
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
});
