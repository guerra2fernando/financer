/* eslint-disable @typescript-eslint/no-unused-vars */
// src/components/forms/InvestmentTransactionForm.tsx
'use client';

import React, { useState, useEffect, FormEvent, useMemo } from 'react';
import {
  InvestmentTransaction,
  InvestmentTransactionInsert, // From investmentService or types/index.ts
  // InvestmentTransactionUpdate, // If updates were allowed from here
  InvestmentTransactionType,
  Currency, Account,
  CurrencyContextProps,
} from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addInvestmentTransaction } from '@/services/investmentService';
import { getAccountsByUserId } from '@/services/accountService';
import { format as formatDateFns } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { CurrencyCode, DEFAULT_CURRENCY } from '@/lib/constants';

export interface InvestmentTransactionFormProps {
  userId: string;
  investmentId: string;
  investmentCurrency: CurrencyCode; // Native currency of the parent investment
  onSubmitSuccess: (newTransaction: InvestmentTransaction) => void;
  onCancel?: () => void;
  currencyContext: CurrencyContextProps;
}

const transactionTypes: InvestmentTransactionType[] = ['buy', 'sell', 'dividend', 'reinvest'];
const NO_ACCOUNT_SELECTED_VALUE = "__NO_ACCOUNT_SELECTED_INVEST_TX__";

export default function InvestmentTransactionForm({
  userId,
  investmentId,
  investmentCurrency,
  onSubmitSuccess,
  onCancel,
  currencyContext,
}: InvestmentTransactionFormProps) {
  const supabase = createClient();
  const { allCurrenciesData } = currencyContext; // We primarily need allCurrenciesData for cash account currency dropdown

  const [transactionType, setTransactionType] = useState<InvestmentTransactionType | ''>('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [quantity, setQuantity] = useState<string>('');
  const [pricePerUnitNative, setPricePerUnitNative] = useState<string>(''); // In investment's native currency
  const [feesNative, setFeesNative] = useState<string>(''); // Optional, in investment's native currency
  const [cashAccountId, setCashAccountId] = useState<string | null>(null); // Account for cash movement (buy/sell/dividend)
  // The currency of the transaction itself (for price/fees) is investmentCurrency.
  // If cashAccountId is used, that account might have a *different* native currency.
  // The DB trigger `trg_update_account_balance_from_investment_tx` needs to handle conversion if cash account currency != investment currency.
  const [notes, setNotes] = useState<string>('');

  const [userCashAccounts, setUserCashAccounts] = useState<Account[]>([]); // For dropdown
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true); // For accounts
  const [formError, setFormError] = useState<string | null>(null);

  // For displaying currency of cash accounts in dropdown
  const availableCurrenciesForSelect = useMemo(() => {
    return Object.values(allCurrenciesData).filter(Boolean) as Currency[];
  }, [allCurrenciesData]);


  useEffect(() => {
    const fetchCashAccounts = async () => {
      if (!userId) return;
      setIsDataLoading(true);
      // Fetch accounts that can be used for cash component of transactions
      const { data, error } = await getAccountsByUserId(supabase, userId);
      if (error) {
        toast.error("Failed to load cash accounts.");
      } else {
        // Filter for typical cash/bank accounts if needed, or show all
        setUserCashAccounts(data?.filter(acc => ['cash', 'bank_account', 'e-wallet'].includes(acc.type)) || []);
      }
      setIsDataLoading(false);
    };
    fetchCashAccounts();
  }, [userId, supabase]);
  
  // Reset form when investmentId changes (though typically form is opened for a specific one)
  useEffect(() => {
    setTransactionType('');
    setDate(new Date());
    setQuantity('');
    setPricePerUnitNative('');
    setFeesNative('');
    setCashAccountId(null);
    setNotes('');
  }, [investmentId]);


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFormError(null);

    if (!transactionType) { setFormError("Transaction type is required."); setIsLoading(false); return; }
    if (!date) { setFormError("Date is required."); setIsLoading(false); return; }

    const parsedQuantity = parseFloat(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      setFormError("Quantity must be a positive number."); setIsLoading(false); return;
    }
    
    // Price is required for buy/sell/reinvest, optional for pure dividend
    const parsedPrice = parseFloat(pricePerUnitNative);
    if (['buy', 'sell', 'reinvest'].includes(transactionType) && (isNaN(parsedPrice) || parsedPrice < 0) ) { // Price can be 0 for some scenarios like stock splits if modeled as transactions
      setFormError("Price per unit must be a non-negative number for this transaction type."); setIsLoading(false); return;
    }
    if (transactionType === 'dividend' && pricePerUnitNative.trim() && (isNaN(parsedPrice) || parsedPrice < 0)) {
        setFormError("Price per unit (if provided for dividend) must be non-negative."); setIsLoading(false); return;
    }


    const parsedFees = feesNative.trim() ? parseFloat(feesNative) : null;
    if (feesNative.trim() && (parsedFees === null || isNaN(parsedFees) || parsedFees < 0)) {
      setFormError("Fees must be a non-negative number if provided."); setIsLoading(false); return;
    }

    // For 'dividend' type, if price is not entered, it means total_amount_native IS the dividend amount itself, quantity could be 1.
    // Or, if dividend is per share, then price_per_unit_native is dividend_per_share.
    // Let's assume for 'dividend', if price is empty, 'quantity' is total dividend amount and price is 1.
    let finalPricePerUnitNative = parsedPrice;
    let finalQuantity = parsedQuantity;

    if (transactionType === 'dividend' && !pricePerUnitNative.trim()) {
        finalPricePerUnitNative = 1; // For calculation of total_amount_native
        // finalQuantity remains as entered, representing the total dividend amount
    } else if (transactionType === 'dividend' && pricePerUnitNative.trim()) {
        // User entered dividend per share, quantity is number of shares
        finalPricePerUnitNative = parsedPrice;
        finalQuantity = parsedQuantity;
    }


    const transactionPayload: InvestmentTransactionInsert = {
      user_id: userId,
      investment_id: investmentId,
      currency_code: investmentCurrency, // Transaction is in the investment's native currency
      transaction_type: transactionType,
      date: formatDateFns(date, 'yyyy-MM-dd'),
      quantity: finalQuantity,
      price_per_unit_native: finalPricePerUnitNative || 0, // Default to 0 if not applicable (e.g. pure cash dividend without "price")
      fees_native: parsedFees,
      account_id: cashAccountId === NO_ACCOUNT_SELECTED_VALUE ? null : cashAccountId, // For cash impact
      notes: notes.trim() || null,
    };

    const result = await addInvestmentTransaction(supabase, transactionPayload);

    setIsLoading(false);
    if (result.error) {
      console.error('Error adding investment transaction:', result.error);
      setFormError(result.error.message);
      toast.error(`Error: ${result.error.message}`);
    } else if (result.data) {
      toast.success('Investment transaction added successfully!');
      onSubmitSuccess(result.data);
    } else {
      setFormError("An unexpected issue occurred. Transaction data not returned.");
      toast.error("An unexpected issue occurred.");
    }
  };

  const isSubmitting = isLoading || isDataLoading;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      <div><Label htmlFor="transactionType">Transaction Type</Label>
        <Select value={transactionType} onValueChange={(val) => setTransactionType(val as InvestmentTransactionType)} required disabled={isSubmitting}>
            <SelectTrigger id="transactionType"><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
                {transactionTypes.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
            </SelectContent>
        </Select>
      </div>
      <div><Label htmlFor="transactionDate">Date</Label><DatePicker date={date} setDate={setDate} disabled={isSubmitting}/></div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="quantity">
            Quantity {transactionType === 'dividend' && !pricePerUnitNative.trim() ? `(Total Dividend Amount in ${investmentCurrency})` : ''}
          </Label>
          <Input id="quantity" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} required placeholder="e.g., 10" step="any" disabled={isSubmitting}/>
        </div>
        <div>
          <Label htmlFor="pricePerUnitNative">
            Price / Unit ({investmentCurrency}) 
            {transactionType === 'dividend' ? ' (Dividend per Share, optional)' : ''}
          </Label>
          <Input id="pricePerUnitNative" type="number" value={pricePerUnitNative} onChange={(e) => setPricePerUnitNative(e.target.value)} 
            placeholder="e.g., 150.75" step="any" 
            disabled={isSubmitting}
            required={['buy', 'sell', 'reinvest'].includes(transactionType)}
          />
        </div>
      </div>

      <div><Label htmlFor="feesNative">Fees ({investmentCurrency}) (<span className="text-xs text-muted-foreground">Optional</span>)</Label><Input id="feesNative" type="number" value={feesNative} onChange={(e) => setFeesNative(e.target.value)} placeholder="e.g., 5.00" step="any" disabled={isSubmitting}/></div>
      
      {userCashAccounts.length > 0 && (transactionType === 'buy' || transactionType === 'sell' || transactionType === 'dividend') && (
        <div>
          <Label htmlFor="cashAccountId">
            {transactionType === 'buy' ? 'Cash Source Account' : (transactionType === 'sell' || transactionType === 'dividend') ? 'Cash Destination Account' : 'Associated Cash Account'}
            {' '}(<span className="text-muted-foreground text-xs">Optional</span>)
          </Label>
          <Select value={cashAccountId || NO_ACCOUNT_SELECTED_VALUE} onValueChange={(val) => setCashAccountId(val === NO_ACCOUNT_SELECTED_VALUE ? null : val)} disabled={isSubmitting}>
            <SelectTrigger id="cashAccountId"><SelectValue placeholder={isDataLoading ? "Loading accounts..." : "Select a cash account"} /></SelectTrigger>
            <SelectContent>
              {isDataLoading && userCashAccounts.length === 0 && <SelectItem value="" disabled>Loading...</SelectItem>}
              <SelectItem value={NO_ACCOUNT_SELECTED_VALUE}><em>No specific cash account</em></SelectItem>
              {userCashAccounts.map((acc) => ( <SelectItem key={acc.id} value={acc.id}> {acc.name} ({acc.native_currency_code}) </SelectItem> ))}
            </SelectContent>
          </Select>
           <p className="text-xs text-muted-foreground mt-1">
            Select if this transaction directly impacts a cash account. DB will handle balance adjustment.
          </p>
        </div>
      )}

      <div><Label htmlFor="transactionNotes">Notes (<span className="text-xs text-muted-foreground">Optional</span>)</Label><Textarea id="transactionNotes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g., DRIP, Annual dividend" disabled={isSubmitting}/></div>

      {formError && <p className="text-sm text-red-600">{formError}</p>}
      <div className="flex gap-2 pt-2 justify-end">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>}
        <Button type="submit" disabled={isSubmitting || !transactionType}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Add Transaction
        </Button>
      </div>
    </form>
  );
}
