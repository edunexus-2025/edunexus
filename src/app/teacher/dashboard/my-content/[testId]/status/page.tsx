
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, ClipboardCheck, Activity } from 'lucide-react';
import { Routes } from '@/lib/constants';
import { useEffect, useState } from 'react';
import pb from '@/lib/pocketbase';
import type { RecordModel } from 'pocketbase';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast'; // Assuming you have a toast hook

interface TestStatusData extends RecordModel {
  testName: string;
  status: 'Draft' | 'Published' | 'Archived';
  // Add other relevant fields if needed for display
}

export default function TestStatusPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const testId = typeof params.testId === 'string' ? params.testId : '';

  const [testData, setTestData] = useState<TestStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!testId) {
      if (isMounted) {
        setError("Test ID not found.");
        setIsLoading(false);
      }
      return;
    }

    const fetchTestStatus = async () => {
      if (!isMounted) return;
      setIsLoading(true);
      setError(null);
      try {
        const record = await pb.collection('teacher_tests').getOne<TestStatusData>(testId, {
          fields: 'id,testName,status' // Fetch only necessary fields
        });
        if (isMounted) {
          setTestData(record);
        }
      } catch (err: any) {
        if (isMounted) {
          if (err.isAbort || (err.name === 'ClientResponseError' && err.status === 0)) {
            console.warn('Fetch test status request was cancelled.');
          } else {
            console.error("Failed to fetch test status:", err);
            setError("Could not load test status. Please ensure the test exists.");
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchTestStatus();
    return () => { isMounted = false; };
  }, [testId]);

  // Placeholder for status update logic
  const handleUpdateStatus = async (newStatus: TestStatusData['status']) => {
    if (!testData) return;
    // Implement API call to update test status here
    // For example:
    // try {
    //   await pb.collection('teacher_tests').update(testData.id, { status: newStatus });
    //   setTestData(prev => prev ? { ...prev, status: newStatus } : null);
    //   toast({ title: "Status Updated", description: `Test is now ${newStatus}.` });
    // } catch (err) {
    //   toast({ title: "Error", description: "Could not update status.", variant: "destructive" });
    // }
    toast({ title: "Action Demo", description: `Status would be changed to ${newStatus}. (Functionality pending)` });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" /> 
        <Card className="shadow-lg">
          <CardHeader><Skeleton className="h-7 w-1/2" /><Skeleton className="h-4 w-3/4 mt-1" /></CardHeader>
          <CardContent className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-1/2" /></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => router.push(Routes.teacherTestPanel(testId))}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Test Panel
      </Button>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl md:text-2xl flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            Test Status: <span className="text-primary">{testData?.testName || `Test ID: ${testId.substring(0,7)}...`}</span>
          </CardTitle>
          <CardDescription>
            View and manage the current status of this test.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="text-destructive">{error}</p>
          )}
          {!error && testData && (
            <div className="space-y-4">
              <p className="text-lg">
                Current Status: <span className="font-semibold text-primary">{testData.status}</span>
              </p>
              <div className="flex gap-2">
                <Button onClick={() => handleUpdateStatus('Published')} disabled={testData.status === 'Published'}>
                  Publish Test
                </Button>
                <Button onClick={() => handleUpdateStatus('Draft')} variant="outline" disabled={testData.status === 'Draft'}>
                  Set to Draft
                </Button>
                <Button onClick={() => handleUpdateStatus('Archived')} variant="secondary" disabled={testData.status === 'Archived'}>
                  Archive Test
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-4 flex items-center gap-1">
                <Activity className="h-4 w-4"/>
                Further statistics like number of attempts, average scores, etc., will be shown here once available.
              </p>
            </div>
          )}
          {!error && !testData && !isLoading && (
            <p className="text-muted-foreground">Test data could not be loaded.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
