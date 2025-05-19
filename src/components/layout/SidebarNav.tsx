/* eslint-disable @typescript-eslint/no-unused-vars */
// src/components/layout/SidebarNav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { mainNavLinks, NavLink } from '@/config/nav';
import { cn } from '@/lib/utils';
// Button might not be needed here anymore unless for a specific styled link
// import { Button } from '@/components/ui/button';
// Sheet components are for mobile, not directly used for the desktop sidebar's content structure
// import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, LineChart as AppIcon, Settings as SettingsIcon, UserCircle, LogOut } from 'lucide-react'; // Added SettingsIcon, UserCircle
import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client'; // For fetching user
import type { User as SupabaseAuthUser, Profile } from '@/types'; // Import types
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // For user avatar

// Assuming you have a function to get profile, or we can inline it
// import { getUserProfileById } from '@/services/userService'; // If you have this

const NavItem = ({ href, label, icon: Icon, matchExact = false }: NavLink) => {
  const pathname = usePathname();
  const isActive = matchExact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:bg-primary/10',
        isActive && 'bg-primary/10 text-primary font-medium'
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
};

export default function SidebarNav() {
  // const [isSheetOpen, setIsSheetOpen] = useState(false); // For mobile sheet, not directly used in this modification
  const pathname = usePathname();
  const [userAuth, setUserAuth] = useState<SupabaseAuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoadingUser(true);
      const { data: { user } } = await supabase.auth.getUser();
      setUserAuth(user);

      if (user) {
        // Fetch profile for the user
        // Option 1: If you have a dedicated service function
        // const profileData = await getUserProfileById(supabase, user.id);
        // setUserProfile(profileData);

        // Option 2: Inline fetch (example)
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') { // PGRST116: 0 rows, which is fine if profile not created yet
          console.error('Error fetching profile:', profileError);
          setUserProfile(null);
        } else {
          setUserProfile(profileData);
        }
      } else {
        setUserProfile(null);
      }
      setIsLoadingUser(false);
    };

    fetchUserData();
  }, [supabase]); // Add supabase to dependency array

  // Close sheet on navigation (relevant for mobile sheet if you implement it)
  // React.useEffect(() => {
  //   setIsSheetOpen(false);
  // }, [pathname]);

  const navContent = (
    <nav className="grid items-start gap-1 px-2 text-sm font-medium lg:px-4">
      {mainNavLinks.map((link) => (
        <NavItem key={link.href} {...link} />
      ))}
    </nav>
  );

  const getFirstName = (fullName: string | null | undefined): string | null => {
    if (!fullName) return null;
    return fullName.split(' ')[0];
  };

  const firstName = getFirstName(userProfile?.full_name);

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden border-r bg-card md:block w-64">
        <div className="flex h-full max-h-screen flex-col"> {/* Removed gap-2 to use mt-auto for bottom section */}
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
              <AppIcon className="h-6 w-6 text-primary" />
              {/* Apply a different font here. Example: using a Tailwind utility or a custom class */}
              {/* Option A: Using an existing utility like font-serif or font-mono if suitable */}
              {/* Option B: Define a custom font family in tailwind.config.js and apply it e.g., 'font-logo' */}
              <span className="font-['Poppins',_sans-serif] font-semibold text-lg tracking-tight"> {/* Example: Poppins font if loaded */}
                Finance Planner
              </span>
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto py-4"> {/* Added overflow-y-auto */}
            {navContent}
          </div>

          {/* User Info and Settings Link - Bottom Section */}
          <div className="mt-auto p-4 border-t">
            {isLoadingUser ? (
              <div className="flex items-center gap-3 p-2">
                <div className="h-10 w-10 bg-muted rounded-full animate-pulse"></div>
                <div className="space-y-1">
                    <div className="h-4 w-24 bg-muted rounded animate-pulse"></div>
                    <div className="h-3 w-32 bg-muted rounded animate-pulse"></div>
                </div>
              </div>
            ) : userAuth ? (
              <div className="mb-4">
                <Link href="/settings" className="flex items-center gap-3 p-2 -m-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <Avatar className="h-10 w-10 border">
                    <AvatarImage src={userProfile?.avatar_url || undefined} alt={userProfile?.full_name || userAuth.email} />
                    <AvatarFallback>
                      {userProfile?.full_name ? userProfile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) : <UserCircle className="h-5 w-5" />}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium leading-none">
                      Hello, {firstName || 'User'}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground max-w-[150px]">
                      {userAuth.email}
                    </p>
                  </div>
                </Link>
              </div>
            ) : (
              <div className="p-2 text-sm text-muted-foreground">
                Not signed in.
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Mobile Sidebar (Sheet) - Triggered by TopBar Menu Icon */}
      {/* The trigger for this sheet will be in the TopBar component for mobile */}
    </>
  );
}