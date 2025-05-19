/* eslint-disable @typescript-eslint/no-unused-vars */
// src/services/budgetService.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import { Budget, BudgetInsert, BudgetUpdate, BudgetPeriodType } from '@/types'; // Added CurrencyCode and other types for clarity

const BUDGET_SELECT_QUERY = `
  id,
  user_id,
  category,
  currency_code,
  amount_limit_native,
  amount_limit_reporting_currency,
  period_type,
  period_start_date,
  created_at,
  updated_at
`;
// Note: Budget.category is ExpenseCategorySlug. If you plan to join with expense_categories table for more details
// (like category name, ID), the SELECT query and types would need adjustment.
// For now, following existing structure where Budget.category is the slug.

export async function getBudgetsByUserId(
  supabase: SupabaseClient,
  userId: string,
  periodStartDate?: string // YYYY-MM-DD
): Promise<{ data: Budget[] | null; error: PostgrestError | null }> {
  try {
    let query = supabase
      .from('budgets')
      .select(BUDGET_SELECT_QUERY)
      .eq('user_id', userId);

    if (periodStartDate) {
      query = query.eq('period_start_date', periodStartDate);
    }
    query = query.order('category', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching budgets (budgetService):', error.message);
    }
    return { data, error };
  } catch (e: any) {
    console.error('Unexpected error fetching budgets (budgetService):', e.message);
    return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

export async function getBudgetById(
  supabase: SupabaseClient,
  budgetId: string
): Promise<{ data: Budget | null; error: PostgrestError | null }> {
  try {
    const { data, error } = await supabase
      .from('budgets')
      .select(BUDGET_SELECT_QUERY)
      .eq('id', budgetId)
      .single();

    if (error) {
      console.error(`Error fetching budget ${budgetId} (budgetService):`, error.message);
    }
    return { data, error };
  } catch (e: any) {
    console.error(`Unexpected error fetching budget ${budgetId} (budgetService):`, e.message);
    return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

// BudgetInsert type now expects amount_limit_native and currency_code.
// amount_limit_reporting_currency is handled by DB trigger.
export async function addBudget(
  supabase: SupabaseClient,
  budgetData: BudgetInsert // Ensure BudgetInsert has user_id, category, currency_code, amount_limit_native, period_type, period_start_date
): Promise<{ data: Budget | null; error: PostgrestError | null }> {
  try {
    // The BudgetInsert type should already exclude amount_limit_reporting_currency.
    const payload: BudgetInsert = {
        user_id: budgetData.user_id,
        category: budgetData.category,
        currency_code: budgetData.currency_code,
        amount_limit_native: budgetData.amount_limit_native,
        period_type: budgetData.period_type,
        period_start_date: budgetData.period_start_date,
    };

    const { data, error } = await supabase
      .from('budgets')
      .insert(payload)
      .select(BUDGET_SELECT_QUERY)
      .single();

    if (error) {
      console.error('Error adding budget (budgetService):', error.message, 'Payload:', payload);
    }
    return { data, error };
  } catch (e: any) {
    console.error('Unexpected error adding budget (budgetService):', e.message);
    return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

// BudgetUpdate: currency_code of a budget usually doesn't change. If it can, adjust BudgetUpdate type.
// amount_limit_native can be updated. amount_limit_reporting_currency is handled by DB trigger.
export async function updateBudget(
  supabase: SupabaseClient,
  budgetId: string,
  updates: BudgetUpdate // Ensure BudgetUpdate allows amount_limit_native, and potentially currency_code if changeable
): Promise<{ data: Budget | null; error: PostgrestError | null }> {
  try {
    // The BudgetUpdate type should exclude amount_limit_reporting_currency.
    const { data, error } = await supabase
      .from('budgets')
      .update(updates)
      .eq('id', budgetId)
      .select(BUDGET_SELECT_QUERY)
      .single();

    if (error) {
      console.error(`Error updating budget ${budgetId} (budgetService):`, error.message, 'Payload:', updates);
    }
    return { data, error };
  } catch (e: any) {
    console.error(`Unexpected error updating budget ${budgetId} (budgetService):`, e.message);
    return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

export async function deleteBudget(
  supabase: SupabaseClient,
  budgetId: string
): Promise<{ error: PostgrestError | null }> {
  try {
    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', budgetId);

    if (error) {
      console.error(`Error deleting budget ${budgetId} (budgetService):`, error.message);
    }
    return { error };
  } catch (e: any) {
    console.error(`Unexpected error deleting budget ${budgetId} (budgetService):`, e.message);
    return { error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}
