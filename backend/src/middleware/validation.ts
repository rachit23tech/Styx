import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

/**
 * Middleware: validates that req.params.id is a valid MongoDB ObjectId.
 * Returns 400 if invalid, preventing Mongoose CastError / NoSQL injection.
 */
export const validateObjectId = (paramName = "id") => {
    return (req: Request, res: Response, next: NextFunction) => {
        const value = req.params[paramName];
        if (!value || !mongoose.Types.ObjectId.isValid(value)) {
            return res.status(400).json({ error: `Invalid ${paramName} format` });
        }
        next();
    };
};

/**
 * Sanitizes a value to prevent NoSQL query injection.
 * Strips any keys starting with '$' from objects.
 */
export function sanitize<T>(value: T): T {
    if (value === null || value === undefined) return value;
    if (typeof value === "object" && !Array.isArray(value)) {
        const clean: any = {};
        for (const key of Object.keys(value as any)) {
            if (key.startsWith("$")) continue; // strip query operators
            clean[key] = sanitize((value as any)[key]);
        }
        return clean as T;
    }
    if (Array.isArray(value)) {
        return value.map(sanitize) as unknown as T;
    }
    return value;
}

/**
 * Parses a "YYYY-MM" string. Returns null unless it is a real month.
 */
export function parseMonth(value: unknown): { year: number; month: number } | null {
    if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) return null;
    const [year, month] = value.split("-").map(Number);
    if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
    return { year, month };
}

/**
 * Parses a client-supplied date (ISO string or timestamp).
 * Returns null if it is not a valid date.
 */
export function parseDate(value: unknown): Date | null {
    if (typeof value !== "string" && typeof value !== "number") return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
}
