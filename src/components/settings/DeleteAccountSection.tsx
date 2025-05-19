/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-unused-vars */
// src/components/pages/settings/DeleteAccountSection.tsx
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client'; // Standard client
import { Loader2, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';


interface DeleteAccountSectionProps {
    userEmail: string | undefined;
    userId: string;
}

export default function DeleteAccountSection({ userEmail, userId }: DeleteAccountSectionProps) {
  const [confirmationText, setConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const requiredConfirmationText = "DELETE MY ACCOUNT"; // Make it specific

  const handleSoftDeleteRequest = async () => {
    // For a real soft delete, you'd call a service function here:
    // e.g., await userService.requestAccountDeletion(userId);
    // This function might:
    // 1. Mark profile.is_active = false or profile.status = 'deletion_requested'
    // 2. Add to an admin queue for review/processing.
    // 3. Potentially disable login via a Supabase hook or by revoking sessions.
    
    setIsDeleting(true);
    toast.info("Account deletion request submitted. This feature is under review for full implementation.");
    // Simulating a delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsDeleting(false);
    
    // For a real hard delete via Edge Function (advanced):
    /*
    setIsDeleting(true);
    const { error } = await supabase.functions.invoke('delete-user-account', {
        body: { userIdToDelete: userId } // Ensure your Edge Function expects this
    });
    setIsDeleting(false);

    if (error) {
        toast.error(`Failed to delete account: ${error.message}`);
    } else {
        toast.success('Your account and all data have been permanently deleted.');
        await supabase.auth.signOut(); // Sign out the user
        router.push('/'); // Redirect to homepage
    }
    */
  };
  
  // This simplified version only allows the button to be clicked after typing.
  // No actual deletion happens here.
   const handleActualDelete = async () => {
    if (confirmationText !== requiredConfirmationText) {
      toast.error(`Confirmation text does not match. Type "${requiredConfirmationText}" to proceed.`);
      return;
    }
    setIsDeleting(true);

    // Placeholder: In a real scenario, you would invoke an Edge Function for hard delete
    // or a service function for soft delete.
    console.warn(`Simulating account deletion for user: ${userId}`);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call

    // Example of what a soft delete might do on the client side after server confirmation
    // await supabase.auth.signOut();
    // toast.success("Your account has been marked for deletion and you have been logged out.");
    // router.push('/'); // Redirect to home or login page

    toast.error("Account deletion is a critical feature and is not fully implemented in this demo. No data was deleted.");
    setIsDeleting(false);
    setConfirmationText(''); // Reset confirmation
  };


  return (
    <div className="space-y-4 rounded-lg border border-destructive p-6">
      <div className="flex items-center space-x-3">
        <ShieldAlert className="h-8 w-8 text-destructive" />
        <div>
            <h3 className="text-lg font-semibold text-destructive">Delete Account</h3>
            <p className="text-sm text-muted-foreground">
            This action is irreversible. All your financial data, including incomes, expenses,
            investments, goals, and accounts, will be permanently removed.
            </p>
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="deleteConfirmation" className="font-medium">
          To confirm, please type "<span className="font-bold text-destructive">{requiredConfirmationText}</span>" in the box below:
        </Label>
        <Input
          id="deleteConfirmation"
          type="text"
          value={confirmationText}
          onChange={(e) => setConfirmationText(e.target.value)}
          placeholder={requiredConfirmationText}
          className="border-destructive focus-visible:ring-destructive"
        />
      </div>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="destructive"
            disabled={confirmationText !== requiredConfirmationText || isDeleting}
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete My Account Permanently
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              account and remove all your data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleActualDelete} // Changed to handleActualDelete for demo
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, delete my account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <p className="text-xs text-muted-foreground mt-2">
        Note: For this demonstration, the delete button will simulate the process but will not actually delete your account data.
        A full implementation requires a secure backend process.
      </p>
    </div>
  );
}