// src/components/investments/InvestmentTransactionList.tsx
'use client';

import React, { useState, useEffect } from 'react'; // Added React for useState
import { InvestmentTransaction, CurrencyContextProps } from '@/types'; // Added CurrencyContextProps
import { getInvestmentTransactions } from '@/services/investmentService';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption,
} from '@/components/ui/table';
import { format as formatDateFnsLocale, parseISO } from 'date-fns'; // Renamed format
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { CurrencyCode } from '@/lib/constants';

interface InvestmentTransactionListProps {
  investmentId: string;
  userId: string;
  currencyContext: CurrencyContextProps; // Add currencyContext prop
}

export default function InvestmentTransactionList({ investmentId, userId, currencyContext }: InvestmentTransactionListProps) {
  const supabase = createClient();
  const [transactions, setTransactions] = useState<InvestmentTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates } = currencyContext;

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!investmentId || !userId) {
        setTransactions([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      const { data, error } = await getInvestmentTransactions(supabase, investmentId, userId);
      if (error) {
        toast.error(`Failed to load transactions: ${error.message}`);
        setTransactions([]);
      } else {
        setTransactions(data || []);
      }
      setIsLoading(false);
    };
    fetchTransactions();
  }, [investmentId, userId, supabase]);

  if (isLoading) {
    return (
      <div className="space-y-2 mt-4">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }

  if (transactions.length === 0) {
    return <p className="text-sm text-muted-foreground mt-4 text-center py-4">No transactions recorded for this investment yet.</p>;
  }
  
  const formatVal = (value: number | null | undefined, sourceCurrency: CurrencyCode) => {
    if (value === null || value === undefined) return '-';
    return formatCurrency(value, sourceCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates);
  };
  
  const formatValNative = (value: number | null | undefined, nativeCurrency: CurrencyCode) => {
    if (value === null || value === undefined) return '-';
    // For displaying native tx values, the target currency is the same as source
    return formatCurrency(value, nativeCurrency, nativeCurrency, allCurrenciesData, currentExchangeRates);
  }

  return (
    <div className="mt-4 border rounded-lg overflow-auto">
      <h4 className="text-md font-semibold p-3 border-b bg-muted/30 dark:bg-muted/20">Transactions ({userPreferredCurrency})</h4>
      <Table>
         <TableCaption className="mt-2 text-xs">Transaction values are displayed in your preferred currency ({userPreferredCurrency}).</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Price/Unit ({userPreferredCurrency})</TableHead>
            <TableHead className="text-right hidden md:table-cell">Price/Unit ({transactions[0]?.currency_code || 'Native'})</TableHead>
            <TableHead className="text-right">Total ({userPreferredCurrency})</TableHead>
            <TableHead className="text-right">Fees ({userPreferredCurrency})</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell>{formatDateFnsLocale(parseISO(tx.date), 'MMM d, yy')}</TableCell>
              <TableCell>{tx.transaction_type.charAt(0).toUpperCase() + tx.transaction_type.slice(1)}</TableCell>
              <TableCell className="text-right">{tx.quantity.toLocaleString()}</TableCell>
              <TableCell className="text-right">{formatVal(tx.price_per_unit_reporting_currency, baseReportingCurrency)}</TableCell>
              <TableCell className="text-right hidden md:table-cell">{formatValNative(tx.price_per_unit_native, tx.currency_code)}</TableCell>
              <TableCell className="text-right">{formatVal(tx.total_amount_reporting_currency, baseReportingCurrency)}</TableCell>
              <TableCell className="text-right">{formatVal(tx.fees_reporting_currency, baseReportingCurrency)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}