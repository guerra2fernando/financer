/* eslint-disable @typescript-eslint/no-unused-vars */
// src/components/ai/BudgetAIRecommendationsDisplay.tsx
'use client';

import { useState, useEffect } from 'react';
import { AISuggestedBudgetCategory, AIBudgetRecommendationResponse, BudgetInsert, Budget, CurrencyContextProps } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { addBudget, updateBudget, getBudgetsByUserId } from '@/services/budgetService';
import { getExchangeRate } from '@/services/currencyService'; // Import getExchangeRate
import { toast } from 'sonner';
import { formatCurrency, cn } from '@/lib/utils';
import { getDisplayCategoryName, DEFAULT_BUDGET_CATEGORIES, ExpenseCategorySlug, BASE_REPORTING_CURRENCY, CurrencyCode } from '@/lib/constants';
import { Loader2, CheckCircle, XCircle, Edit3, Save, AlertTriangle, DollarSign, Percent } from 'lucide-react';
import InfoWithTooltip from '@/components/ui/InfoWithTooltip';
import { format, startOfMonth } from 'date-fns';
import { SupabaseClient } from '@supabase/supabase-js';


interface BudgetAIRecommendationsDisplayProps {
  userId: string;
  recommendationData: AIBudgetRecommendationResponse;
  onDiscard: () => void;
  onAcceptAndSave: (savedBudgets: Budget[]) => void;
  currencyContext: CurrencyContextProps;
}

export default function BudgetAIRecommendationsDisplay({
  userId,
  recommendationData,
  onDiscard,
  onAcceptAndSave,
  currencyContext,
}: BudgetAIRecommendationsDisplayProps) {
  const [recommendations, setRecommendations] = useState<AISuggestedBudgetCategory[]>([]);
  const [editingItemId, setEditingItemId] = useState<ExpenseCategorySlug | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentBudgets, setCurrentBudgets] = useState<Budget[]>([]);

  const supabase = currencyContext.supabaseClient;
  const { userPreferredCurrency, baseReportingCurrency, allCurrenciesData, currentExchangeRates } = currencyContext;

  const totalRecommendedUSD = recommendations.reduce((sum, r) => sum + r.suggested_amount_usd, 0);
  const incomeConsideredUSD = recommendationData.totalIncomeConsideredUSD;
  const percentageOfIncomeUsed = incomeConsideredUSD > 0 ? (totalRecommendedUSD / incomeConsideredUSD) * 100 : 0;
  const differenceFromIncomeUSD = incomeConsideredUSD - totalRecommendedUSD;

  useEffect(() => {
    const allRecsMap = new Map(recommendationData.recommendations.map(r => [r.category_slug, r]));
    const fullRecs: AISuggestedBudgetCategory[] = DEFAULT_BUDGET_CATEGORIES.map(slug => {
        if (allRecsMap.has(slug)) {
            return allRecsMap.get(slug)!;
        }
        return {
            category_slug: slug,
            suggested_amount_usd: 0,
            justification: "Not specifically recommended by AI. Adjust as needed.",
            is_fixed_from_user: false,
        };
    }).sort((a, b) => {
        if (a.is_fixed_from_user && !b.is_fixed_from_user) return -1;
        if (!a.is_fixed_from_user && b.is_fixed_from_user) return 1;
        return b.suggested_amount_usd - a.suggested_amount_usd;
    });
    setRecommendations(fullRecs);

    const fetchExistingBudgets = async () => {
        const periodStartDate = format(startOfMonth(new Date()), 'yyyy-MM-dd');
        const { data } = await getBudgetsByUserId(supabase, userId, periodStartDate);
        setCurrentBudgets(data || []);
    };
    fetchExistingBudgets();

  }, [recommendationData, userId, supabase]);

  const handleEdit = (rec: AISuggestedBudgetCategory) => {
    setEditingItemId(rec.category_slug);
    // Editing is done in USD as AI provides USD
    setEditValue(rec.suggested_amount_usd.toString());
  };

  const handleSaveEdit = (slug: ExpenseCategorySlug) => {
    const newAmountUSD = parseFloat(editValue);
    if (isNaN(newAmountUSD) || newAmountUSD < 0) {
      toast.error("Invalid amount. Please enter a non-negative number for USD value.");
      return;
    }
    setRecommendations(prev =>
      prev.map(r =>
        r.category_slug === slug ? { ...r, suggested_amount_usd: parseFloat(newAmountUSD.toFixed(2)) } : r
      )
    );
    setEditingItemId(null);
    toast.success(`${getDisplayCategoryName(slug)} USD amount updated locally.`);
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditValue('');
  };

  const handleAcceptAll = async () => {
    setIsLoading(true);
    const periodStartDate = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const savedBudgets: Budget[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const rec of recommendations) {
        const existingBudget = currentBudgets.find(
            b => b.category === rec.category_slug && b.period_start_date === periodStartDate
        );

        // Skip $0 AI recs unless it's to update an existing budget to $0 or it's a fixed user expense
        if (rec.suggested_amount_usd <= 0 && !existingBudget && !rec.is_fixed_from_user) {
            continue;
        }

        if (existingBudget) {
            let newNativeAmountForUpdate: number;
            if (existingBudget.currency_code === baseReportingCurrency) { // Existing budget is USD
                newNativeAmountForUpdate = rec.suggested_amount_usd;
            } else { // Existing budget is non-USD, convert AI's USD suggestion to budget's native currency
                const { data: rate, error: rateError } = await getExchangeRate(
                    supabase,
                    new Date(), // Use current date for conversion
                    baseReportingCurrency, // Source is USD
                    existingBudget.currency_code // Target is budget's native currency
                );
                if (rateError || rate === null) {
                    errorCount++;
                    toast.error(`Failed to get exchange rate for ${existingBudget.currency_code} to update ${getDisplayCategoryName(rec.category_slug)}. Skipped.`);
                    continue;
                }
                newNativeAmountForUpdate = rec.suggested_amount_usd * rate;
            }

            // Only update if the new native amount differs from existing native amount (considering precision)
            if (Math.abs(existingBudget.amount_limit_native - newNativeAmountForUpdate) > 0.001) {
                const { data, error } = await updateBudget(supabase, existingBudget.id, {
                    amount_limit_native: parseFloat(newNativeAmountForUpdate.toFixed(existingBudget.currency_code === 'JPY' ? 0 : 2)), // Respect decimal places
                    // currency_code is not changed on update
                });
                if (error) { errorCount++; toast.error(`Update failed for ${getDisplayCategoryName(rec.category_slug)}: ${error.message}`); continue; }
                if (data) { savedBudgets.push(data); successCount++; }
            } else {
                 if (existingBudget) savedBudgets.push(existingBudget); // No change needed, count as "processed"
            }
        } else { // Add new budget, AI rec is in USD, so new budget is USD
            const budgetData: BudgetInsert = {
                user_id: userId,
                category: rec.category_slug,
                currency_code: baseReportingCurrency, // New budgets from AI are in USD
                amount_limit_native: rec.suggested_amount_usd,
                period_type: 'monthly',
                period_start_date: periodStartDate,
            };
            const { data, error } = await addBudget(supabase, budgetData);
            if (error) { errorCount++; toast.error(`Add failed for ${getDisplayCategoryName(rec.category_slug)}: ${error.message}`); continue; }
            if (data) { savedBudgets.push(data); successCount++;}
        }
    }

    setIsLoading(false);
    if (errorCount > 0) {
        toast.warning(`${successCount} budgets saved/updated, ${errorCount} failed.`);
    } else if (successCount > 0) {
        toast.success("All applicable budget recommendations applied successfully!");
    } else {
        toast.info("No changes were needed for the budgets based on AI recommendations.");
    }
    onAcceptAndSave(savedBudgets);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold">AI Budget Recommendations</h2>
        <p className="text-muted-foreground">
          Using {recommendationData.aiModelUsed || 'AI model'}. Review and adjust suggested {baseReportingCurrency} amounts as needed. Displayed in {userPreferredCurrency}.
        </p>
         {recommendationData.summary && <p className="text-sm mt-1 italic text-muted-foreground">{recommendationData.summary}</p>}
      </div>

      <Card className={cn(
          "w-full",
          differenceFromIncomeUSD < 0 ? "border-red-500/50 dark:border-red-400/50" : "border-green-500/50 dark:border-green-400/50"
      )}>
        <CardHeader className="pb-2">
          <CardTitle className="text-xl flex items-center justify-between">
            <span>Budget Summary</span>
            {differenceFromIncomeUSD < 0 && <AlertTriangle className="h-6 w-6 text-red-500 dark:text-red-400" />}
          </CardTitle>
          <CardDescription>
            How the recommended budget aligns with your considered income of {formatCurrency(incomeConsideredUSD, baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates)}.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center space-x-3 rounded-md border p-3">
                <div className="p-2 bg-primary/10 rounded-md">
                    <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <p className="text-xs text-muted-foreground">Total Budgeted ({userPreferredCurrency})</p>
                    <p className="text-lg font-semibold">{formatCurrency(totalRecommendedUSD, baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates)}</p>
                </div>
            </div>
            <div className="flex items-center space-x-3 rounded-md border p-3">
                 <div className={cn("p-2 rounded-md",
                    percentageOfIncomeUsed > 100 ? "bg-red-500/10" : (percentageOfIncomeUsed > 85 ? "bg-amber-500/10" : "bg-green-500/10")
                 )}>
                    <Percent className={cn("h-5 w-5",
                        percentageOfIncomeUsed > 100 ? "text-red-500" : (percentageOfIncomeUsed > 85 ? "text-amber-500" : "text-green-500")
                    )} />
                </div>
                <div>
                    <p className="text-xs text-muted-foreground">Percentage of Income Used</p>
                    <p className="text-lg font-semibold">{percentageOfIncomeUsed.toFixed(1)}%</p>
                </div>
            </div>
            <div className="col-span-full mt-1">
                 <p className={cn(
                    "text-sm text-center font-medium p-2 rounded-md",
                    differenceFromIncomeUSD >= 0 ? "bg-green-500/10 text-green-700 dark:text-green-300" : "bg-red-500/10 text-red-700 dark:text-red-300"
                )}>
                {differenceFromIncomeUSD >= 0
                    ? `Potentially remaining: ${formatCurrency(differenceFromIncomeUSD, baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates)}.`
                    : `Budget is ${formatCurrency(Math.abs(differenceFromIncomeUSD), baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates)} OVER considered income.`}
                </p>
            </div>
        </CardContent>
      </Card>


      <ScrollArea className="h-[calc(100vh_-_520px)] min-h-[300px] rounded-md border"> {/* Adjusted height slightly */}
        <Table>
          <TableCaption>Review and modify amounts before accepting. Amounts are suggested in {baseReportingCurrency}, displayed in {userPreferredCurrency}. Click amount to edit ({baseReportingCurrency}).</TableCaption>
          <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
            <TableRow>
              <TableHead className="w-[180px] sm:w-[200px]">Category</TableHead>
              <TableHead>Justification & Notes</TableHead>
              <TableHead className="text-right w-[130px] sm:w-[150px]">Suggested ({userPreferredCurrency})</TableHead>
              <TableHead className="text-center w-[80px] sm:w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recommendations.map((rec) => (
              <TableRow key={rec.category_slug} className={cn(rec.is_fixed_from_user && "bg-primary/5 hover:bg-primary/10")}>
                <TableCell className="font-medium align-top">
                    {getDisplayCategoryName(rec.category_slug)}
                    {rec.is_fixed_from_user && (
                      <InfoWithTooltip
                        title="This was a fixed expense you provided (in USD) and is generally not editable here by the AI."
                        className="h-3 w-3 inline-block ml-1 text-primary"
                      />
                    )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground align-top">
                    {rec.justification}
                </TableCell>
                <TableCell
                  className="text-right align-top tabular-nums cursor-pointer hover:bg-muted/50"
                  onClick={() => !rec.is_fixed_from_user && !editingItemId && handleEdit(rec)}
                >
                  {editingItemId === rec.category_slug ? (
                    <Input
                      type="number"
                      value={editValue} // This is the USD value
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => handleSaveEdit(rec.category_slug)}
                      onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(rec.category_slug);
                          if (e.key === 'Escape') handleCancelEdit();
                      }}
                      className="h-8 text-right"
                      autoFocus
                      step="1"
                      title={`Editing in ${baseReportingCurrency}`}
                    />
                  ) : (
                    formatCurrency(rec.suggested_amount_usd, baseReportingCurrency, userPreferredCurrency, allCurrenciesData, currentExchangeRates)
                  )}
                </TableCell>
                <TableCell className="text-center align-top">
                  {editingItemId === rec.category_slug ? (
                    <div className="flex gap-1 justify-center">
                      <Button variant="ghost" size="icon" onClick={() => handleSaveEdit(rec.category_slug)} className="h-7 w-7 text-green-600 hover:text-green-700">
                        <Save className="h-4 w-4" /><span className="sr-only">Save</span>
                      </Button>
                       <Button variant="ghost" size="icon" onClick={handleCancelEdit} className="h-7 w-7 text-red-600 hover:text-red-700">
                        <XCircle className="h-4 w-4" /><span className="sr-only">Cancel</span>
                      </Button>
                    </div>
                  ) : (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(rec)}
                        className="h-7 w-7"
                        disabled={isLoading || rec.is_fixed_from_user || !!editingItemId}
                        title={rec.is_fixed_from_user ? "Fixed by user" : (!!editingItemId ? "Finish current edit first" : `Edit amount (in ${baseReportingCurrency})`)}
                    >
                      <Edit3 className="h-4 w-4" />
                      <span className="sr-only">Edit</span>
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>

      <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
        <Button variant="outline" onClick={onDiscard} disabled={isLoading} className="w-full sm:w-auto">
          <XCircle className="mr-2 h-4 w-4" /> Discard Suggestions
        </Button>
        <Button onClick={handleAcceptAll} disabled={isLoading || recommendations.length === 0} className="min-w-[180px] w-full sm:w-auto">
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="mr-2 h-4 w-4" />
          )}
          Accept & Save Budgets
        </Button>
      </div>
    </div>
  );
}