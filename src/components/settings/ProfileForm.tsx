// src/components/settings/ProfileForm.tsx
'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import type { Profile, SupabaseAuthUser as User, ProfileUpdatePayload, Currency } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Import Select components
import { updateUserProfile } from '@/services/userService'; // Corrected service import
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Loader2, UserCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CurrencyCode, DEFAULT_CURRENCY } from '@/lib/constants'; // Import flexible CurrencyCode and default

interface ProfileFormProps {
  userAuth: User;
  userProfile: Profile | null;
  onProfileUpdate: (updatedProfile: Profile) => void;
  allCurrencies: Currency[]; // Array of available currency objects
}

export default function ProfileForm({ 
    userAuth, 
    userProfile, 
    onProfileUpdate,
    allCurrencies 
}: ProfileFormProps) {
  const [fullName, setFullName] = useState(userProfile?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(userProfile?.avatar_url || '');
  // Use the flexible CurrencyCode type and ensure a valid default
  const [preferredCurrency, setPreferredCurrency] = useState<CurrencyCode>(
    userProfile?.preferred_currency || DEFAULT_CURRENCY
  );
  const [locationCity, setLocationCity] = useState(userProfile?.location_city || '');
  const [locationCountry, setLocationCountry] = useState(userProfile?.location_country || '');
  const [householdSize, setHouseholdSize] = useState<number | ''>(userProfile?.household_size || '');


  const [isLoading, setIsLoading] = useState(false);
  const supabaseBrowserClient = createClient();

  useEffect(() => {
    setFullName(userProfile?.full_name || '');
    setAvatarUrl(userProfile?.avatar_url || '');
    setPreferredCurrency(userProfile?.preferred_currency || DEFAULT_CURRENCY);
    setLocationCity(userProfile?.location_city || '');
    setLocationCountry(userProfile?.location_country || '');
    setHouseholdSize(userProfile?.household_size ?? ''); // Use ?? for null/undefined to empty string
  }, [userProfile]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!userAuth?.id) {
        toast.error("User not authenticated.");
        return;
    }
    setIsLoading(true);

    const updates: ProfileUpdatePayload = {
      full_name: fullName.trim() || null,
      avatar_url: avatarUrl.trim() || null,
      preferred_currency: preferredCurrency, // This is now CurrencyCode type
      location_city: locationCity.trim() || null,
      location_country: locationCountry.trim() || null,
      household_size: householdSize === '' ? null : Number(householdSize),
    };

    const { data, error } = await updateUserProfile(supabaseBrowserClient, userAuth.id, updates);
    setIsLoading(false);

    if (error) {
      toast.error(`Failed to update profile: ${error.message}`);
    } else if (data) {
      toast.success('Profile updated successfully!');
      onProfileUpdate(data);
    } else {
      toast.info('Profile data is already up to date or no changes were applied.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6"> {/* Removed max-w and mx-auto from here */}
      <div className="flex flex-col items-center space-y-4 sm:flex-row sm:space-y-0 sm:space-x-6">
        <Avatar className="h-24 w-24 text-muted-foreground">
            <AvatarImage src={avatarUrl || undefined} alt={fullName || userAuth?.email || 'User Avatar'} />
            <AvatarFallback>
                {fullName ? fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) : <UserCircle className="h-12 w-12" />}
            </AvatarFallback>
        </Avatar>
        <div className="space-y-1.5 flex-1 w-full">
            <Label htmlFor="avatarUrl">Avatar URL (Optional)</Label>
            <Input
            id="avatarUrl"
            type="url"
            value={avatarUrl || ''}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/avatar.png"
            />
        </div>
      </div>
      
      <div>
        <Label htmlFor="email">Email Address</Label>
        <Input
          id="email"
          type="email"
          value={userAuth?.email || ''}
          disabled
          className="bg-muted/50 cursor-not-allowed"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Email address cannot be changed here.
        </p>
      </div>

      <div>
        <Label htmlFor="fullName">Full Name (Optional)</Label>
        <Input
          id="fullName"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your full name"
        />
      </div>
      
      <div>
        <Label htmlFor="preferredCurrency">Preferred Currency</Label>
        <Select
            value={preferredCurrency}
            onValueChange={(value) => setPreferredCurrency(value as CurrencyCode)} // Cast is safe due to SelectItem values
        >
            <SelectTrigger id="preferredCurrency">
                <SelectValue placeholder="Select your preferred currency" />
            </SelectTrigger>
            <SelectContent>
                {allCurrencies.length > 0 ? (
                    allCurrencies.map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>
                            {currency.code} - {currency.name}
                        </SelectItem>
                    ))
                ) : (
                    <SelectItem value={DEFAULT_CURRENCY} disabled>
                        {DEFAULT_CURRENCY} (Default - No other currencies loaded)
                    </SelectItem>
                )}
            </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          This currency will be used for displaying amounts across the app.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="locationCity">City (Optional)</Label>
          <Input
            id="locationCity"
            type="text"
            value={locationCity}
            onChange={(e) => setLocationCity(e.target.value)}
            placeholder="e.g., New York"
          />
        </div>
        <div>
          <Label htmlFor="locationCountry">Country (Optional)</Label>
          <Input
            id="locationCountry"
            type="text"
            value={locationCountry}
            onChange={(e) => setLocationCountry(e.target.value)}
            placeholder="e.g., United States"
          />
        </div>
      </div>
      
      <div>
        <Label htmlFor="householdSize">Household Size (Optional)</Label>
        <Input
          id="householdSize"
          type="number"
          value={householdSize}
          onChange={(e) => setHouseholdSize(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
          placeholder="e.g., 2"
          min="1"
        />
      </div>


      <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Changes
      </Button>
    </form>
  );
}