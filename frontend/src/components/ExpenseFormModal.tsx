import React, { useState, useEffect } from 'react';
import { Category, Expense } from '../types';
import { X } from 'lucide-react';

interface ExpenseFormModalProps {
  isOpen: boolean;
  categories: Category[];
  initialData?: Expense | null;
  onClose: () => void;
  onSubmit: (data: {
    amount: number;
    description: string;
    date: string;
    category_id: string;
    payment_method: string;
  }) => Promise<void>;
}

export const ExpenseFormModal: React.FC<ExpenseFormModalProps> = ({
  isOpen,
  categories,
  initialData,
  onClose,
  onSubmit,
}) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState('auto');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setAmount(String(initialData.amount));
      setDescription(initialData.description);
      setDate(new Date(initialData.date).toISOString().split('T')[0]);
      const catId = typeof initialData.category_id === 'object' ? initialData.category_id._id : initialData.category_id;
      setCategoryId(catId);
      setPaymentMethod(initialData.payment_method || 'UPI');
    } else {
      setAmount('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
      setCategoryId('auto');
      setPaymentMethod('UPI');
    }
    setError('');
  }, [initialData, categories, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }
    if (!description.trim()) {
      setError('Description is required');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        amount: numAmount,
        description: description.trim(),
        date,
        category_id: categoryId,
        payment_method: paymentMethod,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">{initialData ? 'Edit Expense' : 'Add New Expense'}</h2>
          <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#f43f5e', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Amount (₹)</label>
            <input
              type="number"
              step="0.01"
              className="form-control"
              placeholder="e.g. 450.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description / Merchant</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Swiggy Order"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Category</label>
            <select
              className="form-control"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {!initialData && (
                <option value="auto">
                  Auto-Categorize (Rule / Gemini AI)
                </option>
              )}
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Date</label>
            <input
              type="date"
              className="form-control"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Payment Method</label>
            <select
              className="form-control"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="UPI">UPI</option>
              <option value="Credit Card">Credit Card</option>
              <option value="Debit Card">Debit Card</option>
              <option value="Net Banking">Net Banking</option>
              <option value="Cash">Cash</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (
                'Saving...'
              ) : initialData ? (
                'Update Expense'
              ) : (
                'Save Expense'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
