
'use client';

import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState, useRef, useCallback, FormEvent } from 'react';
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
import type { StudentBookmark, User, TeacherTestAttempt } from '@/lib/types';
import Link from 'next/link';
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from '@/components/ui/badge';
import { format, addMinutes } from 'date-fns';

const TEST_PIN_SESSION_KEY_PREFIX = "teacherTestPinVerified_";

interface TeacherTestDetailsRecord extends RecordModel {
  id: string;
  testName: string;
  Admin_Password?: number;
  duration: string;
  teacherId: string;
  QBExam: string;
  model: "Chapterwise" | "Full Length";
  questions_edunexus?: string[];
  questions_teachers?: string[];
  status?: 'Draft' | 'Published' | 'Archived';
  expand?: {
    teacherId?: {
      id: string;
      name: string;
    };
    questions_edunexus?: FetchedQuestionRecord[];
    questions_teachers?: FetchedQuestionRecord[];
  };
}

interface QuestionRecord {
  id: string;
  displayQuestionText?: string;
  displayQuestionImageUrl?: string | null;
  displayOptions: { label: string; text?: string; imageUrl?: string | null }[];
  displayCorrectOptionLabel: string;
  displayExplanationText?: string;
  displayExplanationImageUrl?: string | null;
  marks?: number;
  subject?: string;
  source: 'edunexus' | 'teacher';
  difficulty?: 'Easy' | 'Medium' | 'Hard';
}

interface FetchedQuestionRecord extends RecordModel {
  id: string;
  questionText?: string; // For question_bank
  questionImage?: string | null; // Filename from question_bank
  optionAText?: string;
  optionAImage?: string | null;
  optionBText?: string;
  optionBImage?: string | null;
  optionCText?: string;
  optionCImage?: string | null;
  optionDText?: string;
  optionDImage?: string | null;
  correctOption?: "A" | "B" | "C" | "D"; // For question_bank
  explanationText?: string;
  explanationImage?: string | null;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  marks?: number;
  subject?: string;
  LessonName?: string; // For teacher_question_data, also from question_bank
  QBExam?: string; // For teacher_question_data, also from question_bank

  QuestionText?: string; // From teacher_question_data
  QuestionImage?: string | null; // URL from teacher_question_data
  OptionAText?: string; // For teacher_question_data
  OptionAImage?: string | null; // URL
  OptionBText?: string; // For teacher_question_data
  OptionBImage?: string | null; // URL
  OptionCText?: string; // For teacher_question_data
  OptionCImage?: string | null; // URL
  OptionDText?: string; // For teacher_question_data
  OptionDImage?: string | null; // URL
  CorrectOption?: "Option A" | "Option B" | "Option C" | "Option D"; // For teacher_question_data
  teacher?: string; // For teacher_question_data

  collectionId?: string;
  collectionName?: string;
}

interface UserAnswer {
  questionId: string;
  selectedOption: string | null;
  isCorrect: boolean | null;
  markedForReview: boolean;
  timeSpentSeconds: number;
}

const getPbFileUrl = (record: RecordModel | null | undefined, fieldName: string): string | null => {
  if (record && record[fieldName] && record.collectionId && record.collectionName && typeof record[fieldName] === 'string') {
    if (record[fieldName]!.startsWith('http://') || record[fieldName]!.startsWith('https://')) {
        return record[fieldName] as string;
    }
    try { return pb.files.getUrl(record, record[fieldName] as string); }
    catch (e) { console.warn(`Error getting URL for ${fieldName} in record ${record.id}:`, e); return null; }
  }
  return null;
};

const isValidHttpUrl = (string: string | null | undefined): string is string => {
  if (!string || typeof string !== 'string') return false;
  try { const url = new URL(string); return url.protocol === "http:" || url.protocol === "https:"; }
  catch (_) { return false; }
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
  const [instructionScreenQuestionCount, setInstructionScreenQuestionCount] = useState<number | null>(null);
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, UserAnswer>>({});
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

    try {
      console.log(`[LIVE_PAGE_FETCH] Fetching 'teacher_tests' (ID: ${testId}). User: ${user?.id}`);
      const fetchedTest = await pb.collection('teacher_tests').getOne<TeacherTestDetailsRecord>(testId, {
        fields: 'id,testName,status,Admin_Password,duration,teacherId,model,QBExam,questions_edunexus,questions_teachers,expand.teacherId.name', 
        expand: 'teacherId',
        '$autoCancel': false,
      });
      console.log("[LIVE_PAGE_FETCH] Fetched teacher_tests record:", JSON.parse(JSON.stringify(fetchedTest)));

      if (!isMountedGetter()) return;
      
      if (fetchedTest.status !== 'Published') {
        if (isMountedGetter()) { setError(`This test ("${fetchedTest.testName}") is not currently published or available.`); setTestSessionState('terminated'); setIsLoadingPageData(false); }
        return;
      }
      setTestDetails(fetchedTest); 
      setTeacherName(fetchedTest.expand?.teacherId?.name || 'Your Teacher');
      
      const eduNexusIdsCount = Array.isArray(fetchedTest.questions_edunexus) ? fetchedTest.questions_edunexus.length : 0;
      const teacherIdsCount = Array.isArray(fetchedTest.questions_teachers) ? fetchedTest.questions_teachers.length : 0;
      const totalQuestionIdsFromRecord = eduNexusIdsCount + teacherIdsCount;
      
      setInstructionScreenQuestionCount(totalQuestionIdsFromRecord);
      console.log(`[LIVE_PAGE_FETCH] Instruction screen question count set to: ${totalQuestionIdsFromRecord}. EduNexus IDs: ${eduNexusIdsCount}, Teacher IDs: ${teacherIdsCount}`);

      const pinRequired = fetchedTest.Admin_Password !== null && fetchedTest.Admin_Password !== undefined && String(fetchedTest.Admin_Password).trim() !== "";
      const pinSessionKey = `${TEST_PIN_SESSION_KEY_PREFIX}${testId}`;
      const pinIsVerifiedInSession = sessionStorage.getItem(pinSessionKey) === 'true';

      if (pinRequired && !pinIsVerifiedInSession) {
        console.log("[LIVE_PAGE_FETCH] PIN required and not verified. Setting to 'pinEntry'.");
        setTestSessionState('pinEntry');
        setIsLoadingPageData(false); 
        return; 
      }
      console.log("[LIVE_PAGE_FETCH] No PIN or PIN verified. Setting to 'instructions'.");
      setTestSessionState('instructions');
      
    } catch (err: any) {
      if (isMountedGetter()) {
        const clientError = err as PocketBaseClientResponseError;
        let errorMsg = `Could not load test details. Error: ${clientError.data?.message || clientError.message}.`;
        if (clientError.status === 404) errorMsg = "Test not found or not accessible. Please check the link or contact your teacher.";
        console.error("[LIVE_PAGE_FETCH] Error fetching teacher_tests:", errorMsg, "Full error:", clientError);
        setError(errorMsg);
        setTestSessionState('terminated');
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
    if (!testDetails) { if (isMountedGetter()) { setError("Test details missing, cannot load questions."); setIsLoadingPageData(false); setQuestions([]); } return; }
    console.log("[LOAD_QUESTIONS_DEBUG] Starting loadQuestions. testDetails available.");

    const eduNexusQuestionIds: string[] = Array.isArray(testDetails.questions_edunexus) ? testDetails.questions_edunexus.filter(id => typeof id === 'string' && id.trim() !== '') : [];
    const teacherQuestionIds: string[] = Array.isArray(testDetails.questions_teachers) ? testDetails.questions_teachers.filter(id => typeof id === 'string' && id.trim() !== '') : [];

    if (eduNexusQuestionIds.length === 0 && teacherQuestionIds.length === 0) {
      if (isMountedGetter()) {
        setError("No questions are associated with this test record in 'teacher_tests'. The teacher needs to add questions to this test.");
        setQuestions([]); setIsLoadingPageData(false);
      }
      return;
    }
    if (isMountedGetter()) setIsLoadingPageData(true);

    let combinedQuestions: QuestionRecord[] = [];
    try {
      if (eduNexusQuestionIds.length > 0) {
        const eduNexusFilter = eduNexusQuestionIds.map(id => `id = "${escapeForPbFilter(id)}"`).join(' || ');
        const eduNexusRecords = await pb.collection('question_bank').getFullList<FetchedQuestionRecord>({ filter: eduNexusFilter, '$autoCancel': false });
        eduNexusRecords.forEach(q => {
          combinedQuestions.push({
            id: q.id, displayQuestionText: q.questionText, displayQuestionImageUrl: getPbFileUrl(q, 'questionImage'),
            displayOptions: [ { label: 'A', text: q.optionAText, imageUrl: getPbFileUrl(q, 'optionAImage') }, { label: 'B', text: q.optionBText, imageUrl: getPbFileUrl(q, 'optionBImage') }, { label: 'C', text: q.optionCText, imageUrl: getPbFileUrl(q, 'optionCImage') }, { label: 'D', text: q.optionDText, imageUrl: getPbFileUrl(q, 'optionDImage') } ],
            displayCorrectOptionLabel: q.correctOption || "", displayExplanationText: q.explanationText, displayExplanationImageUrl: getPbFileUrl(q, 'explanationImage'),
            marks: q.marks, subject: q.subject, source: 'edunexus', difficulty: q.difficulty,
          });
        });
      }
      if (!isMountedGetter()) return;

      if (teacherQuestionIds.length > 0) {
        const teacherFilter = teacherQuestionIds.map(id => `id = "${escapeForPbFilter(id)}"`).join(' || ');
        const teacherRecords = await pb.collection('teacher_question_data').getFullList<FetchedQuestionRecord>({ filter: teacherFilter, '$autoCancel': false });
        teacherRecords.forEach(q => {
           combinedQuestions.push({
            id: q.id, displayQuestionText: q.QuestionText, displayQuestionImageUrl: q.QuestionImage, 
            displayOptions: [ { label: 'A', text: q.OptionAText, imageUrl: q.OptionAImage }, { label: 'B', text: q.OptionBText, imageUrl: q.OptionBImage }, { label: 'C', text: q.OptionCText, imageUrl: q.OptionCImage }, { label: 'D', text: q.OptionDText, imageUrl: q.OptionDImage } ],
            displayCorrectOptionLabel: q.CorrectOption?.replace("Option ", "") || "", displayExplanationText: q.explanationText, displayExplanationImageUrl: q.explanationImage, 
            marks: q.marks, subject: q.subject || testDetails.QBExam, source: 'teacher', difficulty: q.difficulty,
            LessonName: q.LessonName, 
          });
        });
      }
      
      if (!isMountedGetter()) return;
      if (combinedQuestions.length === 0 ) {
        if (isMountedGetter()) { setError("No questions were loaded despite IDs being present. Check console or contact teacher."); setQuestions([]); }
      } else {
        setQuestions(combinedQuestions); 
        const initialAnswers: Record<string, UserAnswer> = {};
        combinedQuestions.forEach(q => { initialAnswers[q.id] = { questionId: q.id, selectedOption: null, isCorrect: null, markedForReview: false, timeSpentSeconds: 0 }; });
        setUserAnswers(initialAnswers);
      }
    } catch (err: any) { if (isMountedGetter()) { const clientError = err as PocketBaseClientResponseError; console.error("[LOAD_QUESTIONS_DEBUG] Error loading questions:", clientError.data || clientError); setError(`Critical error loading question content: ${clientError.data?.message || clientError.message}.`); }}
    finally { if (isMountedGetter()) setIsLoadingPageData(false); }
  }, [testDetails, escapeForPbFilter]);
  
  useEffect(() => { 
    let isMounted = true;
    if (testSessionState === 'inProgress') {
        loadQuestions(() => isMounted);
    }
    return () => { isMounted = false; };
  }, [testSessionState, loadQuestions]);

  const handleSubmitTest = useCallback(async (autoSubmit = false, terminationReason?: string) => {
    if (!user || !testDetails || !testDetails.teacherId || isSubmittingTest || testSessionState === 'completed' || testSessionState === 'terminated') { return; }
    setIsSubmittingTest(true);
    if(currentQuestion && userAnswers[currentQuestion.id] && questionStartTimeRef.current && testSessionState === 'inProgress') {
        const currentTime = Date.now();
        const timeSpentCurrentQuestion = Math.round((currentTime - questionStartTimeRef.current) / 1000);
        userAnswers[currentQuestion.id].timeSpentSeconds = (userAnswers[currentQuestion.id].timeSpentSeconds || 0) + timeSpentCurrentQuestion;
    }
    let correctCount = 0; let attemptedCount = 0; let pointsEarnedFromTest = 0;
    const answersLogForDb = questions.map(q => {
      const userAnswerRec = userAnswers[q.id]; const selected = userAnswerRec?.selectedOption || null; let isCorrectAns = false;
      const correctOptionValue = q.displayCorrectOptionLabel; 
      const questionMarks = typeof q.marks === 'number' ? q.marks : 1;
      if (selected) { attemptedCount++; if (selected === `Option ${correctOptionValue}`) { correctCount++; isCorrectAns = true; pointsEarnedFromTest += questionMarks;}}
      return { questionId: q.id, selectedOption: selected, correctOption: correctOptionValue ? `Option ${correctOptionValue}` : null, isCorrect: isCorrectAns, markedForReview: userAnswerRec?.markedForReview || false, timeSpentSeconds: userAnswerRec?.timeSpentSeconds || 0 };
    });
    const maxScorePossible = questions.reduce((sum, q) => sum + (typeof q.marks === 'number' ? q.marks : 1), 0);
    const percentage = maxScorePossible > 0 ? (pointsEarnedFromTest / maxScorePossible) * 100 : 0;
    const finalTestStatus: TeacherTestAttempt['status'] = terminationReason === 'time_up' ? 'terminated_time_up' : (terminationReason === 'manual' ? 'terminated_manual' : 'completed');
    const durationTakenSecs = testDetails?.duration ? parseInt(testDetails.duration, 10) * 60 - (timeLeft || 0) : 0;
    const resultDataToSave: Partial<TeacherTestAttempt> = {
      student: user.id, teacher_test: testDetails.id, teacher: testDetails.teacherId, test_name_cache: testDetails.testName,
      plan_type_cache: testDetails.model || 'N/A', score: pointsEarnedFromTest, max_score: maxScorePossible,
      percentage: parseFloat(percentage.toFixed(2)), status: finalTestStatus,
      started_at: new Date(Date.now() - durationTakenSecs * 1000).toISOString(), completed_at: new Date().toISOString(),
      duration_taken_seconds: durationTakenSecs, answers_log: JSON.stringify(answersLogForDb),
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
  }, [user, testDetails, questions, userAnswers, timeLeft, router, toast, isSubmittingTest, testSessionState, currentQuestion]);

  useEffect(() => {
    let isMounted = true;
    if (testSessionState === 'inProgress' && timeLeft !== null && timeLeft > 0) {
      timerIntervalRef.current = setInterval(() => { if(isMounted) setTimeLeft(prev => (prev !== null && prev > 0 ? prev - 1 : 0)); }, 1000);
    } else if (timeLeft === 0 && testSessionState === 'inProgress') {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      handleSubmitTest(true, "time_up");
    }
    return () => { isMounted = false; if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, [testSessionState, timeLeft, handleSubmitTest]);

  const handlePinVerify = async () => {
    if (!testDetails || testDetails.Admin_Password === undefined || testDetails.Admin_Password === null) { setPinError("Test PIN configuration error by teacher."); return; }
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
    const durationMinutes = parseInt(testDetails.duration || "0", 10);
    setTimeLeft(isNaN(durationMinutes) || durationMinutes <=0 ? 3600 : durationMinutes * 60); 
    setTestSessionState('inProgress'); 
  };
  
  const handleOptionChange = (value: string) => { if (testSessionState !== 'inProgress' || !currentQuestion) return; setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...(prev[currentQuestion.id] || { questionId: currentQuestion.id, timeSpentSeconds: 0, markedForReview: false }), selectedOption: value, isCorrect: null, }})); };
  const handleClearResponse = () => { if (testSessionState !== 'inProgress' || !currentQuestion) return; setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...(prev[currentQuestion.id] || { questionId: currentQuestion.id, timeSpentSeconds: 0 }), selectedOption: null, isCorrect: null, }})); };
  const handleMarkForReview = () => { if (testSessionState !== 'inProgress' || !currentQuestion) return; setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...(prev[currentQuestion.id] || { questionId: currentQuestion.id, selectedOption: null, isCorrect: null, timeSpentSeconds: 0 }), markedForReview: !prev[currentQuestion.id]?.markedForReview, }})); };
  const navigateQuestion = (directionOrIndex: 'next' | 'prev' | number) => {
    if (testSessionState !== 'inProgress' || !currentQuestion) return;
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
  const formatTime = (seconds: number | null): string => { if (seconds === null || seconds < 0) seconds = 0; const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = seconds % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; };
  const getQuestionStatusForPalette = (questionId: string): 'answered' | 'notAnswered' | 'markedForReview' | 'markedAndAnswered' | 'notVisited' => { const answer = userAnswers[questionId]; if (!answer || (answer.selectedOption === null && !answer.markedForReview)) return 'notVisited'; if (answer.selectedOption) { return answer.markedForReview ? 'markedAndAnswered' : 'answered'; } else { return answer.markedForReview ? 'markedForReview' : 'notAnswered'; }};
  const questionPaletteButtonClass = (status: ReturnType<typeof getQuestionStatusForPalette>, isActive: boolean) => { if (isActive) return "bg-primary text-primary-foreground border-primary ring-2 ring-offset-1 ring-primary"; switch (status) { case 'answered': return "bg-green-500 hover:bg-green-600 text-white border-green-500"; case 'notAnswered': return "bg-red-500 hover:bg-red-600 text-white border-red-500"; case 'markedForReview': return "bg-purple-500 hover:bg-purple-600 text-white border-purple-500"; case 'markedAndAnswered': return "bg-orange-500 hover:bg-orange-600 text-white border-orange-500"; case 'notVisited': default: return "bg-card hover:bg-muted/80 text-muted-foreground border-border"; }};
  const renderOption = (optionKey: "A" | "B" | "C" | "D"): React.ReactNode => { if(!currentQuestion) return null; const optionData = currentQuestion.displayOptions.find(opt => opt.label === optionKey); if (!optionData) return null; const optionValue = `Option ${optionKey}`; return ( <Label htmlFor={`option-${currentQuestion.id}-${optionKey}`} className={cn("flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-all hover:shadow-md", userAnswers[currentQuestion.id]?.selectedOption === optionValue ? 'bg-primary/10 border-primary ring-1 ring-primary' : 'bg-card border-border hover:border-primary/50')}> <RadioGroupItem value={optionValue} id={`option-${currentQuestion.id}-${optionKey}`} className="mt-1 border-muted-foreground data-[state=checked]:border-primary shrink-0" /> <div className="flex-1 text-sm"> <div className="font-semibold">{optionKey}.</div> {optionData.text && <div className="prose prose-sm dark:prose-invert max-w-none mt-0.5">{renderLatex(optionData.text)}</div>} {optionData.imageUrl && isValidHttpUrl(optionData.imageUrl) && (<div className="mt-1.5"><NextImage src={optionData.imageUrl} alt={`Option ${optionKey}`} width={200} height={100} className="rounded object-contain border" data-ai-hint="option diagram"/></div>)} {!(optionData.text || (optionData.imageUrl && isValidHttpUrl(optionData.imageUrl))) && <p className="text-muted-foreground italic">Option {optionKey} content not available.</p>} </div> </Label> ); };
  
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
        <CardHeader className="p-2 text-center border-b border-primary/20">
          <CardTitle className="text-sm text-primary">QUESTION NAVIGATION</CardTitle>
        </CardHeader>
        <CardContent className="p-2 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="grid grid-cols-5 sm:grid-cols-4 gap-1.5 p-1">
              {questions.map((q, index) => {
                const status = getQuestionStatusForPalette(q.id);
                const isActive = currentQuestionIndex === index;
                return (
                  <Button
                    key={q.id}
                    variant="outline"
                    size="icon"
                    className={cn(
                      "h-8 w-full text-xs rounded-md aspect-square",
                      questionPaletteButtonClass(status, isActive)
                    )}
                    onClick={() => {
                      navigateQuestion(index);
                      if (isMobileSheetOpen) setIsMobileSheetOpen(false);
                    }}
                    disabled={testSessionState !== 'inProgress'}
                    aria-label={`Go to question ${index + 1}, Status: ${(status || 'Not Visited').replace(/([A-Z])/g, ' $1')}`}
                  >
                    {index + 1}
                    {status === 'markedAndAnswered' && <Check className="absolute h-2.5 w-2.5 bottom-0.5 right-0.5 text-white" />}
                  </Button>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
      <div className="p-3 border-t bg-card md:bg-transparent rounded-b-lg md:shadow-md mt-auto md:mt-3">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              className="w-full text-sm py-2.5"
              disabled={testSessionState !== 'inProgress' || isSubmittingTest}
            >
              <CloseIcon className="mr-1.5 h-4 w-4" /> Submit Test
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <RadixAlertDialogHeader>
              <RadixAlertDialogTitle>Confirm Submission</RadixAlertDialogTitle>
              <RadixAlertDialogDescription>
                Are you sure you want to submit your test?
              </RadixAlertDialogDescription>
            </RadixAlertDialogHeader>
            <RadixAlertDialogFooter>
              <AlertDialogCancel disabled={isSubmittingTest}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleSubmitTest(false, 'manual')}
                disabled={isSubmittingTest}
              >
                {isSubmittingTest && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Yes, Submit
              </AlertDialogAction>
            </RadixAlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );

  // Main render logic after loading and error checks
  if (isLoadingPageData || isAuthLoading || testSessionState === 'initialLoading') { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" /> <p className="text-lg">Loading test environment...</p> </div> ); }
  if (error) { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Card className="w-full max-w-lg text-center shadow-xl bg-background text-foreground"> <CardHeader> <AlertCircle className="mx-auto h-12 w-12 text-destructive" /> <CardTitle className="text-destructive">Error Loading Test</CardTitle> </CardHeader> <CardContent><p className="text-muted-foreground whitespace-pre-wrap">{error}</p></CardContent> <CardFooter><Button onClick={() => router.back()} variant="outline" className="w-full">Go Back</Button></CardFooter> </Card> </div> ); }
  if (testSessionState === 'pinEntry') { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 p-4"> <Card className="w-full max-w-sm shadow-xl bg-card text-foreground"> <CardHeader><CardTitle className="text-xl flex items-center gap-2"><KeyRound className="text-primary"/>Enter Test PIN</CardTitle><CardDescription>This test by {teacherName} requires a PIN.</CardDescription></CardHeader> <CardContent className="space-y-4"> <Input type="password" placeholder="Enter PIN" value={enteredPin} onChange={(e) => setEnteredPin(e.target.value)} className="text-center text-lg tracking-widest" maxLength={6} autoFocus/> {pinError && <p className="text-sm text-destructive text-center">{pinError}</p>} </CardContent> <CardFooter className="flex-col gap-2"> <Button onClick={handlePinVerify} className="w-full" disabled={isVerifyingPin || enteredPin.length < 4}> {isVerifyingPin && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Verify PIN & Continue </Button> <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-xs text-muted-foreground">Cancel & Go Back</Button> </CardFooter> </Card> </div> ); }
  if (testSessionState === 'instructions') { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 p-4"> <Card className="w-full max-w-2xl shadow-xl bg-card text-foreground"> <CardHeader><CardTitle className="text-2xl">Test Instructions: {testDetails?.testName}</CardTitle><CardDescription>From: {teacherName}. Total Questions: {instructionScreenQuestionCount ?? 'N/A'}</CardDescription></CardHeader> <CardContent className="max-h-[60vh] overflow-y-auto prose prose-sm dark:prose-invert"> <p>Duration: {testDetails?.duration || 'N/A'} minutes</p><h4>General Instructions:</h4><ol><li>The clock will be set at the server. The countdown timer in the top right corner of screen will display the remaining time.</li><li>When the timer reaches zero, the examination will end by itself.</li><li>The Question Palette on the right shows question status.</li></ol> </CardContent> <CardFooter className="justify-center"> <Button onClick={handleStartTestAfterInstructions} size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">I'm Ready, Start Test!</Button> </CardFooter> </Card> </div> ); }
  if (testSessionState === 'completed' || testSessionState === 'terminated') { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Card className="w-full max-w-lg text-center shadow-xl bg-background text-foreground"> <CardHeader> {testSessionState === 'completed' ? <CheckCircle className="mx-auto h-12 w-12 text-green-500" /> : <XCircle className="mx-auto h-12 w-12 text-destructive" />} <CardTitle>{testSessionState === 'completed' ? "Test Completed" : "Test Terminated"}</CardTitle> </CardHeader> <CardContent><p className="text-muted-foreground">{testSessionState === 'completed' ? "Your responses have been submitted." : "This test session has been terminated."}</p></CardContent> <CardFooter> <Button onClick={() => { if (window.opener && !window.opener.closed) window.close(); else router.push(Routes.dashboard);}} className="w-full"> Close Window / Back to Dashboard </Button> </CardFooter> </Card> </div> ); }
  if (!currentQuestion && !isLoadingPageData && testSessionState === 'inProgress') { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Card className="w-full max-w-lg text-center shadow-xl bg-background text-foreground"> <CardHeader> <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" /> <CardTitle>No Questions</CardTitle> </CardHeader> <CardContent><p className="text-muted-foreground whitespace-pre-wrap">No questions loaded for this test, or you've finished. If this is unexpected, please contact your teacher. Error: {error}</p></CardContent> <CardFooter><Button onClick={() => handleSubmitTest(false, 'no_questions_or_finished')} variant="outline" className="w-full">Submit & End Test</Button></CardFooter> </Card> </div> );}
  
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
            <div className="text-sm font-semibold text-foreground truncate max-w-[calc(50%-120px)] sm:max-w-md" title={currentQuestion?.subject || testDetails?.QBExam || 'Subject'}>
              SUBJECT: {currentQuestion?.subject || testDetails?.QBExam || 'N/A'}
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
                <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary h-7 w-7 md:hidden" aria-label="Open Question Navigation"><ListOrdered className="h-5 w-5" /></Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-3/4 p-0 flex flex-col">
                        <ShadcnSheetHeader className="p-3 border-b text-center">
                            <ShadcnSheetTitle className="text-lg">Navigation</ShadcnSheetTitle>
                            <ShadcnSheetDescription>Jump to any question or submit.</ShadcnSheetDescription>
                        </ShadcnSheetHeader>
                        <QuestionPaletteContent />
                    </SheetContent>
                </Sheet>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary h-7 w-7 hidden md:inline-flex" onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)} aria-label={isRightSidebarOpen ? "Hide Question Panel" : "Show Question Panel"}><Menu className="h-5 w-5" /></Button>
                {/* Instructions link might be redundant now since instructions are shown before test starts */}
                {/* <Button variant="ghost" size="icon" asChild className="text-muted-foreground hover:text-primary h-7 w-7"><Link href={Routes.studentTestInstructions(testId as string)} target="_blank"><Info className="h-4 w-4" /></Link></Button> */}
            </div>
        </div>
      </div>
      <div className={cn("flex-1 flex max-w-full p-2 sm:p-4 gap-2 sm:gap-4 overflow-hidden")}>
        <Card className="flex-1 flex flex-col bg-card shadow-xl rounded-lg border border-border overflow-hidden">
            <CardHeader className="p-3 sm:p-4 border-b border-border bg-muted/30"><div className="flex justify-between items-center"><p className="text-xs sm:text-sm font-medium text-muted-foreground">Question {currentQuestionIndex + 1} of {questions.length}</p><div className="flex items-center gap-1">{currentQuestion.difficulty && <Badge variant={currentQuestion.difficulty === 'Easy' ? 'secondary' : currentQuestion.difficulty === 'Medium' ? 'default' : 'destructive'} className="text-xs px-1.5 py-0.5">{currentQuestion.difficulty}</Badge>}{currentQuestion.marks && <Badge variant="outline" className="text-xs px-1.5 py-0.5">Marks: {currentQuestion.marks}</Badge>}</div></div></CardHeader>
            <ScrollArea className="flex-1 min-h-0"><CardContent className="p-3 sm:p-4 md:p-6 space-y-4">
                <div className="p-2 border-b border-border/50 rounded-md bg-background min-h-[80px]">{currentQuestion.displayQuestionText && (<div className="prose prose-sm dark:prose-invert max-w-none mb-3 text-foreground leading-relaxed">{renderLatex(currentQuestion.displayQuestionText)}</div>)}{currentQuestion.displayQuestionImageUrl && isValidHttpUrl(currentQuestion.displayQuestionImageUrl) && (<div className="my-2 text-center"><NextImage src={currentQuestion.displayQuestionImageUrl} alt="Question Image" width={400} height={300} className="rounded object-contain inline-block border" data-ai-hint="question diagram"/></div>)}{!(currentQuestion.displayQuestionText || (currentQuestion.displayQuestionImageUrl && isValidHttpUrl(currentQuestion.displayQuestionImageUrl))) && (<p className="text-xs sm:text-sm text-muted-foreground italic py-3">Question content not provided.</p>)}</div>
                <RadioGroup value={userAnswers[currentQuestion.id]?.selectedOption || ""} onValueChange={handleOptionChange} className="space-y-2.5" disabled={testSessionState !== 'inProgress'}>{renderOption("A")} {renderOption("B")} {renderOption("C")} {renderOption("D")}</RadioGroup>
            </CardContent></ScrollArea>
            <CardFooter className="p-3 sm:p-4 border-t border-border bg-muted/30 flex-wrap justify-center sm:justify-between gap-2"><Button variant="outline" size="sm" onClick={handleClearResponse} disabled={testSessionState !== 'inProgress' || !userAnswers[currentQuestion.id]?.selectedOption}>Clear Response</Button><Button variant={userAnswers[currentQuestion.id]?.markedForReview ? "secondary" : "outline"} size="sm" onClick={handleMarkForReview} disabled={testSessionState !== 'inProgress'} className="border-purple-500 text-purple-600 data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-700 hover:bg-purple-500/10"><Flag className="mr-1.5 h-4 w-4" /> {userAnswers[currentQuestion.id]?.markedForReview ? "Unmark Review" : "Mark for Review"}</Button><Button size="sm" onClick={handleSaveAndNext} disabled={testSessionState !== 'inProgress' || currentQuestionIndex === questions.length - 1} className="bg-green-600 hover:bg-green-700 text-white">Save & Next <ChevronRight className="ml-1.5 h-4 w-4" /></Button></CardFooter>
        </Card>
        {isRightSidebarOpen && (<div className="hidden md:flex w-72 lg:w-80 flex-shrink-0 flex-col space-y-0"><QuestionPaletteContent /></div>)}
      </div>
    </div>
  );
}
