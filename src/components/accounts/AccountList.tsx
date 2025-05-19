/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react/no-unescaped-entities */
// src/components/pages/accounts/AccountList.tsx
'use client';

import React from 'react';
import type { Account, CurrencyContextProps } from '@/types'; // Added CurrencyContextProps
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
import { deleteAccount } from '@/services/accountService';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils'; // Ensure this is the updated multi-currency one
import { BASE_REPORTING_CURRENCY } from '@/lib/constants';

interface AccountListProps {
  accounts: Account[];
  onEdit: (account: Account) => void;
  onRefresh: () => Promise<void>;
  isLoading: boolean;
  currencyContext: CurrencyContextProps; // Added currencyContext
}

export default function AccountList({
  accounts,
  onEdit,
  onRefresh,
  isLoading,
  currencyContext, // Destructure from props
}: AccountListProps) {
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);
  const supabaseBrowserClient = createClient();

  const { userPreferredCurrency, allCurrenciesData, currentExchangeRates, baseReportingCurrency } = currencyContext;

  const handleDelete = async (accountId: string) => {
    if (!confirm('Are you sure you want to delete this account? This might affect linked transactions and cannot be undone.')) return;
    
    setIsDeleting(accountId);
    const { error } = await deleteAccount(supabaseBrowserClient, accountId);
    setIsDeleting(null);

    if (error) {
      toast.error(`Failed to delete account: ${error.message}`);
    } else {
      toast.success('Account deleted successfully.');
      onRefresh();
    }
  };

  if (isLoading && accounts.length === 0) {
    return (
      <div className="py-8 flex justify-center items-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading accounts...</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        {!isLoading && accounts.length === 0 && (
            <TableCaption className="py-8 text-center">
                No accounts found. Click "Add New Account" to get started.
            </TableCaption>
        )}
         <TableCaption>
            Account balances are displayed in your preferred currency: {userPreferredCurrency}.
         </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px] sm:w-[250px]">Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Balance ({userPreferredCurrency})</TableHead>
            <TableHead className="hidden sm:table-cell text-center">Native Currency</TableHead>
            <TableHead className="hidden lg:table-cell text-right">Balance ({baseReportingCurrency})</TableHead>
            <TableHead className="text-right w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((account) => (
            <TableRow key={account.id}>
              <TableCell className="font-medium">{account.name}</TableCell>
              <TableCell className="capitalize">{account.type.replace('_', ' ')}</TableCell>
              <TableCell className="text-right">
                {formatCurrency(
                    account.balance_native, 
                    account.native_currency_code, 
                    userPreferredCurrency, 
                    allCurrenciesData, 
                    currentExchangeRates
                )}
              </TableCell>
              <TableCell className="hidden sm:table-cell text-center">{account.native_currency_code}</TableCell>
              <TableCell className="hidden lg:table-cell text-right">
                 {formatCurrency(
                    account.balance_reporting_currency, 
                    baseReportingCurrency, // Source is USD (reporting currency)
                    userPreferredCurrency, 
                    allCurrenciesData, 
                    currentExchangeRates
                 )}
                 {" "}
                 <span className="text-xs text-muted-foreground">({baseReportingCurrency})</span>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(account)}
                  className="mr-1 h-8 w-8"
                  aria-label={`Edit ${account.name}`}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(account.id!)}
                  disabled={isDeleting === account.id}
                  className="text-destructive hover:text-destructive-foreground hover:bg-destructive/90 h-8 w-8"
                  aria-label={`Delete ${account.name}`}
                >
                 {isDeleting === account.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}