
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as RadixAlertDialogDescription, AlertDialogFooter as RadixAlertDialogFooter, AlertDialogHeader as RadixAlertDialogHeader, AlertDialogTitle as RadixAlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader as ShadcnSheetHeader, SheetTitle as ShadcnSheetTitle, SheetDescription as ShadcnSheetDescription, SheetTrigger, SheetClose, SheetFooter as ShadcnSheetFooter } from '@/components/ui/sheet';
import { AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Clock, Flag, Image as ImageIconLucide, Loader2, Minimize, Send, XCircle, ArrowLeft as BackArrowIcon, Settings as SettingsIcon, Bookmark as BookmarkIconLucide, Check, PlusCircle, Info, ListOrdered, UserCircle as UserCircleIcon, Menu, PanelRightOpen } from 'lucide-react';
import NextImage from 'next/image';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { AppConfig, Routes, escapeForPbFilter, DPP_EXAM_OPTIONS, slugify } from '@/lib/constants';
import { AppLogo } from '@/components/layout/AppLogo';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { StudentBookmark, User, UserSubscriptionTierStudent } from '@/lib/types';
import Link from 'next/link';
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


const TEST_PIN_SESSION_KEY_PREFIX = "testPinVerified_";

interface TeacherTestRecord extends RecordModel {
  testName: string;
  TotalTime: string; // Duration in minutes
  teacherId: string; // Relation to teacher_data
  Admin_Password?: string;
  status?: 'Draft' | 'Published' | 'Archived';
  // ... other fields from teacher_tests
  expand?: {
    teacherId?: { // Expanded teacher details
      id: string;
      name: string;
      // ... other teacher fields you might need
    };
  };
}

interface TeacherQuestionRecord extends RecordModel {
  id: string;
  QuestionText?: string;
  QuestionImage?: string | null; // This is the URL from teacher_question_data
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
  subject?: string; // Should be present if this is a chapterwise test sourced this way
  marks?: number;
  // No collectionId/collectionName needed if URLs are direct from teacher_question_data
}

interface UserAnswer {
  questionId: string;
  selectedOption: string | null;
  isCorrect: boolean | null;
  markedForReview: boolean;
  timeSpentSeconds: number;
}

const renderLatex = (text: string | undefined | null): React.ReactNode => {
    if (!text) return null;
    const parts = text.split(/(\$\$[\s\S]*?\$\$|\$.*?\$|\\\(.*?\\\)|\\\[.*?\\\]|\\begin\{.*?\}[\s\S]*?\\end\{.*?\})/g);
    return parts.map((part, index) => {
      try {
        if (part.startsWith('$$') && part.endsWith('$$')) return <BlockMath key={index} math={part.substring(2, part.length - 2)} />;
        if (part.startsWith('$') && part.endsWith('$')) return <InlineMath key={index} math={part.substring(1, part.length - 1)} />;
        if (part.startsWith('\\(') && part.endsWith('\\)')) return <InlineMath key={index} math={part.substring(2, part.length - 2)} />;
        if (part.startsWith('\\[') && part.endsWith('\\]')) return <BlockMath key={index} math={part.substring(2, part.length - 2)} />;
        if (part.startsWith('\\begin{') && part.includes('\\end{')) return <BlockMath key={index} math={part} />;
      } catch (e) { return <span key={index} className="text-destructive" title="LaTeX Error">{part}</span>; }
      return <span key={index}>{part}</span>;
    });
};

export default function StudentTakeTeacherTestPage() {
  const params = useParams();
  const router = useRouter();
  const { testId } = params;
  const { user, isLoading: isAuthLoading, authRefresh } = useAuth();
  const { toast } = useToast();

  const [testDetails, setTestDetails] = useState<TeacherTestRecord | null>(null);
  const [teacherName, setTeacherName] = useState<string>('Educator');
  const [questions, setQuestions] = useState<TeacherQuestionRecord[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, UserAnswer>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<'not_started' | 'pin_required' | 'instructions' | 'in_progress' | 'completed' | 'terminated'>('not_started');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true); 
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  const currentQuestion = questions[currentQuestionIndex];
  const questionStartTimeRef = useRef<number>(Date.now());
  const todayDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const fetchTestData = useCallback(async (isMountedGetter: () => boolean) => {
    const currentTestId = typeof testId === 'string' ? testId : '';
    if (!currentTestId || !user?.id) {
      if(isMountedGetter()) { setError("Test ID or User ID missing."); setIsLoading(false); }
      return;
    }
    if (isMountedGetter()) setIsLoading(true);

    try {
      const fetchedTestDetails = await pb.collection('teacher_tests').getOne<TeacherTestRecord>(currentTestId, { expand: 'teacherId', '$autoCancel': false });
      if (!isMountedGetter()) return;
      
      if (fetchedTestDetails.status !== 'Published') {
        if(isMountedGetter()) setError("This test is not currently published or available.");
        if(isMountedGetter()) setIsLoading(false);
        return;
      }
      
      setTestDetails(fetchedTestDetails);
      if (fetchedTestDetails.expand?.teacherId?.name) {
        setTeacherName(fetchedTestDetails.expand.teacherId.name);
      }

      // PIN Verification (moved from instructions page)
      const pinSessionKey = `${TEST_PIN_SESSION_KEY_PREFIX}${currentTestId}`;
      const pinIsVerifiedInSession = sessionStorage.getItem(pinSessionKey) === 'true';

      if (fetchedTestDetails.Admin_Password && !pinIsVerifiedInSession) {
        if (isMountedGetter()) {
          // Redirect to instructions page which now handles PIN
          router.replace(Routes.studentTestInstructions(currentTestId)); 
        }
        return; // Stop further execution as PIN is required
      }
      // If PIN is verified or not required, proceed

      setTestStatus('in_progress'); // Set to in_progress now
      const durationMinutes = parseInt(fetchedTestDetails.TotalTime, 10);
      setTimeLeft(isNaN(durationMinutes) ? 3600 : durationMinutes * 60); // Default to 1 hour if parse fails

      // Fetch questions: Filter teacher_question_data by teacherId from teacher_tests
      // and LessonName matching teacher_tests.testName
      if (fetchedTestDetails.teacherId && fetchedTestDetails.testName) {
        const questionFilter = `teacher = "${escapeForPbFilter(fetchedTestDetails.teacherId)}" && LessonName = "${escapeForPbFilter(fetchedTestDetails.testName)}"`;
        console.log("StudentTakeTeacherTestPage: Fetching questions from 'teacher_question_data' with filter:", questionFilter);
        const fetchedQuestionsFromDb = await pb.collection('teacher_question_data').getFullList<TeacherQuestionRecord>({
          filter: questionFilter,
          sort: 'created',
          '$autoCancel': false,
        });
        if (!isMountedGetter()) return;
        
        setQuestions(fetchedQuestionsFromDb);
        const initialAnswers: Record<string, UserAnswer> = {};
        fetchedQuestionsFromDb.forEach(q => {
          initialAnswers[q.id] = { questionId: q.id, selectedOption: null, isCorrect: null, markedForReview: false, timeSpentSeconds: 0 };
        });
        setUserAnswers(initialAnswers);
        questionStartTimeRef.current = Date.now();
        if (fetchedQuestionsFromDb.length === 0) {
           if(isMountedGetter()) setError("No questions found for this test setup. The teacher may not have added questions for this lesson name under their account.");
        }
      } else {
        if(isMountedGetter()) setError("Test details are incomplete (missing teacher or test name for question fetching).");
        if(isMountedGetter()) setQuestions([]);
      }
      if(isMountedGetter()) toast({ title: "Test Started!", description: "Good luck!" });

    } catch (err: any) {
      if (isMountedGetter()) {
        const clientError = err as PocketBaseClientResponseError;
        let errorMsg = "Could not load test data.";
        if (clientError.status === 404) errorMsg = "Test not found.";
        else if (clientError.data?.message) errorMsg = clientError.data.message;
        else if (clientError.message) errorMsg = clientError.message;
        setError(errorMsg);
        console.error("StudentTakeTeacherTestPage: Error fetching test data:", clientError.data || clientError);
      }
    } finally {
      if (isMountedGetter()) setIsLoading(false);
    }
  }, [testId, user?.id, toast, router]);

  useEffect(() => {
    let isMounted = true;
    if (!isAuthLoading) fetchTestData(() => isMounted);
    return () => { isMounted = false; };
  }, [testId, isAuthLoading, fetchTestData]);

  const handleSubmitTest = useCallback(async (autoSubmit = false, terminationReason?: string) => {
    if (!user || !testDetails || isSubmitting || testStatus === 'completed' || testStatus === 'terminated') return;
    setIsSubmitting(true);
    if(currentQuestion && userAnswers[currentQuestion.id] && questionStartTimeRef.current) {
        const currentTime = Date.now();
        const timeSpentCurrentQuestion = Math.round((currentTime - questionStartTimeRef.current) / 1000);
        userAnswers[currentQuestion.id].timeSpentSeconds = (userAnswers[currentQuestion.id].timeSpentSeconds || 0) + timeSpentCurrentQuestion;
    }
    let correctCount = 0; let attemptedCount = 0; let totalMarksForTest = 0;
    const answersLog = questions.map(q => {
      const userAnswerRec = userAnswers[q.id]; const selected = userAnswerRec?.selectedOption || null; let isCorrectAns = false;
      const questionCorrectOption = q.CorrectOption ? q.CorrectOption.replace("Option ", "") as "A"|"B"|"C"|"D" : undefined;
      const questionMarks = typeof q.marks === 'number' ? q.marks : 1; // Default to 1 mark if not specified
      totalMarksForTest += questionMarks;
      if (selected) { attemptedCount++; if (selected === `Option ${questionCorrectOption}`) { correctCount++; isCorrectAns = true; } }
      return { questionId: q.id, selectedOption: selected, correctOption: questionCorrectOption ? `Option ${questionCorrectOption}` : null, isCorrect: isCorrectAns, markedForReview: userAnswerRec?.markedForReview || false, timeSpentSeconds: userAnswerRec?.timeSpentSeconds || 0 };
    });
    const percentage = totalMarksForTest > 0 ? (correctCount / totalMarksForTest) * 100 : 0; // Assuming 1 mark per question for score = correctCount
    const finalTestStatus: 'completed' | 'terminated' = terminationReason ? 'terminated' : 'completed';
    const durationTaken = testDetails?.TotalTime ? parseInt(testDetails.TotalTime, 10) * 60 - (timeLeft || 0) : 0;
    
    const resultData = {
      student: user.id,
      teacher_test: testDetails.id,
      teacher: testDetails.teacherId,
      score: correctCount, // Using correctCount as score for simplicity
      max_score: totalMarksForTest,
      percentage: parseFloat(percentage.toFixed(2)),
      answers_log: JSON.stringify(answersLog),
      duration_taken_seconds: durationTaken,
      status: finalTestStatus,
      attempt_date: new Date().toISOString(),
      plan_context: user.studentSubscriptionTier || "N/A",
    };
    try {
      const createdResultRecord = await pb.collection('teacher_test_student_results').create(resultData);
      setTestStatus(finalTestStatus); setTimeLeft(0);
      toast({ title: autoSubmit ? (terminationReason ? "Test Terminated" : "Test Auto-Submitted") : "Test Submitted Successfully!", description: `Your results have been recorded. ${terminationReason ? `Reason: ${terminationReason.replace(/_/g, ' ')}.` : ''}` });
      // For teacher tests, redirect to a generic result summary or specific teacher test result page if we create one.
      // For now, reusing the chapterwise result page structure for display.
      router.push(Routes.testResult(createdResultRecord.id)); // This implies testResult page can handle 'teacher_test_student_results' IDs
    } catch (err: any) { console.error("Failed to submit teacher test results:", err); toast({ title: "Submission Failed", description: `Could not save your results. Error: ${err.data?.message || err.message}`, variant: "destructive" }); }
    finally { setIsSubmitting(false); }
  }, [user, testDetails, questions, userAnswers, timeLeft, router, toast, isSubmitting, testStatus, currentQuestion, authRefresh]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || testStatus !== 'in_progress') { if (timeLeft !== null && timeLeft <= 0 && testStatus === 'in_progress') { handleSubmitTest(true, "time_up"); } return; }
    const timerId = setInterval(() => { setTimeLeft((prevTime) => (prevTime ? prevTime - 1 : 0)); }, 1000);
    return () => clearInterval(timerId);
  }, [timeLeft, testStatus, handleSubmitTest]);

  const handleOptionChange = (value: string) => { if (testStatus !== 'in_progress' || !currentQuestion) return; setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...(prev[currentQuestion.id] || { questionId: currentQuestion.id, timeSpentSeconds: 0, markedForReview: false }), selectedOption: value, isCorrect: null, }})); };
  const handleClearResponse = () => { if (testStatus !== 'in_progress' || !currentQuestion) return; setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...(prev[currentQuestion.id] || { questionId: currentQuestion.id, timeSpentSeconds: 0 }), selectedOption: null, isCorrect: null, }})); };
  const handleMarkForReview = () => { if (testStatus !== 'in_progress' || !currentQuestion) return; setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...(prev[currentQuestion.id] || { questionId: currentQuestion.id, selectedOption: null, isCorrect: null, timeSpentSeconds: 0 }), markedForReview: !prev[currentQuestion.id]?.markedForReview, }})); };
  const navigateQuestion = (directionOrIndex: 'next' | 'prev' | number) => { /* Same as in original test page */
    if (testStatus !== 'in_progress' || !currentQuestion) return;
    if (userAnswers[currentQuestion.id]) {
        const currentTime = Date.now(); const timeSpentCurrentQuestion = Math.round((currentTime - questionStartTimeRef.current) / 1000);
        setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...prev[currentQuestion.id], timeSpentSeconds: (prev[currentQuestion.id].timeSpentSeconds || 0) + timeSpentCurrentQuestion }}));
    }
    let newIndex = currentQuestionIndex;
    if (directionOrIndex === 'next') newIndex = Math.min(questions.length - 1, currentQuestionIndex + 1);
    else if (directionOrIndex === 'prev') newIndex = Math.max(0, currentQuestionIndex - 1);
    else if (typeof directionOrIndex === 'number') newIndex = Math.max(0, Math.min(questions.length - 1, directionOrIndex));
    setCurrentQuestionIndex(newIndex); questionStartTimeRef.current = Date.now();
  };
  const handleSaveAndNext = () => navigateQuestion('next');
  const formatTime = (seconds: number | null): string => { if (seconds === null) return '00:00:00'; const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = seconds % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; };
  const getQuestionStatusForPalette = (questionId: string): 'answered' | 'notAnswered' | 'markedForReview' | 'markedAndAnswered' | 'notVisited' => { const answer = userAnswers[questionId]; if (!answer || (answer.selectedOption === null && !answer.markedForReview)) return 'notVisited'; if (answer.selectedOption) { return answer.markedForReview ? 'markedAndAnswered' : 'answered'; } else { return answer.markedForReview ? 'markedForReview' : 'notAnswered'; }};
  const questionPaletteButtonClass = (status: ReturnType<typeof getQuestionStatusForPalette>, isActive: boolean) => { if (isActive) return "bg-primary text-primary-foreground border-primary ring-2 ring-offset-1 ring-primary"; switch (status) { case 'answered': return "bg-green-500 hover:bg-green-600 text-white border-green-500"; case 'notAnswered': return "bg-red-500 hover:bg-red-600 text-white border-red-500"; case 'markedForReview': return "bg-purple-500 hover:bg-purple-600 text-white border-purple-500"; case 'markedAndAnswered': return "bg-orange-500 hover:bg-orange-600 text-white border-orange-500"; case 'notVisited': default: return "bg-card hover:bg-muted/80 text-muted-foreground border-border"; }};
  const renderOption = (optionKey: "A" | "B" | "C" | "D"): React.ReactNode => { if(!currentQuestion) return null; const textKey = `Option${optionKey}Text` as keyof QuestionRecord; const imageKey = `Option${optionKey}Image` as keyof QuestionRecord; const optionText = currentQuestion[textKey]; const imageUrl = currentQuestion[imageKey] as string | null; const optionValue = `Option ${optionKey}`; return ( <Label htmlFor={`option-${currentQuestion.id}-${optionKey}`} className={cn("flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-all hover:shadow-md", userAnswers[currentQuestion.id]?.selectedOption === optionValue ? 'bg-primary/10 border-primary ring-1 ring-primary' : 'bg-card border-border hover:border-primary/50')}> <RadioGroupItem value={optionValue} id={`option-${currentQuestion.id}-${optionKey}`} className="mt-1 border-muted-foreground data-[state=checked]:border-primary shrink-0" /> <div className="flex-1 text-sm"> <div className="font-semibold">{optionKey}.</div> {optionText && <div className="prose prose-sm dark:prose-invert max-w-none mt-0.5">{renderLatex(optionText as string)}</div>} {imageUrl && isValidHttpUrl(imageUrl) && (<div className="mt-1.5"><NextImage src={imageUrl} alt={`Option ${optionKey}`} width={200} height={100} className="rounded object-contain border" data-ai-hint="option illustration"/></div>)} {!(optionText || imageUrl) && <p className="text-muted-foreground italic">Option {optionKey} content not available.</p>} </div> </Label> ); };

  const QuestionPaletteContent = () => ( <> <Card className="shadow-none border-0 md:border md:shadow-sm md:rounded-lg md:bg-card"> <CardHeader className="p-3 border-b text-center"> <UserCircleIcon className="mx-auto h-10 w-10 text-primary mb-1" /> <CardTitle className="text-base">{user?.name || "Student"}</CardTitle> <CardDescription className="text-xs truncate">{user?.email}</CardDescription> <CardDescription className="text-xs">{todayDate}</CardDescription> </CardHeader> </Card> <Card className="border-primary/30 bg-primary/5 flex-1 flex flex-col min-h-0 shadow-md rounded-lg md:mt-3"> <CardHeader className="p-2 text-center border-b border-primary/20"><CardTitle className="text-sm text-primary">QUESTION NAVIGATION</CardTitle></CardHeader> <CardContent className="p-2 flex-1 overflow-hidden"><ScrollArea className="h-full"><div className="grid grid-cols-5 sm:grid-cols-4 gap-1.5 p-1">{questions.map((q, index) => { const status = getQuestionStatusForPalette(q.id); const isActive = currentQuestionIndex === index; return ( <Button key={q.id} variant="outline" size="icon" className={cn("h-8 w-full text-xs rounded-md aspect-square", questionPaletteButtonClass(status, isActive))} onClick={() => { navigateQuestion(index); if (isMobileSheetOpen) setIsMobileSheetOpen(false); }} disabled={testStatus !== 'in_progress'} aria-label={`Go to question ${index + 1}, Status: ${(status || 'Not Visited').replace(/([A-Z])/g, ' $1')}`}>{index + 1}{status === 'markedAndAnswered' && <Check className="absolute h-2.5 w-2.5 bottom-0.5 right-0.5 text-white" />}</Button> ); })}</div></ScrollArea></CardContent> </Card> <div className="p-3 border-t bg-card md:bg-transparent rounded-b-lg md:shadow-md mt-auto md:mt-3"> <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" className="w-full text-sm py-2.5" disabled={testStatus !== 'in_progress' || isSubmitting}><Send className="mr-1.5 h-4 w-4" /> Submit Test</Button></AlertDialogTrigger><AlertDialogContent><RadixAlertDialogHeader><RadixAlertDialogTitle>Confirm Submission</RadixAlertDialogTitle><RadixAlertDialogDescription>Are you sure you want to submit your test?</RadixAlertDialogDescription></RadixAlertDialogHeader><RadixAlertDialogFooter><AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleSubmitTest(false)} disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Yes, Submit</AlertDialogAction></RadixAlertDialogFooter></AlertDialogContent></AlertDialog></div> </> );

  if (isLoading || isAuthLoading || !testDetails && !error) { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" /> <p className="text-lg">Loading test environment...</p> </div> ); }
  if (error) { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Card className="w-full max-w-lg text-center shadow-xl bg-background text-foreground"> <CardHeader> <AlertCircle className="mx-auto h-12 w-12 text-destructive" /> <CardTitle className="text-destructive">Error Loading Test</CardTitle> </CardHeader> <CardContent><p className="text-muted-foreground whitespace-pre-wrap">{error}</p></CardContent> <CardFooter><Button onClick={() => router.back()} variant="outline" className="w-full">Go Back</Button></CardFooter> </Card> </div> ); }
  if (testStatus === 'completed' || testStatus === 'terminated') { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Card className="w-full max-w-lg text-center shadow-xl bg-background text-foreground"> <CardHeader> {testStatus === 'completed' ? <CheckCircle className="mx-auto h-12 w-12 text-green-500" /> : <XCircle className="mx-auto h-12 w-12 text-destructive" />} <CardTitle>{testStatus === 'completed' ? "Test Completed" : "Test Terminated"}</CardTitle> </CardHeader> <CardContent><p className="text-muted-foreground">{testStatus === 'completed' ? "Your responses have been submitted." : "This test session has been terminated."}</p></CardContent> <CardFooter> <Button onClick={() => { if (window.opener && !window.opener.closed) window.close(); else router.push(Routes.dashboard);}} className="w-full"> Close Window / Back to Dashboard </Button> </CardFooter> </Card> </div> ); }
  if (!currentQuestion && !isLoading) { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Card className="w-full max-w-lg text-center shadow-xl bg-background text-foreground"> <CardHeader> <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" /> <CardTitle>No Questions</CardTitle> </CardHeader> <CardContent><p className="text-muted-foreground">No questions loaded for this test.</p></CardContent> <CardFooter><Button onClick={() => router.back()} variant="outline" className="w-full">Go Back</Button></CardFooter> </Card> </div> );}

  return (
    <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-900">
      <header className="sticky top-0 z-50 bg-card shadow-md p-3 border-b border-border">
        <div className="flex justify-between items-center max-w-full px-2 sm:px-4">
          <div className="text-xs sm:text-sm font-medium text-muted-foreground truncate max-w-[calc(33%-20px)] sm:max-w-xs" title={testDetails?.testName || 'Test'}>
            {testDetails?.testName || 'Test Name'} <span className="hidden sm:inline">- By {teacherName}</span>
          </div>
          <div className="flex-shrink-0"> <AppLogo mainTextSize="text-lg" taglineTextSize="text-[0px]" iconSize={22} /> </div>
          <div className="text-sm font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md shadow-sm flex items-center w-auto max-w-[calc(33%-20px)] sm:max-w-xs justify-end">
            <Clock className="h-4 w-4 mr-1.5 flex-shrink-0" /> <span className="truncate">{formatTime(timeLeft)}</span>
          </div>
        </div>
      </header>
      <div className="sticky top-[var(--top-header-height,57px)] z-40 bg-background shadow-sm p-3 border-b border-border">
         <div className="flex justify-between items-center max-w-full px-2 sm:px-4">
            <div className="text-sm font-semibold text-foreground truncate max-w-[calc(50%-120px)] sm:max-w-md" title={currentQuestion?.subject || testDetails?.derivedSubject || 'Subject'}>
              SUBJECT: {currentQuestion?.subject || testDetails?.derivedSubject || 'N/A'}
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
                <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}><SheetTrigger asChild><Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary h-7 w-7 md:hidden" aria-label="Open Question Navigation"><ListOrdered className="h-5 w-5" /></Button></SheetTrigger><SheetContent side="right" className="w-3/4 p-0 flex flex-col"><ShadcnSheetHeader className="p-3 border-b text-center"><ShadcnSheetTitle className="text-lg">Question Navigation</ShadcnSheetTitle><ShadcnSheetDescription>Jump to any question or submit.</ShadcnSheetDescription></ShadcnSheetHeader><QuestionPaletteContent /></SheetContent></Sheet>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary h-7 w-7 hidden md:inline-flex" onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)} aria-label={isRightSidebarOpen ? "Hide Question Panel" : "Show Question Panel"}><Menu className="h-5 w-5" /></Button>
                <Button variant="ghost" size="icon" asChild className="text-muted-foreground hover:text-primary h-7 w-7"><Link href={Routes.studentTestInstructions(testId as string)} target="_blank"><Info className="h-4 w-4" /></Link></Button>
            </div>
        </div>
      </div>
      <div className={cn("flex-1 flex max-w-full p-2 sm:p-4 gap-2 sm:gap-4 overflow-hidden")}>
        <Card className="flex-1 flex flex-col bg-card shadow-xl rounded-lg border border-border overflow-hidden">
            <CardHeader className="p-3 sm:p-4 border-b border-border bg-muted/30"><div className="flex justify-between items-center"><p className="text-xs sm:text-sm font-medium text-muted-foreground"> Question {currentQuestionIndex + 1} of {questions.length} </p><div className="flex items-center gap-1">{currentQuestion.difficulty && <Badge variant={currentQuestion.difficulty === 'Easy' ? 'secondary' : currentQuestion.difficulty === 'Medium' ? 'default' : 'destructive'} className="text-xs px-1.5 py-0.5">{currentQuestion.difficulty}</Badge>}{currentQuestion.marks && <Badge variant="outline" className="text-xs px-1.5 py-0.5">Marks: {currentQuestion.marks}</Badge>}</div></div></CardHeader>
            <ScrollArea className="flex-1 min-h-0"><CardContent className="p-3 sm:p-4 md:p-6 space-y-4">
                  <div className="p-2 border-b border-border/50 rounded-md bg-background min-h-[80px]">{currentQuestion.QuestionText && (<div className="prose prose-sm dark:prose-invert max-w-none mb-3 text-foreground leading-relaxed">{renderLatex(currentQuestion.QuestionText)}</div>)}{currentQuestion.QuestionImage && isValidHttpUrl(currentQuestion.QuestionImage) && (<div className="my-2 text-center"><NextImage src={currentQuestion.QuestionImage} alt="Question Image" width={400} height={300} className="rounded object-contain inline-block border" data-ai-hint="question diagram"/></div>)}{!(currentQuestion.QuestionText || (currentQuestion.QuestionImage && isValidHttpUrl(currentQuestion.QuestionImage))) && (<p className="text-xs sm:text-sm text-muted-foreground italic py-3">Question content not provided.</p>)}</div>
                  <RadioGroup value={userAnswers[currentQuestion.id]?.selectedOption || ""} onValueChange={handleOptionChange} className="space-y-2.5" disabled={testStatus !== 'in_progress'}>{renderOption("A")} {renderOption("B")} {renderOption("C")} {renderOption("D")}</RadioGroup>
            </CardContent></ScrollArea>
            <CardFooter className="p-3 sm:p-4 border-t border-border bg-muted/30 flex-wrap justify-center sm:justify-between gap-2"><Button variant="outline" size="sm" onClick={handleClearResponse} disabled={testStatus !== 'in_progress' || !userAnswers[currentQuestion.id]?.selectedOption}>Clear Response</Button><Button variant={userAnswers[currentQuestion.id]?.markedForReview ? "secondary" : "outline"} size="sm" onClick={handleMarkForReview} disabled={testStatus !== 'in_progress'} className="border-purple-500 text-purple-600 data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-700 hover:bg-purple-500/10"><Flag className="mr-1.5 h-4 w-4" /> {userAnswers[currentQuestion.id]?.markedForReview ? "Unmark Review" : "Mark for Review"}</Button><Button size="sm" onClick={handleSaveAndNext} disabled={testStatus !== 'in_progress' || currentQuestionIndex === questions.length - 1} className="bg-green-600 hover:bg-green-700 text-white">Save & Next <ChevronRight className="ml-1.5 h-4 w-4" /></Button></CardFooter>
        </Card>
        {isRightSidebarOpen && ( <div className="hidden md:flex w-72 lg:w-80 flex-shrink-0 flex-col space-y-0"> <QuestionPaletteContent /> </div> )}
      </div>
    </div>
  );
}

    