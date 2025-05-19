/* eslint-disable @typescript-eslint/no-unused-vars */
// src/components/investments/InvestmentPageClientContent.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Investment, InvestmentTransaction, Currency, CurrencyContextProps } from '@/types';
// Import the specific utility types for context
import type { AllCurrenciesData as UtilsAllCurrenciesData, ExchangeRatesMap as UtilsExchangeRatesMap } from '@/lib/utils';
import InvestmentForm from '@/components/forms/InvestmentForm'; // Assuming this will be created/updated
import InvestmentTransactionForm from '@/components/forms/InvestmentTransactionForm'; // Assuming this will be created/updated
import InvestmentPortfolioAccordion from './InvestmentPortfolioAccordion';
import InvestmentPerformanceChart from './InvestmentPerformanceChart';
import InvestmentAllocationDetailChart from './InvestmentAllocationDetailChart';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { PlusCircle, PieChart, Briefcase, TrendingUp, Loader2 } from 'lucide-react';
import { getInvestmentsByUserId, getInvestmentTransactions } from '@/services/investmentService';
import { getCurrentUserProfile } from '@/services/userService';
import { getCurrencies, getMultipleExchangeRates } from '@/services/currencyService';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { BASE_REPORTING_CURRENCY, DEFAULT_CURRENCY, CurrencyCode, COMMON_CURRENCIES_FOR_TYPING } from '@/lib/constants';

interface InvestmentPageClientContentProps {
  initialInvestments: Investment[];
  userId: string;
}

export default function InvestmentPageClientContent({
  initialInvestments,
  userId,
}: InvestmentPageClientContentProps) {
  const supabase = createClient();

  const [investments, setInvestments] = useState<Investment[]>(initialInvestments);
  const [isLoading, setIsLoading] = useState(false); // For investment list refresh

  const [isInvestmentFormModalOpen, setIsInvestmentFormModalOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);

  const [isTransactionFormModalOpen, setIsTransactionFormModalOpen] = useState(false);
  const [selectedInvestmentForTx, setSelectedInvestmentForTx] = useState<Investment | null>(null);

  const [selectedInvestmentTransactions, setSelectedInvestmentTransactions] = useState<InvestmentTransaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);

  const [currencyContext, setCurrencyContext] = useState<CurrencyContextProps | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(true);

  useEffect(() => {
    setInvestments(initialInvestments);
  }, [initialInvestments]);

  // Fetch currency context
  useEffect(() => {
    const fetchCurrencyContext = async () => {
      if (!userId) return;
      setIsLoadingContext(true);
      try {
        const profileResult = await getCurrentUserProfile(supabase, userId);
        const userPreferredCurrency = profileResult.data?.preferred_currency || DEFAULT_CURRENCY;

        const currenciesResult = await getCurrencies(supabase, true);
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
            supabase, new Date(), targetRateCurrencies, BASE_REPORTING_CURRENCY
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
          supabaseClient: supabase, // Pass the client instance
        });

      } catch (error) {
        console.error("Failed to load currency context for investments page:", error);
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
            supabaseClient: supabase,
        });
      } finally {
        setIsLoadingContext(false);
      }
    };
    fetchCurrencyContext();
  }, [userId, supabase]);

  const refreshInvestments = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    const { data, error } = await getInvestmentsByUserId(supabase, userId);
    setIsLoading(false);
    if (error) {
      toast.error(`Failed to refresh investments: ${error.message}`);
    } else {
      setInvestments(data || []);
      if (selectedInvestmentForTx && data) {
        const updatedSelected = data.find(inv => inv.id === selectedInvestmentForTx.id);
        setSelectedInvestmentForTx(updatedSelected || null);
      }
    }
  }, [userId, selectedInvestmentForTx, supabase]);
  
  const fetchTransactionsForSelected = useCallback(async (investmentId: string) => {
      if (!investmentId || !userId) {
          setSelectedInvestmentTransactions([]);
          return;
      }
      setIsLoadingTransactions(true);
      const {data, error} = await getInvestmentTransactions(supabase, investmentId, userId);
      setIsLoadingTransactions(false);
      if (error) {
          toast.error(`Error fetching transactions: ${error.message}`);
          setSelectedInvestmentTransactions([]);
      } else {
          setSelectedInvestmentTransactions(data || []);
      }
  }, [userId, supabase]);

  const handleAddInvestmentClick = () => {
    setEditingInvestment(null);
    setIsInvestmentFormModalOpen(true);
  };

  const handleEditInvestment = (investment: Investment) => {
    setEditingInvestment(investment);
    setIsInvestmentFormModalOpen(true);
  };

  const handleInvestmentFormSubmitSuccess = (newOrUpdatedInvestment: Investment) => {
    setIsInvestmentFormModalOpen(false);
    setEditingInvestment(null);
    // toast.success(`Investment ${editingInvestment ? 'updated' : 'added'} successfully!`); // Toast in form
    // Optimistic update or refresh
    if (editingInvestment) {
        setInvestments(prev => prev.map(inv => inv.id === newOrUpdatedInvestment.id ? newOrUpdatedInvestment : inv));
    } else {
        setInvestments(prev => [newOrUpdatedInvestment, ...prev].sort((a,b) => a.name.localeCompare(b.name)));
    }
    // refreshInvestments(); 
  };

  const handleAddTransactionClick = (investment: Investment) => {
    setSelectedInvestmentForTx(investment);
    setIsTransactionFormModalOpen(true);
  };
  
  const handleViewTransactionsAndChart = (investment: Investment) => {
    setSelectedInvestmentForTx(investment); // This will trigger data fetch in InvestmentPerformanceChart if it depends on this state
    fetchTransactionsForSelected(investment.id); // Explicitly fetch for the chart
  };

  const handleTransactionFormSubmitSuccess = (newTransaction: InvestmentTransaction) => {
    setIsTransactionFormModalOpen(false);
    // toast.success('Investment transaction added successfully!'); // Toast in form
    refreshInvestments(); // Refresh full investment data as transaction affects totals
    if (selectedInvestmentForTx?.id) {
        fetchTransactionsForSelected(selectedInvestmentForTx.id); // Refresh transactions for chart
    }
  };

  if (isLoadingContext) {
    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Investment Portfolio</h1>
                    <p className="text-muted-foreground">Loading settings...</p>
                </div>
                 <Button disabled size="sm"><PlusCircle className="mr-2 h-4 w-4" />Add New Investment</Button>
            </div>
            <div className="h-[300px] flex items-center justify-center border rounded-lg">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        </div>
    );
  }

  if (!currencyContext) {
    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Investment Portfolio</h1>
                    <p className="text-destructive">Error: Currency settings could not be loaded.</p>
                </div>
                 <Button disabled size="sm"><PlusCircle className="mr-2 h-4 w-4" />Add New Investment</Button>
            </div>
            <p className="text-center text-destructive p-8 border rounded-lg">Cannot display investments due to a settings error.</p>
        </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Investment Portfolio</h1>
          <p className="text-muted-foreground">
            Manage your investments. Displayed in {currencyContext.allCurrenciesData[currencyContext.userPreferredCurrency]?.name || currencyContext.userPreferredCurrency}.
          </p>
        </div>
        <Button onClick={handleAddInvestmentClick} size="sm">
          <PlusCircle className="mr-2 h-4 w-4" />
          Add New Investment
        </Button>
      </div>
      
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center"><PieChart className="mr-2 h-5 w-5 text-indigo-500" />Portfolio Allocation</CardTitle>
                <CardDescription>Breakdown by investment type (based on current value in {currencyContext.userPreferredCurrency}).</CardDescription>
            </CardHeader>
            <CardContent>
                <InvestmentAllocationDetailChart 
                    investments={investments} 
                    currencyContext={currencyContext} // Pass context
                />
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center"><TrendingUp className="mr-2 h-5 w-5 text-green-500" />Selected Investment Value</CardTitle>
                <CardDescription>
                    {selectedInvestmentForTx 
                        ? `Performance trend for ${selectedInvestmentForTx.name} (in ${currencyContext.userPreferredCurrency}).` 
                        : "Expand an investment below to see its performance chart."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <InvestmentPerformanceChart 
                    selectedInvestment={selectedInvestmentForTx} 
                    transactions={selectedInvestmentTransactions}
                    isLoading={isLoadingTransactions} 
                    currencyContext={currencyContext} // Pass contexts
                />
            </CardContent>
        </Card>
      </div>

       <Card>
        <CardHeader>
            <CardTitle className="flex items-center"><Briefcase className="mr-2 h-5 w-5 text-amber-500" />Your Investments</CardTitle>
            <CardDescription>Click on an investment to view details and transactions.</CardDescription>
        </CardHeader>
        <CardContent>
            <InvestmentPortfolioAccordion
                investments={investments}
                userId={userId}
                onEditInvestment={handleEditInvestment}
                onAddTransaction={handleAddTransactionClick}
                onRefreshInvestments={refreshInvestments}
                onViewTransactions={handleViewTransactionsAndChart} // Renamed from onOpenAccordion
                isLoading={isLoading}
                currencyContext={currencyContext} // Pass context
            />
        </CardContent>
      </Card>

      <Dialog open={isInvestmentFormModalOpen} onOpenChange={setIsInvestmentFormModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingInvestment ? 'Edit Investment' : 'Add New Investment'}
            </DialogTitle>
             <DialogDescription>
              {editingInvestment ? `Update details for ${editingInvestment.name}. Investment Currency: ${editingInvestment.currency_code}` : 'Define a new investment. Choose its native currency.'}
            </DialogDescription>
          </DialogHeader>
          {currencyContext && (
            <InvestmentForm
                userId={userId}
                initialData={editingInvestment}
                onSubmitSuccess={handleInvestmentFormSubmitSuccess}
                onCancel={() => setIsInvestmentFormModalOpen(false)}
                currencyContext={currencyContext} // Pass context
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isTransactionFormModalOpen} onOpenChange={setIsTransactionFormModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Transaction for {selectedInvestmentForTx?.name}</DialogTitle>
            <DialogDescription>
              Investment currency: {selectedInvestmentForTx?.currency_code}. Transaction will update its quantity and value.
            </DialogDescription>
          </DialogHeader>
          {selectedInvestmentForTx && currencyContext && (
            <InvestmentTransactionForm
              userId={userId}
              investmentId={selectedInvestmentForTx.id} // Pass investmentId
              investmentCurrency={selectedInvestmentForTx.currency_code} // Pass investmentCurrency
              onSubmitSuccess={handleTransactionFormSubmitSuccess}
              onCancel={() => setIsTransactionFormModalOpen(false)}
              currencyContext={currencyContext} // Pass context
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}