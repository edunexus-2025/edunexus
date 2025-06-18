
'use client';

import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError as PocketBaseClientResponseError } from 'pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter as RadixAlertDialogFooter, AlertDialogHeader as RadixAlertDialogHeader, AlertDialogTitle as RadixAlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader as ShadcnSheetHeader, SheetTitle as ShadcnSheetTitle, SheetDescription as ShadcnSheetDescription, SheetTrigger, SheetClose, SheetFooter as ShadcnSheetFooter } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Clock, Flag, Image as ImageIconLucide, Loader2, Minimize, Send, XCircle, ArrowLeft as BackArrowIcon, Settings as SettingsIcon, Bookmark as BookmarkIconLucide, Check, PlusCircle, Info, ListOrdered, UserCircle as UserCircleIcon, CalendarDays, NotebookText, BarChart, PieChart as PieChartIcon, UserCheck, ListChecks, Eye, X as CloseIcon, MoreVertical, Menu, PanelRightOpen, KeyRound, Lock } from 'lucide-react';
import NextImage from 'next/image';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { AppConfig, Routes, escapeForPbFilter } from '@/lib/constants';
import { AppLogo } from '@/components/layout/AppLogo';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { StudentBookmark, User } from '@/lib/types';
import Link from 'next/link';
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';


interface TeacherTestRecord extends RecordModel {
  id: string;
  testName: string;
  Admin_Password?: string; // Made optional for initial fetch, will be validated
  duration?: string; // Assuming duration is stored as string of minutes
  teacherId: string; // Added to store teacher ID for saving results
  QBExam: string; // Added for fetching questions
  model: "Chapterwise" | "Full Length";
  // Other fields from teacher_tests collection...
}

interface QuestionRecord extends RecordModel {
  id: string;
  QuestionText?: string;
  QuestionImage?: string | null;
  OptionAText?: string;
  OptionAImage?: string | null;
  OptionBText?: string;
  OptionBImage?: string | null;
  OptionCText?: string;
  OptionCImage?: string | null;
  OptionDText?: string;
  OptionDImage?: string | null;
  CorrectOption?: "Option A" | "Option B" | "Option C" | "Option D";
  explanationText?: string;
  explanationImage?: string | null;
  marks?: number; // Assuming marks are per question
  subject?: string; // For display in question palette if needed
  // Fields needed for getPbFileUrl
  collectionId?: string;
  collectionName?: string;
}

interface UserAnswer {
  questionId: string;
  selectedOption: string | null;
  isCorrect: boolean | null; // Will be null until checked if we implement checking during test
  markedForReview: boolean;
  timeSpentSeconds: number;
}

const getPbFileUrl = (record: RecordModel | null | undefined, fieldName: string): string | null => {
  if (record && record[fieldName] && record.collectionId && record.collectionName && typeof record[fieldName] === 'string') {
    try {
      return pb.files.getUrl(record, record[fieldName] as string);
    } catch (e) {
      console.warn(\`Error getting URL for \${fieldName} in record \${record.id}:\`, e);
      return null;
    }
  }
  return null;
};


export default function StudentTeacherTestPage() {
  const params = useParams();
  const router = useRouter();
  const testId = typeof params.testId === 'string' ? params.testId : '';

  const { user, isLoading: isAuthLoading, authRefresh } = useAuth();
  const { toast } = useToast();

  const [testDetails, setTestDetails] = useState<TeacherTestRecord | null>(null);
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, UserAnswer>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testSessionState, setTestSessionState] = useState<'pinEntry' | 'instructions' | 'inProgress' | 'completed' | 'terminated'>('pinEntry');
  const [isSubmittingTest, setIsSubmittingTest] = useState(false);
  
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  const currentQuestion = questions[currentQuestionIndex];
  const questionStartTimeRef = useRef<number>(Date.now());
  const todayDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTestAndPrepareQuestions = useCallback(async (isMountedGetter: () => boolean) => {
    if (!testId || !user?.id) {
      if (isMountedGetter()) { setError("Test ID or User ID missing."); setIsLoadingPage(false); }
      return;
    }
    if (isMountedGetter()) setIsLoadingPage(true);

    try {
      const fetchedTestDetails = await pb.collection('teacher_tests').getOne<TeacherTestRecord>(testId, {
          fields: 'id,testName,Admin_Password,duration,teacherId,QBExam,model,questions,expand.questions', // Expand questions directly if relation is to question_bank
          expand: 'questions' // This attempts to expand the 'questions' relation field
      });
      if (!isMountedGetter()) return;
      
      if (!fetchedTestDetails.Admin_Password) {
        if(isMountedGetter()) { setError("This test is not properly configured (missing PIN). Cannot proceed."); setIsLoadingPage(false); }
        return;
      }
      setTestDetails(fetchedTestDetails);

      // If 'questions' is a relation and expanded, PocketBase returns them in expand.questions
      // The 'teacher_tests' schema from previous turn shows 'questions' as a relation to 'question_bank'
      // So, let's try to use that first.
      let fetchedQuestionsFromDb: QuestionRecord[] = [];
      if (fetchedTestDetails.expand?.questions && Array.isArray(fetchedTestDetails.expand.questions)) {
          fetchedQuestionsFromDb = fetchedTestDetails.expand.questions.map((q: RecordModel) => ({
              ...q,
              // Map fields if 'question_bank' schema differs from 'teacher_question_data' if needed
              // For now, assuming they are compatible enough for display
          })) as QuestionRecord[];
          console.log("StudentTeacherTestPage: Fetched questions via expand:", fetchedQuestionsFromDb.length);
      } else if (Array.isArray(fetchedTestDetails.questions) && fetchedTestDetails.questions.length > 0 && typeof fetchedTestDetails.questions[0] === 'string') {
          // If 'questions' is an array of IDs, fetch them
          console.log("StudentTeacherTestPage: 'questions' field is an array of IDs. Fetching individually...", fetchedTestDetails.questions);
          const questionRecordsPromises = fetchedTestDetails.questions.map((id: string) =>
              pb.collection('question_bank').getOne<QuestionRecord>(id, { '$autoCancel': false })
                .catch(err => {
                    console.warn(`Failed to fetch question ${id} from question_bank, trying teacher_question_data:`, err.data);
                    return pb.collection('teacher_question_data').getOne<QuestionRecord>(id, { '$autoCancel': false })
                        .catch(addQErr => {
                            console.error(`Failed to fetch question ${id} from both:`, addQErr.data);
                            return null;
                        });
                })
          );
          fetchedQuestionsFromDb = (await Promise.all(questionRecordsPromises)).filter(q => q !== null) as QuestionRecord[];
          console.log("StudentTeacherTestPage: Fetched questions individually:", fetchedQuestionsFromDb.length);
      } else {
          // Fallback: fetch from teacher_question_data if no questions from relation
          const questionFilter = `LessonName = "${escapeForPbFilter(fetchedTestDetails.testName)}" && QBExam = "${escapeForPbFilter(fetchedTestDetails.QBExam)}" && teacher = "${escapeForPbFilter(fetchedTestDetails.teacherId)}"`;
          console.log("StudentTeacherTestPage: Fetching questions from 'teacher_question_data' with filter:", questionFilter);
          fetchedQuestionsFromDb = await pb.collection('teacher_question_data').getFullList<QuestionRecord>({ filter: questionFilter, sort: 'created' });
          console.log("StudentTeacherTestPage: Fetched questions from teacher_question_data:", fetchedQuestionsFromDb.length);
      }


      const questionsWithUrls = fetchedQuestionsFromDb.map(q => ({
        ...q,
        displayQuestionImageUrl: getPbFileUrl(q, 'QuestionImage'),
        displayOptionAImageUrl: getPbFileUrl(q, 'OptionAImage'),
        displayOptionBImageUrl: getPbFileUrl(q, 'OptionBImage'),
        displayOptionCImageUrl: getPbFileUrl(q, 'OptionCImage'),
        displayOptionDImageUrl: getPbFileUrl(q, 'OptionDImage'),
        displayExplanationImageUrl: getPbFileUrl(q, 'explanationImage'),
      }));
      
      if (isMountedGetter()) {
        if (questionsWithUrls.length === 0) {
          setError("No questions are currently available for this test. Please contact the teacher.");
          setQuestions([]);
        } else {
          setQuestions(questionsWithUrls);
          const initialAnswers: Record<string, UserAnswer> = {};
          questionsWithUrls.forEach(q => {
            initialAnswers[q.id] = { questionId: q.id, selectedOption: null, isCorrect: null, markedForReview: false, timeSpentSeconds: 0 };
          });
          setUserAnswers(initialAnswers);
        }
      }
    } catch (err: any) {
      if (isMountedGetter()) {
        console.error("Error in fetchTestAndPrepareQuestions:", err);
        let errorMsg = `Could not load test. Error: ${err.data?.message || err.message}.`;
        if (err.status === 404) errorMsg = "Test not found or not accessible.";
        setError(errorMsg);
      }
    } finally {
      if (isMountedGetter()) setIsLoadingPage(false);
    }
  }, [testId, user?.id, escapeForPbFilter]);

  useEffect(() => {
    let isMounted = true;
    if (!isAuthLoading && testId && user?.id) {
      fetchTestAndPrepareQuestions(() => isMounted);
    } else if (!isAuthLoading && !user?.id) {
      if(isMounted) { setIsLoadingPage(false); setError("Please login to take this test."); }
    }
    return () => { isMounted = false; };
  }, [testId, user?.id, isAuthLoading, fetchTestAndPrepareQuestions]);

  useEffect(() => {
    if (testSessionState === 'inProgress' && timeLeft !== null && timeLeft > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else if (timeLeft === 0 && testSessionState === 'in_progress') {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      handleSubmitTest(true, "time_up");
    }
    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, [testSessionState, timeLeft]); // Removed handleSubmitTest from deps to avoid re-triggering

  const handlePinVerify = async () => {
    if (!testDetails || !testDetails.Admin_Password) { setPinError("Test details or PIN not loaded."); return; }
    setIsVerifyingPin(true); setPinError(null);
    if (enteredPin === String(testDetails.Admin_Password)) {
      toast({ title: "PIN Verified!", description: "Loading test instructions..." });
      setTestSessionState('instructions');
    } else {
      setPinError("Invalid PIN. Please try again.");
    }
    setIsVerifyingPin(false);
  };

  const handleStartTestAfterInstructions = () => {
    if (!testDetails || questions.length === 0) {
      toast({ title: "Error", description: "Cannot start test. Details or questions missing.", variant: "destructive" });
      return;
    }
    const durationMinutes = parseInt(testDetails.duration || "0", 10);
    setTimeLeft(durationMinutes > 0 ? durationMinutes * 60 : 3600); // Default 1hr if invalid
    setTestSessionState('inProgress');
    questionStartTimeRef.current = Date.now();
  };
  
  const handleSubmitTest = useCallback(async (autoSubmit = false, terminationReason?: string) => {
    if (!user || !testDetails || isSubmittingTest || testSessionState === 'completed' || testSessionState === 'terminated') return;
    setIsSubmittingTest(true);
    if(currentQuestion && userAnswers[currentQuestion.id] && questionStartTimeRef.current && testSessionState === 'inProgress') {
        const currentTime = Date.now();
        const timeSpentCurrentQuestion = Math.round((currentTime - questionStartTimeRef.current) / 1000);
        userAnswers[currentQuestion.id].timeSpentSeconds = (userAnswers[currentQuestion.id].timeSpentSeconds || 0) + timeSpentCurrentQuestion;
    }
    let correctCount = 0; let attemptedCount = 0; let pointsEarnedFromTest = 0;
    const answersLogForDb = questions.map(q => {
      const userAnswerRec = userAnswers[q.id]; const selected = userAnswerRec?.selectedOption || null; let isCorrectAns = false;
      const correctOptionValue = q.CorrectOption?.replace("Option ", "");
      if (selected) {
        attemptedCount++;
        if (selected === `Option ${correctOptionValue}`) { correctCount++; isCorrectAns = true; pointsEarnedFromTest += (q.marks || 1); }
      }
      return { questionId: q.id, selectedOption: selected, correctOption: correctOptionValue ? `Option ${correctOptionValue}` : null, isCorrect: isCorrectAns, markedForReview: userAnswerRec?.markedForReview || false, timeSpentSeconds: userAnswerRec?.timeSpentSeconds || 0 };
    });
    const maxScore = questions.reduce((sum, q) => sum + (q.marks || 1), 0);
    const percentage = maxScore > 0 ? (pointsEarnedFromTest / maxScore) * 100 : 0;
    const finalTestStatusString: 'completed' | 'terminated_time_up' | 'terminated_manual' = terminationReason === 'time_up' ? 'terminated_time_up' : (terminationReason === 'manual' ? 'terminated_manual' : 'completed');
    const durationTaken = testDetails?.duration ? parseInt(testDetails.duration, 10) * 60 - (timeLeft || 0) : 0;
    
    const resultData = {
      student: user.id, test_taken: testDetails.id, test_name_cache: testDetails.testName, teacher_id_cache: testDetails.teacherId,
      start_time: new Date(Date.now() - durationTaken * 1000).toISOString(), end_time: new Date().toISOString(),
      duration_taken_seconds: durationTaken, total_questions: questions.length, attempted_questions: attemptedCount,
      correct_answers: correctCount, incorrect_answers: attemptedCount - correctCount, unattempted_questions: questions.length - attemptedCount,
      score_obtained: pointsEarnedFromTest, max_score_possible: maxScore, percentage: parseFloat(percentage.toFixed(2)),
      answers_log: JSON.stringify(answersLogForDb), status: finalTestStatusString,
      marked_for_review_not_answered: answersLogForDb.filter(a => a.markedForReview && !a.selectedOption).length,
      marked_for_review_answered: answersLogForDb.filter(a => a.markedForReview && a.selectedOption).length,
    };
    try {
      const createdResultRecord = await pb.collection('teacher_test_student_history').create(resultData);
      setTestSessionState(finalTestStatusString === 'completed' ? 'completed' : 'terminated');
      setTimeLeft(0); toast({ title: autoSubmit ? (terminationReason ? "Test Terminated" : "Test Auto-Submitted") : "Test Submitted Successfully!", description: `Your results have been recorded. ${terminationReason ? `Reason: ${terminationReason.replace(/_/g, ' ')}.` : ''}` });
      // For now, no direct navigation to result page for teacher tests from here. Student checks "My Progress" or teacher shares.
      // router.push(Routes.testResult(createdResultRecord.id)); // This would be for chapterwise, need new route for teacher test results
      toast({ title: "Test Complete", description: "Your results are saved. You can check 'My Progress' later." });
    } catch (err: any) { console.error("Failed to submit teacher test results:", err); toast({ title: "Submission Failed", description: `Could not save your results. Error: ${err.data?.message || err.message}`, variant: "destructive" }); }
    finally { setIsSubmittingTest(false); }
  }, [user, testDetails, questions, userAnswers, timeLeft, router, toast, isSubmittingTest, testSessionState, currentQuestion, authRefresh]);

  const handleOptionChange = (value: string) => { if (testSessionState !== 'inProgress') return; setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...(prev[currentQuestion.id] || { questionId: currentQuestion.id, timeSpentSeconds: 0, markedForReview: false }), selectedOption: value, isCorrect: null, }})); };
  const handleClearResponse = () => { if (testSessionState !== 'inProgress') return; setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...(prev[currentQuestion.id] || { questionId: currentQuestion.id, timeSpentSeconds: 0 }), selectedOption: null, isCorrect: null, }})); };
  const handleMarkForReview = () => { if (testSessionState !== 'inProgress') return; setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...(prev[currentQuestion.id] || { questionId: currentQuestion.id, selectedOption: null, isCorrect: null, timeSpentSeconds: 0 }), markedForReview: !prev[currentQuestion.id]?.markedForReview, }})); };
  const navigateQuestion = (directionOrIndex: 'next' | 'prev' | number) => {
    if (testSessionState !== 'inProgress') return;
    if (currentQuestion && userAnswers[currentQuestion.id] && questionStartTimeRef.current) {
      const currentTime = Date.now();
      const timeSpentCurrentQuestion = Math.round((currentTime - questionStartTimeRef.current) / 1000);
      setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...prev[currentQuestion.id], timeSpentSeconds: (prev[currentQuestion.id].timeSpentSeconds || 0) + timeSpentCurrentQuestion }}));
    }
    let newIndex = currentQuestionIndex;
    if (directionOrIndex === 'next') newIndex = Math.min(questions.length - 1, currentQuestionIndex + 1);
    else if (directionOrIndex === 'prev') newIndex = Math.max(0, currentQuestionIndex - 1);
    else if (typeof directionOrIndex === 'number') newIndex = Math.max(0, Math.min(questions.length - 1, directionOrIndex));
    setCurrentQuestionIndex(newIndex); questionStartTimeRef.current = Date.now();
  };
  const handleSaveAndNext = () => navigateQuestion('next');

  const renderLatex = (text: string | undefined | null): React.ReactNode => { /* ... (same as chapterwise) ... */ return text; };
  const renderOption = (optionKey: "A" | "B" | "C" | "D"): React.ReactNode => {
    if (!currentQuestion) return null;
    const textKey = `Option${optionKey}Text` as keyof QuestionRecord;
    const imageKey = `Option${optionKey}Image` as keyof QuestionRecord;
    const optionText = currentQuestion[textKey];
    const imageUrl = getPbFileUrl(currentQuestion, imageKey);
    const optionValue = `Option ${optionKey}`;
    return ( <Label htmlFor={`option-${currentQuestion.id}-${optionKey}`} className={cn("flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-all hover:shadow-md", userAnswers[currentQuestion.id]?.selectedOption === optionValue ? 'bg-primary/10 border-primary ring-1 ring-primary' : 'bg-card border-border hover:border-primary/50')}> <RadioGroupItem value={optionValue} id={`option-${currentQuestion.id}-${optionKey}`} className="mt-1 border-muted-foreground data-[state=checked]:border-primary shrink-0" /> <div className="flex-1 text-sm"> <div className="font-semibold">{optionKey}.</div> {optionText && <div className="prose prose-sm dark:prose-invert max-w-none mt-0.5">{renderLatex(optionText as string)}</div>} {imageUrl && (<div className="mt-1.5"><NextImage src={imageUrl} alt={`Option ${optionKey}`} width={200} height={100} className="rounded object-contain border" data-ai-hint="option diagram"/></div>)} {!(optionText || imageUrl) && <p className="text-muted-foreground italic">Option {optionKey} content not available.</p>} </div> </Label> );
  };

  const formatTime = (seconds: number | null): string => { if (seconds === null || seconds < 0) seconds = 0; const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = seconds % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; };
  const getQuestionStatusForPalette = (questionId: string): 'answered' | 'notAnswered' | 'markedForReview' | 'markedAndAnswered' | 'notVisited' => { const answer = userAnswers[questionId]; if (!answer || (answer.selectedOption === null && !answer.markedForReview)) return 'notVisited'; if (answer.selectedOption) return answer.markedForReview ? 'markedAndAnswered' : 'answered'; else return answer.markedForReview ? 'markedForReview' : 'notAnswered'; };
  const questionPaletteButtonClass = (status: ReturnType<typeof getQuestionStatusForPalette>, isActive: boolean) => { if (isActive) return "bg-primary text-primary-foreground border-primary ring-2 ring-offset-1 ring-primary"; switch (status) { case 'answered': return "bg-green-500 hover:bg-green-600 text-white border-green-500"; case 'notAnswered': return "bg-red-500 hover:bg-red-600 text-white border-red-500"; case 'markedForReview': return "bg-purple-500 hover:bg-purple-600 text-white border-purple-500"; case 'markedAndAnswered': return "bg-orange-500 hover:bg-orange-600 text-white border-orange-500"; case 'notVisited': default: return "bg-card hover:bg-muted/80 text-muted-foreground border-border"; }};


  if (isLoadingPage || isAuthLoading) { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" /> <p className="text-lg">Loading test environment...</p> </div> ); }
  if (error) { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Card className="w-full max-w-lg text-center shadow-xl bg-background text-foreground"> <CardHeader> <AlertCircle className="mx-auto h-12 w-12 text-destructive" /> <CardTitle className="text-destructive">Error Loading Test</CardTitle> </CardHeader> <CardContent><p className="text-muted-foreground whitespace-pre-wrap">{error}</p></CardContent> <CardFooter><Button onClick={() => router.back()} variant="outline" className="w-full">Go Back</Button></CardFooter> </Card> </div> ); }
  
  if (testSessionState === 'pinEntry') {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 p-4">
        <Card className="w-full max-w-sm shadow-xl bg-card text-foreground">
          <CardHeader><CardTitle className="text-xl flex items-center gap-2"><KeyRound className="text-primary"/>Enter Test PIN</CardTitle><CardDescription>This test requires a PIN provided by {testDetails?.expand?.teacherId?.name || 'the teacher'}.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <Input type="password" placeholder="Enter PIN" value={enteredPin} onChange={(e) => setEnteredPin(e.target.value)} className="text-center text-lg tracking-widest" maxLength={6} autoFocus/>
            {pinError && <p className="text-sm text-destructive text-center">{pinError}</p>}
          </CardContent>
          <CardFooter className="flex-col gap-2">
            <Button onClick={handlePinVerify} className="w-full" disabled={isVerifyingPin || enteredPin.length < 4}> {isVerifyingPin && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Verify PIN & Continue </Button>
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-xs text-muted-foreground">Cancel & Go Back</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  if (testSessionState === 'instructions') {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 p-4">
        <Card className="w-full max-w-2xl shadow-xl bg-card text-foreground">
          <CardHeader><CardTitle className="text-2xl">Test Instructions: {testDetails?.testName}</CardTitle><CardDescription>Read carefully before starting.</CardDescription></CardHeader>
          <CardContent className="max-h-[60vh] overflow-y-auto prose prose-sm dark:prose-invert">
            <p>Total Questions: {questions.length}</p>
            <p>Duration: {testDetails?.duration || 'N/A'} minutes</p>
            <p>This test is conducted by: {testDetails?.expand?.teacherId?.name || 'Your Teacher'}.</p>
            <h4>General Instructions:</h4>
            <ol><li>The clock will be set at the server. The countdown timer in the top right corner of screen will display the remaining time.</li><li>When the timer reaches zero, the examination will end by itself.</li><li>The Question Palette on the right shows question status.</li></ol>
            {/* Add more relevant instructions */}
          </CardContent>
          <CardFooter className="justify-center">
            <Button onClick={handleStartTestAfterInstructions} size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">I'm Ready, Start Test!</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (testSessionState === 'completed' || testSessionState === 'terminated') { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Card className="w-full max-w-lg text-center shadow-xl bg-background text-foreground"> <CardHeader> {testSessionState === 'completed' ? <CheckCircle className="mx-auto h-12 w-12 text-green-500" /> : <XCircle className="mx-auto h-12 w-12 text-destructive" />} <CardTitle>{testSessionState === 'completed' ? "Test Completed" : "Test Terminated"}</CardTitle> </CardHeader> <CardContent><p className="text-muted-foreground">{testSessionState === 'completed' ? "Your responses have been submitted." : "This test session has been terminated."}</p></CardContent> <CardFooter> <Button onClick={() => router.push(Routes.dashboard)} className="w-full">Back to Dashboard</Button> </CardFooter> </Card> </div> ); }
  if (!currentQuestion && !isLoadingPage) { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Card className="w-full max-w-lg text-center shadow-xl bg-background text-foreground"> <CardHeader> <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" /> <CardTitle>No Questions</CardTitle> </CardHeader> <CardContent><p className="text-muted-foreground">No questions available for this test.</p></CardContent> <CardFooter><Button onClick={() => router.back()} variant="outline" className="w-full">Go Back</Button></CardFooter> </Card> </div> );}

  const QuestionPaletteContent = () => (
    <>
      <Card className="shadow-none border-0 md:border md:shadow-sm md:rounded-lg md:bg-card">
        <CardHeader className="p-3 border-b text-center">
          <UserCircleIcon className="mx-auto h-10 w-10 text-primary mb-1" />
          <CardTitle className="text-base">{user?.name || "Student"}</CardTitle>
          <CardDescription className="text-xs truncate">{user?.email}</CardDescription>
          <CardDescription className="text-xs">{todayDate}</CardDescription>
        </CardHeader>
      </Card>
      <Card className="border-primary/30 bg-primary/5 flex-1 flex flex-col min-h-0 shadow-md rounded-lg md:mt-3">
        <CardHeader className="p-2 text-center border-b border-primary/20"><CardTitle className="text-sm text-primary">QUESTION NAVIGATION</CardTitle></CardHeader>
        <CardContent className="p-2 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="grid grid-cols-5 sm:grid-cols-4 gap-1.5 p-1">{questions.map((q, index) => (<Button key={q.id} variant="outline" size="icon" className={cn("h-8 w-full text-xs rounded-md aspect-square", questionPaletteButtonClass(getQuestionStatusForPalette(q.id), currentQuestionIndex === index))} onClick={() => { navigateQuestion(index); if(isMobileSheetOpen) setIsMobileSheetOpen(false); }} disabled={testSessionState !== 'inProgress'}>{index + 1}{userAnswers[q.id]?.markedForReview && userAnswers[q.id]?.selectedOption && <Check className="absolute h-2.5 w-2.5 bottom-0.5 right-0.5 text-white" />}</Button>))}</div>
          </ScrollArea>
        </CardContent>
      </Card>
      <div className="p-3 border-t bg-card md:bg-transparent rounded-b-lg md:shadow-md mt-auto md:mt-3">
        <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" className="w-full text-sm py-2.5" disabled={testSessionState !== 'in_progress' || isSubmittingTest}><CloseIcon className="mr-1.5 h-4 w-4" /> Submit Test</Button></AlertDialogTrigger><AlertDialogContent><RadixAlertDialogHeader><RadixAlertDialogTitle>Confirm Submission</RadixAlertDialogTitle><RadixAlertDialogDescription>Are you sure you want to submit your test?</RadixAlertDialogDescription></RadixAlertDialogHeader><RadixAlertDialogFooter><AlertDialogCancel disabled={isSubmittingTest}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleSubmitTest(false, 'manual')} disabled={isSubmittingTest}>{isSubmittingTest && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Yes, Submit</AlertDialogAction></RadixAlertDialogFooter></AlertDialogContent></AlertDialog>
      </div>
    </>
  );


  return (
    <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-900">
      <header className="sticky top-0 z-50 bg-card shadow-md p-3 border-b border-border">
        <div className="flex justify-between items-center max-w-full px-2 sm:px-4">
          <div className="text-sm font-medium text-muted-foreground truncate max-w-[calc(33%-20px)] sm:max-w-xs" title={testDetails?.testName || 'Test'}>{testDetails?.testName || 'Test Name'}</div>
          <div className="flex-shrink-0"> <AppLogo mainTextSize="text-lg" taglineTextSize="text-[0px]" iconSize={22} /> </div>
          <div className="text-sm font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md shadow-sm flex items-center w-auto max-w-[calc(33%-20px)] sm:max-w-xs justify-end"><Clock className="h-4 w-4 mr-1.5 flex-shrink-0" /> <span className="truncate">{formatTime(timeLeft)}</span></div>
        </div>
      </header>
      <div className="sticky top-[var(--top-header-height,57px)] z-40 bg-background shadow-sm p-3 border-b border-border">
        <div className="flex justify-between items-center max-w-full px-2 sm:px-4">
          <div className="text-sm font-semibold text-foreground truncate max-w-[calc(50%-120px)] sm:max-w-md" title={currentQuestion?.subject || testDetails?.QBExam || 'Subject'}>SUBJECT: {currentQuestion?.subject || testDetails?.QBExam || 'N/A'}</div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}><SheetTrigger asChild><Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary h-7 w-7 md:hidden" aria-label="Open Question Navigation"><ListOrdered className="h-5 w-5" /></Button></SheetTrigger><SheetContent side="right" className="w-3/4 p-0 flex flex-col"><ShadcnSheetHeader className="p-3 border-b text-center"><ShadcnSheetTitle className="text-lg">Navigation</ShadcnSheetTitle><ShadcnSheetDescription>Jump to any question or submit.</ShadcnSheetDescription></ShadcnSheetHeader><QuestionPaletteContent /></SheetContent></Sheet>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary h-7 w-7 hidden md:inline-flex" onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)} aria-label={isRightSidebarOpen ? "Hide Question Panel" : "Show Question Panel"}><MoreVertical className="h-5 w-5" /></Button>
            <Button variant="ghost" size="icon" asChild className="text-muted-foreground hover:text-primary h-7 w-7"><Link href={Routes.studentTestInstructions(testId)} target="_blank"><Info className="h-4 w-4" /></Link></Button>
          </div>
        </div>
      </div>
      <div className={cn("flex-1 flex max-w-full p-2 sm:p-4 gap-2 sm:gap-4 overflow-hidden")}>
        <Card className="flex-1 flex flex-col bg-card shadow-xl rounded-lg border border-border overflow-hidden">
          <CardHeader className="p-3 sm:p-4 border-b border-border bg-muted/30"><div className="flex justify-between items-center"><p className="text-xs sm:text-sm font-medium text-muted-foreground">Question {currentQuestionIndex + 1} of {questions.length}</p></div></CardHeader>
          <ScrollArea className="flex-1 min-h-0"><CardContent className="p-3 sm:p-4 md:p-6 space-y-4">
            <div className="p-2 border-b border-border/50 rounded-md bg-background min-h-[80px]">
                {currentQuestion.QuestionText && (<div className="prose prose-sm dark:prose-invert max-w-none mb-3 text-foreground leading-relaxed">{renderLatex(currentQuestion.QuestionText)}</div>)}
                {getPbFileUrl(currentQuestion, 'QuestionImage') && (<div className="my-2 text-center"><NextImage src={getPbFileUrl(currentQuestion, 'QuestionImage')!} alt="Question Image" width={400} height={300} className="rounded object-contain inline-block border" data-ai-hint="question diagram"/></div>)}
                {!(currentQuestion.QuestionText || getPbFileUrl(currentQuestion, 'QuestionImage')) && (<p className="text-xs sm:text-sm text-muted-foreground italic py-3">Question content not provided.</p>)}
            </div>
            <RadioGroup value={userAnswers[currentQuestion.id]?.selectedOption || ""} onValueChange={handleOptionChange} className="space-y-2.5" disabled={testSessionState !== 'in_progress'}>{renderOption("A")} {renderOption("B")} {renderOption("C")} {renderOption("D")}</RadioGroup>
          </CardContent></ScrollArea>
          <CardFooter className="p-3 sm:p-4 border-t border-border bg-muted/30 flex-wrap justify-center sm:justify-between gap-2"><Button variant="outline" size="sm" onClick={handleClearResponse} disabled={testSessionState !== 'in_progress' || !userAnswers[currentQuestion.id]?.selectedOption}>Clear Response</Button><Button variant={userAnswers[currentQuestion.id]?.markedForReview ? "secondary" : "outline"} size="sm" onClick={handleMarkForReview} disabled={testSessionState !== 'in_progress'} className="border-purple-500 text-purple-600 data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-700 hover:bg-purple-500/10"><Flag className="mr-1.5 h-4 w-4" /> {userAnswers[currentQuestion.id]?.markedForReview ? "Unmark Review" : "Mark for Review"}</Button><Button size="sm" onClick={handleSaveAndNext} disabled={testSessionState !== 'in_progress' || currentQuestionIndex === questions.length - 1} className="bg-green-600 hover:bg-green-700 text-white">Save & Next <ChevronRight className="ml-1.5 h-4 w-4" /></Button></CardFooter>
        </Card>
        {isRightSidebarOpen && (<div className="hidden md:flex w-72 lg:w-80 flex-shrink-0 flex-col space-y-0"><QuestionPaletteContent /></div>)}
      </div>
    </div>
  );
}

```
  </change>
  <change>
    <file>/src/lib/constants.ts</file>
    <content><![CDATA[
import type { Plan, UserSubscriptionTierStudent, UserSubscriptionTierTeacher } from '@/lib/types';

export const AppConfig = {
  appName: 'EduNexus',
};

// Define APP_BASE_URL with a client-side fallback
export const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:9002');


export const Routes = {
  home: '/',
  login: '/login',
  signup: '/signup',
  forgotPassword: '/forgot-password',
  completeProfile: '/complete-profile',
  dashboard: '/dashboard',
  testSeries: '/dashboard/test-series',
  viewTestSeries: (testSeriesId: string) => `/dashboard/test-series/${testSeriesId}`,

  // DPP Routes
  dpp: '/dashboard/dpp',
  dppExamSubjects: (examSlug: string) => `/dashboard/dpp/${examSlug}`,
  dppExamSubjectLessons: (examSlug: string, subjectSlug: string) => `/dashboard/dpp/${examSlug}/${subjectSlug}`,
  dppExamSubjectLessonQuestions: (examSlug: string, subjectSlug: string, lessonSlug: string) => `/dashboard/dpp/${examSlug}/${subjectSlug}/${lessonSlug}`,
  dppAnalysis: function(examSlug: string, subjectSlug: string, lessonSlug: string) {
    return `/dashboard/dpp/analysis/${examSlug}/${subjectSlug}/${lessonSlug}`;
  },
  dppCombined: '/dashboard/dpp/combined',

  // PYQ Practice Routes (New Combined Route)
  pyqPractice: '/dashboard/pyq-practice',

  notebooks: '/dashboard/notebooks',
  viewNotebook: (notebookId: string) => `/dashboard/notebooks/${notebookId}`,
  myProgress: '/dashboard/my-progress',
  leaderboard: '/dashboard/leaderboard',
  upgrade: '/dashboard/upgrade',
  discussionForum: '/dashboard/discussion-forum',
  discussionForumGroup: (groupId: string) => `/dashboard/discussion-forum/${groupId}`,

  // Connect & Compete Routes
  createChallenge: '/dashboard/create-challenge',
  challengeLobby: (challengeId: string) => `/dashboard/challenge-lobby/${challengeId}`,
  challengeInvites: '/dashboard/challenge-invites',
  findFriends: '/dashboard/find-friends',
  connections: '/dashboard/connections',
  competeTest: (challengeId: string) => `/dashboard/compete/${challengeId}`,

  // User specific routes
  profile: '/dashboard/profile',
  settings: '/dashboard/settings',
  editProfile: '/dashboard/settings/edit-profile',
  changePassword: '/dashboard/settings/change-password',
  feedback: '/dashboard/settings/feedback',
  studyPlan: '/dashboard/study-plan',
  studentTeacherRanking: '/dashboard/teacher-ranking',
  myTeacherPortal: '/dashboard/my-teacher', 
  testResult: (resultId: string) => `/dashboard/test-results/chapterwise/${resultId}`,
  testResultCompete: (resultId: string) => `/dashboard/test-results/compete/${resultId}`,
  helpCenter: '/dashboard/help-center',
  termsOfService: '/terms-of-service',
  privacyPolicy: '/privacy-policy',
  cancellationPolicy: '/cancellation-policy',
  refundPolicy: '/refund-policy',
  contactUs: '/contact-us',
  activatePlan: (token: string, planSlug: string) => `/activate-plan/${token}/${planSlug}`,
  collegeCutoffs: '/college-cutoffs',
  ownerInfo: '/owner-info',
  paymentStatusPage: (orderId: string, status: 'success' | 'failure' | 'error' | 'info', planName?: string, message?: string) => {
    const params = new URLSearchParams();
    params.set('order_id', orderId);
    params.set('status', status);
    if (planName) params.set('planName', planName);
    if (message) params.set('message', message);
    return `/payment/status?${params.toString()}`;
  },


  // Student Test Taking Routes
  studentTestInstructions: (testId: string) => `/student/test/${testId}/instructions`,
  studentTestChapterwise: (testId: string) => `/student/test/${testId}/chapterwise`,
  studentTeacherTest: (testId: string) => `/student/teacher-test/${testId}`, // New route for teacher tests


  // Unified Question Bank view
  qbankView: (questionId: string) => `/dashboard/qbank/${questionId}`,

  // Admin Routes
  adminDashboard: '/admin/dashboard',
  adminUserManagement: '/admin/user-management',
  adminNotificationSender: '/admin/notification-sender',
  adminSiteSettings: '/admin/site-settings',
  adminQuestionBank: '/admin/question-bank',
  adminEditQuestion: '/admin/edit-question',
  adminAddQuestionJson: '/admin/add-question-json',
  adminCreateTest: '/admin/create-test',
  adminSyllabusOverview: '/admin/syllabus-overview',
  adminContentStructure: '/admin/content-structure',
  adminContentSyllabusManager: '/admin/content-syllabus-manager',
  adminCreateAds: '/admin/create-ads',
  adminManageReferrals: '/admin/manage-referrals',
  adminManageCollegeCutoffs: '/admin/manage-college-cutoffs',
  adminUploadCollegeCutoffs: '/admin/upload-college-cutoffs',

  // Teacher Routes
  teacherLogin: '/teacher/login',
  teacherSignup: '/teacher/signup',
  teacherDashboard: '/teacher/dashboard',
  teacherMyContent: '/teacher/dashboard/my-content',
  teacherManagePlans: '/teacher/dashboard/manage-plans',
  teacherViewPlan: (planId: string) => `/teacher/dashboard/manage-plans/${planId}`, 
  teacherUpgradePlatformPlan: '/teacher/dashboard/upgrade-plan', 
  teacherStudentPerformance: '/teacher/dashboard/student-performance',
  teacherSettings: '/teacher/dashboard/settings',
  teacherMyStudents: '/teacher/dashboard/my-students',
  teacherStudentGroups: '/teacher/dashboard/student-groups',
  teacherTestPanel: (testId: string) => `/teacher/dashboard/my-content/${testId}`,
  teacherTestPanelAddQuestion: (testId: string) => `/teacher/dashboard/my-content/${testId}/add-question`,
  teacherTestPanelViewQuestions: (testId: string) => `/teacher/dashboard/my-content/${testId}/view-questions`,
  teacherTestPanelSettings: (testId: string) => `/teacher/dashboard/my-content/${testId}/settings`,
  teacherTestPanelResults: (testId: string) => `/teacher/dashboard/my-content/${testId}/results`,
  teacherTestPanelStatus: (testId: string) => `/teacher/dashboard/my-content/${testId}/status`, 
  teacherRanking: '/teacher/dashboard/ranking',
  teacherPlan: '/teacher/dashboard/plan', 
  teacherCreateAds: '/teacher/dashboard/create-ads',
  teacherUpgradeAds: '/teacher/dashboard/upgrade-ads',
  teacherPublicAdPage: (edunexusName: string): string => `/t/${edunexusName}`,
  teacherPublicPlansPage: (edunexusName: string): string => `/teacher-plans/${edunexusName}`,
  teacherManageDiscussion: '/teacher/dashboard/manage-discussion',
  teacherWallet: '/teacher/dashboard/wallet',
  teacherManageReferrals: '/teacher/dashboard/manage-referrals',
};

// Helper to convert display names to URL-friendly slugs
export const slugify = (text: string): string => {
  if (!text) return '';
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
};

export const unslugify = (slug: string): string => {
  if (!slug) return '';
  // Replace hyphens with spaces, then capitalize each word
  return slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Helper to escape strings for PocketBase filter queries
export const escapeForPbFilter = (value: string | undefined | null): string => {
  if (!value) return '';
  // Escape single quotes by doubling them up, then double quotes by doubling them up.
  return value.replace(/'/g, "''").replace(/"/g, '""');
};

export const EXAM_SUBJECTS: Record<string, string[]> = {
  'jee-main': ['Physics', 'Chemistry', 'Mathematics'],
  'neet': ['Physics', 'Chemistry', 'Biology'],
  'mht-cet': ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
  'combined': ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
  'jee-advanced': ['Physics', 'Chemistry', 'Mathematics'],
  'kcet': ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
  'wbjee': ['Physics', 'Chemistry', 'Mathematics'],
  'mht-cet-pcm': ['Physics', 'Chemistry', 'Mathematics'],
  'mht-cet-pcb': ['Physics', 'Chemistry', 'Biology'],
  'aiims': ['Physics', 'Chemistry', 'Biology', 'General Knowledge'],
  'jipmer': ['Physics', 'Chemistry', 'Biology', 'English', 'Logical Reasoning'],
  'nda': ['Mathematics', 'General Ability Test'],
};

export interface DppExamOption {
  id: string;
  name: string;
  slug: string;
  description: string;
  iconUrl: string;
  isIconComponent?: boolean;
  dataAiHint: string;
}

export const DPP_EXAM_OPTIONS: DppExamOption[] = [
  { id: 'jee-main-dpp', name: 'JEE MAIN', slug: 'jee-main', description: 'Targeted Daily Practice Problems for JEE Main aspirants.', iconUrl: 'https://i.filecdn.in/755esias/image-1718508545561.png', dataAiHint: 'engineering exam' },
  { id: 'neet-dpp', name: 'NEET', slug: 'neet', description: 'Daily drills to sharpen your concepts for NEET UG.', iconUrl: 'https://i.filecdn.in/755esias/image-1718508545561.png', dataAiHint: 'medical exam' },
  { id: 'mht-cet-dpp', name: 'MHT CET', slug: 'mht-cet', description: 'Focused practice sets for MHT CET (Engineering & Medical).', iconUrl: 'https://upload.wikimedia.org/wikipedia/en/6/60/MHT-CET_logo.png', dataAiHint: 'state exam' },
  { id: 'combined-dpp', name: 'Combined DPPs', slug: 'combined', description: 'Access a mixed set of Daily Practice Problems from all exams.', iconUrl: '/assets/icons/book-open-icon.svg', isIconComponent: true, dataAiHint: 'mixed practice' },
];

// For Admin Question Bank PYQ Exam Name dropdown
export const PYQ_EXAM_NAME_OPTIONS = [
    "JEE Main", "JEE Advanced", "KCET", "WBJEE", "MHT CET PCM", "MHT CET PCB", "NEET"
] as const;

export const PYQ_SHIFT_OPTIONS = ["Shift 1", "Shift 2", "N/A"] as const;
export const DPP_ASSOCIATED_EXAMS = ["JEE MAIN", "NEET", "MHT CET"] as const;

export const allPlansData: Plan[] = [
  {
    id: 'Free',
    name: 'Nova',
    description: "New star; represents a fresh start. Basic access to get started.",
    price: '₹0',
    priceSuffix: 'Always',
    priceValue: 0,
    features: [
      'Access to free test series',
      'Daily limit of 50 DPP questions',
      'Overall 60 PYQs access',
      'No challenge and compete with friends feature',
      'Basic Performance Tracking',
      'Community Forum Access',
    ],
    ctaText: 'Get Started',
  },
  {
    id: 'Dpp',
    name: 'Pulse',
    description: "Daily rhythm of practice. Focus on daily problems and foundational tests.",
    price: '₹1',
    priceSuffix: '/- year',
    priceValue: 1,
    features: [
      'All Nova features',
      'Access to free test series',
      'Access to free full length tests',
    ],
    ctaText: 'Choose Pulse',
  },
  {
    id: 'Chapterwise',
    name: 'Focus',
    description: "Focus your preparation with unlimited access to all chapter-specific tests.",
    price: '₹599',
    priceSuffix: '/year',
    priceValue: 599,
    features: [
      'All Pulse features',
      'Access to free chapterwise test series',
    ],
    ctaText: 'Choose Focus',
  },
  {
    id: 'Full_length', 
    name: 'Prime',
    description: "Full potential; complete preparation. Access full-length mock tests for exam simulation.",
    price: '₹499',
    priceSuffix: '/year',
    priceValue: 499,
    features: [
      'All Full Length Test Series',
      'Detailed Solutions',
      'Performance Analysis per Chapter',
      'Regular DPP Access',
    ],
    ctaText: 'Choose Prime',
  },
  {
    id: 'Combo',
    name: 'Zenith',
    description: "The peak; best of both worlds. The ultimate package for comprehensive preparation.",
    price: '₹999',
    priceSuffix: '/year',
    priceValue: 999,
    features: [
      'Everything in Prime, Focus & Pulse',
      'All PYQ DPPs & Mock Tests',
      'Exclusive Content & Workshops',
      'Priority Support',
      'Challenge and Compete with Friends',
    ],
    isRecommended: true,
    ctaText: 'Choose Zenith',
  },
];

const studentTierValues: UserSubscriptionTierStudent[] = ['Free', 'Dpp', 'Chapterwise', 'Full_length', 'Combo']; 
export const studentPlansData: Plan[] = allPlansData.filter(plan =>
  studentTierValues.includes(plan.id as UserSubscriptionTierStudent)
);

export const teacherPlatformPlansData: Plan[] = [
  {
    id: 'Free',
    name: 'Teacher Basic',
    description: "Get started and explore basic teaching tools.",
    price: '₹0',
    priceSuffix: 'Always',
    priceValue: 0,
    features: [
      "Create up to 2 content plans (tests/DPP series)", 
      "Basic analytics for your students",
      "Limited access to EduNexus Question Bank features",
    ],
    ctaText: 'Current Plan',
    commissionRate: 10, // EduNexus takes 10%
    maxContentPlans: 2, 
    qbAccess: false,
  },
  {
    id: 'Starter',
    name: 'Teacher Starter',
    description: "More tools and capacity for growing educators.",
    price: '₹399',
    priceSuffix: '/year',
    priceValue: 399,
    features: [
      "Create up to 5 content plans",
      "Enhanced student analytics",
      "Standard access to EduNexus Question Bank features",
    ],
    ctaText: 'Upgrade to Starter',
    commissionRate: 7.5, // EduNexus takes 7.5%
    maxContentPlans: 5,
    qbAccess: false, 
  },
  {
    id: 'Pro',
    name: 'Teacher Pro',
    description: "Full access to all features for professional educators.",
    price: '₹599',
    priceSuffix: '/year',
    priceValue: 599,
    features: [
      "Create up to 10 content plans", 
      "Full access to EduNexus Question Bank",
      "Advanced analytics and reporting tools",
      "Priority support",
    ],
    isRecommended: true,
    ctaText: 'Upgrade to Pro',
    commissionRate: 5, // EduNexus takes 5%
    maxContentPlans: 10, 
    qbAccess: true,
  },
  {
    id: 'Ads Model', // Matches User['ads_subscription'] type
    name: 'Advertisement Creator Pack',
    description: "Enable tools to create and manage advertisements for your content on EduNexus.",
    price: '₹10',
    priceSuffix: '/month (Activation via Telegram)',
    priceValue: 10, 
    features: [
      "Create promotional ads for your profile & plans",
      "Reach a wider student audience on EduNexus",
      "Track ad performance (coming soon)"
    ],
    ctaText: 'Activate Ad Features',
    customActivationLink: Routes.teacherUpgradeAds, 
  },
];

    

