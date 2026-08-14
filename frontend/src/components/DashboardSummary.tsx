import React from 'react';
import { Expense, Category } from '../types';
import { Wallet, TrendingUp, PieChart } from 'lucide-react';

interface DashboardSummaryProps {
  expenses: Expense[];
  categories: Category[];
}

const CATEGORY_COLORS: Record<string, string> = {
  'Entertainment': '#1e3a8a',
  'Food & Dining': '#1e293b',
  'General': '#b45309',
  'Healthcare': '#0d9488',
  'Shopping': '#b8684d',
  'Transportation': '#6d28d9',
  'Utilities': '#94a3b8',
};

const DEFAULT_COLOR = '#64748b';

export const DashboardSummary: React.FC<DashboardSummaryProps> = ({ expenses, categories }) => {
  const totalSpend = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const totalTransactions = expenses.length;

  // Group spend by category
  const categoryTotals: Record<string, number> = {};
  categories.forEach((cat) => {
    categoryTotals[cat.name] = 0;
  });

  expenses.forEach((exp) => {
    const catName =
      typeof exp.category_id === 'object' && exp.category_id !== null
        ? exp.category_id.name
        : 'General';
    categoryTotals[catName] = (categoryTotals[catName] || 0) + exp.amount;
  });

  // Determine top category
  let topCategoryName = '-';
  let maxSpend = 0;
  Object.entries(categoryTotals).forEach(([catName, amt]) => {
    if (amt > maxSpend) {
      maxSpend = amt;
      topCategoryName = catName;
    }
  });

  // Calculate SVG Donut Slices
  const displayCategories = categories.length > 0 ? categories.map(c => c.name) : Object.keys(CATEGORY_COLORS);
  
  let accumulatedAngle = 0;
  const radius = 80;
  const strokeWidth = 36;
  const circumference = 2 * Math.PI * radius;

  const donutSlices = displayCategories.map((catName) => {
    const amt = categoryTotals[catName] || 0;
    const percentage = totalSpend > 0 ? (amt / totalSpend) : (1 / displayCategories.length);
    const strokeDasharray = `${percentage * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedAngle * circumference;
    accumulatedAngle += percentage;

    return {
      catName,
      amt,
      percentage: totalSpend > 0 ? (amt / totalSpend) * 100 : 0,
      color: CATEGORY_COLORS[catName] || DEFAULT_COLOR,
      strokeDasharray,
      strokeDashoffset,
    };
  });

  return (
    <div>
      {/* 3 KPI Summary Cards */}
      <div className="kpi-grid">
        {/* Card 1: TOTAL MONTHLY SPEND */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Total Monthly Spend</span>
            <div className="kpi-icon-wrapper kpi-icon-teal">
              <Wallet size={20} />
            </div>
          </div>
          <div className="kpi-value">₹{totalSpend.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          <div className="kpi-footer">
            <span>vs last month</span>
            <span>—</span>
          </div>
        </div>

        {/* Card 2: TOTAL TRANSACTIONS */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Total Transactions</span>
            <div className="kpi-icon-wrapper kpi-icon-blue">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="kpi-value">{totalTransactions}</div>
          <div className="kpi-footer">
            <span>vs last month</span>
            <span>—</span>
          </div>
        </div>

        {/* Card 3: TOP SPENDING CATEGORY */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Top Spending Category</span>
            <div className="kpi-icon-wrapper kpi-icon-amber">
              <PieChart size={20} />
            </div>
          </div>
          <div className="kpi-value">{topCategoryName}</div>
          <div className="kpi-footer">
            <span>vs last month</span>
            <span>—</span>
          </div>
        </div>
      </div>

      {/* Category Spending Breakdown Section */}
      <div className="card" style={{ padding: '28px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '24px', color: 'var(--text-primary)' }}>
          Category Spending Breakdown
        </h3>

        <div className="donut-grid">
          {/* Donut Chart */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
            <svg width="220" height="220" viewBox="0 0 220 220" style={{ transform: 'rotate(-90deg)' }}>
              {donutSlices.map((slice, i) => (
                <circle
                  key={i}
                  cx="110"
                  cy="110"
                  r={radius}
                  fill="transparent"
                  stroke={slice.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={slice.strokeDasharray}
                  strokeDashoffset={slice.strokeDashoffset}
                />
              ))}
            </svg>
            {/* Center Donut Text */}
            <div
              style={{
                position: 'absolute',
                textAlign: 'center',
                pointerEvents: 'none',
              }}
            >
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
                ₹{totalSpend.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                Total Spend
              </div>
            </div>
          </div>

          {/* Category Legend List */}
          <div className="legend-list">
            {displayCategories.map((catName) => {
              const amt = categoryTotals[catName] || 0;
              const pct = totalSpend > 0 ? (amt / totalSpend) * 100 : 0;
              const color = CATEGORY_COLORS[catName] || DEFAULT_COLOR;

              return (
                <div key={catName} className="legend-item">
                  <div className="legend-item-left">
                    <span className="legend-dot" style={{ backgroundColor: color }} />
                    <span>{catName}</span>
                  </div>
                  <div className="legend-item-right">
                    <span className="legend-amount">
                      ₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="legend-percent">{pct.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
