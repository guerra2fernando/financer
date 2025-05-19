// src/components/income/IncomePageClientContent.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { Income, Currency, CurrencyContextProps } from '@/types';
// Import the specific utility types for context
import type { AllCurrenciesData as UtilsAllCurrenciesData, ExchangeRatesMap as UtilsExchangeRatesMap } from '@/lib/utils';
import IncomeForm from '@/components/forms/IncomeForm';
import IncomeTable from './IncomeTable';
import IncomeTrendChart from './IncomeTrendChart'; // Corrected path if it's in the same folder
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { PlusCircle, DollarSign, Loader2 } from 'lucide-react'; // Added Loader2
import { getIncomesByUserId } from '@/services/incomeService';
import { getCurrentUserProfile } from '@/services/userService'; // For preferred currency
import { getCurrencies, getMultipleExchangeRates } from '@/services/currencyService'; // For currency data
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BASE_REPORTING_CURRENCY, DEFAULT_CURRENCY, CurrencyCode, COMMON_CURRENCIES_FOR_TYPING } from '@/lib/constants';

interface IncomePageClientContentProps {
  initialIncomes: Income[];
  userId: string;
}

export default function IncomePageClientContent({
  initialIncomes,
  userId,
}: IncomePageClientContentProps) {
  const [incomes, setIncomes] = useState<Income[]>(initialIncomes);
  const [isLoading, setIsLoading] = useState<boolean>(false); // For income list refresh
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);

  const [currencyContext, setCurrencyContext] = useState<CurrencyContextProps | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(true);

  const supabaseBrowserClient = createClient();

  useEffect(() => {
    setIncomes(initialIncomes);
  }, [initialIncomes]);

  // Fetch currency context
  useEffect(() => {
    const fetchCurrencyContext = async () => {
      if (!userId) return;
      setIsLoadingContext(true);
      try {
        const profileResult = await getCurrentUserProfile(supabaseBrowserClient, userId);
        const userPreferredCurrency = profileResult.data?.preferred_currency || DEFAULT_CURRENCY;

        const currenciesResult = await getCurrencies(supabaseBrowserClient, true);
        const fetchedCurrenciesArray: Currency[] = currenciesResult.data || [];

        const allCurrenciesDataRecord = COMMON_CURRENCIES_FOR_TYPING.reduce((acc, code) => {
            acc[code] = undefined;
            return acc;
        }, {} as UtilsAllCurrenciesData);
        fetchedCurrenciesArray.forEach(currency => {
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
        
        const finalExchangeRatesMap = COMMON_CURRENCIES_FOR_TYPING.reduce((acc, code) => {
            acc[code] = undefined;
            return acc;
        }, {} as UtilsExchangeRatesMap);

        if (exchangeRatesResult.data) {
            for (const code in exchangeRatesResult.data) {
                if (Object.prototype.hasOwnProperty.call(exchangeRatesResult.data, code)) {
                    finalExchangeRatesMap[code as CurrencyCode] = exchangeRatesResult.data[code as CurrencyCode];
                }
            }
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
        console.error("Failed to load currency context for income page:", error);
        toast.error("Could not load currency settings. Display might be affected.");
        
        const fallbackCurrenciesData = COMMON_CURRENCIES_FOR_TYPING.reduce((acc, code) => {
            acc[code] = undefined;
            return acc;
        }, {} as UtilsAllCurrenciesData);
        if (fallbackCurrenciesData['USD'] === undefined) {
            fallbackCurrenciesData['USD'] = {
                code: 'USD', name: 'US Dollar', symbol: '$', symbol_native: '$',
                decimal_digits: 2, rounding: 0, name_plural: 'US dollars', is_active: true,
            };
        }
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


  const refreshIncomes = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    const { data, error } = await getIncomesByUserId(supabaseBrowserClient, userId);
    setIsLoading(false);
    if (error) {
      toast.error(`Failed to refresh incomes: ${error.message}`);
    } else {
      setIncomes(data || []);
    }
  }, [userId, supabaseBrowserClient]);

  const handleAddIncomeClick = () => {
    setEditingIncome(null);
    setIsFormModalOpen(true);
  };

  const handleEditIncome = (income: Income) => {
    setEditingIncome(income);
    setIsFormModalOpen(true);
  };

  const handleFormSubmitSuccess = (newOrUpdatedIncome: Income) => {
    setIsFormModalOpen(false);
    setEditingIncome(null);
    // The toast is now handled in IncomeForm, but you can add another one here if needed
    // toast.success(`Income ${editingIncome ? 'updated' : 'added'} successfully!`);
    
    // More robust optimistic update:
    if (editingIncome) {
      setIncomes(prev => prev.map(inc => inc.id === newOrUpdatedIncome.id ? newOrUpdatedIncome : inc));
    } else {
      setIncomes(prev => [newOrUpdatedIncome, ...prev].sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())); // Keep sorted by start_date desc
    }
    // Or simply refresh:
    // refreshIncomes();
  };

  const handleFormCancel = () => {
    setIsFormModalOpen(false);
    setEditingIncome(null);
  };
  
  if (isLoadingContext) {
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Manage Income</h1>
                    <p className="text-muted-foreground">Loading settings...</p>
                </div>
                <Button disabled size="sm"><PlusCircle className="mr-2 h-4 w-4" />Add New Income</Button>
            </div>
            <div className="border rounded-lg p-8 flex justify-center items-center min-h-[300px]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        </div>
    );
  }

  if (!currencyContext) {
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Manage Income</h1>
                    <p className="text-destructive">Error: Currency settings failed to load.</p>
                </div>
                 <Button disabled size="sm"><PlusCircle className="mr-2 h-4 w-4" />Add New Income</Button>
            </div>
             <p className="text-center text-destructive p-8 border rounded-lg">Cannot display income data due to a settings error.</p>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Income</h1>
          <p className="text-muted-foreground">
            View, add, edit, and analyze your income sources. Displayed in {currencyContext.allCurrenciesData[currencyContext.userPreferredCurrency]?.name || currencyContext.userPreferredCurrency}.
          </p>
        </div>
        <Button onClick={handleAddIncomeClick} size="sm">
          <PlusCircle className="mr-2 h-4 w-4" />
          Add New Income
        </Button>
      </div>

      <IncomeTable
        incomes={incomes}
        userId={userId} // Keep userId if table needs it for any specific row action not covered by RLS
        onEdit={handleEditIncome}
        onRefresh={refreshIncomes}
        isLoading={isLoading}
        currencyContext={currencyContext} // Pass context
      />

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center"><DollarSign className="mr-2 h-5 w-5 text-green-500" />Income Trend</CardTitle>
          <CardDescription>Total income (in {currencyContext.baseReportingCurrency}, shown in {currencyContext.userPreferredCurrency}) aggregated monthly.</CardDescription>
        </CardHeader>
        <CardContent>
          <IncomeTrendChart 
            allIncomes={incomes} 
            currencyContext={currencyContext} // Pass context
          />
        </CardContent>
      </Card>

      <Dialog open={isFormModalOpen} onOpenChange={setIsFormModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingIncome ? 'Edit Income' : 'Add New Income'}
            </DialogTitle>
            <DialogDescription>
              {editingIncome
                ? `Update details for ${editingIncome.source_name}. Income Currency: ${editingIncome.currency_code}.`
                : 'Enter the details for a new income source. Select its currency.'}
            </DialogDescription>
          </DialogHeader>
          {currencyContext && ( // Ensure context is available for the form
            <IncomeForm
              userId={userId}
              initialData={editingIncome}
              onSubmitSuccess={handleFormSubmitSuccess}
              onCancel={handleFormCancel}
              currencyContext={currencyContext} // Pass context
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}