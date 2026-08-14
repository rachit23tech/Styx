import React from 'react';
import { Expense, Category } from '../types';
import { BarChart3, CreditCard, PieChart, ArrowUpRight, DollarSign, Layers } from 'lucide-react';

interface ReportsViewProps {
  expenses: Expense[];
  categories: Category[];
  currentMonth: string;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ expenses, categories, currentMonth }) => {
  const [yearStr, monthStr] = currentMonth.split('-');
  const dateObj = new Date(Number(yearStr), Number(monthStr) - 1, 1);
  const monthName = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const totalSpend = expenses.reduce((acc, e) => acc + e.amount, 0);
  const totalCount = expenses.length;
  const avgExpense = totalCount > 0 ? totalSpend / totalCount : 0;

  // Find largest single expense
  let maxExpense: Expense | null = null;
  expenses.forEach((e) => {
    if (!maxExpense || e.amount > maxExpense.amount) {
      maxExpense = e;
    }
  });

  // Group spend by category
  const catTotals: Record<string, { amount: number; count: number }> = {};
  categories.forEach((c) => {
    catTotals[c.name] = { amount: 0, count: 0 };
  });

  expenses.forEach((e) => {
    const catName =
      typeof e.category_id === 'object' && e.category_id !== null
        ? e.category_id.name
        : 'General';
    if (!catTotals[catName]) {
      catTotals[catName] = { amount: 0, count: 0 };
    }
    catTotals[catName].amount += e.amount;
    catTotals[catName].count += 1;
  });

  // Group spend by payment method
  const paymentTotals: Record<string, { amount: number; count: number }> = {};
  expenses.forEach((e) => {
    const pm = e.payment_method || 'Cash';
    if (!paymentTotals[pm]) {
      paymentTotals[pm] = { amount: 0, count: 0 };
    }
    paymentTotals[pm].amount += e.amount;
    paymentTotals[pm].count += 1;
  });

  // Most used payment method
  let mostUsedPM = 'N/A';
  let maxPMCount = 0;
  Object.entries(paymentTotals).forEach(([pm, val]) => {
    if (val.count > maxPMCount) {
      maxPMCount = val.count;
      mostUsedPM = pm;
    }
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Report Banner */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={20} color="var(--primary-teal)" />
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Financial Report — {monthName}
              </h2>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Detailed breakdown of expenditure, payment methods, and category allocations.
            </div>
          </div>

          <button
            className="btn btn-outline-white"
            onClick={() => window.print()}
            style={{ fontSize: '12px' }}
          >
            Export / Print Report
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Total Spending
            </span>
            <div className="kpi-icon-wrapper kpi-icon-teal" style={{ width: '32px', height: '32px' }}>
              <DollarSign size={16} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
            ₹{totalSpend.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Across {totalCount} transaction{totalCount === 1 ? '' : 's'}
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Average per Transaction
            </span>
            <div className="kpi-icon-wrapper kpi-icon-blue" style={{ width: '32px', height: '32px' }}>
              <Layers size={16} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
            ₹{avgExpense.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Average order size
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Most Used Payment Method
            </span>
            <div className="kpi-icon-wrapper kpi-icon-amber" style={{ width: '32px', height: '32px' }}>
              <CreditCard size={16} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#b45309' }}>
            {mostUsedPM}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {maxPMCount} transaction{maxPMCount === 1 ? '' : 's'}
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Largest Single Expense
            </span>
            <div className="kpi-icon-wrapper" style={{ width: '32px', height: '32px', background: '#fee2e2', color: '#dc2626' }}>
              <ArrowUpRight size={16} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#dc2626' }}>
            {maxExpense ? `₹${(maxExpense as Expense).amount.toLocaleString('en-IN')}` : 'N/A'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {maxExpense ? (maxExpense as Expense).description : 'No expenses recorded'}
          </div>
        </div>
      </div>

      {/* Category Analysis Table & Payment Method Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Category Report */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PieChart size={18} color="var(--primary-teal)" /> Category Allocation Report
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {Object.entries(catTotals).map(([catName, val]) => {
              const pct = totalSpend > 0 ? (val.amount / totalSpend) * 100 : 0;
              return (
                <div key={catName}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                    <span>{catName}</span>
                    <span>₹{val.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({pct.toFixed(1)}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: 'var(--primary-teal)',
                        borderRadius: '4px',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {val.count} transaction{val.count === 1 ? '' : 's'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment Method Breakdown */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard size={18} color="#0284c7" /> Payment Channel Distribution
          </h3>
          {Object.keys(paymentTotals).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '13px' }}>
              No transactions recorded for this period.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {Object.entries(paymentTotals).map(([pm, val]) => {
                const pct = totalSpend > 0 ? (val.amount / totalSpend) * 100 : 0;
                return (
                  <div key={pm} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>{pm}</span>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>
                        ₹{val.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                      <span>{val.count} transaction{val.count === 1 ? '' : 's'}</span>
                      <span>{pct.toFixed(1)}% of monthly total</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
