/* eslint-disable @typescript-eslint/no-unused-vars */
// src/app/(app)/settings/page.tsx
import { createServerClientWrapper } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import SettingsPageClientContent from '@/components/settings/SettingsPageClientContent';
import { getCurrentUserProfile } from '@/services/userService'; // Corrected service import
import { getCurrencies } from '@/services/currencyService'; // For fetching all currencies
import type { SupabaseAuthUser, Profile, Currency } from '@/types';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createServerClientWrapper();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) {
    console.error("Auth error on settings page or no user:", authError?.message);
    redirect('/auth/login');
    return;
  }

  // Fetch profile and all active currencies in parallel
  const [profileResult, currenciesResult] = await Promise.all([
    getCurrentUserProfile(supabase, authUser.id),
    getCurrencies(supabase, true), // true to fetch only active currencies
  ]);

  const { data: userProfile, error: profileError } = profileResult;
  const { data: allCurrencies, error: currenciesError } = currenciesResult;

  if (profileError && profileError.code !== 'PGRST116') {
    console.error("Error fetching user profile on server:", profileError.message);
    // Handle as before, pass null and let client handle
  }

  if (currenciesError) {
    console.error("Error fetching currencies on server:", currenciesError.message);
    // Non-critical for profile update, but dropdown will be empty.
    // Pass empty array or null.
  }
  
  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 max-w-3xl">
      <SettingsPageClientContent
        userAuth={authUser as SupabaseAuthUser}
        initialUserProfile={userProfile as Profile | null}
        allCurrencies={allCurrencies || []} // Pass fetched currencies, or empty array if error/null
      />
    </div>
  );
}