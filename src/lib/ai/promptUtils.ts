/* eslint-disable @typescript-eslint/no-unused-vars */
// src/lib/ai/promptUtils.ts
import { AIBudgetPromptData, AISuggestedBudgetCategory } from '@/types';
import { DEFAULT_BUDGET_CATEGORIES, getDisplayCategoryName, ExpenseCategorySlug, BASE_REPORTING_CURRENCY } from '@/lib/constants'; // Added CurrencyCode, BASE_REPORTING_CURRENCY

export function constructBudgetPrompt(data: AIBudgetPromptData): string {
  const {
    userId, // Added as per AIBudgetPromptData type
    monthlyIncomeUSD, // This is already specified as USD in AIBudgetPromptData
    locationCity,
    locationCountry,
    fixedExpensesUSD, // This is already specified as USD list in AIBudgetPromptData
    primaryFinancialGoal,
    householdSize,
    averageMonthlyIncomeUSD, // USD
    averageMonthlyExpensesByCategoryUSD, // USD
    activeFinancialGoalsUSD, // USD
    userPreferredCurrency, // For context, but AI works in USD
    availableCategories,
    customInstructions,
  } = data;

  // Validate that AIBudgetPromptData provides USD values as expected by the prompt.
  // If wizardData (client-side) captures native amounts, conversion to USD must happen before calling this.

  let prompt = `You are an expert AI financial advisor. Your primary task is to create a personalized and actionable monthly budget plan for a user.
The user's preferred display currency is ${userPreferredCurrency}, but all financial figures used in this prompt and required in your JSON response MUST be in USD (${BASE_REPORTING_CURRENCY}).

User Information:
- Net Monthly Income (after tax): $${monthlyIncomeUSD.toFixed(2)} USD.`;

  if (averageMonthlyIncomeUSD && averageMonthlyIncomeUSD !== monthlyIncomeUSD) {
    prompt += `
- Historical Average Monthly Income (for context and trend analysis): $${averageMonthlyIncomeUSD.toFixed(2)} USD.`;
  }

  if (locationCity && locationCountry) {
    prompt += `
- Location: ${locationCity}, ${locationCountry}. Consider the general cost of living for this specific area if known, otherwise the country's general cost of living.`;
  } else if (locationCountry) {
    prompt += `
- Location: ${locationCountry}. Consider the general cost of living for this country.`;
  }

  if (householdSize && householdSize > 0) {
    prompt += `
- Household Size: ${householdSize} person(s). Adjust allocations accordingly (e.g., for food, utilities).`;
  }

  if (primaryFinancialGoal) {
    prompt += `
- Primary Financial Goal for this budget cycle: "${primaryFinancialGoal}". This is a key priority. Allocate funds towards this goal, possibly within 'savings_and_investments' or by reducing other discretionary spending.`;
  }

  if (activeFinancialGoalsUSD && activeFinancialGoalsUSD.length > 0) {
    prompt += `
Active Financial Goals (longer-term, amounts in USD):`;
    activeFinancialGoalsUSD.forEach(goal => {
      prompt += `
  - Goal Name: ${goal.name}, Target Amount: $${goal.targetAmountUSD.toFixed(2)} USD`;
      if (goal.monthlyContributionTargetUSD) {
        prompt += `, Desired Monthly Contribution: $${goal.monthlyContributionTargetUSD.toFixed(2)} USD (Consider this when allocating to 'savings_and_investments').`;
      }
    });
  }

  prompt += `

Budget Categories and Allocation:
You MUST use ONLY the following category slugs for your budget recommendations. Do not introduce new categories.
The complete list of available category slugs is:
${availableCategories.map(slug => `- "${slug}" (Represents: ${getDisplayCategoryName(slug as ExpenseCategorySlug)})`).join('\n')}

User-Defined Fixed Expenses (Mandatory Allocations, amounts in USD):`;
  if (fixedExpensesUSD && fixedExpensesUSD.length > 0) {
    fixedExpensesUSD.forEach(expense => {
      prompt += `
- Category Slug: "${expense.category}", Amount: $${expense.amountUSD.toFixed(2)} USD${expense.description ? `, Description: ${expense.description}` : ''}`;
    });
  } else {
    prompt += `
- No specific fixed expenses were itemized by the user for pre-allocation. Base all allocations on typical needs and goals.`;
  }

  prompt += `

Historical Spending Patterns (Average Monthly, amounts in USD, if available):`;
  if (averageMonthlyExpensesByCategoryUSD && averageMonthlyExpensesByCategoryUSD.length > 0) {
    averageMonthlyExpensesByCategoryUSD.forEach(expense => {
      prompt += `
- Category Slug: "${expense.category}", Average Historically Spent: $${expense.averageAmountUSD.toFixed(2)} USD`;
    });
  } else {
    prompt += `
- No detailed historical spending data provided, or this is the user's first budget. Base allocations on typical needs and goals for the provided income and profile.`;
  }

  if (customInstructions) {
    prompt += `

User's Custom Instructions & Priorities (Important):
"${customInstructions}"
Please pay close attention to these custom notes and try to incorporate them into your recommendations and justifications.`;
  }

  prompt += `

Task & Output Format:
Based on ALL the information above, generate a comprehensive monthly budget plan.
For EACH category_slug from the provided list (${availableCategories.length} of them), suggest a monthly spending amount in USD.
Provide a brief, insightful justification for each suggested amount.
If an amount is directly taken from user-defined fixed expenses, clearly state this in the justification and mark 'is_fixed_from_user' as true.

Your response MUST be a single, minified JSON object.
The JSON object must have a root key "recommendations" which is an array of objects.
Each object in the "recommendations" array MUST have the following keys:
1. "category_slug": string (This MUST be one of the exact slugs from the list: ${availableCategories.map(s => `"${s}"`).join(', ')})
2. "suggested_amount_usd": number (The recommended budget amount in USD. Can be 0 if appropriate.)
3. "justification": string (Your brief reasoning for this specific allocation.)
4. "is_fixed_from_user": boolean (true if this amount was taken directly from user-defined fixed expenses, otherwise false.)

Example of a single item in the "recommendations" array:
{ "category_slug": "food_and_drink", "suggested_amount_usd": 450.00, "justification": "Allocated for groceries and occasional dining.", "is_fixed_from_user": false }

IMPORTANT:
- Ensure ALL provided category slugs are present in your "recommendations" array, even if the suggested_amount_usd for some is 0.
- The sum of all "suggested_amount_usd" should ideally be less than or equal to the "Net Monthly Income".
- Provide ONLY the JSON object in your response. No introductory text, no markdown code fences, no explanations outside the JSON structure itself.

Begin JSON response now:
`;

  return prompt;
}

export function parseAIResponse(
    responseText: string,
    source: 'Gemini' | 'OpenAI' // Or other AI model names
): AISuggestedBudgetCategory[] | null {
    try {
        const cleanedResponseText = responseText.trim().replace(/^```json\s*|\s*```$/g, '');
        const parsed = JSON.parse(cleanedResponseText);

        if (parsed && Array.isArray(parsed.recommendations)) {
            const recommendations: AISuggestedBudgetCategory[] = [];
            const aiSlugs = new Set<ExpenseCategorySlug>();

            for (const item of parsed.recommendations) {
                if (
                    typeof item.category_slug === 'string' &&
                    DEFAULT_BUDGET_CATEGORIES.includes(item.category_slug as ExpenseCategorySlug) &&
                    typeof item.suggested_amount_usd === 'number' && item.suggested_amount_usd >= 0 &&
                    typeof item.justification === 'string' &&
                    typeof item.is_fixed_from_user === 'boolean' // Validate new field
                ) {
                    recommendations.push({
                        category_slug: item.category_slug as ExpenseCategorySlug,
                        suggested_amount_usd: parseFloat(item.suggested_amount_usd.toFixed(2)),
                        justification: item.justification.trim(),
                        is_fixed_from_user: item.is_fixed_from_user
                    });
                    aiSlugs.add(item.category_slug as ExpenseCategorySlug);
                } else {
                    console.warn(`(${source}) Invalid item structure or type in AI recommendations:`, item);
                }
            }
            
            // Ensure all default categories are represented, adding any missing ones with $0.
            // This makes UI rendering simpler.
            for (const defaultSlug of DEFAULT_BUDGET_CATEGORIES) {
                if (!aiSlugs.has(defaultSlug)) {
                    recommendations.push({
                        category_slug: defaultSlug,
                        suggested_amount_usd: 0,
                        justification: "No specific recommendation from AI; included for completeness.",
                        is_fixed_from_user: false
                    });
                     console.warn(`(${source}) AI response missing category: ${defaultSlug}. Added with $0.`);
                }
            }


            if (recommendations.length === 0 && parsed.recommendations.length > 0) {
                console.error(`(${source}) All items from AI were invalid after parsing. Original items:`, parsed.recommendations);
                return null;
            }
            
            // Sort recommendations by the order in DEFAULT_BUDGET_CATEGORIES for consistent display
            recommendations.sort((a, b) => 
                DEFAULT_BUDGET_CATEGORIES.indexOf(a.category_slug) - DEFAULT_BUDGET_CATEGORIES.indexOf(b.category_slug)
            );

            return recommendations;
        }
        console.error(`(${source}) AI response is not in the expected format (missing 'recommendations' array or not an array):`, parsed);
        return null;
    } catch (error) {
        console.error(`(${source}) Error parsing AI JSON response:`, error);
        console.error(`(${source}) Raw AI Response causing parsing error:`, responseText);
        return null;
    }
}