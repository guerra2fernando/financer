/* eslint-disable @typescript-eslint/no-unused-vars */
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
import { getCurrentUserProfile } from '@/services/userService';
import { getCurrencies, getMultipleExchangeRates } from '@/services/currencyService';

import DashboardClientContent from '@/components/dashboard/DashboardClientContent';
import type { Income, Expense, Account, Investment, Debt, Budget, Profile } from '@/types';
import { BASE_REPORTING_CURRENCY, DEFAULT_CURRENCY, CurrencyCode } from '@/lib/constants';
import { AllCurrenciesData, ExchangeRatesMap } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// Type for the resolved params/searchParams object
type ResolvedRouteInfo = { [key: string]: string | string[] | undefined };

// Adjusted PageProps to match Next.js 15's expected structure
// where params/searchParams can be undefined or a Promise.
interface PageProps {
  params?: Promise<ResolvedRouteInfo>;
  searchParams?: Promise<ResolvedRouteInfo>;
}

// Your specific interfaces remain the same
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
  currentExchangeRates: ExchangeRatesMap;
  baseReportingCurrency: CurrencyCode;
}

export default async function DashboardPage({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: PageProps) {
  const invocationTimestamp = new Date().toISOString();

  // Await the promises if they exist, otherwise default to an empty object.
  // For a non-dynamic route like /dashboard, `params` will resolve to an empty object.
  const params: ResolvedRouteInfo = paramsPromise ? await paramsPromise : {};
  const searchParams: ResolvedRouteInfo = searchParamsPromise ? await searchParamsPromise : {};

  // Now use `searchParams` (and `params` if it were a dynamic route) as regular objects
  const fromParam = typeof searchParams.from === 'string' ? searchParams.from : undefined;
  const toParam = typeof searchParams.to === 'string' ? searchParams.to : undefined;

  const supabase = await createServerClientWrapper();

  const {
    data: { user },
    error: getUserError,
  } = await supabase.auth.getUser();

  if (getUserError || !user) {
    console.error(`[${invocationTimestamp}] DashboardPage: User error or no user. Redirecting to login. Error: ${getUserError?.message}`);
    redirect('/auth/login');
    return null;
  }
  
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
      getCurrencies(supabase, true),
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

    if (profileRes.error || !profileRes.data) throw new Error(`Failed to fetch profile: ${profileRes.error?.message}`);
    const userProfile = profileRes.data;
    userProfile.preferred_currency = userProfile.preferred_currency || DEFAULT_CURRENCY;

    if (currenciesRes.error || !currenciesRes.data) throw new Error(`Failed to fetch currencies: ${currenciesRes.error?.message}`);
    const allCurrenciesList = currenciesRes.data;
    const allCurrenciesData: AllCurrenciesData = allCurrenciesList.reduce((acc, currency) => {
        acc[currency.code] = currency;
        return acc;
    }, {} as AllCurrenciesData);

    const targetRateCurrencies = [...new Set([...allCurrenciesList.map(c => c.code), userProfile.preferred_currency])];
    const ratesRes = await getMultipleExchangeRates(supabase, format(startOfToday(), 'yyyy-MM-dd'), targetRateCurrencies, BASE_REPORTING_CURRENCY);
    if (ratesRes.error) console.warn(`[${invocationTimestamp}] DashboardPage: Error fetching some exchange rates: ${ratesRes.error.message}. Proceeding with available rates.`);
    const currentExchangeRates: ExchangeRatesMap = ratesRes.data || Object.fromEntries(targetRateCurrencies.map(code => [code, 1])) as ExchangeRatesMap;

    const financialDataErrors = [
        incomeRes.error, expenseRes.error, accountRes.error, investmentRes.error, 
        debtRes.error, currentMonthBudgetRes.error, currentMonthExpenseRes.error
    ].filter(Boolean);

    if (financialDataErrors.length > 0) {
        fetchDataError = financialDataErrors.map(e => e!.message).join('; ');
        console.error(`[${invocationTimestamp}] DashboardPage: Financial data fetch errors: ${fetchDataError}`);
    }

    const incomes: Income[] = incomeRes.data || [];
    const expenses: Expense[] = expenseRes.data || []; 
    const allAccounts: Account[] = accountRes.data || [];
    const allInvestments: Investment[] = investmentRes.data || [];
    const allDebts: Debt[] = debtRes.data || [];
    const currentMonthBudgets: Budget[] = currentMonthBudgetRes.data || [];
    const currentMonthExpenses: Expense[] = currentMonthExpenseRes.data || [];

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

  } catch (error: any) {
    console.error(`[${invocationTimestamp}] DashboardPage: Critical error in data fetch/processing:`, error);
    fetchDataError = `Unexpected error: ${error.message || "Unknown"}.`;
    const { data: { user: refetchOnError } } = await supabase.auth.getUser();
    if (!refetchOnError) { redirect('/auth/login'); return null; }
  }

  if (fetchDataError && !initialProps) {
    console.warn(`[${invocationTimestamp}] DashboardPage: Displaying error UI: ${fetchDataError}`);
    return ( <div className="container p-4"><h1 className="text-2xl text-red-600">Error Loading Dashboard</h1><p>{fetchDataError}</p></div> );
  }

  if (!initialProps) {
    console.warn(`[${invocationTimestamp}] DashboardPage: initialProps is null (no specific error). This indicates a logic flaw.`);
    return ( <div className="container p-4"><h1 className="text-2xl text-red-600">Error Loading Dashboard</h1><p>Failed to prepare dashboard data.</p></div> );
  }

  return (
    <DashboardClientContent
      initialProps={initialProps} 
      initialDateRange={initialClientDateRange}
    />
  );
}