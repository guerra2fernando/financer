/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/forms/ExpenseForm.tsx
'use client';

import React, { useState, useEffect, FormEvent, useCallback } from 'react';
import type {
  Expense, ExpenseInsertData, ExpenseUpdateData, RecurrenceFrequency,
  Account, Debt, ExpenseCategoryDB, Currency
} from '@/types';
import { getDisplayCategoryName, DEFAULT_CURRENCY, CurrencyCode, ExpenseCategorySlug } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { AllCurrenciesData } from '@/lib/utils';


import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addExpense, updateExpense, getExpenseCategories } from '@/services/expenseService';
import { getAccountsByUserId } from '@/services/accountService';
import { getDebtsByUserId } from '@/services/debtService';
import { getCurrencies } from '@/services/currencyService'; // Import service
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { format as formatDateFns, parseISO } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils'; // For displaying account balances

interface ExpenseFormProps {
  userId: string;
  initialData?: Expense | null;
  onSubmitSuccess: (newOrUpdatedExpense: Expense) => void;
  onCancel?: () => void;
}

const recurrenceFrequencies: RecurrenceFrequency[] = ['daily', 'weekly', 'monthly', 'yearly'];
const NO_ACCOUNT_SELECTED_VALUE = "no_account_selected_placeholder";
const NO_DEBT_RELATED_VALUE = "no_debt_related_placeholder";
const CATEGORY_LOADING_PLACEHOLDER_VALUE = "loading_categories_placeholder";

export default function ExpenseForm({ userId, initialData, onSubmitSuccess, onCancel }: ExpenseFormProps) {
  const [amountNative, setAmountNative] = useState<string>('');
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [selectedAccountCurrency, setSelectedAccountCurrency] = useState<CurrencyCode | null>(null);

  const [expenseCategoryId, setExpenseCategoryId] = useState<number | null>(null);
  const [dbCategories, setDbCategories] = useState<ExpenseCategoryDB[]>([]);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [description, setDescription] = useState<string>('');
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency | ''>('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [relatedDebtId, setRelatedDebtId] = useState<string | null>(null);

  const [userAccounts, setUserAccounts] = useState<Account[]>([]);
  const [userDebts, setUserDebts] = useState<Debt[]>([]);
  const [availableCurrencies, setAvailableCurrencies] = useState<Currency[]>([]); // For standalone expenses

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDropdownDataLoading, setIsDropdownDataLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const supabaseBrowserClient = createClient();

  const fetchDropdownData = useCallback(async () => {
    if (userId) {
      setIsDropdownDataLoading(true);
      try {
        const [accountsRes, debtsRes, categoriesRes, currenciesRes] = await Promise.all([
          getAccountsByUserId(supabaseBrowserClient, userId),
          getDebtsByUserId(supabaseBrowserClient, userId),
          getExpenseCategories(supabaseBrowserClient, userId),
          getCurrencies(supabaseBrowserClient, true),
        ]);

        if (accountsRes.error) toast.error("Failed to load accounts.");
        else setUserAccounts(accountsRes.data || []);

        if (debtsRes.error) toast.error("Failed to load debts.");
        else setUserDebts(debtsRes.data?.filter(debt => !debt.is_paid) || []);
        
        if (categoriesRes.error) toast.error("Failed to load expense categories.");
        else setDbCategories(categoriesRes.data || []);

        if (currenciesRes.error) toast.error("Failed to load currencies.");
        else setAvailableCurrencies(currenciesRes.data || []);

      } catch (e: any) {
        toast.error("Error fetching form dropdown data: " + e.message);
      } finally {
        setIsDropdownDataLoading(false);
      }
    }
  }, [userId, supabaseBrowserClient]);

  useEffect(() => {
    fetchDropdownData();
  }, [fetchDropdownData]);

  useEffect(() => {
    if (initialData) {
      setAmountNative(initialData.amount_native.toString());
      setCurrencyCode(initialData.currency_code || DEFAULT_CURRENCY);
      setExpenseCategoryId(initialData.expense_category_id);
      setDate(initialData.date ? parseISO(initialData.date) : new Date());
      setDescription(initialData.description || '');
      setIsRecurring(initialData.is_recurring || false);
      setRecurrenceFrequency(initialData.recurrence_frequency || '');
      setAccountId(initialData.account_id || null);
      setRelatedDebtId(initialData.related_debt_id || null);
      
      // If linked to an account, set the currency and disable currency selection
      if (initialData.account_id) {
        const linkedAccount = userAccounts.find(acc => acc.id === initialData.account_id);
        if (linkedAccount) {
          setCurrencyCode(linkedAccount.native_currency_code);
          setSelectedAccountCurrency(linkedAccount.native_currency_code);
        }
      } else {
          setSelectedAccountCurrency(null);
      }

    } else {
      setAmountNative('');
      setCurrencyCode(DEFAULT_CURRENCY);
      setExpenseCategoryId(null);
      setDate(new Date());
      setDescription('');
      setIsRecurring(false);
      setRecurrenceFrequency('');
      setAccountId(null);
      setRelatedDebtId(null);
      setSelectedAccountCurrency(null);
    }
  }, [initialData, userAccounts]); // Add userAccounts to update currency when initialData.account_id changes

  const handleAccountChange = (selectedAccountId: string | null) => {
    setAccountId(selectedAccountId);
    if (selectedAccountId) {
      const account = userAccounts.find(acc => acc.id === selectedAccountId);
      if (account) {
        setCurrencyCode(account.native_currency_code);
        setSelectedAccountCurrency(account.native_currency_code); // Lock currency
      }
    } else {
      setSelectedAccountCurrency(null); // Unlock currency, reset to default if needed
      if (!initialData) setCurrencyCode(DEFAULT_CURRENCY); // Or keep last selected if preferred
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    const parsedAmount = parseFloat(amountNative);
    if (isNaN(parsedAmount) || parsedAmount <= 0) { setFormError("Amount must be a positive number."); setIsSubmitting(false); return; }
    if (!currencyCode) { setFormError("Currency is required."); setIsSubmitting(false); return; }
    if (!expenseCategoryId) { setFormError("Category is required."); setIsSubmitting(false); return; }
    const selectedDbCategory = dbCategories.find(c => c.id === expenseCategoryId);
    if (!selectedDbCategory) { setFormError("Invalid category selected."); setIsSubmitting(false); return; }
    if (!date) { setFormError("Date is required."); setIsSubmitting(false); return; }
    if (isRecurring && !recurrenceFrequency) { setFormError("Recurrence frequency is required."); setIsSubmitting(false); return; }

    const expensePayloadBase = {
      amount_native: parsedAmount, // Use native field
      currency_code: currencyCode,  // Add currency code
      date: formatDateFns(date, 'yyyy-MM-dd'),
      expense_category_id: expenseCategoryId,
      category: selectedDbCategory.name as ExpenseCategorySlug,
      description: description.trim() || null,
      is_recurring: isRecurring,
      recurrence_frequency: isRecurring ? (recurrenceFrequency as RecurrenceFrequency) : null,
      account_id: accountId || null,
      related_debt_id: relatedDebtId || null,
    };

    let result;
    if (initialData?.id) {
      // Currency of existing expense is usually fixed. If it can change, ExpenseUpdateData needs currency_code.
      const updateData: ExpenseUpdateData = expensePayloadBase; 
      result = await updateExpense(supabaseBrowserClient, initialData.id, updateData);
    } else {
      const insertData: ExpenseInsertData = {
        ...expensePayloadBase,
        user_id: userId,
      };
      result = await addExpense(supabaseBrowserClient, insertData);
    }

    setIsSubmitting(false);
    if (result.error) {
      console.error('Error saving expense:', result.error);
      setFormError(`Failed to save expense: ${result.error.message}`);
      toast.error(`Error: ${result.error.message}`);
    } else if (result.data) {
      toast.success(`Expense ${initialData ? 'updated' : 'added'} successfully!`);
      onSubmitSuccess(result.data);
    } else {
      setFormError("Unexpected issue. Expense data not returned.");
      toast.error("Unexpected issue saving expense.");
    }
  };

  const isFormDisabled = isSubmitting || isDropdownDataLoading;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="amountNative">Amount ({currencyCode})</Label>
          <Input id="amountNative" type="number" value={amountNative} onChange={(e) => setAmountNative(e.target.value)} required step="0.01" placeholder="e.g., 50.75" disabled={isFormDisabled}/>
        </div>
        <div>
          <Label htmlFor="expenseCurrency">Currency</Label>
          <Select value={currencyCode} onValueChange={(value) => setCurrencyCode(value as CurrencyCode)} required disabled={isFormDisabled || !!selectedAccountCurrency || !!initialData}>
            <SelectTrigger id="expenseCurrency" aria-label="Expense Currency">
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              {isDropdownDataLoading && availableCurrencies.length === 0 ? (
                 <SelectItem value={DEFAULT_CURRENCY} disabled>Loading...</SelectItem>
              ) : (
                availableCurrencies.map(curr => (
                  <SelectItem key={curr.code} value={curr.code}>{curr.name} ({curr.code})</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {(!!selectedAccountCurrency || (initialData && initialData.account_id)) && <p className="text-xs text-muted-foreground mt-1">Currency is set by the selected account.</p>}
           {initialData && !initialData.account_id && <p className="text-xs text-muted-foreground mt-1">Currency cannot be changed for existing expenses.</p>}
        </div>
      </div>
      
      <div>
        <Label htmlFor="expenseCategoryIdSelect">Category</Label>
        <Select value={expenseCategoryId?.toString() || ''} onValueChange={(value) => setExpenseCategoryId(value ? Number(value) : null)} required disabled={isFormDisabled}>
          <SelectTrigger id="expenseCategoryIdSelect" aria-label="Expense Category">
            <SelectValue placeholder={isDropdownDataLoading && dbCategories.length === 0 ? "Loading categories..." : "Select a category"} />
          </SelectTrigger>
          <SelectContent>
            {isDropdownDataLoading && dbCategories.length === 0 && <SelectItem value={CATEGORY_LOADING_PLACEHOLDER_VALUE} disabled>Loading...</SelectItem>}
            {!isDropdownDataLoading && dbCategories.length === 0 && <SelectItem value="no_categories_found" disabled>No categories available.</SelectItem>}
            {dbCategories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id.toString()}>{getDisplayCategoryName(cat.name)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {userAccounts.length > 0 && (
        <div>
          <Label htmlFor="expenseAccountId">Paid from Account (<span className="text-muted-foreground text-xs">Optional</span>)</Label>
          <Select value={accountId || NO_ACCOUNT_SELECTED_VALUE} onValueChange={handleAccountChange} disabled={isFormDisabled}>
            <SelectTrigger id="expenseAccountId" aria-label="Account Paid From"><SelectValue placeholder="Select an account" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_ACCOUNT_SELECTED_VALUE}><em>No specific account / Cash</em></SelectItem>
              {userAccounts.map((acc) => {
              // Create a proper AllCurrenciesData object with all required currency properties
              const allCurrenciesData = availableCurrencies.reduce((acc, currency) => {
                acc[currency.code] = currency;
                return acc;
              }, {} as AllCurrenciesData);
              
              return (
                <SelectItem key={acc.id} value={acc.id!}>
                  {acc.name} ({formatCurrency(acc.balance_native, acc.native_currency_code, acc.native_currency_code, allCurrenciesData, {} as any)})
                </SelectItem>
              );
            })}
            </SelectContent>
          </Select>
        </div>
      )}

      <div><Label htmlFor="expenseDate">Date</Label><DatePicker date={date} setDate={setDate} /></div>

      <div className="flex items-center space-x-2 pt-2">
        <Switch id="expenseIsRecurring" checked={isRecurring} onCheckedChange={setIsRecurring} disabled={isFormDisabled}/>
        <Label htmlFor="expenseIsRecurring" className="cursor-pointer">Is this a recurring expense?</Label>
      </div>

      {isRecurring && (
        <div>
          <Label htmlFor="expenseRecurrenceFrequency">Recurrence Frequency</Label>
          <Select value={recurrenceFrequency} onValueChange={(value) => setRecurrenceFrequency(value as RecurrenceFrequency)} required={isRecurring} disabled={isFormDisabled}>
            <SelectTrigger id="expenseRecurrenceFrequency" aria-label="Recurrence Frequency"><SelectValue placeholder="Select frequency" /></SelectTrigger>
            <SelectContent>
              {recurrenceFrequencies.map((freq) => (<SelectItem key={freq} value={freq}>{freq.charAt(0).toUpperCase() + freq.slice(1)}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      )}

      {userDebts.length > 0 && (
         <div>
          <Label htmlFor="relatedDebtId">Is this a Debt Payment? (<span className="text-muted-foreground text-xs">Optional</span>)</Label>
          <Select value={relatedDebtId || NO_DEBT_RELATED_VALUE} onValueChange={(value) => setRelatedDebtId(value === NO_DEBT_RELATED_VALUE ? null : value)} disabled={isFormDisabled}>
            <SelectTrigger id="relatedDebtId" aria-label="Related Debt"><SelectValue placeholder="Select a debt if applicable" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_DEBT_RELATED_VALUE}><em>Not a debt payment</em></SelectItem>
              {userDebts.map((debt) => {
                const allCurrenciesData = availableCurrencies.reduce((acc, currency) => {
                  acc[currency.code] = currency;
                  return acc;
                }, {} as AllCurrenciesData);
                const emptyExchangeRates: Record<CurrencyCode, number> = availableCurrencies.reduce((acc, currency) => {
                  acc[currency.code] = 1; // Set a default value, like 1
                  return acc;
                }, {} as Record<CurrencyCode, number>);
                return (
                  <SelectItem key={debt.id} value={debt.id!}>
                    {debt.creditor} (Owing: {formatCurrency(debt.current_balance_native, debt.currency_code, debt.currency_code, allCurrenciesData, emptyExchangeRates)})
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      <div><Label htmlFor="expenseDate">Date</Label><DatePicker date={date} setDate={setDate} /></div>

      <div>
        <Label htmlFor="expenseDescription">Description (<span className="text-muted-foreground text-xs">Optional</span>)</Label>
        <Textarea id="expenseDescription" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g., Groceries, Lunch with client" disabled={isFormDisabled}/>
      </div>

      {formError && <p className="text-sm text-red-600">{formError}</p>}
      <div className="flex gap-2 pt-2 justify-end">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel} disabled={isFormDisabled}>Cancel</Button>}
        <Button type="submit" disabled={isFormDisabled}>
          {isFormDisabled && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {initialData?.id ? 'Update Expense' : 'Add Expense'}
        </Button>
      </div>
    </form>
  );
}
