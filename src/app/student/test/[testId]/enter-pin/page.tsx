
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import pb from '@/lib/pocketbase';
import type { RecordModel } from 'pocketbase';
import { useToast } from '@/hooks/use-toast';
import { Routes } from '@/lib/constants';
import { KeyRound, Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const PinSchema = z.object({
  pin: z.string().min(4, "PIN must be at least 4 digits.").regex(/^\d+$/, "PIN must be numeric."),
});
type PinInput = z.infer<typeof PinSchema>;

interface TeacherTestForPin extends RecordModel {
  id: string;
  testName: string;
  Admin_Password?: number;
}

export default function EnterPinPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const testId = typeof params.testId === 'string' ? params.testId : '';

  const [testData, setTestData] = useState<TeacherTestForPin | null>(null);
  const [isLoadingTest, setIsLoadingTest] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<PinInput>({
    resolver: zodResolver(PinSchema),
    defaultValues: { pin: '' },
  });

  useEffect(() => {
    let isMounted = true;
    if (!testId) {
      if (isMounted) { setError("Test ID not found."); setIsLoadingTest(false); }
      return;
    }

    const fetchTest = async () => {
      if (!isMounted) return;
      setIsLoadingTest(true);
      try {
        const record = await pb.collection('teacher_tests').getOne<TeacherTestForPin>(testId, {
          fields: 'id,testName,Admin_Password'
        });
        if (isMounted) setTestData(record);
      } catch (err: any) {
        if (isMounted) {
          console.error("Failed to fetch test for PIN entry:", err);
          setError("Could not load test details. Invalid test or an error occurred.");
        }
      } finally {
        if (isMounted) setIsLoadingTest(false);
      }
    };
    fetchTest();
    return () => { isMounted = false; };
  }, [testId]);

  const onSubmit = async (values: PinInput) => {
    if (!testData || testData.Admin_Password === undefined || testData.Admin_Password === null) {
      toast({ title: "Error", description: "Test PIN not set by teacher or test data invalid.", variant: "destructive" });
      return;
    }
    setIsVerifying(true);
    if (String(testData.Admin_Password) === values.pin) {
      toast({ title: "PIN Verified!", description: "Redirecting to test instructions..." });
      try {
        // Store a flag indicating successful PIN entry
        sessionStorage.setItem(`pin_verified_${testId}`, 'true');
      } catch (storageError) {
        console.warn("Could not set PIN verification flag in sessionStorage:", storageError);
        // Proceed anyway, but subsequent pages might need to re-verify if this fails
      }
      router.push(Routes.studentTestInstructions(testId));
    } else {
      toast({ title: "Incorrect PIN", description: "The PIN you entered is incorrect. Please try again.", variant: "destructive" });
      form.setError("pin", { type: "manual", message: "Incorrect PIN." });
      setIsVerifying(false);
    }
  };

  if (isLoadingTest) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30">
        <Card className="w-full max-w-md shadow-xl"><CardHeader className="text-center"><Skeleton className="h-8 w-3/4 mx-auto" /><Skeleton className="h-5 w-full mx-auto mt-2" /></CardHeader><CardContent className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></CardContent></Card>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30">
        <Card className="w-full max-w-md shadow-xl text-center"><CardHeader><AlertTriangle className="mx-auto h-12 w-12 text-destructive" /><CardTitle className="mt-2 text-destructive">Error</CardTitle></CardHeader><CardContent><p>{error}</p></CardContent><CardFooter><Button variant="outline" onClick={() => router.back()} className="mx-auto">Go Back</Button></CardFooter></Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-background">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <KeyRound className="mx-auto h-12 w-12 text-primary" />
          <CardTitle className="text-2xl mt-2">Enter Test PIN</CardTitle>
          <CardDescription>
            This test is protected. Please enter the PIN provided by your teacher for: <br/>
            <span className="font-semibold text-foreground">{testData?.testName || 'Test'}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="pin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Test PIN</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter PIN" {...field} className="text-center text-lg tracking-widest" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isVerifying}>
                {isVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isVerifying ? 'Verifying...' : 'Enter Test'}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter>
          <Button variant="link" onClick={() => router.back()} className="text-sm text-muted-foreground mx-auto">
             <ArrowLeft className="mr-1 h-3 w-3" /> Cancel and go back
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
