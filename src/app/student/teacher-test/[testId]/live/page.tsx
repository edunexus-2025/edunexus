
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
import { Sheet, SheetContent, SheetHeader as ShadcnSheetHeader, SheetTitle as ShadcnSheetTitle, SheetDescription as ShadcnSheetDescription, SheetTrigger, SheetClose, SheetFooter as ShadcnSheetFooter } from '@/components/ui/sheet'; // Renamed Shadcn specific imports
import { Dialog, DialogContent, DialogHeader as ShadcnDialogHeader, DialogTitle as ShadcnDialogTitle, DialogDescription as ShadcnDialogDescription, DialogFooter as ShadcnDialogFooter, DialogClose as ShadcnDialogClose } from "@/components/ui/dialog"; // Added missing imports and renamed Shadcn specific
import { AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Clock, Expand, Flag, Image as ImageIconLucide, Loader2, Minimize, Send, XCircle, ArrowLeft as BackArrowIcon, Settings as SettingsIcon, Bookmark as BookmarkIconLucide, Check, PlusCircle, Info, ListOrdered, UserCircle as UserCircleIcon, CalendarDays, NotebookText, BarChart, PieChart as PieChartIcon, UserCheck, ListChecks, Eye, X as CloseIcon, MoreVertical, Menu, PanelRightOpen, KeyRound } from 'lucide-react'; // Added KeyRound
import NextImage from 'next/image';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { AppConfig, Routes, escapeForPbFilter, DPP_EXAM_OPTIONS, slugify } from '@/lib/constants';
import { AppLogo } from '@/components/layout/AppLogo';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { StudentBookmark, User, UserSubscriptionTierStudent, TeacherTestAttempt } from '@/lib/types';
import Link from 'next/link';
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from '@/components/ui/badge';
import { format, addMinutes } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';


interface TeacherTestRecord extends RecordModel {
  testName: string;
  Admin_Password?: string;
  duration?: string;
  questions?: string[]; // Array of question IDs from teacher_question_data
  teacherId?: string;
  expand?: {
    teacherId?: { // Teacher's details
      id: string;
      name: string;
      EduNexus_Name?: string;
    };
  };
}

interface QuestionRecord extends RecordModel {
  id: string;
  QuestionText?: string;
  QuestionImage?: string | null; // This is now a URL as per teacher_question_data schema
  OptionAText?: string;
  OptionAImage?: string | null; // URL
  OptionBText?: string;
  OptionBImage?: string | null; // URL
  OptionCText?: string;
  OptionCImage?: string | null; // URL
  OptionDText?: string;
  OptionDImage?: string | null; // URL
  CorrectOption?: "Option A" | "Option B" | "Option C" | "Option D";
  explanationText?: string;
  explanationImage?: string | null; // URL
  subject?: string;
  LessonName?: string;
  QBExam?: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard'; // Field from question_bank, not in teacher_question_data
  marks?: number;
}

interface UserAnswer {
  questionId: string;
  selectedOption: string | null;
  isCorrect: boolean | null;
  markedForReview: boolean;
  timeSpentSeconds: number;
}

const isValidHttpUrl = (string: string | null | undefined): string is string => {
  if (!string || typeof string !== 'string') return false;
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
};

const PREDEFINED_TAGS = ["Easy", "Hard", "Tricky", "Do Again"];
const TEST_PIN_SESSION_KEY_PREFIX = "testPinVerified_";

export default function StudentTeacherTestLivePage() {
  const params = useParams();
  const router = useRouter();
  const testId = typeof params.testId === 'string' ? params.testId : '';

  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const [testDetails, setTestDetails] = useState<TeacherTestRecord | null>(null);
  const [teacherName, setTeacherName] = useState<string>('Educator');
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, UserAnswer>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testStage, setTestStage] = useState<'pin_entry' | 'instructions' | 'test_in_progress' | 'completed' | 'terminated'>('pin_entry');
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

  const fetchTestDataForTeacherTest = useCallback(async (isMountedGetter: () => boolean) => {
    const currentTestId = typeof testId === 'string' ? testId : '';
    if (!currentTestId || !user?.id) { if (isMountedGetter()) { setError(currentTestId ? "User not authenticated." : "Invalid test ID."); setIsLoadingPage(false); } return; }
    if (isMountedGetter()) setIsLoadingPage(true);
    try {
      const fetchedTest = await pb.collection('teacher_tests').getOne<TeacherTestRecord>(currentTestId, { expand: 'teacherId', '$autoCancel': false });
      if (!isMountedGetter()) return;
      
      if (!fetchedTest.Admin_Password) { if(isMountedGetter()) { setError("Test PIN configuration is missing. Cannot proceed."); setIsLoadingPage(false); } return; }
      setTestDetails(fetchedTest);
      if (fetchedTest.expand?.teacherId?.name) setTeacherName(fetchedTest.expand.teacherId.name);
      
      const pinSessionKey = `${TEST_PIN_SESSION_KEY_PREFIX}${currentTestId}`;
      if (sessionStorage.getItem(pinSessionKey) === 'true') {
        setTestStage('instructions');
      } else {
        setTestStage('pin_entry');
      }

    } catch (err: any) { if (isMountedGetter()) { setError(`Could not load test details. Error: ${err.data?.message || err.message}`); console.error("Error fetching test details:", err); } }
    finally { if (isMountedGetter()) setIsLoadingPage(false); }
  }, [testId, user?.id]);

  useEffect(() => { let isMounted = true; if (!isAuthLoading) fetchTestDataForTeacherTest(() => isMounted); return () => { isMounted = false; }; }, [testId, isAuthLoading, fetchTestDataForTeacherTest]);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testDetails || testDetails.Admin_Password === undefined || testDetails.Admin_Password === null) { setPinError("Test details or PIN not loaded."); return; }
    setIsVerifyingPin(true); setPinError(null);
    if (enteredPin === String(testDetails.Admin_Password)) {
      toast({ title: "PIN Verified!", description: "Loading test instructions..." });
      sessionStorage.setItem(`${TEST_PIN_SESSION_KEY_PREFIX}${testId}`, 'true');
      setTestStage('instructions');
    } else {
      setPinError("Invalid PIN. Please try again.");
    }
    setIsVerifyingPin(false);
  };
  
  const loadQuestions = useCallback(async () => {
    if (!testDetails?.questions || testDetails.questions.length === 0 || !testDetails.teacherId) {
      setError("No questions associated with this test or teacher ID missing."); setIsLoadingPage(false); return;
    }
    setIsLoadingPage(true);
    try {
      const questionIds = testDetails.questions;
      const questionFilter = questionIds.map(id => `id = "${escapeForPbFilter(id)}"`).join(' || ');
      const fetchedQuestionsFromDb = await pb.collection('teacher_question_data').getFullList<QuestionRecord>({ filter: questionFilter, sort: '+created', '$autoCancel': false });
      setQuestions(fetchedQuestionsFromDb.map(q => ({...q, marks: typeof q.marks === 'number' ? q.marks : 1}))); // Ensure marks default to 1
      const initialAnswers: Record<string, UserAnswer> = {}; fetchedQuestionsFromDb.forEach(q => { initialAnswers[q.id] = { questionId: q.id, selectedOption: null, isCorrect: null, markedForReview: false, timeSpentSeconds: 0 }; });
      setUserAnswers(initialAnswers);
      questionStartTimeRef.current = Date.now();
    } catch (err: any) { setError(`Could not load questions. Error: ${err.data?.message || err.message}`); }
    finally { setIsLoadingPage(false); }
  }, [testDetails, escapeForPbFilter]);

  const handleStartTestAfterInstructions = () => {
    if (!testDetails) { toast({ title: "Error", description: "Test details not loaded.", variant: "destructive" }); return; }
    const durationMinutes = parseInt(testDetails.duration || "0", 10);
    setTimeLeft(durationMinutes > 0 ? durationMinutes * 60 : 3600); // Default 1hr if invalid
    setTestStage('test_in_progress');
    loadQuestions();
  };
  
  const handleSubmitTest = useCallback(async (autoSubmit = false, terminationReason?: string) => {
    if (!user || !testDetails || !testDetails.expand?.teacherId || isSubmittingTest || testStage === 'completed' || testStage === 'terminated') return;
    setIsSubmittingTest(true);
    if(currentQuestion && userAnswers[currentQuestion.id] && questionStartTimeRef.current && testStage === 'test_in_progress') { const currentTime = Date.now(); const timeSpentCurrentQuestion = Math.round((currentTime - questionStartTimeRef.current) / 1000); userAnswers[currentQuestion.id].timeSpentSeconds = (userAnswers[currentQuestion.id].timeSpentSeconds || 0) + timeSpentCurrentQuestion; }
    let correctCount = 0; let attemptedCount = 0; let pointsEarnedFromTest = 0;
    const answersLogForDb = questions.map(q => {
      const userAnswerRec = userAnswers[q.id]; const selected = userAnswerRec?.selectedOption || null; let isCorrectAns = false;
      const correctOptionValue = q.CorrectOption;
      if (selected) { attemptedCount++; if (selected === correctOptionValue) { correctCount++; isCorrectAns = true; pointsEarnedFromTest += (q.marks || 1); } }
      return { questionId: q.id, selectedOption: selected, correctOption: correctOptionValue || null, isCorrect: isCorrectAns, markedForReview: userAnswerRec?.markedForReview || false, timeSpentSeconds: userAnswerRec?.timeSpentSeconds || 0 };
    });
    const maxScorePossible = questions.reduce((sum, q) => sum + (q.marks || 1), 0);
    const percentage = maxScorePossible > 0 ? (pointsEarnedFromTest / maxScorePossible) * 100 : 0;
    const finalTestStatusString: TeacherTestAttempt['status'] = terminationReason === 'time_up' ? 'terminated_time_up' : 'completed';
    const durationTaken = testDetails?.duration ? parseInt(testDetails.duration, 10) * 60 - (timeLeft || 0) : 0;
    
    const resultData = {
      student: user.id, teacher_test: testDetails.id, teacher: testDetails.expand.teacherId.id,
      test_name_cache: testDetails.testName, start_time: new Date(Date.now() - durationTaken * 1000).toISOString(), end_time: new Date().toISOString(),
      duration_taken_seconds: durationTaken, total_questions_in_test: questions.length, attempted_questions: attemptedCount,
      correct_answers: correctCount, incorrect_answers: attemptedCount - correctCount, unattempted_questions: questions.length - attemptedCount,
      score_obtained: pointsEarnedFromTest, max_score_possible: maxScorePossible, percentage: parseFloat(percentage.toFixed(2)),
      answers_log: JSON.stringify(answersLogForDb), status: finalTestStatusString,
      plan_type_at_attempt: "TeacherPlan_Student", 
    };
    try {
      const createdResultRecord = await pb.collection('teacher_test_attempts').create(resultData);
      sessionStorage.removeItem(`${TEST_PIN_SESSION_KEY_PREFIX}${testId}`);
      setTestStage(finalTestStatusString === 'completed' ? 'completed' : 'terminated');
      setTimeLeft(0); toast({ title: autoSubmit ? (terminationReason ? "Test Terminated" : "Test Auto-Submitted") : "Test Submitted Successfully!", description: `Your results for "${testDetails.testName}" have been recorded.` });
      router.push(Routes.studentTeacherTestResult(createdResultRecord.id));
    } catch (err: any) { console.error("Failed to submit teacher test results:", err); toast({ title: "Submission Failed", description: `Could not save results: ${err.data?.message || err.message}`, variant: "destructive" }); }
    finally { setIsSubmittingTest(false); }
  }, [user, testDetails, questions, userAnswers, timeLeft, router, toast, isSubmittingTest, testStage, currentQuestion, testId]);

  useEffect(() => { if (timeLeft === 0 && testStage === 'test_in_progress') { handleSubmitTest(true, "time_up"); } }, [timeLeft, testStage, handleSubmitTest]);
  useEffect(() => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); if (testStage === 'test_in_progress' && timeLeft !== null && timeLeft > 0) { timerIntervalRef.current = setInterval(() => setTimeLeft(prev => (prev ? prev - 1 : 0)), 1000); } return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); }; }, [testStage, timeLeft]);

  const handleOptionChange = (value: string) => { if (testStage !== 'test_in_progress' || !currentQuestion) return; setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...(prev[currentQuestion.id] || { questionId: currentQuestion.id, timeSpentSeconds: 0, markedForReview: false }), selectedOption: value, isCorrect: null, }})); };
  const handleClearResponse = () => { if (testStage !== 'test_in_progress' || !currentQuestion) return; setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...(prev[currentQuestion.id] || { questionId: currentQuestion.id, timeSpentSeconds: 0 }), selectedOption: null, isCorrect: null, }})); };
  const handleMarkForReview = () => { if (testStage !== 'test_in_progress' || !currentQuestion) return; setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...(prev[currentQuestion.id] || { questionId: currentQuestion.id, selectedOption: null, isCorrect: null, timeSpentSeconds: 0 }), markedForReview: !prev[currentQuestion.id]?.markedForReview, }})); };
  const navigateQuestion = (directionOrIndex: 'next' | 'prev' | number) => { if (testStage !== 'test_in_progress' || !currentQuestion) return; if (userAnswers[currentQuestion.id]) { const currentTime = Date.now(); const timeSpentCurrentQuestion = Math.round((currentTime - questionStartTimeRef.current) / 1000); setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...prev[currentQuestion.id], timeSpentSeconds: (prev[currentQuestion.id].timeSpentSeconds || 0) + timeSpentCurrentQuestion }}));} let newIndex = currentQuestionIndex; if (directionOrIndex === 'next') newIndex = Math.min(questions.length - 1, currentQuestionIndex + 1); else if (directionOrIndex === 'prev') newIndex = Math.max(0, currentQuestionIndex - 1); else if (typeof directionOrIndex === 'number') newIndex = Math.max(0, Math.min(questions.length - 1, directionOrIndex)); setCurrentQuestionIndex(newIndex); questionStartTimeRef.current = Date.now(); };
  const handleSaveAndNext = () => navigateQuestion('next');
  const renderLatex = (text: string | undefined | null): React.ReactNode => { if (!text) return null; const parts = text.split(/(\$\$[\s\S]*?\$\$|\$.*?\$|\\\(.*?\\\)|\\\[.*?\\\]|\\begin\{.*?\}[\s\S]*?\\end\{.*?\})/g); return parts.map((part, index) => { try { if (part.startsWith('$$') && part.endsWith('$$')) return <BlockMath key={index} math={part.substring(2, part.length - 2)} />; if (part.startsWith('$') && part.endsWith('$')) return <InlineMath key={index} math={part.substring(1, part.length - 1)} />; if (part.startsWith('\\(') && part.endsWith('\\)')) return <InlineMath key={index} math={part.substring(2, part.length - 2)} />; if (part.startsWith('\\[') && part.endsWith('\\]')) return <BlockMath key={index} math={part.substring(2, part.length - 2)} />; if (part.startsWith('\\begin{') && part.includes('\\end{')) return <BlockMath key={index} math={part} />; } catch (e) { return <span key={index} className="text-destructive" title="LaTeX Error">{part}</span>; } return <span key={index}>{part}</span>; }); };
  const renderOption = (optionKey: "A" | "B" | "C" | "D"): React.ReactNode => { if(!currentQuestion) return null; const textKey = `Option${optionKey}Text` as keyof QuestionRecord; const imageKey = `Option${optionKey}Image` as keyof QuestionRecord; const optionText = currentQuestion[textKey]; const imageUrl = currentQuestion[imageKey] as string | null; const optionValue = `Option ${optionKey}`; return ( <Label htmlFor={`option-${currentQuestion.id}-${optionKey}`} className={cn("flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-all hover:shadow-md", userAnswers[currentQuestion.id]?.selectedOption === optionValue ? 'bg-primary/10 border-primary ring-1 ring-primary' : 'bg-card border-border hover:border-primary/50')}> <RadioGroupItem value={optionValue} id={`option-${currentQuestion.id}-${optionKey}`} className="mt-1 border-muted-foreground data-[state=checked]:border-primary shrink-0" /> <div className="flex-1 text-sm"> <div className="font-semibold">{optionKey}.</div> {optionText && <div className="prose prose-sm dark:prose-invert max-w-none mt-0.5">{renderLatex(optionText as string)}</div>} {imageUrl && isValidHttpUrl(imageUrl) && (<div className="mt-1.5"><NextImage src={imageUrl} alt={`Option ${optionKey}`} width={200} height={100} className="rounded object-contain border" data-ai-hint="option illustration"/></div>)} {!(optionText || (imageUrl && isValidHttpUrl(imageUrl))) && <p className="text-muted-foreground italic">Option {optionKey} content not available.</p>} </div> </Label> ); };
  const formatTime = (seconds: number | null): string => { if (seconds === null || seconds < 0) seconds = 0; const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = seconds % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; };
  const getQuestionStatusForPalette = (questionId: string): 'answered' | 'notAnswered' | 'markedForReview' | 'markedAndAnswered' | 'notVisited' => { const answer = userAnswers[questionId]; if (!answer || (answer.selectedOption === null && !answer.markedForReview)) return 'notVisited'; if (answer.selectedOption) { return answer.markedForReview ? 'markedAndAnswered' : 'answered'; } else { return answer.markedForReview ? 'markedForReview' : 'notAnswered'; }};
  const questionPaletteButtonClass = (status: ReturnType<typeof getQuestionStatusForPalette>, isActive: boolean) => { if (isActive) return "bg-primary text-primary-foreground border-primary ring-2 ring-offset-1 ring-primary"; switch (status) { case 'answered': return "bg-green-500 hover:bg-green-600 text-white border-green-500"; case 'notAnswered': return "bg-red-500 hover:bg-red-600 text-white border-red-500"; case 'markedForReview': return "bg-purple-500 hover:bg-purple-600 text-white border-purple-500"; case 'markedAndAnswered': return "bg-orange-500 hover:bg-orange-600 text-white border-orange-500"; case 'notVisited': default: return "bg-card hover:bg-muted/80 text-muted-foreground border-border"; }};
  const QuestionPaletteContent = () => (<> <Card className="shadow-none border-0 md:border md:shadow-sm md:rounded-lg md:bg-card"> <CardHeader className="p-3 border-b text-center"> <UserCircleIcon className="mx-auto h-10 w-10 text-primary mb-1" /> <CardTitle className="text-base">{user?.name || "Student"}</CardTitle> <CardDescription className="text-xs truncate">{user?.email}</CardDescription> <CardDescription className="text-xs">{todayDate}</CardDescription> </CardHeader> </Card> <Card className="border-primary/30 bg-primary/5 flex-1 flex flex-col min-h-0 shadow-md rounded-lg md:mt-3"> <CardHeader className="p-2 text-center border-b border-primary/20"><CardTitle className="text-sm text-primary">QUESTION NAVIGATION</CardTitle></CardHeader> <CardContent className="p-2 flex-1 overflow-hidden"><ScrollArea className="h-full"><div className="grid grid-cols-5 sm:grid-cols-4 gap-1.5 p-1">{questions.map((q, index) => (<Button key={q.id} variant="outline" size="icon" className={cn("h-8 w-full text-xs rounded-md aspect-square", questionPaletteButtonClass(getQuestionStatusForPalette(q.id), currentQuestionIndex === index))} onClick={() => { navigateQuestion(index); if (isMobileSheetOpen) setIsMobileSheetOpen(false); }} disabled={testStage !== 'test_in_progress'} aria-label={`Go to question ${index + 1}, Status: ${(getQuestionStatusForPalette(q.id) || 'Not Visited').replace(/([A-Z])/g, ' $1')}`}>{index + 1}{getQuestionStatusForPalette(q.id) === 'markedAndAnswered' && <Check className="absolute h-2.5 w-2.5 bottom-0.5 right-0.5 text-white" />}</Button> ))}</div></ScrollArea></CardContent> </Card> <div className="p-3 border-t bg-card md:bg-transparent rounded-b-lg md:shadow-md mt-auto md:mt-3"> <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" className="w-full text-sm py-2.5" disabled={testStage !== 'test_in_progress' || isSubmitting}><Send className="mr-1.5 h-4 w-4" /> Submit Test</Button></AlertDialogTrigger><AlertDialogContent><RadixAlertDialogHeader><RadixAlertDialogTitle>Confirm Submission</RadixAlertDialogTitle><RadixAlertDialogDescription>Are you sure you want to submit your test?</RadixAlertDialogDescription></RadixAlertDialogHeader><RadixAlertDialogFooter><AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleSubmitTest(false, 'manual')} disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Yes, Submit</AlertDialogAction></RadixAlertDialogFooter></AlertDialogContent></AlertDialog></div> </> );

  if (isLoadingPage || isAuthLoading) { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" /> <p className="text-lg">Loading test environment...</p> </div> ); }
  if (error) { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Card className="w-full max-w-lg text-center shadow-xl bg-background text-foreground"> <CardHeader> <AlertCircle className="mx-auto h-12 w-12 text-destructive" /> <CardTitle className="text-destructive">Error Loading Test</CardTitle> </CardHeader> <CardContent><p className="text-muted-foreground whitespace-pre-wrap">{error}</p></CardContent> <CardFooter><Button onClick={() => router.back()} variant="outline" className="w-full">Go Back</Button></CardFooter> </Card> </div> ); }
  
  if (testStage === 'pin_entry') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-background">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader><CardTitle className="text-2xl flex items-center gap-2"><KeyRound className="text-primary"/>Enter Test PIN</CardTitle><CardDescription>This test requires a PIN provided by {teacherName}.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <Input type="password" placeholder="Enter PIN" value={enteredPin} onChange={(e) => setEnteredPin(e.target.value)} className="text-center tracking-widest text-lg h-12"/>
              {pinError && <p className="text-sm text-destructive">{pinError}</p>}
              <Button type="submit" className="w-full" disabled={isVerifyingPin || !enteredPin}>
                {isVerifyingPin && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Verify PIN & Continue
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (testStage === 'instructions') {
    const instructionSymbolClasses = "inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white rounded-sm mr-2 align-middle";
    return ( <div className="flex flex-col min-h-screen bg-slate-100 dark:bg-slate-950 p-4 md:p-8 items-center justify-center"> <Card className="w-full max-w-4xl shadow-2xl rounded-lg"> <CardHeader className="text-center border-b pb-4"> <CardTitle className="text-3xl font-bold text-foreground">Instructions: {testDetails?.testName}</CardTitle> <CardDescription className="text-md text-muted-foreground mt-1">Please read carefully before starting.</CardDescription> </CardHeader> <CardContent className="p-0"> <ScrollArea className="h-[calc(80vh-180px)] md:h-[calc(70vh-160px)]"> <div className="p-6 prose prose-sm sm:prose-base dark:prose-invert max-w-none text-foreground"> <p>This test contains {questions.length || testDetails?.questions?.length || 'multiple'} questions. Duration: {testDetails?.duration || 'N/A'} minutes. All the best!</p><ol className="list-decimal space-y-3 pl-5 text-muted-foreground"><li>The clock will be set at the server. The countdown timer in the top right corner of screen will display the remaining time.</li><li>When the timer reaches zero, the examination will end by itself.</li><li>Question Palette Status:<ul className="list-none space-y-2 pl-2 mt-2"> <li className="flex items-center"><span className={`${instructionSymbolClasses} bg-gray-400 dark:bg-gray-600`}>1</span><strong className="text-foreground/90 mr-1">Not Visited</strong></li> <li className="flex items-center"><span className={`${instructionSymbolClasses} bg-red-500 dark:bg-red-600`}>2</span><strong className="text-foreground/90 mr-1">Not Answered</strong></li> <li className="flex items-center"><span className={`${instructionSymbolClasses} bg-green-500 dark:bg-green-600`}>3</span><strong className="text-foreground/90 mr-1">Answered</strong></li> <li className="flex items-center"><span className={`${instructionSymbolClasses} bg-purple-500 dark:bg-purple-600`}>4</span><strong className="text-foreground/90 mr-1">Marked for Review</strong></li> <li className="flex items-center"><span className={`${instructionSymbolClasses} bg-orange-500 dark:bg-orange-600 relative flex items-center justify-center`}>5<Check className="absolute h-3 w-3 text-white" style={{ top: '1px', right: '1px' }} /></span><strong className="text-foreground/90 mr-1">Answered & Marked</strong></li> </ul></li><li>Click "Save & Next" to save your answer.</li></ol></div></ScrollArea></CardContent><CardFooter className="p-6 border-t justify-center"><Button onClick={handleStartTestAfterInstructions} size="lg" className="px-10 py-6 text-base bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all">I am ready to Begin</Button></CardFooter></Card></div> );
  }

  if (testStage === 'completed' || testStage === 'terminated') { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Card className="w-full max-w-lg text-center shadow-xl bg-background text-foreground"> <CardHeader> {testStage === 'completed' ? <CheckCircle className="mx-auto h-12 w-12 text-green-500" /> : <XCircle className="mx-auto h-12 w-12 text-destructive" />} <CardTitle>{testStage === 'completed' ? "Test Completed" : "Test Terminated"}</CardTitle> </CardHeader> <CardContent><p className="text-muted-foreground">{testStage === 'completed' ? "Your responses have been submitted." : "This test session has been terminated."}</p></CardContent> <CardFooter> <Button onClick={() => router.push(Routes.dashboard)} className="w-full">Back to Dashboard</Button> </CardFooter> </Card> </div> ); }
  if (!currentQuestion && !isLoadingPage && testStage === 'test_in_progress') { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Card className="w-full max-w-lg text-center shadow-xl bg-background text-foreground"> <CardHeader> <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" /> <CardTitle>No Questions</CardTitle> </CardHeader> <CardContent><p className="text-muted-foreground">No questions available for this test.</p></CardContent> <CardFooter><Button onClick={() => router.back()} variant="outline" className="w-full">Go Back</Button></CardFooter> </Card> </div> );}
  
  return (
    <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-900">
      <header className="sticky top-0 z-50 bg-card shadow-md p-3 border-b border-border"><div className="flex justify-between items-center max-w-full px-2 sm:px-4"><div className="text-sm font-medium text-muted-foreground truncate max-w-[calc(33%-20px)] sm:max-w-xs" title={testDetails?.testName || 'Test'}>{testDetails?.testName || 'Test Name'} <span className="hidden sm:inline">- By {teacherName}</span></div><div className="flex-shrink-0"> <AppLogo mainTextSize="text-lg" taglineTextSize="text-[0px]" iconSize={22} /> </div><div className="text-sm font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md shadow-sm flex items-center w-auto max-w-[calc(33%-20px)] sm:max-w-xs justify-end"><Clock className="h-4 w-4 mr-1.5 flex-shrink-0" /> <span className="truncate">{formatTime(timeLeft)}</span></div></div></header>
      <div className="sticky top-[var(--top-header-height,57px)] z-40 bg-background shadow-sm p-3 border-b border-border"><div className="flex justify-between items-center max-w-full px-2 sm:px-4"><div className="text-sm font-semibold text-foreground truncate max-w-[calc(50%-120px)] sm:max-w-md" title={currentQuestion?.subject || 'Subject'}>SUBJECT: {currentQuestion?.subject || 'N/A'}</div><div className="flex items-center gap-1 sm:gap-2"><Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}><SheetTrigger asChild><Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary h-7 w-7 md:hidden" aria-label="Open Question Navigation"><ListOrdered className="h-5 w-5" /></Button></SheetTrigger><SheetContent side="right" className="w-3/4 p-0 flex flex-col"><ShadcnSheetHeader className="p-3 border-b text-center"><ShadcnSheetTitle className="text-lg">Navigation</ShadcnSheetTitle><ShadcnSheetDescription>Jump to any question or submit.</ShadcnSheetDescription></ShadcnSheetHeader><QuestionPaletteContent /></SheetContent></Sheet><Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary h-7 w-7 hidden md:inline-flex" onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)} aria-label={isRightSidebarOpen ? "Hide Question Panel" : "Show Question Panel"}><MoreVertical className="h-5 w-5" /></Button><Button variant="ghost" size="icon" asChild className="text-muted-foreground hover:text-primary h-7 w-7"><Link href={Routes.studentTestInstructions(testId)} target="_blank"><Info className="h-4 w-4" /></Link></Button></div></div></div>
      <div className={cn("flex-1 flex max-w-full p-2 sm:p-4 gap-2 sm:gap-4 overflow-hidden")}>
        <Card className="flex-1 flex flex-col bg-card shadow-xl rounded-lg border border-border overflow-hidden">
            <CardHeader className="p-3 sm:p-4 border-b border-border bg-muted/30"><div className="flex justify-between items-center"><p className="text-xs sm:text-sm font-medium text-muted-foreground">Question {currentQuestionIndex + 1} of {questions.length}</p><div className="flex items-center gap-1">{currentQuestion.difficulty && <Badge variant={currentQuestion.difficulty === 'Easy' ? 'secondary' : currentQuestion.difficulty === 'Medium' ? 'default' : 'destructive'} className="text-xs px-1.5 py-0.5">{currentQuestion.difficulty}</Badge>}{currentQuestion.marks && <Badge variant="outline" className="text-xs px-1.5 py-0.5">Marks: {currentQuestion.marks}</Badge>}</div></div></CardHeader>
            <ScrollArea className="flex-1 min-h-0"><CardContent className="p-3 sm:p-4 md:p-6 space-y-4">
                <div className="p-2 border-b border-border/50 rounded-md bg-background min-h-[80px]">{currentQuestion.QuestionText && (<div className="prose prose-sm dark:prose-invert max-w-none mb-3 text-foreground leading-relaxed">{renderLatex(currentQuestion.QuestionText)}</div>)}{currentQuestion.QuestionImage && isValidHttpUrl(currentQuestion.QuestionImage) && (<div className="my-2 text-center"><NextImage src={currentQuestion.QuestionImage} alt="Question Image" width={400} height={300} className="rounded object-contain inline-block border" data-ai-hint="question diagram"/></div>)}{!(currentQuestion.QuestionText || (currentQuestion.QuestionImage && isValidHttpUrl(currentQuestion.QuestionImage))) && (<p className="text-xs sm:text-sm text-muted-foreground italic py-3">Question content not provided.</p>)}</div>
                <RadioGroup value={userAnswers[currentQuestion.id]?.selectedOption || ""} onValueChange={handleOptionChange} className="space-y-2.5" disabled={testStage !== 'test_in_progress'}>{renderOption("A")} {renderOption("B")} {renderOption("C")} {renderOption("D")}</RadioGroup>
            </CardContent></ScrollArea>
            <CardFooter className="p-3 sm:p-4 border-t border-border bg-muted/30 flex-wrap justify-center sm:justify-between gap-2"><Button variant="outline" size="sm" onClick={handleClearResponse} disabled={testStage !== 'test_in_progress' || !userAnswers[currentQuestion.id]?.selectedOption}>Clear Response</Button><Button variant={userAnswers[currentQuestion.id]?.markedForReview ? "secondary" : "outline"} size="sm" onClick={handleMarkForReview} disabled={testStage !== 'test_in_progress'} className="border-purple-500 text-purple-600 data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-700 hover:bg-purple-500/10"><Flag className="mr-1.5 h-4 w-4" /> {userAnswers[currentQuestion.id]?.markedForReview ? "Unmark Review" : "Mark for Review"}</Button><Button size="sm" onClick={handleSaveAndNext} disabled={testStage !== 'test_in_progress' || currentQuestionIndex === questions.length - 1} className="bg-green-600 hover:bg-green-700 text-white">Save & Next <ChevronRight className="ml-1.5 h-4 w-4" /></Button></CardFooter>
        </Card>
        {isRightSidebarOpen && (<div className="hidden md:flex w-72 lg:w-80 flex-shrink-0 flex-col space-y-0"><QuestionPaletteContent /></div>)}
      </div>
    </div>
  );
}
