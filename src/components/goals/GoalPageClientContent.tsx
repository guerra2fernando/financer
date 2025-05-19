/* eslint-disable react/no-unescaped-entities */
// src/components/goals/GoalPageClientContent.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FinancialGoal, Currency, CurrencyContextProps } from '@/types';
// Import the specific utility types for context
import type { AllCurrenciesData as UtilsAllCurrenciesData, ExchangeRatesMap as UtilsExchangeRatesMap } from '@/lib/utils';
import FinancialGoalForm from '@/components/forms/FinancialGoalForm';
import GoalContributionForm from '@/components/forms/GoalContributionForm';
import GoalsAccordion from './GoalsAccordion';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { PlusCircle, Target, Loader2 } from 'lucide-react';
import { getFinancialGoalsByUserId } from '@/services/financialGoalService';
import { getCurrentUserProfile } from '@/services/userService'; // Corrected import
import { getCurrencies, getMultipleExchangeRates } from '@/services/currencyService';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { BASE_REPORTING_CURRENCY, DEFAULT_CURRENCY, CurrencyCode, COMMON_CURRENCIES_FOR_TYPING } from '@/lib/constants';


interface GoalPageClientContentProps {
  initialGoals: FinancialGoal[];
  userId: string;
}

export default function GoalPageClientContent({
  initialGoals,
  userId,
}: GoalPageClientContentProps) {
  const [goals, setGoals] = useState<FinancialGoal[]>(initialGoals);
  const [isLoading, setIsLoading] = useState(false);

  const [isGoalFormModalOpen, setIsGoalFormModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);

  const [isContributionFormModalOpen, setIsContributionFormModalOpen] = useState(false);
  const [selectedGoalForContribution, setSelectedGoalForContribution] = useState<FinancialGoal | null>(null);

  const [currencyContext, setCurrencyContext] = useState<CurrencyContextProps | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(true);

  const supabaseBrowserClient = createClient();

  useEffect(() => {
    setGoals(initialGoals);
  }, [initialGoals]);

  useEffect(() => {
    const fetchCurrencyContext = async () => {
      if (!userId) return;
      setIsLoadingContext(true);
      try {
        const profileResult = await getCurrentUserProfile(supabaseBrowserClient, userId);
        const userPreferredCurrency = profileResult.data?.preferred_currency || DEFAULT_CURRENCY;

        const currenciesResult = await getCurrencies(supabaseBrowserClient, true);
        const fetchedCurrenciesArray: Currency[] = currenciesResult.data || [];

        // 1. Transform Currency[] to AllCurrenciesData
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
        
        // 2. Prepare currentExchangeRates
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
        } else {
            console.warn("Exchange rates could not be fetched or an error occurred for goals page. Rates will be undefined.");
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
        console.error("Failed to load currency context for goals page:", error);
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

  const refreshGoals = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await getFinancialGoalsByUserId(supabaseBrowserClient, userId);
    setIsLoading(false);
    if (error) {
      toast.error(`Failed to refresh financial goals: ${error.message}`);
    } else {
      setGoals(data || []);
      if (selectedGoalForContribution && data) {
        const updatedSelected = data.find(g => g.id === selectedGoalForContribution.id);
        setSelectedGoalForContribution(updatedSelected || null);
      }
    }
  }, [userId, supabaseBrowserClient, selectedGoalForContribution]);

  const handleAddGoalClick = () => {
    setEditingGoal(null);
    setIsGoalFormModalOpen(true);
  };

  const handleEditGoal = (goal: FinancialGoal) => {
    setEditingGoal(goal);
    setIsGoalFormModalOpen(true);
  };

  const handleGoalFormSubmitSuccess = () => {
    setIsGoalFormModalOpen(false);
    setEditingGoal(null);
    refreshGoals();
  };

  const handleAddContributionClick = (goal: FinancialGoal) => {
    setSelectedGoalForContribution(goal);
    setIsContributionFormModalOpen(true);
  };

  const handleContributionFormSubmitSuccess = () => {
    setIsContributionFormModalOpen(false);
    setSelectedGoalForContribution(null);
    refreshGoals();
  };
  
  const handleViewContributions = (goal: FinancialGoal) => {
    setSelectedGoalForContribution(goal);
  };
  
  if (isLoadingContext) {
      return (
          <div className="space-y-8 flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading goal settings...</p>
          </div>
      );
  }
  
  if (!currencyContext) {
      return (
        <div className="space-y-8 flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
          <p className="text-red-500">Error: Currency settings could not be loaded.</p>
        </div>
      );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Goals</h1>
          <p className="text-muted-foreground">
            Set, track, and achieve your financial milestones. Displayed in {currencyContext.allCurrenciesData[currencyContext.userPreferredCurrency]?.name || currencyContext.userPreferredCurrency}.
          </p>
        </div>
        <Button onClick={handleAddGoalClick} size="sm">
          <PlusCircle className="mr-2 h-4 w-4" />
          Add New Goal
        </Button>
      </div>

      <Card>
        <CardHeader>
            <CardTitle className="flex items-center"><Target className="mr-2 h-5 w-5 text-green-500" />Your Goals</CardTitle>
            <CardDescription>Monitor progress and manage contributions for your financial goals.</CardDescription>
        </CardHeader>
        <CardContent>
            <GoalsAccordion
                goals={goals}
                userId={userId}
                onEditGoal={handleEditGoal}
                onAddContribution={handleAddContributionClick}
                onRefreshGoals={refreshGoals}
                onViewContributions={handleViewContributions}
                isLoading={isLoading}
                currencyContext={currencyContext}
            />
        </CardContent>
      </Card>

      <Dialog open={isGoalFormModalOpen} onOpenChange={setIsGoalFormModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingGoal ? 'Edit Financial Goal' : 'Set a New Financial Goal'}
            </DialogTitle>
            <DialogDescription>
                {editingGoal ? `Update details for ${editingGoal.name}. Currency: ${editingGoal.currency_code}` : `Set a new goal. Choose its currency.`}
            </DialogDescription>
          </DialogHeader>
          <FinancialGoalForm
            userId={userId}
            initialData={editingGoal}
            onSubmitSuccess={handleGoalFormSubmitSuccess}
            onCancel={() => setIsGoalFormModalOpen(false)}
            currencyContext={currencyContext} // This prop needs to be added to FinancialGoalFormProps
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isContributionFormModalOpen} onOpenChange={setIsContributionFormModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Log Contribution for "{selectedGoalForContribution?.name}"</DialogTitle>
            <DialogDescription>
              This will update your progress towards the goal. Goal currency: {selectedGoalForContribution?.currency_code}.
            </DialogDescription>
          </DialogHeader>
          {selectedGoalForContribution && currencyContext && ( // Ensure currencyContext is also available
            <GoalContributionForm
              userId={userId}
              goalId={selectedGoalForContribution.id} // This prop needs to be added to GoalContributionFormProps
              goalCurrency={selectedGoalForContribution.currency_code} // This prop needs to be added
              onSubmitSuccess={handleContributionFormSubmitSuccess}
              onCancel={() => setIsContributionFormModalOpen(false)}
              currencyContext={currencyContext} // This prop needs to be added
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}