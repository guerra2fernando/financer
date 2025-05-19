// src/app/(app)/goals/page.tsx
import { getFinancialGoalsByUserId } from '@/services/financialGoalService';
import { createServerClientWrapper } from '@/lib/supabase/server'; // Correct: Server client
import { redirect } from 'next/navigation';
import GoalPageClientContent from '@/components/goals/GoalPageClientContent';

export const dynamic = 'force-dynamic';

export default async function FinancialGoalsPage() {
  const supabase = await createServerClientWrapper(); // Correct: Use server client wrapper
  const {
    data: { user },
    error: getUserError,
  } = await supabase.auth.getUser();

  if (getUserError) {
    console.error("FinancialGoalsPage: Error fetching user:", getUserError.message);
    redirect('/auth/login');
    return;
  }

  if (!user) {
    redirect('/auth/login');
    return;
  }

  // Pass supabase client instance
  const { data: initialGoals, error } = await getFinancialGoalsByUserId(supabase, user.id);

  if (error) {
    console.error("Error fetching initial financial goals on server:", error.message);
    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <h1 className="text-2xl font-semibold mb-4">Financial Goals</h1>
            <p className="text-destructive">Could not load financial goals. Please try again later.</p>
            {process.env.NODE_ENV === 'development' && <pre className="mt-2 text-xs bg-red-100 p-2 rounded">{error.message}</pre>}
        </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <GoalPageClientContent
        initialGoals={initialGoals || []}
        userId={user.id}
      />
    </div>
  );
}