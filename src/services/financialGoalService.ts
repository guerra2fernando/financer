// src/services/financialGoalService.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import {
  FinancialGoal,
  GoalContribution, // Keep original name for clarity
  // CurrencyCode // CurrencyCode comes from constants
} from '@/types';

const FINANCIAL_GOAL_SELECT_QUERY = `
  id,
  user_id,
  name,
  currency_code,
  target_amount_native,
  target_amount_reporting_currency,
  current_amount_saved_native,
  current_amount_saved_reporting_currency,
  target_date,
  monthly_contribution_target_native,
  monthly_contribution_target_reporting_currency,
  status,
  description,
  created_at,
  updated_at
`;

const GOAL_CONTRIBUTION_SELECT_QUERY = `
  id,
  user_id,
  goal_id,
  account_id,
  amount_native,
  currency_code,
  amount_reporting_currency,
  date,
  notes,
  created_at,
  accounts (id, name, native_currency_code)
`;

// --- FinancialGoal Functions ---

export async function getFinancialGoalsByUserId(
  supabase: SupabaseClient,
  userId: string
): Promise<{ data: FinancialGoal[] | null; error: PostgrestError | null }> {
  try {
    const { data, error } = await supabase
      .from('financial_goals')
      .select(FINANCIAL_GOAL_SELECT_QUERY)
      .eq('user_id', userId)
      .order('target_date', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching financial goals (financialGoalService):', error.message);
    }
    return { data, error };
  } catch (e: any) {
    console.error('Unexpected error fetching financial goals (financialGoalService):', e.message);
    return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

export async function getFinancialGoalById(
  supabase: SupabaseClient,
  goalId: string
): Promise<{ data: FinancialGoal | null; error: PostgrestError | null }> {
  try {
    const { data, error } = await supabase
      .from('financial_goals')
      .select(FINANCIAL_GOAL_SELECT_QUERY)
      .eq('id', goalId)
      .single();

    if (error) {
      console.error(`Error fetching financial goal ${goalId} (financialGoalService):`, error.message);
    }
    return { data, error };
  } catch (e: any) {
    console.error(`Unexpected error fetching financial goal ${goalId} (financialGoalService):`, e.message);
    return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

// FinancialGoalInsert type expects native amounts and currency_code.
// Reporting amounts are handled by DB trigger. current_amount_saved_native starts at 0.
export type FinancialGoalInsert = Omit<FinancialGoal,
  'id' | 'created_at' | 'updated_at' |
  'target_amount_reporting_currency' |
  'current_amount_saved_native' | // Will be 0 on insert
  'current_amount_saved_reporting_currency' | // Will be 0 on insert
  'monthly_contribution_target_reporting_currency'
>;

export async function addFinancialGoal(
  supabase: SupabaseClient,
  goalData: FinancialGoalInsert // Use the refined FinancialGoalInsert type
): Promise<{ data: FinancialGoal | null; error: PostgrestError | null }> {
  try {
    const payload: FinancialGoalInsert & { current_amount_saved_native: number } = { // Explicitly add current_amount_saved_native
      user_id: goalData.user_id,
      name: goalData.name,
      currency_code: goalData.currency_code,
      target_amount_native: goalData.target_amount_native,
      current_amount_saved_native: 0, // New goals start with 0 saved
      status: goalData.status || 'active', // Default status
      target_date: goalData.target_date || null,
      monthly_contribution_target_native: goalData.monthly_contribution_target_native || null,
      description: goalData.description || null,
    };
    // DB trigger `trg_financial_goals_calc_reporting_currency` handles reporting_currency for target & monthly_contrib.
    // current_amount_saved_reporting_currency will also be 0 initially.

    const { data, error } = await supabase
      .from('financial_goals')
      .insert(payload)
      .select(FINANCIAL_GOAL_SELECT_QUERY)
      .single();

    if (error) {
      console.error('Error adding financial goal (financialGoalService):', error.message, 'Payload:', payload);
    }
    return { data, error };
  } catch (e: any) {
    console.error('Unexpected error adding financial goal (financialGoalService):', e.message);
    return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

// FinancialGoalUpdate: currency_code and target_amount_native typically don't change often, but can.
// current_amount_saved_native is updated by contributions.
export type FinancialGoalUpdate = Partial<Omit<FinancialGoalInsert, 'user_id' | 'currency_code'>>; // currency_code of goal fixed?

export async function updateFinancialGoal(
  supabase: SupabaseClient,
  goalId: string,
  updates: FinancialGoalUpdate // Use refined FinancialGoalUpdate type
): Promise<{ data: FinancialGoal | null; error: PostgrestError | null }> {
  try {
    // The FinancialGoalUpdate type should allow updating relevant fields.
    // If target_amount_native or monthly_contribution_target_native are updated,
    // the DB trigger will recalculate their _reporting_currency counterparts.
    // current_amount_saved fields are not updated here.
    const { data, error } = await supabase
      .from('financial_goals')
      .update(updates)
      .eq('id', goalId)
      .select(FINANCIAL_GOAL_SELECT_QUERY)
      .single();

    if (error) {
      console.error(`Error updating financial goal ${goalId} (financialGoalService):`, error.message, 'Payload:', updates);
    }
    return { data, error };
  } catch (e: any) {
    console.error(`Unexpected error updating financial goal ${goalId} (financialGoalService):`, e.message);
    return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

export async function deleteFinancialGoal(
  supabase: SupabaseClient,
  goalId: string
): Promise<{ error: PostgrestError | null }> {
  try {
    // Delete linked contributions first. This is important for data integrity.
    // Alternatively, use ON DELETE CASCADE on the foreign key in goal_contributions table.
    const { error: contribError } = await supabase
        .from('goal_contributions')
        .delete()
        .eq('goal_id', goalId);

    if (contribError) {
      // Log warning but proceed to delete goal if that's desired behavior.
      console.warn(`Could not delete contributions for goal ${goalId} (financialGoalService): ${contribError.message}. Attempting to delete goal anyway.`);
    }

    const { error } = await supabase
      .from('financial_goals')
      .delete()
      .eq('id', goalId);

    if (error) {
      console.error(`Error deleting financial goal ${goalId} (financialGoalService):`, error.message);
    }
    return { error };
  } catch (e: any) {
    console.error(`Unexpected error deleting financial goal ${goalId} (financialGoalService):`, e.message);
    return {  error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

// --- GoalContribution Functions ---

export async function getGoalContributions(
  supabase: SupabaseClient,
  goalId: string,
  userId: string // Retain for RLS/authorization checks if needed beyond just goalId
): Promise<{ data: GoalContribution[] | null; error: PostgrestError | null }> {
  try {
    const { data, error } = await supabase
      .from('goal_contributions')
      .select(GOAL_CONTRIBUTION_SELECT_QUERY)
      .eq('goal_id', goalId)
      .eq('user_id', userId) // Good for ensuring user owns the goal indirectly
      .order('date', { ascending: false });

    if (error) {
      console.error(`Error fetching contributions for goal ${goalId} (financialGoalService):`, error.message);
    }
    return { data, error };
  } catch (e: any) {
    console.error(`Unexpected error fetching contributions for goal ${goalId} (financialGoalService):`, e.message);
    return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

// GoalContributionInsert expects amount_native and currency_code.
// amount_reporting_currency is handled by DB trigger.
export type GoalContributionInsert = Omit<GoalContribution, 'id' | 'created_at' | 'accounts' | 'amount_reporting_currency'>;

export async function addGoalContribution(
  supabase: SupabaseClient,
  contributionData: GoalContributionInsert // Use refined GoalContributionInsert
): Promise<{ data: GoalContribution | null; error: PostgrestError | null }> {
  try {
    // The GoalContributionInsert type should define the correct shape.
    const payload: GoalContributionInsert = {
        user_id: contributionData.user_id,
        goal_id: contributionData.goal_id,
        account_id: contributionData.account_id || null,
        amount_native: contributionData.amount_native,
        currency_code: contributionData.currency_code,
        date: contributionData.date,
        notes: contributionData.notes || null,
    };
    // DB trigger `trg_goal_contributions_calc_reporting_currency` calculates amount_reporting_currency.
    // DB trigger `update_goal_progress_after_contribution` updates the parent financial_goal.

    const { data, error } = await supabase
      .from('goal_contributions')
      .insert(payload)
      .select(GOAL_CONTRIBUTION_SELECT_QUERY)
      .single();
    
    if (error) {
        console.error('Error adding goal contribution (financialGoalService):', error.message, 'Payload:', payload);
    }
    return { data, error };
  } catch (e: any) {
    console.error('Unexpected error adding goal contribution (financialGoalService):', e.message);
    return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

// GoalContributionUpdate: currency_code usually fixed. amount_native can change.
export type GoalContributionUpdate = Partial<Omit<GoalContributionInsert, 'user_id' | 'goal_id' | 'currency_code'>>;


export async function updateGoalContribution(
  supabase: SupabaseClient,
  contributionId: string,
  updates: GoalContributionUpdate // Use refined type
): Promise<{ data: GoalContribution | null; error: PostgrestError | null }> {
    try {
        const { data, error } = await supabase
            .from('goal_contributions')
            .update(updates)
            .eq('id', contributionId)
            .select(GOAL_CONTRIBUTION_SELECT_QUERY)
            .single();

        if (error) {
            console.error(`Error updating goal contribution ${contributionId} (financialGoalService):`, error.message, 'Payload:', updates);
        }
        return { data, error };
    } catch (e: any) {
        console.error(`Unexpected error updating goal contribution ${contributionId} (financialGoalService):`, e.message);
        return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
    }
}

export async function deleteGoalContribution(
  supabase: SupabaseClient,
  contributionId: string
): Promise<{ error: PostgrestError | null }> {
    try {
        // DB trigger `update_goal_progress_after_contribution` will handle decrementing parent goal's saved amounts.
        const { error } = await supabase
            .from('goal_contributions')
            .delete()
            .eq('id', contributionId);

        if (error) {
            console.error(`Error deleting goal contribution ${contributionId} (financialGoalService):`, error.message);
        }
        return { error };
    } catch (e: any) {
        console.error(`Unexpected error deleting goal contribution ${contributionId} (financialGoalService):`, e.message);
        return {  error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
    }
}