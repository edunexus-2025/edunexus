
'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Routes } from '@/lib/constants';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// This page now primarily acts as a redirector to the live test page,
// as PIN and instructions are handled within the live page itself.
export default function TestInstructionsRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const testId = typeof params.testId === 'string' ? params.testId : '';

  useEffect(() => {
    if (testId) {
      // For teacher tests, the live page handles PIN and instructions.
      // For platform tests (if this route was also used for them),
      // they might have a different flow or their own dedicated live page.
      // Assuming testId is for a teacher test based on the context of student/teacher-test/[testId] structure.
      router.replace(Routes.studentTeacherTestLive(testId));
    } else {
      // If no testId, perhaps redirect to test series or dashboard
      router.replace(Routes.testSeries);
    }
  }, [testId, router]);

  return (
    <div className="flex flex-col min-h-screen p-4 md:p-8 items-center justify-center bg-muted/30">
      <Card className="w-full max-w-md text-center shadow-xl">
        <CardHeader>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary mb-4" />
            <CardTitle>Loading Test...</CardTitle>
        </CardHeader>
        <CardContent>
            <CardDescription>
                You are being redirected to the test environment.
            </CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}
      