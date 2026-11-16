import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUser extends Document {
    email: string;
    password_hash: string;
    created_at?: Date;
}

export interface ICategory extends Document {
    user_id: Types.ObjectId;
    name: string;
}

export interface IExpense extends Document {
    user_id: Types.ObjectId;
    amount: number;
    description: string;
    date: Date;
    category_id: Types.ObjectId;
    payment_method: string;
    auto_categorized: boolean;
    created_at?: Date;
}

export interface ICategorizationRule extends Document {
    user_id: Types.ObjectId;
    pattern: string;
    category_id: Types.ObjectId;
    confidence_score: number;
}

export interface ICorrection extends Document {
    user_id: Types.ObjectId;
    expense_id: Types.ObjectId;
    old_category_id: Types.ObjectId;
    new_category_id: Types.ObjectId;
    merchant_pattern: string;
    corrected_at?: Date;
}

export interface ILlmFallbackLog extends Document {
    user_id: Types.ObjectId;
    expense_id?: Types.ObjectId;
    prompt_tokens: number;
    response_category: string;
    latency_ms: number;
    created_at: Date;
}

// ─── User ────────────────────────────────────────────────────────────
const UserSchema = new Schema<IUser>({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    password_hash: { type: String, required: true },
    created_at: { type: Date, default: Date.now }
});

export const User = mongoose.model<IUser>('User', UserSchema);

// ─── Expense ─────────────────────────────────────────────────────────
// Every document below is owned by one user (user_id) and is only ever
// queried with that user's id.
const ExpenseSchema = new Schema<IExpense>({
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: [0.01, 'Amount must be positive'] },
    description: { type: String, required: true, maxlength: [500, 'Description too long'] },
    date: { type: Date, required: true },
    category_id: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    payment_method: { type: String, required: true, default: 'Cash', maxlength: [50, 'Payment method too long'] },
    auto_categorized: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now }
});

ExpenseSchema.index({ user_id: 1, date: -1 });
ExpenseSchema.index({ user_id: 1, category_id: 1, date: -1 });

export const Expense = mongoose.model<IExpense>('Expense', ExpenseSchema);

// ─── Category ────────────────────────────────────────────────────────
const CategorySchema = new Schema<ICategory>({
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, maxlength: [100, 'Category name too long'] }
});

// Category names are unique per user, not globally
CategorySchema.index({ user_id: 1, name: 1 }, { unique: true });

export const Category = mongoose.model<ICategory>('Category', CategorySchema);

// ─── Categorization Rule ─────────────────────────────────────────────
const CategorizationRuleSchema = new Schema<ICategorizationRule>({
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    pattern: { type: String, required: true, uppercase: true },
    category_id: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    confidence_score: { type: Number, default: 1 }
});

CategorizationRuleSchema.index({ user_id: 1, pattern: 1 }, { unique: true });

export const CategorizationRule = mongoose.model<ICategorizationRule>('CategorizationRule', CategorizationRuleSchema);

// ─── Correction ──────────────────────────────────────────────────────
const CorrectionSchema = new Schema<ICorrection>({
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expense_id: { type: Schema.Types.ObjectId, ref: 'Expense', required: true },
    old_category_id: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    new_category_id: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    merchant_pattern: { type: String, required: true, uppercase: true },
    corrected_at: { type: Date, default: Date.now }
});

CorrectionSchema.index({ user_id: 1, merchant_pattern: 1, new_category_id: 1 });

export const Correction = mongoose.model<ICorrection>('Correction', CorrectionSchema);

// ─── LLM Fallback Log ────────────────────────────────────────────────
const LlmFallbackLogSchema = new Schema<ILlmFallbackLog>({
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expense_id: { type: Schema.Types.ObjectId, ref: 'Expense' },
    prompt_tokens: { type: Number, default: 0 },
    response_category: { type: String, required: true },
    latency_ms: { type: Number, required: true },
    created_at: { type: Date, default: Date.now }
});

LlmFallbackLogSchema.index({ user_id: 1, created_at: -1 });

export const LlmFallbackLog = mongoose.model<ILlmFallbackLog>('LlmFallbackLog', LlmFallbackLogSchema);
