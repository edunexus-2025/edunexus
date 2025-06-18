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
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Clock, Flag, Image as ImageIconLucide, Loader2, Minimize, Send, XCircle, ArrowLeft as BackArrowIcon, Settings as SettingsIcon, Bookmark as BookmarkIconLucide, Check, PlusCircle, Info, ListOrdered, UserCircle as UserCircleIcon, CalendarDays, NotebookText, BarChart, PieChart as PieChartIcon, UserCheck, ListChecks, Eye, X as CloseIcon, MoreVertical, Menu, PanelRightOpen, KeyRound, Lock } from 'lucide-react';
import NextImage from 'next/image';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { AppConfig, Routes, escapeForPbFilter } from '@/lib/constants';
import { AppLogo } from '@/components/layout/AppLogo';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { StudentBookmark, User, UserSubscriptionTierStudent, TeacherTestAttempt } from '@/lib/types';
import Link from 'next/link';
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from '@/components/ui/badge';
import { format, addMinutes, isPast } from 'date-fns';

const TEST_PIN_SESSION_KEY_PREFIX = "teacherTestPinVerified_";

interface TeacherTestDetailsRecord extends RecordModel {
  id: string;
  testName: string;
  Admin_Password?: number;
  duration?: string;
  teacherId: string;
  QBExam?: string;
  model?: "Chapterwise" | "Full Length";
  questions?: string[];
  status?: 'Draft' | 'Published' | 'Archived';
  expand?: {
    teacherId?: {
      id: string;
      name: string;
    };
    questions?: TeacherQuestionRecord[];
  };
}

interface TeacherQuestionRecord extends RecordModel {
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
  subject?: string;
  marks?: number;
  displayQuestionImageUrl?: string | null;
  displayOptionAImageUrl?: string | null;
  displayOptionBImageUrl?: string | null;
  displayOptionCImageUrl?: string | null;
  displayOptionDImageUrl?: string | null;
  displayExplanationImageUrl?: string | null;
}

interface UserAnswerForTeacherTest {
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


export default function StudentTeacherTestLivePage() {
  const params = useParams();
  const router = useRouter();
  const testId = typeof params.testId === 'string' ? params.testId : '';

  const { user, isLoading: isAuthLoading, authRefresh } = useAuth();
  const { toast } = useToast();

  const [testDetails, setTestDetails] = useState<TeacherTestDetailsRecord | null>(null);
  const [teacherName, setTeacherName] = useState<string>('Educator');
  const [questions, setQuestions] = useState<TeacherQuestionRecord[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, UserAnswerForTeacherTest>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isLoadingPageData, setIsLoadingPageData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testSessionState, setTestSessionState] = useState<'initialLoading' | 'pinEntry' | 'instructions' | 'inProgress' | 'completed' | 'terminated'>('initialLoading');
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

  const fetchTestDataAndDecideStage = useCallback(async (isMountedGetter: () => boolean) => {
    if (!testId) { if (isMountedGetter()) { setError("Test ID is missing."); setIsLoadingPageData(false); setTestSessionState('terminated'); } return; }
    if (!user?.id && !isAuthLoading) { if (isMountedGetter()) { setError("User not authenticated. Please login."); setIsLoadingPageData(false); setTestSessionState('terminated'); } return; }
    if (isAuthLoading) { if (isMountedGetter()) setIsLoadingPageData(true); return; }

    if (isMountedGetter()) { setIsLoadingPageData(true); setError(null); }
    console.log(`[LivePage] fetchTestDataAndDecideStage for testId: ${testId}, userId: ${user?.id}`);

    try {
      const fetchedTest = await pb.collection('teacher_tests').getOne<TeacherTestDetailsRecord>(testId, { 
        fields: 'id,testName,status,Admin_Password,duration,questions,teacherId,expand.teacherId.id,expand.teacherId.name,model,QBExam',
        expand: 'teacherId' 
      });
      if (!isMountedGetter()) return;
      console.log("[LivePage] Initial fetched teacher_tests record:", fetchedTest);
      
      if (isMountedGetter()) {
        setTestDetails(fetchedTest);
        setTeacherName(fetchedTest.expand?.teacherId?.name || 'Your Teacher');

        if (fetchedTest.status !== 'Published') {
          setError(`This test ("${fetchedTest.testName}") is not currently published or available.`); 
          setTestSessionState('terminated');
          setIsLoadingPageData(false);
          return;
        }
        
        const pinRequired = fetchedTest.Admin_Password !== null && fetchedTest.Admin_Password !== undefined && String(fetchedTest.Admin_Password).trim() !== "";
        const pinSessionKey = `${TEST_PIN_SESSION_KEY_PREFIX}${testId}`;
        const pinIsVerifiedInSession = sessionStorage.getItem(pinSessionKey) === 'true';

        if (pinRequired && !pinIsVerifiedInSession) {
          console.log("[LivePage] PIN required and not verified in session. Setting state to 'pinEntry'.");
          setTestSessionState('pinEntry');
        } else {
          console.log("[LivePage] No PIN required or already verified in session. Setting state to 'instructions'.");
          setTestSessionState('instructions');
        }
      }
    } catch (err: any) {
      if (isMountedGetter()) {
        const clientError = err as PocketBaseClientResponseError;
        let errorMsg = `Could not load test details. Error: ${clientError.data?.message || clientError.message}.`;
        if (clientError.status === 404) errorMsg = "Test not found or not accessible. Please check the link or contact your teacher.";
        setError(errorMsg);
        setTestSessionState('terminated');
        console.error("[LivePage] Error fetching teacher_tests record:", clientError.data || clientError);
      }
    } finally {
      if (isMountedGetter()) setIsLoadingPageData(false);
    }
  }, [testId, user?.id, isAuthLoading]);

  useEffect(() => {
    let isMounted = true;
    fetchTestDataAndDecideStage(() => isMounted);
    return () => { isMounted = false; };
  }, [fetchTestDataAndDecideStage]);

  const loadQuestions = useCallback(async (isMountedGetter: () => boolean) => {
    if (!testDetails) { if(isMountedGetter()) { setError("Test details not loaded, cannot fetch questions."); setIsLoadingPageData(false); } return;}
    
    const questionIds = testDetails.questions || [];
    
    if (questionIds.length === 0) {
      if (isMountedGetter()) { 
        setError("No questions are associated with this test. Please contact the teacher."); 
        setQuestions([]); 
        setIsLoadingPageData(false);
      }
      return;
    }
    if (!testDetails.teacherId) {
      if (isMountedGetter()) { setError("Teacher ID is missing from test details. Cannot load questions."); setIsLoadingPageData(false); }
      return;
    }

    if (isMountedGetter()) setIsLoadingPageData(true);
    console.log("[LivePage] loadQuestions: Attempting to fetch questions. Question IDs from teacher_tests:", questionIds);

    try {
      const questionFilter = questionIds.map(id => `id = "${escapeForPbFilter(id)}"`).join(' || ');
      
      console.log("Fetching questions from 'teacher_question_data' with filter:", questionFilter);
      const fetchedQuestionsFromDb = await pb.collection('teacher_question_data').getFullList<TeacherQuestionRecord>({
          filter: questionFilter,
          sort: '+created',
          fields: 'id,QuestionText,QuestionImage,OptionAText,OptionAImage,OptionBText,OptionBImage,OptionCText,OptionCImage,OptionDText,OptionDImage,CorrectOption,explanationText,explanationImage,subject,marks',
          '$autoCancel': false,
      });
      if (!isMountedGetter()) return;
      
      console.log(`[LivePage] Fetched ${fetchedQuestionsFromDb.length} questions from teacher_question_data.`);
      
      if (fetchedQuestionsFromDb.length === 0 && questionIds.length > 0) {
          setError("Could not load questions for this test. Ensure questions are correctly linked and API rules for 'teacher_question_data' allow student access.");
          setQuestions([]);
          setIsLoadingPageData(false);
          return;
      }

      const questionsWithUrls = fetchedQuestionsFromDb.map(q => ({
        ...q,
        displayQuestionImageUrl: isValidHttpUrl(q.QuestionImage) ? q.QuestionImage : null,
        displayOptionAImageUrl: isValidHttpUrl(q.OptionAImage) ? q.OptionAImage : null,
        displayOptionBImageUrl: isValidHttpUrl(q.OptionBImage) ? q.OptionBImage : null,
        displayOptionCImageUrl: isValidHttpUrl(q.OptionCImage) ? q.OptionCImage : null,
        displayOptionDImageUrl: isValidHttpUrl(q.OptionDImage) ? q.OptionDImage : null,
        displayExplanationImageUrl: isValidHttpUrl(q.explanationImage) ? q.explanationImage : null,
        marks: typeof q.marks === 'number' ? q.marks : 1,
      }));
      
      if (isMountedGetter()) {
        setQuestions(questionsWithUrls);
        const initialAnswers: Record<string, UserAnswerForTeacherTest> = {};
        questionsWithUrls.forEach(q => {
          initialAnswers[q.id] = { questionId: q.id, selectedOption: null, isCorrect: null, markedForReview: false, timeSpentSeconds: 0 };
        });
        setUserAnswers(initialAnswers);
        setCurrentQuestionIndex(0);
        questionStartTimeRef.current = Date.now();
        console.log("[LivePage] Questions loaded successfully and answers initialized.");
      }

    } catch (err: any) {
      if (isMountedGetter()) {
        const clientError = err as PocketBaseClientResponseError;
        setError(`Critical error loading questions: ${clientError.data?.message || clientError.message}. Check API Rules & question links.`);
        setTestSessionState('terminated');
        console.error("[LivePage] Critical error in loadQuestions:", clientError.data || clientError);
      }
    } finally {
      if (isMountedGetter()) setIsLoadingPageData(false);
    }
  }, [testDetails, toast, escapeForPbFilter]);
  
  useEffect(() => { 
    let timerId: NodeJS.Timeout | null = null;
    if (testSessionState === 'inProgress' && timeLeft !== null && timeLeft > 0) {
      timerId = setInterval(() => {
        setTimeLeft(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else if (timeLeft === 0 && testSessionState === 'inProgress') {
      if (timerId) clearInterval(timerId);
      handleSubmitTest(true, "time_up");
    }
    return () => { if (timerId) clearInterval(timerId); };
  }, [testSessionState, timeLeft, handleSubmitTest]);

  const handlePinVerify = async () => {
    if (!testDetails || testDetails.Admin_Password === undefined || testDetails.Admin_Password === null) { setPinError("Test PIN configuration error."); return; }
    setIsVerifyingPin(true); setPinError(null);
    if (enteredPin === String(testDetails.Admin_Password)) {
      toast({ title: "PIN Verified!", description: "Loading test instructions..." });
      sessionStorage.setItem(`${TEST_PIN_SESSION_KEY_PREFIX}${testId}`, 'true');
      setTestSessionState('instructions');
    } else {
      setPinError("Invalid PIN. Please try again.");
      toast({ title: "Incorrect PIN", variant: "destructive" });
    }
    setIsVerifyingPin(false);
  };

  const handleStartTestAfterInstructions = () => {
    if (!testDetails || !testDetails.duration) { toast({ title: "Error", description: "Test duration not set.", variant: "destructive" }); return; }
    
    const durationMinutes = parseInt(testDetails.duration, 10);
    setTimeLeft(isNaN(durationMinutes) || durationMinutes <= 0 ? 3600 : durationMinutes * 60);
    setTestSessionState('inProgress'); 
    
    let isMounted = true;
    loadQuestions(() => isMounted);
  };
  
  const handleSubmitTest = useCallback(async (autoSubmit = false, terminationReason?: string) => {
     if (!user || !testDetails || !testDetails.teacherId || isSubmittingTest || testSessionState === 'completed' || testSessionState === 'terminated') {
      console.warn("handleSubmitTest (teacher test) blocked. Conditions not met.", {userExists: !!user, testDetailsExists: !!testDetails, teacherIdExists: !!testDetails?.teacherId, isSubmittingTest, testSessionState});
      return;
    }
    setIsSubmittingTest(true);
    if(currentQuestion && userAnswers[currentQuestion.id] && questionStartTimeRef.current && testSessionState === 'inProgress') {
        const currentTime = Date.now();
        const timeSpentCurrentQuestion = Math.round((currentTime - questionStartTimeRef.current) / 1000);
        userAnswers[currentQuestion.id].timeSpentSeconds = (userAnswers[currentQuestion.id].timeSpentSeconds || 0) + timeSpentCurrentQuestion;
    }

    let correctCount = 0; let attemptedCount = 0; let pointsEarnedFromTest = 0;
    const answersLog = questions.map(q => {
      const userAnswerRec = userAnswers[q.id]; const selected = userAnswerRec?.selectedOption || null; let isCorrectAns = false;
      const correctOptionValue = q.CorrectOption?.replace("Option ", "") as "A"|"B"|"C"|"D" | undefined;
      const questionMarks = typeof q.marks === 'number' ? q.marks : 1;
      
      if (selected) { 
        attemptedCount++; 
        if (selected === `Option ${correctOptionValue}`) { 
          correctCount++; 
          isCorrectAns = true; 
          pointsEarnedFromTest += questionMarks;
        } 
      }
      return { questionId: q.id, selectedOption: selected, correctOption: correctOptionValue ? `Option ${correctOptionValue}` : null, isCorrect: isCorrectAns, markedForReview: userAnswerRec?.markedForReview || false, timeSpentSeconds: userAnswerRec?.timeSpentSeconds || 0 };
    });
    
    const maxScorePossible = questions.reduce((sum, q) => sum + (typeof q.marks === 'number' ? q.marks : 1), 0);
    const percentage = maxScorePossible > 0 ? (pointsEarnedFromTest / maxScorePossible) * 100 : 0;
    const finalTestStatus: TeacherTestAttempt['status'] = terminationReason ? 'terminated_time_up' : 'completed';
    const durationTakenSecs = testDetails?.duration ? parseInt(testDetails.duration, 10) * 60 - (timeLeft || 0) : 0;
    
    const resultDataToSave: Partial<TeacherTestAttempt> = {
      student: user.id, teacher_test: testDetails.id, teacher: testDetails.teacherId, test_name_cache: testDetails.testName,
      plan_type_cache: testDetails.model || 'N/A', score: pointsEarnedFromTest, max_score: maxScorePossible,
      percentage: parseFloat(percentage.toFixed(2)), status: finalTestStatus,
      started_at: new Date(Date.now() - durationTakenSecs * 1000).toISOString(), completed_at: new Date().toISOString(),
      duration_taken_seconds: durationTakenSecs, answers_log: JSON.stringify(answersLog),
      total_questions_in_test_cache: questions.length, attempted_questions_count: attemptedCount,
      correct_answers_count: correctCount, incorrect_answers_count: attemptedCount - correctCount,
      unattempted_questions_count: questions.length - attemptedCount,
    };

    try {
      const createdResultRecord = await pb.collection('teacher_test_attempts').create(resultDataToSave);
      setTestSessionState(finalTestStatus === 'completed' ? 'completed' : 'terminated'); setTimeLeft(0);
      toast({ title: autoSubmit ? (terminationReason ? "Test Terminated" : "Test Auto-Submitted") : "Test Submitted Successfully!", description: `Your results for "${testDetails.testName}" have been recorded. ${terminationReason ? `Reason: ${terminationReason.replace(/_/g, ' ')}.` : ''}` });
      router.push(Routes.testResultTeacherTest(createdResultRecord.id));
    } catch (err: any) { console.error("Failed to submit teacher test results:", err); toast({ title: "Submission Failed", description: `Could not save results: ${err.data?.message || err.message}`, variant: "destructive" }); }
    finally { setIsSubmittingTest(false); }
  }, [user, testDetails, questions, userAnswers, timeLeft, router, toast, isSubmittingTest, testSessionState, currentQuestion, authRefresh]);

  const handleOptionChange = (value: string) => { if (testSessionState !== 'inProgress' || !currentQuestion) return; setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...(prev[currentQuestion.id] || { questionId: currentQuestion.id, timeSpentSeconds: 0, markedForReview: false }), selectedOption: value, isCorrect: null, }})); };
  const handleClearResponse = () => { if (testSessionState !== 'inProgress' || !currentQuestion) return; setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...(prev[currentQuestion.id] || { questionId: currentQuestion.id, timeSpentSeconds: 0 }), selectedOption: null, isCorrect: null, }})); };
  const handleMarkForReview = () => { if (testSessionState !== 'inProgress' || !currentQuestion) return; setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...(prev[currentQuestion.id] || { questionId: currentQuestion.id, selectedOption: null, isCorrect: null, timeSpentSeconds: 0 }), markedForReview: !prev[currentQuestion.id]?.markedForReview, }})); };
  const navigateQuestion = (directionOrIndex: 'next' | 'prev' | number) => {
    if (testSessionState !== 'inProgress' || !currentQuestion) return;
    if (userAnswers[currentQuestion.id]) {
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
  const formatTime = (seconds: number | null): string => { if (seconds === null || seconds < 0) seconds = 0; const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = seconds % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; };
  const getQuestionStatusForPalette = (questionId: string): 'answered' | 'notAnswered' | 'markedForReview' | 'markedAndAnswered' | 'notVisited' => { const answer = userAnswers[questionId]; if (!answer || (answer.selectedOption === null && !answer.markedForReview)) return 'notVisited'; if (answer.selectedOption) { return answer.markedForReview ? 'markedAndAnswered' : 'answered'; } else { return answer.markedForReview ? 'markedForReview' : 'notAnswered'; }};
  const questionPaletteButtonClass = (status: ReturnType<typeof getQuestionStatusForPalette>, isActive: boolean) => { if (isActive) return "bg-primary text-primary-foreground border-primary ring-2 ring-offset-1 ring-primary"; switch (status) { case 'answered': return "bg-green-500 hover:bg-green-600 text-white border-green-500"; case 'notAnswered': return "bg-red-500 hover:bg-red-600 text-white border-red-500"; case 'markedForReview': return "bg-purple-500 hover:bg-purple-600 text-white border-purple-500"; case 'markedAndAnswered': return "bg-orange-500 hover:bg-orange-600 text-white border-orange-500"; case 'notVisited': default: return "bg-card hover:bg-muted/80 text-muted-foreground border-border"; }};
  const renderOption = (optionKey: "A" | "B" | "C" | "D"): React.ReactNode => { if(!currentQuestion) return null; const textKey = `Option${optionKey}Text` as keyof TeacherQuestionRecord; const imageKey = `Option${optionKey}Image` as keyof TeacherQuestionRecord; const optionText = currentQuestion[textKey]; const imageUrl = currentQuestion[imageKey] as string | null; const optionValue = `Option ${optionKey}`; return ( <Label htmlFor={`option-${currentQuestion.id}-${optionKey}`} className={cn("flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-all hover:shadow-md", userAnswers[currentQuestion.id]?.selectedOption === optionValue ? 'bg-primary/10 border-primary ring-1 ring-primary' : 'bg-card border-border hover:border-primary/50')}> <RadioGroupItem value={optionValue} id={`option-${currentQuestion.id}-${optionKey}`} className="mt-1 border-muted-foreground data-[state=checked]:border-primary shrink-0" /> <div className="flex-1 text-sm"> <div className="font-semibold">{optionKey}.</div> {optionText && <div className="prose prose-sm dark:prose-invert max-w-none mt-0.5">{renderLatex(optionText as string)}</div>} {imageUrl && isValidHttpUrl(imageUrl) && (<div className="mt-1.5"><NextImage src={imageUrl} alt={`Option ${optionKey}`} width={200} height={100} className="rounded object-contain border" data-ai-hint="option illustration"/></div>)} {!(optionText || imageUrl) && <p className="text-muted-foreground italic">Option {optionKey} content not available.</p>} </div> </Label> ); };
  const QuestionPaletteContent = () => ( <> <Card className="shadow-none border-0 md:border md:shadow-sm md:rounded-lg md:bg-card"> <CardHeader className="p-3 border-b text-center"> <UserCircleIcon className="mx-auto h-10 w-10 text-primary mb-1" /> <CardTitle className="text-base">{user?.name || "Student"}</CardTitle> <CardDescription className="text-xs truncate">{user?.email}</CardDescription> <CardDescription className="text-xs">{todayDate}</CardDescription> </CardHeader> </Card> <Card className="border-primary/30 bg-primary/5 flex-1 flex flex-col min-h-0 shadow-md rounded-lg md:mt-3"> <CardHeader className="p-2 text-center border-b border-primary/20"><CardTitle className="text-sm text-primary">QUESTION NAVIGATION</CardTitle></CardHeader> <CardContent className="p-2 flex-1 overflow-hidden"><ScrollArea className="h-full"><div className="grid grid-cols-5 sm:grid-cols-4 gap-1.5 p-1">{questions.map((q, index) => { const status = getQuestionStatusForPalette(q.id); const isActive = currentQuestionIndex === index; return ( <Button key={q.id} variant="outline" size="icon" className={cn("h-8 w-full text-xs rounded-md aspect-square", questionPaletteButtonClass(status, isActive))} onClick={() => { navigateQuestion(index); if (isMobileSheetOpen) setIsMobileSheetOpen(false); }} disabled={testSessionState !== 'inProgress'} aria-label={`Go to question ${index + 1}, Status: ${(status || 'Not Visited').replace(/([A-Z])/g, ' $1')}`}>{index + 1}{userAnswers[q.id]?.markedForReview && userAnswers[q.id]?.selectedOption && <Check className="absolute h-2.5 w-2.5 bottom-0.5 right-0.5 text-white" />}</Button> );})}</div></ScrollArea></CardContent> </Card> <div className="p-3 border-t bg-card md:bg-transparent rounded-b-lg md:shadow-md mt-auto md:mt-3"> <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" className="w-full text-sm py-2.5" disabled={testSessionState !== 'inProgress' || isSubmittingTest}><Send className="mr-1.5 h-4 w-4" /> Submit Test</Button></AlertDialogTrigger><AlertDialogContent><RadixAlertDialogHeader><RadixAlertDialogTitle>Confirm Submission</RadixAlertDialogTitle><RadixAlertDialogDescription>Are you sure you want to submit your test?</RadixAlertDialogDescription></RadixAlertDialogHeader><RadixAlertDialogFooter><AlertDialogCancel disabled={isSubmittingTest}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleSubmitTest(false)} disabled={isSubmittingTest}>{isSubmittingTest && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Yes, Submit</AlertDialogAction></RadixAlertDialogFooter></AlertDialogContent></AlertDialog></div> </> );

  if (isLoadingPageData || isAuthLoading || testSessionState === 'initialLoading') { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" /> <p className="text-lg">Loading test environment...</p> </div> ); }
  if (error) { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Card className="w-full max-w-lg text-center shadow-xl bg-background text-foreground"> <CardHeader> <AlertCircle className="mx-auto h-12 w-12 text-destructive" /> <CardTitle className="text-destructive">Error Loading Test</CardTitle> </CardHeader> <CardContent><p className="text-muted-foreground whitespace-pre-wrap">{error}</p></CardContent> <CardFooter><Button onClick={() => router.back()} variant="outline" className="w-full">Go Back</Button></CardFooter> </Card> </div> ); }
  if (testSessionState === 'pinEntry') { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 p-4"> <Card className="w-full max-w-sm shadow-xl bg-card text-foreground"> <CardHeader><CardTitle className="text-xl flex items-center gap-2"><KeyRound className="text-primary"/>Enter Test PIN</CardTitle><CardDescription>This test by {teacherName} requires a PIN.</CardDescription></CardHeader> <CardContent className="space-y-4"> <Input type="password" placeholder="Enter PIN" value={enteredPin} onChange={(e) => setEnteredPin(e.target.value)} className="text-center text-lg tracking-widest" maxLength={6} autoFocus/> {pinError && <p className="text-sm text-destructive text-center">{pinError}</p>} </CardContent> <CardFooter className="flex-col gap-2"> <Button onClick={handlePinVerify} className="w-full" disabled={isVerifyingPin || enteredPin.length < 4}> {isVerifyingPin && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Verify PIN & Continue </Button> <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-xs text-muted-foreground">Cancel & Go Back</Button> </CardFooter> </Card> </div> ); }
  if (testSessionState === 'instructions') {
    const totalQuestionsFromDetails = testDetails?.questions?.length || 0;
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 p-4">
        <Card className="w-full max-w-2xl shadow-xl bg-card text-foreground">
          <CardHeader><CardTitle className="text-2xl">Test Instructions: {testDetails?.testName || "Test"}</CardTitle><CardDescription>From: {teacherName}. Read carefully.</CardDescription></CardHeader>
          <CardContent className="max-h-[60vh] overflow-y-auto prose prose-sm dark:prose-invert">
            <p>Total Questions: {totalQuestionsFromDetails > 0 ? totalQuestionsFromDetails : "N/A"}</p>
            <p>Duration: {testDetails?.duration || 'N/A'} minutes</p>
            <p>This test is conducted by: {teacherName}.</p>
            <h4>General Instructions:</h4><ol><li>The clock will be set at the server. The countdown timer in the top right corner of screen will display the remaining time available for you to complete the examination.</li><li>When the timer reaches zero, the examination will end by itself. You will not be required to end or submit your examination.</li><li>The Question Palette on the right shows question status.</li></ol>
          </CardContent>
          <CardFooter className="justify-center">
            <Button onClick={handleStartTestAfterInstructions} size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">I'm Ready, Start Test!</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  if (testSessionState === 'completed' || testSessionState === 'terminated') { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Card className="w-full max-w-lg text-center shadow-xl bg-background text-foreground"> <CardHeader> {testSessionState === 'completed' ? <CheckCircle className="mx-auto h-12 w-12 text-green-500" /> : <XCircle className="mx-auto h-12 w-12 text-destructive" />} <CardTitle>{testSessionState === 'completed' ? "Test Completed" : "Test Terminated"}</CardTitle> </CardHeader> <CardContent><p className="text-muted-foreground">{testSessionState === 'completed' ? "Your responses have been submitted." : "This test session has been terminated."}</p></CardContent> <CardFooter> <Button onClick={() => { if (window.opener && !window.opener.closed) window.close(); else router.push(Routes.dashboard);}} className="w-full"> Close Window / Back to Dashboard </Button> </CardFooter> </Card> </div> ); }
  if (!currentQuestion && testSessionState === 'inProgress' && !isLoadingPageData) { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Card className="w-full max-w-lg text-center shadow-xl bg-background text-foreground"> <CardHeader> <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" /> <CardTitle>No Questions</CardTitle> </CardHeader> <CardContent><p className="text-muted-foreground">No questions loaded for this test, or you've finished. If this is unexpected, please contact your teacher.</p></CardContent> <CardFooter><Button onClick={() => handleSubmitTest(false, "no_questions_or_finished")} variant="outline" className="w-full">Submit & End Test</Button></CardFooter> </Card> </div> );}
  
  return (
    <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-900">
      <header className="sticky top-0 z-50 bg-card shadow-md p-3 border-b border-border">
        <div className="flex justify-between items-center max-w-full px-2 sm:px-4">
          <div className="text-xs sm:text-sm font-medium text-muted-foreground truncate max-w-[calc(33%-20px)] sm:max-w-xs" title={testDetails?.testName || 'Test'}>
            {testDetails?.testName || 'Test Name'} <br/>
            <span className="text-[10px] sm:text-xs">Teacher: {teacherName}</span>
          </div>
          <div className="flex-shrink-0"> <AppLogo mainTextSize="text-lg" taglineTextSize="text-[0px]" iconSize={22} /> </div>
          <div className="text-sm font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md shadow-sm flex items-center w-auto max-w-[calc(33%-20px)] sm:max-w-xs justify-end"><Clock className="h-4 w-4 mr-1.5 flex-shrink-0" /> <span className="truncate">{formatTime(timeLeft)}</span></div>
        </div>
      </header>
      <div className="sticky top-[var(--top-header-height,57px)] z-40 bg-background shadow-sm p-3 border-b border-border">
         <div className="flex justify-between items-center max-w-full px-2 sm:px-4">
            <div className="text-sm font-semibold text-foreground truncate max-w-[calc(50%-120px)] sm:max-w-md" title={currentQuestion?.subject || testDetails?.QBExam || 'Subject'}>SUBJECT: {currentQuestion?.subject || testDetails?.QBExam || 'N/A'}</div>
            <div className="flex items-center gap-1 sm:gap-2">
                <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}><SheetTrigger asChild><Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary h-7 w-7 md:hidden" aria-label="Open Question Navigation"><ListOrdered className="h-5 w-5" /></Button></SheetTrigger><SheetContent side="right" className="w-3/4 p-0 flex flex-col"><ShadcnSheetHeader className="p-3 border-b text-center"><ShadcnSheetTitle className="text-lg">Navigation</ShadcnSheetTitle><ShadcnSheetDescription>Jump to any question or submit.</ShadcnSheetDescription></ShadcnSheetHeader><QuestionPaletteContent /></SheetContent></Sheet>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary h-7 w-7 hidden md:inline-flex" onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)} aria-label={isRightSidebarOpen ? "Hide Question Panel" : "Show Question Panel"}><Menu className="h-5 w-5" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setTestSessionState('instructions')} className="text-muted-foreground hover:text-primary h-7 w-7"><Info className="h-4 w-4" /></Button>
            </div>
        </div>
      </div>
      <div className={cn("flex-1 flex max-w-full p-2 sm:p-4 gap-2 sm:gap-4 overflow-hidden")}>
        <Card className="flex-1 flex flex-col bg-card shadow-xl rounded-lg border border-border overflow-hidden">
            <CardHeader className="p-3 sm:p-4 border-b border-border bg-muted/30"><div className="flex justify-between items-center"><p className="text-xs sm:text-sm font-medium text-muted-foreground">Question {currentQuestionIndex + 1} of {questions.length}</p></div></CardHeader>
            <ScrollArea className="flex-1 min-h-0"><CardContent className="p-3 sm:p-4 md:p-6 space-y-4">
                  <div className="p-2 border-b border-border/50 rounded-md bg-background min-h-[80px]">{currentQuestion.QuestionText && (<div className="prose prose-sm dark:prose-invert max-w-none mb-3 text-foreground leading-relaxed">{renderLatex(currentQuestion.QuestionText)}</div>)}{isValidHttpUrl(currentQuestion.QuestionImage) && (<div className="my-2 text-center"><NextImage src={currentQuestion.QuestionImage!} alt="Question Image" width={400} height={300} className="rounded object-contain inline-block border" data-ai-hint="question diagram"/></div>)}{!(currentQuestion.QuestionText || isValidHttpUrl(currentQuestion.QuestionImage)) && (<p className="text-xs sm:text-sm text-muted-foreground italic py-3">Question content not provided.</p>)}</div>
                  <RadioGroup value={userAnswers[currentQuestion.id]?.selectedOption || ""} onValueChange={handleOptionChange} className="space-y-2.5" disabled={testSessionState !== 'inProgress'}>{renderOption("A")} {renderOption("B")} {renderOption("C")} {renderOption("D")}</RadioGroup>
            </CardContent></ScrollArea>
            <CardFooter className="p-3 sm:p-4 border-t border-border bg-muted/30 flex-wrap justify-center sm:justify-between gap-2"><Button variant="outline" size="sm" onClick={handleClearResponse} disabled={testSessionState !== 'inProgress' || !userAnswers[currentQuestion.id]?.selectedOption}>Clear Response</Button><Button variant={userAnswers[currentQuestion.id]?.markedForReview ? "secondary" : "outline"} size="sm" onClick={handleMarkForReview} disabled={testSessionState !== 'inProgress'} className="border-purple-500 text-purple-600 data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-700 hover:bg-purple-500/10"><Flag className="mr-1.5 h-4 w-4" /> {userAnswers[currentQuestion.id]?.markedForReview ? "Unmark Review" : "Mark for Review"}</Button><Button size="sm" onClick={handleSaveAndNext} disabled={testSessionState !== 'inProgress' || currentQuestionIndex === questions.length - 1} className="bg-green-600 hover:bg-green-700 text-white">Save & Next <ChevronRight className="ml-1.5 h-4 w-4" /></Button></CardFooter>
        </Card>
        {isRightSidebarOpen && (<div className="hidden md:flex w-72 lg:w-80 flex-shrink-0 flex-col space-y-0"><QuestionPaletteContent /></div>)}
      </div>
    </div>
  );
}
