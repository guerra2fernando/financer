// src/components/settings/SettingsPageClientContent.tsx
'use client';

import React, { useState } from 'react';
import { Profile, SupabaseAuthUser as User, Currency } from '@/types'; // Renamed SupabaseUser to User for clarity
import ProfileForm from './ProfileForm';
import ChangePasswordForm from './ChangePasswordForm';
import DeleteAccountSection from './DeleteAccountSection';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { UserCircle, KeyRound, Trash2 } from 'lucide-react';

interface SettingsPageClientContentProps {
  userAuth: User; // Supabase auth user object
  initialUserProfile: Profile | null;
  allCurrencies: Currency[]; // To populate the currency dropdown
}

export default function SettingsPageClientContent({
  userAuth,
  initialUserProfile,
  allCurrencies,
}: SettingsPageClientContentProps) {
  const [userProfile, setUserProfile] = useState<Profile | null>(initialUserProfile);

  const handleProfileUpdate = (updatedProfile: Profile) => {
    setUserProfile(updatedProfile);
  };

  if (!userAuth) {
    return <p>Loading user data or not authenticated...</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground">
          Manage your profile, security, and application preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><UserCircle className="mr-2 h-5 w-5 text-blue-500"/> Profile Information</CardTitle>
          <CardDescription>Update your personal details.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm 
            userAuth={userAuth} 
            userProfile={userProfile} 
            onProfileUpdate={handleProfileUpdate}
            allCurrencies={allCurrencies} // Pass currencies to the form
          />
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><KeyRound className="mr-2 h-5 w-5 text-orange-500"/> Change Password</CardTitle>
          <CardDescription>Update your login password.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
      
      <Separator />

      <Card id="delete-account" className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center text-destructive"><Trash2 className="mr-2 h-5 w-5"/> Delete Account</CardTitle>
          <CardDescription className="text-destructive/90">Permanently remove your account and all associated data.</CardDescription>
        </CardHeader>
        <CardContent>
            <DeleteAccountSection userEmail={userAuth.email} userId={userAuth.id} />
        </CardContent>
      </Card>
    </div>
  );
}