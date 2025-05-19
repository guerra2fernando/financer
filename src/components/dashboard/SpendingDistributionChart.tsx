/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/dashboard/SpendingDistributionChart.tsx
'use client';

import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Expense } from '@/types';
import { formatCurrency, getChartColor, AllCurrenciesData, ExchangeRatesMap } from '@/lib/utils';
import { CurrencyCode } from '@/lib/constants';
import { getDisplayCategoryName } from '@/lib/constants'; // For consistent category naming

interface SpendingDistributionChartProps {
  expenses: Expense[];
  userPreferredCurrency: CurrencyCode;
  baseReportingCurrency: CurrencyCode; // This is the currency of amount_reporting_currency (e.g. USD)
  allCurrenciesData: AllCurrenciesData;
  currentExchangeRates: ExchangeRatesMap;
}

export default function SpendingDistributionChart({ 
    expenses, 
    userPreferredCurrency, 
    baseReportingCurrency, 
    allCurrenciesData, 
    currentExchangeRates 
}: SpendingDistributionChartProps) {
  const chartData = useMemo(() => {
    if (!expenses || expenses.length === 0) return [];
    const groupedData: { [key: string]: number } = {};
    
    expenses.forEach(expense => {
      // Use getDisplayCategoryName for consistency if available, otherwise fallback
      const categoryName = expense.category 
        ? getDisplayCategoryName(expense.category) 
        : 'Uncategorized';
      
      // Aggregate using amount_reporting_currency for a consistent base value (e.g., USD)
      groupedData[categoryName] = (groupedData[categoryName] || 0) + expense.amount_reporting_currency;
    });

    return Object.entries(groupedData)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value); // Sort by value descending for better chart readability
  }, [expenses]);

  if (chartData.length === 0) {
     return (
        <Card>
            <CardHeader>
                <CardTitle>Spending Distribution</CardTitle>
                <CardDescription>Breakdown by category.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center">
                <p className="text-muted-foreground">No spending data for this period.</p>
            </CardContent>
        </Card>
     );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload; // The data entry for this slice
      const rawValue = payload[0].value; // This is amount_reporting_currency

      return (
        <div className="bg-background/80 backdrop-blur-sm p-2 border rounded-md shadow-lg">
          <p className="label font-semibold">{`${data.name}`}</p>
          <p className="value text-sm">
            {formatCurrency(
              rawValue, 
              baseReportingCurrency, // The source currency of 'rawValue' is baseReportingCurrency
              userPreferredCurrency, 
              allCurrenciesData, 
              currentExchangeRates
            )}
          </p>
        </div>
      );
    }
    return null;
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending Distribution</CardTitle>
        <CardDescription>
            Breakdown by category in the selected period (shown in {userPreferredCurrency}).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value" // This is amount_reporting_currency
              nameKey="name"
              label={({ name, percent, x, y, midAngle, outerRadius: or }) => {
                if (percent < 0.03) return null; // Hide label for very small slices
                const RADIAN = Math.PI / 180;
                const radius = or + 25; // Position label outside
                const lx = x + radius * Math.cos(-midAngle * RADIAN);
                const ly = y + radius * Math.sin(-midAngle * RADIAN);
                return (
                  <text x={lx} y={ly} fill="#666" textAnchor={lx > x ? 'start' : 'end'} dominantBaseline="central">
                    {`${name} (${(percent * 100).toFixed(0)}%)`}
                  </text>
                );
              }}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getChartColor(index)} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              formatter={(value, entry) => <span style={{ color: entry.color }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}