import express, { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { CategorizationRule, Category, Correction, Expense, IUser, LlmFallbackLog, User } from "../db/models";
import { seedDefaultCategories } from "../db/database";
import { requireAuth, signToken } from "../middleware/auth";
import { invalidateCategorizerCache } from "../services/categorizer";

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72; // bcrypt only uses the first 72 bytes
const BCRYPT_ROUNDS = 10;
// Compared against when the email is unknown, so both cases take similar time
const DUMMY_HASH = bcrypt.hashSync("styx-dummy-password", BCRYPT_ROUNDS);

const publicUser = (user: IUser) => ({ id: String(user._id), email: user.email });

function readCredentials(body: any): { email: string; password: string } | { error: string } {
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
        return { error: "A valid email address is required" };
    }
    if (!password) {
        return { error: "Password is required" };
    }
    return { email, password };
}

/**
 * Data created before user accounts existed has no owner. It is handed to
 * the account whose email matches LEGACY_OWNER_EMAIL, the first time that
 * account registers or logs in. Without that variable it stays untouched.
 */
async function claimLegacyData(user: IUser): Promise<void> {
    const ownerEmail = (process.env.LEGACY_OWNER_EMAIL || "").trim().toLowerCase();
    if (!ownerEmail || user.email !== ownerEmail) return;

    const orphan = { user_id: { $exists: false } };
    const userId = user._id;

    // Categories: merge into a same-named category the user already has, else adopt
    const legacyCategories = await Category.find(orphan).lean();
    for (const legacy of legacyCategories) {
        const existing = await Category.findOne({ user_id: userId, name: legacy.name });
        if (existing) {
            await Expense.updateMany({ ...orphan, category_id: legacy._id }, { $set: { category_id: existing._id } });
            await CategorizationRule.updateMany({ ...orphan, category_id: legacy._id }, { $set: { category_id: existing._id } });
            await Correction.updateMany({ ...orphan, old_category_id: legacy._id }, { $set: { old_category_id: existing._id } });
            await Correction.updateMany({ ...orphan, new_category_id: legacy._id }, { $set: { new_category_id: existing._id } });
            await Category.deleteOne({ _id: legacy._id });
        } else {
            await Category.updateOne({ _id: legacy._id }, { $set: { user_id: userId } });
        }
    }

    // Rules: patterns are unique per user, so drop a legacy rule that clashes
    const legacyRules = await CategorizationRule.find(orphan).lean();
    for (const rule of legacyRules) {
        const clash = await CategorizationRule.exists({ user_id: userId, pattern: rule.pattern });
        if (clash) {
            await CategorizationRule.deleteOne({ _id: rule._id });
        } else {
            await CategorizationRule.updateOne({ _id: rule._id }, { $set: { user_id: userId } });
        }
    }

    const claimed = await Expense.updateMany(orphan, { $set: { user_id: userId } });
    await Correction.updateMany(orphan, { $set: { user_id: userId } });
    await LlmFallbackLog.updateMany(orphan, { $set: { user_id: userId } });

    if (legacyCategories.length > 0 || claimed.modifiedCount > 0) {
        console.log(`Assigned pre-account data to ${user.email}: ${claimed.modifiedCount} expense(s) and ${legacyCategories.length} category record(s).`);
        invalidateCategorizerCache(String(userId));
    }
}

/**
 * POST /api/auth/register  { email, password }
 */
router.post("/register", async (req: Request, res: Response) => {
    try {
        const creds = readCredentials(req.body);
        if ("error" in creds) {
            return res.status(400).json({ error: creds.error });
        }
        if (creds.password.length < MIN_PASSWORD) {
            return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD} characters` });
        }
        if (creds.password.length > MAX_PASSWORD) {
            return res.status(400).json({ error: `Password must be ${MAX_PASSWORD} characters or less` });
        }

        const existing = await User.exists({ email: creds.email });
        if (existing) {
            return res.status(409).json({ error: "An account with this email already exists" });
        }

        const password_hash = await bcrypt.hash(creds.password, BCRYPT_ROUNDS);
        const user = await User.create({ email: creds.email, password_hash });

        await claimLegacyData(user);
        await seedDefaultCategories(user._id as any);

        return res.status(201).json({ token: signToken(String(user._id)), user: publicUser(user) });
    } catch (error: any) {
        if (error.code === 11000) {
            return res.status(409).json({ error: "An account with this email already exists" });
        }
        console.error("Register error:", error.message || error);
        return res.status(500).json({ error: "Failed to create account" });
    }
});

/**
 * POST /api/auth/login  { email, password }
 */
router.post("/login", async (req: Request, res: Response) => {
    try {
        const creds = readCredentials(req.body);
        if ("error" in creds) {
            return res.status(400).json({ error: creds.error });
        }

        const user = await User.findOne({ email: creds.email });
        const ok = await bcrypt.compare(creds.password, user ? user.password_hash : DUMMY_HASH);
        if (!user || !ok) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        await claimLegacyData(user);

        return res.json({ token: signToken(String(user._id)), user: publicUser(user) });
    } catch (error: any) {
        console.error("Login error:", error.message || error);
        return res.status(500).json({ error: "Failed to log in" });
    }
});

/**
 * GET /api/auth/me — returns the signed-in user
 */
router.get("/me", requireAuth, async (req: Request, res: Response) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(401).json({ error: "Account no longer exists" });
        }
        return res.json({ user: publicUser(user) });
    } catch (error: any) {
        return res.status(500).json({ error: "Failed to load account" });
    }
});

export default router;
