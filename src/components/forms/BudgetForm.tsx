/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// src/components/forms/BudgetForm.tsx
'use client';

import { useState, useEffect, FormEvent, useCallback } from 'react';
import type { Budget, BudgetInsert, BudgetUpdate, BudgetPeriodType, Currency, ExpenseCategoryDB } from '@/types';
import { DEFAULT_BUDGET_CATEGORIES, ExpenseCategorySlug, DEFAULT_CURRENCY, CurrencyCode } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addBudget, updateBudget } from '@/services/budgetService';
import { getCurrencies } from '@/services/currencyService'; // Import service
import { getExpenseCategories } from '@/services/expenseService'; // Assuming for custom categories
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { format as formatDateFns, parseISO, startOfMonth } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { getDisplayCategoryName } from '@/lib/constants';


import type { CurrencyContextProps } from '@/types';

interface BudgetFormProps {
  userId: string;
  initialData?: Budget | null;
  onSubmitSuccess: (newOrUpdatedBudget: Budget) => void;
  onCancel?: () => void;
  currencyContext: CurrencyContextProps;
}

const budgetPeriodTypes: BudgetPeriodType[] = ['monthly'];

export default function BudgetForm({ userId, initialData, onSubmitSuccess, onCancel, currencyContext }: BudgetFormProps) {
  const [categorySlug, setCategorySlug] = useState<ExpenseCategorySlug | ''>('');
  // const [expenseCategoryId, setExpenseCategoryId] = useState<number | null>(null); // If using expense_category_id for budgets
  // const [dbCategories, setDbCategories] = useState<ExpenseCategoryDB[]>([]);

  const [amountLimitNative, setAmountLimitNative] = useState<string>('');
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>(DEFAULT_CURRENCY); // New state for currency
  const [periodType, setPeriodType] = useState<BudgetPeriodType | ''>('monthly');
  const [periodStartDate, setPeriodStartDate] = useState<Date | undefined>();
  
  const [availableCurrencies, setAvailableCurrencies] = useState<Currency[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true); // For currencies and categories
  const [formError, setFormError] = useState<string | null>(null);

  const supabaseBrowserClient = createClient();

  const fetchInitialData = useCallback(async () => {
    setIsDataLoading(true);
    try {
      const [currenciesRes /*, categoriesRes (if using db categories for budget) */] = await Promise.all([
        getCurrencies(supabaseBrowserClient, true),
        // getExpenseCategories(supabaseBrowserClient, userId) // If using DB categories
      ]);

      if (currenciesRes.error) toast.error("Failed to load currencies.");
      else setAvailableCurrencies(currenciesRes.data || []);

      // if (categoriesRes.error) toast.error("Failed to load expense categories.");
      // else setDbCategories(categoriesRes.data || []);

    } catch (e: any) {
      toast.error("Error fetching form data: " + e.message);
    } finally {
      setIsDataLoading(false);
    }
  }, [supabaseBrowserClient /*, userId */]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    if (initialData) {
      setCategorySlug(initialData.category || '');
      setAmountLimitNative(initialData.amount_limit_native?.toString() || '');
      setCurrencyCode(initialData.currency_code || DEFAULT_CURRENCY); // Set currency from initialData
      setPeriodType(initialData.period_type || 'monthly');
      setPeriodStartDate(initialData.period_start_date ? parseISO(initialData.period_start_date) : startOfMonth(new Date()));
    } else {
      setCategorySlug('');
      setAmountLimitNative('');
      setCurrencyCode(DEFAULT_CURRENCY); // Default currency for new budget
      setPeriodType('monthly');
      setPeriodStartDate(startOfMonth(new Date()));
    }
  }, [initialData]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFormError(null);

    if (!categorySlug.trim()) { setFormError("Category is required."); setIsLoading(false); return; }
    if (!periodType) { setFormError("Period type is required."); setIsLoading(false); return; }
    if (!periodStartDate) { setFormError("Period start date is required."); setIsLoading(false); return; }
    const parsedAmount = parseFloat(amountLimitNative);
    if (isNaN(parsedAmount) || parsedAmount < 0) { setFormError("Amount limit must be a non-negative number."); setIsLoading(false); return; }
    if (!currencyCode) { setFormError("Currency is required."); setIsLoading(false); return; }


    const budgetPayloadBase = {
      category: categorySlug.trim() as ExpenseCategorySlug,
      amount_limit_native: parsedAmount,
      currency_code: currencyCode, // Add currency_code to payload
      period_type: periodType as BudgetPeriodType,
      period_start_date: formatDateFns(periodStartDate, 'yyyy-MM-dd'),
    };

    let result;
    if (initialData?.id) {
      // For update, only amount_limit_native might change. Currency of budget is fixed.
      const updateData: BudgetUpdate = {
          amount_limit_native: budgetPayloadBase.amount_limit_native,
          // currency_code is not in BudgetUpdate type by default, as it's usually fixed.
      };
      result = await updateBudget(supabaseBrowserClient, initialData.id, updateData);
    } else {
      const insertData: BudgetInsert = {
        ...budgetPayloadBase,
        user_id: userId,
      };
      result = await addBudget(supabaseBrowserClient, insertData);
    }

    setIsLoading(false);
    if (result.error) {
      console.error('Error saving budget:', result.error);
      if (result.error.code === '23505') {
          setFormError("A budget for this category and period already exists (or in this currency).");
          toast.error("A budget for this category, period (and currency) already exists.");
      } else {
        setFormError(result.error.message);
        toast.error(`Error: ${result.error.message}`);
      }
    } else if (result.data) {
      toast.success(`Budget ${initialData ? 'updated' : 'added'} successfully!`);
      onSubmitSuccess(result.data);
    } else {
      setFormError("An unexpected issue occurred. Budget data not returned.");
      toast.error("An unexpected issue occurred.");
    }
  };
  
  const isSubmitting = isLoading || isDataLoading;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      <div>
        <Label htmlFor="budgetCategory">Category</Label>
        <Select value={categorySlug} onValueChange={(value) => setCategorySlug(value as ExpenseCategorySlug)} disabled={isSubmitting || !!initialData} >
          <SelectTrigger id="budgetCategory" aria-label="Budget Category">
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {DEFAULT_BUDGET_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {getDisplayCategoryName(cat)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
         {initialData && <p className="text-xs text-muted-foreground mt-1">Category cannot be changed after creation.</p>}
      </div>

      {!initialData && ( // Currency selection only for new budgets
        <div>
          <Label htmlFor="budgetCurrency">Currency</Label>
          <Select value={currencyCode} onValueChange={(value) => setCurrencyCode(value as CurrencyCode)} disabled={isSubmitting || !!initialData}>
            <SelectTrigger id="budgetCurrency" aria-label="Budget Currency">
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              {isDataLoading && availableCurrencies.length === 0 ? (
                <SelectItem value={DEFAULT_CURRENCY} disabled>Loading currencies...</SelectItem>
              ) : (
                availableCurrencies.map(curr => (
                  <SelectItem key={curr.code} value={curr.code}>{curr.name} ({curr.code})</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      )}
      {initialData && ( // Display currency for existing budget
        <div>
            <Label>Budget Currency</Label>
            <Input value={`${initialData.currency_code} (${availableCurrencies.find(c=>c.code === initialData.currency_code)?.name || ''})`} disabled />
            <p className="text-xs text-muted-foreground mt-1">Currency cannot be changed after creation.</p>
        </div>
      )}

      <div>
        <Label htmlFor="amountLimitNative">Amount Limit ({initialData ? initialData.currency_code : currencyCode})</Label>
        <Input id="amountLimitNative" type="number" value={amountLimitNative} onChange={(e) => setAmountLimitNative(e.target.value)} required step="0.01" placeholder="e.g., 500.00" disabled={isSubmitting}/>
      </div>

       <div>
        <Label htmlFor="budgetPeriodType">Period Type</Label>
         <Select value={periodType} onValueChange={(value) => setPeriodType(value as BudgetPeriodType)} disabled={isSubmitting || !!initialData} >
            <SelectTrigger id="budgetPeriodType" aria-label="Period Type"> <SelectValue placeholder="Select period type" /> </SelectTrigger>
            <SelectContent>
              {budgetPeriodTypes.map(pType => ( <SelectItem key={pType} value={pType}> {pType.charAt(0).toUpperCase() + pType.slice(1)} </SelectItem> ))}
            </SelectContent>
         </Select>
         {initialData && <p className="text-xs text-muted-foreground mt-1">Period type cannot be changed after creation.</p>}
      </div>

       <div>
        <Label htmlFor="periodStartDate">Period Start Date</Label>
        <DatePicker date={periodStartDate} setDate={setPeriodStartDate} />
         {initialData && <p className="text-xs text-muted-foreground mt-1">Period start date cannot be changed after creation.</p>}
      </div>

      {formError && <p className="text-sm text-red-600">{formError}</p>}
      <div className="flex gap-2 pt-2 justify-end">
        {onCancel && ( <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button> )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {initialData?.id ? 'Update Budget' : 'Add Budget'}
        </Button>
      </div>
    </form>
  );
}
