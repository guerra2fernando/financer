/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react/no-unescaped-entities */
'use client';

import React from 'react';
import { Debt } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption
} from '@/components/ui/table';
import { PlusCircle, Edit, Trash2, ReceiptText, Loader2, HandCoins } from 'lucide-react';
import { deleteDebt } from '@/services/debtService';
import { format, parseISO, isPast } from 'date-fns';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, AllCurrenciesData, ExchangeRatesMap } from '@/lib/utils';
import { CurrencyCode } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';

interface DebtManagementSectionProps {
  debts: Debt[];
  userId: string; // Kept for potential future use, not directly used in deleteDebt here
  onEditDebt: (debt: Debt) => void;
  onLogDebtPayment: (debt: Debt) => void;
  onRefreshDebts: () => Promise<void>;
  onAddDebt: () => void;
  isLoading: boolean;
  userPreferredCurrency: CurrencyCode;
  baseReportingCurrency: CurrencyCode; // Typically USD, for converting if needed
  allCurrenciesData: AllCurrenciesData;
  currentExchangeRates: ExchangeRatesMap;
}

export default function DebtManagementSection({
  debts,
  userId,
  onEditDebt,
  onLogDebtPayment,
  onRefreshDebts,
  onAddDebt,
  isLoading,
  userPreferredCurrency,
  baseReportingCurrency, // Unused here if always formatting from native to preferred
  allCurrenciesData,
  currentExchangeRates,
}: DebtManagementSectionProps) {
  const supabase = createClient();
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);

  const handleDeleteDebt = async (debtId: string) => {
    if (!confirm('Are you sure you want to delete this debt? This may affect related expense records.')) return;
    
    setIsDeleting(debtId);
    const { error } = await deleteDebt(supabase, debtId);
    setIsDeleting(null);

    if (error) {
      toast.error(`Failed to delete debt: ${error.message}`);
    } else {
      toast.success('Debt deleted successfully!');
      onRefreshDebts();
    }
  };

  if (isLoading && debts.length === 0) {
     return (
      <Card>
        <CardHeader>
           <CardTitle className="flex items-center"><HandCoins className="mr-2 h-5 w-5 text-red-500" />Debt Management</CardTitle>
           <CardDescription>Track and manage your outstanding loans and credit.</CardDescription>
        </CardHeader>
        <CardContent className="h-[150px] flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="ml-2">Loading debts...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center"><HandCoins className="mr-2 h-5 w-5 text-red-500" />Debt Management</CardTitle>
          <CardDescription>Track and manage your outstanding loans and credit. Amounts shown in {userPreferredCurrency}.</CardDescription>
        </div>
        <Button onClick={onAddDebt} size="sm">
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Debt
        </Button>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            {!isLoading && debts.length === 0 && (
                <TableCaption className="py-8">
                    No debts recorded. Click "Add New Debt" to get started.
                </TableCaption>
            )}
            <TableHeader>
              <TableRow>
                <TableHead>Creditor</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Current Balance (Native)</TableHead>
                <TableHead>Current Balance ({userPreferredCurrency})</TableHead>
                <TableHead>Min. Payment ({userPreferredCurrency})</TableHead>
                <TableHead>Interest</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right min-w-[220px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {debts.map((debt) => (
                <TableRow key={debt.id}>
                  <TableCell className="font-medium">{debt.creditor}</TableCell>
                  <TableCell>{debt.currency_code}</TableCell>
                  <TableCell>
                    {formatCurrency(debt.current_balance_native, debt.currency_code, debt.currency_code, allCurrenciesData, currentExchangeRates)}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(debt.current_balance_native, debt.currency_code, userPreferredCurrency, allCurrenciesData, currentExchangeRates)}
                  </TableCell>
                  <TableCell>
                    {debt.minimum_payment_native !== null && debt.minimum_payment_native !== undefined 
                        ? formatCurrency(debt.minimum_payment_native, debt.currency_code, userPreferredCurrency, allCurrenciesData, currentExchangeRates) 
                        : '-'}
                  </TableCell>
                  <TableCell>{debt.interest_rate_annual ? `${debt.interest_rate_annual.toFixed(2)}%` : '-'}</TableCell>
                  <TableCell>{debt.due_date ? format(parseISO(debt.due_date), 'MMM d, yyyy') : '-'}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        debt.is_paid
                          ? 'default'
                          : debt.due_date && isPast(parseISO(debt.due_date)) && debt.current_balance_native > 0 // Check native balance
                          ? 'destructive'
                          : 'outline'
                      }
                      className={debt.is_paid ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-700 dark:text-green-100' : ''}
                    >
                      {debt.is_paid 
                        ? 'Paid' 
                        : debt.due_date && isPast(parseISO(debt.due_date)) && debt.current_balance_native > 0 
                          ? 'Overdue' 
                          : 'Pending'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {!debt.is_paid && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onLogDebtPayment(debt)}
                        className="h-8 px-2 text-xs sm:text-sm"
                        aria-label={`Log payment for ${debt.creditor}`}
                      >
                        <ReceiptText className="h-3.5 w-3.5 mr-1 sm:mr-1.5" /> Log Payment
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEditDebt(debt)}
                      className="h-8 w-8"
                      aria-label={`Edit ${debt.creditor} debt`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteDebt(debt.id!)}
                      disabled={isDeleting === debt.id}
                      className="text-destructive hover:text-destructive-foreground hover:bg-destructive/10 h-8 w-8"
                      aria-label={`Delete ${debt.creditor} debt`}
                    >
                      {isDeleting === debt.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}