import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { connectDB } from "./db/database";
import categoryRouter from "./routes/categories";
import expenseRouter from "./routes/expenses";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Smart Expense Tracker API is running" });
});

app.use("/api/categories", categoryRouter);
app.use("/api/expenses", expenseRouter);

const startServer = async () => {
    await connectDB();
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
};

startServer();
