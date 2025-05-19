/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/forms/IncomeForm.tsx
'use client';

import React, { useState, useEffect, FormEvent, useCallback, useMemo } from 'react'; // Added useMemo
import {
  Income,
  IncomeInsert,
  IncomeUpdate,
  RecurrenceFrequency,
  Account,
  Currency, // Keep for type reference
  CurrencyContextProps, // Import CurrencyContextProps
} from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addIncome, updateIncome } from '@/services/incomeService';
import { getAccountsByUserId } from '@/services/accountService';
// getCurrencies no longer needed, comes from context
import { format as formatDateFns, parseISO } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { DEFAULT_CURRENCY, CurrencyCode } from '@/lib/constants';

interface IncomeFormProps {
  userId: string;
  initialData?: Income | null;
  onSubmitSuccess: (newOrUpdatedIncome: Income) => void;
  onCancel?: () => void;
  currencyContext: CurrencyContextProps; // Add currencyContext prop
}

const recurrenceFrequencies: RecurrenceFrequency[] = ['daily', 'weekly', 'monthly', 'yearly'];
const NO_ACCOUNT_SELECTED_VALUE = "__NO_ACCOUNT_SELECTED_INCOME__";

export default function IncomeForm({
  userId,
  initialData,
  onSubmitSuccess,
  onCancel,
  currencyContext, // Destructure
}: IncomeFormProps) {
  const supabase = createClient();
  const { allCurrenciesData, currentExchangeRates, userPreferredCurrency } = currencyContext;

  const [sourceName, setSourceName] = useState<string>('');
  const [amountNative, setAmountNative] = useState<string>('');
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>(
    initialData?.currency_code || userPreferredCurrency || DEFAULT_CURRENCY
  );
  const [selectedAccountCurrency, setSelectedAccountCurrency] = useState<CurrencyCode | null>(null);

  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency | ''>('');
  const [description, setDescription] = useState<string>('');
  const [accountId, setAccountId] = useState<string | null>(null);

  const [userAccounts, setUserAccounts] = useState<Account[]>([]);
  // availableCurrencies now from context
  const availableCurrenciesForSelect = useMemo(() => {
      return Object.values(allCurrenciesData).filter(Boolean) as Currency[];
  }, [allCurrenciesData]);

  const [isLoading, setIsLoading] = useState(false);
  const [isAccountDataLoading, setIsAccountDataLoading] = useState(true); // Specific for accounts
  const [formError, setFormError] = useState<string | null>(null);

  const fetchAccountData = useCallback(async () => {
    if (userId) {
      setIsAccountDataLoading(true);
      try {
        const accountsRes = await getAccountsByUserId(supabase, userId);
        if (accountsRes.error) toast.error("Failed to load accounts.");
        else setUserAccounts(accountsRes.data || []);
      } catch (e: any) {
        toast.error("Error fetching account data: " + (e as Error).message);
      } finally {
        setIsAccountDataLoading(false);
      }
    }
  }, [userId, supabase]);

  useEffect(() => {
    fetchAccountData();
  }, [fetchAccountData]);

  useEffect(() => {
    if (initialData) {
      setSourceName(initialData.source_name || '');
      setAmountNative(initialData.amount_native.toString());
      setCurrencyCode(initialData.currency_code); // Will be set by account if linked, or is fixed
      setStartDate(initialData.start_date ? parseISO(initialData.start_date) : new Date());
      setEndDate(initialData.end_date ? parseISO(initialData.end_date) : undefined);
      setIsRecurring(initialData.is_recurring || false);
      setRecurrenceFrequency((initialData.recurrence_frequency as RecurrenceFrequency) || '');
      setDescription(initialData.description || '');
      setAccountId(initialData.account_id || null);

      if (initialData.account_id && userAccounts.length > 0) { // Ensure userAccounts is populated
        const linkedAccount = userAccounts.find(acc => acc.id === initialData.account_id);
        if (linkedAccount) {
          setCurrencyCode(linkedAccount.native_currency_code);
          setSelectedAccountCurrency(linkedAccount.native_currency_code);
        } else {
             // Account might not be loaded yet, or no longer exists. Fallback to income's own currency.
            setSelectedAccountCurrency(null); // Or handle as error if account MUST exist
            setCurrencyCode(initialData.currency_code);
        }
      } else if (initialData.account_id && userAccounts.length === 0 && !isAccountDataLoading) {
        // Accounts loaded, but linked account not found.
        console.warn(`Linked account for income ${initialData.id} not found.`);
        setSelectedAccountCurrency(null);
        setCurrencyCode(initialData.currency_code);
      }
      else {
        setSelectedAccountCurrency(null);
        // For existing income not linked to an account, currency is fixed.
        setCurrencyCode(initialData.currency_code);
      }
    } else { // New income
      setSourceName('');
      setAmountNative('');
      setCurrencyCode(userPreferredCurrency || DEFAULT_CURRENCY); // Default to user pref
      setStartDate(new Date());
      setEndDate(undefined);
      setIsRecurring(false);
      setRecurrenceFrequency('');
      setDescription('');
      setAccountId(null);
      setSelectedAccountCurrency(null);
    }
  }, [initialData, userAccounts, userPreferredCurrency, isAccountDataLoading]); // Added isAccountDataLoading

  const handleAccountChange = (selectedAccountIdString: string) => {
    const newAccountId = selectedAccountIdString === NO_ACCOUNT_SELECTED_VALUE ? null : selectedAccountIdString;
    setAccountId(newAccountId);
    if (newAccountId) {
      const account = userAccounts.find(acc => acc.id === newAccountId);
      if (account) {
        setCurrencyCode(account.native_currency_code);
        setSelectedAccountCurrency(account.native_currency_code);
      }
    } else {
      setSelectedAccountCurrency(null);
      // If not editing and no account, default to user preferred or general default.
      // If editing an existing unlinked income, its currencyCode should remain.
      if (!initialData) {
        setCurrencyCode(userPreferredCurrency || DEFAULT_CURRENCY);
      } else if (initialData && !initialData.account_id) {
        setCurrencyCode(initialData.currency_code); // Keep original currency if unlinked during edit
      } else {
        // Fallback if initialData has an account_id but it's being unlinked
        setCurrencyCode(userPreferredCurrency || DEFAULT_CURRENCY);
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFormError(null);

    if (!sourceName.trim()) { setFormError("Source name is required."); setIsLoading(false); return; }
    const parsedAmount = parseFloat(amountNative);
    if (isNaN(parsedAmount) || parsedAmount <= 0) { setFormError("Amount must be a positive number."); setIsLoading(false); return; }
    if (!currencyCode) { setFormError("Currency is required."); setIsLoading(false); return; }
    if (!startDate) { setFormError("Start date is required."); setIsLoading(false); return; }
    if (isRecurring && !recurrenceFrequency) { setFormError("Recurrence frequency is required."); setIsLoading(false); return; }

    const incomePayloadBase = {
      source_name: sourceName.trim(),
      amount_native: parsedAmount,
      currency_code: currencyCode, // This is now correctly set
      start_date: formatDateFns(startDate, 'yyyy-MM-dd'),
      end_date: endDate ? formatDateFns(endDate, 'yyyy-MM-dd') : null,
      is_recurring: isRecurring,
      recurrence_frequency: isRecurring ? (recurrenceFrequency as RecurrenceFrequency) : null,
      description: description.trim() || null,
      account_id: accountId,
    };

    let result;
    if (initialData?.id) {
      // For updates, currency_code typically shouldn't change if it's tied to an account or was set initially.
      // The `IncomeUpdate` type omits `currency_code`. If it needs to be updatable (e.g., unlinking from an account),
      // the service and type would need to allow it. For now, assume currency_code is fixed on edit or derived from account.
      const updateData: IncomeUpdate = {
        ...incomePayloadBase,
        // currency_code is intentionally omitted as per IncomeUpdate type definition
        // If it were to change (e.g. unlinking an account), you'd include it here.
        // but then it should be part of IncomeUpdate type.
      };
      if (accountId !== initialData.account_id) { // If account changes, currency might change
         (updateData as any).currency_code = currencyCode; // Allow if account changes
      }

      result = await updateIncome(supabase, initialData.id, updateData);
    } else {
      const insertData: IncomeInsert = {
        ...incomePayloadBase,
        user_id: userId,
      };
      result = await addIncome(supabase, insertData);
    }

    setIsLoading(false);
    if (result.error) {
      console.error('Error saving income:', result.error);
      setFormError(result.error.message);
      toast.error(`Error: ${result.error.message}`);
    } else if (result.data) {
      toast.success(`Income ${initialData ? 'updated' : 'added'} successfully!`);
      onSubmitSuccess(result.data);
    } else {
      setFormError("An unexpected issue occurred. Income data not returned.");
      toast.error("An unexpected issue occurred.");
    }
  };

  const isSubmitting = isLoading || isAccountDataLoading; // Use specific loader for accounts

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      <div>
        <Label htmlFor="sourceName">Source Name</Label>
        <Input id="sourceName" value={sourceName} onChange={(e) => setSourceName(e.target.value)} required placeholder="e.g., Salary - Acme Corp, Freelance Gig" disabled={isSubmitting}/>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="amountNative">Amount ({currencyCode})</Label>
          <Input id="amountNative" type="number" value={amountNative} onChange={(e) => setAmountNative(e.target.value)} required step="0.01" placeholder="e.g., 2500.00" disabled={isSubmitting}/>
        </div>
        <div>
          <Label htmlFor="incomeCurrency">Currency</Label>
          <Select 
            value={currencyCode} 
            onValueChange={(value) => setCurrencyCode(value as CurrencyCode)} 
            required 
            // Currency is editable if no account is selected AND it's a new income.
            // For existing income, it's fixed unless the account linkage changes it.
            disabled={isSubmitting || !!selectedAccountCurrency || (!!initialData && !initialData.account_id)}
          >
            <SelectTrigger id="incomeCurrency" aria-label="Income Currency">
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              {availableCurrenciesForSelect.length === 0 && !isAccountDataLoading ? ( // Check !isAccountDataLoading to show "No currencies" only after load
                <SelectItem value={DEFAULT_CURRENCY} disabled>No currencies found</SelectItem>
              ) : availableCurrenciesForSelect.length === 0 && isAccountDataLoading ? (
                <SelectItem value={DEFAULT_CURRENCY} disabled>Loading...</SelectItem>
              ) : (
                availableCurrenciesForSelect.map(curr => (
                  <SelectItem key={curr.code} value={curr.code}>{curr.name} ({curr.code})</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {!!selectedAccountCurrency && <p className="text-xs text-muted-foreground mt-1">Currency is set by the selected account: {selectedAccountCurrency}.</p>}
          {!!initialData && !initialData.account_id && !selectedAccountCurrency && <p className="text-xs text-muted-foreground mt-1">Currency fixed for this existing income.</p>}
        </div>
      </div>

      {userAccounts.length > 0 && (
        <div>
          <Label htmlFor="accountId">Deposit to Account (<span className="text-muted-foreground text-xs">Optional</span>)</Label>
          <Select value={accountId || NO_ACCOUNT_SELECTED_VALUE} onValueChange={handleAccountChange} disabled={isSubmitting}>
            <SelectTrigger id="accountId"> <SelectValue placeholder={isAccountDataLoading ? "Loading accounts..." : "Select an account"} /> </SelectTrigger>
            <SelectContent>
              {isAccountDataLoading && userAccounts.length === 0 && <SelectItem value="" disabled>Loading...</SelectItem>}
              <SelectItem value={NO_ACCOUNT_SELECTED_VALUE}> <em>No specific account</em> </SelectItem>
              {userAccounts.map((acc) => {
                 const accountCurrencyInfo = allCurrenciesData[acc.native_currency_code];
                 const displayBalance = formatCurrency(
                    acc.balance_native,
                    acc.native_currency_code,
                    acc.native_currency_code, // Display in its native currency
                    allCurrenciesData,       // Pass full context data
                    currentExchangeRates,    // Pass full context data
                    `${acc.balance_native.toFixed(accountCurrencyInfo?.decimal_digits ?? 2)} ${acc.native_currency_code}`
                 );
                return (
                    <SelectItem key={acc.id} value={acc.id!}> {acc.name} ({displayBalance}) </SelectItem> 
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      <div> <Label htmlFor="startDate">Start Date</Label> <DatePicker date={startDate} setDate={setStartDate} disabled={isSubmitting}/> </div>
      <div> <Label htmlFor="endDate">End Date (<span className="text-muted-foreground text-xs">Optional</span>)</Label> <DatePicker date={endDate} setDate={setEndDate} disabled={isSubmitting}/> </div>
      <div className="flex items-center space-x-2 pt-2">
        <Switch id="isRecurring" checked={isRecurring} onCheckedChange={setIsRecurring} disabled={isSubmitting}/>
        <Label htmlFor="isRecurring" className="cursor-pointer">Is this a recurring income?</Label>
      </div>
      {isRecurring && (
        <div>
          <Label htmlFor="recurrenceFrequency">Recurrence Frequency</Label>
          <Select value={recurrenceFrequency} onValueChange={(value) => setRecurrenceFrequency(value as RecurrenceFrequency)} required={isRecurring} disabled={isSubmitting}>
            <SelectTrigger id="recurrenceFrequency"> <SelectValue placeholder="Select frequency" /> </SelectTrigger>
            <SelectContent> {recurrenceFrequencies.map((freq) => ( <SelectItem key={freq} value={freq}> {freq.charAt(0).toUpperCase() + freq.slice(1)} </SelectItem> ))} </SelectContent>
          </Select>
        </div>
      )}
      <div> <Label htmlFor="incomeDescription">Description / Notes (<span className="text-muted-foreground text-xs">Optional</span>)</Label> <Textarea id="incomeDescription" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g., Monthly salary payment" disabled={isSubmitting}/> </div>

      {formError && <p className="text-sm text-red-600">{formError}</p>}
      <div className="flex gap-2 mt-6 justify-end">
        {onCancel && ( <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}> Cancel </Button> )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {initialData?.id ? 'Update Income' : 'Add Income'}
        </Button>
      </div>
    </form>
  );
}
