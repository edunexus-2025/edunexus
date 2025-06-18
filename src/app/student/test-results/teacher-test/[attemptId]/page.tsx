
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, CheckCircle } from 'lucide-react'; // Using CheckCircle for success
import { Routes } from '@/lib/constants';
import { useEffect, useState } from 'react';
import pb from '@/lib/pocketbase';
import type { RecordModel } from 'pocketbase';
import { Skeleton } from '@/components/ui/skeleton'; // For loading state
import type { TeacherTestAttempt } from '@/lib/types';

export default function TeacherTestResultPage() {
  const params = useParams();
  const router = useRouter();
  const attemptId = typeof params.attemptId === 'string' ? params.attemptId : '';

  const [attemptData, setAttemptData] = useState<TeacherTestAttempt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!attemptId) {
      if (isMounted) {
        setError("Attempt ID not found.");
        setIsLoading(false);
      }
      return;
    }

    const fetchAttemptDetails = async () => {
      if (!isMounted) return;
      setIsLoading(true);
      setError(null);
      try {
        const record = await pb.collection('teacher_test_attempts').getOne<TeacherTestAttempt>(attemptId);
        if (isMounted) {
          setAttemptData(record);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error("Failed to fetch teacher test attempt details:", err);
          setError("Could not load test result details.");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchAttemptDetails();
    return () => { isMounted = false; };
  }, [attemptId]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30">
        <Card className="w-full max-w-lg text-center shadow-xl">
          <CardHeader><Skeleton className="h-8 w-3/4 mx-auto" /><Skeleton className="h-5 w-full mx-auto mt-2" /></CardHeader>
          <CardContent className="space-y-4"><Skeleton className="h-6 w-1/2 mx-auto" /><Skeleton className="h-10 w-full" /></CardContent>
        </Card>
      </div>
    );
  }

  if (error || !attemptData) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30">
        <Card className="w-full max-w-lg text-center shadow-xl">
          <CardHeader><CardTitle className="text-destructive">Error</CardTitle></CardHeader>
          <CardContent><p>{error || "Could not find test result data."}</p></CardContent>
          <CardFooter><Button onClick={() => router.push(Routes.dashboard)} variant="outline" className="mx-auto">Back to Dashboard</Button></CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 dark:bg-slate-950 p-4">
      <Card className="w-full max-w-lg text-center shadow-xl">
        <CardHeader>
          <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
          <CardTitle className="text-2xl">Test Submitted Successfully!</CardTitle>
          <CardDescription>
            Results for: {attemptData.test_name_cache || 'Test'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-lg">Your Score: <span className="font-bold text-primary">{attemptData.score}</span> / {attemptData.max_score}</p>
          <p className="text-md">Percentage: <span className="font-semibold">{attemptData.percentage?.toFixed(2) || 'N/A'}%</span></p>
          <p className="text-sm text-muted-foreground">Status: {attemptData.status.replace('_', ' ')}</p>
          <p className="text-xs text-muted-foreground">Attempt ID: {attemptData.id}</p>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={() => router.push(Routes.myProgress)} variant="default">
            View My Progress
          </Button>
          <Button onClick={() => router.push(Routes.dashboard)} variant="outline">
            Back to Dashboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
