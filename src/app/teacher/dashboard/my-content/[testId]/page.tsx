
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import pb from '@/lib/pocketbase';
import type { RecordModel } from 'pocketbase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Copy, Check, Info, FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface TeacherTest extends RecordModel {
  id: string;
  testName: string;
  Admin_Password?: string; 
  // Add other relevant fields from your teacher_tests collection
}

export default function TeacherTestPanelPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const testId = typeof params.testId === 'string' ? params.testId : '';

  const [testData, setTestData] = useState<TeacherTest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!testId) {
      if(isMounted) {
        setError("Test ID not found.");
        setIsLoading(false);
      }
      return;
    }

    const fetchTestDetails = async () => {
      if (!isMounted) return;
      setIsLoading(true);
      setError(null);
      try {
        const record = await pb.collection('teacher_tests').getOne<TeacherTest>(testId);
        if (isMounted) {
          setTestData(record);
        }
      } catch (err: any) {
        if (isMounted) {
          if (err.isAbort || (err.name === 'ClientResponseError' && err.status === 0)) {
            console.warn('Fetch test details request was cancelled.');
          } else {
            console.error("Failed to fetch test details:", err);
            setError("Could not load test details. Please ensure the test exists and you have permission.");
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchTestDetails();
    return () => { isMounted = false; };
  }, [testId]);

  const testLink = typeof window !== 'undefined' ? `${window.location.origin}/student/test/${testId}` : '';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(testLink)
      .then(() => {
        setIsCopied(true);
        toast({ title: "Test link copied to clipboard!" });
        setTimeout(() => setIsCopied(false), 2000);
      })
      .catch(err => {
        toast({ title: "Failed to copy link", description: "Could not copy link to clipboard.", variant: "destructive" });
        console.error('Failed to copy text: ', err);
      });
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="shadow-lg">
          <CardHeader className="p-6">
             <Skeleton className="h-10 w-3/4" />
             <Skeleton className="h-6 w-1/2 mt-2" />
          </CardHeader>
          <CardContent className="p-6 md:p-8 space-y-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-10 w-1/3 mt-4" />
            <div className="mt-6 space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="shadow-lg border-destructive bg-destructive/10 max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-destructive">Error Loading Test Panel</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{error}</p>
          <Button onClick={() => router.back()} variant="outline" className="mt-4">Go Back</Button>
        </CardContent>
      </Card>
    );
  }

  if (!testData) {
    return <Card className="max-w-4xl mx-auto p-6 text-center text-muted-foreground">No test data found or test does not exist.</Card>;
  }

  const instructions = [
    "Add questions. Upto 200 questions.",
    "View questions. If any edit require.",
    "Adjust Settings. Without adjust settings you can't run test. Select test status as published in the settings menu.",
    "Share test link with candidates.",
    "View test result which you share."
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="shadow-xl border-border overflow-hidden">
        <CardHeader className="p-6 bg-card">
          <CardTitle className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary"/>
            Test Panel: <span className="text-primary">{testData.testName}</span>
          </CardTitle>
          <CardDescription className="mt-1">Manage and configure this test from here.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 md:p-8 space-y-6">
          
          <Card className="bg-muted/30 p-4 rounded-md">
            <CardHeader className="p-0 pb-2">
              <CardTitle className="text-lg">Test Details</CardTitle>
            </CardHeader>
            <CardContent className="p-0 space-y-1 text-sm">
              <p><strong className="text-foreground">Test Name:</strong> {testData.testName}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <strong className="text-foreground">Shareable Link:</strong> 
                <span className="text-blue-600 dark:text-blue-400 break-all">{testLink}</span>
              </div>
              <p><strong className="text-foreground">Test Password:</strong> {testData.Admin_Password || 'Not set'}</p>
            </CardContent>
            <CardFooter className="p-0 pt-3">
              <Button onClick={handleCopyLink} variant="outline" size="sm">
                {isCopied ? <Check className="mr-2 h-4 w-4 text-green-500" /> : <Copy className="mr-2 h-4 w-4" />}
                {isCopied ? 'Copied!' : 'Copy Shareable Link'}
              </Button>
            </CardFooter>
          </Card>


          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Instructions:</h3>
            <ul className="list-decimal list-inside space-y-1.5 text-muted-foreground text-sm bg-muted/30 p-4 rounded-md">
              {instructions.map((inst, index) => (
                <li key={index}>{inst}</li>
              ))}
            </ul>
          </div>

          <div className="mt-6 p-4 bg-secondary/50 text-secondary-foreground rounded-lg text-xs space-y-1 border border-secondary-foreground/20">
            <p className="font-semibold flex items-center gap-1"><Info className="h-4 w-4"/> Important Notes:</p>
            <p>For test preview, Copy the test link & paste into your web browser. Same test link you have to share with candidates via whatsapp, facebook, telegram, or through any other medium.</p>
            <p className="mt-1">Add Group candidates when you select 'Group Candidates' from the drop-down (Feature coming soon).</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
