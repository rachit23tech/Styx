import React from 'react';
import { Expense, Category } from '../types';

interface DashboardSummaryProps {
  expenses: Expense[];
  categories: Category[];
}

export const DashboardSummary: React.FC<DashboardSummaryProps> = ({ expenses, categories }) => {
  const totalSpend = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  // Group total spend per category
  const categoryTotals: { [categoryId: string]: number } = {};
  expenses.forEach((exp) => {
    const catId = typeof exp.category_id === 'object' ? exp.category_id._id : exp.category_id;
    categoryTotals[catId] = (categoryTotals[catId] || 0) + exp.amount;
  });

  // Find top category
  let topCategoryName = 'N/A';
  let topCategorySpend = 0;
  categories.forEach((cat) => {
    const spend = categoryTotals[cat._id] || 0;
    if (spend > topCategorySpend) {
      topCategorySpend = spend;
      topCategoryName = cat.name;
    }
  });

  return (
    <div style={{ marginBottom: '32px' }}>
      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-label">Total Monthly Spend</div>
          <div className="stat-value" style={{ color: '#6366f1' }}>
            ₹{totalSpend.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Transactions</div>
          <div className="stat-value">{expenses.length}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Top Spending Category</div>
          <div className="stat-value" style={{ fontSize: '22px' }}>
            {topCategoryName}
          </div>
          {topCategorySpend > 0 && (
            <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
              ₹{topCategorySpend.toLocaleString('en-IN')} (
              {((topCategorySpend / (totalSpend || 1)) * 100).toFixed(1)}%)
            </div>
          )}
        </div>
      </div>

      {/* Per Category Breakdown Progress Bars */}
      <div className="glass-card">
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
          Category Spending Breakdown
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {categories.map((cat) => {
            const spend = categoryTotals[cat._id] || 0;
            const percentage = totalSpend > 0 ? (spend / totalSpend) * 100 : 0;
            return (
              <div key={cat._id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '4px' }}>
                  <span>{cat.name}</span>
                  <span style={{ fontWeight: 600 }}>₹{spend.toLocaleString('en-IN')} ({percentage.toFixed(1)}%)</span>
                </div>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill" style={{ width: `${Math.min(percentage, 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
