import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { connectDB, closeDB } from "./db/database";
import categoryRouter from "./routes/categories";
import expenseRouter from "./routes/expenses";
import correctionsRouter from "./routes/corrections";
import advisorRouter from "./routes/advisor";
import authRouter from "./routes/auth";
import { requireAuth } from "./middleware/auth";

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const IS_PROD = process.env.NODE_ENV === "production";

// ─── Trust the first proxy hop (Render / Railway / Heroku) ───────────
// Needed so req.ip is the real client IP and rate limiting is per-client.
app.set("trust proxy", 1);

// ─── Security Headers ────────────────────────────────────────────────
app.use(helmet());

// ─── CORS — allow-list from CORS_ORIGIN (comma-separated); open if unset ─
const normalizeOrigin = (o: string) => o.trim().replace(/\/+$/, "").toLowerCase();
const allowedOrigins = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);
app.use(
    cors({
        origin: (origin, callback) => {
            // No CORS_ORIGIN configured, or a non-browser request (curl, health checks): allow
            if (allowedOrigins.length === 0 || !origin) {
                return callback(null, true);
            }
            if (allowedOrigins.includes("*") || allowedOrigins.includes(normalizeOrigin(origin))) {
                return callback(null, true);
            }
            console.warn(`CORS: blocked request from origin ${origin}`);
            return callback(null, false);
        },
        credentials: true
    })
);

// ─── Body Parsing — capped at 16KB to prevent memory exhaustion ──────
app.use(express.json({ limit: "16kb" }));

// ─── Compression ─────────────────────────────────────────────────────
app.use(compression());

// ─── HTTP Request Logging ────────────────────────────────────────────
app.use(morgan(IS_PROD ? "combined" : "dev"));

// ─── Rate Limiting — global + stricter for AI endpoints ──────────────
const globalLimiter = rateLimit({
    windowMs: 60 * 1000,      // 1 minute
    max: IS_PROD ? 100 : 500, // stricter in production
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later" },
});
app.use(globalLimiter);

// Gemini-backed endpoints: creating an expense (auto-categorisation) and the advisor
const aiLimiter = rateLimit({
    windowMs: 60 * 1000,     // 1 minute
    max: IS_PROD ? 20 : 120, // 20 AI-backed calls/min in production
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "AI endpoint rate limit exceeded. Please wait before trying again." },
});

// Login / sign-up: slows down password guessing
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: IS_PROD ? 30 : 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many login attempts. Please try again later." },
});

// ─── Health Check ────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", message: "Styx Expense Tracker API is running" });
});

// ─── Routes ──────────────────────────────────────────────────────────
app.use("/api/auth", authLimiter, authRouter);

// Stricter limit on the two endpoints that can call Gemini
app.post("/api/expenses", aiLimiter);
app.post("/api/stats/explain", aiLimiter);

// Everything below requires a signed-in user
app.use("/api/categories", requireAuth, categoryRouter);
app.use("/api/expenses", requireAuth, expenseRouter);
app.use("/api/stats", requireAuth, advisorRouter);
app.use("/api", requireAuth, correctionsRouter);

// ─── Start Server ────────────────────────────────────────────────────
let server: ReturnType<typeof app.listen>;

const startServer = async () => {
    // Login tokens are signed with JWT_SECRET; never run production without one
    if (IS_PROD && !process.env.JWT_SECRET) {
        console.error("FATAL: JWT_SECRET is not set. Set it to a long random string in the environment and redeploy.");
        process.exit(1);
    }

    try {
        await connectDB();

        server = app.listen(PORT, () => {
            console.log(`Server running on port ${PORT} [${IS_PROD ? "production" : "development"}]`);
        });

        server.on("error", (err: any) => {
            if (err.code === "EADDRINUSE") {
                if (IS_PROD) {
                    console.error(`FATAL: Port ${PORT} is already in use. Exiting.`);
                    process.exit(1);
                } else {
                    // Dev-only port fallback
                    const fallback = PORT + 1;
                    console.warn(`Port ${PORT} busy, trying ${fallback}...`);
                    server = app.listen(fallback, () => {
                        console.log(`Server running on fallback port ${fallback}`);
                    });
                }
            } else {
                console.error("Server error:", err);
                process.exit(1);
            }
        });
    } catch (err: any) {
        console.error("Failed to start server:", err);
        process.exit(1);
    }
};

// ─── Graceful Shutdown ───────────────────────────────────────────────
const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    if (server) {
        server.close(async () => {
            console.log("HTTP server closed.");
            await closeDB();
            process.exit(0);
        });
        // Force exit after 10s if graceful shutdown hangs
        setTimeout(() => {
            console.error("Forcefully shutting down after timeout.");
            process.exit(1);
        }, 10_000);
    } else {
        await closeDB();
        process.exit(0);
    }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

startServer();
