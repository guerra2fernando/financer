// src/components/dashboard/IncomeDistributionChart.tsx
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
import { Income } from '@/types';
import { formatCurrency, getChartColor, AllCurrenciesData, ExchangeRatesMap } from '@/lib/utils';
import { CurrencyCode } from '@/lib/constants';

interface IncomeDistributionChartProps {
  incomes: Income[];
  userPreferredCurrency: CurrencyCode;
  baseReportingCurrency: CurrencyCode;
  allCurrenciesData: AllCurrenciesData;
  currentExchangeRates: ExchangeRatesMap;
}

export default function IncomeDistributionChart({ 
    incomes, userPreferredCurrency, baseReportingCurrency, allCurrenciesData, currentExchangeRates 
}: IncomeDistributionChartProps) {
  const chartData = useMemo(() => {
    if (!incomes || incomes.length === 0) return [];
    const groupedData: { [key: string]: number } = {};
    incomes.forEach(income => {
      const source = income.source_name || 'Uncategorized';
      groupedData[source] = (groupedData[source] || 0) + income.amount_reporting_currency; // Use reporting currency (USD)
    });
    return Object.entries(groupedData).map(([name, value]) => ({ name, value }));
  }, [incomes]);

  if (chartData.length === 0) {
    return ( <Card><CardHeader><CardTitle>Income Distribution</CardTitle><CardDescription>Breakdown by source.</CardDescription></CardHeader><CardContent className="h-[300px] flex items-center justify-center"><p className="text-muted-foreground">No income data for this period.</p></CardContent></Card> );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Income Distribution</CardTitle>
        <CardDescription>Breakdown by source in the selected period (shown in {userPreferredCurrency}).</CardDescription>
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
              dataKey="value"
              nameKey="name"
              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getChartColor(index)} />
              ))}
            </Pie>
            <Tooltip 
                formatter={(value: number) => formatCurrency(value, baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates)} 
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}