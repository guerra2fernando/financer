/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react/no-unescaped-entities */
'use client';

import React from 'react';
import { Expense } from '@/types';
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
import { deleteExpense } from '@/services/expenseService';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { formatCurrency, AllCurrenciesData, ExchangeRatesMap } from '@/lib/utils';
import { CurrencyCode } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';

interface ExpenseTableProps {
  expenses: Expense[];
  userId: string; // Kept for potential future use
  onEdit: (expense: Expense) => void;
  onRefresh: () => Promise<void>;
  isLoading: boolean;
  userPreferredCurrency: CurrencyCode;
  baseReportingCurrency: CurrencyCode; // Typically USD
  allCurrenciesData: AllCurrenciesData;
  currentExchangeRates: ExchangeRatesMap;
}

export default function ExpenseTable({
  expenses,
  userId,
  onEdit,
  onRefresh,
  isLoading,
  userPreferredCurrency,
  baseReportingCurrency, // Unused here if always formatting from native to preferred
  allCurrenciesData,
  currentExchangeRates,
}: ExpenseTableProps) {
  const supabase = createClient();
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);

  const handleDelete = async (expenseId: string) => {
    if (!confirm('Are you sure you want to delete this expense? This action cannot be undone.')) return;
    
    setIsDeleting(expenseId);
    const { error } = await deleteExpense(supabase, expenseId);
    setIsDeleting(null);

    if (error) {
      toast.error(`Failed to delete expense: ${error.message}`);
    } else {
      toast.success('Expense deleted successfully.');
      onRefresh();
    }
  };

  if (isLoading && expenses.length === 0) {
    return (
      <div className="py-8 flex justify-center items-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading expenses...</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
         {!isLoading && expenses.length === 0 && (
            <TableCaption className="py-8">
                No expenses recorded. Click "Add New Expense" or "Log Debt Payment" to start.
            </TableCaption>
        )}
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[120px]">Date</TableHead>
            <TableHead className="min-w-[120px]">Category</TableHead>
            <TableHead className="min-w-[80px]">Currency</TableHead>
            <TableHead className="min-w-[100px]">Amount (Native)</TableHead>
            <TableHead className="min-w-[100px]">Amount ({userPreferredCurrency})</TableHead>
            <TableHead className="min-w-[120px]">Account</TableHead>
            <TableHead className="min-w-[120px]">Linked Debt</TableHead>
            <TableHead className="min-w-[150px]">Description</TableHead>
            <TableHead className="text-right min-w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((expense) => (
            <TableRow key={expense.id}>
              <TableCell>{expense.date ? format(parseISO(expense.date), 'MMM d, yyyy') : '-'}</TableCell>
              <TableCell className="capitalize">{expense.category?.replace(/_/g, ' ') || '-'}</TableCell>
              <TableCell>{expense.currency_code}</TableCell>
              <TableCell>
                {formatCurrency(expense.amount_native, expense.currency_code, expense.currency_code, allCurrenciesData, currentExchangeRates)}
              </TableCell>
              <TableCell>
                {formatCurrency(expense.amount_native, expense.currency_code, userPreferredCurrency, allCurrenciesData, currentExchangeRates)}
              </TableCell>
              <TableCell>
                {expense.accounts?.name 
                  ? `${expense.accounts.name} (${expense.accounts.native_currency_code || 'N/A'})`
                  : (expense.account_id ? <span className="text-xs text-muted-foreground">N/A</span> : '-')}
              </TableCell>
              <TableCell>
                {expense.debts?.creditor ? (
                    <Badge variant="outline">{expense.debts.creditor}</Badge>
                ) : (expense.related_debt_id ? <span className="text-xs text-muted-foreground">N/A</span> : '-')}
              </TableCell>
              <TableCell className="max-w-[150px] truncate" title={expense.description || undefined}>
                {expense.description || '-'}
              </TableCell>
              <TableCell className="text-right space-x-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(expense)}
                  className="h-8 w-8"
                  aria-label="Edit expense"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(expense.id!)}
                  disabled={isDeleting === expense.id}
                  className="text-destructive hover:text-destructive-foreground hover:bg-destructive/10 h-8 w-8"
                  aria-label="Delete expense"
                >
                  {isDeleting === expense.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
