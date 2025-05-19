/* eslint-disable @typescript-eslint/no-unused-vars */
// src/components/features/budgeting/BudgetCategoryView.tsx
'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Budget, Expense } from '@/types'; // Removed CurrencyContextProps
import { formatCurrency, AllCurrenciesData, ExchangeRatesMap } from '@/lib/utils';
import { Target, PlusCircle, Settings, Loader2 } from 'lucide-react';
import Link from 'next/link';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { parseISO, endOfMonth, isWithinInterval } from 'date-fns';
import { CurrencyCode } from '@/lib/constants'; // BASE_REPORTING_CURRENCY is used internally for clarity

interface BudgetCategoryViewProps {
  budgets: Budget[]; // Raw budgets for the current period
  expenses: Expense[]; // All user expenses, will be filtered
  isLoading: boolean;
  onRefreshBudgets?: () => void; // Keep for potential future use
  userId: string;
  // Individual currency context props
  userPreferredCurrency: CurrencyCode;
  baseReportingCurrency: CurrencyCode;
  allCurrenciesData: AllCurrenciesData;
  currentExchangeRates: ExchangeRatesMap;
}

interface BudgetWithDetailsProcessed extends Budget {
  actualSpendingInReportingCurrency: number;
  remainingAmountInReportingCurrency: number;
  progress: number;
}

export default function BudgetCategoryView({
  budgets,
  expenses,
  isLoading,
  onRefreshBudgets,
  userId,
  userPreferredCurrency,
  baseReportingCurrency, // This is the currency of amount_reporting_currency fields (e.g. USD)
  allCurrenciesData,
  currentExchangeRates,
}: BudgetCategoryViewProps) {

  const processedBudgets = useMemo(() => {
    if (!budgets) return [];

    return budgets.map(budget => {
      let budgetPeriodStartDate, budgetPeriodEndDate;
      try {
          budgetPeriodStartDate = parseISO(budget.period_start_date);
          budgetPeriodEndDate = endOfMonth(budgetPeriodStartDate);
      } catch(e) {
          console.error(`Error parsing budget period date for budget ID ${budget.id}: ${budget.period_start_date}`, e);
          // Fallback for invalid date
          return {
              ...budget,
              actualSpendingInReportingCurrency: 0,
              remainingAmountInReportingCurrency: budget.amount_limit_reporting_currency,
              progress: 0,
          };
      }
      
      const relevantExpenses = expenses.filter(expense => {
        try {
            const expenseDate = parseISO(expense.date);
            return expense.category === budget.category &&
                   isWithinInterval(expenseDate, { start: budgetPeriodStartDate, end: budgetPeriodEndDate });
        } catch { 
            // console.warn(`Error parsing expense date: ${expense.date} for expense ID ${expense.id}`);
            return false; 
        }
      });

      const actualSpendingInReportingCurrency = relevantExpenses.reduce((sum, exp) => sum + exp.amount_reporting_currency, 0);
      // remainingAmountInReportingCurrency is budget_limit (in reporting) - actual_spending (in reporting)
      const remainingAmountInReportingCurrency = budget.amount_limit_reporting_currency - actualSpendingInReportingCurrency;
      const progress = budget.amount_limit_reporting_currency > 0 
                        ? (actualSpendingInReportingCurrency / budget.amount_limit_reporting_currency) * 100 
                        : (actualSpendingInReportingCurrency > 0 ? 100 : 0); // If limit is 0 but spent, show 100%

      return {
        ...budget,
        actualSpendingInReportingCurrency,
        remainingAmountInReportingCurrency,
        progress: Math.min(Math.max(0, progress), 100), // Clamp progress between 0 and 100
      };
    }).sort((a,b) => b.progress - a.progress); // Sort by progress descending
  }, [budgets, expenses]);


  if (isLoading) {
    return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><Target className="mr-2 h-5 w-5 text-green-500" /> Current Budgets</CardTitle>
            <CardDescription>Your spending against this months budget categories.</CardDescription>
          </CardHeader>
          <CardContent className="h-[150px] flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="ml-2">Loading budgets...</p>
          </CardContent>
        </Card>
      )
  }

  if (!processedBudgets || processedBudgets.length === 0) {
    return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><Target className="mr-2 h-5 w-5 text-green-500" /> Current Budgets</CardTitle>
          </CardHeader>
          <CardContent className="text-center py-10">
            <Target className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">No budgets set up for the current month.</p>
            <Button asChild variant="default">
              <Link href="/budgets">
                <PlusCircle className="mr-2 h-4 w-4" /> Set Up Budgets
              </Link>
            </Button>
          </CardContent>
        </Card>
      );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle className="flex items-center"><Target className="mr-2 h-5 w-5 text-green-500" /> Current Budgets</CardTitle>
            <CardDescription>Spending vs. budget categories (shown in {userPreferredCurrency}).</CardDescription>
        </div>
        <Button asChild variant="outline" size="sm">
            <Link href="/budgets">
                <Settings className="mr-2 h-4 w-4" /> Manage All Budgets
            </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {processedBudgets.length > 3 ? ( // Show carousel if more than 3 items
             <Carousel
                opts={{
                    align: "start",
                    loop: false,
                }}
                className="w-full"
            >
                <CarouselContent className="-ml-2 md:-ml-4">
                {processedBudgets.map(budget => (
                    <CarouselItem key={budget.id} className="pl-2 md:pl-4 basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/4">
                        <div className="p-1 h-full">
                            <BudgetCardItem 
                                budget={budget} 
                                userPreferredCurrency={userPreferredCurrency}
                                baseReportingCurrency={baseReportingCurrency}
                                allCurrenciesData={allCurrenciesData}
                                currentExchangeRates={currentExchangeRates}
                            />
                        </div>
                    </CarouselItem>
                ))}
                </CarouselContent>
                {processedBudgets.length > 4 && <CarouselPrevious className="hidden sm:flex" />} 
                {processedBudgets.length > 4 && <CarouselNext className="hidden sm:flex" />}
            </Carousel>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {processedBudgets.map(budget => (
                    <BudgetCardItem 
                        key={budget.id} 
                        budget={budget} 
                        userPreferredCurrency={userPreferredCurrency}
                        baseReportingCurrency={baseReportingCurrency}
                        allCurrenciesData={allCurrenciesData}
                        currentExchangeRates={currentExchangeRates}
                    />
                ))}
            </div>
        )}
      </CardContent>
    </Card>
  );
}

interface BudgetCardItemProps {
    budget: BudgetWithDetailsProcessed;
    userPreferredCurrency: CurrencyCode;
    baseReportingCurrency: CurrencyCode;
    allCurrenciesData: AllCurrenciesData;
    currentExchangeRates: ExchangeRatesMap;
}

const BudgetCardItem = ({ 
    budget, 
    userPreferredCurrency, 
    baseReportingCurrency, 
    allCurrenciesData, 
    currentExchangeRates 
}: BudgetCardItemProps) => {
    
    const progressColor = budget.progress > 90 ? "bg-red-200 [&>*]:bg-red-500" 
                        : budget.progress > 70 ? "bg-yellow-200 [&>*]:bg-yellow-500" 
                        : "[&>*]:bg-green-500";
    
    // Overspent amount is calculated in reporting currency
    const overspentAmountInReporting = budget.actualSpendingInReportingCurrency - budget.amount_limit_reporting_currency;

    return (
        <div className="p-4 border rounded-lg shadow-sm h-full flex flex-col justify-between">
            <div>
                <div className="flex justify-between items-baseline mb-1">
                <span className="text-md font-semibold capitalize">
                    {budget.category.replace(/_/g, ' ')} 
                    <span className="text-xs text-muted-foreground ml-1">({budget.currency_code})</span>
                </span>
                <span className={`text-xs font-medium ${budget.remainingAmountInReportingCurrency < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {/* Display remaining amount, converting from reporting currency to user preferred */}
                    {formatCurrency(budget.remainingAmountInReportingCurrency, baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates)} {budget.remainingAmountInReportingCurrency >= 0 ? 'left' : 'over'}
                </span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                    {/* Spent is actualSpendingInReportingCurrency converted to userPreferredCurrency */}
                    Spent: {formatCurrency(budget.actualSpendingInReportingCurrency, baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates)} 
                    {/* Limit is amount_limit_native (in budget.currency_code) converted to userPreferredCurrency */}
                    {' of '} 
                    {formatCurrency(budget.amount_limit_native, budget.currency_code, userPreferredCurrency, allCurrenciesData, currentExchangeRates)}
                </p>
            </div>
            <Progress value={budget.progress} className={`h-3 ${progressColor}`} />
             {overspentAmountInReporting > 0 && (
                <p className="text-xs text-red-600 mt-1">
                    {/* Display overspent amount, converting from reporting to user preferred */}
                    Over budget by {formatCurrency(overspentAmountInReporting, baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates)}
                </p>
            )}
        </div>
    );
}