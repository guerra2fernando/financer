/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/dashboard/FinancialHealthTrendChart.tsx
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Income, Expense, Account } from '@/types';

import { CurrencyCode } from '@/lib/constants';
import { 
  format as formatDateFns, parseISO, differenceInDays, 
  eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, 
  startOfDay, startOfWeek, startOfMonth, endOfMonth,
  isAfter, isBefore, isEqual, startOfToday, endOfDay, endOfWeek
} from 'date-fns';
import { formatCurrency, AllCurrenciesData, ExchangeRatesMap } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

interface FinancialHealthTrendChartProps {
  allIncomes: Income[];
  expenses: Expense[];
  accounts: Account[];
  dateRange?: DateRange;
  userPreferredCurrency: CurrencyCode;
  baseReportingCurrency: CurrencyCode;
  allCurrenciesData: AllCurrenciesData;
  currentExchangeRates: ExchangeRatesMap;
}

const aggregateDataByPeriod = (
  items: (Income | Expense)[], // Can be incomes or expenses
  dateRange: DateRange,
  amountField: 'amount_reporting_currency' // Ensure we use the reporting currency
) => {
  const periodTotals: { [key: string]: number } = {};
  if (!dateRange.from || !dateRange.to) return periodTotals;

  const from = dateRange.from;
  const to = dateRange.to;
  const daysDiff = differenceInDays(to, from);

  let intervalUnit: 'day' | 'week' | 'month' = 'month';
  if (daysDiff <= 31) intervalUnit = 'day';
  else if (daysDiff <= 90) intervalUnit = 'week';

  let intervalStartDates: Date[];
  if (intervalUnit === 'day') {
    intervalStartDates = eachDayOfInterval({ start: from, end: to });
  } else if (intervalUnit === 'week') {
    intervalStartDates = eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 });
  } else {
    intervalStartDates = eachMonthOfInterval({ start: from, end: to });
  }
  
  intervalStartDates.forEach(date => {
    const key = formatDateFns(date, 'yyyy-MM-dd');
    periodTotals[key] = 0;
  });

  items.forEach(item => {
    // Determine date field based on item type (Income has start_date, Expense has date)
    const itemDateStr = 'start_date' in item ? item.start_date : item.date;
    if (!itemDateStr) return;
    const itemDate = parseISO(itemDateStr);

    if (itemDate < from || itemDate > to) return; 
    
    let periodStartForKey: Date;
    if (intervalUnit === 'day') periodStartForKey = startOfDay(itemDate);
    else if (intervalUnit === 'week') periodStartForKey = startOfWeek(itemDate, { weekStartsOn: 1 });
    else periodStartForKey = startOfMonth(itemDate);
    
    const key = formatDateFns(periodStartForKey, 'yyyy-MM-dd');
    if (periodTotals.hasOwnProperty(key)) { 
      periodTotals[key] += (item as any)[amountField] || 0;
    }
  });
  return periodTotals;
};

const CustomTooltipContent = ({ active, payload, label, props }: any) => {
  if (active && payload && payload.length && props) {
    const { userPreferredCurrency, baseReportingCurrency, allCurrenciesData, currentExchangeRates } = props;
    return (
      <div className="custom-tooltip bg-background p-3 border shadow-lg rounded-md text-sm">
        <p className="label font-semibold mb-2">{`${label}`}</p>
        {payload.map((pld: any) => (
          <div key={pld.dataKey} className="flex justify-between items-center">
            <span style={{ color: pld.color, marginRight: '8px' }}>{pld.name}:</span>
            <span className="font-medium">
              {formatCurrency(pld.value, baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};


export default function FinancialHealthTrendChart({ 
    allIncomes, expenses, accounts, dateRange,
    userPreferredCurrency, baseReportingCurrency, allCurrenciesData, currentExchangeRates 
}: FinancialHealthTrendChartProps) {
  const chartData = useMemo(() => {
    if (!dateRange || !dateRange.from || !dateRange.to || !accounts || accounts.length === 0) {
      return [];
    }

    const today = startOfToday();
    const totalCurrentBalanceUSD = accounts.reduce((sum, acc) => sum + acc.balance_reporting_currency, 0);

    const accountIncomes = allIncomes.filter(inc => inc.account_id && inc.start_date);
    const accountExpenses = expenses.filter(exp => exp.account_id && exp.date);

    const from = dateRange.from;
    const to = dateRange.to;
    const daysDiff = differenceInDays(to, from);

    let intervalUnit: 'day' | 'week' | 'month' = 'month';
    if (daysDiff <= 31) intervalUnit = 'day';
    else if (daysDiff <= 90) intervalUnit = 'week';
    
    let periodStartDates: Date[];
    if (intervalUnit === 'day') periodStartDates = eachDayOfInterval({ start: from, end: to });
    else if (intervalUnit === 'week') periodStartDates = eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 });
    else periodStartDates = eachMonthOfInterval({ start: from, end: to });
    
    const relevantPeriodStartDates = periodStartDates.filter(d => 
        (isBefore(d, to) || isEqual(d, to)) && (isAfter(d, from) || isEqual(d, from))
    );

    const aggregatedExpensesUSD = aggregateDataByPeriod(expenses, dateRange, 'amount_reporting_currency');

    return relevantPeriodStartDates.map(pStartDate => {
      let pEndDate: Date;
      if (intervalUnit === 'day') pEndDate = endOfDay(pStartDate); 
      else if (intervalUnit === 'week') pEndDate = endOfWeek(pStartDate, { weekStartsOn: 1 });
      else pEndDate = endOfMonth(startOfMonth(pStartDate)); 

      if (isAfter(pEndDate, to)) pEndDate = to;
      
      let balanceAtPeriodEndUSD = totalCurrentBalanceUSD;

      accountIncomes.forEach(income => {
        const incomeDate = startOfDay(parseISO(income.start_date));
        if (isAfter(incomeDate, pEndDate) && (isBefore(incomeDate, today) || isEqual(incomeDate, today))) {
          balanceAtPeriodEndUSD -= income.amount_reporting_currency;
        }
      });

      accountExpenses.forEach(expense => {
        const expenseDate = startOfDay(parseISO(expense.date));
        if (isAfter(expenseDate, pEndDate) && (isBefore(expenseDate, today) || isEqual(expenseDate, today))) {
          balanceAtPeriodEndUSD += expense.amount_reporting_currency;
        }
      });
      
      const periodKey = formatDateFns(pStartDate, 'yyyy-MM-dd');
      const spendingForThisPeriodUSD = aggregatedExpensesUSD[periodKey] || 0;
      
      let name: string;
      if (intervalUnit === 'day') name = formatDateFns(pStartDate, 'd MMM');
      else if (intervalUnit === 'week') {
        const weekEnd = endOfWeek(pStartDate, { weekStartsOn: 1 });
        name = `W${formatDateFns(pStartDate, 'w')} (${formatDateFns(pStartDate, 'd')}-${formatDateFns(isAfter(weekEnd, to) ? to : weekEnd, 'd MMM')})`;
      } else name = formatDateFns(pStartDate, 'MMM yyyy');
      
      return {
        name,
        balance: balanceAtPeriodEndUSD,
        spending: spendingForThisPeriodUSD,
      };
    }).filter(dp => dp.balance !== undefined && dp.spending !== undefined);

  }, [allIncomes, expenses, accounts, dateRange]);

  const tooltipProps = { userPreferredCurrency, baseReportingCurrency, allCurrenciesData, currentExchangeRates };

  if (!dateRange || !dateRange.from || !dateRange.to ) {
     return ( <Card><CardHeader><CardTitle>Financial Health Trend</CardTitle><CardDescription>Account Balance vs. Spending over time.</CardDescription></CardHeader><CardContent className="h-[300px] flex items-center justify-center"><p className="text-muted-foreground">Select a date range to view the trend.</p></CardContent></Card> );
  }
  if (!accounts || accounts.length === 0) {
     return ( <Card><CardHeader><CardTitle>Financial Health Trend</CardTitle><CardDescription>Account Balance vs. Spending over time.</CardDescription></CardHeader><CardContent className="h-[300px] flex items-center justify-center"><p className="text-muted-foreground">No account data available.</p></CardContent></Card> );
  }
  if (chartData.length === 0 ) {
     return ( <Card><CardHeader><CardTitle>Financial Health Trend</CardTitle><CardDescription>Account Balance vs. Spending over time.</CardDescription></CardHeader><CardContent className="h-[300px] flex items-center justify-center"><p className="text-muted-foreground">No trend data for the selected period.</p></CardContent></Card> );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial Health Trend</CardTitle>
        <CardDescription>Account Balance vs. Spending in the selected period (shown in {userPreferredCurrency}).</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis 
                yAxisId="left" 
                orientation="left" 
                tickFormatter={(value) => formatCurrency(value, baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates).replace(userPreferredCurrency,'').trim()} 
                tick={{ fontSize: 12 }} 
                domain={['auto', 'auto']}
            />
            <Tooltip content={<CustomTooltipContent props={tooltipProps} />} />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="balance" stroke="#8884d8" activeDot={{ r: 6 }} name="Account Balance" dot={false} />
            <Line yAxisId="left" type="monotone" dataKey="spending" stroke="#ef4444" activeDot={{ r: 6 }} name="Spending" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}