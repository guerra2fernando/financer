// src/app/page.tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button'; // Adjust path

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-6">Personal Finance & Projection Tool</h1>
        <p className="mb-8 text-lg">
          Track your income, expenses, and plan for your financial future.
        </p>
        <div className="space-x-4">
          <Button asChild>
            <Link href="/auth/login">Login</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/auth/signup">Sign Up</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}