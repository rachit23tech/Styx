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
