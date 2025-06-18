
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
import { Sheet, SheetContent, SheetHeader as ShadcnSheetHeader, SheetTitle as ShadcnSheetTitle, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader as ShadcnDialogHeader, DialogTitle as ShadcnDialogTitle } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Clock, Expand, Flag, Image as ImageIconLucide, Loader2, Minimize, Send, XCircle, ArrowLeft as BackArrowIcon, Settings as SettingsIcon, Bookmark as BookmarkIconLucide, Check, PlusCircle, Info, ListOrdered, UserCircle as UserCircleIcon, CalendarDays, NotebookText, BarChart, PieChart as PieChartIcon, UserCheck, ListChecks, Eye, X as CloseIcon, MoreVertical, Menu, PanelRightOpen } from 'lucide-react';
import NextImage from 'next/image';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { AppConfig, Routes, escapeForPbFilter } from '@/lib/constants';
import { AppLogo } from '@/components/layout/AppLogo';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { StudentBookmark, User, TeacherTestStudentResult, TeacherTestAnswerLogItem } from '@/lib/types';
import Link from 'next/link';
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';


interface TeacherTestRecord extends RecordModel {
  id: string;
  testName: string;
  teacherId: string; // Relation to teacher_data
  duration: string; // Stored as string, e.g., "90" for 90 minutes
  Admin_Password?: string;
  questions: string[]; // Array of question IDs from teacher_question_data
  status?: 'Draft' | 'Published' | 'Archived';
  expand?: {
    teacherId?: {
        id: string;
        name: string;
    }
  }
}

interface TeacherQuestionRecord extends RecordModel {
  id: string;
  QuestionText?: string;
  QuestionImage?: string | null; // URL or filename
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
  LessonName?: string;
  teacher?: string;
  subject?: string; // Assuming this might be present
  marks?: number;
  // Fields for constructing display URLs
  displayQuestionImageUrl?: string | null;
  displayOptionAImageUrl?: string | null;
  displayOptionBImageUrl?: string | null;
  displayOptionCImageUrl?: string | null;
  displayOptionDImageUrl?: string | null;
}


const getPbFileUrl = (record: RecordModel | null | undefined, fieldName: string): string | null => {
  if (record && record[fieldName] && record.collectionId && record.collectionName && typeof record[fieldName] === 'string') {
    try {
      return pb.files.getUrl(record, record[fieldName] as string);
    } catch (e) {
      console.warn(`TeacherTestLivePage: Error getting URL for ${fieldName} in record ${record.id}:`, e);
      return null;
    }
  }
  return null;
};


export default function TeacherTestLivePage() {
  const params = useParams();
  const router = useRouter();
  const { testId } = params;
  const { user, isLoading: isAuthLoading, authRefresh } = useAuth();
  const { toast } = useToast();

  const [testDetails, setTestDetails] = useState<TeacherTestRecord | null>(null);
  const [questions, setQuestions] = useState<TeacherQuestionRecord[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, TeacherTestAnswerLogItem>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<'pin_entry' | 'instructions' | 'in_progress' | 'completed' | 'terminated'>('pin_entry');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinAttempts, setPinAttempts] = useState(0);
  const MAX_PIN_ATTEMPTS = 3;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);

  const currentQuestion = questions[currentQuestionIndex];
  const questionStartTimeRef = useRef<number>(Date.now());
  const todayDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const fetchTestAndQuestions = useCallback(async (isMountedGetter: () => boolean) => {
    const currentTestId = typeof testId === 'string' ? testId : '';
    if (!currentTestId || !user?.id) {
      if (isMountedGetter()) { setError("Test ID or User ID missing."); setIsLoading(false); }
      return;
    }
    if (isMountedGetter()) setIsLoading(true);

    try {
      const fetchedTestDetails = await pb.collection('teacher_tests').getOne<TeacherTestRecord>(currentTestId, { expand: 'teacherId', '$autoCancel': false });
      if (!isMountedGetter()) return;
      if (fetchedTestDetails.status !== 'Published') {
        if (isMountedGetter()) { setError("This test is not currently available or has been unpublished by the teacher."); setIsLoading(false); setTestStatus('terminated');}
        return;
      }
      setTestDetails(fetchedTestDetails);

      const questionIds = fetchedTestDetails.questions || [];
      if (questionIds.length === 0) {
        if (isMountedGetter()) { setError("No questions found for this test."); setQuestions([]); setIsLoading(false); }
        return;
      }

      const questionRecordsPromises = questionIds.map(id =>
        pb.collection('teacher_question_data').getOne<TeacherQuestionRecord>(id, { '$autoCancel': false })
        .catch(err => {
          console.error(`Failed to fetch question ${id} from teacher_question_data:`, err.data || err);
          return null; 
        })
      );
      const resolvedQuestions = await Promise.all(questionRecordsPromises);
      const fetchedQuestionsFromDb = resolvedQuestions.filter(q => q !== null).map(q => {
        if (!q) return null; // Should be filtered out by previous line, but for TS
        return ({
          ...q,
          displayQuestionImageUrl: getPbFileUrl(q, 'QuestionImage'),
          displayOptionAImageUrl: getPbFileUrl(q, 'OptionAImage'),
          displayOptionBImageUrl: getPbFileUrl(q, 'OptionBImage'),
          displayOptionCImageUrl: getPbFileUrl(q, 'OptionCImage'),
          displayOptionDImageUrl: getPbFileUrl(q, 'OptionDImage'),
          displayExplanationImageUrl: getPbFileUrl(q, 'explanationImage'), // Field from teacher_question_data
          marks: typeof q.marks === 'number' ? q.marks : 1, // Assuming a default mark
        });
      }).filter(Boolean) as TeacherQuestionRecord[];

      if (isMountedGetter()) {
        if (fetchedQuestionsFromDb.length === 0 && questionIds.length > 0) setError("Questions configured for this test could not be loaded.");
        setQuestions(fetchedQuestionsFromDb);
        const initialAnswers: Record<string, TeacherTestAnswerLogItem> = {};
        fetchedQuestionsFromDb.forEach(q => {
          initialAnswers[q.id] = { questionId: q.id, selectedOption: null, correctOption: q.CorrectOption || null, isCorrect: false, timeSpentSeconds: 0, markedForReview: false };
        });
        setUserAnswers(initialAnswers);
      }
    } catch (err: any) {
      if (isMountedGetter()) { setError(`Could not load test data. Error: ${err.data?.message || err.message}`); }
    } finally {
      if (isMountedGetter()) setIsLoading(false);
    }
  }, [testId, user?.id]);

  useEffect(() => {
    let isMounted = true;
    if (!isAuthLoading && user?.id) {
      fetchTestAndQuestions(() => isMounted);
    } else if (!isAuthLoading && !user?.id) {
      setError("User not authenticated."); setIsLoading(false);
    }
    return () => { isMounted = false; };
  }, [testId, user?.id, isAuthLoading, fetchTestAndQuestions]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testDetails || !testDetails.Admin_Password) { setPinError("Test details not loaded or PIN not set."); return; }
    if (pinInput === String(testDetails.Admin_Password)) {
      setTestStatus('instructions'); setPinError(null);
    } else {
      setPinAttempts(prev => prev + 1);
      if (pinAttempts + 1 >= MAX_PIN_ATTEMPTS) {
        setTestStatus('terminated'); setError("Maximum PIN attempts exceeded."); setPinError("Maximum attempts reached. Test locked.");
      } else {
        setPinError(`Incorrect PIN. ${MAX_PIN_ATTEMPTS - (pinAttempts + 1)} attempts remaining.`);
      }
    }
  };

  const handleStartTestFromInstructions = () => {
    if (!testDetails) return;
    const durationMinutes = parseInt(testDetails.duration, 10);
    if (!isNaN(durationMinutes)) { setTimeLeft(durationMinutes * 60); } else { setTimeLeft(3600); /* Default 1 hour */ }
    setTestStatus('in_progress');
    questionStartTimeRef.current = Date.now();
  };

  const handleSubmitTest = useCallback(async (autoSubmit = false, terminationReason?: string) => {
    if (!user || !testDetails || isSubmitting || (testStatus !== 'in_progress' && !(autoSubmit && testStatus === 'pin_entry'))) {
      console.warn("handleSubmitTest blocked. Conditions not met:", { userId: !!user?.id, testDetails: !!testDetails, isSubmitting, testStatus }); return;
    }
    setIsSubmitting(true);
    if(currentQuestion && userAnswers[currentQuestion.id] && questionStartTimeRef.current && testStatus === 'in_progress') {
      const currentTime = Date.now();
      const timeSpentCurrentQuestion = Math.round((currentTime - questionStartTimeRef.current) / 1000);
      userAnswers[currentQuestion.id].timeSpentSeconds = (userAnswers[currentQuestion.id].timeSpentSeconds || 0) + timeSpentCurrentQuestion;
    }

    let correctCount = 0; let incorrectCount = 0; let attemptedCount = 0; let pointsEarnedFromTest = 0;
    const answersLogForDb = questions.map(q => {
      const userAnswerRec = userAnswers[q.id];
      const selected = userAnswerRec?.selectedOption || null;
      let isCorrectAns = false;
      const questionCorrectOptionNormalized = q.CorrectOption?.replace("Option ", "") as "A" | "B" | "C" | "D" | undefined;

      if (selected && questionCorrectOptionNormalized) {
        attemptedCount++;
        const selectedOptionLetter = selected.replace("Option ", "");
        if (selectedOptionLetter === questionCorrectOptionNormalized) {
          correctCount++; isCorrectAns = true; pointsEarnedFromTest += (q.marks || 1);
        } else {
          incorrectCount++;
        }
      }
      return { questionId: q.id, selectedOption: selected, correctOption: q.CorrectOption || null, isCorrect: isCorrectAns, markedForReview: userAnswerRec?.markedForReview || false, timeSpentSeconds: userAnswerRec?.timeSpentSeconds || 0 };
    });

    const maxScore = questions.reduce((sum, q) => sum + (q.marks || 1), 0);
    const percentage = maxScore > 0 ? (pointsEarnedFromTest / maxScore) * 100 : 0;
    const finalTestStatusString: TeacherTestStudentResult['status'] = terminationReason ? (terminationReason as TeacherTestStudentResult['status']) : 'completed';
    const durationTaken = testDetails?.duration ? parseInt(testDetails.duration, 10) * 60 - (timeLeft || 0) : 0;
    const resultDataToSave: Omit<TeacherTestStudentResult, 'id' | 'created' | 'updated' | 'collectionId' | 'collectionName'> = {
      student: user.id, teacher_test: testDetails.id, teacher: testDetails.teacherId, test_name_cache: testDetails.testName,
      start_time: new Date(Date.now() - durationTaken * 1000).toISOString(), end_time: new Date().toISOString(),
      duration_taken_seconds: durationTaken, total_questions_in_test: questions.length, attempted_questions: attemptedCount,
      correct_answers: correctCount, incorrect_answers: incorrectCount, unattempted_questions: questions.length - attemptedCount,
      score_obtained: pointsEarnedFromTest, max_score_possible: maxScore, percentage: parseFloat(percentage.toFixed(2)),
      answers_log: JSON.stringify(answersLogForDb), status: finalTestStatusString,
      plan_type_at_attempt: 'TeacherPlan_Student', // Assuming this test is always taken under a teacher's plan context
    };

    try {
      const createdResult = await pb.collection('teacher_test_student_results').create(resultDataToSave);
      setTestStatus(finalTestStatusString); setTimeLeft(0);
      toast({ title: autoSubmit ? (terminationReason ? "Test Terminated" : "Test Auto-Submitted") : "Test Submitted Successfully!", description: `Your results have been recorded. ${terminationReason ? `Reason: ${terminationReason.replace(/_/g, ' ')}.` : ''}` });
      // Here, instead of redirecting to a generic result page, you might want a specific result page for teacher tests or just close.
      // For now, let's assume a similar result page structure could exist.
      // router.push(Routes.testResultTeacherTest(createdResult.id)); // This route would need to be created
      router.push(Routes.myProgress); // Or back to a general progress page

    } catch (err: any) {
      console.error("Failed to submit teacher test results:", err); toast({ title: "Submission Failed", description: `Could not save your results. Error: ${err.data?.message || err.message}`, variant: "destructive" });
    } finally { setIsSubmitting(false); }
  }, [user, testDetails, questions, userAnswers, timeLeft, router, toast, isSubmitting, testStatus, currentQuestion, authRefresh]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || testStatus !== 'in_progress') {
      if (timeLeft !== null && timeLeft <= 0 && testStatus === 'in_progress') { handleSubmitTest(true, "terminated_time_up"); }
      return;
    }
    const timerId = setInterval(() => { setTimeLeft((prevTime) => (prevTime ? prevTime - 1 : 0)); }, 1000);
    return () => clearInterval(timerId);
  }, [timeLeft, testStatus, toast, handleSubmitTest]);

  const handleOptionChange = (value: string) => { if (testStatus === 'in_progress' && currentQuestion) setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...(prev[currentQuestion.id] || { questionId: currentQuestion.id, timeSpentSeconds: 0, markedForReview: false, correctOption: currentQuestion.CorrectOption || null }), selectedOption: value, isCorrect: false } })); };
  const handleClearResponse = () => { if (testStatus === 'in_progress' && currentQuestion) setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...(prev[currentQuestion.id] || { questionId: currentQuestion.id, timeSpentSeconds: 0, correctOption: currentQuestion.CorrectOption || null }), selectedOption: null, isCorrect: false, markedForReview: prev[currentQuestion.id]?.markedForReview || false } })); };
  const handleMarkForReview = () => { if (testStatus === 'in_progress' && currentQuestion) setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...(prev[currentQuestion.id] || { questionId: currentQuestion.id, selectedOption: null, isCorrect: false, timeSpentSeconds: 0, correctOption: currentQuestion.CorrectOption || null }), markedForReview: !prev[currentQuestion.id]?.markedForReview } })); };

  const navigateQuestion = (directionOrIndex: 'next' | 'prev' | number) => {
    if (testStatus !== 'in_progress' || !currentQuestion) return;
    if (userAnswers[currentQuestion.id]) {
      const currentTime = Date.now(); const timeSpentCurrentQuestion = Math.round((currentTime - questionStartTimeRef.current) / 1000);
      setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...prev[currentQuestion.id], timeSpentSeconds: (prev[currentQuestion.id].timeSpentSeconds || 0) + timeSpentCurrentQuestion } }));
    }
    let newIndex = currentQuestionIndex;
    if (directionOrIndex === 'next') newIndex = Math.min(questions.length - 1, currentQuestionIndex + 1);
    else if (directionOrIndex === 'prev') newIndex = Math.max(0, currentQuestionIndex - 1);
    else if (typeof directionOrIndex === 'number') newIndex = Math.max(0, Math.min(questions.length - 1, directionOrIndex));
    setCurrentQuestionIndex(newIndex); questionStartTimeRef.current = Date.now();
  };
  const handleSaveAndNext = () => navigateQuestion('next');

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

  const renderOption = (optionKey: "A" | "B" | "C" | "D"): React.ReactNode => {
    if(!currentQuestion) return null;
    const textKey = `Option${optionKey}Text` as keyof TeacherQuestionRecord;
    const imageKey = `displayOption${optionKey}ImageUrl` as keyof TeacherQuestionRecord;
    const optionText = currentQuestion[textKey]; const displayImageUrl = currentQuestion[imageKey];
    const optionValue = `Option ${optionKey}`;
    return ( <Label htmlFor={`option-${currentQuestion.id}-${optionKey}`} className={cn("flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-all hover:shadow-md", userAnswers[currentQuestion.id]?.selectedOption === optionValue ? 'bg-primary/10 border-primary ring-1 ring-primary' : 'bg-card border-border hover:border-primary/50')}> <RadioGroupItem value={optionValue} id={`option-${currentQuestion.id}-${optionKey}`} className="mt-1 border-muted-foreground data-[state=checked]:border-primary shrink-0" /> <div className="flex-1 text-sm"> <div className="font-semibold">{optionKey}.</div> {optionText && <div className="prose prose-sm dark:prose-invert max-w-none mt-0.5">{renderLatex(optionText as string)}</div>} {displayImageUrl && (<div className="mt-1.5"><NextImage src={displayImageUrl as string} alt={`Option ${optionKey}`} width={200} height={100} className="rounded object-contain border" data-ai-hint="option diagram"/></div>)} {!(optionText || displayImageUrl) && <p className="text-muted-foreground italic">Option {optionKey} content not available.</p>} </div> </Label> );
  };

  const formatTime = (seconds: number | null): string => { if (seconds === null) return '00:00:00'; const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = seconds % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; };
  const getQuestionStatusForPalette = (questionId: string): 'answered' | 'notAnswered' | 'markedForReview' | 'markedAndAnswered' | 'notVisited' => { const answer = userAnswers[questionId]; if (!answer || (answer.selectedOption === null && !answer.markedForReview)) return 'notVisited'; if (answer.selectedOption) { return answer.markedForReview ? 'markedAndAnswered' : 'answered'; } else { return answer.markedForReview ? 'markedForReview' : 'notAnswered'; } };
  const questionPaletteButtonClass = (status: ReturnType<typeof getQuestionStatusForPalette>, isActive: boolean) => { if (isActive) return "bg-primary text-primary-foreground border-primary ring-2 ring-offset-1 ring-primary"; switch (status) { case 'answered': return "bg-green-500 hover:bg-green-600 text-white border-green-500"; case 'notAnswered': return "bg-red-500 hover:bg-red-600 text-white border-red-500"; case 'markedForReview': return "bg-purple-500 hover:bg-purple-600 text-white border-purple-500"; case 'markedAndAnswered': return "bg-orange-500 hover:bg-orange-600 text-white border-orange-500"; case 'notVisited': default: return "bg-card hover:bg-muted/80 text-muted-foreground border-border"; } };

  if (isLoading || isAuthLoading) { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" /> <p className="text-lg">Loading test environment...</p> </div> ); }
  if (error && testStatus !== 'in_progress') { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Card className="w-full max-w-lg text-center shadow-xl bg-background text-foreground"> <CardHeader> <AlertCircle className="mx-auto h-12 w-12 text-destructive" /> <CardTitle className="text-destructive">Error Loading Test</CardTitle> </CardHeader> <CardContent><p className="text-muted-foreground whitespace-pre-wrap">{error}</p></CardContent> <CardFooter><Button onClick={() => router.back()} variant="outline" className="w-full">Go Back</Button></CardFooter> </Card> </div> ); }
  if (testStatus === 'completed' || testStatus === 'terminated') { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Card className="w-full max-w-lg text-center shadow-xl bg-background text-foreground"> <CardHeader> {testStatus === 'completed' ? <CheckCircle className="mx-auto h-12 w-12 text-green-500" /> : <XCircle className="mx-auto h-12 w-12 text-destructive" />} <CardTitle>{testStatus === 'completed' ? "Test Completed" : "Test Terminated"}</CardTitle> </CardHeader> <CardContent><p className="text-muted-foreground">{testStatus === 'completed' ? "Your responses have been submitted." : `This test session has been terminated. ${error || ''}`}</p></CardContent> <CardFooter> <Button onClick={() => router.push(Routes.dashboard)} className="w-full">Back to Dashboard</Button> </CardFooter> </Card> </div> ); }


  // PIN Entry Screen
  if (testStatus === 'pin_entry' && !isLoading) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 p-4">
        <Card className="w-full max-w-md shadow-xl bg-card text-foreground">
          <CardHeader><CardTitle className="text-xl">Enter PIN for {testDetails?.testName || "Test"}</CardTitle><CardDescription>This test requires a PIN provided by the teacher ({testDetails?.expand?.teacherId?.name || 'Teacher'}).</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <Input type="password" value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="Enter Test PIN" autoFocus className="text-center text-lg tracking-widest"/>
              {pinError && <p className="text-sm text-destructive text-center">{pinError}</p>}
              <Button type="submit" className="w-full" disabled={!pinInput}>Enter Test</Button>
            </form>
          </CardContent>
          <CardFooter><Button variant="outline" onClick={() => router.back()} className="w-full">Cancel & Go Back</Button></CardFooter>
        </Card>
      </div>
    );
  }

  // Instructions Screen
  if (testStatus === 'instructions' && !isLoading) {
    const instructionSymbolClasses = "inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white rounded-sm mr-2 align-middle";
    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-950 p-4 overflow-y-auto">
          <Card className="w-full max-w-4xl shadow-2xl rounded-lg">
            <CardHeader className="text-center border-b pb-4"><CardTitle className="text-3xl font-bold text-foreground">Test Instructions: {testDetails?.testName}</CardTitle><CardDescription className="text-md text-muted-foreground mt-1">Please read carefully before you begin.</CardDescription></CardHeader>
            <CardContent className="p-0"><ScrollArea className="h-[calc(80vh-180px)] md:h-[calc(70vh-160px)]"><div className="p-6 prose prose-sm sm:prose-base dark:prose-invert max-w-none text-foreground">
              <ol className="list-decimal space-y-3 pl-5 text-muted-foreground">
                 <li>The clock will be set at the server. The countdown timer in the top right corner will display the remaining time. When the timer reaches zero, the examination will end by itself.</li>
                 <li>The Question Palette (sidebar) shows the status of each question using symbols: <ul className="list-none space-y-1.5 pl-2 mt-1.5 text-xs"> <li className="flex items-center"><span className={`${instructionSymbolClasses} bg-gray-400 dark:bg-gray-600`}>1</span><strong className="text-foreground/90 mr-1">"Not Visited"</strong></li> <li className="flex items-center"><span className={`${instructionSymbolClasses} bg-red-500 dark:bg-red-600`}>2</span><strong className="text-foreground/90 mr-1">"Not Answered"</strong> (Visited but skipped)</li> <li className="flex items-center"><span className={`${instructionSymbolClasses} bg-green-500 dark:bg-green-600`}>3</span><strong className="text-foreground/90 mr-1">"Answered"</strong></li> <li className="flex items-center"><span className={`${instructionSymbolClasses} bg-purple-500 dark:bg-purple-600`}>4</span><strong className="text-foreground/90 mr-1">"Marked for Review"</strong> (NOT answered)</li> <li className="flex items-center"><span className={`${instructionSymbolClasses} bg-orange-500 dark:bg-orange-600 relative flex items-center justify-center`}>5</span><strong className="text-foreground/90 mr-1">"Answered & Marked"</strong> (will be evaluated)</li> </ul> </li>
                 <li>You can click on a question number in the palette to go directly to that question.</li>
                 <li>Use "Save & Next" to save your answer for the current question and move to the next. Use "Clear Response" to clear your selected answer. Use "Mark for Review" to flag a question for later attention.</li>
                 <li>Click "Submit Test" in the sidebar when you are finished. The test will auto-submit when the timer ends.</li>
              </ol>
            </div></ScrollArea></CardContent>
            <CardFooter className="p-6 border-t justify-center"><Button onClick={handleStartTestFromInstructions} size="lg" className="px-10 py-6 text-base bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all">I am ready to Begin</Button></CardFooter>
          </Card>
        </div>
    );
  }
  
  // Test UI (based on wireframe)
  if (testStatus === 'in_progress' && currentQuestion && !isLoading) {
    const QuestionPaletteContent = () => ( <> <Card className="shadow-none border-0 md:border md:shadow-sm md:rounded-lg md:bg-card"> <CardHeader className="p-3 border-b text-center"> <UserCircleIcon className="mx-auto h-10 w-10 text-primary mb-1" /> <CardTitle className="text-base">{user?.name || "Student"}</CardTitle> <CardDescription className="text-xs truncate">{user?.email}</CardDescription> <CardDescription className="text-xs">{todayDate}</CardDescription> </CardHeader> </Card> <Card className="border-primary/30 bg-primary/5 flex-1 flex flex-col min-h-0 shadow-md rounded-lg md:mt-3"> <CardHeader className="p-2 text-center border-b border-primary/20"> <CardTitle className="text-sm text-primary">QUESTION NAVIGATION</CardTitle> </CardHeader> <CardContent className="p-2 flex-1 overflow-hidden"> <ScrollArea className="h-full"> <div className="grid grid-cols-5 sm:grid-cols-4 gap-1.5 p-1"> {questions.map((q, index) => { const status = getQuestionStatusForPalette(q.id); const isActive = currentQuestionIndex === index; return ( <Button key={q.id} variant="outline" size="icon" className={cn("h-8 w-full text-xs rounded-md aspect-square", questionPaletteButtonClass(status, isActive))} onClick={() => { navigateQuestion(index); if (isMobileSheetOpen) setIsMobileSheetOpen(false); }} disabled={testStatus !== 'in_progress'} aria-label={`Go to question ${index + 1}, Status: ${(status || 'Not Visited').replace(/([A-Z])/g, ' $1')}`}> {index + 1} {status === 'markedAndAnswered' && <Check className="absolute h-2.5 w-2.5 bottom-0.5 right-0.5 text-white" />} </Button> ); })} </div> </ScrollArea> </CardContent> </Card> <div className="p-3 border-t bg-card md:bg-transparent rounded-b-lg md:shadow-md mt-auto md:mt-3"> <AlertDialog> <AlertDialogTrigger asChild> <Button variant="destructive" className="w-full text-sm py-2.5" disabled={testStatus !== 'in_progress' || isSubmitting}> <CloseIcon className="mr-1.5 h-4 w-4" /> Submit Test </Button> </AlertDialogTrigger> <AlertDialogContent> <RadixAlertDialogHeader> <RadixAlertDialogTitle>Confirm Submission</RadixAlertDialogTitle> <RadixAlertDialogDescription>Are you sure you want to submit your test?</RadixAlertDialogDescription> </RadixAlertDialogHeader> <RadixAlertDialogFooter> <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel> <AlertDialogAction onClick={() => handleSubmitTest(false)} disabled={isSubmitting}> {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Yes, Submit </AlertDialogAction> </RadixAlertDialogFooter> </AlertDialogContent> </AlertDialog> </div> </> );

    return (
        <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-900">
          {/* Top Header */}
          <header className="sticky top-0 z-50 bg-card shadow-md p-3 border-b border-border">
            <div className="flex justify-between items-center max-w-full px-2 sm:px-4">
              <div className="text-xs sm:text-sm font-medium text-muted-foreground truncate max-w-[calc(33%-30px)] sm:max-w-xs" title={testDetails?.testName || 'Test'}>
                <span className="hidden sm:inline">Test: </span>{testDetails?.testName || 'Test Name'} <br/>
                <span className="text-[10px] sm:text-xs">Teacher: {testDetails?.expand?.teacherId?.name || 'N/A'}</span>
              </div>
              <div className="flex-shrink-0"> <AppLogo mainTextSize="text-lg" taglineTextSize="text-[0px]" iconSize={22} /> </div>
              <div className="text-sm font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md shadow-sm flex items-center w-auto max-w-[calc(33%-30px)] sm:max-w-xs justify-end">
                <Clock className="h-4 w-4 mr-1.5 flex-shrink-0" /> <span className="truncate">{formatTime(timeLeft)}</span>
              </div>
            </div>
          </header>
           {/* Sub Header - Subject Name & View Question Buttons */}
           <div className="sticky top-[var(--top-header-height,57px)] z-40 bg-background shadow-sm p-3 border-b border-border">
             <div className="flex justify-between items-center max-w-full px-2 sm:px-4">
                <div className="text-sm font-semibold text-foreground truncate max-w-[calc(50%-100px)] sm:max-w-md" title={currentQuestion?.subject || currentQuestion?.LessonName || 'Subject'}>
                    SUBJECT: {currentQuestion?.subject || currentQuestion?.LessonName || 'N/A'}
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                   <Button variant="outline" size="sm" className="text-xs h-7 px-2" onClick={() => toast({title: "View Full Question - Coming Soon"})}>
                     <Eye className="h-3.5 w-3.5 sm:mr-1"/> <span className="hidden sm:inline">View Question</span>
                   </Button>
                   <Button variant="ghost" size="icon" asChild className="text-muted-foreground hover:text-primary h-7 w-7"><Link href="#" onClick={(e) => {e.preventDefault(); toast({title: "Test Instructions - Popover Coming Soon"})}}><Info className="h-4 w-4" /></Link></Button>
                    <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
                      <SheetTrigger asChild><Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary h-7 w-7 md:hidden" aria-label="Open Question Navigation"><ListOrdered className="h-5 w-5" /></Button></SheetTrigger>
                      <SheetContent side="right" className="w-3/4 p-0 flex flex-col"><ShadcnSheetHeader className="p-3 border-b text-center"><ShadcnSheetTitle className="text-lg">Navigation</ShadcnSheetTitle></ShadcnSheetHeader><QuestionPaletteContent /></SheetContent>
                    </Sheet>
                </div>
             </div>
           </div>
          <div className={cn("flex-1 flex max-w-full p-2 sm:p-4 gap-2 sm:gap-4 overflow-hidden")}>
            <Card className="flex-1 flex flex-col bg-card shadow-xl rounded-lg border border-border overflow-hidden">
              <ScrollArea className="flex-1 min-h-0">
                <CardContent className="p-3 sm:p-4 md:p-6 space-y-4">
                  <div className="p-2 border-b border-border/50 rounded-md bg-background min-h-[80px]">
                    {currentQuestion.QuestionText && (<div className="prose prose-sm dark:prose-invert max-w-none mb-3 text-foreground leading-relaxed">{renderLatex(currentQuestion.QuestionText)}</div>)}
                    {currentQuestion.displayQuestionImageUrl && (<div className="my-2 text-center"><NextImage src={currentQuestion.displayQuestionImageUrl} alt="Question Image" width={400} height={300} className="rounded object-contain inline-block border" data-ai-hint="question diagram"/></div>)}
                    {!(currentQuestion.QuestionText || currentQuestion.displayQuestionImageUrl) && (<p className="text-xs sm:text-sm text-muted-foreground italic py-3">Question content not provided.</p>)}
                  </div>
                  <RadioGroup value={userAnswers[currentQuestion.id]?.selectedOption || ""} onValueChange={handleOptionChange} className="space-y-2.5" disabled={testStatus !== 'in_progress'}>
                    {renderOption("A")} {renderOption("B")} {renderOption("C")} {renderOption("D")}
                  </RadioGroup>
                </CardContent>
              </ScrollArea>
              <CardFooter className="p-3 sm:p-4 border-t border-border bg-muted/30 flex-wrap justify-center sm:justify-between gap-2">
                <Button variant="outline" size="sm" onClick={handleClearResponse} disabled={testStatus !== 'in_progress' || !userAnswers[currentQuestion.id]?.selectedOption}>Clear Response</Button>
                <Button variant={userAnswers[currentQuestion.id]?.markedForReview ? "secondary" : "outline"} size="sm" onClick={handleMarkForReview} disabled={testStatus !== 'in_progress'} className={cn("border-purple-500 text-purple-600", userAnswers[currentQuestion.id]?.markedForReview && "bg-purple-100 dark:bg-purple-800/30")}>
                  <Flag className="mr-1.5 h-4 w-4" /> {userAnswers[currentQuestion.id]?.markedForReview ? "Unmark Review" : "Mark for Review"}
                </Button>
                <Button size="sm" onClick={handleSaveAndNext} disabled={testStatus !== 'in_progress' || currentQuestionIndex === questions.length - 1} className="bg-green-600 hover:bg-green-700 text-white">Save & Next <ChevronRight className="ml-1.5 h-4 w-4" /></Button>
              </CardFooter>
            </Card>
            {isRightSidebarOpen && ( <div className="hidden md:flex w-64 lg:w-72 flex-shrink-0 flex-col space-y-0"><QuestionPaletteContent /></div> )}
          </div>
        </div>
      );
  }

  // Fallback for unhandled states
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white">
      <Card className="w-full max-w-lg text-center shadow-xl bg-background text-foreground">
        <CardHeader><AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" /><CardTitle>Test Loading...</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">Please wait or refresh if the test does not load.</p></CardContent>
      </Card>
    </div>
  );
}
