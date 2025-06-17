
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Routes } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// This page now serves as a redirector or a simple info page if a user lands here directly.
// The main admin functionality is in /admin/dashboard.
export default function DeprecatedAdminPanelPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user?.role === 'Admin') {
      router.replace(Routes.adminDashboard);
    } else if (!isLoading && user?.role !== 'Admin') {
      router.replace(Routes.dashboard); // Or an access denied page
    } else if (!isLoading && !user) {
      router.replace(Routes.login);
    }
  }, [user, isLoading, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Redirecting...</CardTitle>
          <CardDescription>
            The admin panel has moved. You are being redirected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    </div>
  );
}

