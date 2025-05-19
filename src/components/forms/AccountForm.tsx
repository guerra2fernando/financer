/* eslint-disable @typescript-eslint/no-unused-vars */
// src/components/forms/AccountForm.tsx
'use client';

import { useState, useEffect, FormEvent, useCallback } from 'react';
import type { Account, AccountInsert, AccountUpdate, AccountType, Currency } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addAccount, updateAccount } from '@/services/accountService';
import { getCurrencies } from '@/services/currencyService'; // Import currency service
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { DEFAULT_CURRENCY, CurrencyCode } from '@/lib/constants';
import type { CurrencyContextProps } from '@/types';

interface AccountFormProps {
  userId: string;
  initialData?: Account | null;
  onSubmitSuccess: (newOrUpdatedAccount: Account) => void;
  onCancel?: () => void;
  currencyContext: CurrencyContextProps;
}

const accountTypes: AccountType[] = ['cash', 'bank_account', 'e-wallet'];

export default function AccountForm({ userId, initialData, onSubmitSuccess, onCancel, currencyContext }: AccountFormProps) {
  const [name, setName] = useState<string>('');
  const [type, setType] = useState<AccountType | ''>('');
  const [balanceNative, setBalanceNative] = useState<string>('0');
  const [nativeCurrencyCode, setNativeCurrencyCode] = useState<CurrencyCode>(DEFAULT_CURRENCY);

  const [availableCurrencies, setAvailableCurrencies] = useState<Currency[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCurrenciesLoading, setIsCurrenciesLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const supabaseBrowserClient = createClient();

  const fetchCurrencies = useCallback(async () => {
    setIsCurrenciesLoading(true);
    const { data, error } = await getCurrencies(supabaseBrowserClient, true); // Fetch active currencies
    if (error) {
      toast.error("Failed to load currencies.");
      console.error("Currency fetch error:", error);
    } else {
      setAvailableCurrencies(data || []);
    }
    setIsCurrenciesLoading(false);
  }, [supabaseBrowserClient]);

  useEffect(() => {
    fetchCurrencies();
  }, [fetchCurrencies]);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setType(initialData.type || '');
      setBalanceNative(initialData.balance_native?.toString() || '0');
      setNativeCurrencyCode(initialData.native_currency_code || DEFAULT_CURRENCY);
    } else {
      setName('');
      setType('');
      setBalanceNative('0');
      setNativeCurrencyCode(DEFAULT_CURRENCY);
    }
  }, [initialData]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFormError(null);

    if (!name.trim()) { setFormError("Account name is required."); setIsLoading(false); return; }
    if (!type) { setFormError("Account type is required."); setIsLoading(false); return; }
    const parsedBalance = parseFloat(balanceNative);
    if (isNaN(parsedBalance)) { setFormError("Current balance must be a valid number."); setIsLoading(false); return; }
    if (!nativeCurrencyCode.trim()) { setFormError("Currency is required."); setIsLoading(false); return; }

    // Payload uses new field names
    const accountPayloadBase = {
      name: name.trim(),
      type: type as AccountType,
    };

    let result;
    if (initialData?.id) {
      // For updates, only name and type are typically changed.
      // Balance and currency are usually fixed or updated via transactions.
      const updateData: AccountUpdate = { name: accountPayloadBase.name, type: accountPayloadBase.type };
      result = await updateAccount(supabaseBrowserClient, initialData.id, updateData);
    } else {
      // For new accounts, include balance_native and native_currency_code
      const insertData: AccountInsert = {
        ...accountPayloadBase,
        user_id: userId,
        balance_native: parsedBalance,
        native_currency_code: nativeCurrencyCode,
      };
      result = await addAccount(supabaseBrowserClient, insertData);
    }

    setIsLoading(false);
    if (result.error) {
      console.error('Error saving account:', result.error);
      setFormError(result.error.message);
      toast.error(`Error: ${result.error.message}`);
    } else if (result.data) {
      toast.success(`Account ${initialData ? 'updated' : 'added'} successfully!`);
      onSubmitSuccess(result.data);
    } else {
      setFormError("An unexpected issue occurred. Account data not returned.");
      toast.error("An unexpected issue occurred.");
    }
  };

  const isSubmitting = isLoading || isCurrenciesLoading;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      <div>
        <Label htmlFor="accountName">Account Name</Label>
        <Input id="accountName" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g., Main Checking, Savings, Wallet" disabled={isSubmitting}/>
      </div>
      <div>
        <Label htmlFor="accountType">Account Type</Label>
         <Select value={type} onValueChange={(value) => setType(value as AccountType)} disabled={isSubmitting}>
            <SelectTrigger id="accountType" aria-label="Account Type">
              <SelectValue placeholder="Select account type" />
            </SelectTrigger>
            <SelectContent>
              {accountTypes.map(accType => (
                 <SelectItem key={accType} value={accType}>
                   {accType.charAt(0).toUpperCase() + accType.slice(1).replace('_', ' ')}
                 </SelectItem>
              ))}
            </SelectContent>
         </Select>
      </div>
      {/* Fields for new accounts only */}
      {!initialData && (
        <>
          <div>
            <Label htmlFor="nativeCurrencyCode">Currency</Label>
            <Select value={nativeCurrencyCode} onValueChange={(value) => setNativeCurrencyCode(value as CurrencyCode)} disabled={isSubmitting || !!initialData}>
                <SelectTrigger id="nativeCurrencyCode" aria-label="Currency">
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
            {initialData && <p className="text-xs text-muted-foreground mt-1">Currency cannot be changed after creation.</p>}
          </div>
          <div>
            <Label htmlFor="balanceNative">Initial Balance ({nativeCurrencyCode})</Label>
            <Input id="balanceNative" type="number" value={balanceNative} onChange={(e) => setBalanceNative(e.target.value)} required step="0.01" placeholder="e.g., 1500.50" disabled={isSubmitting || !!initialData} />
            <p className="text-xs text-muted-foreground mt-1">
                Enter the balance in the selected currency.
            </p>
          </div>
        </>
      )}
      {initialData && ( // Display currency and balance for existing accounts, but not editable directly
        <>
            <div>
                <Label>Account Currency</Label>
                <Input value={`${initialData.native_currency_code} (${availableCurrencies.find(c=>c.code === initialData.native_currency_code)?.name || ''})`} disabled />
                 <p className="text-xs text-muted-foreground mt-1">Currency cannot be changed after creation.</p>
            </div>
             <div>
                <Label>Current Native Balance</Label>
                <Input value={initialData.balance_native.toFixed(availableCurrencies.find(c=>c.code === initialData.native_currency_code)?.decimal_digits || 2)} disabled />
                <p className="text-xs text-muted-foreground mt-1">Balance is updated via transactions.</p>
            </div>
        </>
      )}


      {formError && <p className="text-sm text-red-600">{formError}</p>}
      <div className="flex gap-2 pt-2 justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {initialData?.id ? 'Update Account' : 'Add Account'}
        </Button>
      </div>
    </form>
  );
}
