
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input'; // Added Input
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, AlertCircle, KeyRound, Loader2 } from 'lucide-react'; // Added KeyRound, Loader2
import { Routes } from '@/lib/constants';
import { useEffect, useState, useCallback, FormEvent } from 'react'; // Added FormEvent
import pb from '@/lib/pocketbase';
import type { RecordModel } from 'pocketbase';
import { useToast } from '@/hooks/use-toast'; // Added useToast
import { Skeleton } from '@/components/ui/skeleton'; // Added Skeleton

interface TeacherTestRecord extends RecordModel {
  testName: string;
  status: 'Draft' | 'Published' | 'Archived';
  Admin_Password?: string;
  // Add other relevant fields if needed
}

const TEST_PIN_SESSION_KEY_PREFIX = "testPinVerified_";

export default function TestInstructionsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast(); // Initialize toast
  const testId = typeof params.testId === 'string' ? params.testId : '';

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testDetails, setTestDetails] = useState<TeacherTestRecord | null>(null);
  const [showPinInput, setShowPinInput] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);

  const fetchTestDetails = useCallback(async (isMountedGetter: () => boolean) => {
    if (!testId) {
      if (isMountedGetter()) { setError("Test ID is missing."); setIsLoading(false); }
      return;
    }
    if (isMountedGetter()) setIsLoading(true);
    try {
      const record = await pb.collection('teacher_tests').getOne<TeacherTestRecord>(testId, {
        fields: 'id,testName,status,Admin_Password' // Fetch only necessary fields
      });
      if (isMountedGetter()) {
        setTestDetails(record);
        if (record.status !== 'Published') {
          setError("This test is not currently available or published by the teacher.");
        } else if (record.Admin_Password) {
          // Check session storage if PIN was already verified for this test
          const sessionPinVerified = sessionStorage.getItem(`${TEST_PIN_SESSION_KEY_PREFIX}${testId}`);
          if (sessionPinVerified === 'true') {
            setPinVerified(true);
            setShowPinInput(false);
          } else {
            setShowPinInput(true);
          }
        } else {
          // No PIN required, proceed to instructions
          setPinVerified(true);
          setShowPinInput(false);
        }
      }
    } catch (err: any) {
      if (isMountedGetter()) {
        if (err.isAbort || (err.name === 'ClientResponseError' && err.status === 0)) {
            console.warn('TestInstructionsPage: Fetch test details request was cancelled.');
        } else {
            console.error("TestInstructionsPage: Failed to fetch test details:", err.data || err);
            setError(err.status === 404 ? "Test not found." : `Could not load test details: ${err.data?.message || err.message}`);
        }
      }
    } finally {
      if (isMountedGetter()) setIsLoading(false);
    }
  }, [testId]);

  useEffect(() => {
    let isMounted = true;
    fetchTestDetails(() => isMounted);
    return () => { isMounted = false; };
  }, [fetchTestDetails]);


  const handlePinSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!testDetails || !testDetails.Admin_Password) return;
    setIsVerifyingPin(true);
    if (String(pinValue) === String(testDetails.Admin_Password)) {
      setPinVerified(true);
      setShowPinInput(false);
      sessionStorage.setItem(`${TEST_PIN_SESSION_KEY_PREFIX}${testId}`, 'true'); // Mark as verified for this session
      toast({ title: "PIN Verified", description: "You can now proceed to the test." });
    } else {
      toast({ title: "Incorrect PIN", description: "The PIN you entered is incorrect. Please try again.", variant: "destructive" });
    }
    setIsVerifyingPin(false);
  };

  const handleReadyToBegin = () => {
    if (testId && pinVerified && testDetails?.status === 'Published') {
      router.push(Routes.studentTestChapterwise(testId));
    } else if (testDetails?.status !== 'Published') {
        toast({ title: "Test Not Available", description: "This test is not currently published.", variant: "destructive" });
    } else if (!pinVerified && testDetails?.Admin_Password) {
        toast({ title: "PIN Required", description: "Please enter the correct PIN to access the test.", variant: "destructive" });
        setShowPinInput(true);
    } else {
      toast({ title: "Error", description: "Cannot start the test due to missing information or invalid state.", variant: "destructive" });
    }
  };

  const instructionSymbolClasses = "inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white rounded-sm mr-2 align-middle";

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen p-4 md:p-8 items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading test instructions...</p>
      </div>
    );
  }

  if (error) {
     return (
      <div className="flex flex-col min-h-screen p-4 md:p-8 items-center justify-center">
        <Card className="w-full max-w-lg text-center shadow-xl">
          <CardHeader><AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" /><CardTitle className="text-destructive">Error</CardTitle></CardHeader>
          <CardContent><p className="text-muted-foreground">{error}</p></CardContent>
          <CardFooter><Button onClick={() => router.push(Routes.testSeries)} variant="outline">Back to Test Series</Button></CardFooter>
        </Card>
      </div>
    );
  }
  
  if (showPinInput && !pinVerified) {
    return (
      <div className="flex flex-col min-h-screen p-4 md:p-8 items-center justify-center">
        <Card className="w-full max-w-sm shadow-xl">
          <CardHeader className="text-center">
            <KeyRound className="mx-auto h-10 w-10 text-primary mb-3" />
            <CardTitle className="text-2xl">Enter Test PIN</CardTitle>
            <CardDescription>This test requires a PIN provided by your teacher.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <Input
                type="password"
                value={pinValue}
                onChange={(e) => setPinValue(e.target.value)}
                placeholder="Enter PIN"
                disabled={isVerifyingPin}
              />
              <Button type="submit" className="w-full" disabled={isVerifyingPin || !pinValue.trim()}>
                {isVerifyingPin && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify PIN
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="flex flex-col min-h-screen bg-slate-100 dark:bg-slate-950 p-4 md:p-8 items-center justify-center">
      <Card className="w-full max-w-4xl shadow-2xl rounded-lg">
        <CardHeader className="text-center border-b pb-4">
          <CardTitle className="text-3xl font-bold text-foreground">Instructions for: {testDetails?.testName || "Test"}</CardTitle>
          <CardDescription className="text-md text-muted-foreground mt-1">
            Please read the instructions carefully before starting the test.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(80vh-180px)] md:h-[calc(70vh-160px)]">
            <div className="p-6 prose prose-sm sm:prose-base dark:prose-invert max-w-none text-foreground">
              <h3 className="text-lg font-semibold text-foreground mb-2">General Instructions:</h3>
              <ol className="list-decimal space-y-3 pl-5 text-muted-foreground">
                <li>
                  The following instructions are specific to this mock test.
                </li>
                <li>
                  The clock will be set at the server. The countdown timer in the top right corner of screen will display the remaining time available for you to complete the examination. When the timer reaches zero, the examination will end by itself. You will not be required to end or submit your examination.
                </li>
                <li>
                  The Question Palette displayed on the right side of screen will show the status of each question using one of the following symbols:
                  <ul className="list-none space-y-2 pl-2 mt-2">
                    <li className="flex items-center">
                      <span className={`${instructionSymbolClasses} bg-gray-400 dark:bg-gray-600`}>1</span>
                      <strong className="text-foreground/90 mr-1">"Not Visited"</strong> - You have not visited the question yet.
                    </li>
                    <li className="flex items-center">
                      <span className={`${instructionSymbolClasses} bg-red-500 dark:bg-red-600`}>2</span>
                      <strong className="text-foreground/90 mr-1">"Not Answered"</strong> - You have not answered the question.
                    </li>
                    <li className="flex items-center">
                      <span className={`${instructionSymbolClasses} bg-green-500 dark:bg-green-600`}>3</span>
                      <strong className="text-foreground/90 mr-1">"Answered"</strong> - You have answered the question.
                    </li>
                    <li className="flex items-center">
                      <span className={`${instructionSymbolClasses} bg-purple-500 dark:bg-purple-600`}>4</span>
                      <strong className="text-foreground/90 mr-1">"Marked for Review"</strong> - You have NOT answered the question, but have marked the question for review.
                    </li>
                    <li className="flex items-center">
                      <span className={`${instructionSymbolClasses} bg-orange-500 dark:bg-orange-600 relative flex items-center justify-center`}>
                        5
                        <Check className="absolute h-3 w-3 text-white" style={{ top: '1px', right: '1px' }} />
                      </span>
                      <strong className="text-foreground/90 mr-1">"Answered and Marked for Review"</strong> - The question(s) "Answered and Marked for Review" will be considered for evaluation.
                    </li>
                  </ul>
                  <p className="mt-2 text-xs">
                    The Marked for Review status for a question simply indicates that you would like to look at that question again.
                  </p>
                </li>
                <li>
                  You can click on your "Profile" image on top right corner of your screen to change the language during the exam for entire question paper. (This feature might not be available in all tests).
                </li>
              </ol>
            </div>
          </ScrollArea>
        </CardContent>
        <CardFooter className="p-6 border-t justify-center">
          <Button onClick={handleReadyToBegin} size="lg" className="px-10 py-6 text-base bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all" disabled={!pinVerified || isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : "I am ready to Begin"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

    