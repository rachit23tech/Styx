import React from 'react';
import { Expense } from '../types';
import { Trash2, Edit2 } from 'lucide-react';

interface ExpenseListProps {
  expenses: Expense[];
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
}

export const ExpenseList: React.FC<ExpenseListProps> = ({ expenses, onEdit, onDelete }) => {
  if (expenses.length === 0) {
    return (
      <div className="glass-card" style={{ textAlign: 'center', padding: '48px 24px', color: '#94a3b8' }}>
        <p style={{ fontSize: '16px', fontWeight: 500 }}>No expenses recorded for this month.</p>
        <p style={{ fontSize: '13px', marginTop: '4px' }}>Click "Add Expense" to record your first transaction.</p>
      </div>
    );
  }

  return (
    <div className="glass-card">
      <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Recent Transactions</h3>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Payment Method</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => {
              const categoryName =
                typeof expense.category_id === 'object' && expense.category_id !== null
                  ? expense.category_id.name
                  : 'General';

              const formattedDate = new Date(expense.date).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              });

              return (
                <tr key={expense._id}>
                  <td style={{ color: '#94a3b8', fontSize: '13px' }}>{formattedDate}</td>
                  <td style={{ fontWeight: 600 }}>{expense.description}</td>
                  <td>
                    <span className="badge">{categoryName}</span>
                  </td>
                  <td style={{ color: '#94a3b8' }}>{expense.payment_method || 'Cash'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#f8fafc' }}>
                    ₹{expense.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px' }}
                        onClick={() => onEdit(expense)}
                        title="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '6px 10px' }}
                        onClick={() => onDelete(expense._id)}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
