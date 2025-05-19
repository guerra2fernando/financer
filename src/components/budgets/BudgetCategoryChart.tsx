/* eslint-disable @typescript-eslint/no-unused-vars */
// src/components/budgets/BudgetCategoryChart.tsx
'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { BudgetListItemProcessed, CurrencyContextProps, Currency, } from '@/types';
import { getDisplayCategoryName, ExpenseCategorySlug, BASE_REPORTING_CURRENCY, CurrencyCode } from '@/lib/constants';
import { getChartColor, formatCurrency } from '@/lib/utils'; // Assuming formatCurrency is updated
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface BudgetCategoryChartProps {
  budgetsWithActuals: BudgetListItemProcessed[];
  currencyContext: CurrencyContextProps;
}

interface ChartDataItem {
  name: string; // Display name for legend/tooltip
  value: number; // For pie chart segment size - amount_limit_reporting_currency
  // Pass other data for tooltip
  category_slug: ExpenseCategorySlug; // Original slug
  amount_limit_native: number;
  currency_code: CurrencyCode;
  actualSpendingInReportingCurrency: number;
}

interface TooltipPayloadItem {
  payload: ChartDataItem; // Use the refined ChartDataItem
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  currencyContext?: CurrencyContextProps; // Pass context for formatting
}

// Custom Tooltip for more control
const CustomTooltipContent = ({ active, payload, currencyContext }: CustomTooltipProps) => {
  if (active && payload && payload.length && currencyContext) {
    const data = payload[0].payload;
    const { userPreferredCurrency, allCurrenciesData, currentExchangeRates, baseReportingCurrency } = currencyContext;

    return (
      <div className="rounded-md border bg-popover p-2 text-popover-foreground shadow-md">
        <p className="font-medium">{data.name}</p> {/* Already display name */}
        <p className="text-sm text-muted-foreground">
          Limit: {formatCurrency(data.amount_limit_native, data.currency_code, userPreferredCurrency, allCurrenciesData, currentExchangeRates)}
        </p>
        <p className="text-sm text-muted-foreground">
          Spent: {formatCurrency(data.actualSpendingInReportingCurrency, baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates)}
        </p>
      </div>
    );
  }
  return null;
};


export default function BudgetCategoryChart({ budgetsWithActuals, currencyContext }: BudgetCategoryChartProps) {
  const chartData: ChartDataItem[] = budgetsWithActuals
    .filter(b => b.amount_limit_reporting_currency > 0 || b.actualSpendingInReportingCurrency > 0)
    .map(budget => {
      const categoryName = getDisplayCategoryName(budget.category as ExpenseCategorySlug);
      return {
        name: categoryName,
        value: budget.amount_limit_reporting_currency, // Use reporting currency (USD) for consistent pie slice sizing
        category_slug: budget.category,
        amount_limit_native: budget.amount_limit_native,
        currency_code: budget.currency_code,
        actualSpendingInReportingCurrency: budget.actualSpendingInReportingCurrency,
      };
    });

  if (!chartData || chartData.length === 0) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Category Breakdown</CardTitle>
                <CardDescription>Distribution of your budget limits by category (in {currencyContext.userPreferredCurrency}).</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center">
                <p className="text-muted-foreground">No budget data to display in chart.</p>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
        <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
            <CardDescription>Distribution of budget limits by category (in {currencyContext.userPreferredCurrency}).</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] sm:h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    innerRadius={40}
                    fill="#8884d8"
                    dataKey="value" // Based on amount_limit_reporting_currency (USD)
                    nameKey="name"
                    paddingAngle={2}
                >
                {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getChartColor(index)} />
                ))}
                </Pie>
                <Tooltip content={<CustomTooltipContent currencyContext={currencyContext} />} />
                <Legend
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                    wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                />
            </PieChart>
            </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
