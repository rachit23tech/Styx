import mongoose from "mongoose";
import express from "express";
import request from "supertest";
import { startTestDb, stopTestDb } from "./testDb";
import { Category, Expense, User } from "../db/models";
import authRouter from "../routes/auth";
import expenseRouter from "../routes/expenses";
import categoryRouter from "../routes/categories";
import { requireAuth } from "../middleware/auth";
import { invalidateCategorizerCache } from "../services/categorizer";

const app = express();
app.use(express.json());
app.use("/api/auth", authRouter);
app.use("/api/categories", requireAuth, categoryRouter);
app.use("/api/expenses", requireAuth, expenseRouter);

jest.setTimeout(20000);

beforeAll(async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.LEGACY_OWNER_EMAIL;
    process.env.JWT_SECRET = "test-secret-for-jest-only";
    await startTestDb();
    await Promise.all([User.syncIndexes(), Category.syncIndexes()]);
});

afterAll(async () => {
    await stopTestDb();
});

beforeEach(async () => {
    invalidateCategorizerCache();
    delete process.env.LEGACY_OWNER_EMAIL;
    await User.deleteMany({});
    await Category.deleteMany({});
    await Expense.deleteMany({});
});

const register = (email: string, password = "correct-horse-1") =>
    request(app).post("/api/auth/register").send({ email, password });

describe("Accounts", () => {
    it("registers, logs in and returns the current user", async () => {
        const reg = await register("Asha@Example.com");
        expect(reg.status).toBe(201);
        expect(reg.body.token).toBeDefined();
        expect(reg.body.user.email).toBe("asha@example.com");
        expect(reg.body.user.password_hash).toBeUndefined();

        const stored = await User.findOne({ email: "asha@example.com" });
        expect(stored!.password_hash).not.toContain("correct-horse-1");

        const login = await request(app).post("/api/auth/login").send({ email: "asha@example.com", password: "correct-horse-1" });
        expect(login.status).toBe(200);

        const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${login.body.token}`);
        expect(me.status).toBe(200);
        expect(me.body.user.email).toBe("asha@example.com");
    });

    it("rejects bad input, duplicates and wrong passwords", async () => {
        expect((await register("not-an-email")).status).toBe(400);
        expect((await register("a@example.com", "short")).status).toBe(400);
        expect((await request(app).post("/api/auth/register").send({ email: { $gt: "" }, password: "correct-horse-1" })).status).toBe(400);

        expect((await register("a@example.com")).status).toBe(201);
        expect((await register("a@example.com")).status).toBe(409);

        const wrong = await request(app).post("/api/auth/login").send({ email: "a@example.com", password: "wrong-password" });
        expect(wrong.status).toBe(401);
        const unknown = await request(app).post("/api/auth/login").send({ email: "nobody@example.com", password: "wrong-password" });
        expect(unknown.status).toBe(401);
        expect(unknown.body.error).toBe(wrong.body.error);
    });

    it("blocks requests without a valid token", async () => {
        expect((await request(app).get("/api/expenses")).status).toBe(401);
        expect((await request(app).get("/api/expenses").set("Authorization", "Bearer not.a.token")).status).toBe(401);
    });

    it("gives each user their own categories and expenses", async () => {
        const a = (await register("a@example.com")).body.token;
        const b = (await register("b@example.com")).body.token;
        const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

        const catsA = await request(app).get("/api/categories").set(auth(a));
        const catsB = await request(app).get("/api/categories").set(auth(b));
        expect(catsA.body.length).toBe(7);
        expect(catsB.body.length).toBe(7);
        const idsA = new Set(catsA.body.map((c: any) => c._id));
        expect(catsB.body.some((c: any) => idsA.has(c._id))).toBe(false);

        const created = await request(app).post("/api/expenses").set(auth(a))
            .send({ amount: 120, description: "Zomato dinner", date: "2026-11-10" });
        expect(created.status).toBe(201);
        expect(created.body.category_id.name).toBe("Food & Dining");

        const listB = await request(app).get("/api/expenses").set(auth(b));
        expect(listB.body.pagination.total).toBe(0);

        // B cannot read, change or delete A's expense, or use A's category
        expect((await request(app).put(`/api/expenses/${created.body._id}`).set(auth(b)).send({ amount: 1 })).status).toBe(404);
        expect((await request(app).delete(`/api/expenses/${created.body._id}`).set(auth(b))).status).toBe(404);
        expect((await request(app).post("/api/expenses").set(auth(b))
            .send({ amount: 5, description: "Tea", category_id: catsA.body[0]._id })).status).toBe(400);
        expect((await request(app).delete(`/api/categories/${catsA.body[0]._id}`).set(auth(b))).status).toBe(404);

        const listA = await request(app).get("/api/expenses").set(auth(a));
        expect(listA.body.pagination.total).toBe(1);
        expect(listA.body.data[0].amount).toBe(120);
    });

    it("hands pre-account data only to LEGACY_OWNER_EMAIL", async () => {
        // Documents written before accounts existed have no user_id
        const legacyCat = new mongoose.Types.ObjectId();
        await Category.collection.insertOne({ _id: legacyCat, name: "General" });
        await Expense.collection.insertOne({
            amount: 75, description: "Old expense", date: new Date("2026-08-01T00:00:00.000Z"),
            category_id: legacyCat, payment_method: "Cash", auto_categorized: false
        });

        process.env.LEGACY_OWNER_EMAIL = "owner@example.com";
        const stranger = (await register("stranger@example.com")).body.token;
        const strangerList = await request(app).get("/api/expenses").set("Authorization", `Bearer ${stranger}`);
        expect(strangerList.body.pagination.total).toBe(0);

        const owner = (await register("owner@example.com")).body.token;
        const ownerList = await request(app).get("/api/expenses").set("Authorization", `Bearer ${owner}`);
        expect(ownerList.body.pagination.total).toBe(1);
        expect(ownerList.body.data[0].description).toBe("Old expense");
        expect(ownerList.body.data[0].category_id.name).toBe("General");

        const ownerCats = await request(app).get("/api/categories").set("Authorization", `Bearer ${owner}`);
        expect(ownerCats.body.filter((c: any) => c.name === "General").length).toBe(1);
        expect(ownerCats.body.length).toBe(7);
    });
});
