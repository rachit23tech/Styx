import React, { useState, useEffect } from 'react';
import { Category, Expense } from './types';
import {
  fetchCategories,
  fetchExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  createCategory,
  deleteCategory,
} from './api/client';
import { Navbar } from './components/Navbar';
import { DashboardSummary } from './components/DashboardSummary';
import { ExpenseList } from './components/ExpenseList';
import { ExpenseFormModal } from './components/ExpenseFormModal';
import { CategoryManagerModal } from './components/CategoryManagerModal';
import { CorrectionModal } from './components/CorrectionModal';
import { LlmLogViewer } from './components/LlmLogViewer';
import { SpendingAdvisorCard } from './components/SpendingAdvisorCard';
import { ReportsView } from './components/ReportsView';

export const App: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState<string>(
    new Date().toISOString().substring(0, 7)
  );
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isLlmLogsModalOpen, setIsLlmLogsModalOpen] = useState(false);
  const [correctingExpense, setCorrectingExpense] = useState<Expense | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [catsData, expsData] = await Promise.all([
        fetchCategories(),
        fetchExpenses(currentMonth),
      ]);
      setCategories(catsData);
      setExpenses(expsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load data from backend server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentMonth]);

  const toastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 6000);
  };

  // Cleanup toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const handleCreateOrUpdateExpense = async (data: {
    amount: number;
    description: string;
    date: string;
    category_id: string;
    payment_method: string;
  }) => {
    if (editingExpense) {
      await updateExpense(editingExpense._id, data);
      showToast('Expense updated successfully.');
    } else {
      const newExp = await createExpense(data);
      const catName = typeof newExp.category_id === 'object' ? newExp.category_id.name : 'Category';
      if (newExp.auto_categorized) {
        showToast(`Expense created & auto-categorized under '${catName}'!`);
      } else {
        showToast('Expense added successfully.');
      }
    }
    await loadData();
  };

  const handleDeleteExpense = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      await deleteExpense(id);
      showToast('Expense deleted.');
      await loadData();
    }
  };

  const handleAddCategory = async (name: string) => {
    await createCategory(name);
    showToast(`Category '${name}' created.`);
    await loadData();
  };

  const handleDeleteCategory = async (id: string) => {
    await deleteCategory(id);
    showToast('Category deleted.');
    await loadData();
  };

  const handleCorrectionSuccess = async (updatedExp: Expense, message?: string) => {
    if (message) {
      showToast(message);
    }
    await loadData();
  };

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <Navbar
        currentMonth={currentMonth}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onMonthChange={setCurrentMonth}
        onOpenExpenseModal={() => {
          setEditingExpense(null);
          setIsExpenseModalOpen(true);
        }}
        onOpenCategoryModal={() => setIsCategoryModalOpen(true)}
        onOpenLlmLogsModal={() => setIsLlmLogsModalOpen(true)}
      />

      {toastMessage && (
        <div
          style={{
            marginBottom: '20px',
            padding: '12px 16px',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#047857',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 600,
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.1)',
          }}
        >
          {toastMessage}
        </div>
      )}

      {error && (
        <div className="card" style={{ borderLeft: '4px solid #f43f5e', marginBottom: '24px', color: '#f43f5e' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text-muted)' }}>
          Loading Styx Dashboard...
        </div>
      ) : activeTab === 'transactions' ? (
        <ExpenseList
          expenses={expenses}
          onEdit={(exp) => {
            setEditingExpense(exp);
            setIsExpenseModalOpen(true);
          }}
          onDelete={handleDeleteExpense}
          onCorrectCategory={(exp) => setCorrectingExpense(exp)}
        />
      ) : activeTab === 'reports' ? (
        <ReportsView
          expenses={expenses}
          categories={categories}
          currentMonth={currentMonth}
        />
      ) : (
        <>
          <DashboardSummary expenses={expenses} categories={categories} />
          <SpendingAdvisorCard currentMonth={currentMonth} />
          <ExpenseList
            expenses={expenses}
            onEdit={(exp) => {
              setEditingExpense(exp);
              setIsExpenseModalOpen(true);
            }}
            onDelete={handleDeleteExpense}
            onCorrectCategory={(exp) => setCorrectingExpense(exp)}
          />
        </>
      )}

      {/* Modals */}
      <ExpenseFormModal
        isOpen={isExpenseModalOpen}
        categories={categories}
        initialData={editingExpense}
        onClose={() => {
          setIsExpenseModalOpen(false);
          setEditingExpense(null);
        }}
        onSubmit={handleCreateOrUpdateExpense}
      />

      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        categories={categories}
        onClose={() => setIsCategoryModalOpen(false)}
        onAddCategory={handleAddCategory}
        onDeleteCategory={handleDeleteCategory}
      />

      <CorrectionModal
        isOpen={!!correctingExpense}
        expense={correctingExpense}
        categories={categories}
        onClose={() => setCorrectingExpense(null)}
        onSuccess={handleCorrectionSuccess}
      />

      <LlmLogViewer
        isOpen={isLlmLogsModalOpen}
        onClose={() => setIsLlmLogsModalOpen(false)}
      />
    </div>
  );
};
