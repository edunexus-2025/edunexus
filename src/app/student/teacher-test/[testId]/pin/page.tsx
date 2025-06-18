
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import pb from '@/lib/pocketbase';
import type { RecordModel } from 'pocketbase';
import { Routes } from '@/lib/constants';
import { KeyRound, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';

interface TeacherTestPinData extends RecordModel {
  testName: string;
  Admin_Password?: number; // PIN for the test
}

export default function TeacherTestPinPage() {
  const params = useParams();
  const router = useRouter();
  const searchParamsHook = useSearchParams(); // For potential future use like ?redirect_after_test=
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();

  const testId = typeof params.testId === 'string' ? params.testId : '';
  const [pin, setPin] = useState('');
  const [testName, setTestName] = useState<string | null>(null);
  const [correctPin, setCorrectPin] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTestDetails = useCallback(async (isMountedGetter: () => boolean) => {
    if (!testId) {
      if (isMountedGetter()) { setError("Test ID is missing."); setIsLoading(false); }
      return;
    }
    if (isMountedGetter()) setIsLoading(true);
    try {
      const record = await pb.collection('teacher_tests').getOne<TeacherTestPinData>(testId, {
        fields: 'id,testName,Admin_Password',
      });
      if (isMountedGetter()) {
        if (!record.Admin_Password) {
            setError("This test does not have a PIN set up by the teacher. Cannot proceed.");
            setTestName(record.testName || "Test");
        } else {
            setTestName(record.testName || "Unnamed Test");
            setCorrectPin(record.Admin_Password);
        }
      }
    } catch (err: any) {
      if (isMountedGetter()) {
        console.error("Failed to fetch test details for PIN entry:", err);
        setError("Could not load test details. The test might not exist or is not accessible.");
      }
    } finally {
      if (isMountedGetter()) setIsLoading(false);
    }
  }, [testId]);

  useEffect(() => {
    let isMounted = true;
    if (!authLoading && user) {
      fetchTestDetails(() => isMounted);
    } else if (!authLoading && !user) {
        setError("Please log in to access tests.");
        setIsLoading(false);
    }
    return () => { isMounted = false; };
  }, [authLoading, user, fetchTestDetails]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!pin.trim()) {
      setError("Please enter the PIN.");
      return;
    }
    if (correctPin === null) {
        setError("Test PIN not available. Cannot verify.");
        return;
    }

    setIsVerifying(true);
    // Simulate verification delay if needed, or directly compare
    setTimeout(() => {
      if (parseInt(pin, 10) === correctPin) {
        toast({ title: "PIN Verified!", description: "Redirecting to test instructions..." });
        // Store a flag indicating PIN was successfully entered for this testId
        // This is a simple client-side flag. For more security, a server-generated short-lived token would be better.
        sessionStorage.setItem(`pin_verified_${testId}`, 'true');
        router.push(Routes.studentTeacherTestInstructions(testId));
      } else {
        setError("Invalid PIN. Please try again.");
        toast({ title: "Incorrect PIN", variant: "destructive" });
      }
      setIsVerifying(false);
    }, 500);
  };

  if (isLoading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader><Skeleton className="h-8 w-3/4 mx-auto" /><Skeleton className="h-4 w-full mx-auto mt-2" /></CardHeader>
          <CardContent className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></CardContent>
        </Card>
      </div>
    );
  }
  
  if (!user && !authLoading) {
      router.push(Routes.login + `?redirect=${encodeURIComponent(window.location.pathname)}`);
      return <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30"><Loader2 className="h-12 w-12 animate-spin text-primary"/></div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-background">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <KeyRound className="mx-auto h-12 w-12 text-primary mb-3" />
          <CardTitle className="text-2xl">Enter PIN for Test</CardTitle>
          <CardDescription>
            Test: <span className="font-semibold text-foreground">{testName || 'Loading...'}</span>
            <br/>
            Please enter the PIN provided by your teacher to access this test.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && !testName?.includes("PIN set up") && ( // Only show "general" errors if test name is not already an error state
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {testName?.includes("PIN set up") || correctPin === null ? ( // Test has no PIN error
             <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Test Configuration Issue</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
             </Alert>
          ) : (
            <form onSubmit={handlePinSubmit} className="space-y-4">
                <div>
                <Label htmlFor="pin-input" className="sr-only">Test PIN</Label>
                <Input
                    id="pin-input"
                    type="password" // Use password type to hide input, or number if PINs are always numeric
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Enter Test PIN"
                    className="text-center text-lg h-12 tracking-widest"
                    maxLength={6} // Assuming PIN is max 6 digits
                    disabled={isVerifying}
                />
                </div>
                <Button type="submit" className="w-full" disabled={isVerifying || !pin.trim()}>
                {isVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                {isVerifying ? 'Verifying...' : 'Proceed to Test'}
                </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="text-center">
          <p className="text-xs text-muted-foreground">
            If you don't have the PIN, please contact your teacher.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
    