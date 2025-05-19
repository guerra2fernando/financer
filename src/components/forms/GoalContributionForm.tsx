/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// src/components/forms/GoalContributionForm.tsx
'use client';

import React, { useState, useEffect, FormEvent, useCallback, useMemo } from 'react';
import type {
  GoalContribution,
  GoalContributionInsert,
  FinancialGoal,
  Account,
  Currency, // Kept for type reference if needed
  CurrencyContextProps, // Import CurrencyContextProps
} from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  addGoalContribution,
  getFinancialGoalsByUserId, // Still used to fetch updated goal data after contribution
} from '@/services/financialGoalService';
import { getAccountsByUserId } from '@/services/accountService';
// getCurrencies and getMultipleExchangeRates no longer needed here
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { format as formatDateFns } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { DEFAULT_CURRENCY, CurrencyCode } from '@/lib/constants';

// Define the props interface for GoalContributionForm
interface GoalContributionFormProps {
  userId: string;
  goalId: string;
  goalCurrency: CurrencyCode;
  onSubmitSuccess: (newContribution: GoalContribution, updatedGoal?: FinancialGoal) => void;
  onCancel?: () => void;
  currencyContext: CurrencyContextProps;
}

const NO_ACCOUNT_SELECTED_VALUE = "no_account_selected_contribution";

export default function GoalContributionForm({
  userId,
  goalId,
  goalCurrency,
  onSubmitSuccess,
  onCancel,
  currencyContext,
}: GoalContributionFormProps) {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [contributionAmountNative, setContributionAmountNative] = useState<string>('');
  const [contributionCurrencyCode, setContributionCurrencyCode] = useState<CurrencyCode>(goalCurrency);
  const [selectedAccountCurrency, setSelectedAccountCurrency] = useState<CurrencyCode | null>(null);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [notes, setNotes] = useState<string>('');

  const [userAccounts, setUserAccounts] = useState<Account[]>([]);
  // Destructure from currencyContext
  const { allCurrenciesData, currentExchangeRates: exchangeRates } = currencyContext;

  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true); // For fetching accounts
  const [formError, setFormError] = useState<string | null>(null);

  const supabaseBrowserClient = createClient();

  const availableCurrenciesForSelect = useMemo(() => {
    return Object.values(allCurrenciesData).filter(Boolean) as Currency[];
  }, [allCurrenciesData]);

  const fetchAccountData = useCallback(async () => { // Renamed from fetchDropdownData
    if (userId) {
      setIsDataLoading(true);
      try {
        const accountsRes = await getAccountsByUserId(supabaseBrowserClient, userId);
        if (accountsRes.error) toast.error("Failed to load accounts.");
        else setUserAccounts(accountsRes.data || []);
      } catch (e: any) {
        toast.error("Error fetching account data: " + (e as Error).message);
      } finally {
        setIsDataLoading(false);
      }
    }
  }, [userId, supabaseBrowserClient]);

  useEffect(() => {
    fetchAccountData();
  }, [fetchAccountData]);

  useEffect(() => {
    // When goalCurrency prop changes (e.g., different goal selected in parent),
    // and no account is selected, reset contribution currency.
    if (!selectedAccountCurrency) {
        setContributionCurrencyCode(goalCurrency);
    }
  }, [goalCurrency, selectedAccountCurrency]);

  const handleAccountChange = (selectedAccountIdString: string) => {
    const newAccountId = selectedAccountIdString === NO_ACCOUNT_SELECTED_VALUE ? null : selectedAccountIdString;
    setAccountId(newAccountId);
    if (newAccountId) {
      const account = userAccounts.find(acc => acc.id === newAccountId);
      if (account) {
        setContributionCurrencyCode(account.native_currency_code);
        setSelectedAccountCurrency(account.native_currency_code);
      }
    } else {
      setSelectedAccountCurrency(null);
      setContributionCurrencyCode(goalCurrency); // Default to goal's currency if no account
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFormError(null);

    if (!goalId) { setFormError("Financial Goal ID is missing."); setIsLoading(false); return; }
    const parsedAmount = parseFloat(contributionAmountNative);
    if (isNaN(parsedAmount) || parsedAmount <= 0) { setFormError("Amount must be a positive number."); setIsLoading(false); return; }
    if (!contributionCurrencyCode) { setFormError("Contribution currency is required."); setIsLoading(false); return; }
    if (!date) { setFormError("Date is required."); setIsLoading(false); return; }

    const contributionPayload: GoalContributionInsert = {
      user_id: userId,
      goal_id: goalId,
      account_id: accountId || null,
      amount_native: parsedAmount,
      currency_code: contributionCurrencyCode,
      date: formatDateFns(date, 'yyyy-MM-dd'),
      notes: notes.trim() || null,
    };

    const result = await addGoalContribution(supabaseBrowserClient, contributionPayload);

    if (result.error) {
      console.error('Error adding goal contribution:', result.error);
      setFormError(result.error.message);
      toast.error(`Error: ${result.error.message}`);
      setIsLoading(false);
    } else if (result.data) {
      toast.success('Contribution added successfully!');
      
      const updatedGoalResult = await getFinancialGoalsByUserId(supabaseBrowserClient, userId);
      let updatedGoalData: FinancialGoal | undefined = undefined;
      if (!updatedGoalResult.error && updatedGoalResult.data) {
          updatedGoalData = updatedGoalResult.data.find(g => g.id === goalId);
           // Check if parent's goal state needs to be passed or re-fetched for accurate "achieved" toast
           // This simplified check might not be fully accurate without knowing previous state.
           if (updatedGoalData?.status === 'achieved') {
               toast.info(`Goal "${updatedGoalData.name}" achieved!`);
           }
      }
      onSubmitSuccess(result.data as GoalContribution, updatedGoalData);
      setContributionAmountNative('');
      setNotes('');
      // Optionally reset account selection and related states
      // setAccountId(null);
      // setSelectedAccountCurrency(null);
      // setContributionCurrencyCode(goalCurrency); // Reset to goal's currency
    } else {
      setFormError("Unexpected issue. Contribution data not returned.");
      toast.error("An unexpected issue occurred.");
      setIsLoading(false);
    }
  };
  
  const isSubmitting = isLoading || isDataLoading; // isDataLoading refers to accounts fetching

  const currentGoalInfo = currencyContext.allCurrenciesData[goalCurrency];
  const contributionCurrencyInfo = currencyContext.allCurrenciesData[contributionCurrencyCode];

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      {/* Displaying target goal currency for clarity */}
      <p className="text-sm text-muted-foreground">
        Contributing to goal in {goalCurrency} (
        {currentGoalInfo?.name || 'Unknown Currency'}
        ).
      </p>

       {userAccounts.length > 0 && (
        <div>
          <Label htmlFor="contributionAccountId">Source Account (<span className="text-muted-foreground text-xs">Optional</span>)</Label>
          <Select value={accountId || NO_ACCOUNT_SELECTED_VALUE} onValueChange={handleAccountChange} disabled={isSubmitting}>
            <SelectTrigger id="contributionAccountId" aria-label="Source Account">
                <SelectValue placeholder={isDataLoading ? "Loading accounts..." : "Select an account"} />
            </SelectTrigger>
            <SelectContent>
              {isDataLoading && userAccounts.length === 0 && <SelectItem value="" disabled>Loading...</SelectItem>}
              <SelectItem value={NO_ACCOUNT_SELECTED_VALUE}><em>No specific account / Cash</em></SelectItem>
              {userAccounts.map((acc) => {
                const accountCurrencyInfo = allCurrenciesData[acc.native_currency_code];
                const displayBalance = formatCurrency(
                    acc.balance_native, 
                    acc.native_currency_code, 
                    acc.native_currency_code, // Display in its native currency
                    allCurrenciesData, 
                    exchangeRates, // Pass full exchange rates map
                    `${acc.balance_native.toFixed(accountCurrencyInfo?.decimal_digits ?? 2)} ${acc.native_currency_code}`
                );
                return (
                    <SelectItem key={acc.id} value={acc.id!}>
                        {acc.name} ({displayBalance})
                    </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="contributionAmountNative">Amount ({contributionCurrencyCode})</Label>
          <Input id="contributionAmountNative" type="number" value={contributionAmountNative} onChange={(e) => setContributionAmountNative(e.target.value)} required step="0.01" placeholder="e.g., 100.00" disabled={isSubmitting}/>
        </div>
        <div>
          <Label htmlFor="contributionCurrency">Contribution Currency</Label>
          <Select 
            value={contributionCurrencyCode} 
            onValueChange={(value) => setContributionCurrencyCode(value as CurrencyCode)} 
            required 
            disabled={isSubmitting || !!selectedAccountCurrency /* Disabled if account is selected */}
          >
            <SelectTrigger id="contributionCurrency" aria-label="Contribution Currency">
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              {availableCurrenciesForSelect.length === 0 ? (
                <SelectItem value={DEFAULT_CURRENCY} disabled>No currencies available</SelectItem>
              ) : (
                availableCurrenciesForSelect.map(curr => (
                  <SelectItem key={curr.code} value={curr.code}>{curr.name} ({curr.code})</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {!!selectedAccountCurrency && <p className="text-xs text-muted-foreground mt-1">Currency is set by the selected account: {selectedAccountCurrency}.</p>}
          {!selectedAccountCurrency && <p className="text-xs text-muted-foreground mt-1">Defaulted to goals currency: {goalCurrency}. You can change it if not using an account.</p>}
        </div>
      </div>

<div><Label htmlFor="contributionDate">Date</Label><DatePicker date={date} setDate={setDate} disabled={isSubmitting}/></div>
      <div><Label htmlFor="contributionNotes">Notes (<span className="text-muted-foreground text-xs">Optional</span>)</Label><Textarea id="contributionNotes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g., Monthly savings transfer" disabled={isSubmitting}/></div>

      {formError && <p className="text-sm text-red-600">{formError}</p>}
      <div className="flex gap-2 pt-2 justify-end">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>}
        <Button type="submit" disabled={isSubmitting || !goalId}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Add Contribution
        </Button>
      </div>
    </form>
  );
}
