import React, { useState } from 'react';
import { Category } from '../types';
import { X, Trash2, Plus } from 'lucide-react';

interface CategoryManagerModalProps {
  isOpen: boolean;
  categories: Category[];
  onClose: () => void;
  onAddCategory: (name: string) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  categories,
  onClose,
  onAddCategory,
  onDeleteCategory,
}) => {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!newCategoryName.trim()) {
      setError('Category name cannot be empty');
      return;
    }

    try {
      setIsAdding(true);
      await onAddCategory(newCategoryName.trim());
      setNewCategoryName('');
    } catch (err: any) {
      setError(err.message || 'Failed to add category');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setError('');
      await onDeleteCategory(id);
    } catch (err: any) {
      setError(err.message || 'Failed to delete category');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">Manage Categories</h2>
          <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecdd3', color: '#f43f5e', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          <input
            type="text"
            className="form-control"
            placeholder="New Category Name"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
          />
          <button type="submit" className="btn btn-teal" style={{ whiteSpace: 'nowrap' }} disabled={isAdding}>
            <Plus size={16} /> Add
          </button>
        </form>

        <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>Existing Categories</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
          {categories.map((cat) => (
            <div
              key={cat._id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
              }}
            >
              <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '14px' }}>{cat.name}</span>
              <button
                className="btn btn-danger"
                style={{ padding: '4px 8px' }}
                onClick={() => handleDelete(cat._id)}
                title="Delete category"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
