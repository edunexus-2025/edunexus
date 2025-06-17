
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check } from 'lucide-react';
import { Routes } from '@/lib/constants';

export default function TestInstructionsPage() {
  const params = useParams();
  const router = useRouter();
  const testId = typeof params.testId === 'string' ? params.testId : '';

  const handleReadyToBegin = () => {
    if (testId) {
      // Navigate to the chapterwise test page
      router.push(`/student/test/${testId}/chapterwise`);
    } else {
      // Fallback or error handling if testId is not available
      console.error("Test ID is missing, cannot start test.");
      router.push(Routes.dashboard); // Or show an error
    }
  };

  const instructionSymbolClasses = "inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white rounded-sm mr-2 align-middle";

  return (
    <div className="flex flex-col min-h-screen bg-slate-100 dark:bg-slate-950 p-4 md:p-8 items-center justify-center">
      <Card className="w-full max-w-4xl shadow-2xl rounded-lg">
        <CardHeader className="text-center border-b pb-4">
          <CardTitle className="text-3xl font-bold text-foreground">Instructions</CardTitle>
          <CardDescription className="text-md text-muted-foreground mt-1">
            Please read the instructions carefully
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(80vh-180px)] md:h-[calc(70vh-160px)]">
            <div className="p-6 prose prose-sm sm:prose-base dark:prose-invert max-w-none text-foreground">
              <h3 className="text-lg font-semibold text-foreground mb-2">General Instructions:</h3>
              <ol className="list-decimal space-y-3 pl-5 text-muted-foreground">
                <li>
                  The following instructions are specific to the mock test. Please read the instructions carefully in the actual exam before proceeding to test app.
                </li>
                <li>
                  The clock will be set at the server. The countdown timer in the top right corner of screen will display the remaining time available for you to complete the examination. When the timer reaches zero, the examination will end by itself. You will not be required to end or submit your examination.
                </li>
                <li>
                  In case of disconnection, your test will be active for 20 mins from last activity on the test app.
                </li>
                <li>
                  An active test can be resumed any time through the "Take Test" option.
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
                      <span className={`${instructionSymbolClasses} bg-purple-500 dark:bg-purple-600 relative flex items-center justify-center`}>
                        5
                        <Check className="absolute h-3 w-3 text-green-300" style={{ top: '1px', right: '1px' }} />
                      </span>
                      <strong className="text-foreground/90 mr-1">"Answered and Marked for Review"</strong> - The question(s) "Answered and Marked for Review" will be considered for evaluation.
                    </li>
                  </ul>
                  <p className="mt-2 text-xs">
                    The Marked for Review status for a question simply indicates that you would like to look at that question again.
                  </p>
                </li>
                <li>
                  You can click on the "&gt;" arrow which appears to the left of question palette to collapse the question palette thereby maximizing the question window. To view the question palette again, you can click on "&lt;" which appears on the right side of question window.
                </li>
                <li>
                  You can click on your "Profile" image on top right corner of your screen to change the language during the exam for entire question paper. On clicking of Profile image you will get a drop-down to change the question content to the desired language.
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
