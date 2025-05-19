/* eslint-disable @typescript-eslint/no-unused-vars */
// src/components/dashboard/DashboardClientContent.tsx 
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, parseISO, isEqual, isValid as isValidDate } from 'date-fns';
import { DateRange } from 'react-day-picker';

import DateRangePickerComponent from './DateRangePicker';
import SummaryCard from './SummaryCard';
import FinancialHealthTrendChart from './FinancialHealthTrendChart';
import IncomeDistributionChart from './IncomeDistributionChart';
import SpendingDistributionChart from './SpendingDistributionChart';
import InvestmentAllocationChart from './InvestmentAllocationChart';
import BudgetQuickView from './BudgetQuickView';
import QuickActions from './QuickActions';
import { DashboardInitialProps } from '@/app/(app)/dashboard/page'; // Updated import
import { formatCurrency } from '@/lib/utils';

import { DollarSign, CreditCard, TrendingUp, Wallet } from 'lucide-react';
import { Toaster } from "@/components/ui/sonner";
import { Profile } from '@/types';


interface DashboardClientContentProps {
  initialProps: DashboardInitialProps;
  initialDateRange: { from: string; to: string };
}

export default function DashboardClientContent({
  initialProps,
  initialDateRange,
}: DashboardClientContentProps) {
  const router = useRouter();
  const clientSearchParams = useSearchParams();

  // Destructure currency-related props
  const {
    userProfile,
    allCurrenciesData,
    currentExchangeRates,
    baseReportingCurrency,
  } = initialProps;
  const userPreferredCurrency = userProfile.preferred_currency;


  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    try {
      const from = parseISO(initialDateRange.from);
      const to = parseISO(initialDateRange.to);
      return (isValidDate(from) && isValidDate(to)) ? { from, to } : undefined;
    } catch (e) { return undefined; }
  });

  useEffect(() => {
    const urlFromStr = clientSearchParams.get('from');
    const urlToStr = clientSearchParams.get('to');
    let sourceFromDate: Date | undefined;
    let sourceToDate: Date | undefined;

    if (urlFromStr && urlToStr) {
      try {
        const parsedUrlFrom = parseISO(urlFromStr);
        const parsedUrlTo = parseISO(urlToStr);
        if (isValidDate(parsedUrlFrom) && isValidDate(parsedUrlTo)) {
          sourceFromDate = parsedUrlFrom;
          sourceToDate = parsedUrlTo;
        }
      } catch (e) { /* ignore parsing error, fallback below */ }
    }

    if (!sourceFromDate || !sourceToDate) {
      try {
        sourceFromDate = parseISO(initialDateRange.from);
        sourceToDate = parseISO(initialDateRange.to);
      } catch (e) { /* ignore parsing error */ }
    }
    
    const newEffectiveSourceDateRange: DateRange | undefined = 
        (sourceFromDate && sourceToDate && isValidDate(sourceFromDate) && isValidDate(sourceToDate)) 
        ? { from: sourceFromDate, to: sourceToDate } 
        : undefined;

    const localFrom = dateRange?.from;
    const localTo = dateRange?.to;
    
    let datesAreDifferent = false;
    if ((!localFrom && newEffectiveSourceDateRange?.from) || (localFrom && !newEffectiveSourceDateRange?.from) || (localFrom && newEffectiveSourceDateRange?.from && !isEqual(localFrom, newEffectiveSourceDateRange.from))) {
        datesAreDifferent = true;
    }
    if ((!localTo && newEffectiveSourceDateRange?.to) || (localTo && !newEffectiveSourceDateRange?.to) || (localTo && newEffectiveSourceDateRange?.to && !isEqual(localTo, newEffectiveSourceDateRange.to))) {
        datesAreDifferent = true;
    }

    if (datesAreDifferent) {
      setDateRange(newEffectiveSourceDateRange);
    }
  }, [clientSearchParams, initialDateRange, dateRange]);

  const handleDateRangeChange = (newRangePickedByUser: DateRange | undefined) => {
    setDateRange(newRangePickedByUser); 

    const currentUrlFrom = clientSearchParams.get('from');
    const currentUrlTo = clientSearchParams.get('to');
    let newQueryParamFrom: string | undefined;
    let newQueryParamTo: string | undefined;

    if (newRangePickedByUser?.from && newRangePickedByUser?.to && isValidDate(newRangePickedByUser.from) && isValidDate(newRangePickedByUser.to)) {
      newQueryParamFrom = format(newRangePickedByUser.from, 'yyyy-MM-dd');
      newQueryParamTo = format(newRangePickedByUser.to, 'yyyy-MM-dd');
    }
    
    if (newQueryParamFrom !== currentUrlFrom || newQueryParamTo !== currentUrlTo) {
      const newQuery = new URLSearchParams();
      clientSearchParams.forEach((value, key) => {
        if (key !== 'from' && key !== 'to') newQuery.set(key, value);
      });
      if (newQueryParamFrom) newQuery.set('from', newQueryParamFrom);
      if (newQueryParamTo) newQuery.set('to', newQueryParamTo);
      
      router.push(`/dashboard?${newQuery.toString()}`);
    }
  };
  
  const {
    totalIncomeUSD, totalSpendingUSD, netSavingsUSD, netWorthUSD, incomes,
    expenses, investments, currentMonthBudgets, currentMonthExpenses, allAccounts
  } = initialProps;

  const financialHealthData = useMemo(() => ({ incomes, expenses }), [incomes, expenses]);

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <Toaster richColors position="top-right" />
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Financial Dashboard</h1>
        <DateRangePickerComponent
          dateRange={dateRange}
          setDateRange={handleDateRangeChange}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard 
            title="Total Income" 
            value={formatCurrency(totalIncomeUSD, baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates)} 
            icon={<DollarSign className="h-5 w-5 text-green-500" />} 
            description="In selected period" />
        <SummaryCard 
            title="Total Spending" 
            value={formatCurrency(totalSpendingUSD, baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates)} 
            icon={<CreditCard className="h-5 w-5 text-red-500" />} 
            description="In selected period" />
        <SummaryCard 
            title="Net Savings" 
            value={formatCurrency(netSavingsUSD, baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates)} 
            icon={netSavingsUSD >= 0 ? <TrendingUp className="h-5 w-5 text-blue-500" /> : <TrendingUp className="h-5 w-5 text-orange-500 transform rotate-180" />} 
            description="Income - Spending" />
        <SummaryCard 
            title="Net Worth" 
            value={formatCurrency(netWorthUSD, baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates)} 
            icon={<Wallet className="h-5 w-5 text-indigo-500" />} 
            description="Current Snapshot" />
      </div>
      
      <QuickActions />

      <div className="grid gap-6 lg:grid-cols-2">
        <FinancialHealthTrendChart 
            allIncomes={financialHealthData.incomes} 
            expenses={financialHealthData.expenses} 
            accounts={allAccounts} 
            dateRange={dateRange}
            userPreferredCurrency={userPreferredCurrency}
            baseReportingCurrency={baseReportingCurrency}
            allCurrenciesData={allCurrenciesData}
            currentExchangeRates={currentExchangeRates}
        />
        <BudgetQuickView 
            budgets={currentMonthBudgets} 
            expenses={currentMonthExpenses}
            userPreferredCurrency={userPreferredCurrency}
            baseReportingCurrency={baseReportingCurrency}
            allCurrenciesData={allCurrenciesData}
            currentExchangeRates={currentExchangeRates}
        />
      </div>
      
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
        <IncomeDistributionChart 
            incomes={incomes}
            userPreferredCurrency={userPreferredCurrency}
            baseReportingCurrency={baseReportingCurrency}
            allCurrenciesData={allCurrenciesData}
            currentExchangeRates={currentExchangeRates}
        />
        <SpendingDistributionChart 
            expenses={expenses}
            userPreferredCurrency={userPreferredCurrency}
            baseReportingCurrency={baseReportingCurrency}
            allCurrenciesData={allCurrenciesData}
            currentExchangeRates={currentExchangeRates}
        />
        <InvestmentAllocationChart 
            investments={investments}
            userPreferredCurrency={userPreferredCurrency}
            baseReportingCurrency={baseReportingCurrency}
            allCurrenciesData={allCurrenciesData}
            currentExchangeRates={currentExchangeRates}
        />
      </div>
    </div>
  );
}