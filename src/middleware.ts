/* eslint-disable @typescript-eslint/no-unused-vars */
// src/middleware.ts 
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  console.log(`[Middleware] Path: ${request.nextUrl.pathname}, Search: ${request.nextUrl.search}`);
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // No need to modify request cookies as they're read-only
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          // No need to modify request cookies as they're read-only
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.delete(name);
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  console.log(`[Middleware] Session: ${session ? session.user.email : 'null'}`);

  const { pathname } = request.nextUrl;

  if (!session && pathname.startsWith('/dashboard')) {
    console.log('[Middleware] No session, on /dashboard. Redirecting to /auth/login');
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  if (session && (pathname.startsWith('/auth/login') || pathname.startsWith('/auth/signup'))) {
    console.log('[Middleware] Session exists, on auth page. Redirecting to /dashboard');
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  console.log('[Middleware] Passing through.');
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
};