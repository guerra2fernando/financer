// src/lib/supabase/server.ts


import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';

export async function createServerClientWrapper() {
  const cookieStore = await cookies(); // ✅ Await here
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch (err) {
          console.warn('Tried to set cookie from non-Route Handler context.', err);
        }
      },
      remove(name: string) {
        try {
          cookieStore.delete(name);
        } catch (err) {
          console.warn('Tried to remove cookie from non-Route Handler context.', err);
        }
      },
    },
  });
}
