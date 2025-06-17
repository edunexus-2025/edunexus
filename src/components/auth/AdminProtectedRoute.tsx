
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Routes } from '@/lib/constants';
import { useRouter } from 'next/navigation';
import React, { useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.replace(Routes.login);
      } else if (user.role !== 'Admin') {
        // Redirect non-admin users to their regular dashboard or a specific access-denied page
        router.replace(Routes.dashboard); 
      }
    }
  }, [user, isLoading, router]);

  if (isLoading || !user || user.role !== 'Admin') {
    // Show a loading state or a full-page loader
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="space-y-4 p-8 rounded-lg shadow-xl bg-card">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-10 w-full mt-4" />
          <p className="text-center text-muted-foreground">{isLoading ? 'Loading user data...' : 'Redirecting...'}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
