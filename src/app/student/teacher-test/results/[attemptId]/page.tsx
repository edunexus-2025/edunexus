
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react'; // Added AlertCircle
import { Routes } from '@/lib/constants';
import { useEffect, useState, useCallback } from 'react'; // Added useCallback
import pb from '@/lib/pocketbase';
import type { RecordModel } from 'pocketbase';
import { Skeleton } from '@/components/ui/skeleton';
import type { TeacherTestAttempt } from '@/lib/types'; // Use the correct type
import { format } from 'date-fns'; // For date formatting

export default function TeacherTestResultPage() {
  const params = useParams();
  const router = useRouter();
  const attemptId = typeof params.attemptId === 'string' ? params.attemptId : '';

  const [attemptData, setAttemptData] = useState<TeacherTestAttempt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAttemptDetails = useCallback(async (isMountedGetter: () => boolean) => {
    if (!attemptId) {
      if (isMountedGetter()) {
        setError("Attempt ID not found.");
        setIsLoading(false);
      }
      return;
    }

    if (isMountedGetter()) {
      setIsLoading(true);
      setError(null);
    }

    try {
      // Fetch from 'teacher_test_history' instead of 'teacher_test_attempts'
      const record = await pb.collection('teacher_test_history').getOne<TeacherTestAttempt>(attemptId);
      if (isMountedGetter()) {
        setAttemptData(record);
      }
    } catch (err: any) {
      if (isMountedGetter()) {
        console.error("Failed to fetch teacher test attempt details from history:", err);
        setError("Could not load test result details. It might have been deleted or an error occurred.");
      }
    } finally {
      if (isMountedGetter()) setIsLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    let isMounted = true;
    fetchAttemptDetails(() => isMounted);
    return () => { isMounted = false; };
  }, [fetchAttemptDetails]);


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

  if (error || !attemptData) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30">
        <Card className="w-full max-w-lg text-center shadow-xl">
          <CardHeader>
            <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <CardTitle className="text-destructive">Error Loading Result</CardTitle>
          </CardHeader>
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
          <p className="text-sm text-muted-foreground">Status: {attemptData.status?.replace(/_/g, ' ') || 'N/A'}</p>
          <p className="text-xs text-muted-foreground">Attempt ID: {attemptData.id}</p>
          {attemptData.submitted_at && (
            <p className="text-xs text-muted-foreground">
              Submitted: {format(new Date(attemptData.submitted_at), "dd MMM yyyy, HH:mm:ss")}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex-col sm:flex-row justify-center gap-3">
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
    
