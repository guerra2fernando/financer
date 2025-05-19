// src/app/(app)/income/page.tsx
import { getIncomesByUserId } from '@/services/incomeService';
import { createServerClientWrapper } from '@/lib/supabase/server'; // Correct: Server client
import { redirect } from 'next/navigation';
import IncomePageClientContent from '@/components/income/IncomePageClientContent';

export const dynamic = 'force-dynamic';

export default async function IncomePage() {
  const supabase = await createServerClientWrapper(); // Correct: Use server client wrapper
  const {
    data: { user },
    error: getUserError,
  } = await supabase.auth.getUser();

  if (getUserError) {
    console.error("IncomePage: Error fetching user:", getUserError.message);
    redirect('/auth/login');
    return;
  }

  if (!user) {
    redirect('/auth/login');
    return;
  }

  // Pass supabase client instance
  const { data: initialIncomes, error } = await getIncomesByUserId(supabase, user.id);

  if (error) {
    console.error("Error fetching initial incomes on server:", error.message);
    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <h1 className="text-2xl font-semibold mb-4">Income</h1>
            <p className="text-destructive">Could not load income data. Please try again later.</p>
            {process.env.NODE_ENV === 'development' && <pre className="mt-2 text-xs bg-red-100 p-2 rounded">{error.message}</pre>}
        </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <IncomePageClientContent
        initialIncomes={initialIncomes || []}
        userId={user.id}
      />
    </div>
  );
}