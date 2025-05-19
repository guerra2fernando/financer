// src/components/forms/FinancialGoalForm.tsx
'use client';

import { useState, useEffect, FormEvent } from 'react';
import type {
  FinancialGoal,
  FinancialGoalInsert,
  FinancialGoalUpdate,
  FinancialGoalStatus,
  Currency, // Keep for type reference if needed, but data comes from context
  CurrencyContextProps, // Import CurrencyContextProps
} from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addFinancialGoal, updateFinancialGoal } from '@/services/financialGoalService';
// getCurrencies is no longer needed here as currency data comes from context
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { format as formatDateFns, parseISO } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { DEFAULT_CURRENCY, CurrencyCode } from '@/lib/constants';

// Define the props interface
export interface FinancialGoalFormProps {
  userId: string;
  initialData?: FinancialGoal | null;
  onSubmitSuccess: (newOrUpdatedGoal: FinancialGoal) => void;
  onCancel?: () => void;
  currencyContext: CurrencyContextProps; // Add currencyContext prop
}

const financialGoalStatuses: FinancialGoalStatus[] = ['active', 'achieved', 'paused', 'cancelled'];

export default function FinancialGoalForm({
  userId,
  initialData,
  onSubmitSuccess,
  onCancel,
  currencyContext, // Destructure currencyContext
}: FinancialGoalFormProps) {
  const [name, setName] = useState<string>('');
  const [targetAmountNative, setTargetAmountNative] = useState<string>('');
  const [currentAmountSavedNativeInitial, setCurrentAmountSavedNativeInitial] = useState<string>('0');
  // Default new goal currency to user's preferred currency or DEFAULT_CURRENCY
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>(
    initialData?.currency_code || currencyContext.userPreferredCurrency || DEFAULT_CURRENCY
  );
  const [targetDate, setTargetDate] = useState<Date | undefined>();
  const [monthlyContributionTargetNative, setMonthlyContributionTargetNative] = useState<string>('');
  const [status, setStatus] = useState<FinancialGoalStatus | ''>('active');
  const [description, setDescription] = useState<string>('');

  // availableCurrencies now comes from currencyContext.allCurrenciesData
  const availableCurrenciesForSelect = Object.values(currencyContext.allCurrenciesData).filter(Boolean) as Currency[];

  const [isLoading, setIsLoading] = useState(false);
  // isCurrenciesLoading is no longer needed as data comes from context
  const [formError, setFormError] = useState<string | null>(null);

  const supabaseBrowserClient = createClient();

  // useEffect for fetching currencies is removed as data comes from context

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setTargetAmountNative(initialData.target_amount_native?.toString() || '');
      setCurrentAmountSavedNativeInitial(initialData.current_amount_saved_native?.toString() || '0');
      setCurrencyCode(initialData.currency_code || currencyContext.userPreferredCurrency || DEFAULT_CURRENCY);
      setTargetDate(initialData.target_date ? parseISO(initialData.target_date) : undefined);
      setMonthlyContributionTargetNative(initialData.monthly_contribution_target_native?.toString() || '');
      setStatus(initialData.status || 'active');
      setDescription(initialData.description || '');
    } else {
      // Resetting for a new goal
      setName('');
      setTargetAmountNative('');
      setCurrentAmountSavedNativeInitial('0');
      setCurrencyCode(currencyContext.userPreferredCurrency || DEFAULT_CURRENCY); // Default to user pref
      setTargetDate(undefined);
      setMonthlyContributionTargetNative('');
      setStatus('active');
      setDescription('');
    }
  }, [initialData, currencyContext.userPreferredCurrency]); // Add currencyContext.userPreferredCurrency to deps

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFormError(null);

    if (!name.trim()) { setFormError("Goal name is required."); setIsLoading(false); return; }
    const parsedTargetAmount = parseFloat(targetAmountNative);
    if (isNaN(parsedTargetAmount) || parsedTargetAmount <= 0) { setFormError("Target amount must be a positive number."); setIsLoading(false); return; }
    if (!currencyCode) { setFormError("Currency is required."); setIsLoading(false); return; }
    
    const parsedCurrentAmountInitial = parseFloat(currentAmountSavedNativeInitial);
    if (!initialData && (isNaN(parsedCurrentAmountInitial) || parsedCurrentAmountInitial < 0)) {
        setFormError("Initial amount saved must be a non-negative number."); setIsLoading(false); return;
    }

    if (!status) { setFormError("Status is required."); setIsLoading(false); return; }

    const parsedMonthlyTarget = monthlyContributionTargetNative.trim() ? parseFloat(monthlyContributionTargetNative) : null;
    if (monthlyContributionTargetNative.trim() && (parsedMonthlyTarget === null || isNaN(parsedMonthlyTarget) || parsedMonthlyTarget <= 0)) {
        setFormError("Monthly contribution target must be a positive number if provided."); setIsLoading(false); return;
    }

    const financialGoalPayloadBase = {
      name: name.trim(),
      target_amount_native: parsedTargetAmount,
      currency_code: currencyCode,
      target_date: targetDate ? formatDateFns(targetDate, 'yyyy-MM-dd') : null,
      monthly_contribution_target_native: parsedMonthlyTarget,
      status: status as FinancialGoalStatus,
      description: description.trim() || null,
    };

    let result;
    if (initialData?.id) {
      const updateData: FinancialGoalUpdate = {
        name: financialGoalPayloadBase.name,
        target_amount_native: financialGoalPayloadBase.target_amount_native, // Allow target amount update
        // currency_code: financialGoalPayloadBase.currency_code, // Usually currency is not changed after creation. If it is, add it here.
        target_date: financialGoalPayloadBase.target_date,
        monthly_contribution_target_native: financialGoalPayloadBase.monthly_contribution_target_native,
        status: financialGoalPayloadBase.status,
        description: financialGoalPayloadBase.description,
      };
      result = await updateFinancialGoal(supabaseBrowserClient, initialData.id, updateData);
    } else {
      const insertData: FinancialGoalInsert = {
        ...financialGoalPayloadBase,
        current_amount_saved_native: parsedCurrentAmountInitial,
        user_id: userId,
      };
      result = await addFinancialGoal(supabaseBrowserClient, insertData);
    }

    setIsLoading(false);
    if (result.error) {
      console.error('Error saving financial goal:', result.error);
      setFormError(result.error.message);
      toast.error(`Error: ${result.error.message}`);
    } else if (result.data){
      toast.success(`Goal ${initialData ? 'updated' : 'added'} successfully!`);
      onSubmitSuccess(result.data);
    } else {
      setFormError("An unexpected issue occurred. Goal data not returned.");
      toast.error("An unexpected issue occurred.");
    }
  };

  const isSubmitting = isLoading; // isCurrenciesLoading removed

  const targetCurrencyInfo = currencyContext.allCurrenciesData[initialData?.currency_code || currencyCode];
  const decimalDigits = targetCurrencyInfo?.decimal_digits ?? 2;


  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      <div><Label htmlFor="goalName">Goal Name</Label><Input id="goalName" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g., Down Payment" disabled={isSubmitting}/></div>
      
      {!initialData && (
        <div>
          <Label htmlFor="goalCurrency">Currency</Label>
          <Select 
            value={currencyCode} 
            onValueChange={(value) => setCurrencyCode(value as CurrencyCode)} 
            disabled={isSubmitting || !!initialData /* Currency fixed after creation */}
          >
            <SelectTrigger id="goalCurrency" aria-label="Goal Currency">
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
        </div>
      )}
      {initialData && (
        <div>
            <Label>Goal Currency</Label>
            <Input 
                value={`${initialData.currency_code} (${currencyContext.allCurrenciesData[initialData.currency_code]?.name || 'N/A'})`} 
                disabled 
            />
            <p className="text-xs text-muted-foreground mt-1">Currency cannot be changed after creation.</p>
        </div>
      )}

      <div>
        <Label htmlFor="targetAmountNative">Target Amount ({initialData ? initialData.currency_code : currencyCode})</Label>
        <Input id="targetAmountNative" type="number" value={targetAmountNative} onChange={(e) => setTargetAmountNative(e.target.value)} required step="0.01" placeholder="e.g., 25000.00" disabled={isSubmitting}/>
      </div>
      
      {initialData ? (
        <div>
          <Label>Current Amount Saved ({initialData.currency_code})</Label>
          <Input 
            value={initialData.current_amount_saved_native.toFixed(decimalDigits)} 
            disabled 
          />
          <p className="text-xs text-muted-foreground mt-1">Contributions will update this amount.</p>
        </div>
      ) : (
        <div>
          <Label htmlFor="currentAmountSavedNativeInitial">Initial Amount Saved ({currencyCode})</Label>
          <Input id="currentAmountSavedNativeInitial" type="number" value={currentAmountSavedNativeInitial} onChange={(e) => setCurrentAmountSavedNativeInitial(e.target.value)} required step="0.01" placeholder="e.g., 5000.00" disabled={isSubmitting}/>
        </div>
      )}

<div><Label htmlFor="targetDate">Target Date (<span className="text-muted-foreground text-xs">Optional</span>)</Label><DatePicker date={targetDate} setDate={setTargetDate} disabled={isSubmitting} /></div>
      <div>
        <Label htmlFor="monthlyContributionTargetNative">Monthly Contribution Target ({initialData ? initialData.currency_code : currencyCode} <span className="text-muted-foreground text-xs">Optional</span>)</Label>
        <Input id="monthlyContributionTargetNative" type="number" value={monthlyContributionTargetNative} onChange={(e) => setMonthlyContributionTargetNative(e.target.value)} step="0.01" placeholder="e.g., 500.00" disabled={isSubmitting}/>
      </div>
      <div><Label htmlFor="goalStatus">Status</Label>
         <Select value={status} onValueChange={(value) => setStatus(value as FinancialGoalStatus)} required disabled={isSubmitting}>
            <SelectTrigger id="goalStatus" aria-label="Goal Status"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {financialGoalStatuses.map(s => (<SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>))}
            </SelectContent>
         </Select>
      </div>
      <div><Label htmlFor="goalDescription">Description (<span className="text-muted-foreground text-xs">Optional</span>)</Label><Textarea id="goalDescription" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g., Saving for a house down payment." disabled={isSubmitting}/></div>

      {formError && <p className="text-sm text-red-600">{formError}</p>}
      <div className="flex gap-2 pt-2 justify-end">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {initialData?.id ? 'Update Goal' : 'Add Goal'}
        </Button>
      </div>
    </form>
  );
}
