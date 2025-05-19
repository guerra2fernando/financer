/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// src/components/investments/InvestmentAllocationDetailChart.tsx
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
import { Investment, CurrencyContextProps } from '@/types'; // Added CurrencyContextProps
import { formatCurrency, getChartColor } from '@/lib/utils';

interface InvestmentAllocationDetailChartProps {
  investments: Investment[];
  currencyContext: CurrencyContextProps; // Add currencyContext prop
}

export default function InvestmentAllocationDetailChart({ investments, currencyContext }: InvestmentAllocationDetailChartProps) {
  const { baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates } = currencyContext;

  const chartData = useMemo(() => {
    if (!investments || investments.length === 0) return [];
    const groupedData: { [key: string]: number } = {}; // Values will be in baseReportingCurrency

    investments.forEach(investment => {
      const type = investment.type || 'Uncategorized';
      // Use total_current_value_reporting_currency for consistent aggregation
      groupedData[type] = (groupedData[type] || 0) + (investment.total_current_value_reporting_currency || 0);
    });

    return Object.entries(groupedData)
      .filter(([, value]) => value > 0)
      .map(([name, valueInBaseReporting]) => ({ name, value: valueInBaseReporting })) // value is in baseReportingCurrency
      .sort((a,b) => b.value - a.value);
  }, [investments]); // baseReportingCurrency added to deps for clarity

  if (chartData.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <p className="text-muted-foreground">No investment data to display allocation.</p>
      </div>
    );
  }

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name, value }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const percentage = (percent * 100).toFixed(0);

    // Check if label is too small to display text
    if (percent * 100 < 5) return null; // Hide label for very small slices

    return (
      <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="10px">
        {`${name} (${percentage}%)`}
      </text>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={100} // Slightly increased for better label visibility
          innerRadius={50} // Make it a donut chart
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
  );
}