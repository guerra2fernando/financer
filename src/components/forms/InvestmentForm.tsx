// src/components/forms/InvestmentForm.tsx
'use client';

import React, { useState, useEffect, FormEvent, useMemo } from 'react';
import {
  Investment,
  InvestmentInsert, // Type from investmentService or types/index.ts
  InvestmentUpdate, // Type from investmentService or types/index.ts
  Currency,         // For type reference
  CurrencyContextProps,
  Account,
} from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addInvestment, updateInvestment } from '@/services/investmentService';
import { getAccountsByUserId } from '@/services/accountService'; // To link to an account
import { format as formatDateFns, parseISO } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { DEFAULT_CURRENCY, CurrencyCode } from '@/lib/constants';

export interface InvestmentFormProps {
  userId: string;
  initialData?: Investment | null;
  onSubmitSuccess: (newOrUpdatedInvestment: Investment) => void;
  onCancel?: () => void;
  currencyContext: CurrencyContextProps;
}

// Common investment types - adjust as needed
const INVESTMENT_TYPES = ['Stock', 'Bond', 'ETF', 'Mutual Fund', 'Cryptocurrency', 'Real Estate', 'Other'];
const NO_ACCOUNT_SELECTED_VALUE = "__NO_ACCOUNT_SELECTED_INVESTMENT__";


export default function InvestmentForm({
  userId,
  initialData,
  onSubmitSuccess,
  onCancel,
  currencyContext,
}: InvestmentFormProps) {
  const supabase = createClient();
  const { allCurrenciesData, userPreferredCurrency } = currencyContext;

  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>(
    initialData?.currency_code || userPreferredCurrency || DEFAULT_CURRENCY
  );
  const [quantity, setQuantity] = useState<string>(''); // String for input
  const [purchasePricePerUnitNative, setPurchasePricePerUnitNative] = useState<string>('');
  const [currentPricePerUnitNative, setCurrentPricePerUnitNative] = useState<string>('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [monthlyGoalNative, setMonthlyGoalNative] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState<string>('');

  const [userAccounts, setUserAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true); // For accounts
  const [formError, setFormError] = useState<string | null>(null);

  const availableCurrenciesForSelect = useMemo(() => {
    return Object.values(allCurrenciesData).filter(Boolean) as Currency[];
  }, [allCurrenciesData]);

  useEffect(() => {
    const fetchAccounts = async () => {
      if (!userId) return;
      setIsDataLoading(true);
      const { data, error } = await getAccountsByUserId(supabase, userId);
      if (error) {
        toast.error("Failed to load accounts for linking.");
      } else {
        setUserAccounts(data || []);
      }
      setIsDataLoading(false);
    };
    fetchAccounts();
  }, [userId, supabase]);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setType(initialData.type || '');
      setCurrencyCode(initialData.currency_code || userPreferredCurrency || DEFAULT_CURRENCY);
      setQuantity(initialData.quantity?.toString() || '');
      setPurchasePricePerUnitNative(initialData.purchase_price_per_unit_native?.toString() || '');
      setCurrentPricePerUnitNative(initialData.current_price_per_unit_native?.toString() || '');
      setAccountId(initialData.account_id || null);
      setMonthlyGoalNative(initialData.monthly_goal_native?.toString() || '');
      setStartDate(initialData.start_date ? parseISO(initialData.start_date) : undefined);
      setNotes(initialData.notes || '');
    } else {
      // Reset for new form
      setName('');
      setType('');
      setCurrencyCode(userPreferredCurrency || DEFAULT_CURRENCY);
      setQuantity('');
      setPurchasePricePerUnitNative('');
      setCurrentPricePerUnitNative('');
      setAccountId(null);
      setMonthlyGoalNative('');
      setStartDate(undefined); // Or new Date() if preferred
      setNotes('');
    }
  }, [initialData, userPreferredCurrency]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFormError(null);

    // Validations
    if (!name.trim()) { setFormError("Investment name is required."); setIsLoading(false); return; }
    if (!type.trim()) { setFormError("Investment type is required."); setIsLoading(false); return; }
    if (!currencyCode) { setFormError("Currency is required."); setIsLoading(false); return; }

    const parsedQuantity = quantity.trim() ? parseFloat(quantity) : null;
    if (quantity.trim() && (parsedQuantity === null || isNaN(parsedQuantity) || parsedQuantity < 0)) {
      setFormError("Quantity must be a non-negative number if provided."); setIsLoading(false); return;
    }

    const parsedPurchasePrice = purchasePricePerUnitNative.trim() ? parseFloat(purchasePricePerUnitNative) : null;
    if (purchasePricePerUnitNative.trim() && (parsedPurchasePrice === null || isNaN(parsedPurchasePrice) || parsedPurchasePrice < 0)) {
      setFormError("Purchase price must be a non-negative number if provided."); setIsLoading(false); return;
    }
    
    const parsedCurrentPrice = currentPricePerUnitNative.trim() ? parseFloat(currentPricePerUnitNative) : null;
    if (currentPricePerUnitNative.trim() && (parsedCurrentPrice === null || isNaN(parsedCurrentPrice) || parsedCurrentPrice < 0)) {
      setFormError("Current price must be a non-negative number if provided."); setIsLoading(false); return;
    }
    
    const parsedMonthlyGoal = monthlyGoalNative.trim() ? parseFloat(monthlyGoalNative) : null;
    if (monthlyGoalNative.trim() && (parsedMonthlyGoal === null || isNaN(parsedMonthlyGoal) || parsedMonthlyGoal < 0)) {
        setFormError("Monthly goal must be a non-negative number if provided."); setIsLoading(false); return;
    }


    const investmentPayloadBase = {
      name: name.trim(),
      type: type.trim(),
      currency_code: currencyCode,
      quantity: parsedQuantity,
      purchase_price_per_unit_native: parsedPurchasePrice,
      current_price_per_unit_native: parsedCurrentPrice, // Can be different from purchase price
      account_id: accountId === NO_ACCOUNT_SELECTED_VALUE ? null : accountId,
      monthly_goal_native: parsedMonthlyGoal,
      start_date: startDate ? formatDateFns(startDate, 'yyyy-MM-dd') : null,
      notes: notes.trim() || null,
    };

    let result;
    if (initialData?.id) {
      // For updates, currency_code is fixed. Some fields like purchase price might also be fixed post-initial setup.
      // The InvestmentUpdate type definition from types/index.ts dictates what can be updated.
      const updateData: InvestmentUpdate = {
        name: investmentPayloadBase.name,
        type: investmentPayloadBase.type,
        // currency_code typically not updated for existing investment
        quantity: investmentPayloadBase.quantity, // Allow quantity updates here if it's not solely via transactions
        current_price_per_unit_native: investmentPayloadBase.current_price_per_unit_native,
        // purchase_price_per_unit_native typically not updated
        account_id: investmentPayloadBase.account_id,
        monthly_goal_native: investmentPayloadBase.monthly_goal_native,
        start_date: investmentPayloadBase.start_date,
        notes: investmentPayloadBase.notes,
      };
      result = await updateInvestment(supabase, initialData.id, updateData);
    } else {
      const insertData: InvestmentInsert = {
        ...investmentPayloadBase,
        user_id: userId,
      };
      result = await addInvestment(supabase, insertData);
    }

    setIsLoading(false);
    if (result.error) {
      console.error('Error saving investment:', result.error);
      setFormError(result.error.message);
      toast.error(`Error: ${result.error.message}`);
    } else if (result.data) {
      toast.success(`Investment ${initialData ? 'updated' : 'added'} successfully!`);
      onSubmitSuccess(result.data);
    } else {
      setFormError("An unexpected issue occurred. Investment data not returned.");
      toast.error("An unexpected issue occurred.");
    }
  };

  const isSubmitting = isLoading || isDataLoading;
  const currentSelectedCurrency = currencyCode || DEFAULT_CURRENCY;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      <div><Label htmlFor="investmentName">Investment Name</Label><Input id="investmentName" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g., Vanguard S&P 500 ETF" disabled={isSubmitting}/></div>
      <div><Label htmlFor="investmentType">Type</Label>
        <Select value={type} onValueChange={setType} required disabled={isSubmitting}>
            <SelectTrigger id="investmentType"><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
                {INVESTMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label htmlFor="investmentCurrency">Currency</Label>
        <Select 
            value={currencyCode} 
            onValueChange={(value) => setCurrencyCode(value as CurrencyCode)} 
            required 
            disabled={isSubmitting || !!initialData} // Currency fixed after creation
        >
            <SelectTrigger id="investmentCurrency" aria-label="Investment Currency">
                <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
                {availableCurrenciesForSelect.length === 0 ? (
                    <SelectItem value={DEFAULT_CURRENCY} disabled>Loading currencies...</SelectItem>
                ) : (
                    availableCurrenciesForSelect.map(curr => (
                    <SelectItem key={curr.code} value={curr.code}>{curr.name} ({curr.code})</SelectItem>
                    ))
                )}
            </SelectContent>
        </Select>
        {!!initialData && <p className="text-xs text-muted-foreground mt-1">Currency cannot be changed for existing investments.</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><Label htmlFor="quantity">Quantity (<span className="text-xs text-muted-foreground">Optional if unknown</span>)</Label><Input id="quantity" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g., 10" step="any" disabled={isSubmitting}/></div>
        <div><Label htmlFor="purchasePrice">Purchase Price / Unit ({currentSelectedCurrency}) (<span className="text-xs text-muted-foreground">Optional</span>)</Label><Input id="purchasePrice" type="number" value={purchasePricePerUnitNative} onChange={(e) => setPurchasePricePerUnitNative(e.target.value)} placeholder="e.g., 150.75" step="any" disabled={isSubmitting}/></div>
      </div>
      
      <div><Label htmlFor="currentPrice">Current Price / Unit ({currentSelectedCurrency}) (<span className="text-xs text-muted-foreground">Optional</span>)</Label><Input id="currentPrice" type="number" value={currentPricePerUnitNative} onChange={(e) => setCurrentPricePerUnitNative(e.target.value)} placeholder="e.g., 165.50" step="any" disabled={isSubmitting}/></div>

      {userAccounts.length > 0 && (
        <div>
          <Label htmlFor="investmentAccountId">Funding Account (<span className="text-muted-foreground text-xs">Optional</span>)</Label>
          <Select value={accountId || NO_ACCOUNT_SELECTED_VALUE} onValueChange={(val) => setAccountId(val === NO_ACCOUNT_SELECTED_VALUE ? null : val)} disabled={isSubmitting}>
            <SelectTrigger id="investmentAccountId"><SelectValue placeholder={isDataLoading ? "Loading accounts..." : "Select an account"} /></SelectTrigger>
            <SelectContent>
              {isDataLoading && userAccounts.length === 0 && <SelectItem value="" disabled>Loading...</SelectItem>}
              <SelectItem value={NO_ACCOUNT_SELECTED_VALUE}><em>No specific account</em></SelectItem>
              {userAccounts.map((acc) => ( <SelectItem key={acc.id} value={acc.id}> {acc.name} ({acc.native_currency_code}) </SelectItem> ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div><Label htmlFor="monthlyGoalNative">Monthly Contribution Goal ({currentSelectedCurrency}) (<span className="text-xs text-muted-foreground">Optional</span>)</Label><Input id="monthlyGoalNative" type="number" value={monthlyGoalNative} onChange={(e) => setMonthlyGoalNative(e.target.value)} placeholder="e.g., 200" step="any" disabled={isSubmitting}/></div>
      <div><Label htmlFor="startDate">Start Date / Purchase Date (<span className="text-xs text-muted-foreground">Optional</span>)</Label><DatePicker date={startDate} setDate={setStartDate} disabled={isSubmitting}/></div>
      <div><Label htmlFor="notes">Notes (<span className="text-xs text-muted-foreground">Optional</span>)</Label><Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g., Long-term hold, retirement portfolio" disabled={isSubmitting}/></div>

      {formError && <p className="text-sm text-red-600">{formError}</p>}
      <div className="flex gap-2 pt-2 justify-end">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {initialData?.id ? 'Update Investment' : 'Add Investment'}
        </Button>
      </div>
    </form>
  );
}
