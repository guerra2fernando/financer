// src/components/goals/GoalTracker.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FinancialGoal, Currency, CurrencyContextProps } from '@/types';
// Import the specific utility types for context
import type { AllCurrenciesData as UtilsAllCurrenciesData, ExchangeRatesMap as UtilsExchangeRatesMap } from '@/lib/utils';
import FinancialGoalForm from '@/components/forms/FinancialGoalForm';
import GoalContributionForm from '@/components/forms/GoalContributionForm';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { PlusCircle, Loader2, Target } from 'lucide-react';
import { getFinancialGoalsByUserId } from '@/services/financialGoalService';
import { getCurrentUserProfile } from '@/services/userService'; // Corrected import
import { getCurrencies, getMultipleExchangeRates } from '@/services/currencyService';
// format, parseISO, differenceInMonths, isValidDate from date-fns are not directly used here, but good to keep if future logic needs them
import { toast } from 'sonner';
import GoalsAccordion from './GoalsAccordion';
import { createClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { BASE_REPORTING_CURRENCY, DEFAULT_CURRENCY, CurrencyCode, COMMON_CURRENCIES_FOR_TYPING } from '@/lib/constants';


interface GoalTrackerProps {
  initialGoals: FinancialGoal[];
  userId: string;
}

export default function GoalTracker({ initialGoals, userId }: GoalTrackerProps) {
  const [goals, setGoals] = useState<FinancialGoal[]>(initialGoals);
  const [showGoalFormDialog, setShowGoalFormDialog] = useState(false);
  const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);

  const [showContributionFormDialog, setShowContributionFormDialog] = useState(false);
  const [selectedGoalForContribution, setSelectedGoalForContribution] = useState<FinancialGoal | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);

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
            console.warn("Exchange rates could not be fetched or an error occurred for goal tracker. Rates will be undefined.");
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
        console.error("Failed to load currency context for goal tracker:", error);
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
             fallbackCurrenciesData[DEFAULT_CURRENCY] = { // Ensure default currency has an entry if it's USD
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

  const fetchGoals = useCallback(async () => {
    if (!userId) return; // Prevent fetch if userId is not available
    setIsLoading(true);
    const { data, error } = await getFinancialGoalsByUserId(supabaseBrowserClient, userId);
    if (error) {
      toast.error(`Failed to refresh goals: ${error.message}`);
    } else {
      setGoals(data || []);
    }
    setIsLoading(false);
  }, [userId, supabaseBrowserClient]);

  const handleGoalFormSuccess = () => {
    setShowGoalFormDialog(false);
    setEditingGoal(null);
    fetchGoals();
  };

  const handleContributionFormSuccess = () => {
    setShowContributionFormDialog(false);
    setSelectedGoalForContribution(null);
    fetchGoals();
  };

  const openAddGoalForm = () => {
    setEditingGoal(null);
    setShowGoalFormDialog(true);
  };

  const openEditGoalForm = (goal: FinancialGoal) => {
    setEditingGoal(goal);
    setShowGoalFormDialog(true);
  };
  
  const openAddContributionForm = (goal: FinancialGoal) => {
    setSelectedGoalForContribution(goal);
    setShowContributionFormDialog(true);
  };
  
  const handleViewContributions = (goal: FinancialGoal) => {
    setSelectedGoalForContribution(goal);
  };

  if (isLoadingContext) {
      return (
          <Card>
              <CardHeader>
                  <CardTitle className="flex items-center"><Target className="mr-2 h-5 w-5 text-green-500" /> Financial Goals</CardTitle>
                  <CardDescription>Loading your financial aspirations...</CardDescription>
              </CardHeader>
              <CardContent className="h-[200px] flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </CardContent>
          </Card>
      );
  }

  if (!currencyContext) {
      return (
          <Card>
              <CardHeader>
                  <CardTitle className="flex items-center"><Target className="mr-2 h-5 w-5 text-destructive" /> Error</CardTitle>
              </CardHeader>
              <CardContent>
                  <p className="text-red-500">Could not load currency settings. Financial goals cannot be displayed.</p>
              </CardContent>
          </Card>
      );
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle className="flex items-center"><Target className="mr-2 h-5 w-5 text-green-500" /> Financial Goals</CardTitle>
            <CardDescription>
                Track your progress. Displayed in {currencyContext.allCurrenciesData[currencyContext.userPreferredCurrency]?.name || currencyContext.userPreferredCurrency}.
            </CardDescription>
        </div>
        <Button onClick={openAddGoalForm} size="sm">
          <PlusCircle className="mr-2 h-4 w-4" /> Add Goal
        </Button>
      </CardHeader>
      <CardContent>
            <GoalsAccordion
                goals={goals}
                userId={userId}
                onEditGoal={openEditGoalForm}
                onAddContribution={openAddContributionForm}
                onRefreshGoals={fetchGoals}
                onViewContributions={handleViewContributions}
                isLoading={isLoading}
                currencyContext={currencyContext}
            />
      </CardContent>

      <Dialog open={showGoalFormDialog} onOpenChange={setShowGoalFormDialog}>
        <DialogContent className="sm:max-w-md"> {/* Consider sm:max-w-lg for more space like in GoalPageClientContent */}
          <DialogHeader>
            <DialogTitle>{editingGoal ? 'Edit Financial Goal' : 'Add New Financial Goal'}</DialogTitle>
            <DialogDescription>
                {editingGoal ? `Update details for ${editingGoal.name}. Goal currency: ${editingGoal.currency_code}` : `Set a new goal. Choose its currency.`}
            </DialogDescription>
          </DialogHeader>
          {/* Ensure currencyContext is not null before rendering form relying on it */}
          {currencyContext && (
            <FinancialGoalForm
                userId={userId}
                initialData={editingGoal}
                onSubmitSuccess={handleGoalFormSuccess}
                onCancel={() => setShowGoalFormDialog(false)}
                currencyContext={currencyContext}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showContributionFormDialog} onOpenChange={setShowContributionFormDialog}>
        <DialogContent className="sm:max-w-md"> {/* Consider sm:max-w-lg */}
          <DialogHeader>
            <DialogTitle>Log Contribution for {selectedGoalForContribution?.name}</DialogTitle>
             <DialogDescription>
              Goal currency: {selectedGoalForContribution?.currency_code}. Contribution will be recorded in its native currency.
            </DialogDescription>
          </DialogHeader>
          {/* Ensure both selectedGoal and currencyContext are available */}
          {selectedGoalForContribution && currencyContext && (
            <GoalContributionForm
              userId={userId}
              goalId={selectedGoalForContribution.id} // Non-null assertion removed, handled by conditional rendering
              goalCurrency={selectedGoalForContribution.currency_code}
              onSubmitSuccess={handleContributionFormSuccess}
              onCancel={() => setShowContributionFormDialog(false)}
              currencyContext={currencyContext}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}