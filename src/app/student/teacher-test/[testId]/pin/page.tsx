'use client';
// This file is obsolete as its functionality is merged into live/page.tsx
// It will be deleted by the system.
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Routes } from '@/lib/constants';

export default function ObsoleteTeacherTestPinPage() {
  const router = useRouter();
  useEffect(() => {
    // Attempt to extract testId from the current path if possible, or use a generic fallback
    const pathSegments = window.location.pathname.split('/');
    const testIdIndex = pathSegments.indexOf('teacher-test') + 1;
    const testId = (testIdIndex > 0 && testIdIndex < pathSegments.length) ? pathSegments[testIdIndex] : 'unknown';
    
    if (testId && testId !== 'unknown') {
      router.replace(Routes.studentTakeTeacherTestLive(testId));
    } else {
      router.replace(Routes.dashboard); // Fallback if testId can't be determined
    }
  }, [router]);

  return <div>Redirecting to the new test page...</div>;
}