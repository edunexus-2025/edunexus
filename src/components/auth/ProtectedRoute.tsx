
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Routes } from '@/lib/constants';
import { useRouter } from 'next/navigation';
import React, { useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, teacher, isLoadingTeacher } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Only attempt to redirect if both loading states are false
    if (!isLoading && !isLoadingTeacher) {
      if (!user && !teacher) { // If neither student nor teacher is logged in
        // Redirect to student login by default. Consider a generic login or role selection page if appropriate.
        router.replace(Routes.login); 
      }
      // If either 'user' or 'teacher' is present, access is granted, no redirect needed from here.
    }
  }, [user, isLoading, teacher, isLoadingTeacher, router]);

  // Show loading skeleton if:
  // 1. Either student or teacher auth state is still loading.
  // 2. Or, if both loading states are complete, but neither user nor teacher is authenticated (redirect is imminent).
  if (isLoading || isLoadingTeacher || (!isLoading && !isLoadingTeacher && !user && !teacher)) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="space-y-4 p-8 rounded-lg shadow-xl bg-card">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-10 w-full mt-4" />
          <p className="text-center text-muted-foreground">
            {(isLoading || isLoadingTeacher) ? 'Loading authentication...' : 'Verifying access...'}
          </p>
        </div>
      </div>
    );
  }

  // If we reach here, loading is complete, and either a student or a teacher is authenticated.
  return <>{children}</>;
}
