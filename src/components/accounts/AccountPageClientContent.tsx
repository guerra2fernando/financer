// src/components/accounts/AccountPageClientContent.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { Account, Currency, CurrencyContextProps } from '@/types';
import type { AllCurrenciesData as UtilsAllCurrenciesData, ExchangeRatesMap as UtilsExchangeRatesMap } from '@/lib/utils';
import AccountForm from '@/components/forms/AccountForm';
import AccountList from './AccountList';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { PlusCircle, Landmark, Loader2 } from 'lucide-react';
import { getAccountsByUserId } from '@/services/accountService';
import { getCurrentUserProfile } from '@/services/userService';
import { getCurrencies, getMultipleExchangeRates } from '@/services/currencyService';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BASE_REPORTING_CURRENCY, DEFAULT_CURRENCY, CurrencyCode, COMMON_CURRENCIES_FOR_TYPING } from '@/lib/constants';

interface AccountPageClientContentProps {
  initialAccounts: Account[];
  userId: string;
}

export default function AccountPageClientContent({
  initialAccounts,
  userId,
}: AccountPageClientContentProps) {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [isLoading, setIsLoading] = useState(false);
  const [isAccountFormModalOpen, setIsAccountFormModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  
  const [currencyContext, setCurrencyContext] = useState<CurrencyContextProps | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(true);

  const supabaseBrowserClient = createClient();

  useEffect(() => {
    setAccounts(initialAccounts);
  }, [initialAccounts]);

  useEffect(() => {
    const fetchCurrencyContext = async () => {
      if (!userId) return;
      setIsLoadingContext(true);
      try {
        const profileResult = await getCurrentUserProfile(supabaseBrowserClient, userId);
        const userPreferredCurrency = profileResult.data?.preferred_currency || DEFAULT_CURRENCY;

        const currenciesResult = await getCurrencies(supabaseBrowserClient, true);
        const fetchedCurrenciesArray: Currency[] = currenciesResult.data || [];

        // 1. Transform Currency[] to AllCurrenciesData (Record<CurrencyCode, Currency | undefined>)
        const allCurrenciesDataRecord = COMMON_CURRENCIES_FOR_TYPING.reduce((acc, code) => {
            acc[code] = undefined; // Initialize known common currency codes
            return acc;
        }, {} as UtilsAllCurrenciesData);
        fetchedCurrenciesArray.forEach(currency => {
            // Explicitly cast currency.code here if it's not already narrowed to CurrencyCode literals
            allCurrenciesDataRecord[currency.code as CurrencyCode] = currency;
        });


        const targetRateCurrencies = Array.from(
          new Set(fetchedCurrenciesArray.map(c => c.code).concat(userPreferredCurrency))
        ) as CurrencyCode[];

        const exchangeRatesResult = await getMultipleExchangeRates(
            supabaseBrowserClient,
            new Date(),
            targetRateCurrencies,
            BASE_REPORTING_CURRENCY
        );
        
        // 2. Prepare currentExchangeRates (ExchangeRatesMap: Record<CurrencyCode, number | undefined>)
        const finalExchangeRatesMap = COMMON_CURRENCIES_FOR_TYPING.reduce((acc, code) => {
            acc[code] = undefined; // Initialize known common currency codes
            return acc;
        }, {} as UtilsExchangeRatesMap);

        if (exchangeRatesResult.data) {
            for (const code in exchangeRatesResult.data) {
                if (Object.prototype.hasOwnProperty.call(exchangeRatesResult.data, code)) {
                    finalExchangeRatesMap[code as CurrencyCode] = exchangeRatesResult.data[code as CurrencyCode];
                }
            }
        } else {
            console.warn("Exchange rates could not be fetched or an error occurred. Rates will be undefined.");
        }
        
        if (finalExchangeRatesMap[BASE_REPORTING_CURRENCY] === undefined) {
            finalExchangeRatesMap[BASE_REPORTING_CURRENCY] = 1.0;
        }
        
        setCurrencyContext({
          userPreferredCurrency,
          baseReportingCurrency: BASE_REPORTING_CURRENCY,
          allCurrenciesData: allCurrenciesDataRecord,
          currentExchangeRates: finalExchangeRatesMap,
          supabaseClient: supabaseBrowserClient,
        });

      } catch (error) {
        console.error("Failed to load currency context for accounts page:", error);
        toast.error("Could not load currency settings. Display might be affected.");
        
        const fallbackCurrenciesData = COMMON_CURRENCIES_FOR_TYPING.reduce((acc, code) => {
            acc[code] = undefined;
            return acc;
        }, {} as UtilsAllCurrenciesData);

        if (fallbackCurrenciesData['USD'] === undefined) { // Ensure USD has some minimal data
            fallbackCurrenciesData['USD'] = {
                code: 'USD', name: 'US Dollar', symbol: '$', symbol_native: '$',
                decimal_digits: 2, rounding: 0, name_plural: 'US dollars', is_active: true,
            };
        }
        // Ensure DEFAULT_CURRENCY also has an entry if it's USD and wasn't set (though USD is already handled)
        // This is more relevant if DEFAULT_CURRENCY could be something else not in COMMON_CURRENCIES_FOR_TYPING,
        // but for now, we primarily ensure COMMON_CURRENCIES_FOR_TYPING are initialized.
        if (DEFAULT_CURRENCY === 'USD' && !fallbackCurrenciesData[DEFAULT_CURRENCY]) {
             fallbackCurrenciesData[DEFAULT_CURRENCY] = {
                code: 'USD', name: 'US Dollar', symbol: '$', symbol_native: '$',
                decimal_digits: 2, rounding: 0, name_plural: 'US dollars', is_active: true,
            };
        }


        const fallbackExchangeRates = COMMON_CURRENCIES_FOR_TYPING.reduce((acc, code) => {
            acc[code] = undefined;
            return acc;
        }, {} as UtilsExchangeRatesMap);
        fallbackExchangeRates[BASE_REPORTING_CURRENCY] = 1.0;

        setCurrencyContext({
            userPreferredCurrency: DEFAULT_CURRENCY,
            baseReportingCurrency: BASE_REPORTING_CURRENCY,
            allCurrenciesData: fallbackCurrenciesData,
            currentExchangeRates: fallbackExchangeRates,
            supabaseClient: supabaseBrowserClient,
        });
      } finally {
        setIsLoadingContext(false);
      }
    };
    fetchCurrencyContext();
  }, [userId, supabaseBrowserClient]);

  const refreshAccounts = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await getAccountsByUserId(supabaseBrowserClient, userId);
    setIsLoading(false);
    if (error) {
      toast.error(`Failed to refresh accounts: ${error.message}`);
    } else {
      setAccounts(data || []);
    }
  }, [userId, supabaseBrowserClient]);

  const handleAddAccountClick = () => {
    setEditingAccount(null);
    setIsAccountFormModalOpen(true);
  };

  const handleEditAccount = (account: Account) => {
    setEditingAccount(account);
    setIsAccountFormModalOpen(true);
  };

  const handleAccountFormSubmitSuccess = () => {
    setIsAccountFormModalOpen(false);
    setEditingAccount(null);
    refreshAccounts();
  };

  if (isLoadingContext) {
      return (
          <div className="space-y-8 flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading account settings...</p>
          </div>
      );
  }
  
  if (!currencyContext) {
      return (
        <div className="space-y-8 flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
          <p className="text-red-500">Error: Currency settings could not be loaded. Please try again later.</p>
        </div>
      );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Accounts</h1>
          <p className="text-muted-foreground">
            Manage your cash, bank accounts, and e-wallets. Displayed in {currencyContext.allCurrenciesData[currencyContext.userPreferredCurrency]?.name || currencyContext.userPreferredCurrency}.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleAddAccountClick} size="sm">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Account
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
            <CardTitle className="flex items-center"><Landmark className="mr-2 h-5 w-5 text-blue-500" />Your Accounts</CardTitle>
            <CardDescription>Overview of your financial accounts and their current balances.</CardDescription>
        </CardHeader>
        <CardContent>
            <AccountList
                accounts={accounts}
                onEdit={handleEditAccount}
                onRefresh={refreshAccounts}
                isLoading={isLoading}
                currencyContext={currencyContext}
            />
        </CardContent>
      </Card>

      <Dialog open={isAccountFormModalOpen} onOpenChange={setIsAccountFormModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? 'Edit Account' : 'Add New Account'}
            </DialogTitle>
            <DialogDescription>
              {editingAccount ? `Update details for ${editingAccount.name}. Native currency: ${editingAccount.native_currency_code}` 
                              : 'Provide details for your new financial account. Select its native currency.'}
            </DialogDescription>
          </DialogHeader>
          <AccountForm
            userId={userId}
            initialData={editingAccount}
            onSubmitSuccess={handleAccountFormSubmitSuccess}
            onCancel={() => {
                setIsAccountFormModalOpen(false);
                setEditingAccount(null);
            }}
            currencyContext={currencyContext}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}