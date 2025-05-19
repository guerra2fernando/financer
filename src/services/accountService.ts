// src/services/accountService.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import { Account, AccountInsert, AccountUpdate } from '@/types'; // Added CurrencyCode
// adjustAccountBalance RPC is not directly used in the same way by the client anymore for individual transactions.
// The DB triggers handle balance updates from incomes/expenses/investment_transactions.
// This service's updateAccount might be for name/type, not direct balance manipulation.
import { BASE_REPORTING_CURRENCY } from '@/lib/constants';

const ACCOUNT_SELECT_QUERY = `
  id,
  user_id,
  name,
  type,
  balance_native,
  native_currency_code,
  balance_reporting_currency,
  created_at,
  updated_at
`;

export async function getAccountsByUserId(
  supabase: SupabaseClient,
  userId: string
): Promise<{ data: Account[] | null; error: PostgrestError | null }> {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .select(ACCOUNT_SELECT_QUERY)
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching accounts (accountService):', error.message);
    }
    return { data, error };
  } catch (e: any) {
    console.error('Unexpected error fetching accounts (accountService):', e.message);
    return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

export async function getAccountById(
  supabase: SupabaseClient,
  accountId: string
): Promise<{ data: Account | null; error: PostgrestError | null }> {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .select(ACCOUNT_SELECT_QUERY)
      .eq('id', accountId)
      .single(); // Use single if an account MUST exist by ID

    if (error) {
      console.error(`Error fetching account ${accountId} (accountService):`, error.message);
    }
    return { data, error };
  } catch (e: any) {
    console.error(`Unexpected error fetching account ${accountId} (accountService):`, e.message);
    return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

// AccountInsert type should now include balance_native and native_currency_code.
// balance_reporting_currency will be calculated (usually from balance_native if it's same as reporting currency, or 0 initially).
// For new accounts, if native_currency_code is USD, balance_reporting_currency = balance_native.
// If native_currency_code is not USD, balance_reporting_currency will be balance_native * rate (or 0 if no rate/initial balance is 0).
// The DB schema sets balance_reporting_currency default 0. We can rely on this or set it.
// For simplicity, let's assume initial balance_reporting_currency = 0 or handled by a (potential) trigger on account insert if needed for non-USD.
// The spec implies balance_native is user input, and balance_reporting_currency is derived.
export async function addAccount(
  supabase: SupabaseClient,
  accountData: AccountInsert // Ensure AccountInsert has user_id, name, type, balance_native, native_currency_code
): Promise<{ data: Account | null; error: PostgrestError | null }> {
  try {
    // balance_reporting_currency is NOT set by client; it's either default 0 or
    // ideally, if initial balance_native is non-zero and currency != USD, a trigger/logic
    // on account creation could set it. For now, we assume it defaults to 0 and gets updated
    // by transactions, or if native_currency is USD, it should be balance_native.
    // Let's construct the payload carefully.
    const payload: Omit<Account, 'id' | 'created_at' | 'updated_at' | 'balance_reporting_currency'> & { balance_reporting_currency?: number } = {
        user_id: accountData.user_id,
        name: accountData.name,
        type: accountData.type,
        native_currency_code: accountData.native_currency_code,
        balance_native: accountData.balance_native,
    };

    // If the native currency of the new account is USD, then balance_reporting_currency is the same as balance_native.
    // Otherwise, it will start at 0 and be adjusted by transactions, or a trigger could set it based on an initial rate.
    // The schema has DEFAULT 0 for balance_reporting_currency.
    if (accountData.native_currency_code === BASE_REPORTING_CURRENCY) {
        payload.balance_reporting_currency = accountData.balance_native;
    } else {
        // For non-USD accounts, initial reporting balance is 0 or could be converted if a rate is available.
        // For simplicity, rely on DB default (0) or future transactions to populate it.
        // Or, call getExchangeRate here if an immediate conversion of initial balance is desired.
        // For now, we omit it, relying on DB default.
    }


    const { data, error } = await supabase
      .from('accounts')
      .insert(payload) // DB default for balance_reporting_currency will apply if not USD and not provided
      .select(ACCOUNT_SELECT_QUERY)
      .single();

    if (error) {
      console.error('Error adding account (accountService):', error.message, 'Payload:', payload);
    }
    return { data, error };
  } catch (e: any) {
    console.error('Unexpected error adding account (accountService):', e.message);
    return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

// AccountUpdate typically for non-financial fields like name, type.
// Balances are updated by transaction-related triggers.
export async function updateAccount(
  supabase: SupabaseClient,
  accountId: string,
  updates: AccountUpdate // AccountUpdate should NOT include balance fields or currency code.
): Promise<{ data: Account | null; error: PostgrestError | null }> {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .update(updates)
      .eq('id', accountId)
      .select(ACCOUNT_SELECT_QUERY)
      .single();

    if (error) {
      console.error(`Error updating account ${accountId} (accountService):`, error.message);
    }
    return { data, error };
  } catch (e: any) {
    console.error(`Unexpected error updating account ${accountId} (accountService):`, e.message);
    return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

export async function deleteAccount(
  supabase: SupabaseClient,
  accountId: string
): Promise<{ error: PostgrestError | null }> {
  try {
    // Considerations:
    // 1. Check if account balance is zero. (Optional, app logic)
    // 2. Check for linked transactions. (Handled by DB FKs: ON DELETE RESTRICT/SET NULL/CASCADE)
    //    If RESTRICT, deletion will fail if transactions exist.
    //    If SET NULL, transactions will be unlinked.
    //    If CASCADE, transactions will be deleted (dangerous).
    //    Current schema doesn't specify ON DELETE for incomes/expenses referencing accounts.
    //    It's crucial to define this behavior. Assume RESTRICT or SET NULL is safer.

    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', accountId);

    if (error) {
      console.error(`Error deleting account ${accountId} (accountService):`, error.message);
    }
    return { error };
  } catch (e: any) {
    console.error(`Unexpected error deleting account ${accountId} (accountService):`, e.message);
    return { error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

// The old adjustAccountBalance RPC called from client is no longer the primary way to update balances.
// It was: adjustAccountBalance(supabase, accountId, adjustmentAmount) where amount was USD.
// This direct adjustment might still be needed for manual corrections by an admin,
// but it would need to be currency-aware.
// For now, we assume transaction triggers are the main mechanism.
// If a direct adjustment RPC is still needed:
// It should be like: adjust_account_balance_manual(p_account_id UUID, p_adjustment_native NUMERIC, p_adjustment_currency_code TEXT, p_adjustment_date DATE)
// This RPC would then perform conversions similar to the transaction triggers.
// The client-side `adjustAccountBalance` function you had was calling a simple RPC.
// Let's comment out the old client-side adjustAccountBalance function here as its RPC `adjust_account_balance`
// (which took p_adjustment_amount in USD) is superseded by the new trigger logic.
/*
export async function adjustAccountBalance(
  supabase: SupabaseClient,
  accountId: string,
  adjustmentAmountUSD: number // This RPC was USD-based
): Promise<{ error: PostgrestError | null }> {
  // This function needs to be re-evaluated. The old RPC 'adjust_account_balance'
  // took a USD amount. Direct balance adjustments now need to consider native currency.
  // It's likely better to represent manual adjustments as a specific transaction type
  // that then uses the standard transaction triggers.
  console.warn("adjustAccountBalance (client-side service) needs review for multi-currency. Direct USD adjustments are deprecated.");
  try {
    // Dummy call to a non-existent or to-be-refactored RPC
    const { error } = await supabase.rpc('adjust_account_balance_manual_usd_temp_placeholder', {
      p_account_id: accountId,
      p_adjustment_usd: adjustmentAmountUSD, // This RPC would need to exist and handle it
    });

    if (error) {
      console.error(`Error in RPC adjust_account_balance_manual_usd_temp_placeholder for account ${accountId} by ${adjustmentAmountUSD}:`, error.message);
      return { error };
    }
    return { error: null };
  } catch (e: any) {
    // ... error handling ...
    return { error: { message: 'RPC call failed', details: '', hint: '', code: 'RPC_ERROR' } as PostgrestError };
  }
}
*/