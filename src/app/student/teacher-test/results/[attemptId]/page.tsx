
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Routes } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect, useState } from 'react';

// Basic placeholder, functionality to be expanded later
export default function TeacherTestResultPage() {
  const params = useParams();
  const router = useRouter();
  const attemptId = typeof params.attemptId === 'string' ? params.attemptId : '';
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate data fetching
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
         <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-muted/30">
            <Card className="w-full max-w-lg text-center shadow-xl">
                <CardHeader>
                    <Skeleton className="h-12 w-12 rounded-full mx-auto mb-4" />
                    <Skeleton className="h-8 w-3/4 mx-auto" />
                    <Skeleton className="h-4 w-1/2 mx-auto mt-2" />
                </CardHeader>
                <CardContent className="space-y-3">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-4 w-5/6 mx-auto" />
                </CardContent>
                <CardFooter className="flex justify-center">
                    <Skeleton className="h-10 w-32" />
                </CardFooter>
            </Card>
        </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-lg text-center shadow-xl">
        <CardHeader>
          <CheckCircle2 className="mx-auto h-16 w-16 text-green-500 mb-4" />
          <CardTitle className="text-2xl">Test Submitted!</CardTitle>
          <CardDescription>
            Your results for this teacher-created test have been recorded.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-2">
            Attempt ID: {attemptId ? attemptId.substring(0, 8) + '...' : 'N/A'}
          </p>
          <p className="text-muted-foreground">
            Detailed analysis and solutions will be available here soon.
          </p>
        </CardContent>
        <CardFooter className="flex-col sm:flex-row justify-center gap-3">
          <Button onClick={() => router.push(Routes.dashboard)} variant="default">
            Back to Dashboard
          </Button>
          <Button onClick={() => router.push(Routes.myProgress)} variant="outline">
            View My Progress
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
    