// src/config/nav.ts
import {
  LayoutDashboard,
  ArrowDownCircle,
  ArrowUpCircle,
  Landmark,
  Briefcase,
  Target,
  Settings,
  LucideIcon,
  ClipboardList,
} from 'lucide-react';

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon; // Store the icon component, not JSX
  matchExact?: boolean;
}

export const mainNavLinks: NavLink[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, matchExact: true },
  { href: '/income', label: 'Income', icon: ArrowDownCircle, matchExact: true },
  { href: '/spending', label: 'Spending', icon: ArrowUpCircle, matchExact: true },
  { href: '/budgets', label: 'Budgets', icon: ClipboardList, matchExact: true }, // Added Budgets link
  { href: '/accounts', label: 'Accounts', icon: Landmark, matchExact: true },
  { href: '/investments', label: 'Investments', icon: Briefcase, matchExact: true },
  { href: '/goals', label: 'Goals', icon: Target, matchExact: true },
];

export const userNavLinks: NavLink[] = [
  { href: '/settings', label: 'Settings', icon: Settings, matchExact: true },
];