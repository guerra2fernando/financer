// src/components/layout/TopBar.tsx
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Menu, LogOut, UserCircle, LineChart as AppIcon, Sun, Moon } from 'lucide-react'; // Sun and Moon are already here
import { createClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import { userNavLinks, mainNavLinks, NavLink as MainNavLinkType } from '@/config/nav';
import { cn } from '@/lib/utils';
import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';

interface TopBarProps {
  userEmail?: string | null;
}

const MobileNavItem = ({ href, label, icon: Icon, matchExact = false }: MainNavLinkType) => {
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

export default function TopBar({ userEmail }: TopBarProps) {
  const supabase = createClient();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  };

  const userInitial =
    userEmail?.charAt(0).toUpperCase() || <UserCircle className="h-5 w-5" />;

  // No need for a separate toggleTheme function if used directly inline
  // const toggleTheme = () => {
  //   setTheme(theme === 'dark' ? 'light' : 'dark');
  // };

  if (!mounted) {
    // To prevent hydration errors and avoid rendering the button server-side
    // or before the theme is known, you can return a placeholder or null.
    // For a simple icon button, just not rendering it until mounted is fine.
    return (
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 lg:h-[60px]">
        {/* Mobile Menu Trigger (can still show this part) */}
        <Sheet>
          <SheetTrigger asChild>
            <Button size="icon" variant="outline" className="md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="sm:max-w-xs p-0">
             {/* ... (mobile nav content remains the same) ... */}
             <nav className="grid gap-4 text-lg font-medium">
                <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6 sticky top-0 bg-background z-10">
                <Link
                    href="/dashboard"
                    className="flex items-center gap-2 font-semibold text-primary"
                >
                    <AppIcon className="h-6 w-6" />
                    <span className="font-['Poppins',_sans-serif] font-semibold text-lg tracking-tight">
                    Finance Planner
                    </span>
                </Link>
                </div>
                <div className="p-4 space-y-1">
                {mainNavLinks.map((link) => (
                    <MobileNavItem key={`mobile-${link.href}`} {...link} />
                ))}
                </div>
            </nav>
          </SheetContent>
        </Sheet>
        <div className="flex-1" />
        {/* Placeholder for theme button if needed or just empty space */}
        <div className="w-10 h-10" /> {/* Adjust size to match button */}
        {/* User Dropdown (can also be conditional on mounted or show placeholder) */}
        <div className="w-10 h-10 rounded-full bg-muted" /> {/* Placeholder for avatar */}
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 lg:h-[60px]">
      {/* Mobile Menu Trigger */}
      <Sheet>
        <SheetTrigger asChild>
          <Button size="icon" variant="outline" className="md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="sm:max-w-xs p-0">
          {/* ... (mobile nav content remains the same) ... */}
          <nav className="grid gap-4 text-lg font-medium">
            <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6 sticky top-0 bg-background z-10">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 font-semibold text-primary"
              >
                <AppIcon className="h-6 w-6" />
                <span className="font-['Poppins',_sans-serif] font-semibold text-lg tracking-tight">
                  Finance Planner
                </span>
              </Link>
            </div>
            <div className="p-4 space-y-1">
              {mainNavLinks.map((link) => (
                <MobileNavItem key={`mobile-${link.href}`} {...link} />
              ))}
            </div>
          </nav>
        </SheetContent>
      </Sheet>

      <div className="flex-1" />

      {/* Theme Toggle Button - Standard shadcn/ui pattern */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        aria-label="Toggle theme"
      >
        <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Toggle theme</span>
      </Button>

      <DropdownMenu>
        {/* ... (DropdownMenu content remains the same) ... */}
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="overflow-hidden rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{userInitial}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-semibold leading-none">Account</p>
              <p className="text-xs leading-none text-muted-foreground">{userEmail}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {userNavLinks.map((link) => {
            const Icon = link.icon;
            return (
              <DropdownMenuItem
                key={link.href}
                asChild
                className="cursor-pointer"
              >
                <Link href={link.href}>
                  <Icon className="mr-2 h-4 w-4" />
                  {link.label}
                </Link>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleLogout}
            className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:text-red-500 dark:focus:text-red-500 dark:focus:bg-red-900/50"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}