/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-unused-vars */
// src/components/income/IncomeTable.tsx
'use client';

import React from 'react';
import type { Income, CurrencyContextProps } from '@/types'; // Added CurrencyContextProps
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from '@/components/ui/table';
import { Edit, Trash2, Loader2 } from 'lucide-react';
import { deleteIncome } from '@/services/incomeService';
import { createClient } from '@/lib/supabase/client';
import { format as formatDateFns, parseISO } from 'date-fns'; // format used directly
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface IncomeTableProps {
  incomes: Income[];
  userId: string;
  onEdit: (income: Income) => void;
  onRefresh: () => Promise<void>;
  isLoading: boolean;
  currencyContext: CurrencyContextProps; // Add currencyContext prop
}

export default function IncomeTable({
  incomes,
  userId, // Keep if any row-specific action might need it, though deleteIncome uses incomeId
  onEdit,
  onRefresh,
  isLoading,
  currencyContext, // Destructure currencyContext
}: IncomeTableProps) {
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);
  const supabaseBrowserClient = createClient();

  const handleDelete = async (incomeId: string) => {
    if (!confirm('Are you sure you want to delete this income entry? This action cannot be undone.')) return;
    
    setIsDeleting(incomeId);
    const { error } = await deleteIncome(supabaseBrowserClient, incomeId);
    setIsDeleting(null);

    if (error) {
      toast.error(`Failed to delete income: ${error.message}`);
    } else {
      toast.success('Income entry deleted successfully.');
      onRefresh();
    }
  };

  if (isLoading && incomes.length === 0) {
    return (
      <div className="border rounded-lg p-8 flex justify-center items-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading income data...</p>
      </div>
    );
  }

  const { userPreferredCurrency, allCurrenciesData, currentExchangeRates } = currencyContext;

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        {!isLoading && incomes.length === 0 && (
            <TableCaption className="py-8 text-center">
                No income records found. Click "Add New Income" to get started.
            </TableCaption>
        )}
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[150px] sm:w-[200px]">Source</TableHead>
            <TableHead className="text-right">Amount ({userPreferredCurrency})</TableHead>
            <TableHead className="hidden md:table-cell text-right">Amount (Native)</TableHead>
            <TableHead className="hidden md:table-cell">Account</TableHead>
            <TableHead>Start Date</TableHead>
            <TableHead className="hidden sm:table-cell">End Date</TableHead>
            <TableHead className="text-center">Recurring</TableHead>
            <TableHead className="text-right w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {incomes.map((income) => {
            const formattedAmountPreferred = formatCurrency(
              income.amount_native,
              income.currency_code, // Source currency of the income
              userPreferredCurrency, // Target display currency
              allCurrenciesData,
              currentExchangeRates
            );
            const formattedAmountNative = formatCurrency(
              income.amount_native,
              income.currency_code,
              income.currency_code, // Display in its own native currency
              allCurrenciesData,
              currentExchangeRates // Rates still needed for Intl.NumberFormat setup
            );

            return (
              <TableRow key={income.id}>
                <TableCell className="font-medium truncate" title={income.source_name}>{income.source_name}</TableCell>
                <TableCell className="text-right">{formattedAmountPreferred}</TableCell>
                <TableCell className="text-right hidden md:table-cell">{formattedAmountNative}</TableCell>
                <TableCell className="hidden md:table-cell truncate" title={income.accounts && income.accounts.length > 0 ? income.accounts[0].name || 'N/A' : 'N/A'}>
                  {income.accounts && income.accounts.length > 0 ? income.accounts[0].name : (income.account_id ? <span className="text-xs text-muted-foreground">N/A</span> : '-')}
                </TableCell>
                <TableCell>{formatDateFns(parseISO(income.start_date), 'MMM d, yy')}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  {income.end_date ? formatDateFns(parseISO(income.end_date), 'MMM d, yy') : '-'}
                </TableCell>
                <TableCell className="text-center">
                  {income.is_recurring ? (
                      <Badge variant="outline" className="text-xs">
                          Yes ({income.recurrence_frequency?.charAt(0).toUpperCase() + income.recurrence_frequency!.slice(1)})
                      </Badge>
                  ) : (
                      <span className="text-xs text-muted-foreground">No</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(income)}
                    className="mr-1 h-8 w-8"
                    aria-label={`Edit ${income.source_name}`}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(income.id!)}
                    disabled={isDeleting === income.id}
                    className="text-destructive hover:text-destructive-foreground hover:bg-destructive/90 h-8 w-8"
                    aria-label={`Delete ${income.source_name}`}
                  >
                    {isDeleting === income.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
