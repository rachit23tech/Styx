import { Category, Expense } from "../db/models";
import mongoose from "mongoose";

export interface CategoryStat {
    categoryId: string;
    categoryName: string;
    currentMonthSpend: number;
    trailing3MonthAvg: number;
    previousMonthSpend: number;
    momPercentageChange: number;
}

export interface StatsSummary {
    period: string; // e.g. "2026-08"
    totalCurrentMonthSpend: number;
    totalPreviousMonthSpend: number;
    totalMomPercentageChange: number;
    topCategory: { name: string; amount: number } | null;
    categories: CategoryStat[];
}

export async function computeStatsSummary(year: number, month: number): Promise<StatsSummary> {
    const periodStr = `${year}-${String(month).padStart(2, "0")}`;

    // Date ranges
    const currentMonthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const currentMonthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const prevMonthStart = new Date(Date.UTC(year, month - 2, 1, 0, 0, 0, 0));
    const prevMonthEnd = new Date(Date.UTC(year, month - 1, 0, 23, 59, 59, 999));

    const trailing3Start = new Date(Date.UTC(year, month - 4, 1, 0, 0, 0, 0));
    const trailing3End = new Date(Date.UTC(year, month - 1, 0, 23, 59, 59, 999));

    // Fetch all active categories
    const allCategories = await Category.find();
    const catMap = new Map<string, string>();
    allCategories.forEach(c => catMap.set(c._id.toString(), c.name));

    // 1. Current Month Aggregation
    const currentAgg = await Expense.aggregate([
        {
            $match: {
                date: { $gte: currentMonthStart, $lte: currentMonthEnd }
            }
        },
        {
            $group: {
                _id: "$category_id",
                totalAmount: { $sum: "$amount" }
            }
        }
    ]);

    const currentMap = new Map<string, number>();
    let totalCurrentSpend = 0;
    currentAgg.forEach(item => {
        const catIdStr = item._id.toString();
        const amt = item.totalAmount || 0;
        currentMap.set(catIdStr, amt);
        totalCurrentSpend += amt;
    });

    // 2. Previous Month Aggregation
    const prevAgg = await Expense.aggregate([
        {
            $match: {
                date: { $gte: prevMonthStart, $lte: prevMonthEnd }
            }
        },
        {
            $group: {
                _id: "$category_id",
                totalAmount: { $sum: "$amount" }
            }
        }
    ]);

    const prevMap = new Map<string, number>();
    let totalPrevSpend = 0;
    prevAgg.forEach(item => {
        const catIdStr = item._id.toString();
        const amt = item.totalAmount || 0;
        prevMap.set(catIdStr, amt);
        totalPrevSpend += amt;
    });

    // 3. Trailing 3-Month Aggregation
    const trailingAgg = await Expense.aggregate([
        {
            $match: {
                date: { $gte: trailing3Start, $lte: trailing3End }
            }
        },
        {
            $group: {
                _id: "$category_id",
                totalAmount: { $sum: "$amount" }
            }
        }
    ]);

    const trailingMap = new Map<string, number>();
    trailingAgg.forEach(item => {
        const catIdStr = item._id.toString();
        const amt = item.totalAmount || 0;
        trailingMap.set(catIdStr, amt / 3); // Average per month over 3 months
    });

    // Build per-category stats
    const categoryStats: CategoryStat[] = [];
    let topCategoryObj: { name: string; amount: number } | null = null;
    let maxSpend = 0;

    // Process categories that have current or previous spend
    const activeCategoryIds = new Set([
        ...Array.from(currentMap.keys()),
        ...Array.from(prevMap.keys()),
        ...Array.from(trailingMap.keys())
    ]);

    activeCategoryIds.forEach(catIdStr => {
        const catName = catMap.get(catIdStr) || "Uncategorized";
        const curr = currentMap.get(catIdStr) || 0;
        const prev = prevMap.get(catIdStr) || 0;
        const trailing = trailingMap.get(catIdStr) || 0;

        let momChange = 0;
        if (prev > 0) {
            momChange = Number((((curr - prev) / prev) * 100).toFixed(1));
        } else if (curr > 0) {
            momChange = 100;
        }

        if (curr > maxSpend) {
            maxSpend = curr;
            topCategoryObj = { name: catName, amount: curr };
        }

        categoryStats.push({
            categoryId: catIdStr,
            categoryName: catName,
            currentMonthSpend: Number(curr.toFixed(2)),
            trailing3MonthAvg: Number(trailing.toFixed(2)),
            previousMonthSpend: Number(prev.toFixed(2)),
            momPercentageChange: momChange
        });
    });

    // Sort by current month spend descending
    categoryStats.sort((a, b) => b.currentMonthSpend - a.currentMonthSpend);

    let totalMomChange = 0;
    if (totalPrevSpend > 0) {
        totalMomChange = Number((((totalCurrentSpend - totalPrevSpend) / totalPrevSpend) * 100).toFixed(1));
    } else if (totalCurrentSpend > 0) {
        totalMomChange = 100;
    }

    return {
        period: periodStr,
        totalCurrentMonthSpend: Number(totalCurrentSpend.toFixed(2)),
        totalPreviousMonthSpend: Number(totalPrevSpend.toFixed(2)),
        totalMomPercentageChange: totalMomChange,
        topCategory: topCategoryObj,
        categories: categoryStats
    };
}
