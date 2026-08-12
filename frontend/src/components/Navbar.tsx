import React from 'react';
import { PlusCircle, FolderPlus, Calendar } from 'lucide-react';

interface NavbarProps {
  currentMonth: string;
  onMonthChange: (month: string) => void;
  onOpenExpenseModal: () => void;
  onOpenCategoryModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentMonth,
  onMonthChange,
  onOpenExpenseModal,
  onOpenCategoryModal,
}) => {
  return (
    <nav className="navbar glass-card">
      <div className="brand">
        <div className="brand-logo">S</div>
        <div>
          <h1 className="brand-title">Styx Expense Tracker</h1>
        </div>
      </div>

      <div className="nav-actions">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={18} color="#94a3b8" />
          <input
            type="month"
            className="form-control"
            style={{ width: '160px', padding: '8px 12px' }}
            value={currentMonth}
            onChange={(e) => onMonthChange(e.target.value)}
          />
        </div>

        <button className="btn btn-secondary" onClick={onOpenCategoryModal}>
          <FolderPlus size={16} /> Categories
        </button>

        <button className="btn btn-primary" onClick={onOpenExpenseModal}>
          <PlusCircle size={16} /> Add Expense
        </button>
      </div>
    </nav>
  );
};
