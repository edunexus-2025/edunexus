
'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Routes } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';

// This page now acts as a redirector to the settings tab by default.
export default function TestPanelRootPage() {
  const router = useRouter();
  const params = useParams();
  const testId = typeof params.testId === 'string' ? params.testId : '';

  useEffect(() => {
    if (testId) {
      router.replace(Routes.teacherTestPanelSettings(testId));
    } else {
      router.replace(Routes.teacherMyContent);
    }
  }, [testId, router]);

  return (
    <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/2 mb-4" />
        <Skeleton className="h-64 w-full" />
    </div>
  );
}
    