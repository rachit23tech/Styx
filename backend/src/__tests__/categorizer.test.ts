import mongoose from "mongoose";
import { startTestDb, stopTestDb } from "./testDb";
import { Category, CategorizationRule, Correction, LlmFallbackLog, Expense } from "../db/models";
import { categorize, extractMerchantPattern, invalidateCategorizerCache } from "../services/categorizer";
import express from "express";
import request from "supertest";
import expenseRouter from "../routes/expenses";
import correctionsRouter from "../routes/corrections";

// Tests run as one signed-in user; a second id checks data isolation
const USER_ID = new mongoose.Types.ObjectId().toString();
const OTHER_USER_ID = new mongoose.Types.ObjectId().toString();

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
    req.userId = USER_ID;
    next();
});
app.use("/api/expenses", expenseRouter);
app.use("/api", correctionsRouter);

jest.setTimeout(15000);

beforeAll(async () => {
    delete process.env.GEMINI_API_KEY;
    await startTestDb();
});

afterAll(async () => {
    await stopTestDb();
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
        const foodCat = await Category.create({ name: "Food & Dining", user_id: USER_ID });
        await CategorizationRule.create({
            user_id: USER_ID,
            pattern: "SWIGGY",
            category_id: foodCat._id,
            confidence_score: 1
        });

        const result = await categorize(USER_ID, "Swiggy Order #99", 250);
        expect(result.source).toBe("rule");
        expect(result.categoryId.toString()).toBe(foodCat._id.toString());
    });

    it("falls back to Tier 2 LLM classifier and logs call when no rule matches", async () => {
        const transportCat = await Category.create({ name: "Transportation", user_id: USER_ID });

        const result = await categorize(USER_ID, "Uber Taxi Ride", 400);
        expect(result.source).toBe("ai");
        expect(result.categoryId.toString()).toBe(transportCat._id.toString());

        const logs = await LlmFallbackLog.find();
        expect(logs.length).toBe(1);
        expect(logs[0].response_category).toBe("Transportation");
    });

    it("auto-promotes pattern to CategorizationRule on 3rd correction (N=3)", async () => {
        const oldCat = await Category.create({ name: "General", user_id: USER_ID });
        const newCat = await Category.create({ name: "Utilities", user_id: USER_ID });

        for (let i = 1; i <= 3; i++) {
            const exp = await Expense.create({
                user_id: USER_ID,
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

    it("matches rules and keywords on whole words only", async () => {
        const general = await Category.create({ name: "General", user_id: USER_ID });
        const transport = await Category.create({ name: "Transportation", user_id: USER_ID });
        await CategorizationRule.create({ user_id: USER_ID, pattern: "PAY", category_id: transport._id });

        // "PAYTM" contains "PAY" but is a different word, so the rule must not fire
        const paytm = await categorize(USER_ID, "Paytm wallet topup", 100);
        expect(paytm.source).toBe("ai");
        expect(paytm.categoryId.toString()).toBe(general._id.toString());

        // "Cola" contains "OLA" and "Chocolate" contains "OLA" — neither is a cab ride
        const cola = await categorize(USER_ID, "Coca Cola 2L", 90);
        expect(cola.categoryId.toString()).toBe(general._id.toString());
        const chocolate = await categorize(USER_ID, "Chocolate", 50);
        expect(chocolate.categoryId.toString()).toBe(general._id.toString());

        const ola = await categorize(USER_ID, "Ola ride to airport", 350);
        expect(ola.categoryId.toString()).toBe(transport._id.toString());
    });

    it("never uses another user's rules or categories", async () => {
        const mine = await Category.create({ name: "General", user_id: USER_ID });
        const theirs = await Category.create({ name: "Food & Dining", user_id: OTHER_USER_ID });
        await CategorizationRule.create({ user_id: OTHER_USER_ID, pattern: "SWIGGY", category_id: theirs._id });

        const result = await categorize(USER_ID, "Swiggy Order #42", 250);
        expect(result.source).toBe("ai");
        // The keyword fallback suggests "Food & Dining", which this user does not
        // have yet, so it is created for this user rather than borrowing the other one
        expect(result.categoryId.toString()).not.toBe(theirs._id.toString());
        const created = await Category.findOne({ user_id: USER_ID, name: "Food & Dining" });
        expect(created).not.toBeNull();
        expect(result.categoryId.toString()).toBe(String(created!._id));
        expect(mine).toBeDefined();
    });
});

describe("Expense API validation & ownership", () => {
    it("rejects an invalid date and a category that is not the user's", async () => {
        const mine = await Category.create({ name: "General", user_id: USER_ID });
        const theirs = await Category.create({ name: "General", user_id: OTHER_USER_ID });

        const badDate = await request(app)
            .post("/api/expenses")
            .send({ amount: 50, description: "Lunch", date: "garbage", category_id: mine._id.toString() });
        expect(badDate.status).toBe(400);

        const foreign = await request(app)
            .post("/api/expenses")
            .send({ amount: 50, description: "Lunch", category_id: theirs._id.toString() });
        expect(foreign.status).toBe(400);

        const ok = await request(app)
            .post("/api/expenses")
            .send({ amount: 50, description: "Lunch", date: "2026-11-30", category_id: mine._id.toString() });
        expect(ok.status).toBe(201);

        const update = await request(app)
            .put(`/api/expenses/${ok.body._id}`)
            .send({ category_id: theirs._id.toString() });
        expect(update.status).toBe(400);
    });

    it("lists only the user's expenses, with UTC month boundaries", async () => {
        const mine = await Category.create({ name: "General", user_id: USER_ID });
        const theirs = await Category.create({ name: "General", user_id: OTHER_USER_ID });
        const base = { amount: 10, payment_method: "UPI" };
        await Expense.create({ ...base, user_id: USER_ID, category_id: mine._id, description: "first second", date: new Date("2026-11-01T00:00:00.000Z") });
        await Expense.create({ ...base, user_id: USER_ID, category_id: mine._id, description: "last second", date: new Date("2026-11-30T23:59:59.000Z") });
        await Expense.create({ ...base, user_id: USER_ID, category_id: mine._id, description: "next month", date: new Date("2026-12-01T00:00:00.000Z") });
        await Expense.create({ ...base, user_id: OTHER_USER_ID, category_id: theirs._id, description: "someone else", date: new Date("2026-11-15T00:00:00.000Z") });

        const res = await request(app).get("/api/expenses?month=2026-11");
        expect(res.status).toBe(200);
        expect(res.body.pagination.total).toBe(2);
        const descriptions = res.body.data.map((e: any) => e.description).sort();
        expect(descriptions).toEqual(["first second", "last second"]);

        const other = await Expense.findOne({ user_id: OTHER_USER_ID });
        const del = await request(app).delete(`/api/expenses/${other!._id}`);
        expect(del.status).toBe(404);
    });
});
