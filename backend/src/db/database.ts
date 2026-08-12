import mongoose from 'mongoose';
import { Category } from './models';

export const defaultCategories = [
    "Food & Dining",
    "Transportation",
    "Utilities",
    "Shopping",
    "Entertainment",
    "Healthcare",
    "General"
];

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/expense-tracker';
        await mongoose.connect(uri);
        await Category.createIndexes();
        console.log('Connected to MongoDB');

        // Seed default categories if collection is empty
        const count = await Category.countDocuments();
        if (count === 0) {
            console.log('Seeding default categories...');
            await Category.insertMany(defaultCategories.map(name => ({ name })));
            console.log('Default categories seeded!');
        }
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        process.exit(1);
    }
};

const closeDB = async () => {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
};

export { connectDB, closeDB };
