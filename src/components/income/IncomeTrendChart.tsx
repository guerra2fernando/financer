/* eslint-disable @typescript-eslint/no-unused-vars */
// src/components/income/IncomeTrendChart.tsx
'use client';

import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Income, CurrencyContextProps } from '@/types'; // Added CurrencyContextProps
import { format as formatDateFnsLocale, parseISO, startOfMonth } from 'date-fns'; // Renamed format to avoid conflict
import { formatCurrency } from '@/lib/utils'; // formatCurrency for display

interface IncomeTrendChartProps {
  allIncomes: Income[];
  currencyContext: CurrencyContextProps; // Add currencyContext prop
}

export default function IncomeTrendChart({ allIncomes, currencyContext }: IncomeTrendChartProps) {
  const { baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates } = currencyContext;

  const chartData = useMemo(() => {
    if (!allIncomes || allIncomes.length === 0) return [];

    const monthlyTotals: { [key: string]: number } = {}; // Totals will be in baseReportingCurrency

    allIncomes.forEach(income => {
      if (income.start_date && typeof income.amount_reporting_currency === 'number') { // Use amount_reporting_currency
        try {
          const monthKey = formatDateFnsLocale(startOfMonth(parseISO(income.start_date)), 'yyyy-MM');
          monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + income.amount_reporting_currency;
        } catch (error) {
          console.warn(`Invalid date format for income ID ${income.id}: ${income.start_date}`);
        }
      } else if (typeof income.amount_reporting_currency !== 'number') {
        console.warn(`Income ID ${income.id} missing amount_reporting_currency.`);
      }
    });

    return Object.entries(monthlyTotals)
      .map(([monthKey, totalInReportingCurrency]) => ({
        name: formatDateFnsLocale(parseISO(monthKey + '-01'), 'MMM yyyy'),
        // Store the aggregated amount in base reporting currency. Conversion happens at display time.
        income_base_reporting: totalInReportingCurrency,
      }))
      .sort((a, b) => {
         // Ensure correct date parsing for sort, example "Jan 2023" -> "2023-01-01"
        const dateA = parseISO(a.name.split(" ")[1] + "-" + 
                                (new Date(Date.parse(a.name.split(" ")[0] +" 1, 2012")).getMonth()+1).toString().padStart(2, '0') + 
                                "-01");
        const dateB = parseISO(b.name.split(" ")[1] + "-" + 
                                (new Date(Date.parse(b.name.split(" ")[0] +" 1, 2012")).getMonth()+1).toString().padStart(2, '0') +
                                "-01");
        return dateA.getTime() - dateB.getTime();
      });

  }, [allIncomes]); // baseReportingCurrency added to deps, though not directly used in aggregation logic here as amount_reporting_currency is pre-converted

  if (chartData.length === 0) {
    return (
      <div className="h-[350px] flex items-center justify-center">
        <p className="text-muted-foreground">
          No income data available to display trend. Add some income entries first.
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart
        data={chartData}
        margin={{
          top: 5,
          right: 30,
          left: 20, // Adjusted for potentially longer currency formatted values
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis
          tickFormatter={(valueInBaseReporting) => {
            // valueInBaseReporting is the aggregated amount_reporting_currency (e.g., USD)
            const formatted = formatCurrency(
              valueInBaseReporting,
              baseReportingCurrency, // Source is base reporting
              userPreferredCurrency, // Target is user preferred
              allCurrenciesData,
              currentExchangeRates
            );
            // Optional: Shorten the displayed currency code or remove it
            const currencyInfo = allCurrenciesData[userPreferredCurrency];
            return currencyInfo ? formatted.replace(currencyInfo.symbol, '').replace(userPreferredCurrency, '').trim() : formatted;
          }}
          tick={{ fontSize: 12 }}
          width={100} // Increased width for formatted currency values
        />
        <Tooltip 
          formatter={(valueInBaseReporting: number, name: string) => {
            // valueInBaseReporting is from dataKey="income_base_reporting"
            const formattedValue = formatCurrency(
              valueInBaseReporting,
              baseReportingCurrency,
              userPreferredCurrency,
              allCurrenciesData,
              currentExchangeRates
            );
            // 'name' here is 'income_base_reporting', change to a more user-friendly label
            return [formattedValue, "Income"]; 
          }} 
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="income_base_reporting" // Use the field storing base reporting currency values
          name="Income" // Legend display name
          stroke="#16a34a"
          strokeWidth={2}
          activeDot={{ r: 7 }}
          dot={{ r: 3}}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}