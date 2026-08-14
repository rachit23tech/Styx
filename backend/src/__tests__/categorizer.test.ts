import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Category, CategorizationRule, Correction, LlmFallbackLog, Expense } from "../db/models";
import { categorize, extractMerchantPattern, invalidateCategorizerCache } from "../services/categorizer";
import express from "express";
import request from "supertest";
import expenseRouter from "../routes/expenses";
import correctionsRouter from "../routes/corrections";

let mongoServer: MongoMemoryServer;
const app = express();
app.use(express.json());
app.use("/api/expenses", expenseRouter);
app.use("/api", correctionsRouter);

jest.setTimeout(15000);

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
    invalidateCategorizerCache();
    await Category.deleteMany({});
    await Expense.deleteMany({});
    await CategorizationRule.deleteMany({});
    await Correction.deleteMany({});
    await LlmFallbackLog.deleteMany({});
});

describe("Merchant Pattern Extraction", () => {
    it("extracts primary uppercase token from description", () => {
        expect(extractMerchantPattern("Swiggy Order #9812")).toBe("SWIGGY");
        expect(extractMerchantPattern("Uber Trip 123")).toBe("UBER");
    });
});

describe("Hybrid Categorization Pipeline & Feedback Loop", () => {
    it("uses Tier 1 Rule Matcher when rule pattern exists", async () => {
        const foodCat = await Category.create({ name: "Food & Dining" });
        await CategorizationRule.create({
            pattern: "SWIGGY",
            category_id: foodCat._id,
            confidence_score: 1
        });

        const result = await categorize("Swiggy Order #99", 250);
        expect(result.source).toBe("rule");
        expect(result.categoryId.toString()).toBe(foodCat._id.toString());
    });

    it("falls back to Tier 2 LLM classifier and logs call when no rule matches", async () => {
        const transportCat = await Category.create({ name: "Transportation" });

        const result = await categorize("Uber Taxi Ride", 400);
        expect(result.source).toBe("ai");
        expect(result.categoryId.toString()).toBe(transportCat._id.toString());

        const logs = await LlmFallbackLog.find();
        expect(logs.length).toBe(1);
        expect(logs[0].response_category).toBe("Transportation");
    });

    it("auto-promotes pattern to CategorizationRule on 3rd correction (N=3)", async () => {
        const oldCat = await Category.create({ name: "General" });
        const newCat = await Category.create({ name: "Utilities" });

        for (let i = 1; i <= 3; i++) {
            const exp = await Expense.create({
                amount: 100 * i,
                description: `Airtel Broadband Bill ${i}`,
                date: new Date(),
                category_id: oldCat._id,
                payment_method: "Credit Card"
            });

            const res = await request(app)
                .post(`/api/expenses/${exp._id}/correct`)
                .send({ new_category_id: newCat._id.toString() });

            expect(res.status).toBe(200);
            expect(res.body.correctionCount).toBe(i);

            if (i < 3) {
                expect(res.body.promotedRule).toBe(false);
            } else {
                expect(res.body.promotedRule).toBe(true);
            }
        }

        const createdRule = await CategorizationRule.findOne({ pattern: "AIRTEL" });
        expect(createdRule).not.toBeNull();
        expect(createdRule?.category_id.toString()).toBe(newCat._id.toString());
    });
});
