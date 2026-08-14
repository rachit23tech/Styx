import React from 'react';
import {
  Calendar as CalendarIcon,
  Activity,
  FolderPlus,
  Plus,
  LayoutDashboard,
  Receipt,
  BarChart3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface NavbarProps {
  currentMonth: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onMonthChange: (month: string) => void;
  onOpenExpenseModal: () => void;
  onOpenCategoryModal: () => void;
  onOpenLlmLogsModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentMonth,
  activeTab,
  onTabChange,
  onMonthChange,
  onOpenExpenseModal,
  onOpenCategoryModal,
  onOpenLlmLogsModal,
}) => {
  const [yearStr, monthStr] = currentMonth.split('-');
  const dateObj = new Date(Number(yearStr), Number(monthStr) - 1, 1);
  const formattedMonthLabel = dateObj.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const handlePrevMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    onMonthChange(prevStr);
  };

  const handleNextMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    const nextStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    onMonthChange(nextStr);
  };

  return (
    <header className="navbar-container">
      <div className="navbar-top">
        {/* Brand Logo & Name */}
        <div className="navbar-brand">
          <div className="navbar-logo">S</div>
          <div>
            <div className="navbar-brand-title">Styx</div>
            <div className="navbar-brand-sub">Expense Tracker</div>
          </div>
        </div>

        {/* Core Navigation Views (No Duplicates) */}
        <nav className="navbar-nav">
          <button
            className={`navbar-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => onTabChange('overview')}
          >
            <LayoutDashboard size={16} /> Overview
          </button>
          <button
            className={`navbar-nav-item ${activeTab === 'transactions' ? 'active' : ''}`}
            onClick={() => onTabChange('transactions')}
          >
            <Receipt size={16} /> Transactions
          </button>
          <button
            className={`navbar-nav-item ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => onTabChange('reports')}
          >
            <BarChart3 size={16} /> Reports
          </button>
        </nav>

        {/* Right Action Controls */}
        <div className="navbar-right-actions">
          {/* Interactive Month Calendar Picker with Prev/Next Navigation */}
          <div className="calendar-month-picker">
            <button
              className="calendar-nav-btn"
              onClick={handlePrevMonth}
              title="Previous Month"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="date-selector-btn" title="Click to select month">
              <CalendarIcon size={15} color="var(--primary-teal)" />
              <span>{formattedMonthLabel}</span>
              <input
                type="month"
                value={currentMonth}
                onChange={(e) => onMonthChange(e.target.value)}
                className="month-input-overlay"
              />
            </div>

            <button
              className="calendar-nav-btn"
              onClick={handleNextMonth}
              title="Next Month"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Action Modals */}
          <button className="btn btn-outline-white" onClick={onOpenLlmLogsModal} title="AI Fallback Logs & Rule Audit">
            <Activity size={15} /> AI Observability
          </button>

          <button className="btn btn-outline-white" onClick={onOpenCategoryModal} title="Manage Categories">
            <FolderPlus size={15} /> Categories
          </button>

          <button className="btn btn-teal" onClick={onOpenExpenseModal} title="Add New Expense">
            <Plus size={16} /> Add Expense
          </button>
        </div>
      </div>
    </header>
  );
};
