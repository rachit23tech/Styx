import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

declare global {
    namespace Express {
        interface Request {
            /** Id of the signed-in user, set by requireAuth */
            userId?: string;
        }
    }
}

const TOKEN_TTL = "7d";
let devSecret: string | null = null;

/**
 * Secret used to sign login tokens. JWT_SECRET must be set in production
 * (the server refuses to start without it). In development a random
 * per-process secret is used, so logins reset when the server restarts.
 */
export function getJwtSecret(): string {
    const fromEnv = process.env.JWT_SECRET;
    if (fromEnv) return fromEnv;
    if (process.env.NODE_ENV === "production") {
        throw new Error("JWT_SECRET is not set");
    }
    if (!devSecret) {
        devSecret = crypto.randomBytes(32).toString("hex");
        console.warn("JWT_SECRET is not set — using a temporary secret. Logins will reset when the server restarts.");
    }
    return devSecret;
}

export function signToken(userId: string): string {
    return jwt.sign({ sub: userId }, getJwtSecret(), { algorithm: "HS256", expiresIn: TOKEN_TTL });
}

/**
 * Middleware: requires a valid "Authorization: Bearer <token>" header and
 * sets req.userId. Responds 401 otherwise.
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) {
        return res.status(401).json({ error: "Authentication required" });
    }
    try {
        const payload = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
        const sub = typeof payload === "object" ? payload.sub : undefined;
        if (!sub || !mongoose.Types.ObjectId.isValid(sub)) {
            return res.status(401).json({ error: "Invalid session. Please log in again." });
        }
        req.userId = sub;
        return next();
    } catch {
        return res.status(401).json({ error: "Session expired. Please log in again." });
    }
};
