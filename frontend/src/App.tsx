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

export const App: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState<string>(
    new Date().toISOString().substring(0, 7)
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
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

  const handleCreateOrUpdateExpense = async (data: {
    amount: number;
    description: string;
    date: string;
    category_id: string;
    payment_method: string;
  }) => {
    if (editingExpense) {
      await updateExpense(editingExpense._id, data);
    } else {
      await createExpense(data);
    }
    await loadData();
  };

  const handleDeleteExpense = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      await deleteExpense(id);
      await loadData();
    }
  };

  const handleAddCategory = async (name: string) => {
    await createCategory(name);
    await loadData();
  };

  const handleDeleteCategory = async (id: string) => {
    await deleteCategory(id);
    await loadData();
  };

  return (
    <div className="app-container">
      <Navbar
        currentMonth={currentMonth}
        onMonthChange={setCurrentMonth}
        onOpenExpenseModal={() => {
          setEditingExpense(null);
          setIsExpenseModalOpen(true);
        }}
        onOpenCategoryModal={() => setIsCategoryModalOpen(true)}
      />

      {error && (
        <div className="glass-card" style={{ borderLeft: '4px solid #f43f5e', marginBottom: '24px', color: '#f43f5e' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '64px', color: '#94a3b8' }}>
          Loading Styx Dashboard...
        </div>
      ) : (
        <>
          <DashboardSummary expenses={expenses} categories={categories} />
          <ExpenseList
            expenses={expenses}
            onEdit={(exp) => {
              setEditingExpense(exp);
              setIsExpenseModalOpen(true);
            }}
            onDelete={handleDeleteExpense}
          />
        </>
      )}

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
    </div>
  );
};
