// src/components/forms/DebtForm.tsx
'use client';

import { useState, useEffect, FormEvent, useCallback } from 'react';
import type { Debt, DebtInsert, DebtUpdate, Currency } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDebt, updateDebt } from '@/services/debtService';
import { getCurrencies } from '@/services/currencyService'; // Import service
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { format as formatDateFns, parseISO } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { DEFAULT_CURRENCY, CurrencyCode } from '@/lib/constants';

interface DebtFormProps {
  userId: string;
  initialData?: Debt | null;
  onSubmitSuccess: (newOrUpdatedDebt: Debt) => void;
  onCancel?: () => void;
}

export default function DebtForm({ userId, initialData, onSubmitSuccess, onCancel }: DebtFormProps) {
  const [creditor, setCreditor] = useState<string>('');
  const [originalAmountNative, setOriginalAmountNative] = useState<string>(''); // Was _usd
  // current_balance_native is not directly edited on form; it's set initially or updated by payments.
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>(DEFAULT_CURRENCY); // New state for currency
  const [interestRateAnnual, setInterestRateAnnual] = useState<string>('');
  const [minimumPaymentNative, setMinimumPaymentNative] = useState<string>(''); // Was _usd
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [isPaid, setIsPaid] = useState<boolean>(false);
  const [description, setDescription] = useState<string>('');

  const [availableCurrencies, setAvailableCurrencies] = useState<Currency[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCurrenciesLoading, setIsCurrenciesLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const supabaseBrowserClient = createClient();

  const fetchCurrencies = useCallback(async () => {
    setIsCurrenciesLoading(true);
    const { data, error } = await getCurrencies(supabaseBrowserClient, true);
    if (error) toast.error("Failed to load currencies.");
    else setAvailableCurrencies(data || []);
    setIsCurrenciesLoading(false);
  }, [supabaseBrowserClient]);

  useEffect(() => {
    fetchCurrencies();
  }, [fetchCurrencies]);

  useEffect(() => {
    if (initialData) {
      setCreditor(initialData.creditor || '');
      setOriginalAmountNative(initialData.original_amount_native.toString());
      // current_balance_native is not set here, it's managed by system
      setCurrencyCode(initialData.currency_code || DEFAULT_CURRENCY);
      setInterestRateAnnual(initialData.interest_rate_annual?.toString() || '');
      setMinimumPaymentNative(initialData.minimum_payment_native?.toString() || '');
      setDueDate(initialData.due_date ? parseISO(initialData.due_date) : undefined);
      setIsPaid(initialData.is_paid || false);
      setDescription(initialData.description || '');
    } else {
      setCreditor('');
      setOriginalAmountNative('');
      setCurrencyCode(DEFAULT_CURRENCY);
      setInterestRateAnnual('');
      setMinimumPaymentNative('');
      setDueDate(undefined);
      setIsPaid(false);
      setDescription('');
    }
  }, [initialData]);


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFormError(null);

    if (!creditor.trim()) { setFormError("Creditor is required."); setIsLoading(false); return; }
    const origAmount = parseFloat(originalAmountNative);
    if (isNaN(origAmount) || origAmount <= 0) { setFormError("Original amount must be a positive number."); setIsLoading(false); return; }
    // current_balance_native is not validated here as it's not a direct form input for updates.
    if (!currencyCode) { setFormError("Currency is required."); setIsLoading(false); return; }
    if (!dueDate) { setFormError("Due date is required."); setIsLoading(false); return; }

    const parsedInterestRate = interestRateAnnual.trim() ? parseFloat(interestRateAnnual) : null;
    if (interestRateAnnual.trim() && (parsedInterestRate === null || isNaN(parsedInterestRate) || parsedInterestRate < 0)) {
        setFormError("Interest rate must be a non-negative number if provided."); setIsLoading(false); return;
    }
    const parsedMinPayment = minimumPaymentNative.trim() ? parseFloat(minimumPaymentNative) : null;
    if (minimumPaymentNative.trim() && (parsedMinPayment === null || isNaN(parsedMinPayment) || parsedMinPayment <= 0)) {
        setFormError("Minimum payment must be a positive number if provided."); setIsLoading(false); return;
    }

    const debtPayloadBase = {
      creditor: creditor.trim(),
      // current_balance_native: not directly updated from form. For new, it's set to original_amount_native by service/DB.
      interest_rate_annual: parsedInterestRate,
      minimum_payment_native: parsedMinPayment, // Use native field
      due_date: formatDateFns(dueDate, 'yyyy-MM-dd'),
      is_paid: isPaid,
      description: description.trim() || null,
    };

    let result;
    if (initialData?.id) {
      const updateData: DebtUpdate = { ...debtPayloadBase };
      // original_amount_native and currency_code are fixed for existing debts.
      result = await updateDebt(supabaseBrowserClient, initialData.id, updateData);
    } else {
      const insertData: DebtInsert = {
        ...debtPayloadBase,
        original_amount_native: origAmount, // Use native field
        currency_code: currencyCode,       // Add currency for new debts
        user_id: userId,
      };
      result = await addDebt(supabaseBrowserClient, insertData);
    }

    setIsLoading(false);
    if (result.error) {
      console.error('Error saving debt:', result.error);
      setFormError(result.error.message);
      toast.error(`Error: ${result.error.message}`);
    } else if (result.data){
      toast.success(`Debt ${initialData ? 'updated' : 'added'} successfully!`);
      onSubmitSuccess(result.data);
    } else {
      setFormError("An unexpected issue occurred. Debt data not returned.");
      toast.error("An unexpected issue occurred.");
    }
  };

  const isSubmitting = isLoading || isCurrenciesLoading;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      <div>
        <Label htmlFor="creditor">Creditor</Label>
        <Input id="creditor" value={creditor} onChange={(e) => setCreditor(e.target.value)} required placeholder="e.g., Bank, Credit Card Co." disabled={isSubmitting}/>
      </div>

      {!initialData && ( // Currency and original amount only for new debts
        <>
          <div>
            <Label htmlFor="debtCurrency">Currency</Label>
            <Select value={currencyCode} onValueChange={(value) => setCurrencyCode(value as CurrencyCode)} disabled={isSubmitting || !!initialData}>
              <SelectTrigger id="debtCurrency" aria-label="Debt Currency">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {isCurrenciesLoading && availableCurrencies.length === 0 ? (
                  <SelectItem value={DEFAULT_CURRENCY} disabled>Loading currencies...</SelectItem>
                ) : (
                  availableCurrencies.map(curr => (
                    <SelectItem key={curr.code} value={curr.code}>{curr.name} ({curr.code})</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="originalAmountNative">Original Amount ({currencyCode})</Label>
            <Input id="originalAmountNative" type="number" value={originalAmountNative} onChange={(e) => setOriginalAmountNative(e.target.value)} required step="0.01" placeholder="e.g., 5000.00" disabled={isSubmitting || !!initialData} />
          </div>
        </>
      )}

      {initialData && ( // Display currency and original amount for existing debts
         <>
            <div>
                <Label>Debt Currency</Label>
                <Input value={`${initialData.currency_code} (${availableCurrencies.find(c=>c.code === initialData.currency_code)?.name || ''})`} disabled />
                <p className="text-xs text-muted-foreground mt-1">Currency cannot be changed after creation.</p>
            </div>
            <div>
                <Label>Original Amount ({initialData.currency_code})</Label>
                <Input value={initialData.original_amount_native.toFixed(availableCurrencies.find(c=>c.code === initialData.currency_code)?.decimal_digits || 2)} disabled />
                <p className="text-xs text-muted-foreground mt-1">Original amount cannot be changed after creation.</p>
            </div>
            <div>
                <Label>Current Balance ({initialData.currency_code})</Label>
                <Input value={initialData.current_balance_native.toFixed(availableCurrencies.find(c=>c.code === initialData.currency_code)?.decimal_digits || 2)} disabled />
                 <p className="text-xs text-muted-foreground mt-1">Current balance is updated by payments.</p>
            </div>
         </>
      )}
      
      <div>
        <Label htmlFor="interestRateAnnual">Interest Rate (Annual % <span className="text-muted-foreground text-xs">Optional</span>)</Label>
        <Input id="interestRateAnnual" type="number" value={interestRateAnnual} onChange={(e) => setInterestRateAnnual(e.target.value)} step="0.01" placeholder="e.g., 5.5 (for 5.5%)" disabled={isSubmitting}/>
      </div>
       <div>
        <Label htmlFor="minimumPaymentNative">Minimum Payment ({initialData ? initialData.currency_code : currencyCode} <span className="text-muted-foreground text-xs">Optional</span>)</Label>
        <Input id="minimumPaymentNative" type="number" value={minimumPaymentNative} onChange={(e) => setMinimumPaymentNative(e.target.value)} step="0.01" placeholder="e.g., 100.00" disabled={isSubmitting}/>
      </div>
      <div>
        <Label htmlFor="dueDate">Due Date / Next Payment Date</Label>
        <DatePicker date={dueDate} setDate={setDueDate} />
      </div>
      <div className="flex items-center space-x-2 pt-2">
        <Switch id="isPaid" checked={isPaid} onCheckedChange={setIsPaid} disabled={isSubmitting}/>
        <Label htmlFor="isPaid" className="cursor-pointer">Is this debt fully paid?</Label>
      </div>
      <div>
        <Label htmlFor="debtDescription">Description (<span className="text-muted-foreground text-xs">Optional</span>)</Label>
        <Textarea id="debtDescription" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g., Personal loan, Credit card for XYZ purchase" disabled={isSubmitting}/>
      </div>

      {formError && <p className="text-sm text-red-600">{formError}</p>}
      <div className="flex gap-2 pt-2 justify-end">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {initialData?.id ? 'Update Debt' : 'Add Debt'}
        </Button>
      </div>
    </form>
  );
}
