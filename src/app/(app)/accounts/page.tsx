// src/app/(app)/accounts/page.tsx
import { getAccountsByUserId } from '@/services/accountService';
import { createServerClientWrapper } from '@/lib/supabase/server'; // Correct server client
import { redirect } from 'next/navigation';
import AccountPageClientContent from '@/components/accounts/AccountPageClientContent';

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  const supabase = await createServerClientWrapper(); // Use the server client wrapper
  const {
    data: { user },
    error: getUserError, // Always good to check for errors when getting user
  } = await supabase.auth.getUser();

  if (getUserError) {
    console.error("AccountsPage: Error getting user:", getUserError.message);
    redirect('/auth/login'); // Or handle error appropriately
    return;
  }

  if (!user) {
    redirect('/auth/login');
    return;
  }

  // Pass the supabase client instance to the service function
  const { data: initialAccounts, error } = await getAccountsByUserId(supabase, user.id);

  if (error) {
    console.error("Error fetching initial accounts on server:", error.message);
    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <h1 className="text-2xl font-semibold mb-4">My Accounts</h1>
            <p className="text-destructive">Could not load accounts data. Please try again later.</p>
            {process.env.NODE_ENV === 'development' && <pre className="mt-2 text-xs bg-red-100 p-2 rounded">{error.message}</pre>}
        </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <AccountPageClientContent
        initialAccounts={initialAccounts || []}
        userId={user.id}
      />
    </div>
  );
}