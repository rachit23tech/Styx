import React, { useState } from 'react';
import { Category, Expense, CorrectionResponse } from '../types';
import { X, Sparkles } from 'lucide-react';
import { correctExpense } from '../api/client';

interface CorrectionModalProps {
  isOpen: boolean;
  expense: Expense | null;
  categories: Category[];
  onClose: () => void;
  onSuccess: (updatedExpense: Expense, message?: string) => void;
}

export const CorrectionModal: React.FC<CorrectionModalProps> = ({
  isOpen,
  expense,
  categories,
  onClose,
  onSuccess,
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [promotionNotice, setPromotionNotice] = useState<string | null>(null);

  if (!isOpen || !expense) return null;

  const currentCatId = typeof expense.category_id === 'object' ? expense.category_id._id : expense.category_id;
  const currentCatName = typeof expense.category_id === 'object' ? expense.category_id.name : 'Unknown';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPromotionNotice(null);

    const targetCatId = selectedCategoryId || currentCatId;
    if (!targetCatId || targetCatId === currentCatId) {
      setError('Please select a different category to submit a correction');
      return;
    }

    try {
      setIsSubmitting(true);
      const res: CorrectionResponse = await correctExpense(expense._id, targetCatId);
      
      let msg = `Corrected category to ${typeof res.expense.category_id === 'object' ? res.expense.category_id.name : ''}.`;
      if (res.promotedRule) {
        msg = `Pattern '${res.merchantPattern}' automatically promoted to a permanent rule after ${res.correctionCount} corrections!`;
      } else {
        msg += ` (${res.correctionCount}/3 corrections towards rule promotion)`;
      }

      onSuccess(res.expense, msg);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to correct category');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">Correct Expense Category</h2>
          <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={{ marginBottom: '16px', padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontWeight: 600, fontSize: '15px', color: '#0f172a' }}>{expense.description}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            Amount: ₹{expense.amount.toFixed(2)} | Current Category: <span style={{ color: '#f43f5e', fontWeight: 600 }}>{currentCatName}</span>
          </div>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecdd3', color: '#f43f5e', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        {promotionNotice && (
          <div style={{ padding: '10px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} />
            {promotionNotice}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Select Correct Category</label>
            <select
              className="form-control"
              value={selectedCategoryId || currentCatId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              required
            >
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.name} {cat._id === currentCatId ? '(Current)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.5' }}>
            <strong>Feedback Loop:</strong> Correcting an expense helps train the system. When a pattern is corrected 3 times to the same category, it is automatically promoted to a permanent rule.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-teal" disabled={isSubmitting}>
              {isSubmitting ? 'Saving Correction...' : 'Submit Correction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
