// src/app/(app)/dashboard/page.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerClientWrapper } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import {
  startOfMonth,
  endOfMonth,
  format,
  parseISO,
  isValid,
  startOfToday,
} from 'date-fns';

import { getIncomesByUserId } from '@/services/incomeService';
import { getExpensesByUserId } from '@/services/expenseService';
import { getAccountsByUserId } from '@/services/accountService';
import { getInvestmentsByUserId } from '@/services/investmentService';
import { getDebtsByUserId } from '@/services/debtService';
import { getBudgetsByUserId } from '@/services/budgetService';
import { getCurrentUserProfile } from '@/services/userService'; // Import profile service
import { getCurrencies, getMultipleExchangeRates } from '@/services/currencyService'; // Import currency service

import DashboardClientContent from '@/components/dashboard/DashboardClientContent';
import type { Income, Expense, Account, Investment, Debt, Budget, Profile } from '@/types';
import { BASE_REPORTING_CURRENCY, DEFAULT_CURRENCY, CurrencyCode } from '@/lib/constants';
import { AllCurrenciesData, ExchangeRatesMap } from '@/lib/utils';


export const dynamic = 'force-dynamic';
// console.log('DashboardPage.tsx: Script loaded (top level)'); // Keep for debugging if needed

interface DashboardPageServerProps {
  searchParams: { [key: string]: string | string[] | undefined } | Promise<{ [key: string]: string | string[] | undefined }>;
}

// Renamed for clarity: these aggregates are in BASE_REPORTING_CURRENCY (USD)
export interface DashboardAggregatesUSD {
  totalIncomeUSD: number;
  totalSpendingUSD: number;
  netSavingsUSD: number;
  netWorthUSD: number;
}

export interface DashboardRawData {
  incomes: Income[];
  expenses: Expense[];
  investments: Investment[];
  currentMonthBudgets: Budget[];
  currentMonthExpenses: Expense[];
  allAccounts: Account[];
  allDebts: Debt[];
}

export interface DashboardInitialProps extends DashboardAggregatesUSD, DashboardRawData {
  userProfile: Profile;
  allCurrenciesData: AllCurrenciesData;
  currentExchangeRates: ExchangeRatesMap; // Rates from USD to target currencies
  baseReportingCurrency: CurrencyCode;
}


export default async function DashboardPage({ searchParams: searchParamsProp }: DashboardPageServerProps) {
  const invocationTimestamp = new Date().toISOString();
  // console.log(`[${invocationTimestamp}] DashboardPage: Function invoked.`); // Keep for debugging

  const resolvedSearchParams = await searchParamsProp;
  const fromParam = typeof resolvedSearchParams.from === 'string' ? resolvedSearchParams.from : undefined;
  const toParam = typeof resolvedSearchParams.to === 'string' ? resolvedSearchParams.to : undefined;

  const supabase = await createServerClientWrapper();

  const {
    data: { user },
    error: getUserError,
  } = await supabase.auth.getUser();

  if (getUserError || !user) {
    console.error(`[${invocationTimestamp}] DashboardPage: User error or no user. Redirecting to login. Error: ${getUserError?.message}`);
    redirect('/auth/login');
    return null; // Satisfy TypeScript, redirect will occur
  }
  
  // console.log(`[${invocationTimestamp}] DashboardPage: User authenticated: ${user.email}`);
  
  const today = new Date();
  let fromDate: Date = startOfMonth(today); 
  let toDate: Date = endOfMonth(today);   

  if (fromParam) {
    const parsedFrom = parseISO(fromParam);
    if (isValid(parsedFrom)) fromDate = parsedFrom;
  }
  if (toParam) {
    const parsedTo = parseISO(toParam);
    if (isValid(parsedTo)) toDate = parsedTo;
  }

  const dateRangeForFetch = {
    from: format(fromDate, 'yyyy-MM-dd'),
    to: format(toDate, 'yyyy-MM-dd'),
  };

  const initialClientDateRange = {
    from: format(fromDate, 'yyyy-MM-dd'),
    to: format(toDate, 'yyyy-MM-dd'),
  };

  let fetchDataError: string | null = null;
  let initialProps: DashboardInitialProps | null = null;

  try {
    // --- Fetch core financial data ---
    const [
      profileRes,
      currenciesRes,
      incomeRes, 
      expenseRes, 
      accountRes, 
      investmentRes, 
      debtRes,
      currentMonthBudgetRes, 
      currentMonthExpenseRes,
    ] = await Promise.all([
      getCurrentUserProfile(supabase, user.id),
      getCurrencies(supabase, true), // Fetch active currencies
      getIncomesByUserId(supabase, user.id, dateRangeForFetch),
      getExpensesByUserId(supabase, user.id, dateRangeForFetch),
      getAccountsByUserId(supabase, user.id),
      getInvestmentsByUserId(supabase, user.id),
      getDebtsByUserId(supabase, user.id),
      getBudgetsByUserId(supabase, user.id, format(startOfMonth(today), 'yyyy-MM-dd')),
      getExpensesByUserId(supabase, user.id, {
        from: format(startOfMonth(today), 'yyyy-MM-dd'),
        to: format(endOfMonth(today), 'yyyy-MM-dd'),
      }),
    ]);

    // --- Error Handling & Data Preparation ---
    if (profileRes.error || !profileRes.data) throw new Error(`Failed to fetch profile: ${profileRes.error?.message}`);
    const userProfile = profileRes.data;
    userProfile.preferred_currency = userProfile.preferred_currency || DEFAULT_CURRENCY;


    if (currenciesRes.error || !currenciesRes.data) throw new Error(`Failed to fetch currencies: ${currenciesRes.error?.message}`);
    const allCurrenciesList = currenciesRes.data;
    const allCurrenciesData: AllCurrenciesData = allCurrenciesList.reduce((acc, currency) => {
        acc[currency.code] = currency;
        return acc;
    }, {} as AllCurrenciesData);

    // Fetch exchange rates for all active currencies AND user's preferred (if not already active)
    const targetRateCurrencies = [...new Set([...allCurrenciesList.map(c => c.code), userProfile.preferred_currency])];
    const ratesRes = await getMultipleExchangeRates(supabase, format(startOfToday(), 'yyyy-MM-dd'), targetRateCurrencies, BASE_REPORTING_CURRENCY);
    if (ratesRes.error) console.warn(`[${invocationTimestamp}] DashboardPage: Error fetching some exchange rates: ${ratesRes.error.message}. Proceeding with available rates.`);
    const currentExchangeRates: ExchangeRatesMap = ratesRes.data || Object.fromEntries(targetRateCurrencies.map(code => [code, 1])) as ExchangeRatesMap;


    // Consolidate financial data fetch errors
    const financialDataErrors = [
        incomeRes.error, expenseRes.error, accountRes.error, investmentRes.error, 
        debtRes.error, currentMonthBudgetRes.error, currentMonthExpenseRes.error
    ].filter(Boolean);

    if (financialDataErrors.length > 0) {
        fetchDataError = financialDataErrors.map(e => e!.message).join('; ');
        console.error(`[${invocationTimestamp}] DashboardPage: Financial data fetch errors: ${fetchDataError}`);
        // Potentially throw or handle gracefully depending on severity
    }

    const incomes: Income[] = incomeRes.data || [];
    const expenses: Expense[] = expenseRes.data || []; 
    const allAccounts: Account[] = accountRes.data || [];
    const allInvestments: Investment[] = investmentRes.data || [];
    const allDebts: Debt[] = debtRes.data || [];
    const currentMonthBudgets: Budget[] = currentMonthBudgetRes.data || [];
    const currentMonthExpenses: Expense[] = currentMonthExpenseRes.data || [];

    // --- Calculate Aggregates (in USD using _reporting_currency fields) ---
    const totalIncomeUSD = incomes.reduce((sum, item) => sum + item.amount_reporting_currency, 0);
    const totalSpendingUSD = expenses.reduce((sum, item) => sum + item.amount_reporting_currency, 0);
    const netSavingsUSD = totalIncomeUSD - totalSpendingUSD;
    
    const totalAccountBalanceUSD = allAccounts.reduce((sum, acc) => sum + acc.balance_reporting_currency, 0);
    const totalInvestmentValueUSD = allInvestments.reduce((sum, inv) => sum + (inv.total_current_value_reporting_currency || 0), 0);
    const totalOutstandingDebtUSD = allDebts
      .filter(d => !d.is_paid)
      .reduce((sum, d) => sum + d.current_balance_reporting_currency, 0);
    const netWorthUSD = totalAccountBalanceUSD + totalInvestmentValueUSD - totalOutstandingDebtUSD;

    initialProps = {
      totalIncomeUSD, totalSpendingUSD, netSavingsUSD, netWorthUSD, 
      incomes, expenses, 
      investments: allInvestments, currentMonthBudgets, currentMonthExpenses, 
      allAccounts, allDebts,
      userProfile,
      allCurrenciesData,
      currentExchangeRates,
      baseReportingCurrency: BASE_REPORTING_CURRENCY,
    };
    // console.log(`[${invocationTimestamp}] DashboardPage: dashboardData processed successfully.`);

  } catch (error: any) {
    console.error(`[${invocationTimestamp}] DashboardPage: Critical error in data fetch/processing:`, error);
    fetchDataError = `Unexpected error: ${error.message || "Unknown"}.`;
    // Re-check user auth before potential redirect or error display
    const { data: { user: refetchOnError } } = await supabase.auth.getUser();
    if (!refetchOnError) { redirect('/auth/login'); return null; }
  }

  if (fetchDataError && !initialProps) {
    console.warn(`[${invocationTimestamp}] DashboardPage: Displaying error UI: ${fetchDataError}`);
    return ( <div className="container p-4"><h1 className="text-2xl text-red-600">Error Loading Dashboard</h1><p>{fetchDataError}</p></div> );
  }

  if (!initialProps) {
    // This case should ideally be covered by the catch block or specific data fetch errors
    console.warn(`[${invocationTimestamp}] DashboardPage: initialProps is null (no specific error). This indicates a logic flaw.`);
    return ( <div className="container p-4"><h1 className="text-2xl text-red-600">Error Loading Dashboard</h1><p>Failed to prepare dashboard data.</p></div> );
  }

  // console.log(`[${invocationTimestamp}] DashboardPage: Rendering ClientContent. InitialDateRange:`, JSON.stringify(initialClientDateRange));
  return (
    <DashboardClientContent
      initialProps={initialProps} 
      initialDateRange={initialClientDateRange}
      // userId={user.id} // userId is inside initialProps.userProfile.id
    />
  );
}
