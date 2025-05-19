// src/components/pages/dashboard/QuickActions.tsx
'use client';

import { Button } from '@/components/ui/button';
import { ArrowUpCircle, ArrowDownCircle, Briefcase, Landmark } from 'lucide-react';
import Link from 'next/link';
// TODO: Later, these buttons might open modals with forms (e.g., IncomeForm, ExpenseForm)

export default function QuickActions() {
  // For now, these link to their respective pages.
  // Later, they can trigger modals.
  const actions = [
    { label: 'Add Income', href: '/income', icon: <ArrowDownCircle className="mr-2 h-4 w-4" /> },
    { label: 'Add Expense', href: '/spending', icon: <ArrowUpCircle className="mr-2 h-4 w-4" /> },
    { label: 'Add Account', href: '/accounts/', icon: <Landmark className="mr-2 h-4 w-4" /> },
    { label: 'Add Investment', href: '/investments', icon: <Briefcase className="mr-2 h-4 w-4" /> },
  ];

  return (
    <div className="py-4">
        <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {actions.map(action => (
                <Button key={action.label} variant="outline" asChild>
                    <Link href={action.href}>
                        {action.icon}
                        {action.label}
                    </Link>
                </Button>
            ))}
        </div>
    </div>
  );
}