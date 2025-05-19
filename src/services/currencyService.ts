/* eslint-disable @typescript-eslint/no-unused-vars */
// src/services/currencyService.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import type { Currency } from '@/types'; // Assuming ExchangeRate type for Supabase RPC
import { COMMON_CURRENCIES_FOR_TYPING, BASE_REPORTING_CURRENCY, CurrencyCode } from '@/lib/constants';

/**
 * Fetches all currencies, optionally filtering by active status.
 */
export async function getCurrencies(
  supabase: SupabaseClient,
  activeOnly: boolean = true
): Promise<{ data: Currency[] | null; error: PostgrestError | null }> {
  try {
    let query = supabase.from('currencies').select('*');
    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    query = query.order('name', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching currencies:', error.message);
    }
    return Promise.resolve({ data, error });
  } catch (e: any) {
    console.error('Unexpected error fetching currencies:', e.message);
    return Promise.resolve({ data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError });
  }
}

/**
 * Fetches a single currency by its code.
 */
export async function getCurrency(
  supabase: SupabaseClient,
  code: CurrencyCode
): Promise<{ data: Currency | null; error: PostgrestError | null }> {
  try {
    const { data, error } = await supabase
      .from('currencies')
      .select('*')
      .eq('code', code)
      .maybeSingle(); // Use maybeSingle if it's possible the currency might not exist

    if (error && error.code !== 'PGRST116') { // PGRST116: 0 rows (not an error for maybeSingle)
      console.error(`Error fetching currency ${code}:`, error.message);
    }
    return Promise.resolve({ data, error: error?.code === 'PGRST116' ? null : error });
  } catch (e: any) {
    console.error(`Unexpected error fetching currency ${code}:`, e.message);
    return Promise.resolve({ data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError });
  }
}

/**
 * Calls the Supabase RPC function to get an exchange rate.
 * @param date The date for which to find the rate (YYYY-MM-DD string or Date object).
 * @param sourceCurrency The source currency code.
 * @param targetCurrency The target currency code.
 * @returns The exchange rate, or null if not found or an error occurs.
 */
export async function getExchangeRate(
  supabase: SupabaseClient,
  date: Date | string,
  sourceCurrency: CurrencyCode,
  targetCurrency: CurrencyCode
): Promise<{ data: number | null; error: PostgrestError | null }> {
  try {
    const dateString = typeof date === 'string' ? date : date.toISOString().split('T')[0];

    // If source and target are the same, rate is 1, no need to call RPC
    if (sourceCurrency === targetCurrency) {
        return Promise.resolve({ data: 1.0, error: null });
    }

    const { data, error } = await supabase.rpc('get_exchange_rate', {
      p_date: dateString,
      p_source_currency_code: sourceCurrency,
      p_target_currency_code: targetCurrency,
    });

    if (error) {
      console.error(
        `Error fetching exchange rate from ${sourceCurrency} to ${targetCurrency} for date ${dateString}:`,
        error.message
      );
      return Promise.resolve({ data: null, error });
    }
    
    // The RPC returns NUMERIC which might come as string or number from JS client.
    // Ensure it's a number or null.
    const rate = typeof data === 'number' ? data : (typeof data === 'string' ? parseFloat(data) : null);

    if (rate === null || isNaN(rate)) {
        // This case might indicate the RPC returned NULL because no rate was found.
        // The RPC itself raises a WARNING if no rate was found.
        // We can treat this as "data is null" rather than a hard error here,
        // as the RPC handles the "not found" case gracefully by returning NULL.
        console.warn(`Exchange rate RPC returned null or unparsable value for ${sourceCurrency} to ${targetCurrency} on ${dateString}. This might mean no rate was found.`);
        return Promise.resolve({ data: null, error: null }); // Or pass through a specific error if RPC indicated one beyond "not found"
    }

    return Promise.resolve({ data: rate, error: null });
  } catch (e: any) {
    console.error(
      `Unexpected error calling get_exchange_rate RPC for ${sourceCurrency} to ${targetCurrency} on ${date}:`,
      e.message
    );
    return Promise.resolve({ data: null, error: { message: e.message, details: '', hint: '', code: 'RPC_CLIENT_ERROR' } as PostgrestError });
  }
}

/**
 * Fetches multiple exchange rates relative to a base currency, typically USD.
 * This is useful for client-side conversions to user's preferred currency.
 * @param supabase Supabase client
 * @param date Date for the rates
 * @param baseCurrency Base currency (defaults to BASE_REPORTING_CURRENCY)
 * @param targetCurrencies Array of target currency codes
 */
export async function getMultipleExchangeRates(
  supabase: SupabaseClient,
  date: Date | string,
  targetCurrencies: CurrencyCode[],
  baseCurrency: CurrencyCode = BASE_REPORTING_CURRENCY
): Promise<{ data: Record<CurrencyCode, number> | null; error: PostgrestError | null }> {
  // Use a mapped type for safer construction internally
  const resultRates: { [key in CurrencyCode]?: number } = {};
  let overallError: PostgrestError | null = null;
  const dateString = typeof date === 'string' ? date : date.toISOString().split('T')[0];

  for (const target of targetCurrencies) {
    if (target === baseCurrency) {
      resultRates[target] = 1.0;
      continue;
    }
    const { data: rate, error } = await getExchangeRate(supabase, dateString, baseCurrency, target);
    if (error) {
      if (!overallError) overallError = error;
      console.error(`Failed to get rate for ${baseCurrency} -> ${target} on ${dateString}: ${error.message}`);
      // Continue to fetch other rates
    }
    if (rate !== null) { // rate is number | null
      resultRates[target] = rate;
    } else {
      // Rate not found for this pair. getExchangeRate already warns.
      // Do not add to resultRates if rate is null, so it only contains actual numbers.
      console.warn(`Rate not found for ${baseCurrency} -> ${target} on ${dateString}. It will be omitted from results.`);
    }
  }

  // If there was an error AND NO rates were successfully fetched, return null for data.
  if (Object.keys(resultRates).length === 0 && overallError) {
    return Promise.resolve({ data: null, error: overallError });
  }
  
  // If there are some rates, return them, even if there were some errors for other rates.
  // The object `resultRates` at this point only contains keys where values are numbers.
  // So, casting to Record<CurrencyCode, number> is safe.
  return Promise.resolve({ data: resultRates as Record<CurrencyCode, number>, error: overallError });
}

// Potentially, a function to trigger the daily fetch if it were an Edge Function,
// but since it's pg_cron + PL/pgSQL, it's managed by the DB.
// async function triggerDailyExchangeRateFetch(supabase: SupabaseClient): Promise<void> { ... }
