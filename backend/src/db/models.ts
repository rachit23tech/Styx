import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICategory extends Document {
    name: string;
}

export interface IExpense extends Document {
    amount: number;
    description: string;
    date: Date;
    category_id: Types.ObjectId;
    payment_method: string;
    auto_categorized: boolean;
    created_at?: Date;
}

export interface ICategorizationRule extends Document {
    pattern: string;
    category_id: Types.ObjectId;
    confidence_score: number;
}

export interface ICorrection extends Document {
    expense_id: Types.ObjectId;
    old_category_id: Types.ObjectId;
    new_category_id: Types.ObjectId;
    merchant_pattern: string;
    corrected_at?: Date;
}

export interface ILlmFallbackLog extends Document {
    expense_id?: Types.ObjectId;
    prompt_tokens: number;
    response_category: string;
    latency_ms: number;
    created_at: Date;
}

const ExpenseSchema = new Schema<IExpense>({
    amount: { type: Number, required: true },
    description: { type: String, required: true },
    date: { type: Date, required: true },
    category_id: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    payment_method: { type: String, required: true, default: 'Cash' },
    auto_categorized: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now }
});

export const Expense = mongoose.model<IExpense>('Expense', ExpenseSchema);

const CategorySchema = new Schema<ICategory>({
    name: { type: String, required: true, unique: true }
});

export const Category = mongoose.model<ICategory>('Category', CategorySchema);

const CategorizationRuleSchema = new Schema<ICategorizationRule>({
    pattern: { type: String, required: true, uppercase: true },
    category_id: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    confidence_score: { type: Number, default: 1 }
});

export const CategorizationRule = mongoose.model<ICategorizationRule>('CategorizationRule', CategorizationRuleSchema);

const CorrectionSchema = new Schema<ICorrection>({
    expense_id: { type: Schema.Types.ObjectId, ref: 'Expense', required: true },
    old_category_id: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    new_category_id: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    merchant_pattern: { type: String, required: true, uppercase: true },
    corrected_at: { type: Date, default: Date.now }
});

export const Correction = mongoose.model<ICorrection>('Correction', CorrectionSchema);

const LlmFallbackLogSchema = new Schema<ILlmFallbackLog>({
    expense_id: { type: Schema.Types.ObjectId, ref: 'Expense' },
    prompt_tokens: { type: Number, default: 0 },
    response_category: { type: String, required: true },
    latency_ms: { type: Number, required: true },
    created_at: { type: Date, default: Date.now }
});

export const LlmFallbackLog = mongoose.model<ILlmFallbackLog>('LlmFallbackLog', LlmFallbackLogSchema);
