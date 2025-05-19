// src/app/(app)/layout.tsx
import React from 'react';
// CORRECT IMPORT: Use your server-side client wrapper
import { createServerClientWrapper } from '@/lib/supabase/server'; 
import { redirect } from 'next/navigation';
import SidebarNav from '@/components/layout/SidebarNav';
import TopBar from '@/components/layout/TopBar';
import { Toaster } from "@/components/ui/sonner";

// It's good practice to make layouts dynamic if they perform auth checks
// or fetch data that should be fresh per request.
export const dynamic = 'force-dynamic'; 

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  console.log(`[AppLayout ${new Date().toISOString()}] Layout rendering...`);
  // Use the server-side Supabase client
  const supabase = await createServerClientWrapper(); 
  
  console.log(`[AppLayout ${new Date().toISOString()}] Attempting to get user in layout...`);
  const {
    data: { user },
    error: getUserError, // Also good to check for errors
  } = await supabase.auth.getUser();

  if (getUserError) {
    console.error(`[AppLayout ${new Date().toISOString()}] Error getting user in layout:`, getUserError.message);
    // Depending on the error, you might still redirect or show an error page
    redirect('/auth/login'); 
    return null; // Ensure no further rendering after redirect
  }

  if (!user) {
    console.log(`[AppLayout ${new Date().toISOString()}] No user found in layout. Redirecting to /auth/login.`);
    redirect('/auth/login');
    return null; // Ensure no further rendering after redirect
  }

  console.log(`[AppLayout ${new Date().toISOString()}] User authenticated in layout: ${user.email}`);

  // Fetch user profile if needed for TopBar (optional)
  // let profile = null;
  // if (user) { // Check user again just in case, though previous check should cover
  //   const { data: userProfile, error: profileError } = await supabase
  //     .from('profiles')
  //     .select('full_name, avatar_url')
  //     .eq('id', user.id)
  //     .single();
  //   if (profileError) {
  //     console.error(`[AppLayout ${new Date().toISOString()}] Error fetching profile:`, profileError.message);
  //   } else {
  //     profile = userProfile;
  //   }
  // }

  return (
    <div className="flex h-screen bg-background text-foreground">
      <SidebarNav />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Pass user or profile data to TopBar if it needs it */}
        <TopBar userEmail={user.email} /* userProfile={profile} */ /> 
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-muted/30 dark:bg-muted/10 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
      <Toaster richColors position="top-right" />
    </div>
  );
}