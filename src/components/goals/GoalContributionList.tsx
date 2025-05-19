/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// src/components/goals/GoalContributionList.tsx
'use client';

import { useState, useEffect } from 'react';
import { GoalContribution, CurrencyContextProps } from '@/types'; // Added CurrencyContextProps
import { getGoalContributions } from '@/services/financialGoalService';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { BASE_REPORTING_CURRENCY } from '@/lib/constants';

interface GoalContributionListProps {
  goalId: string;
  userId: string;
  currencyContext: CurrencyContextProps; // Add currencyContext
}

export default function GoalContributionList({ goalId, userId, currencyContext }: GoalContributionListProps) {
  const supabase = currencyContext.supabaseClient; // Use client from context
  const [contributions, setContributions] = useState<GoalContribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { userPreferredCurrency, allCurrenciesData, currentExchangeRates, baseReportingCurrency } = currencyContext;

  useEffect(() => {
    const fetchContributions = async () => {
      if (!goalId || !userId) {
        setContributions([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      const { data, error } = await getGoalContributions(supabase, goalId, userId);
      if (error) {
        toast.error(`Failed to load contributions: ${error.message}`);
        setContributions([]);
      } else {
        setContributions(data || []);
      }
      setIsLoading(false);
    };
    fetchContributions();
  }, [goalId, userId, supabase]);

  if (isLoading) {
    return (
      <div className="space-y-2 mt-4 p-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (contributions.length === 0) {
    return <p className="text-sm text-muted-foreground mt-4 p-2">No contributions recorded for this goal yet.</p>;
  }

  return (
    <div className="mt-4 border rounded-lg overflow-hidden">
      <h4 className="text-sm font-semibold p-3 border-b bg-muted/30 dark:bg-muted/20">
        Contribution History (in {userPreferredCurrency})
      </h4>
      <div className="max-h-60 overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-[120px]">Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>From Account</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contributions.map((contrib) => (
              <TableRow key={contrib.id}>
                <TableCell className="text-xs">{format(parseISO(contrib.date), 'MMM d, yy')}</TableCell>
                <TableCell className="text-xs font-medium">
                  {formatCurrency(
                    contrib.amount_native, 
                    contrib.currency_code, 
                    userPreferredCurrency, 
                    allCurrenciesData, 
                    currentExchangeRates
                  )}
                  {contrib.currency_code !== userPreferredCurrency && ` (${contrib.currency_code})`}
                </TableCell>
                <TableCell className="text-xs">
                    {/* Ensure accounts data structure is correct, assuming it is an object now for single account */}
                    {(contrib.accounts as any)?.name || (contrib.account_id ? <span className="text-muted-foreground">N/A</span> : '-')}
                </TableCell>
                <TableCell className="text-xs max-w-[150px] truncate" title={contrib.notes || undefined}>{contrib.notes || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}