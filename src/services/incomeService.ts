// src/services/incomeService.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import { Income } from '@/types';

const INCOME_SELECT_QUERY_MULTI_CURRENCY = `
  id,
  user_id,
  account_id,
  amount_native,
  currency_code,
  amount_reporting_currency,
  source_name,
  start_date,
  end_date,
  is_recurring,
  recurrence_frequency,
  description,
  created_at,
  updated_at,
  accounts ( id, name, native_currency_code )
`;
// Changed accounts(..., currency) to accounts(..., native_currency_code)

export async function getIncomesByUserId(
  supabase: SupabaseClient,
  userId: string,
  dateRange?: { from: string; to: string } // YYYY-MM-DD
): Promise<{ data: Income[] | null; error: PostgrestError | null }> {
  try {
    let query = supabase
      .from('incomes')
      .select(INCOME_SELECT_QUERY_MULTI_CURRENCY)
      .eq('user_id', userId);

    if (dateRange) {
      // Assuming dateRange applies to start_date for incomes
      query = query.gte('start_date', dateRange.from).lte('start_date', dateRange.to);
    }
    query = query.order('start_date', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching incomes (incomeService):', error.message);
    }
    // The type 'Income' in src/types/index.ts should now match the structure returned by INCOME_SELECT_QUERY_MULTI_CURRENCY
    return { data: data as Income[] | null, error };
  } catch (e: any) {
    console.error('Unexpected error fetching incomes (incomeService):', (e as Error).message);
    return { data: null, error: { message: (e as Error).message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

export async function getIncomeById(
  supabase: SupabaseClient,
  incomeId: string
): Promise<{ data: Income | null; error: PostgrestError | null }> {
  try {
    const { data, error } = await supabase
      .from('incomes')
      .select(INCOME_SELECT_QUERY_MULTI_CURRENCY)
      .eq('id', incomeId)
      .single();

    if (error) {
      console.error(`Error fetching income ${incomeId} (incomeService):`, error.message);
    }
    return { data, error };
  } catch (e: any) {
    console.error(`Unexpected error fetching income ${incomeId} (incomeService):`, (e as Error).message);
    return { data: null, error: { message: (e as Error).message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

// IncomeInsert type (from src/types/index.ts) should now expect:
// user_id, amount_native, currency_code, source_name, start_date
// and optional fields. It should NOT include amount_reporting_currency.
export type IncomeInsert = Omit<Income, 'id' | 'created_at' | 'updated_at' | 'accounts' | 'amount_reporting_currency'>;

export async function addIncome(
  supabase: SupabaseClient,
  incomeData: IncomeInsert // Use the updated IncomeInsert type
): Promise<{ data: Income | null; error: PostgrestError | null }> {
  try {
    // The IncomeInsert type itself should define the correct shape.
    // amount_reporting_currency is handled by DB trigger.
    const payload: IncomeInsert = {
        user_id: incomeData.user_id,
        account_id: incomeData.account_id || null,
        amount_native: incomeData.amount_native,
        currency_code: incomeData.currency_code,
        source_name: incomeData.source_name,
        start_date: incomeData.start_date,
        end_date: incomeData.end_date || null,
        is_recurring: incomeData.is_recurring || false,
        recurrence_frequency: incomeData.is_recurring && incomeData.recurrence_frequency ? incomeData.recurrence_frequency : null,
        description: incomeData.description || null,
    };

    const { data: newIncome, error: insertError } = await supabase
      .from('incomes')
      .insert(payload)
      .select(INCOME_SELECT_QUERY_MULTI_CURRENCY)
      .single();

    if (insertError) {
      console.error('Error adding income (incomeService):', insertError.message, 'Payload: ', payload);
      return { data: null, error: insertError };
    }
    if (!newIncome) { // Should not happen if insertError is null
        return { data: null, error: { message: "Income added but no data returned.", details: "", hint: "", code: "DB_ERROR"} as PostgrestError};
    }

    return { data: newIncome, error: null };
  } catch (e: any) {
    console.error('Unexpected error adding income (incomeService):', (e as Error).message);
    return { data: null, error: { message: (e as Error).message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

// IncomeUpdate type: currency_code of an existing income usually doesn't change.
export type IncomeUpdate = Partial<Omit<IncomeInsert, 'user_id' | 'currency_code'>>;


export async function updateIncome(
  supabase: SupabaseClient,
  incomeId: string,
  updates: IncomeUpdate // Use the updated IncomeUpdate type
): Promise<{ data: Income | null; error: PostgrestError | null }> {
  try {
    // The IncomeUpdate type defines updatable fields.
    // amount_native can be updated. amount_reporting_currency will be recalculated by DB trigger.
    // currency_code is typically not updated.
    const updatePayload: IncomeUpdate = { ...updates };
    if (updates.is_recurring === false && updatePayload.recurrence_frequency !== undefined) { // Ensure recurrence_frequency is nulled if not recurring
        updatePayload.recurrence_frequency = null;
    }
    if ('end_date' in updates && (updates.end_date === undefined)) { // Allow unsetting end_date
        updatePayload.end_date = null;
    }
    if ('account_id' in updates && updates.account_id === undefined) { // Allow unsetting account_id
        updatePayload.account_id = null;
    }
    // Add other specific nullifications if needed based on your IncomeUpdate type

    const { data: updatedIncome, error: updateError } = await supabase
      .from('incomes')
      .update(updatePayload)
      .eq('id', incomeId)
      .select(INCOME_SELECT_QUERY_MULTI_CURRENCY)
      .single();

    if (updateError) {
      console.error(`Error updating income ${incomeId} (incomeService):`, updateError.message, 'Payload:', updatePayload);
      return { data: null, error: updateError };
    }
    if (!updatedIncome) {  // Should not happen on successful update
        return { data: null, error: { message: "Income updated but no data returned.", details: "", hint: "", code: "DB_ERROR"} as PostgrestError};
    }

    return { data: updatedIncome, error: null };
  } catch (e: any) {
    console.error(`Unexpected error updating income ${incomeId} (incomeService):`, (e as Error).message);
    return { data: null, error: { message: (e as Error).message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

export async function deleteIncome(
  supabase: SupabaseClient,
  incomeId: string
): Promise<{ error: PostgrestError | null }> {
  try {
    // Fetching before delete is not strictly necessary if DB triggers handle all side effects.
    // const { data: incomeToDelete, error: fetchError } = ...; // Original code had this.

    const { error: deleteError } = await supabase
      .from('incomes')
      .delete()
      .eq('id', incomeId);

    if (deleteError) {
      console.error(`Error deleting income ${incomeId} (incomeService):`, deleteError.message);
    }
    return { error: deleteError };
  } catch (e: any) {
    console.error(`Unexpected error deleting income ${incomeId} (incomeService):`, (e as Error).message);
    return { error: { message: (e as Error).message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}