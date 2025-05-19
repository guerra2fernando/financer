/* eslint-disable react/no-unescaped-entities */
// src/components/auth/AuthForm.tsx
'use client';

import { useState, FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';

interface AuthFormProps {
  mode: 'login' | 'signup';
}

export default function AuthForm({ mode }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      if (mode === 'signup') {
        console.log('Attempting signup...');
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          // options: {
          //   emailRedirectTo: `${window.location.origin}/auth/callback`,
          // },
        });
        console.log('Signup response:', { data, error });
        if (error) {
          setMessage(`Signup Error: ${error.message}`);
        } else if (data.user) {
          console.log('Signup successful, user:', data.user);
          if (data.session) { // User confirmed or confirmation not required
             setMessage('Signup successful! Redirecting...');
             router.refresh(); // Middleware will handle redirect to dashboard
          } else { // Email confirmation likely required
            setMessage('Signup successful! Please check your email to confirm your account. (If confirmation is enabled)');
          }
        } else {
          setMessage('Signup initiated. Please check your email to confirm. (If confirmation is enabled)');
        }
      } else { // login mode
        console.log('Attempting login...');
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        console.log('Login response:', { data, error });
        if (error) {
          setMessage(`Login Error: ${error.message}`);
        } else if (data.user) {
          console.log('Login successful, user:', data.user);
          setMessage('Login successful! Redirecting...');
          router.refresh(); // Middleware will handle redirect to dashboard
        } else {
          setMessage('Login attempted, but no user data returned. Please try again.');
        }
      }
    } catch (error) {
      setMessage(`An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // ... JSX remains the same ...
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center">
          {mode === 'signup' ? 'Create an Account' : 'Login to Your Account'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Processing...' : (mode === 'signup' ? 'Sign Up' : 'Login')}
          </Button>
          {message && <p className={`mt-4 text-center text-sm ${message.toLowerCase().includes('error') ? 'text-red-600' : 'text-green-600'}`}>{message}</p>}
        </form>
        <p className="text-center text-sm">
          {mode === 'signup' ? (
            <>
              Already have an account? <a href="/auth/login" className="font-medium text-indigo-600 hover:text-indigo-500">Login</a>
            </>
          ) : (
            <>
              Don't have an account? <a href="/auth/signup" className="font-medium text-indigo-600 hover:text-indigo-500">Sign Up</a>
            </>
          )}
        </p>
      </div>
    </div>
  );
}