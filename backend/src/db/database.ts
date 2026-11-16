import mongoose, { Types } from 'mongoose';
import { CategorizationRule, Category, Correction, Expense, LlmFallbackLog, User } from './models';

export const defaultCategories = [
    "Food & Dining",
    "Transportation",
    "Utilities",
    "Shopping",
    "Entertainment",
    "Healthcare",
    "General"
];

/**
 * Gives a user the default categories they don't already have.
 * Safe to call more than once.
 */
export const seedDefaultCategories = async (userId: Types.ObjectId | string) => {
    const existing = await Category.find({ user_id: userId }).select("name").lean();
    const have = new Set(existing.map(c => c.name.toLowerCase()));
    const missing = defaultCategories.filter(name => !have.has(name.toLowerCase()));
    if (missing.length > 0) {
        await Category.insertMany(missing.map(name => ({ name, user_id: userId })));
    }
};

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/expense-tracker';
        await mongoose.connect(uri);
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        process.exit(1);
    }

    // Bring indexes in line with the schemas. This also drops the old global
    // unique indexes (category name, rule pattern) that predate user accounts
    // and would stop two users from having a category with the same name.
    try {
        await Promise.all([
            User.syncIndexes(),
            Category.syncIndexes(),
            CategorizationRule.syncIndexes(),
            Expense.syncIndexes(),
            Correction.syncIndexes(),
            LlmFallbackLog.syncIndexes()
        ]);
    } catch (error) {
        console.error('Warning: failed to sync MongoDB indexes:', error);
    }
};

const closeDB = async () => {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
};

export { connectDB, closeDB };
