// src/services/investmentService.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import { 
    Investment, 
    InvestmentTransaction,
    InvestmentUpdate, // Import InvestmentUpdate
    // CurrencyCode // CurrencyCode comes from constants
} from '@/types';
import { BASE_REPORTING_CURRENCY } from '@/lib/constants'; // Correct import

const INVESTMENT_SELECT_QUERY_MULTI_CURRENCY = `
  id,
  user_id,
  account_id,
  type,
  name,
  currency_code,
  quantity,
  purchase_price_per_unit_native,
  purchase_price_per_unit_reporting_currency,
  current_price_per_unit_native,
  current_price_per_unit_reporting_currency,
  total_initial_cost_native,
  total_initial_cost_reporting_currency,
  total_current_value_native,
  total_current_value_reporting_currency,
  monthly_goal_native,
  monthly_goal_reporting_currency,
  start_date,
  notes,
  created_at,
  updated_at,
  accounts (id, name, native_currency_code)
`;

const INVESTMENT_TRANSACTION_SELECT_QUERY_MULTI_CURRENCY = `
  id,
  investment_id,
  user_id,
  account_id,
  currency_code,
  transaction_type,
  date,
  quantity,
  price_per_unit_native,
  price_per_unit_reporting_currency,
  total_amount_native,
  total_amount_reporting_currency,
  fees_native,
  fees_reporting_currency,
  notes,
  created_at,
  accounts (id, name, native_currency_code)
`;

// --- Investment (Metadata) Functions ---

export async function getInvestmentsByUserId(
  supabase: SupabaseClient,
  userId: string
): Promise<{ data: Investment[] | null; error: PostgrestError | null }> {
  try {
    const { data, error } = await supabase
      .from('investments')
      .select(INVESTMENT_SELECT_QUERY_MULTI_CURRENCY)
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error) console.error('Error fetching investments (investmentService):', error.message);
    return { data, error };
  } catch (e: any) {
    console.error('Unexpected error fetching investments (investmentService):', e.message);
    return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

export async function getInvestmentById(
  supabase: SupabaseClient,
  investmentId: string
): Promise<{ data: Investment | null; error: PostgrestError | null }> {
  try {
    const { data, error } = await supabase
      .from('investments')
      .select(INVESTMENT_SELECT_QUERY_MULTI_CURRENCY)
      .eq('id', investmentId)
      .single();

    if (error) console.error(`Error fetching investment ${investmentId} (investmentService):`, error.message);
    return { data, error };
  } catch (e: any) {
    console.error(`Unexpected error fetching investment ${investmentId} (investmentService):`, e.message);
    return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

// InvestmentInsert type should include currency_code, and native fields for prices/goals.
// Reporting fields are calculated by DB or derived. Calculated totals are also best handled by DB or triggers.
export type InvestmentInsert = Omit<Investment,
  'id' | 'created_at' | 'updated_at' | 'accounts' |
  'purchase_price_per_unit_reporting_currency' |
  'current_price_per_unit_reporting_currency' |
  'total_initial_cost_native' | // Often calculated
  'total_initial_cost_reporting_currency' |
  'total_current_value_native' | // Often calculated
  'total_current_value_reporting_currency' |
  'monthly_goal_reporting_currency'
>;

export async function addInvestment(
  supabase: SupabaseClient,
  investmentData: InvestmentInsert // Use refined InvestmentInsert type
): Promise<{ data: Investment | null; error: PostgrestError | null }> {
  try {
    const quantity = investmentData.quantity ?? 0; // Default to 0 if null/undefined
    const purchasePriceNative = investmentData.purchase_price_per_unit_native ?? 0;
    
    // Initial current price can default to purchase price if not provided
    const currentPriceNative = investmentData.current_price_per_unit_native ?? purchasePriceNative;

    const payload: InvestmentInsert & { // Add calculated native totals for insertion consistency
        total_initial_cost_native: number;
        total_current_value_native: number;
     } = {
      ...investmentData, // Includes user_id, name, type, currency_code, etc.
      account_id: investmentData.account_id || null,
      quantity: quantity,
      purchase_price_per_unit_native: purchasePriceNative,
      current_price_per_unit_native: currentPriceNative, // current price might be different from purchase
      total_initial_cost_native: quantity * purchasePriceNative,
      total_current_value_native: quantity * currentPriceNative,
      monthly_goal_native: investmentData.monthly_goal_native || null,
      start_date: investmentData.start_date || null,
      notes: investmentData.notes || null,
    };
    // Reporting currency fields will be calculated by DB triggers on investments based on native values and rates.
    // Or, if this insert itself should set reporting values for static fields like purchase_price,
    // that logic would be more complex here or better in a BEFORE INSERT trigger on 'investments' table.
    // For now, assume triggers on 'investments' (if any) or transactions will populate reporting fields.

    const { data, error } = await supabase
      .from('investments')
      .insert(payload)
      .select(INVESTMENT_SELECT_QUERY_MULTI_CURRENCY)
      .single();

    if (error) {
      console.error('Error adding investment (investmentService):', error.message, 'Payload:', payload);
    }
    return { data, error };
  } catch (e: any) {
    console.error('Unexpected error adding investment (investmentService):', e.message);
    return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

// InvestmentUpdate: currency_code of investment fixed.
// quantity, current_price_per_unit_native can be updated.
// Totals are updated by DB triggers or logic when constituent parts change.


export async function updateInvestment(
  supabase: SupabaseClient,
  investmentId: string,
  updates: InvestmentUpdate // Use refined InvestmentUpdate type
): Promise<{ data: Investment | null; error: PostgrestError | null }> {
  try {
    // This function primarily updates investment metadata like name, type, notes, or current_price_per_unit_native.
    // Quantity and cost basis are mainly affected by transactions (handled by update_investment_after_transaction trigger).
    // If current_price_per_unit_native is updated here, a DB trigger on 'investments' table (or this function)
    // should recalculate total_current_value_native and total_current_value_reporting_currency.

    const updatePayload: InvestmentUpdate = { ...updates };
    let currentInvestment: Investment | null = null;

    // If current_price_per_unit_native or quantity is changing, we might need to recalculate current values.
    if (updates.current_price_per_unit_native !== undefined || updates.quantity !== undefined) {
        const { data: fetchedInv, error: fetchErr } = await getInvestmentById(supabase, investmentId);
        if (fetchErr || !fetchedInv) {
            console.error(`Failed to fetch investment ${investmentId} for update context:`, fetchErr?.message);
            return { data: null, error: fetchErr || { message: 'Investment not found for update context.', details: '', hint: '', code: 'FETCH_ERROR' } as PostgrestError };
        }
        currentInvestment = fetchedInv;

        const newQuantity = updates.quantity ?? currentInvestment.quantity ?? 0;
        const newCurrentPriceNative = updates.current_price_per_unit_native ?? currentInvestment.current_price_per_unit_native ?? 0;
        
        updatePayload.total_current_value_native = (newQuantity) * (newCurrentPriceNative);
        
        // Recalculate total_current_value_reporting_currency
        // This requires the exchange rate for investment's currency_code to USD
        if (currentInvestment.currency_code === BASE_REPORTING_CURRENCY) {
            updatePayload.total_current_value_reporting_currency = updatePayload.total_current_value_native;
        } else {
            const {data: rate, error: rateError} = await supabase.rpc('get_exchange_rate', {
                p_date: new Date().toISOString().split('T')[0], // Use current date for current value
                p_source_currency_code: currentInvestment.currency_code,
                p_target_currency_code: BASE_REPORTING_CURRENCY
            });
            if (rateError || rate === null) {
                console.warn(`Could not get rate to update total_current_value_reporting_currency for investment ${investmentId}. It might be stale.`);
                // Decide: proceed without updating reporting, or throw error
            } else {
                updatePayload.total_current_value_reporting_currency = updatePayload.total_current_value_native * (typeof rate === 'string' ? parseFloat(rate) : rate) ;
            }
        }
    }
    // Also, if purchase_price_per_unit_native or quantity changes, total_initial_cost fields should update.
    // This is more complex if done here and might be better handled by a dedicated DB trigger on investments table itself
    // if direct updates to these fields are allowed outside of transactions.
    // The current `update_investment_after_transaction` only fires on `investment_transactions` changes.
    // For now, focusing on `current_price_per_unit_native`'s impact on `total_current_value`.

    const { data, error } = await supabase
      .from('investments')
      .update(updatePayload)
      .eq('id', investmentId)
      .select(INVESTMENT_SELECT_QUERY_MULTI_CURRENCY)
      .single();

    if (error) {
      console.error(`Error updating investment ${investmentId} (investmentService):`, error.message, 'Payload:', updatePayload);
    }
    return { data, error };
  } catch (e: any) {
    console.error(`Unexpected error updating investment ${investmentId} (investmentService):`, e.message);
    return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

export async function deleteInvestment(
  supabase: SupabaseClient,
  investmentId: string
): Promise<{ error: PostgrestError | null }> {
  try {
    // It's good practice to ensure ON DELETE CASCADE is set for the foreign key
    // from investment_transactions to investments in the DB schema.
    // If not, delete transactions manually first, as done in original code.
    const { error: txError } = await supabase
        .from('investment_transactions')
        .delete()
        .eq('investment_id', investmentId);

    if (txError) {
      console.warn(`Could not delete transactions for investment ${investmentId} (investmentService): ${txError.message}. This might be okay if no transactions existed.`);
      // Depending on requirements, you might want to stop if transactions can't be deleted.
    }

    const { error } = await supabase
      .from('investments')
      .delete()
      .eq('id', investmentId);

    if (error) {
      console.error(`Error deleting investment ${investmentId} (investmentService):`, error.message);
    }
    return { error };
  } catch (e: any) {
    console.error(`Unexpected error deleting investment ${investmentId} (investmentService):`, e.message);
    return { error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

// --- Investment Transaction Functions ---

export async function getInvestmentTransactions(
  supabase: SupabaseClient,
  investmentId: string,
  userId: string // userId for authorization check against parent investment
): Promise<{ data: InvestmentTransaction[] | null; error: PostgrestError | null }> {
  try {
    // Verify user owns the parent investment
    const { data: parentInvestment, error: parentError } = await supabase
        .from('investments')
        .select('id, currency_code') // Fetch currency_code for context
        .eq('id', investmentId)
        .eq('user_id', userId)
        .maybeSingle();

    if (parentError) throw parentError;
    if (!parentInvestment) {
        return { data: null, error: { message: 'Parent investment not found or access denied.', details: '', hint: '', code: '404' } as PostgrestError };
    }
    
    const { data, error } = await supabase
      .from('investment_transactions')
      .select(INVESTMENT_TRANSACTION_SELECT_QUERY_MULTI_CURRENCY)
      .eq('investment_id', investmentId)
      // .eq('user_id', userId) // RLS on investment_transactions should handle this, or via join to investments.user_id
      .order('date', { ascending: false });

    if (error) {
      console.error(`Error fetching transactions for investment ${investmentId} (investmentService):`, error.message);
    }
    return { data, error };
  } catch (e: any) {
    console.error(`Unexpected error fetching tx for investment ${investmentId} (investmentService):`, e.message);
    return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

// InvestmentTransactionInsert: requires native amounts and currency_code.
// Reporting amounts and derived total_amount_native are handled by DB trigger.
export type InvestmentTransactionInsert = Omit<InvestmentTransaction,
  'id' | 'created_at' | 'accounts' |
  'price_per_unit_reporting_currency' |
  'total_amount_native' | // Calculated from quantity and price_per_unit_native
  'total_amount_reporting_currency' |
  'fees_reporting_currency'
>;

export async function addInvestmentTransaction(
  supabase: SupabaseClient,
  transactionData: InvestmentTransactionInsert // Use refined type
): Promise<{ data: InvestmentTransaction | null; error: PostgrestError | null }> {
  try {
    // Fetch parent investment to ensure currency_code matches
    const { data: parentInvestment, error: parentFetchError } = await supabase
        .from('investments')
        .select('currency_code')
        .eq('id', transactionData.investment_id)
        .eq('user_id', transactionData.user_id) // Ensure user owns parent
        .single();

    if (parentFetchError || !parentInvestment) {
        const msg = `Parent investment ${transactionData.investment_id} not found or user mismatch for new transaction.`;
        console.error(msg, parentFetchError);
        return { data: null, error: { message: msg, details: parentFetchError?.message || '', hint: '', code: 'FK_VIOLATION' } as PostgrestError };
    }
    if (transactionData.currency_code !== parentInvestment.currency_code) {
        const msg = `Transaction currency (${transactionData.currency_code}) must match parent investment currency (${parentInvestment.currency_code}).`;
        console.error(msg);
        return { data: null, error: { message: msg, details: '', hint: '', code: 'VALIDATION_ERROR' } as PostgrestError };
    }

    const payload: InvestmentTransactionInsert & { total_amount_native: number } = {
      ...transactionData, // Includes investment_id, user_id, currency_code, transaction_type, date, quantity, price_per_unit_native
      account_id: transactionData.account_id || null,
      total_amount_native: transactionData.quantity * transactionData.price_per_unit_native, // Calculate total_amount_native
      fees_native: transactionData.fees_native || null,
      notes: transactionData.notes || null,
    };
    // DB trigger `trg_investment_tx_calc_reporting_currency` handles reporting fields.
    // DB trigger `update_investment_after_transaction` updates parent investment.
    // DB trigger `update_account_balance` updates linked cash account.

    const { data, error } = await supabase
      .from('investment_transactions')
      .insert(payload)
      .select(INVESTMENT_TRANSACTION_SELECT_QUERY_MULTI_CURRENCY)
      .single();

    if (error) {
      console.error('Error adding investment transaction (investmentService):', error.message, 'Payload:', payload);
    }
    return { data, error };
  } catch (e: any) {
    console.error('Unexpected error adding investment transaction (investmentService):', e.message);
    return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

// InvestmentTransactionUpdate: currency_code fixed. Native amounts can change.
export type InvestmentTransactionUpdate = Partial<Omit<InvestmentTransactionInsert, 'user_id' | 'investment_id' | 'currency_code'>>;


export async function updateInvestmentTransaction(
  supabase: SupabaseClient,
  transactionId: string,
  updates: InvestmentTransactionUpdate // Use refined type
): Promise<{ data: InvestmentTransaction | null; error: PostgrestError | null }> {
  try {
    // If quantity or price_per_unit_native changes, total_amount_native needs recalculation.
    // Reporting fields will be updated by DB trigger.
    const updatePayload: InvestmentTransactionUpdate & { total_amount_native?: number } = { ...updates };

    if (updates.quantity !== undefined || updates.price_per_unit_native !== undefined) {
        const { data: currentTx, error: fetchError } = await supabase
            .from('investment_transactions')
            .select('quantity, price_per_unit_native')
            .eq('id', transactionId)
            .single();

        if (fetchError || !currentTx) {
            console.error(`Failed to fetch current transaction ${transactionId} for amount recalculation:`, fetchError?.message);
            return { data: null, error: fetchError || { message: 'Transaction not found for update', details: '', hint: '', code: '404' } as PostgrestError };
        }
        const newQuantity = updates.quantity ?? currentTx.quantity;
        const newPriceNative = updates.price_per_unit_native ?? currentTx.price_per_unit_native;
        updatePayload.total_amount_native = newQuantity * newPriceNative;
    }
    if ('account_id' in updates && updates.account_id === undefined) { // Allow unsetting
        updatePayload.account_id = null;
    }

    const { data, error } = await supabase
      .from('investment_transactions')
      .update(updatePayload)
      .eq('id', transactionId)
      .select(INVESTMENT_TRANSACTION_SELECT_QUERY_MULTI_CURRENCY)
      .single();

    if (error) {
      console.error(`Error updating investment transaction ${transactionId} (investmentService):`, error.message, 'Payload:', updatePayload);
    }
    return { data, error };
  } catch (e: any) {
    console.error(`Unexpected error updating investment transaction ${transactionId} (investmentService):`, e.message);
    return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

export async function deleteInvestmentTransaction(
  supabase: SupabaseClient,
  transactionId: string
): Promise<{ error: PostgrestError | null }> {
  try {
    // DB triggers `update_investment_after_transaction` and `update_account_balance`
    // will handle reverting effects on parent investment and cash account.
    const { error } = await supabase
      .from('investment_transactions')
      .delete()
      .eq('id', transactionId);

    if (error) {
      console.error(`Error deleting investment transaction ${transactionId} (investmentService):`, error.message);
    }
    return { error };
  } catch (e: any) {
    console.error(`Unexpected error deleting investment transaction ${transactionId} (investmentService):`, e.message);
    return {  error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}
