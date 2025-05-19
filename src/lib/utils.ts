// src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Currency } from '@/types'; // Assuming CurrencyCode is also in types or from constants
import { BASE_REPORTING_CURRENCY, CurrencyCode } from '@/lib/constants';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Color palette for charts
const CHART_COLORS = [
  '#3b82f6', // blue-500
  '#ef4444', // red-500
  '#22c55e', // green-500
  '#eab308', // yellow-500
  '#8b5cf6', // violet-500
  '#f97316', // orange-500
  '#14b8a6', // teal-500
  '#ec4899', // pink-500
  '#64748b', // slate-500
  '#06b6d4', // cyan-500
];

export function getChartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

// These types are used by formatCurrency and are now imported by src/types/index.ts
// for CurrencyContextProps.
export type AllCurrenciesData = Record<CurrencyCode, Currency | undefined>;
export type ExchangeRatesMap = Record<CurrencyCode, number | undefined>;

/**
 * Formats a numeric amount into a currency string, handling conversions.
 *
 * @param amount The numeric amount to format.
 * @param sourceCurrencyCode The currency code of the input amount.
 * @param targetCurrencyCode The currency code to display the amount in.
 * @param allCurrenciesData A record of all available currency details, keyed by currency code.
 * @param exchangeRatesMap A map of exchange rates from BASE_REPORTING_CURRENCY (USD) to other currencies.
 * @param fallbackDisplay String to display if conversion or formatting fails.
 * @returns The formatted currency string or a fallback string.
 */
export function formatCurrency(
  amount: number | null | undefined,
  sourceCurrencyCode: CurrencyCode,
  targetCurrencyCode: CurrencyCode,
  allCurrenciesData: AllCurrenciesData, // This is Record<CurrencyCode, Currency | undefined>
  exchangeRatesMap: ExchangeRatesMap | undefined, // This is Record<CurrencyCode, number | undefined>
  fallbackDisplay: string = 'N/A'
): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return fallbackDisplay;
  }

  // Handle undefined exchangeRatesMap gracefully
  const rates: ExchangeRatesMap = exchangeRatesMap || {} as ExchangeRatesMap;

  const targetCurrencyInfo = allCurrenciesData[targetCurrencyCode];
    
  if (!targetCurrencyInfo) {
    console.warn(`formatCurrency: Target currency info for ${targetCurrencyCode} not found.`);
    return `${amount?.toFixed(2)} ${targetCurrencyCode} (Info?)`; // Basic fallback
  }

  let amountInTargetCurrency = amount;

  if (sourceCurrencyCode !== targetCurrencyCode) {
    // Step 1: Convert source amount to BASE_REPORTING_CURRENCY (USD) if it's not already USD
    let amountInBaseCurrency: number;
    if (sourceCurrencyCode === BASE_REPORTING_CURRENCY) {
      amountInBaseCurrency = amount;
    } else {
      const rateFromUsdToSource = rates[sourceCurrencyCode];
      if (rateFromUsdToSource === undefined || rateFromUsdToSource === 0) {
        console.warn(`formatCurrency: Missing or zero exchange rate ${BASE_REPORTING_CURRENCY} -> ${sourceCurrencyCode}. Cannot convert ${sourceCurrencyCode} to ${BASE_REPORTING_CURRENCY}.`);
        return fallbackDisplay;
      }
      amountInBaseCurrency = amount / rateFromUsdToSource;
    }

    // Step 2: Convert amount from BASE_REPORTING_CURRENCY (USD) to targetCurrencyCode
    if (targetCurrencyCode === BASE_REPORTING_CURRENCY) {
      amountInTargetCurrency = amountInBaseCurrency;
    } else {
      const rateFromUsdToTarget = rates[targetCurrencyCode];
      if (rateFromUsdToTarget === undefined) {
        console.warn(`formatCurrency: Missing exchange rate ${BASE_REPORTING_CURRENCY} -> ${targetCurrencyCode}. Cannot convert ${BASE_REPORTING_CURRENCY} to ${targetCurrencyCode}.`);
        return fallbackDisplay;
      }
      amountInTargetCurrency = amountInBaseCurrency * rateFromUsdToTarget;
    }
  }
  
  if (isNaN(amountInTargetCurrency)) {
      console.warn(`formatCurrency: Resulting amountInTargetCurrency is NaN. Amount: ${amount}, Source: ${sourceCurrencyCode}, Target: ${targetCurrencyCode}`);
      return fallbackDisplay;
  }

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: targetCurrencyCode,
      minimumFractionDigits: targetCurrencyInfo.decimal_digits,
      maximumFractionDigits: targetCurrencyInfo.decimal_digits,
    }).format(amountInTargetCurrency);
  } catch (error) {
    console.error(`formatCurrency: Intl.NumberFormat error for ${targetCurrencyCode}:`, error);
    return `${amountInTargetCurrency.toFixed(targetCurrencyInfo.decimal_digits)} ${targetCurrencyInfo.symbol || targetCurrencyCode}`;
  }
}
