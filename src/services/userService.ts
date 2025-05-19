// src/services/userService.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import { Profile, ProfileUpdatePayload } from '@/types'; // Added CurrencyCode

const PROFILE_SELECT_QUERY = `
  id,
  email,
  full_name,
  avatar_url,
  preferred_currency,
  role,
  is_active,
  status,
  created_at,
  updated_at,
  location_city,
  location_country,
  household_size
`;
// The 'email' field is often not directly part of the 'profiles' table but joined from 'auth.users'.
// If 'email' is indeed in your 'profiles' table, this is fine. Otherwise, adjust select query.
// For now, assuming 'email' is part of the 'profiles' table as per your types.


export async function getCurrentUserProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<{ data: Profile | null; error: PostgrestError | null }> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_SELECT_QUERY)
      .eq('id', userId)
      .single(); // Use single as a profile should exist for a logged-in user ID

    if (error && error.code !== 'PGRST116') { // PGRST116: 0 rows found (not an error for single() when no row)
      console.error('Error fetching user profile (profileService):', error.message);
    }
    return { data, error: error?.code === 'PGRST116' ? null : error };
  } catch (e: any) {
    console.error('Unexpected error fetching profile (profileService):', e.message);
    return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}

export async function updateUserProfile(
  supabase: SupabaseClient,
  userId: string,
  updates: ProfileUpdatePayload // ProfileUpdatePayload type already includes preferred_currency
): Promise<{ data: Profile | null; error: PostgrestError | null }> {
  try {
    const validUpdates: Partial<ProfileUpdatePayload> = {};
    let hasActualUpdates = false;

    // Validate and build the update payload (copied from your provided code, seems fine)
    for (const keyStr in updates) {
      if (Object.prototype.hasOwnProperty.call(updates, keyStr)) {
        const key = keyStr as keyof ProfileUpdatePayload;
        const value = updates[key];
        if (value !== undefined) {
          (validUpdates as any)[key] = value;
          hasActualUpdates = true;
        }
      }
    }

    if (!hasActualUpdates) {
      console.warn("updateUserProfile called with no valid update fields. Returning current profile.");
      // To avoid an unnecessary update call, fetch and return current profile if no actual updates.
      return getCurrentUserProfile(supabase, userId);
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(validUpdates)
      .eq('id', userId)
      .select(PROFILE_SELECT_QUERY)
      .single();

    if (error) {
      console.error('Error updating user profile (profileService):', error.message, 'Payload:', validUpdates);
    }
    return { data, error };
  } catch (e: any) {
    console.error('Unexpected error updating profile (profileService):', e.message);
    return { data: null, error: { message: e.message, details: '', hint: '', code: 'SERVICE_ERROR' } as PostgrestError };
  }
}