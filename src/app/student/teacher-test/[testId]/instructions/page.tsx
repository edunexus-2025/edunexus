
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check } from 'lucide-react';
import { Routes } from '@/lib/constants';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';

export default function TeacherTestInstructionsPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const testId = typeof params.testId === 'string' ? params.testId : '';
  const [isValidated, setIsValidated] = useState(false);
  const [isLoadingValidation, setIsLoadingValidation] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace(Routes.login + `?redirect=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      const pinVerified = sessionStorage.getItem(`pin_verified_${testId}`);
      if (pinVerified === 'true') {
        setIsValidated(true);
      } else {
        // If PIN not verified, redirect back to PIN entry or an error page
        toast({ title: "Access Denied", description: "Please enter the PIN first.", variant: "destructive"});
        router.replace(Routes.studentTeacherTestPin(testId));
      }
      setIsLoadingValidation(false);
    }
  }, [testId, router, user, authLoading]);

  const handleReadyToBegin = () => {
    if (testId && isValidated) {
      router.push(Routes.studentTeacherTestAttempt(testId));
    } else {
      console.error("Test ID or validation missing, cannot start test.");
      // Optionally show a toast or redirect
    }
  };

  const instructionSymbolClasses = "inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white rounded-sm mr-2 align-middle";

  if (isLoadingValidation || authLoading) {
    return (
        <div className="flex flex-col min-h-screen items-center justify-center p-4">
            <Card className="w-full max-w-4xl shadow-2xl rounded-lg">
                <CardHeader className="text-center border-b pb-4">
                    <Skeleton className="h-10 w-1/2 mx-auto" />
                    <Skeleton className="h-6 w-3/4 mx-auto mt-2" />
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-[calc(80vh-180px)] md:h-[calc(70vh-160px)]">
                        <div className="p-6 space-y-4">
                            <Skeleton className="h-6 w-1/3" />
                            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
                        </div>
                    </ScrollArea>
                </CardContent>
                <CardFooter className="p-6 border-t justify-center">
                    <Skeleton className="h-12 w-48" />
                </CardFooter>
            </Card>
        </div>
    );
  }

  if (!isValidated && !isLoadingValidation) {
      return (
          <div className="flex flex-col min-h-screen items-center justify-center p-4">
              <p>Redirecting to PIN entry...</p>
          </div>
      );
  }


  return (
    <div className="flex flex-col min-h-screen bg-slate-100 dark:bg-slate-950 p-4 md:p-8 items-center justify-center">
      <Card className="w-full max-w-4xl shadow-2xl rounded-lg">
        <CardHeader className="text-center border-b pb-4">
          <CardTitle className="text-3xl font-bold text-foreground">Test Instructions</CardTitle>
          <CardDescription className="text-md text-muted-foreground mt-1">
            Please read these instructions carefully before starting the test.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(80vh-180px)] md:h-[calc(70vh-160px)]">
            <div className="p-6 prose prose-sm sm:prose-base dark:prose-invert max-w-none text-foreground">
              <h3 className="text-lg font-semibold text-foreground mb-2">General Instructions:</h3>
              <ol className="list-decimal space-y-3 pl-5 text-muted-foreground">
                <li>
                  The clock will be set at the server. The countdown timer will display the remaining time.
                </li>
                <li>
                  When the timer reaches zero, the examination will end by itself.
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
                      <strong className="text-foreground/90 mr-1">"Marked for Review"</strong> - You have NOT answered, but marked for review.
                    </li>
                    <li className="flex items-center">
                      <span className={`${instructionSymbolClasses} bg-purple-500 dark:bg-purple-600 relative flex items-center justify-center`}>
                        5
                        <Check className="absolute h-3 w-3 text-green-300" style={{ top: '1px', right: '1px' }} />
                      </span>
                      <strong className="text-foreground/90 mr-1">"Answered and Marked for Review"</strong> - Will be considered for evaluation.
                    </li>
                  </ul>
                </li>
                <li>
                  Click on your "Profile" image on top right corner to change language (if available).
                </li>
                <li>
                  Click "Save & Next" to save your answer and move to the next question. Click "Mark for Review & Next" to mark for review.
                </li>
                 <li>
                  You can navigate between questions using the question palette.
                </li>
              </ol>
            </div>
          </ScrollArea>
        </CardContent>
        <CardFooter className="p-6 border-t justify-center">
          <Button onClick={handleReadyToBegin} size="lg" className="px-10 py-6 text-base bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all">
            I am ready to Begin
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
    