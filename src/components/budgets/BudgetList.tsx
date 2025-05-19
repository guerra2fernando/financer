/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// src/components/budgets/BudgetList.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Budget, Expense, CurrencyContextProps, BudgetListItemProcessed } from '@/types';
import BudgetForm from '@/components/forms/BudgetForm'; // BudgetForm will need currency_code input
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { PlusCircle, Edit, Trash2, Loader2, Info, RefreshCw } from 'lucide-react';
import { deleteBudget, getBudgetsByUserId } from '@/services/budgetService';
import { getExpensesByUserId } from '@/services/expenseService';
import { createClient } from '@/lib/supabase/client';
import { format as formatDateFns, parseISO, endOfMonth, isWithinInterval, startOfMonth, format } from 'date-fns';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { getDisplayCategoryName, BASE_REPORTING_CURRENCY, CurrencyCode } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';


interface BudgetListProps {
  initialBudgets: Budget[]; // Raw budgets from DB
  initialExpenses: Expense[]; // Raw expenses from DB
  userId: string;
  onDataChange?: () => Promise<void>;
  currencyContext: CurrencyContextProps;
}

// This local calculation can be removed if BudgetsView passes down BudgetListItemProcessed directly
const calculateLocalBudgetActuals = (
    budgetsData: Budget[],
    expensesData: Expense[],
    // currencyContext: CurrencyContextProps // For potential direct formatting if needed
): BudgetListItemProcessed[] => {
    if (!Array.isArray(budgetsData) || !Array.isArray(expensesData)) {
        console.warn("calculateBudgetActuals received invalid data:", { budgetsData, expensesData });
        return [];
    }
    return budgetsData.map(budget => {
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
                progressPercent: 0,
            };
        }

        const relevantExpenses = expensesData.filter(expense => {
            try {
                const expenseDate = parseISO(expense.date);
                return expense.category.toLowerCase() === budget.category.toLowerCase() &&
                    isWithinInterval(expenseDate, { start: budgetPeriodStartDate, end: budgetPeriodEndDate });
            } catch (e) {
                console.warn("Invalid date for expense during budget calculation:", expense, e);
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


export default function BudgetList({ initialBudgets, initialExpenses, userId, onDataChange, currencyContext }: BudgetListProps) {
  const [processedBudgets, setProcessedBudgets] = useState<BudgetListItemProcessed[]>([]);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInternalLoading, setIsInternalLoading] = useState(false);

  const supabaseBrowserClient = currencyContext.supabaseClient; // Use client from context
  const { userPreferredCurrency, allCurrenciesData, currentExchangeRates, baseReportingCurrency } = currencyContext;

  const refreshAndRecalculateProcessedBudgets = useCallback((budgetsData: Budget[], expensesData: Expense[]) => {
    setProcessedBudgets(calculateLocalBudgetActuals(budgetsData, expensesData));
  }, []);


  const internalFetchDataAndRecalculate = useCallback(async () => {
    setIsInternalLoading(true);
    setIsLoading(true);
    toast.info("Refreshing budgets list...");
    try {
        const currentMonthStartStr = format(startOfMonth(new Date()), 'yyyy-MM-dd');
        // Fetch budgets specifically for the current month and all expenses
        const [budgetResult, expenseResult] = await Promise.all([
            getBudgetsByUserId(supabaseBrowserClient, userId), // Fetches all, then filter
            getExpensesByUserId(supabaseBrowserClient, userId)
        ]);

        const budgetsData = budgetResult.data?.filter(b => b.period_start_date === currentMonthStartStr) || [];
        const expensesData = expenseResult.data || [];

        if (budgetResult.error) toast.error(`Failed to refresh budgets: ${budgetResult.error.message}`);
        if (expenseResult.error) toast.error(`Failed to refresh expenses: ${expenseResult.error.message}`);
        
        refreshAndRecalculateProcessedBudgets(budgetsData, expensesData);
        if (!budgetResult.error && !expenseResult.error) toast.success("Budgets list refreshed.");

    } catch (error: any) {
        toast.error(`Error refreshing data: ${error.message}`);
        refreshAndRecalculateProcessedBudgets([], []);
    } finally {
        setIsInternalLoading(false);
        setIsLoading(false);
    }
  }, [userId, supabaseBrowserClient, refreshAndRecalculateProcessedBudgets]);


  useEffect(() => {
    refreshAndRecalculateProcessedBudgets(initialBudgets, initialExpenses);
  }, [initialBudgets, initialExpenses, refreshAndRecalculateProcessedBudgets]);


  const handleFormSuccess = async (newOrUpdatedBudget: Budget) => {
    setShowFormDialog(false);
    setEditingBudget(null);
    toast.success(`Budget ${editingBudget ? 'updated' : 'added'} successfully!`);
    if (onDataChange) {
      await onDataChange();
    } else {
      await internalFetchDataAndRecalculate();
    }
  };

  const handleDelete = async (budgetId: string) => {
    if (!confirm('Are you sure you want to delete this budget? This action cannot be undone.')) return;
    
    setIsLoading(true);
    const { error } = await deleteBudget(supabaseBrowserClient, budgetId);
    setIsLoading(false);

    if (error) {
      toast.error(`Failed to delete budget: ${error.message}`);
    } else {
      toast.success('Budget deleted successfully!');
      if (onDataChange) {
        await onDataChange();
      } else {
        setProcessedBudgets(prev => prev.filter(b => b.id !== budgetId));
      }
    }
  };

  const openAddForm = () => {
    setEditingBudget(null);
    setShowFormDialog(true);
  };

  const openEditForm = (budget: Budget) => { // Pass BudgetListItemProcessed if needed by form
    setEditingBudget(budget);
    setShowFormDialog(true);
  };
  
  // Skeleton loading (same as before)
  if (isLoading && processedBudgets.length === 0 && !isInternalLoading) {
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-9 w-36" />
            </div>
            <Skeleton className="h-10 w-full" />
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Button onClick={internalFetchDataAndRecalculate} variant="outline" size="sm" disabled={isInternalLoading || isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isInternalLoading ? 'animate-spin' : ''}`} />
            Refresh List
        </Button>
        <Button onClick={openAddForm} size="sm">
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Budget
        </Button>
      </div>

      <Dialog open={showFormDialog} onOpenChange={(open) => {
          setShowFormDialog(open);
          if (!open) setEditingBudget(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBudget ? 'Edit Budget' : 'Add New Budget'}</DialogTitle>
            <DialogDescription>
                {editingBudget ? `Update the amount for this budget category. Current currency: ${editingBudget.currency_code}.` 
                               : `Set a new spending limit. Choose currency and amount.`}
            </DialogDescription>
          </DialogHeader>
          <BudgetForm // IMPORTANT: BudgetForm needs to be refactored for multi-currency
            userId={userId}
            initialData={editingBudget}
            onSubmitSuccess={handleFormSuccess}
            onCancel={() => {
                setShowFormDialog(false);
                setEditingBudget(null);
            }}
            // Pass currency context to BudgetForm for currency dropdown and default preferred currency
            currencyContext={currencyContext}
          />
        </DialogContent>
      </Dialog>
      
      {/* Loading and No Budgets states (same as before) */}
      {(isLoading && processedBudgets.length === 0 && isInternalLoading) && (
        <div className="text-center py-10">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary mb-2" />
            <p className="text-muted-foreground">Loading budgets...</p>
        </div>
      )}

      {!isLoading && !isInternalLoading && processedBudgets.length === 0 && (
         <div className="text-center py-10 border-2 border-dashed border-muted rounded-lg mt-6">
            <Info className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <h3 className="text-xl font-semibold">No Budgets Found</h3>
            <p className="text-muted-foreground">
                It looks like you havent set up any budgets for the current period yet.
            </p>
            <Button onClick={openAddForm} size="sm" className="mt-4">
                <PlusCircle className="mr-2 h-4 w-4" /> Create Your First Budget
            </Button>
         </div>
      )}


      {processedBudgets.length > 0 && (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
             <TableCaption>
                Your spending limits and progress for {format(startOfMonth(new Date()), 'MMM yyyy')}. Displayed in {userPreferredCurrency}.
             </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[150px]">Category</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Limit ({userPreferredCurrency})</TableHead>
                <TableHead className="text-right">Spent ({userPreferredCurrency})</TableHead>
                <TableHead className="text-right">Remaining ({userPreferredCurrency})</TableHead>
                <TableHead className="min-w-[150px] text-center">Progress</TableHead>
                <TableHead className="text-right w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedBudgets.map((budget) => (
                <TableRow key={budget.id}>
                  <TableCell className="font-medium">{getDisplayCategoryName(budget.category)} ({budget.currency_code})</TableCell>
                  <TableCell>{formatDateFns(parseISO(budget.period_start_date), 'MMM yyyy')}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(budget.amount_limit_native, budget.currency_code, userPreferredCurrency, allCurrenciesData, currentExchangeRates)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(budget.actualSpendingInReportingCurrency, baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${budget.remainingAmountInReportingCurrency < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}
                  >
                    {formatCurrency(budget.remainingAmountInReportingCurrency, baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates)}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center space-x-2">
                        <Progress value={budget.progressPercent} className="h-2.5 w-24 budget-progress"
                            style={
                                {
                                    '--progress-color': budget.progressPercent > 90 ? (budget.progressPercent > 100 ? "rgb(220 38 38)" : "rgb(251 146 60)") : "rgb(59 130 246)"
                                } as React.CSSProperties
                            }
                        />
                        <span className="text-xs text-muted-foreground tabular-nums">
                            {budget.progressPercent.toFixed(0)}%
                        </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEditForm(budget)} className="mr-1 h-8 w-8" disabled={isLoading || isInternalLoading}>
                      <Edit className="h-4 w-4" />
                      <span className="sr-only">Edit Budget</span>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(budget.id!)} disabled={isLoading || isInternalLoading} className="text-destructive hover:text-destructive-foreground hover:bg-destructive/90 h-8 w-8">
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete Budget</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
// Exporting BudgetListItemProcessed for potential use in BudgetsView (parent)
export type { BudgetListItemProcessed }; 