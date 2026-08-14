import { CategorizationRule, Category, CorrectionResponse, Expense, LlmFallbackLog, StatsSummary, AdvisorExplanation } from '../types';

// Normalize API_BASE: auto-prepend https:// if missing, and ensure it ends with /api
let rawBase = (import.meta.env.VITE_API_BASE_URL || '/api').trim();
if (rawBase && !rawBase.startsWith('/') && !rawBase.startsWith('http://') && !rawBase.startsWith('https://')) {
  rawBase = `https://${rawBase}`;
}
const cleanBase = rawBase.replace(/\/$/, '');
const API_BASE = cleanBase.endsWith('/api') ? cleanBase : `${cleanBase}/api`;

async function safeFetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      if (text.trim().startsWith('<')) {
        throw new Error(`Backend returned HTML page (404/500). Please verify VITE_API_BASE_URL is set to your live backend endpoint (e.g. https://your-backend.onrender.com/api).`);
      }
      throw new Error(text || `Server returned non-JSON response (HTTP ${res.status})`);
    }

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || `HTTP ${res.status} error occurred.`);
    }
    return json;
  } catch (err: any) {
    if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
      throw new Error(
        `Failed to connect to backend server. If using Render free tier, the server may be waking up from sleep (~30s), or VITE_API_BASE_URL is invalid (${API_BASE}).`
      );
    }
    throw err;
  }
}

export async function fetchCategories(): Promise<Category[]> {
  return safeFetchJson<Category[]>(`${API_BASE}/categories`);
}

export async function createCategory(name: string): Promise<Category> {
  return safeFetchJson<Category>(`${API_BASE}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export async function deleteCategory(id: string): Promise<void> {
  await safeFetchJson<any>(`${API_BASE}/categories/${id}`, { method: 'DELETE' });
}

export async function fetchExpenses(month?: string): Promise<Expense[]> {
  const url = month ? `${API_BASE}/expenses?month=${month}&limit=200` : `${API_BASE}/expenses?limit=200`;
  const json = await safeFetchJson<any>(url);
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
  return safeFetchJson<Expense>(`${API_BASE}/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function updateExpense(
  id: string,
  data: Partial<Expense> & { category_id?: string }
): Promise<Expense> {
  return safeFetchJson<Expense>(`${API_BASE}/expenses/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteExpense(id: string): Promise<void> {
  await safeFetchJson<any>(`${API_BASE}/expenses/${id}`, { method: 'DELETE' });
}

export async function correctExpense(expenseId: string, newCategoryId: string): Promise<CorrectionResponse> {
  return safeFetchJson<CorrectionResponse>(`${API_BASE}/expenses/${expenseId}/correct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_category_id: newCategoryId }),
  });
}

export async function fetchLlmLogs(): Promise<LlmFallbackLog[]> {
  return safeFetchJson<LlmFallbackLog[]>(`${API_BASE}/llm-logs`);
}

export async function fetchRules(): Promise<CategorizationRule[]> {
  return safeFetchJson<CategorizationRule[]>(`${API_BASE}/rules`);
}

export async function fetchStatsSummary(month?: string): Promise<StatsSummary> {
  const url = month ? `${API_BASE}/stats/summary?month=${month}` : `${API_BASE}/stats/summary`;
  return safeFetchJson<StatsSummary>(url);
}

export async function fetchAdvisorExplanation(month?: string, statsSummary?: StatsSummary): Promise<{ statsSummary: StatsSummary; advisorExplanation: AdvisorExplanation }> {
  return safeFetchJson<{ statsSummary: StatsSummary; advisorExplanation: AdvisorExplanation }>(`${API_BASE}/stats/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ month, statsSummary }),
  });
}
