// src/types/index.ts
/* eslint-disable @typescript-eslint/no-unused-vars */
import { SupabaseClient } from '@supabase/supabase-js';

// Import the precise slug type from constants
import { DEFAULT_BUDGET_CATEGORIES, ExpenseCategorySlug, CurrencyCode, BASE_REPORTING_CURRENCY, DEFAULT_CURRENCY } from '@/lib/constants';
// Import the types from utils that utils.ts itself defines and uses
import type { AllCurrenciesData as UtilsAllCurrenciesData, ExchangeRatesMap as UtilsExchangeRatesMap } from '@/lib/utils';


// --- Enums and Utility Types ---
export type Role = 'user' | 'admin';
export type AccountType = 'cash' | 'bank_account' | 'e-wallet';
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type InvestmentTransactionType = 'buy' | 'sell' | 'dividend' | 'reinvest';
export type BudgetPeriodType = 'monthly';
export type FinancialGoalStatus = 'active' | 'achieved' | 'paused' | 'cancelled';

export type { User as SupabaseAuthUser } from '@supabase/supabase-js';

// --- NEW Multi-Currency System Specific Types ---
export interface Currency {
  code: CurrencyCode;
  name: string;
  symbol: string;
  symbol_native?: string | null;
  decimal_digits: number;
  rounding?: number | null;
  name_plural?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ExchangeRate {
  id: string; // UUID
  rate_date: string; // ISO Date string e.g., YYYY-MM-DD
  base_currency_code: CurrencyCode;
  target_currency_code: CurrencyCode;
  rate: number; // NUMERIC(18, 8)
  last_fetched_at?: string; // TIMESTAMPTZ
}

// --- Context Props ---
export interface CurrencyContextProps {
  userPreferredCurrency: CurrencyCode;
  baseReportingCurrency: CurrencyCode;
  // Use the types exported from utils.ts for consistency with formatCurrency
  allCurrenciesData: UtilsAllCurrenciesData;
  currentExchangeRates: UtilsExchangeRatesMap; // This allows undefined for a rate
  supabaseClient: SupabaseClient;
}

// --- Existing Types Refactored for Multi-Currency ---
// (Profile, Account, Income, etc., remain the same as your provided version)
export interface Profile {
  id: string;
  email?: string;
  full_name?: string | null;
  avatar_url?: string | null;
  preferred_currency: CurrencyCode;
  role: Role;
  is_active?: boolean;
  status?: string | null;
  created_at?: string;
  updated_at?: string;
  location_city?: string | null;
  location_country?: string | null;
  household_size?: number | null;
}
export type ProfileUpdatePayload = Partial<Pick<Profile, 'full_name' | 'avatar_url' | 'preferred_currency' | 'location_city' | 'location_country' | 'household_size'>>;

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  balance_native: number;
  native_currency_code: CurrencyCode;
  balance_reporting_currency: number;
  created_at?: string;
  updated_at?: string;
}
export type AccountInsert = Omit<Account, 'id' | 'created_at' | 'updated_at' | 'user_id' | 'balance_reporting_currency'> & { user_id: string };
export type AccountUpdate = Partial<Omit<Account, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'native_currency_code' | 'balance_native' | 'balance_reporting_currency'>>;


export interface Income {
  id: string;
  user_id: string;
  account_id?: string | null;
  amount_native: number;
  currency_code: CurrencyCode;
  amount_reporting_currency: number;
  source_name: string;
  start_date: string;
  end_date?: string | null;
  is_recurring: boolean;
  recurrence_frequency?: RecurrenceFrequency | null;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
  accounts?: { id: string; name: string; native_currency_code: CurrencyCode }[] | null;
}
export type IncomeInsert = Omit<Income, 'id' | 'created_at' | 'updated_at' | 'accounts' | 'amount_reporting_currency'>;
export type IncomeUpdate = Partial<Omit<Income, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'accounts' | 'amount_reporting_currency'>>;


export interface ExpenseCategoryDB {
  id: number;
  name: ExpenseCategorySlug;
  user_id?: string | null;
  is_default: boolean;
  created_at?: string;
}
export type ExpenseCategoryDBInsert = Omit<ExpenseCategoryDB, 'id' | 'created_at'>;
export type ExpenseCategoryDBUpdate = Partial<Omit<ExpenseCategoryDB, 'id' | 'user_id' | 'is_default' | 'created_at'>>;


export interface Expense {
  id: string;
  user_id: string;
  account_id?: string | null;
  expense_category_id: number;
  amount_native: number;
  currency_code: CurrencyCode;
  amount_reporting_currency: number;
  category: ExpenseCategorySlug;
  date: string;
  description?: string | null;
  is_recurring: boolean;
  recurrence_frequency?: RecurrenceFrequency | null;
  related_debt_id?: string | null;
  created_at?: string;
  updated_at?: string;
  accounts?: { name: string; native_currency_code?: CurrencyCode } | null;
  expense_categories?: { id: number; name: ExpenseCategorySlug } | null;
  debts?: { creditor: string } | null;
}
export type ExpenseInsertData = {
  user_id: string;
  amount_native: number;
  currency_code: CurrencyCode;
  date: string;
  expense_category_id: number;
  category: ExpenseCategorySlug;
  account_id?: string | null;
  description?: string | null;
  is_recurring: boolean;
  recurrence_frequency?: RecurrenceFrequency | null;
  related_debt_id?: string | null;
};
export type ExpenseUpdateData = Partial<Omit<ExpenseInsertData, 'user_id' | 'currency_code'>>;


export interface Debt {
  id: string;
  user_id: string;
  creditor: string;
  currency_code: CurrencyCode;
  original_amount_native: number;
  original_amount_reporting_currency: number;
  current_balance_native: number;
  current_balance_reporting_currency: number;
  minimum_payment_native?: number | null;
  minimum_payment_reporting_currency?: number | null;
  interest_rate_annual?: number | null;
  due_date: string;
  is_paid: boolean;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}
export type DebtInsert = Omit<Debt, 'id' | 'created_at' | 'updated_at' | 'original_amount_reporting_currency' | 'current_balance_native' | 'current_balance_reporting_currency' | 'minimum_payment_reporting_currency' | 'is_paid'>;
export type DebtUpdate = Partial<Omit<Debt, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'original_amount_native' | 'original_amount_reporting_currency' | 'currency_code'>>;


export interface Investment {
  id: string;
  user_id: string;
  account_id?: string | null;
  type: string;
  name: string;
  currency_code: CurrencyCode;
  quantity: number | null;
  purchase_price_per_unit_native: number | null;
  purchase_price_per_unit_reporting_currency: number | null;
  current_price_per_unit_native: number | null;
  current_price_per_unit_reporting_currency: number | null;
  total_initial_cost_native: number | null;
  total_initial_cost_reporting_currency: number | null;
  total_current_value_native: number | null;
  total_current_value_reporting_currency: number | null;
  monthly_goal_native?: number | null;
  monthly_goal_reporting_currency?: number | null;
  start_date?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  accounts?: { id: string; name: string; native_currency_code: CurrencyCode }[] | null;
}
export type InvestmentInsert = Omit<Investment, 'id' | 'created_at' | 'updated_at' | 'accounts' | 'purchase_price_per_unit_reporting_currency' | 'current_price_per_unit_reporting_currency' | 'total_initial_cost_reporting_currency' | 'total_current_value_reporting_currency' | 'monthly_goal_reporting_currency' | 'total_initial_cost_native' | 'total_current_value_native'>;
export type InvestmentUpdate = Partial<Omit<Investment, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'accounts' | 'currency_code'>> & {
  total_current_value_reporting_currency?: number | null;
  total_current_value_native?: number | null;
};


export interface InvestmentTransaction {
  id: string;
  investment_id: string;
  user_id: string;
  account_id?: string | null;
  currency_code: CurrencyCode;
  transaction_type: InvestmentTransactionType;
  date: string;
  quantity: number;
  price_per_unit_native: number;
  price_per_unit_reporting_currency: number;
  total_amount_native: number;
  total_amount_reporting_currency: number;
  fees_native?: number | null;
  fees_reporting_currency?: number | null;
  notes?: string | null;
  created_at?: string;
  accounts?: { id: string; name: string; native_currency_code?: CurrencyCode }[] | null;
}
export type InvestmentTransactionInsert = Omit<InvestmentTransaction, 'id' | 'created_at' | 'accounts' | 'price_per_unit_reporting_currency' | 'total_amount_reporting_currency' | 'fees_reporting_currency' | 'total_amount_native'> & { total_amount_native?: number };
export type InvestmentTransactionUpdate = Partial<Omit<InvestmentTransaction, 'id' | 'user_id' | 'investment_id' | 'created_at' | 'accounts' | 'currency_code'>>;


export interface Budget {
  id: string;
  user_id: string;
  category: ExpenseCategorySlug;
  currency_code: CurrencyCode;
  amount_limit_native: number;
  amount_limit_reporting_currency: number;
  period_type: BudgetPeriodType;
  period_start_date: string;
  created_at?: string;
  updated_at?: string;
}
export type BudgetInsert = Omit<Budget, 'id' | 'created_at' | 'updated_at' | 'amount_limit_reporting_currency'>;
export type BudgetUpdate = Partial<Omit<Budget, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'category' | 'period_start_date' | 'period_type' | 'amount_limit_reporting_currency' | 'currency_code'>>;


export interface FinancialGoal {
  id: string;
  user_id: string;
  name: string;
  currency_code: CurrencyCode;
  target_amount_native: number;
  target_amount_reporting_currency: number;
  current_amount_saved_native: number;
  current_amount_saved_reporting_currency: number;
  monthly_contribution_target_native?: number | null;
  monthly_contribution_target_reporting_currency?: number | null;
  target_date?: string | null;
  status: FinancialGoalStatus;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}
export type FinancialGoalInsert = Omit<FinancialGoal, 'id' | 'created_at' | 'updated_at' | 'target_amount_reporting_currency' | 'current_amount_saved_reporting_currency' | 'monthly_contribution_target_reporting_currency'>;
export type FinancialGoalUpdate = Partial<Omit<FinancialGoal, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'currency_code'>>;


export interface GoalContribution {
  id: string;
  user_id: string;
  goal_id: string;
  account_id?: string | null;
  amount_native: number;
  currency_code: CurrencyCode;
  amount_reporting_currency: number;
  date: string;
  notes?: string | null;
  created_at?: string;
  accounts?: { id: string; name: string; native_currency_code: CurrencyCode }[] | null;
}
export type GoalContributionInsert = Omit<GoalContribution, 'id' | 'created_at' | 'accounts' | 'amount_reporting_currency'> & {
  account_id?: string | null | undefined;
};
export type GoalContributionUpdate = Partial<Omit<GoalContribution, 'id' | 'user_id' | 'goal_id' | 'created_at' | 'accounts' | 'currency_code'>>;


export interface BudgetListItemProcessed extends Budget {
  actualSpendingInReportingCurrency: number;
  remainingAmountInReportingCurrency: number;
  progressPercent: number;
}
export interface User {
  id: string;
  email?: string | undefined;
}

// --- AI Budget Recommendation Specific Types ---
export interface AIBudgetWizardInput {
  monthlyIncomeUSD: number;
  locationCity?: string;
  locationCountry?: string;
  fixedExpenses?: Array<{ category: ExpenseCategorySlug; amount: number; currency_code: CurrencyCode; description?: string }>;
  primaryFinancialGoal?: string;
  householdSize?: number;
}

export interface AIHistoricalDataSummary {
  averageMonthlyIncomeUSD?: number;
  averageMonthlyExpensesByCategoryUSD?: Array<{ category: ExpenseCategorySlug; averageAmountUSD: number }>;
  activeFinancialGoalsUSD?: Array<{ name: string; targetAmountUSD: number; monthlyContributionTargetUSD?: number }>;
}

export interface AIBudgetRecommendationClientRequest {
  wizardData?: AIBudgetWizardInput;
  useHistoricalData: boolean;
  customInstructions?: string;
}

export interface AIBudgetPromptData {
    userId: string;
    userPreferredCurrency: CurrencyCode;
    monthlyIncomeUSD: number;
    locationCity?: string;
    locationCountry?: string;
    fixedExpensesUSD?: Array<{ category: ExpenseCategorySlug; amountUSD: number; description?: string }>;
    primaryFinancialGoal?: string;
    householdSize?: number;
    averageMonthlyIncomeUSD?: number;
    averageMonthlyExpensesByCategoryUSD?: Array<{ category: ExpenseCategorySlug; averageAmountUSD: number }>;
    activeFinancialGoalsUSD?: Array<{ name: string; targetAmountUSD: number; monthlyContributionTargetUSD?: number }>;
    availableCategories: ReadonlyArray<ExpenseCategorySlug>;
    customInstructions?: string;
}

export interface AISuggestedBudgetCategory {
  category_slug: ExpenseCategorySlug;
  suggested_amount_usd: number;
  justification: string;
  is_fixed_from_user?: boolean;
}

export interface AIBudgetRecommendationResponse {
  recommendations: AISuggestedBudgetCategory[];
  summary?: string;
  totalBudgetedAmountUSD: number;
  totalIncomeConsideredUSD: number;
  aiModelUsed?: string;
}

export interface AIBudgetErrorResponse {
  error: string;
  details?: string;
  source?: string;
  model?: string;
}


export interface RawExpenseFromDB {
  id: string;
  user_id: string;
  account_id?: string | null;
  amount_native: number;
  currency_code: CurrencyCode;
  amount_reporting_currency: number;
  date: string;
  description?: string | null;
  is_recurring: boolean;
  recurrence_frequency?: RecurrenceFrequency | null;
  related_debt_id?: string | null;
  created_at?: string;
  updated_at?: string;
  expense_category_id: number;
  category: ExpenseCategorySlug;
  accounts?: { id: string; name: string; native_currency_code?: CurrencyCode } | null;
  expense_categories?: { id: number; name: ExpenseCategorySlug } | null;
  debts?: { creditor: string } | null;
}
