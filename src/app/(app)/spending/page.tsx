/* eslint-disable @typescript-eslint/no-unused-vars */
// src/app/(app)/spending/page.tsx
import { createServerClientWrapper } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { format, startOfMonth, endOfDay } from 'date-fns';
import SpendingPageClientContent from '@/components/spending/SpendingPageClientContent';

import { getExpensesByUserId } from '@/services/expenseService';
import { getDebtsByUserId } from '@/services/debtService';
import { getBudgetsByUserId } from '@/services/budgetService';
import { getCurrentUserProfile } from '@/services/userService'; // To get preferred_currency
import { getCurrencies } from '@/services/currencyService'; // To get all currency data
import { getMultipleExchangeRates } from '@/services/currencyService'; // To get exchange rates

import { BASE_REPORTING_CURRENCY, DEFAULT_CURRENCY, CurrencyCode } from '@/lib/constants';
import type { AllCurrenciesData, ExchangeRatesMap } from '@/lib/utils';
import type { Currency, Profile } from '@/types';

export const dynamic = 'force-dynamic';

export default async function SpendingPage() {
  const supabase = await createServerClientWrapper();
  const {
    data: { user },
    error: getUserError,
  } = await supabase.auth.getUser();

  if (getUserError || !user) {
    console.error("SpendingPage: Error fetching user or user not found:", getUserError?.message);
    redirect('/auth/login');
    return;
  }

  const currentPeriodStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const today = format(endOfDay(new Date()), 'yyyy-MM-dd'); // For exchange rates

  // Fetch user profile, all currencies, and exchange rates in parallel with other data
  const [
    expenseResult,
    debtResult,
    budgetResult,
    profileResult,
    allCurrenciesResult,
  ] = await Promise.all([
    getExpensesByUserId(supabase, user.id),
    getDebtsByUserId(supabase, user.id),
    getBudgetsByUserId(supabase, user.id, currentPeriodStart),
    getCurrentUserProfile(supabase, user.id),
    getCurrencies(supabase, true), // Fetch all active currencies
  ]);

  const { data: initialExpenses, error: expensesError } = expenseResult;
  const { data: initialDebts, error: debtsError } = debtResult;
  const { data: initialBudgets, error: budgetsError } = budgetResult;
  const { data: userProfile, error: profileError } = profileResult;
  const { data: currenciesArray, error: currenciesError } = allCurrenciesResult;

  let criticalError = false;
  const errorMessages: string[] = [];

  if (expensesError) { errorMessages.push(`Expenses: ${expensesError.message}`); criticalError = true; }
  if (debtsError) { errorMessages.push(`Debts: ${debtsError.message}`); criticalError = true; }
  if (budgetsError) { errorMessages.push(`Budgets: ${budgetsError.message}`); } // Budgets might be optional
  if (profileError || !userProfile) { errorMessages.push(`User Profile: ${profileError?.message || 'Not found'}`); criticalError = true; }
  if (currenciesError || !currenciesArray || currenciesArray.length === 0) { errorMessages.push(`Currencies Data: ${currenciesError?.message || 'Not found/empty'}`); criticalError = true; }

  // Prepare currency data
  let userPreferredCurrency: CurrencyCode = DEFAULT_CURRENCY;
  // Initialize with a type assertion to satisfy TypeScript for Record<CurrencyCode, ...>
  let allCurrenciesData: AllCurrenciesData = {} as AllCurrenciesData;
  let currentExchangeRates: ExchangeRatesMap = {} as ExchangeRatesMap;


  if (userProfile) {
    userPreferredCurrency = userProfile.preferred_currency || DEFAULT_CURRENCY;
  }

  if (currenciesArray) {
    allCurrenciesData = currenciesArray.reduce((acc, currencyItem) => {
      acc[currencyItem.code] = currencyItem;
      return acc;
    }, {} as AllCurrenciesData); // Initialize reduce accumulator with assertion too

    const targetCurrencyCodes = currenciesArray.map(c => c.code).filter(code => code !== BASE_REPORTING_CURRENCY);
    if (targetCurrencyCodes.length > 0) {
        const { data: rates, error: ratesError } = await getMultipleExchangeRates(supabase, today, targetCurrencyCodes, BASE_REPORTING_CURRENCY);
        if (ratesError) {
            errorMessages.push(`Exchange Rates: ${ratesError.message}`);
            // Non-critical, formatCurrency will handle missing rates with warnings
        }
        if (rates) {
            currentExchangeRates = rates; // This assignment is fine as `rates` will be Record<CurrencyCode, number>
        }
    }
    // Ensure base reporting currency has a rate of 1 to itself if not fetched or if it was filtered out
    if (currentExchangeRates[BASE_REPORTING_CURRENCY] === undefined) {
        currentExchangeRates[BASE_REPORTING_CURRENCY] = 1.0;
    }
  }


  if (criticalError) {
    console.error("Critical error fetching spending page data:", errorMessages.join('; '));
    return (
      <div className="container mx-auto p-4 md:p-6 lg:p-8">
        <h1 className="text-2xl font-semibold mb-4">Spending Overview</h1>
        <p className="text-destructive">Could not load essential spending data. Please try again later.</p>
        {process.env.NODE_ENV === 'development' && (
          <pre className="mt-2 text-xs bg-red-100 p-2 rounded whitespace-pre-wrap">
            Errors: {errorMessages.join('\n')}
          </pre>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <SpendingPageClientContent
        initialExpenses={initialExpenses || []}
        initialDebts={initialDebts || []}
        initialBudgets={initialBudgets || []}
        userId={user.id}
        userProfile={userProfile as Profile} // Already checked for null
        userPreferredCurrency={userPreferredCurrency}
        baseReportingCurrency={BASE_REPORTING_CURRENCY}
        allCurrenciesData={allCurrenciesData}
        currentExchangeRates={currentExchangeRates}
      />
    </div>
  );
}