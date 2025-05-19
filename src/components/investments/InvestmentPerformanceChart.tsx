/* eslint-disable react/no-unescaped-entities */
// src/components/investments/InvestmentPerformanceChart.tsx
'use client';

import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Investment, InvestmentTransaction, CurrencyContextProps } from '@/types'; // Added CurrencyContextProps
import { format as formatDateFnsLocale, parseISO, startOfDay, isBefore, isEqual } from 'date-fns'; // Renamed format
import { formatCurrency } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface InvestmentPerformanceChartProps {
  selectedInvestment: Investment | null;
  transactions: InvestmentTransaction[];
  isLoading: boolean;
  currencyContext: CurrencyContextProps; // Add currencyContext prop
}

interface ChartDataPoint {
  date: string; // Formatted date for X-axis
  value_base_reporting: number; // Market value in base reporting currency
  cost_base_reporting: number; // Cumulative cost in base reporting currency
}

export default function InvestmentPerformanceChart({
  selectedInvestment,
  transactions,
  isLoading,
  currencyContext,
}: InvestmentPerformanceChartProps) {
  const { baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates } = currencyContext;

  const chartData = useMemo((): ChartDataPoint[] => {
    if (!selectedInvestment || transactions.length === 0) return [];

    const sortedTransactions = [...transactions].sort((a, b) => 
        parseISO(a.date).getTime() - parseISO(b.date).getTime()
    );

    let runningQuantity = 0;
    let runningCostReporting = 0; // Cost in BASE_REPORTING_CURRENCY
    // For a more accurate cost basis, you'd track lots. This is simplified.
    // Average cost per unit in reporting currency.
    let avgCostPerUnitReporting = 0; 

    const dataPointsMap = new Map<string, ChartDataPoint>();

    const initialDateStr = selectedInvestment.start_date 
        ? formatDateFnsLocale(startOfDay(parseISO(selectedInvestment.start_date)), 'MMM d, yy')
        : formatDateFnsLocale(startOfDay(parseISO(sortedTransactions[0].date)), 'MMM d, yy');
    
    dataPointsMap.set(initialDateStr, {
        date: initialDateStr,
        value_base_reporting: 0,
        cost_base_reporting: 0,
    });

    sortedTransactions.forEach(tx => {
      const txDate = startOfDay(parseISO(tx.date));
      const dateStr = formatDateFnsLocale(txDate, 'MMM d, yy');
      
      let costChangeReporting = 0;

      if (tx.transaction_type === 'buy') {
        costChangeReporting = (tx.total_amount_reporting_currency || 0) + (tx.fees_reporting_currency || 0);
        runningCostReporting += costChangeReporting;
        runningQuantity += tx.quantity;
        if (runningQuantity > 0) {
            avgCostPerUnitReporting = runningCostReporting / runningQuantity;
        }
      } else if (tx.transaction_type === 'sell') {
        // Simplified cost basis reduction: reduce by avg cost of units sold
        const costOfSoldUnitsReporting = avgCostPerUnitReporting * tx.quantity;
        costChangeReporting = -costOfSoldUnitsReporting; // Cost decreases
        runningCostReporting -= costOfSoldUnitsReporting;
        runningQuantity -= tx.quantity;
        if (runningQuantity <= 0) {
            runningQuantity = 0; // Ensure not negative
            runningCostReporting = 0; // Reset cost if all sold
            avgCostPerUnitReporting = 0;
        }
      } else if (tx.transaction_type === 'reinvest' || tx.transaction_type === 'dividend') {
         // Dividends/reinvestments are income, but if reinvested, they become part of cost basis
         if (tx.transaction_type === 'reinvest') {
            costChangeReporting = (tx.total_amount_reporting_currency || 0) + (tx.fees_reporting_currency || 0);
            runningCostReporting += costChangeReporting;
            runningQuantity += tx.quantity; // Assuming reinvest buys more quantity
            if (runningQuantity > 0) {
                avgCostPerUnitReporting = runningCostReporting / runningQuantity;
            }
         }
         // Simple dividends not reinvested don't change cost basis here, they are just income.
      }
      
      // Value is based on quantity * current_price_per_unit_reporting_currency from the main investment record.
      // This implies the chart shows the value of current holdings at the latest known market price, after each transaction date.
      // For a true historical portfolio value, you'd need historical prices of the asset.
      const currentValueReporting = runningQuantity * (selectedInvestment.current_price_per_unit_reporting_currency || 0);

      dataPointsMap.set(dateStr, {
        date: dateStr,
        value_base_reporting: currentValueReporting,
        cost_base_reporting: runningCostReporting,
      });
    });
    
    // Add a final point for today using the parent investment's current value if it's after the last transaction
    const today = startOfDay(new Date());
    const todayStr = formatDateFnsLocale(today, 'MMM d, yy');
    const lastTxDate = sortedTransactions.length > 0 ? startOfDay(parseISO(sortedTransactions[sortedTransactions.length - 1].date)) : startOfDay(parseISO(initialDateStr));

    if (selectedInvestment.total_current_value_reporting_currency != null && 
        (isBefore(lastTxDate, today) || isEqual(lastTxDate, today)) &&
        !dataPointsMap.has(todayStr) // Only add if today's point isn't already from a transaction
    ) {
        dataPointsMap.set(todayStr, {
            date: todayStr,
            value_base_reporting: selectedInvestment.total_current_value_reporting_currency,
            // Use the latest running cost, or investment's total_initial_cost_reporting_currency if more appropriate
            cost_base_reporting: selectedInvestment.total_initial_cost_reporting_currency ?? runningCostReporting 
        });
    }
    
    return Array.from(dataPointsMap.values()).sort((a,b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

  }, [selectedInvestment, transactions]);

  if (isLoading) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="ml-2 text-sm text-muted-foreground">Loading transaction data...</p>
      </div>
    );
  }

  if (!selectedInvestment) {
     return (
      <div className="h-[300px] flex items-center justify-center">
        <p className="text-sm text-muted-foreground text-center px-4">
          Select an investment to view its performance trend.
        </p>
      </div>
    );
  }
  
  if (chartData.length < 2 && selectedInvestment) {
     return (
      <div className="h-[300px] flex items-center justify-center">
        <p className="text-sm text-muted-foreground text-center px-4">
          Not enough data for "{selectedInvestment.name}" to display performance. Log transactions or ensure a start date is set.
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart
        data={chartData}
        margin={{
          top: 5, right: 20, left: 25, bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
        <YAxis
          tickFormatter={(valueInBaseReporting) => {
            const formatted = formatCurrency(valueInBaseReporting, baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates);
            const currencyInfo = allCurrenciesData[userPreferredCurrency];
            return currencyInfo ? formatted.replace(currencyInfo.symbol, '').replace(userPreferredCurrency, '').trim() : formatted;
          }}
          tick={{ fontSize: 10 }}
          width={80} // Increased width
        />
        <Tooltip 
          formatter={(valueInBaseReporting: number, nameKey: string) => {
            const formattedValue = formatCurrency(valueInBaseReporting, baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates);
            const label = nameKey === 'value_base_reporting' ? 'Market Value' : 'Cumulative Cost';
            return [formattedValue, label];
          }} 
        />
        <Legend wrapperStyle={{fontSize: "12px"}}/>
        <Area type="monotone" dataKey="value_base_reporting" stroke="#16a34a" fill="#16a34a" fillOpacity={0.2} name="Market Value" />
        <Area type="monotone" dataKey="cost_base_reporting" stroke="#fb923c" fill="#fb923c" fillOpacity={0.1} name="Cumulative Cost" />
      </AreaChart>
    </ResponsiveContainer>
  );
}