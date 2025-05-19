/* eslint-disable @typescript-eslint/no-unused-vars */
// src/services/debtService.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import { Debt, DebtInsert, DebtUpdate } from '@/types'; // Added CurrencyCode
import {  CurrencyCode } from '@/lib/constants';

const DEBT_SELECT_QUERY = `
  id,
  user_id,
  creditor,
  currency_code,
  original_amount_native,
  original_amount_reporting_currency,
  current_balance_native,
  current_balance_reporting_currency,
  interest_rate_annual,
  minimum_payment_native,
  minimum_payment_reporting_currency,
  due_date,
  is_paid,
  description,
  created_at,
  updated_at
`;

export async function getDebtsByUserId(
  supabase: SupabaseClient,
  userId: string
): Promise<{ data: Debt[] | null; error: PostgrestError | null }> {
  try {
    const { data, error } = await supabase
      .from('debts')
      .select(DEBT_SELECT_QUERY)
      .eq('user_id', userId)
      .order('is_paid', { ascending: true })
      .order('due_date', { ascending: true });

    if (error) {
      console.error('Error fetching debts (debtService):', error.message);
    }
    return { data, error };
  } catch (e: any) {
    console.error('Unexpected error fetching debts (debtService):', e.message);
    return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

export async function getDebtById(
  supabase: SupabaseClient,
  debtId: string
): Promise<{ data: Debt | null; error: PostgrestError | null }> {
  try {
    const { data, error } = await supabase
      .from('debts')
      .select(DEBT_SELECT_QUERY)
      .eq('id', debtId)
      .single();

    if (error) {
      console.error(`Error fetching debt ${debtId} (debtService):`, error.message);
    }
    return { data, error };
  } catch (e: any) {
    console.error(`Unexpected error fetching debt ${debtId} (debtService):`, e.message);
    return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

// DebtInsert expects native amounts and currency_code.
// Reporting amounts and current_balance_native (initially same as original) are handled by DB.
export async function addDebt(
  supabase: SupabaseClient,
  debtData: DebtInsert // Ensure DebtInsert has user_id, creditor, currency_code, original_amount_native, due_date etc.
                        // and optionally minimum_payment_native.
): Promise<{ data: Debt | null; error: PostgrestError | null }> {
  try {
    // DebtInsert type should exclude reporting fields and current_balance fields.
    // DB trigger 'calculate_debt_static_reporting_trigger_fn' handles original_amount_reporting_currency & min_payment_reporting_currency.
    // DB schema sets current_balance_native = original_amount_native and current_balance_reporting_currency = original_amount_reporting_currency upon insert, ideally.
    // Or, current_balance_native could be part of insert, and current_balance_reporting_currency calculated.
    // Based on your DebtInsert type: Omit<Debt, 'id' | 'created_at' | 'updated_at' | 'original_amount_reporting_currency' | 'current_balance_native' | 'current_balance_reporting_currency' | 'minimum_payment_reporting_currency' | 'is_paid'>;
    // This means current_balance_native is NOT in DebtInsert. It should be set to original_amount_native upon creation.
    // This can be done in the DB schema (DEFAULT original_amount_native) or in this payload.

    const payload: DebtInsert & { current_balance_native: number; is_paid: boolean } = {
      user_id: debtData.user_id,
      creditor: debtData.creditor,
      currency_code: debtData.currency_code,
      original_amount_native: debtData.original_amount_native,
      current_balance_native: debtData.original_amount_native, // Set initial current balance
      interest_rate_annual: debtData.interest_rate_annual || null,
      minimum_payment_native: debtData.minimum_payment_native || null,
      due_date: debtData.due_date,
      is_paid: false, // New debts are not paid
      description: debtData.description || null,
    };
    // The fields like original_amount_reporting_currency, current_balance_reporting_currency, minimum_payment_reporting_currency
    // will be handled by the BEFORE INSERT trigger 'trg_debts_calc_static_reporting_currency' for original & min_payment parts,
    // and the current_balance_reporting_currency will also be implicitly set by a trigger if it mirrors current_balance_native on insert,
    // or by the general logic that current_balance_reporting_currency = current_balance_native * rate_to_USD.

    const { data, error } = await supabase
      .from('debts')
      .insert(payload)
      .select(DEBT_SELECT_QUERY)
      .single();

    if (error) {
      console.error('Error adding debt (debtService):', error.message, 'Payload:', payload);
    }
    return { data, error };
  } catch (e: any) {
    console.error('Unexpected error adding debt (debtService):', e.message);
    return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

// DebtUpdate: currency_code and original_amount_native typically don't change.
// current_balance_native is updated by linked expense payments (handled by trigger on expenses table).
// minimum_payment_native can be updated.
export async function updateDebt(
  supabase: SupabaseClient,
  debtId: string,
  updates: DebtUpdate // Ensure DebtUpdate allows relevant fields like creditor, interest_rate, minimum_payment_native, due_date, is_paid, description.
                      // It should NOT allow direct update of current_balance_native (that's via payments)
                      // or original_amount_native/currency_code.
): Promise<{ data: Debt | null; error: PostgrestError | null }> {
  try {
    // The DebtUpdate type should exclude reporting fields, original amounts, and current balances.
    const { data, error } = await supabase
      .from('debts')
      .update(updates)
      .eq('id', debtId)
      .select(DEBT_SELECT_QUERY)
      .single();

    if (error) {
      console.error(`Error updating debt ${debtId} (debtService):`, error.message, 'Payload:', updates);
    }
    return { data, error };
  } catch (e: any) {
    console.error(`Unexpected error updating debt ${debtId} (debtService):`, e.message);
    return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

export async function deleteDebt(
  supabase: SupabaseClient,
  debtId: string
): Promise<{ error: PostgrestError | null }> {
  try {
    // Considerations: Are there linked expenses?
    // The `update_debt_balance_after_expense` trigger handles unlinking.
    // If an expense is linked via `related_debt_id`, deleting the debt might be restricted by FK
    // unless ON DELETE SET NULL is on the `expenses.related_debt_id` FK.
    const { error } = await supabase
      .from('debts')
      .delete()
      .eq('id', debtId);

    if (error) {
      console.error(`Error deleting debt ${debtId} (debtService):`, error.message);
    }
    return { error };
  } catch (e: any) {
    console.error(`Unexpected error deleting debt ${debtId} (debtService):`, e.message);
    return { error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}