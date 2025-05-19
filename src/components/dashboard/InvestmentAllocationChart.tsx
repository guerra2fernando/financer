/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// src/components/dashboard/InvestmentAllocationChart.tsx
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
import { Investment, CurrencyContextProps } from '@/types'; // Ensured all types are available
import { formatCurrency, getChartColor, AllCurrenciesData, ExchangeRatesMap } from '@/lib/utils';
import { CurrencyCode } from '@/lib/constants';
// CurrencyCode is also available from '@/lib/constants' if needed standalone

interface InvestmentAllocationChartProps {
  investments: Investment[];
  // Props for currency context, passed from parent (e.g., dashboard page)
  userPreferredCurrency: CurrencyCode;
  baseReportingCurrency: CurrencyCode;
  allCurrenciesData: AllCurrenciesData;
  currentExchangeRates: ExchangeRatesMap;
}

export default function InvestmentAllocationChart({ 
    investments, 
    userPreferredCurrency, 
    baseReportingCurrency, 
    allCurrenciesData, 
    currentExchangeRates 
}: InvestmentAllocationChartProps) {

  const chartData = useMemo(() => {
    if (!investments || investments.length === 0) return [];
    const groupedData: { [key: string]: number } = {}; // Values will be in baseReportingCurrency

    investments.forEach(investment => {
      const type = investment.type || 'Uncategorized';
      // Use total_current_value_reporting_currency for consistent aggregation
      groupedData[type] = (groupedData[type] || 0) + (investment.total_current_value_reporting_currency || 0);
    });

    return Object.entries(groupedData)
      .filter(([, value]) => value > 0) // Only include types with a positive value
      .map(([name, valueInBaseReporting]) => ({ name, value: valueInBaseReporting })) // value is in baseReportingCurrency
      .sort((a,b) => b.value - a.value); // Sort by value descending
  }, [investments]); // baseReportingCurrency added for clarity, though aggregation uses pre-converted field

  if (chartData.length === 0) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Investment Allocation</CardTitle>
                <CardDescription>Breakdown by type (current value).</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center">
                <p className="text-muted-foreground">No investment data available.</p>
            </CardContent>
        </Card>
    );
  }

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name, value }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5 + (percent < 0.1 ? 15: 0) ; // Adjust label position for small slices
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const percentage = (percent * 100).toFixed(0);

    if (percent * 100 < 3) return null; // Hide label for very small slices

    return (
      <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="10px" fontWeight="medium">
        {`${name} (${percentage}%)`}
      </text>
    );
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle>Investment Allocation</CardTitle>
        <CardDescription>Breakdown by type (current value, shown in {userPreferredCurrency}).</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={100}
              innerRadius={50} // Donut chart
              fill="#8884d8"
              dataKey="value" // This 'value' is in baseReportingCurrency
              nameKey="name"
              label={renderCustomizedLabel}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getChartColor(index)} />
              ))}
            </Pie>
            <Tooltip 
                formatter={(valueInBaseReporting: number) => {
                    // value is the aggregated total_current_value_reporting_currency
                    const formattedValue = formatCurrency(
                        valueInBaseReporting,
                        baseReportingCurrency, // Source
                        userPreferredCurrency, // Target
                        allCurrenciesData,
                        currentExchangeRates
                    );
                    return [formattedValue, "Value"]; // [value, name]
                }} 
            />
            <Legend wrapperStyle={{fontSize: "12px", paddingTop: "10px"}}/>
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}