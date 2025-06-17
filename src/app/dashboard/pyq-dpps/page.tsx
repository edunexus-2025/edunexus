'use client';

// This page is now part of /dashboard/pyq-practice
// This file can be deleted or kept as a redirect placeholder.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Routes } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';

export default function OldPyqDppsPageRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace(Routes.pyqPractice);
  }, [router]);

  return (
    <div className="p-8 text-center space-y-4">
      <Skeleton className="h-8 w-1/2 mx-auto" />
      <Skeleton className="h-4 w-3/4 mx-auto" />
      <Skeleton className="h-4 w-2/3 mx-auto" />
      <p className="text-muted-foreground">Redirecting to PYQ Practice Center...</p>
    </div>
  );
}
