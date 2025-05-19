/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// src/app/api/ai/budget-recommendation/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWrapper } from '@/lib/supabase/server';
import {
  AIBudgetRecommendationClientRequest,
  AIBudgetPromptData,
  AIHistoricalDataSummary,
  Profile,
  Income,
  Expense,
  AIBudgetRecommendationResponse,
  AIBudgetErrorResponse
} from '@/types';
import { getIncomesByUserId } from '@/services/incomeService';
import { getExpensesByUserId } from '@/services/expenseService';
import { getCurrentUserProfile } from '@/services/userService';
import { getExchangeRate } from '@/services/currencyService'; // For server-side RPC call to get_exchange_rate
import { constructBudgetPrompt } from '@/lib/ai/promptUtils';
import { getBudgetRecommendations } from '@/lib/ai/llmService';
import { DEFAULT_BUDGET_CATEGORIES, DEFAULT_CURRENCY, BASE_REPORTING_CURRENCY, ExpenseCategorySlug, CurrencyCode } from '@/lib/constants';
import { subMonths, format, startOfMonth, endOfMonth } from 'date-fns';

export async function POST(request: NextRequest) {
  const supabase = await createServerClientWrapper(); // Await the wrapper
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' } as AIBudgetErrorResponse, { status: 401 });
  }

  let requestBody: AIBudgetRecommendationClientRequest;
  try {
    requestBody = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON body' } as AIBudgetErrorResponse, { status: 400 });
  }

  const { wizardData, useHistoricalData, customInstructions } = requestBody;

  if (!wizardData?.monthlyIncomeUSD && !useHistoricalData) {
    return NextResponse.json({ error: 'Monthly income or historical data usage is required.' } as AIBudgetErrorResponse, { status: 400 });
  }
  if (wizardData?.monthlyIncomeUSD && wizardData.monthlyIncomeUSD <= 0 && !useHistoricalData) {
    return NextResponse.json({ error: 'Monthly income must be a positive number if not solely relying on historical data.' } as AIBudgetErrorResponse, { status: 400 });
  }

  let profile: Profile | null = null;
  const historicalSummary: AIHistoricalDataSummary = {};
  const fixedExpensesUSD: AIBudgetPromptData['fixedExpensesUSD'] = [];

  // --- Data Aggregation ---
  try {
    const profileResult = await getCurrentUserProfile(supabase, user.id);
    if (profileResult.error && profileResult.error.code !== 'PGRST116') {
        console.warn(`Failed to fetch profile, proceeding without: ${profileResult.error.message}`);
    }
    profile = profileResult.data;

    // Convert wizardData.fixedExpenses to USD
    if (wizardData?.fixedExpenses && wizardData.fixedExpenses.length > 0) {
        for (const fe of wizardData.fixedExpenses) {
            if (fe.category && fe.amount > 0 && fe.currency_code) {
                let amountUSD = fe.amount;
                if (fe.currency_code !== BASE_REPORTING_CURRENCY) {
                    // Call get_exchange_rate RPC
                    const { data: rate, error: rateError } = await supabase.rpc('get_exchange_rate', {
                        p_date: new Date().toISOString().split('T')[0], // Use current date for conversion
                        p_source_currency_code: fe.currency_code,
                        p_target_currency_code: BASE_REPORTING_CURRENCY
                    });

                    if (rateError || rate === null) {
                        console.warn(`Could not get exchange rate for ${fe.currency_code} to USD for fixed expense ${fe.category}. Skipping this fixed expense.`);
                        continue; // Skip this fixed expense if rate not found
                    }
                    amountUSD = fe.amount * (typeof rate === 'string' ? parseFloat(rate) : rate);
                }
                fixedExpensesUSD.push({
                    category: fe.category,
                    amountUSD: parseFloat(amountUSD.toFixed(2)),
                    description: fe.description
                });
            }
        }
    }


    if (useHistoricalData || (!wizardData?.monthlyIncomeUSD || wizardData.monthlyIncomeUSD <=0)) {
      const N_MONTHS_HISTORY = 3;
      const historyEndDate = endOfMonth(subMonths(new Date(), 1)); 
      const historyStartDate = startOfMonth(subMonths(historyEndDate, N_MONTHS_HISTORY -1));
      const dateRange = { from: format(historyStartDate, 'yyyy-MM-dd'), to: format(historyEndDate, 'yyyy-MM-dd') };
      console.log(`Fetching historical data for range: ${dateRange.from} to ${dateRange.to}`);

      const incomesResult = await getIncomesByUserId(supabase, user.id, dateRange);
      if (incomesResult.error) {
        console.warn(`Could not fetch historical income, proceeding: ${incomesResult.error.message}`);
      } else {
        const incomes: Income[] = incomesResult.data || [];
        if (incomes.length > 0) {
          // Use amount_reporting_currency which is already in USD
          const totalIncome = incomes.reduce((sum, inc) => sum + inc.amount_reporting_currency, 0);
          historicalSummary.averageMonthlyIncomeUSD = parseFloat((totalIncome / N_MONTHS_HISTORY).toFixed(2));
          console.log(`Historical average monthly income: $${historicalSummary.averageMonthlyIncomeUSD}`);
        } else {
            console.log("No historical income records found in the last 3 months.");
        }
      }
      if ((!wizardData?.monthlyIncomeUSD || wizardData.monthlyIncomeUSD <= 0) && !historicalSummary.averageMonthlyIncomeUSD) {
        return NextResponse.json({ error: 'No income data available. Please provide current monthly income or ensure historical income records exist.' } as AIBudgetErrorResponse, { status: 400 });
      }

      const expensesResult = await getExpensesByUserId(supabase, user.id, dateRange);
      if (expensesResult.error) {
         console.warn(`Could not fetch historical expenses, proceeding: ${expensesResult.error.message}`);
      } else {
        const expenses: Expense[] = expensesResult.data || [];
        if (expenses.length > 0) {
          const expensesByCategory: { [key in ExpenseCategorySlug]?: number } = {};
          expenses.forEach(exp => {
            if (DEFAULT_BUDGET_CATEGORIES.includes(exp.category as ExpenseCategorySlug)) {
              // Use amount_reporting_currency which is already in USD
              expensesByCategory[exp.category as ExpenseCategorySlug] = (expensesByCategory[exp.category as ExpenseCategorySlug] || 0) + exp.amount_reporting_currency;
            }
          });
          historicalSummary.averageMonthlyExpensesByCategoryUSD = Object.entries(expensesByCategory)
            .map(([cat, total]) => ({
              category: cat as ExpenseCategorySlug,
              averageAmountUSD: parseFloat(((total || 0) / N_MONTHS_HISTORY).toFixed(2)),
            }));
          console.log("Historical average monthly expenses by category calculated.");
        } else {
            console.log("No historical expense records found in the last 3 months.");
        }
      }
    }
  } catch (error: any) { 
    console.error("Unexpected error during data aggregation:", error);
    return NextResponse.json({ error: 'Failed to aggregate user data.', details: error.message } as AIBudgetErrorResponse, { status: 500 });
  }

  const effectiveMonthlyIncome = wizardData?.monthlyIncomeUSD && wizardData.monthlyIncomeUSD > 0
    ? wizardData.monthlyIncomeUSD
    : historicalSummary.averageMonthlyIncomeUSD || 0;

  if (effectiveMonthlyIncome <= 0) {
    return NextResponse.json({ error: 'Effective monthly income is zero or negative. Cannot generate budget.' } as AIBudgetErrorResponse, { status: 400 });
  }

  const promptData: AIBudgetPromptData = {
    userId: user.id,
    monthlyIncomeUSD: effectiveMonthlyIncome,
    locationCity: wizardData?.locationCity || profile?.location_city || undefined,
    locationCountry: wizardData?.locationCountry || profile?.location_country || undefined,
    fixedExpensesUSD: fixedExpensesUSD.length > 0 ? fixedExpensesUSD : undefined, // Pass converted fixed expenses
    primaryFinancialGoal: wizardData?.primaryFinancialGoal || undefined,
    householdSize: wizardData?.householdSize || profile?.household_size || 1,
    averageMonthlyIncomeUSD: historicalSummary.averageMonthlyIncomeUSD,
    averageMonthlyExpensesByCategoryUSD: historicalSummary.averageMonthlyExpensesByCategoryUSD,
    activeFinancialGoalsUSD: historicalSummary.activeFinancialGoalsUSD,
    userPreferredCurrency: profile?.preferred_currency || DEFAULT_CURRENCY,
    availableCategories: DEFAULT_BUDGET_CATEGORIES,
    customInstructions: customInstructions,
  };

  console.log("Constructing LLM prompt with data:", {
      income: promptData.monthlyIncomeUSD,
      fixedExpensesCount: promptData.fixedExpensesUSD?.length || 0,
      location: `${promptData.locationCity}, ${promptData.locationCountry}`,
      historicalIncome: promptData.averageMonthlyIncomeUSD,
  });

  const llmPrompt = constructBudgetPrompt(promptData);
  const llmServiceResponse = await getBudgetRecommendations(llmPrompt);

  if (llmServiceResponse.error || !llmServiceResponse.recommendations || llmServiceResponse.recommendations.length === 0) {
    console.error(`LLM service failed. Source: ${llmServiceResponse.source}, Model: ${llmServiceResponse.modelUsed}, Error: ${llmServiceResponse.error}`);
    return NextResponse.json({
        error: 'Failed to get recommendations from AI.',
        details: llmServiceResponse.error || "AI returned no valid recommendations.",
        source: llmServiceResponse.source,
        model: llmServiceResponse.modelUsed,
    } as AIBudgetErrorResponse & { source?: string; model?: string }, { status: 502 });
  }

  const totalBudgeted = llmServiceResponse.recommendations.reduce((sum, rec) => sum + rec.suggested_amount_usd, 0);

  const responsePayload: AIBudgetRecommendationResponse = {
    recommendations: llmServiceResponse.recommendations,
    summary: `AI-generated budget plan using ${llmServiceResponse.source} (${llmServiceResponse.modelUsed}). Review and adjust as needed.`,
    totalBudgetedAmountUSD: parseFloat(totalBudgeted.toFixed(2)),
    totalIncomeConsideredUSD: promptData.monthlyIncomeUSD,
    aiModelUsed: `${llmServiceResponse.source} - ${llmServiceResponse.modelUsed}`,
  };

  console.log(`Successfully generated budget. Total budgeted: $${responsePayload.totalBudgetedAmountUSD} from income $${responsePayload.totalIncomeConsideredUSD}`);
  return NextResponse.json(responsePayload, { status: 200 });
}