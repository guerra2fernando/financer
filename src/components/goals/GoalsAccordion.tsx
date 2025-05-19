/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-unused-vars */
// src/components/goals/GoalsAccordion.tsx
'use client';

import React from 'react';
import { FinancialGoal, CurrencyContextProps } from '@/types'; // Added CurrencyContextProps
import GoalContributionList from './GoalContributionList';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Edit, Trash2, DollarSign, Loader2 } from 'lucide-react';
import { deleteFinancialGoal } from '@/services/financialGoalService';
import { format, parseISO, differenceInMonths, isValid as isValidDate } from 'date-fns';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { BASE_REPORTING_CURRENCY } from '@/lib/constants';

interface GoalsAccordionProps {
  goals: FinancialGoal[];
  userId: string;
  onEditGoal: (goal: FinancialGoal) => void;
  onAddContribution: (goal: FinancialGoal) => void;
  onRefreshGoals: () => Promise<void>;
  onViewContributions: (goal: FinancialGoal) => void; // This prop might be redundant if accordion state handles it
  isLoading: boolean;
  currencyContext: CurrencyContextProps; // Add currencyContext
}

export default function GoalsAccordion({
  goals,
  userId,
  onEditGoal,
  onAddContribution,
  onRefreshGoals,
  onViewContributions, // May not be needed
  isLoading,
  currencyContext,
}: GoalsAccordionProps) {
  const supabase = currencyContext.supabaseClient; // Use client from context
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);
  const [openAccordionItem, setOpenAccordionItem] = React.useState<string | undefined>(undefined);

  const { userPreferredCurrency, allCurrenciesData, currentExchangeRates, baseReportingCurrency } = currencyContext;

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm('Are you sure you want to delete this financial goal and all its contributions? This action cannot be undone.')) return;
    
    setIsDeleting(goalId);
    const { error } = await deleteFinancialGoal(supabase, goalId);
    setIsDeleting(null);

    if (error) {
      toast.error(`Failed to delete financial goal: ${error.message}`);
    } else {
      toast.success('Financial goal deleted successfully.');
      onRefreshGoals();
    }
  };

  const getGoalProgress = (goal: FinancialGoal): number => {
    // Progress is based on reporting currency (USD) for consistent comparison
    if (goal.target_amount_reporting_currency <= 0) return 0;
    const progress = (goal.current_amount_saved_reporting_currency / goal.target_amount_reporting_currency) * 100;
    return Math.min(100, Math.max(0, progress));
  };

  const getMonthsRemaining = (targetDateStr: string | null | undefined): string => {
    if (!targetDateStr) return 'N/A';
    const targetDate = parseISO(targetDateStr);
    if (!isValidDate(targetDate)) return 'Invalid Date';
    const months = differenceInMonths(targetDate, new Date());
    if (months < 0 && new Date() > targetDate) return 'Past due';
    if (months === 0 && new Date().getMonth() === targetDate.getMonth() && new Date().getFullYear() === targetDate.getFullYear()) return 'This month';
    return months > 0 ? `${months} month${months === 1 ? '' : 's'}` : 'Achieved or past';
  };
  
  const handleAccordionChange = (value: string | undefined) => {
    setOpenAccordionItem(value);
    // If onViewContributions is used for something specific beyond opening, keep it
    // if (value) {
    //     const selected = goals.find(g => g.id === value);
    //     if (selected) {
    //         onViewContributions(selected);
    //     }
    // }
  };
  
  // Skeleton and no goals states (same as before)
  if (isLoading && goals.length === 0) {
    return (
      <div className="py-8 flex justify-center items-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading financial goals...</p>
      </div>
    );
  }

  if (!isLoading && goals.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-muted-foreground">No financial goals set up yet.</p>
        <p className="text-sm text-muted-foreground mt-1">Click "Add New Goal" to get started.</p>
      </div>
    );
  }

  const getStatusBadgeVariant = (status: FinancialGoal['status']): "default" | "secondary" | "outline" | "destructive" => {
    switch(status) {
        case 'achieved': return 'default'; // Or a success variant if you have one
        case 'active': return 'secondary';
        case 'paused': return 'outline';
        case 'cancelled': return 'destructive';
        default: return 'outline';
    }
  }

  return (
    <Accordion 
        type="single" 
        collapsible 
        className="w-full space-y-2"
        value={openAccordionItem}
        onValueChange={handleAccordionChange}
    >
      {goals.map((goal) => (
        <AccordionItem value={goal.id!} key={goal.id!} className="border rounded-lg shadow-sm overflow-hidden">
          <AccordionTrigger className="hover:bg-muted/50 dark:hover:bg-muted/20 px-4 py-3 text-sm data-[state=open]:bg-muted/50 data-[state=open]:dark:bg-muted/30">
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-2 gap-y-1 items-center text-left">
              <div className="font-semibold col-span-2 sm:col-span-1 truncate" title={goal.name}>
                {goal.name} ({goal.currency_code})
              </div>
              <Badge 
                variant={getStatusBadgeVariant(goal.status)}
                className={ /* Badge styling remains the same */
                  goal.status === 'achieved' ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-700 dark:text-green-100' : 
                  goal.status === 'cancelled' ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-700 dark:text-red-100' : ''
                }
              >
                {goal.status.charAt(0).toUpperCase() + goal.status.slice(1)}
              </Badge>
              <div className="text-xs md:text-sm">
                Progress: <span className="font-medium">{getGoalProgress(goal).toFixed(0)}%</span>
              </div>
              <div className="text-xs md:text-sm hidden md:block">
                Target: <span className="font-medium">{goal.target_date ? format(parseISO(goal.target_date), 'MMM yyyy') : 'N/A'}</span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="p-4 pt-2 space-y-3 bg-background data-[state=open]:border-t">
            <div className="mb-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>
                    {formatCurrency(goal.current_amount_saved_native, goal.currency_code, userPreferredCurrency, allCurrenciesData, currentExchangeRates)} saved
                </span>
                <span>
                    Target: {formatCurrency(goal.target_amount_native, goal.currency_code, userPreferredCurrency, allCurrenciesData, currentExchangeRates)}
                </span>
              </div>
              <Progress value={getGoalProgress(goal)} className="w-full h-2.5" />
              <p className="text-xs text-muted-foreground mt-1">
                {getGoalProgress(goal).toFixed(0)}% complete. 
                {goal.target_date && ` ${getMonthsRemaining(goal.target_date)}`}
              </p>
            </div>
            {goal.description && <p className="text-muted-foreground mb-2 border-l-2 pl-2 italic text-xs">{goal.description}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-3">
              <div>
                <span className="text-muted-foreground">Monthly Target: </span>
                <span className="font-medium">
                    {goal.monthly_contribution_target_native !== null && goal.monthly_contribution_target_native !== undefined 
                        ? formatCurrency(goal.monthly_contribution_target_native, goal.currency_code, userPreferredCurrency, allCurrenciesData, currentExchangeRates)
                        : 'N/A'
                    }
                </span>
              </div>
            </div>

            <div className="flex gap-2 justify-end items-center border-t pt-3">
              {goal.status === 'active' && (
                <Button variant="outline" size="sm" onClick={() => onAddContribution(goal)}>
                  <DollarSign className="mr-1.5 h-4 w-4" /> Log Contribution
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => onEditGoal(goal)}>
                <Edit className="mr-1.5 h-4 w-4" /> Edit Goal
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteGoal(goal.id!)}
                disabled={isDeleting === goal.id}
                className="text-destructive hover:text-destructive-foreground hover:bg-destructive/10"
              >
                {isDeleting === goal.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
                Delete
              </Button>
            </div>
            {openAccordionItem === goal.id && (
                 <GoalContributionList 
                    goalId={goal.id!} 
                    userId={userId} 
                    currencyContext={currencyContext} // Pass context
                 />
            )}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}