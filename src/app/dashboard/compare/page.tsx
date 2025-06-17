'use client';

// This page is being removed.
// You can delete this file or keep it as a placeholder.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Routes } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';

export default function OldComparePageRedirect() {
  const router = useRouter();
  useEffect(() => {
    // Redirect to a more general page or the main dashboard
    // as the compare feature is being removed.
    router.replace(Routes.dashboard); 
  }, [router]);

  return (
    <div className="p-8 text-center space-y-4">
      <Skeleton className="h-8 w-1/2 mx-auto" />
      <Skeleton className="h-4 w-3/4 mx-auto" />
      <Skeleton className="h-4 w-2/3 mx-auto" />
      <p className="text-muted-foreground">The "Compare" feature has been removed. Redirecting...</p>
    </div>
  );
}
