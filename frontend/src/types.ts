export interface Category {
  _id: string;
  name: string;
}

export interface Expense {
  _id: string;
  amount: number;
  description: string;
  date: string;
  category_id: Category | string;
  payment_method: string;
  auto_categorized: boolean;
  created_at?: string;
}

export interface CategorizationRule {
  _id: string;
  pattern: string;
  category_id: Category | string;
  confidence_score: number;
}

export interface CorrectionResponse {
  expense: Expense;
  merchantPattern: string;
  correctionCount: number;
  promotedRule: boolean;
}

export interface LlmFallbackLog {
  _id: string;
  prompt_tokens: number;
  response_category: string;
  latency_ms: number;
  created_at: string;
}

export interface CategoryStat {
  categoryId: string;
  categoryName: string;
  currentMonthSpend: number;
  trailing3MonthAvg: number;
  previousMonthSpend: number;
  momPercentageChange: number;
}

export interface StatsSummary {
  period: string;
  totalCurrentMonthSpend: number;
  totalPreviousMonthSpend: number;
  totalMomPercentageChange: number;
  topCategory: { name: string; amount: number } | null;
  categories: CategoryStat[];
}

export interface AdvisorExplanation {
  explanation: string;
  actionableTips: string[];
  latencyMs: number;
  promptTokens: number;
}
