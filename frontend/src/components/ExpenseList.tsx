import React, { useState } from 'react';
import { Expense } from '../types';
import { Trash2, Edit2, CheckCircle2 } from 'lucide-react';

interface ExpenseListProps {
  expenses: Expense[];
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
  onCorrectCategory: (expense: Expense) => void;
}

export const ExpenseList: React.FC<ExpenseListProps> = ({
  expenses,
  onEdit,
  onDelete,
  onCorrectCategory,
}) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };
  if (expenses.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
        <p style={{ fontSize: '15px', fontWeight: 600 }}>No expenses recorded for this month.</p>
        <p style={{ fontSize: '13px', marginTop: '4px' }}>Click "+ Add Expense" to record your first transaction.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Recent Transactions</h3>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Showing {expenses.length} transaction{expenses.length === 1 ? '' : 's'}
        </div>
      </div>
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
                  <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{formattedDate}</td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {expense.description}
                      {expense.auto_categorized && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            background: '#e0f2fe',
                            border: '1px solid #bae6fd',
                            color: '#0284c7',
                            fontSize: '10px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: 600,
                          }}
                          title="Auto-categorized by Rule/LLM engine"
                        >
                          Auto
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="badge">{categoryName}</span>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{expense.payment_method || 'Cash'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                    ₹{expense.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '5px 8px', color: '#0f766e' }}
                        onClick={() => onCorrectCategory(expense)}
                        title="Correct Category (Feedback Loop)"
                      >
                        <CheckCircle2 size={14} />
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '5px 8px' }}
                        onClick={() => onEdit(expense)}
                        title="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '5px 8px' }}
                        onClick={() => handleDelete(expense._id)}
                        disabled={deletingId === expense._id}
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
