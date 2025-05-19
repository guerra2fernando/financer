/* eslint-disable @typescript-eslint/no-unused-vars */
// src/components/dashboard/BudgetQuickView.tsx
'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Budget, Expense } from '@/types';
import { formatCurrency, AllCurrenciesData, ExchangeRatesMap } from '@/lib/utils';
import { TargetIcon } from 'lucide-react';
import { CurrencyCode } from '@/lib/constants';

interface BudgetQuickViewProps {
  budgets: Budget[];
  expenses: Expense[]; // Expenses for the same period as budgets
  userPreferredCurrency: CurrencyCode;
  baseReportingCurrency: CurrencyCode;
  allCurrenciesData: AllCurrenciesData;
  currentExchangeRates: ExchangeRatesMap;
}

interface BudgetWithActual extends Budget {
  actualSpendingUSD: number; // Storing as USD, will format on display
  limitUSD: number; // Storing as USD
  progress: number;
}

export default function BudgetQuickView({ 
    budgets, expenses, 
    userPreferredCurrency, baseReportingCurrency, allCurrenciesData, currentExchangeRates 
}: BudgetQuickViewProps) {
  const processedBudgets = useMemo(() => {
    if (!budgets || budgets.length === 0) return [];

    return budgets.map(budget => {
      const relevantExpenses = expenses.filter(
        expense => expense.category === budget.category
      );
      // Budgets amounts are amount_limit_native and amount_limit_reporting_currency.
      // Expenses amounts are amount_native, currency_code, and amount_reporting_currency.
      // For consistency, all calculations here should use the _reporting_currency (USD) fields.
      const actualSpendingUSD = relevantExpenses.reduce((sum, exp) => sum + exp.amount_reporting_currency, 0);
      const limitUSD = budget.amount_limit_reporting_currency;
      const progress = limitUSD > 0 ? (actualSpendingUSD / limitUSD) * 100 : 0;
      
      return {
        ...budget,
        actualSpendingUSD,
        limitUSD,
        progress: Math.min(progress, 100),
      };
    }).sort((a, b) => b.progress - a.progress)
      .slice(0, 5);
  }, [budgets, expenses]);

  if (processedBudgets.length === 0) {
    return ( <Card><CardHeader><CardTitle className="flex items-center"><TargetIcon className="mr-2 h-5 w-5 text-orange-500" /> Budget Quick View</CardTitle><CardDescription>Your top budgets for the current month.</CardDescription></CardHeader><CardContent className="h-[300px] flex items-center justify-center"><p className="text-muted-foreground">No active budgets for the current month.</p></CardContent></Card> );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><TargetIcon className="mr-2 h-5 w-5 text-orange-500" /> Budget Quick View</CardTitle>
        <CardDescription>Top budgets for current month (shown in {userPreferredCurrency}).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {processedBudgets.map(budget => (
          <div key={budget.id}>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-sm font-medium capitalize">
                {budget.category.replace(/_/g, ' ')}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatCurrency(budget.actualSpendingUSD, baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates)} / {formatCurrency(budget.limitUSD, baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates)}
              </span>
            </div>
            <Progress value={budget.progress} className={budget.progress > 85 ? "bg-red-200 [&>*]:bg-red-500" : budget.progress > 60 ? "bg-yellow-200 [&>*]:bg-yellow-500" : "[&>*]:bg-green-500"}/>
            {budget.actualSpendingUSD > budget.limitUSD && (
                <p className="text-xs text-red-600 mt-1">
                    Over budget by {formatCurrency(budget.actualSpendingUSD - budget.limitUSD, baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates)}
                </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}