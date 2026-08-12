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
