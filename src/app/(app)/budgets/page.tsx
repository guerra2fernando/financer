/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/(app)/budgets/page.tsx
'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { redirect } from 'next/navigation';
import BudgetList from '@/components/budgets/BudgetList'; 
import { getBudgetsByUserId } from '@/services/budgetService';
import { getExpensesByUserId } from '@/services/expenseService';
import { getIncomesByUserId } from '@/services/incomeService';
import { getCurrencies, getMultipleExchangeRates, getExchangeRate } from '@/services/currencyService'; 
import { getCurrentUserProfile } from '@/services/userService'; 
import { createClient } from '@/lib/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import BudgetAISetupForm from '@/components/ai/BudgetAISetupForm'; 
import BudgetAIRecommendationsDisplay from '@/components/ai/BudgetAIRecommendationsDisplay'; 
import BudgetCategoryChart from '@/components/budgets/BudgetCategoryChart'; 
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
    AIBudgetRecommendationResponse, Budget, Expense, Income, 
    SupabaseAuthUser, Currency, CurrencyContextProps, BudgetListItemProcessed 
} from '@/types';
import { Sparkles, ListChecks, DollarSign, TrendingDown, TrendingUp, PieChart as PieChartIcon, RefreshCw, Info, BadgeDollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, endOfMonth, isWithinInterval, startOfMonth } from 'date-fns';
import { formatCurrency, cn } from '@/lib/utils'; 
import { BASE_REPORTING_CURRENCY, DEFAULT_CURRENCY, CurrencyCode } from '@/lib/constants';

// Helper function for budget calculations (remains the same as your provided version)
const calculateBudgetsWithActuals = (
    budgets: Budget[],
    expenses: Expense[],
    targetCurrencyCode: CurrencyCode, // This param is not strictly used if formatting is done by formatCurrency utility
    allCurrencies: Currency[], // This is Currency[]
    exchangeRates: Record<CurrencyCode, number> // This is Record<CurrencyCode, number>
): BudgetListItemProcessed[] => {
    if (!Array.isArray(budgets) || !Array.isArray(expenses)) return [];

    return budgets.map(budget => {
        let budgetPeriodStartDate, budgetPeriodEndDate;
        try {
            budgetPeriodStartDate = parseISO(budget.period_start_date);
            budgetPeriodEndDate = endOfMonth(budgetPeriodStartDate);
        } catch (e) {
            console.error("Invalid period_start_date for budget:", budget, e);
            return {
                ...budget,
                actualSpendingInReportingCurrency: 0,
                remainingAmountInReportingCurrency: budget.amount_limit_reporting_currency,
                progressPercent: 0
            };
        }

        const relevantExpenses = expenses.filter(expense => {
            try {
                const expenseDate = parseISO(expense.date);
                return expense.category.toLowerCase() === budget.category.toLowerCase() &&
                    isWithinInterval(expenseDate, { start: budgetPeriodStartDate, end: budgetPeriodEndDate });
            } catch (err) {
                console.warn("Invalid date for expense during budget calculation:", expense, err);
                return false;
            }
        });

        const actualSpendingInReportingCurrency = relevantExpenses.reduce((sum, exp) => sum + exp.amount_reporting_currency, 0);
        const remainingAmountInReportingCurrency = budget.amount_limit_reporting_currency - actualSpendingInReportingCurrency;
        let progressPercent = 0;
        if (budget.amount_limit_reporting_currency > 0) {
            progressPercent = (actualSpendingInReportingCurrency / budget.amount_limit_reporting_currency) * 100;
        } else if (actualSpendingInReportingCurrency > 0) {
            progressPercent = 100; 
        }

        return {
            ...budget,
            actualSpendingInReportingCurrency,
            remainingAmountInReportingCurrency,
            progressPercent: Math.min(100, Math.max(0, progressPercent)),
        };
    });
};


// BudgetsView component remains the same as your provided version
function BudgetsView({
    userId,
    initialBudgetsData,
    initialExpensesData,
    initialMonthIncomeInReportingCurrency, // USD
    currencyContext
}: {
    userId: string;
    initialBudgetsData: Budget[];
    initialExpensesData: Expense[];
    initialMonthIncomeInReportingCurrency: number;
    currencyContext: CurrencyContextProps;
}) {
    const [showAISetupDialog, setShowAISetupDialog] = useState(false);
    const [aiRecommendations, setAiRecommendations] = useState<AIBudgetRecommendationResponse | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'aiDisplay'>('list');

    const [currentMonthBudgets, setCurrentMonthBudgets] = useState<Budget[]>(initialBudgetsData);
    const [allUserExpenses, setAllUserExpenses] = useState<Expense[]>(initialExpensesData);
    const [currentMonthIncomeInReportingCurrency, setCurrentMonthIncomeInReportingCurrency] = useState<number>(initialMonthIncomeInReportingCurrency);
    const [isLoadingBudgets, setIsLoadingBudgets] = useState(false);

    const supabase = currencyContext.supabaseClient; 

    const budgetsWithActuals: BudgetListItemProcessed[] = useMemo(() => {
        // Convert the allCurrenciesData object back to an array for the calculateBudgetsWithActuals function
        const currenciesArray = Object.values(currencyContext.allCurrenciesData).filter(Boolean) as Currency[];

        const filteredExchangeRates = Object.fromEntries(
            Object.entries(currencyContext.currentExchangeRates)
                .filter(([_, rate]) => rate !== undefined)
                .map(([code, rate]) => [code, rate as number])
        ) as Record<CurrencyCode, number>;

        return calculateBudgetsWithActuals(
            currentMonthBudgets,
            allUserExpenses,
            currencyContext.userPreferredCurrency,
            currenciesArray, // Convert object to array
            filteredExchangeRates // This is Record<CurrencyCode, number>
        );
    }, [currentMonthBudgets, allUserExpenses, currencyContext]);

    const budgetSummary = useMemo(() => {
        const totalBudgetLimitInReportingCurrency = budgetsWithActuals.reduce((sum, b) => sum + b.amount_limit_reporting_currency, 0);
        const totalActualSpendingInReportingCurrency = budgetsWithActuals.reduce((sum, b) => sum + b.actualSpendingInReportingCurrency, 0);
        
        const incomeToConsiderInReportingCurrency = currentMonthIncomeInReportingCurrency > 0 ? currentMonthIncomeInReportingCurrency : totalBudgetLimitInReportingCurrency;
        const totalRemainingFromIncomeInReportingCurrency = incomeToConsiderInReportingCurrency - totalActualSpendingInReportingCurrency;
        const percentOfIncomeSpent = incomeToConsiderInReportingCurrency > 0 ? (totalActualSpendingInReportingCurrency / incomeToConsiderInReportingCurrency) * 100 : 0;

        return {
            totalBudgetLimitInReportingCurrency,
            totalActualSpendingInReportingCurrency,
            totalRemainingFromIncomeInReportingCurrency,
            percentOfIncomeSpent,
            actualIncomeForMonthInReportingCurrency: currentMonthIncomeInReportingCurrency,
        };
    }, [budgetsWithActuals, currentMonthIncomeInReportingCurrency]);

    const refreshBudgetData = async (showToast: boolean = true) => {
        setIsLoadingBudgets(true);
        if (showToast) toast.info("Refreshing budget data...");
        try {
            const currentMonthStart = startOfMonth(new Date());
            const currentMonthEnd = endOfMonth(new Date());
            const currentMonthStartDateString = format(currentMonthStart, 'yyyy-MM-dd');

            const dateRangeForIncome = {
                from: format(currentMonthStart, 'yyyy-MM-dd'),
                to: format(currentMonthEnd, 'yyyy-MM-dd'),
            };

            const [budgetsResult, expensesResult, incomesResult] = await Promise.all([
                getBudgetsByUserId(supabase, userId),
                getExpensesByUserId(supabase, userId),
                getIncomesByUserId(supabase, userId, dateRangeForIncome)
            ]);

            if (budgetsResult.data) {
                const filteredBudgets = budgetsResult.data.filter(b => b.period_start_date === currentMonthStartDateString);
                setCurrentMonthBudgets(filteredBudgets);
            } else {
                setCurrentMonthBudgets([]);
            }
            if (budgetsResult.error && showToast) toast.error("Failed to refresh budgets: " + budgetsResult.error.message);

            setAllUserExpenses(expensesResult.data || []);
            if (expensesResult.error && showToast) toast.error("Failed to refresh expenses: " + expensesResult.error.message);

            if (incomesResult.data) {
                const totalIncome = incomesResult.data.reduce((sum, inc) => sum + inc.amount_reporting_currency, 0);
                setCurrentMonthIncomeInReportingCurrency(totalIncome);
            } else {
                setCurrentMonthIncomeInReportingCurrency(0);
            }
            if (incomesResult.error && showToast) toast.error("Failed to refresh income: " + incomesResult.error.message);

            if (!budgetsResult.error && !expensesResult.error && !incomesResult.error && showToast) toast.success("Budget data refreshed.");

        } catch (e: any) {
            if (showToast) toast.error("Error refreshing data: " + e.message);
            setCurrentMonthBudgets([]);
            setAllUserExpenses([]);
            setCurrentMonthIncomeInReportingCurrency(0);
        } finally {
            setIsLoadingBudgets(false);
        }
    };

    useEffect(() => {
        setCurrentMonthBudgets(initialBudgetsData);
        setAllUserExpenses(initialExpensesData);
        setCurrentMonthIncomeInReportingCurrency(initialMonthIncomeInReportingCurrency);
    }, [initialBudgetsData, initialExpensesData, initialMonthIncomeInReportingCurrency]);


    const handleAIRecommendationsReceived = (data: AIBudgetRecommendationResponse) => {
        setAiRecommendations(data);
        setShowAISetupDialog(false);
        setViewMode('aiDisplay');
    };

    const handleAIDiscard = () => {
        setAiRecommendations(null);
        setViewMode('list');
        toast.info("AI budget recommendations discarded.");
    };

    const handleAIAcceptAndSave = async (savedBudgets: Budget[]) => {
        setAiRecommendations(null);
        setViewMode('list');
        await refreshBudgetData(false); 
        toast.success("Budgets updated based on AI recommendations!");
    };

    if (viewMode === 'aiDisplay' && aiRecommendations) {
        return (
            <BudgetAIRecommendationsDisplay
                userId={userId}
                recommendationData={aiRecommendations}
                onDiscard={handleAIDiscard}
                onAcceptAndSave={handleAIAcceptAndSave}
                currencyContext={currencyContext} 
            />
        );
    }
    
    const { userPreferredCurrency, allCurrenciesData, currentExchangeRates, baseReportingCurrency } = currencyContext;

    return (
        <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                 <div className="flex items-center gap-3">
                    <ListChecks className="h-8 w-8 text-primary hidden sm:block" />
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold">My Budgets</h1>
                        <p className="text-muted-foreground text-sm sm:text-base mt-1">
                        Overview for {format(startOfMonth(new Date()), 'MMMM yyyy')}. Displayed in {userPreferredCurrency}.
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button onClick={() => refreshBudgetData(true)} variant="outline" size="sm" className="flex-grow sm:flex-grow-0" disabled={isLoadingBudgets}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingBudgets ? 'animate-spin': ''}`} />
                        Refresh
                    </Button>
                    <Button onClick={() => setShowAISetupDialog(true)} variant="default" size="sm" className="flex-grow sm:flex-grow-0">
                        <Sparkles className="mr-2 h-4 w-4" /> AI Plan
                    </Button>
                </div>
            </div>

            {isLoadingBudgets && currentMonthBudgets.length === 0 ? (
                <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {[...Array(4)].map((_,i) => <Skeleton key={i} className="h-32 w-full rounded-lg"/>)}
                    </div>
                    <div className="grid gap-6 lg:grid-cols-3">
                        <Skeleton className="lg:col-span-1 h-[350px] w-full rounded-lg"/>
                        <Skeleton className="lg:col-span-2 h-64 w-full rounded-lg"/>
                    </div>
                </div>
            ) : (
                <>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Actual Income</CardTitle>
                                <BadgeDollarSign className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {formatCurrency(budgetSummary.actualIncomeForMonthInReportingCurrency, baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates)}
                                </div>
                                <p className="text-xs text-muted-foreground">Recorded for {format(new Date(), 'MMMM')} ({userPreferredCurrency})</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
                                <TrendingDown className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {formatCurrency(budgetSummary.totalActualSpendingInReportingCurrency, baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {budgetSummary.percentOfIncomeSpent.toFixed(0)}% of income
                                    {budgetSummary.actualIncomeForMonthInReportingCurrency <= 0 && " (income not recorded)"}
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Remaining (vs Income)</CardTitle>
                                <TrendingUp className={cn("h-4 w-4", budgetSummary.totalRemainingFromIncomeInReportingCurrency >= 0 ? "text-green-500" : "text-red-500")} />
                            </CardHeader>
                            <CardContent>
                                <div className={cn("text-2xl font-bold", budgetSummary.totalRemainingFromIncomeInReportingCurrency >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                                    {formatCurrency(budgetSummary.totalRemainingFromIncomeInReportingCurrency, baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {budgetSummary.totalRemainingFromIncomeInReportingCurrency >= 0 ? "Potential savings" : "Overspent vs income"}
                                    {budgetSummary.actualIncomeForMonthInReportingCurrency <= 0 && " (income N/A)"}
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Budget Limit vs Spent</CardTitle>
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-lg font-bold">
                                    {formatCurrency(budgetSummary.totalActualSpendingInReportingCurrency, baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates)} / {formatCurrency(budgetSummary.totalBudgetLimitInReportingCurrency, baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {(budgetSummary.totalBudgetLimitInReportingCurrency > 0 ? (budgetSummary.totalActualSpendingInReportingCurrency / budgetSummary.totalBudgetLimitInReportingCurrency) * 100 : 0).toFixed(0)}% of total limits
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {budgetsWithActuals.length > 0 ? (
                        <div className="grid gap-6 lg:grid-cols-3">
                            <div className="lg:col-span-1 order-first lg:order-none">
                                <BudgetCategoryChart 
                                    budgetsWithActuals={budgetsWithActuals} 
                                    currencyContext={currencyContext} 
                                />
                            </div>
                            <div className="lg:col-span-2">
                                <BudgetList
                                    initialBudgets={currentMonthBudgets} 
                                    initialExpenses={allUserExpenses}   
                                    userId={userId}
                                    onDataChange={() => refreshBudgetData(false)}
                                    currencyContext={currencyContext} 
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-10 border-2 border-dashed border-muted rounded-lg mt-6">
                            <Info className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                            <h3 className="text-xl font-semibold">No Budgets for {format(new Date(), 'MMMM yyyy')}</h3>
                            <p className="text-muted-foreground">
                                Set up budgets for this month or use the AI planner.
                            </p>
                        </div>
                    )}
                </>
            )}

            <Dialog open={showAISetupDialog} onOpenChange={setShowAISetupDialog}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>AI Budget Setup</DialogTitle>
                        <DialogDescription>
                            Provide some details, and our AI will help you craft a budget. Remember, AI suggestions are in {BASE_REPORTING_CURRENCY}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 max-h-[70vh] overflow-y-auto pr-2">
                        <BudgetAISetupForm
                            onRecommendationsReceived={handleAIRecommendationsReceived}
                            onCancel={() => setShowAISetupDialog(false)}
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}


export default function BudgetsPage() {
    const [user, setUser] = useState<SupabaseAuthUser | null>(null);
    const [initialCurrentMonthBudgets, setInitialCurrentMonthBudgets] = useState<Budget[] | null>(null);
    const [initialAllUserExpenses, setInitialAllUserExpenses] = useState<Expense[] | null>(null);
    const [initialCurrentMonthIncomeInReportingCurrency, setInitialCurrentMonthIncomeInReportingCurrency] = useState<number | null>(null);
    
    const [currencyContext, setCurrencyContext] = useState<CurrencyContextProps | null>(null);
    
    const [isLoadingPage, setIsLoadingPage] = useState(true);
    const [errorPage, setErrorPage] = useState<string | null>(null);

    const supabase = createClient();

    useEffect(() => {
        const fetchData = async () => {
            setIsLoadingPage(true);
            setErrorPage(null);

            const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

            if (authError || !authUser) {
                setUser(null); setIsLoadingPage(false);
                if (typeof window !== 'undefined') window.location.href = '/auth/login';
                return;
            }
            setUser(authUser);

            try {
                const profileResult = await getCurrentUserProfile(supabase, authUser.id);
                const userPreferredCurrency = profileResult.data?.preferred_currency || DEFAULT_CURRENCY;
                
                const currenciesResult = await getCurrencies(supabase, true); 
                const allCurrenciesData: Currency[] = currenciesResult.data || []; // This is Currency[]
                
                // Transform the array into the required object format
                const allCurrenciesDataObject: Record<CurrencyCode, Currency> = allCurrenciesData.reduce((acc, currency) => {
                    acc[currency.code] = currency;
                    return acc;
                }, {} as Record<CurrencyCode, Currency>);

                const targetRateCurrencies = [...new Set(allCurrenciesData.map(c => c.code).concat(userPreferredCurrency))];
                const exchangeRatesResult = await getMultipleExchangeRates(supabase, new Date(), targetRateCurrencies, BASE_REPORTING_CURRENCY);
                const fetchedExchangeRates: Record<CurrencyCode, number> = exchangeRatesResult.data || {} as Record<CurrencyCode, number>;

                // **** THIS IS THE FIX FOR THE TYPE ERRORS ****
                setCurrencyContext({
                    userPreferredCurrency,
                    baseReportingCurrency: BASE_REPORTING_CURRENCY,
                    allCurrenciesData: allCurrenciesDataObject, // Pass the object
                    currentExchangeRates: fetchedExchangeRates, // Pass the rates map directly
                    supabaseClient: supabase,
                });
                // **** END OF FIX ****

                const currentMonthStart = startOfMonth(new Date());
                const currentMonthEnd = endOfMonth(new Date());
                const currentMonthStartDateString = format(currentMonthStart, 'yyyy-MM-dd');
                const dateRangeForIncome = {
                    from: format(currentMonthStart, 'yyyy-MM-dd'),
                    to: format(currentMonthEnd, 'yyyy-MM-dd'),
                };

                const [budgetsResult, expensesResult, incomesResult] = await Promise.all([
                    getBudgetsByUserId(supabase, authUser.id),
                    getExpensesByUserId(supabase, authUser.id),
                    getIncomesByUserId(supabase, authUser.id, dateRangeForIncome)
                ]);

                if (budgetsResult.data) {
                    const filteredBudgets = budgetsResult.data.filter(b => b.period_start_date === currentMonthStartDateString);
                    setInitialCurrentMonthBudgets(filteredBudgets);
                } else { setInitialCurrentMonthBudgets([]); }
                if (budgetsResult.error) console.error("Error fetching initial budgets:", budgetsResult.error.message);

                setInitialAllUserExpenses(expensesResult.data || []);
                if (expensesResult.error) console.error("Error fetching initial expenses:", expensesResult.error.message);

                if (incomesResult.data) {
                    const totalIncome = incomesResult.data.reduce((sum, inc) => sum + inc.amount_reporting_currency, 0);
                    setInitialCurrentMonthIncomeInReportingCurrency(totalIncome);
                } else { setInitialCurrentMonthIncomeInReportingCurrency(0); }
                if (incomesResult.error) console.error("Error fetching initial income:", incomesResult.error.message);

            } catch (e: any) {
                console.error("BudgetsPage: Unexpected data fetching error", e);
                setErrorPage("Could not load initial budget data. Please try refreshing.");
            } finally {
                setIsLoadingPage(false);
            }
        };

        fetchData();
    }, [supabase]); 

    if (isLoadingPage) {
        return (
            <div className="container mx-auto p-4 md:p-6 lg:p-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                  <div> <Skeleton className="h-9 w-32 sm:w-48 mb-2" /> <Skeleton className="h-5 w-56 sm:w-72" /> </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                      <Skeleton className="h-9 w-24 sm:w-28"/> <Skeleton className="h-9 w-24 sm:w-28"/>
                  </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                  {[...Array(4)].map((_,i) => <Skeleton key={i} className="h-32 w-full rounded-lg"/>)}
              </div>
              <div className="grid gap-6 lg:grid-cols-3">
                  <Skeleton className="lg:col-span-1 h-[350px] w-full rounded-lg"/>
                  <Skeleton className="lg:col-span-2 h-[300px] w-full rounded-lg"/>
              </div>
            </div>
          );
    }
    if (errorPage) return <div className="container mx-auto p-4 text-center text-red-500">{errorPage}</div>;
    if (!user || !currencyContext || initialCurrentMonthBudgets === null || initialAllUserExpenses === null || initialCurrentMonthIncomeInReportingCurrency === null) {
        return <div className="container mx-auto p-4 text-center"><p>Preparing your budget dashboard...</p></div>;
    }

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <BudgetsView
                userId={user.id}
                initialBudgetsData={initialCurrentMonthBudgets}
                initialExpensesData={initialAllUserExpenses}
                initialMonthIncomeInReportingCurrency={initialCurrentMonthIncomeInReportingCurrency}
                currencyContext={currencyContext}
            />
        </div>
    );
}
