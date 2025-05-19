/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Expense, Debt, Budget, ExpenseInsertData, Profile, Currency } from '@/types';
import { ExpenseCategorySlug, CurrencyCode, BASE_REPORTING_CURRENCY } from '@/lib/constants';
import ExpenseForm from '@/components/forms/ExpenseForm';
import DebtForm from '@/components/forms/DebtForm';
import BudgetCategoryView from '@/components/features/budgeting/BudgetCategoryView'; // Assuming this component exists and is updated

import ExpenseTable from './ExpenseTable';
import DebtManagementSection from './DebtManagementSection';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { PlusCircle, Banknote, HandCoins, NotebookPen } from 'lucide-react';
import { getExpensesByUserId } from '@/services/expenseService';
import { getDebtsByUserId } from '@/services/debtService';
import { getBudgetsByUserId } from '@/services/budgetService';
import { toast } from 'sonner';
import { format, startOfMonth, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { AllCurrenciesData, ExchangeRatesMap } from '@/lib/utils';


// Helper to convert Partial<ExpenseInsertData> to a temporary Expense object for the form
// This is needed if ExpenseForm's initialData strictly expects the full Expense type.
function partialExpenseInsertToFullExpense(
  partialData: Partial<ExpenseInsertData>,
  userId: string,
  defaultCurrency: CurrencyCode
): Expense {
  const now = new Date();
  return {
    id: 'temp_' + Math.random().toString(36).substring(2, 15), // Temporary ID
    user_id: partialData.user_id || userId,
    amount_native: partialData.amount_native ?? 0,
    currency_code: partialData.currency_code || defaultCurrency,
    // amount_reporting_currency will be calculated by backend. For form, can be 0 or based on available rates if needed.
    amount_reporting_currency: 0, 
    date: partialData.date || format(now, 'yyyy-MM-dd'),
    expense_category_id: partialData.expense_category_id || 0, // Or a sensible default
    category: partialData.category || ('miscellaneous' as ExpenseCategorySlug), // Default category
    description: partialData.description || '',
    is_recurring: partialData.is_recurring || false,
    recurrence_frequency: partialData.recurrence_frequency || null,
    related_debt_id: partialData.related_debt_id || null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    accounts: null, // Not typically available for new/temp item
    expense_categories: null, // Not typically available for new/temp item
    debts: null, // Not typically available for new/temp item
    ...partialData, // Spread again to ensure specific fields override defaults
  };
}


interface SpendingPageClientContentProps {
  initialExpenses: Expense[];
  initialDebts: Debt[];
  initialBudgets: Budget[];
  userId: string;
  userProfile: Profile; // Contains preferred_currency
  userPreferredCurrency: CurrencyCode;
  baseReportingCurrency: CurrencyCode;
  allCurrenciesData: AllCurrenciesData;
  currentExchangeRates: ExchangeRatesMap;
}

export default function SpendingPageClientContent({
  initialExpenses,
  initialDebts,
  initialBudgets,
  userId,
  userProfile,
  userPreferredCurrency,
  baseReportingCurrency,
  allCurrenciesData,
  currentExchangeRates,
}: SpendingPageClientContentProps) {
  const supabase = createClient();

  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [debts, setDebts] = useState<Debt[]>(initialDebts);
  const [budgets, setBudgets] = useState<Budget[]>(initialBudgets);

  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false);
  const [isLoadingDebts, setIsLoadingDebts] = useState(false);
  const [isLoadingBudgets, setIsLoadingBudgets] = useState(false);

  const [isExpenseFormModalOpen, setIsExpenseFormModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | Partial<ExpenseInsertData> | null>(null);

  const [isDebtFormModalOpen, setIsDebtFormModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  
  useEffect(() => setExpenses(initialExpenses), [initialExpenses]);
  useEffect(() => setDebts(initialDebts), [initialDebts]);
  useEffect(() => setBudgets(initialBudgets), [initialBudgets]);

  const refreshExpenses = useCallback(async () => {
    setIsLoadingExpenses(true);
    const { data, error } = await getExpensesByUserId(supabase, userId);
    setIsLoadingExpenses(false);
    if (error) toast.error(`Failed to refresh expenses: ${error.message}`);
    else setExpenses(data || []);
  }, [userId, supabase]);

  const refreshDebts = useCallback(async () => {
    setIsLoadingDebts(true);
    const { data, error } = await getDebtsByUserId(supabase, userId);
    setIsLoadingDebts(false);
    if (error) toast.error(`Failed to refresh debts: ${error.message}`);
    else setDebts(data || []);
  }, [userId, supabase]);

  const refreshBudgets = useCallback(async () => {
    setIsLoadingBudgets(true);
    const currentPeriodStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const { data, error } = await getBudgetsByUserId(supabase, userId, currentPeriodStart);
    setIsLoadingBudgets(false);
    if (error) toast.error(`Failed to refresh budgets: ${error.message}`);
    else setBudgets(data || []);
  }, [userId, supabase]);

  const handleAddExpenseClick = () => {
    setEditingExpense(null); // For a new expense
    setIsExpenseFormModalOpen(true);
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setIsExpenseFormModalOpen(true);
  };

  const handleLogDebtPayment = (debt: Debt) => {
    // Pre-fill expense form for debt payment
    const paymentAmount = debt.minimum_payment_native ?? debt.current_balance_native ?? 0;
    setEditingExpense({
      // user_id will be added by ExpenseForm or service layer
      category: 'debt_payments' as ExpenseCategorySlug, // Pre-select debt payment category
      // expense_category_id: // This needs to be resolved, perhaps by looking up default category ID
      related_debt_id: debt.id,
      amount_native: paymentAmount,
      currency_code: debt.currency_code, // Use debt's currency
      description: `Payment for ${debt.creditor}`,
      date: format(new Date(), 'yyyy-MM-dd'),
      is_recurring: false,
    });
    setIsExpenseFormModalOpen(true);
  };

  const handleExpenseFormSubmitSuccess = () => {
    setIsExpenseFormModalOpen(false);
    const isUpdate = editingExpense && 'id' in editingExpense && editingExpense.id;
    toast.success(`Expense ${isUpdate ? 'updated' : 'added'} successfully!`);
    setEditingExpense(null);
    refreshExpenses();
    // If the expense was related to a debt, refresh debts too
    if (editingExpense && 'related_debt_id' in editingExpense && editingExpense.related_debt_id) {
      refreshDebts();
    }
    refreshBudgets(); // Budgets might be affected by new expenses
  };

  const handleAddDebtClick = () => {
    setEditingDebt(null);
    setIsDebtFormModalOpen(true);
  };

  const handleEditDebt = (debt: Debt) => {
    setEditingDebt(debt);
    setIsDebtFormModalOpen(true);
  };

  const handleDebtFormSubmitSuccess = () => {
    setIsDebtFormModalOpen(false);
    toast.success(`Debt ${editingDebt ? 'updated' : 'added'} successfully!`);
    setEditingDebt(null);
    refreshDebts();
  };

  // Prepare initial data for ExpenseForm
  // If editing an existing expense, use it directly.
  // If adding new or logging debt payment (editingExpense is Partial<ExpenseInsertData>), convert it.
  const expenseFormInitialData = editingExpense
    ? 'id' in editingExpense && editingExpense.id // Check if it has an 'id' to determine if it's a full Expense object
      ? (editingExpense as Expense) // It's a full Expense object for editing
      : partialExpenseInsertToFullExpense(editingExpense as Partial<ExpenseInsertData>, userId, userPreferredCurrency)
    : null; // For a brand new expense from "Add Expense" button

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Spending Hub</h1>
          <p className="text-muted-foreground">
            Track expenses, manage debts, and monitor your budgets in {userPreferredCurrency}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
             <Button onClick={handleAddExpenseClick} size="sm" variant="outline">
                <Banknote className="mr-2 h-4 w-4" />
                Add Expense
            </Button>
            <Button onClick={handleAddDebtClick} size="sm" variant="outline">
                <HandCoins className="mr-2 h-4 w-4" />
                Add Debt
            </Button>
        </div>
      </div>

      {/* 
        TODO: Update BudgetCategoryView component and its props (BudgetCategoryViewProps) 
        to accept and utilize the following currency-related props:
        - userPreferredCurrency: CurrencyCode;
        - baseReportingCurrency: CurrencyCode;
        - allCurrenciesData: AllCurrenciesData;
        - currentExchangeRates: ExchangeRatesMap;
        The error "Property 'userPreferredCurrency' does not exist on type 'IntrinsicAttributes & BudgetCategoryViewProps'" 
        originates from BudgetCategoryView not yet declaring these props.
      */}
      <BudgetCategoryView 
        budgets={budgets} 
        expenses={expenses} // Pass all expenses for calculation
        isLoading={isLoadingBudgets}
        onRefreshBudgets={refreshBudgets}
        userId={userId}
        userPreferredCurrency={userPreferredCurrency}
        baseReportingCurrency={baseReportingCurrency}
        allCurrenciesData={allCurrenciesData}
        currentExchangeRates={currentExchangeRates}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle className="flex items-center"><NotebookPen className="mr-2 h-5 w-5 text-blue-500" />Expenses</CardTitle>
                <CardDescription>Your recorded expenses. Amounts displayed in {userPreferredCurrency}.</CardDescription>
            </div>
             <Button onClick={handleAddExpenseClick} size="sm">
                <PlusCircle className="mr-2 h-4 w-4" />
                New Expense
            </Button>
        </CardHeader>
        <CardContent>
          <ExpenseTable
            expenses={expenses}
            userId={userId} // Kept for potential future use
            onEdit={handleEditExpense}
            onRefresh={refreshExpenses}
            isLoading={isLoadingExpenses}
            userPreferredCurrency={userPreferredCurrency}
            baseReportingCurrency={baseReportingCurrency}
            allCurrenciesData={allCurrenciesData}
            currentExchangeRates={currentExchangeRates}
          />
        </CardContent>
      </Card>

      <DebtManagementSection
        debts={debts}
        userId={userId} // Kept for potential future use
        onEditDebt={handleEditDebt}
        onLogDebtPayment={handleLogDebtPayment}
        onRefreshDebts={refreshDebts}
        onAddDebt={handleAddDebtClick}
        isLoading={isLoadingDebts}
        userPreferredCurrency={userPreferredCurrency}
        baseReportingCurrency={baseReportingCurrency}
        allCurrenciesData={allCurrenciesData}
        currentExchangeRates={currentExchangeRates}
      />

      <Dialog open={isExpenseFormModalOpen} onOpenChange={(isOpen) => {
          setIsExpenseFormModalOpen(isOpen);
          if (!isOpen) setEditingExpense(null);
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {expenseFormInitialData && expenseFormInitialData.id && !expenseFormInitialData.id.startsWith('temp_')
                ? 'Edit Expense' 
                : (expenseFormInitialData && expenseFormInitialData.related_debt_id 
                    ? 'Log Debt Payment' 
                    : 'Add New Expense')}
            </DialogTitle>
            <DialogDescription>
              {expenseFormInitialData && expenseFormInitialData.id && !expenseFormInitialData.id.startsWith('temp_')
                ? 'Update the details of your expense.' 
                : (expenseFormInitialData && expenseFormInitialData.related_debt_id
                    ? `Record a payment for ${debts.find(d => d.id === expenseFormInitialData?.related_debt_id)?.creditor}.` 
                    : 'Enter the details for a new expense.')}
            </DialogDescription>
          </DialogHeader>
          <ExpenseForm
            userId={userId}
            initialData={expenseFormInitialData}
            // Pass currency context if ExpenseForm needs it for e.g. default currency selection
            // userPreferredCurrency={userPreferredCurrency} 
            // allCurrenciesData={allCurrenciesData}
            onSubmitSuccess={handleExpenseFormSubmitSuccess}
            onCancel={() => {
                setIsExpenseFormModalOpen(false);
                setEditingExpense(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isDebtFormModalOpen} onOpenChange={(isOpen) => {
          setIsDebtFormModalOpen(isOpen);
          if (!isOpen) setEditingDebt(null);
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingDebt ? 'Edit Debt' : 'Add New Debt'}
            </DialogTitle>
            <DialogDescription>
              {editingDebt ? 'Update the details of your debt.' : 'Enter the details for a new debt.'}
            </DialogDescription>
          </DialogHeader>
          <DebtForm
            userId={userId}
            initialData={editingDebt}
            // Pass currency context if DebtForm needs it for e.g. default currency selection
            // userPreferredCurrency={userPreferredCurrency} 
            // allCurrenciesData={allCurrenciesData}
            onSubmitSuccess={handleDebtFormSubmitSuccess}
            onCancel={() => {
                setIsDebtFormModalOpen(false);
                setEditingDebt(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}