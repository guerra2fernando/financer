// src/services/expenseService.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import type {
  Expense,
  ExpenseCategoryDB,
  // CurrencyCode // CurrencyCode comes from constants
} from '@/types';
import { CurrencyCode } from '@/lib/constants'; // Correct import

// Define the new RawExpenseFromDB type to match the multi-currency schema
export interface MultiCurrencyRawExpenseFromDB {
  id: string;
  user_id: string;
  account_id?: string | null;
  // OLD: amount_usd: number;
  amount_native: number;
  currency_code: CurrencyCode;
  amount_reporting_currency: number;
  date: string;
  description?: string | null;
  is_recurring: boolean;
  recurrence_frequency?: string | null; // Use string type as per original RecurrencaeFrequency
  related_debt_id?: string | null;
  created_at?: string;
  updated_at?: string;
  expense_category_id: number;
  category: string; // ExpenseCategorySlug
  accounts?: { id: string; name: string; native_currency_code?: CurrencyCode } | null; // account.currency is now native_currency_code
  expense_categories?: { id: number; name: string /* ExpenseCategorySlug */ } | null;
  debts?: { creditor: string } | null;
}


const EXPENSE_SELECT_QUERY_MULTI_CURRENCY = `
  id,
  user_id,
  account_id,
  amount_native,
  currency_code,
  amount_reporting_currency,
  date,
  description,
  is_recurring,
  recurrence_frequency,
  related_debt_id,
  created_at,
  updated_at,
  expense_category_id,
  category,
  accounts ( id, name, native_currency_code ),
  expense_categories ( id, name ),
  debts ( id, creditor, currency_code )
`;
// Added currency_code to debts join for context if needed client-side

// The map function might not be strictly necessary if the returned structure from Supabase
// directly matches the `Expense` type, but it's good practice if any transformation is needed.
// Ensure your `Expense` type in `src/types/index.ts` matches MultiCurrencyRawExpenseFromDB structure.
function mapRawExpenseToExpense(rawExpense: MultiCurrencyRawExpenseFromDB): Expense {
  // Assuming MultiCurrencyRawExpenseFromDB is now identical or very close to the target Expense type.
  // If Expense type has specific transformations (e.g. date objects), do them here.
  return rawExpense as Expense;
}

export async function getExpensesByUserId(
  supabase: SupabaseClient,
  userId: string,
  dateRange?: { from: string; to: string } // YYYY-MM-DD
): Promise<{ data: Expense[] | null; error: PostgrestError | null }> {
  try {
    let query = supabase
      .from('expenses')
      .select(EXPENSE_SELECT_QUERY_MULTI_CURRENCY)
      .eq('user_id', userId);

    if (dateRange) {
      query = query.gte('date', dateRange.from).lte('date', dateRange.to);
    }
    query = query.order('date', { ascending: false });

    const { data: rawData, error } = await query.returns<MultiCurrencyRawExpenseFromDB[]>();

    if (error) {
      console.error('Error fetching expenses (expenseService):', error.message);
      return { data: null, error };
    }

    const mappedData = rawData?.map(mapRawExpenseToExpense);
    return { data: mappedData || null, error: null };
  } catch (e: any) {
    console.error('Unexpected error in getExpensesByUserId (expenseService):', e.message);
    return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

export async function getExpenseById(
  supabase: SupabaseClient,
  expenseId: string
): Promise<{ data: Expense | null; error: PostgrestError | null }> {
  try {
    const { data: rawData, error } = await supabase
      .from('expenses')
      .select(EXPENSE_SELECT_QUERY_MULTI_CURRENCY)
      .eq('id', expenseId)
      .returns<MultiCurrencyRawExpenseFromDB>()
      .maybeSingle();

    if (error) {
      console.error(`Error fetching expense ${expenseId} (expenseService):`, error.message);
      return { data: null, error };
    }
    if (!rawData) {
      return { data: null, error: null }; // Not found, not an error
    }
    const mappedData = mapRawExpenseToExpense(rawData);
    return { data: mappedData, error: null };
  } catch (e: any) {
    console.error(`Unexpected error fetching expense ${expenseId} (expenseService):`, e.message);
    return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

// ExpenseInsertData type from src/types/index.ts should now expect:
// user_id, amount_native, currency_code, date, expense_category_id, category (slug)
// and optional fields like account_id, description, is_recurring, recurrence_frequency, related_debt_id.
// It should NOT include amount_reporting_currency.
export type ExpenseInsert = Omit<Expense, 'id' | 'created_at' | 'updated_at' | 'accounts' | 'expense_categories' | 'debts' | 'amount_reporting_currency'>;


export async function addExpense(
  supabase: SupabaseClient,
  expenseData: ExpenseInsert // Use the updated ExpenseInsert type from src/types
): Promise<{ data: Expense | null; error: PostgrestError | null }> {
  try {
    // The ExpenseInsert type itself should define the correct shape.
    // Ensure it includes amount_native and currency_code.
    // amount_reporting_currency is handled by DB trigger.
    const payload: ExpenseInsert = {
        user_id: expenseData.user_id,
        amount_native: expenseData.amount_native,
        currency_code: expenseData.currency_code,
        date: expenseData.date,
        expense_category_id: expenseData.expense_category_id,
        category: expenseData.category, // slug
        account_id: expenseData.account_id || null,
        description: expenseData.description || null,
        is_recurring: expenseData.is_recurring || false,
        recurrence_frequency: expenseData.is_recurring && expenseData.recurrence_frequency ? expenseData.recurrence_frequency : null,
        related_debt_id: expenseData.related_debt_id || null,
    };

    const { data: newRawExpense, error: insertError } = await supabase
      .from('expenses')
      .insert(payload)
      .select(EXPENSE_SELECT_QUERY_MULTI_CURRENCY)
      .returns<MultiCurrencyRawExpenseFromDB>()
      .single();

    if (insertError) {
      console.error('Error adding expense (service):', insertError.message, 'Attempted payload:', payload);
      return { data: null, error: insertError };
    }
    if (!newRawExpense) { // Should not happen if insertError is null and single() is used.
        return { data: null, error: { message: "Failed to add expense or retrieve after insert", details: "", hint: "", code:"DB_ERROR"} as PostgrestError};
    }

    const mappedNewExpense = mapRawExpenseToExpense(newRawExpense);
    return { data: mappedNewExpense, error: null };
  } catch (e: any) {
    console.error('Unexpected error adding expense (service):', e.message);
    return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

// ExpenseUpdateData type from src/types/index.ts should allow updating relevant fields.
// It should NOT include amount_reporting_currency.
// currency_code of an existing expense usually doesn't change. If it can, this needs reconsideration.
// For now, assume currency_code is fixed after creation for an expense.
export type ExpenseUpdate = Partial<Omit<ExpenseInsert, 'user_id' | 'currency_code'>>;


export async function updateExpense(
  supabase: SupabaseClient,
  expenseId: string,
  updates: ExpenseUpdate // Use the updated ExpenseUpdate type
): Promise<{ data: Expense | null; error: PostgrestError | null }> {
  try {
    // The ExpenseUpdate type should define the updatable fields.
    // amount_native can be updated. amount_reporting_currency will be recalculated by DB trigger.
    // currency_code is typically not updated for an existing transaction.
    const updatePayload: ExpenseUpdate = { ...updates };
    if (updates.is_recurring === false && updatePayload.recurrence_frequency !== undefined) {
        updatePayload.recurrence_frequency = null;
    }
    if ('account_id' in updates && updates.account_id === undefined) { // Allow unsetting account_id
        updatePayload.account_id = null;
    }
    // Add other specific nullifications if needed based on your ExpenseUpdate type

    const { data: updatedRawExpense, error: updateError } = await supabase
      .from('expenses')
      .update(updatePayload)
      .eq('id', expenseId)
      .select(EXPENSE_SELECT_QUERY_MULTI_CURRENCY)
      .returns<MultiCurrencyRawExpenseFromDB>()
      .single();

    if (updateError) {
      console.error(`Error updating expense ${expenseId} (service):`, updateError.message, 'Attempted payload:', updatePayload);
      return { data: null, error: updateError };
    }
     if (!updatedRawExpense) { // Should not happen on successful update.
        return { data: null, error: { message: "Failed to update expense or retrieve after update", details: "", hint: "", code:"DB_ERROR"} as PostgrestError};
    }

    const updatedExpense = mapRawExpenseToExpense(updatedRawExpense);
    return { data: updatedExpense, error: null };
  } catch (e: any) {
    console.error(`Unexpected error updating expense ${expenseId} (service):`, e.message);
    return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

export async function deleteExpense(
  supabase: SupabaseClient,
  expenseId: string
): Promise<{ error: PostgrestError | null }> {
  try {
    // Fetching before delete is not strictly necessary if DB triggers handle all side effects.
    // const { data: rawExpenseToDelete, error: fetchError } = ... ; // Original code had this.

    const { error: deleteError } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expenseId);

    if (deleteError) {
      console.error(`Error deleting expense ${expenseId} (service):`, deleteError.message);
      return { error: deleteError };
    }
    return { error: null };
  } catch (e: any) {
    console.error(`Unexpected error deleting expense ${expenseId} (service):`, e.message);
    return { error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

// getExpenseCategories remains unchanged as expense_categories table itself wasn't modified for multi-currency.
export async function getExpenseCategories(
  supabase: SupabaseClient,
  userId?: string
): Promise<{ data: ExpenseCategoryDB[] | null; error: PostgrestError | null }> {
    try {
        let query = supabase.from('expense_categories').select('*');
        if (userId) {
            query = query.or(`user_id.eq.${userId},is_default.eq.true`);
        } else {
            query = query.eq('is_default', true);
        }
        query = query.order('is_default', { ascending: false })
                       .order('name', { ascending: true});

        const { data, error } = await query.returns<ExpenseCategoryDB[]>();

        if (error) {
          console.error('Error fetching expense categories (expenseService):', error.message);
          return { data: null, error };
        }
        return { data, error: null };
    } catch (e: any) {
        console.error('Unexpected error fetching expense categories (expenseService):', e.message);
        return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR'} as PostgrestError };
    }
}