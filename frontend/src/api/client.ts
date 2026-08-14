import { CategorizationRule, Category, CorrectionResponse, Expense, LlmFallbackLog, StatsSummary, AdvisorExplanation } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${API_BASE}/categories`);
  if (!res.ok) throw new Error('Failed to fetch categories');
  return res.json();
}

export async function createCategory(name: string): Promise<Category> {
  const res = await fetch(`${API_BASE}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to create category');
  }
  return res.json();
}

export async function deleteCategory(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/categories/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete category');
}

export async function fetchExpenses(month?: string): Promise<Expense[]> {
  const url = month ? `${API_BASE}/expenses?month=${month}&limit=200` : `${API_BASE}/expenses?limit=200`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch expenses');
  const json = await res.json();
  // Handle both paginated { data: [...] } and legacy array responses
  return Array.isArray(json) ? json : (json.data || []);
}

export async function createExpense(data: {
  amount: number;
  description: string;
  date: string;
  category_id?: string;
  payment_method: string;
  auto_categorized?: boolean;
}): Promise<Expense> {
  const res = await fetch(`${API_BASE}/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to create expense');
  }
  return res.json();
}

export async function updateExpense(
  id: string,
  data: Partial<Expense> & { category_id?: string }
): Promise<Expense> {
  const res = await fetch(`${API_BASE}/expenses/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update expense');
  return res.json();
}

export async function deleteExpense(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/expenses/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete expense');
}

export async function correctExpense(expenseId: string, newCategoryId: string): Promise<CorrectionResponse> {
  const res = await fetch(`${API_BASE}/expenses/${expenseId}/correct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_category_id: newCategoryId }),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to submit category correction');
  }
  return res.json();
}

export async function fetchLlmLogs(): Promise<LlmFallbackLog[]> {
  const res = await fetch(`${API_BASE}/llm-logs`);
  if (!res.ok) throw new Error('Failed to fetch LLM fallback logs');
  return res.json();
}

export async function fetchRules(): Promise<CategorizationRule[]> {
  const res = await fetch(`${API_BASE}/rules`);
  if (!res.ok) throw new Error('Failed to fetch categorization rules');
  return res.json();
}

export async function fetchStatsSummary(month?: string): Promise<StatsSummary> {
  const url = month ? `${API_BASE}/stats/summary?month=${month}` : `${API_BASE}/stats/summary`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch stats summary');
  return res.json();
}

export async function fetchAdvisorExplanation(month?: string, statsSummary?: StatsSummary): Promise<{ statsSummary: StatsSummary; advisorExplanation: AdvisorExplanation }> {
  const res = await fetch(`${API_BASE}/stats/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ month, statsSummary }),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to fetch spending advice');
  }
  return res.json();
}
