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

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const IS_PROD = process.env.NODE_ENV === "production";

// ─── Security Headers ────────────────────────────────────────────────
app.use(helmet());

// ─── CORS — dynamic origin reflection for production & development ─
const corsOrigin = process.env.CORS_ORIGIN;
app.use(
    cors({
        origin: (origin, callback) => {
            if (!corsOrigin || !origin) {
                return callback(null, true);
            }
            const allowedOrigins = corsOrigin.split(",").map((o) => o.trim());
            if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            return callback(null, true);
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

const aiLimiter = rateLimit({
    windowMs: 60 * 1000,     // 1 minute
    max: IS_PROD ? 10 : 60,  // 10 AI calls/min in production
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "AI endpoint rate limit exceeded. Please wait before trying again." },
});

// ─── Health Check ────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", message: "Styx Expense Tracker API is running" });
});

// ─── Routes ──────────────────────────────────────────────────────────
app.use("/api/categories", categoryRouter);
app.use("/api/expenses", expenseRouter);
app.use("/api/stats", aiLimiter, advisorRouter);
app.use("/api", correctionsRouter);

// ─── Start Server ────────────────────────────────────────────────────
let server: ReturnType<typeof app.listen>;

const startServer = async () => {
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
