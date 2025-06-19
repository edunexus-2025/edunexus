
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
import { format, addMinutes, isPast } from 'date-fns';

const TEST_PIN_SESSION_KEY_PREFIX = "teacherTestPinVerified_";


interface TeacherTestDetailsRecord extends RecordModel {
  id: string;
  testName: string;
  Admin_Password?: string | number | null;
  duration?: string;
  teacherId: string;
  QBExam?: string;
  model?: "Chapterwise" | "Full Length";
  Test_Subject?: "Physics" | "Chemistry" | "Maths" | "Biology" | null;
  questions_edunexus?: string[];
  questions_teachers?: string[];
  status?: 'Draft' | 'Published' | 'Archived';
  totalScore?: number;
  expand?: {
    teacherId?: {
      id: string;
      name?: string;
      EduNexus_Name?: string;
    };
  };
}

interface FetchedQuestionSourceRecord extends RecordModel {
  id: string;
  marks?: number;
  subject?: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard' | null;

  // question_bank specific (lowercase filenames)
  questionText?: string | null;
  optionAText?: string | null;
  optionBText?: string | null;
  optionCText?: string | null;
  optionDText?: string | null;
  correctOption?: 'A' | 'B' | 'C' | 'D';
  explanationText?: string | null;
  lessonName?: string | null;
  questionImage?: string | null;
  optionAImage?: string | null;
  optionBImage?: string | null;
  optionCImage?: string | null;
  optionDImage?: string | null;
  explanationImage?: string | null;

  // teacher_question_data specific (uppercase field names, images are direct URLs)
  QuestionText?: string | null;
  CorrectOption?: 'Option A' | 'Option B' | 'Option C' | 'Option D';
  LessonName?: string;
  explanationText_teacher?: string | null; // Using a distinct name for clarity
  QuestionImage_teacher?: string | null; // Using distinct name
  OptionAImage_teacher?: string | null;  // Using distinct name
  OptionBImage_teacher?: string | null;  // Using distinct name
  OptionCImage_teacher?: string | null;  // Using distinct name
  OptionDImage_teacher?: string | null;  // Using distinct name
  explanationImage_teacher?: string | null; // Using distinct name
}


interface NormalizedQuestionRecord {
  id: string;
  displayQuestionText?: string | null;
  displayQuestionImageUrl?: string | null;
  displayOptions: Array<{
    label: 'A' | 'B' | 'C' | 'D';
    text?: string | null;
    imageUrl?: string | null;
  }>;
  displayCorrectOptionLabel: 'A' | 'B' | 'C' | 'D';
  correctOptionString: 'Option A' | 'Option B' | 'Option C' | 'Option D';
  displayExplanationText?: string | null;
  displayExplanationImageUrl?: string | null;
  marks: number;
  subject?: string | null;
  lessonName?: string | null;
  difficulty?: 'Easy' | 'Medium' | 'Hard' | null;
  originalSourceCollection: 'question_bank' | 'teacher_question_data';
  rawRecord: RecordModel;
}

interface UserAnswerLog {
  questionId: string;
  selectedOption: string | null;
  correctOption: string | null;
  isCorrect: boolean;
  markedForReview: boolean;
  timeSpentSeconds: number;
}

const isValidHttpUrl = (string: string | null | undefined): string is string => {
  if (!string || typeof string !== 'string') return false;
  try { const url = new URL(string); return url.protocol === "http:" || url.protocol === "https:"; }
  catch (_) { return false; }
};

const getPbFileUrl = (record: RecordModel, fieldName: string): string | null => {
  const filename = record[fieldName] as string | undefined | null;
  if (filename && record.collectionId && record.collectionName) {
    try {
      return pb.files.getUrl(record as RecordModel, filename);
    } catch (e) {
      console.warn(`StudentTeacherTestLivePage (getPbFileUrl): Error for field '${fieldName}' in record '${record.id}'. Value: '${filename}'. Collection: ${record.collectionName}. Error:`, e);
      return null;
    }
  }
  if (filename) {
     console.warn(`StudentTeacherTestLivePage (getPbFileUrl): Could not get URL for field '${fieldName}' in record '${record.id}'. Missing collectionId/Name. Filename was: '${filename}'.`);
  }
  return null;
};

const renderLatexHelper = (text: string | undefined | null): React.ReactNode => {
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


export default function StudentTakeTeacherTestLivePage() {
  const params = useParams();
  const router = useRouter();
  const testId = typeof params.testId === 'string' ? params.testId : '';

  const { user: currentUser, teacher: currentTeacherUser, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const [initialLoading, setInitialLoading] = useState(true);
  const [isLoadingPageData, setIsLoadingPageData] = useState(false);

  const [testDetails, setTestDetails] = useState<TeacherTestDetailsRecord | null>(null);
  const [teacherName, setTeacherName] = useState<string>('Educator');
  const [questions, setQuestions] = useState<NormalizedQuestionRecord[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, UserAnswerLog>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testSessionState, setTestSessionState] = useState<'initialLoading' | 'pinEntry' | 'instructions' | 'inProgress' | 'completed' | 'terminated'>('initialLoading');
  const [isSubmittingTest, setIsSubmittingTest] = useState(false);

  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [showInstructionModal, setShowInstructionModal] = useState(false);

  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false);

  const currentQuestion = questions[currentQuestionIndex];
  const questionStartTimeRef = useRef<number>(Date.now());
  const testStartTimeRef = useRef<number | null>(null);
  const todayDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);


  const normalizeFetchedQuestion = (q: FetchedQuestionSourceRecord, sourceCollection: 'question_bank' | 'teacher_question_data'): NormalizedQuestionRecord | null => {
    if (!q || !q.id) return null;
    let displayCorrectOptionLabel: 'A' | 'B' | 'C' | 'D' = 'A';
    let correctOptionStringFull: 'Option A' | 'Option B' | 'Option C' | 'Option D' = 'Option A';

    if (sourceCollection === 'question_bank') {
      if (q.correctOption) { displayCorrectOptionLabel = q.correctOption; correctOptionStringFull = `Option ${q.correctOption}` as any;}
    } else if (sourceCollection === 'teacher_question_data') {
      if (q.CorrectOption) { const optStr = (q.CorrectOption).replace('Option ', ''); if (['A', 'B', 'C', 'D'].includes(optStr)) { displayCorrectOptionLabel = optStr as 'A' | 'B' | 'C' | 'D'; correctOptionStringFull = q.CorrectOption;}}
    }

    const normalized: NormalizedQuestionRecord = {
      id: q.id,
      displayQuestionText: sourceCollection === 'question_bank' ? q.questionText : q.QuestionText,
      displayQuestionImageUrl: sourceCollection === 'question_bank' ? getPbFileUrl(q, 'questionImage') : (isValidHttpUrl(q.QuestionImage_teacher) ? q.QuestionImage_teacher : null),
      displayOptions: (['A', 'B', 'C', 'D'] as const).map(label => {
        const textKey = sourceCollection === 'question_bank' ? `option${label}Text` : `Option${label}Text`;
        const imageFieldKey = sourceCollection === 'question_bank' ? `option${label}Image` : `Option${label}Image_teacher`; // Corrected: was Option${label}Image
        return {
          label: label,
          text: q[textKey] as string | null || null,
          imageUrl: sourceCollection === 'question_bank' ? getPbFileUrl(q, imageFieldKey) : (isValidHttpUrl(q[imageFieldKey] as string | null) ? q[imageFieldKey] as string : null),
        };
      }),
      displayCorrectOptionLabel,
      correctOptionString: correctOptionStringFull,
      displayExplanationText: sourceCollection === 'question_bank' ? q.explanationText : q.explanationText_teacher,
      displayExplanationImageUrl: sourceCollection === 'question_bank' ? getPbFileUrl(q, 'explanationImage') : (isValidHttpUrl(q.explanationImage_teacher) ? q.explanationImage_teacher : null),
      marks: typeof q.marks === 'number' ? q.marks : 1,
      subject: q.subject || null,
      lessonName: sourceCollection === 'question_bank' ? q.lessonName : q.LessonName,
      difficulty: q.difficulty as NormalizedQuestionRecord['difficulty'] || null,
      originalSourceCollection: sourceCollection,
      rawRecord: q,
    };
    return normalized;
  };

  const handleSubmitTest = useCallback(async (autoSubmit = false, terminationReason?: string) => {
    if (!currentUser || !testDetails || isSubmittingTest || testSessionState === 'completed' || testSessionState === 'terminated') {
      console.warn("handleSubmitTest (teacher test) blocked. Conditions not met:", {currentUser: !!currentUser, testDetails: !!testDetails, isSubmittingTest, testSessionState});
      return;
    }
    setIsSubmittingTest(true);

    if (currentQuestion && userAnswers[currentQuestion.id] && questionStartTimeRef.current && testSessionState === 'inProgress') {
      const currentTime = Date.now();
      const timeSpentCurrentQuestion = Math.round((currentTime - questionStartTimeRef.current) / 1000);
      userAnswers[currentQuestion.id].timeSpentSeconds = (userAnswers[currentQuestion.id].timeSpentSeconds || 0) + timeSpentCurrentQuestion;
    }

    let correctCount = 0; let attemptedCount = 0; let pointsEarnedFromTest = 0;
    let totalMarksForTest = 0;

    const answersLogForDb = questions.map(q => {
      const userAnswerRec = userAnswers[q.id];
      const selected = userAnswerRec?.selectedOption || null;
      let isCorrectAns = false;
      const questionCorrectOptionString = q.correctOptionString;
      const questionMarks = typeof q.marks === 'number' ? q.marks : 1;
      totalMarksForTest += questionMarks;

      if (selected) {
        attemptedCount++;
        if (selected === questionCorrectOptionString) {
          correctCount++;
          isCorrectAns = true;
          pointsEarnedFromTest += questionMarks;
        }
      }
      return {
        questionId: q.id,
        selectedOption: selected,
        correctOption: questionCorrectOptionString,
        isCorrect: isCorrectAns,
        markedForReview: userAnswerRec?.markedForReview || false,
        timeSpentSeconds: userAnswerRec?.timeSpentSeconds || 0,
      };
    });

    const maxScorePossible = testDetails.totalScore && testDetails.totalScore > 0 ? testDetails.totalScore : totalMarksForTest;
    const percentageScore = maxScorePossible > 0 ? (pointsEarnedFromTest / maxScorePossible) * 100 : 0;

    const finalTestStatusDbValue: TeacherTestAttempt['status'] = terminationReason === 'time_up'
        ? 'terminated_time_up'
        : (terminationReason === 'manual' ? 'terminated_manual' : 'completed');

    const durationTakenSecs = testStartTimeRef.current ? Math.round((Date.now() - testStartTimeRef.current) / 1000) : (timeLeft !== null && testDetails?.duration ? (parseInt(testDetails.duration, 10)*60 - timeLeft) : 0);


    const resultDataToSave: Partial<TeacherTestAttempt> = {
      student: currentUser.id,
      teacher_test: testDetails.id,
      teacher: testDetails.teacherId,
      test_name_cache: testDetails.testName,
      teacher_name_cache: testDetails.expand?.teacherId?.name || 'Educator',
      score: pointsEarnedFromTest,
      max_score: maxScorePossible,
      total_questions: questions.length,
      attempted_questions: attemptedCount,
      correct_answers: correctCount,
      incorrect_answers: attemptedCount - correctCount,
      unattempted_questions: questions.length - attemptedCount,
      percentage: parseFloat(percentageScore.toFixed(2)),
      duration_taken_seconds: Math.max(0, durationTakenSecs),
      answers_log: JSON.stringify(answersLogForDb),
      status: finalTestStatusDbValue,
      plan_context: "Subscribed - Teacher Plan",
      started_at: testStartTimeRef.current ? new Date(testStartTimeRef.current).toISOString() : new Date().toISOString(),
      submitted_at: new Date().toISOString(),
      marked_for_review_without_selecting_option: answersLogForDb.filter(a => a.markedForReview && !a.selectedOption).length,
      marked_for_review_with_selecting_option: answersLogForDb.filter(a => a.markedForReview && a.selectedOption).length,
    };
    console.log("Submitting test data to teacher_test_history:", resultDataToSave);
    try {
      const createdResultRecord = await pb.collection('teacher_test_history').create(resultDataToSave);
      setTestSessionState(finalTestStatusDbValue === 'completed' ? 'completed' : 'terminated');
      setTimeLeft(0);
      toast({ title: autoSubmit ? (terminationReason ? "Test Terminated" : "Test Auto-Submitted") : "Test Submitted Successfully!", description: `Your results for "${testDetails.testName}" have been recorded. ${terminationReason ? `Reason: ${terminationReason.replace(/_/g, ' ')}.` : ''}` });
      router.push(Routes.testResultTeacherTest(createdResultRecord.id));
    } catch (err: any) {
      console.error("Failed to submit teacher test results:", err.data || err.message, "Full Error:", err);
      toast({ title: "Submission Failed", description: `Could not save your results. Error: ${err.data?.message || err.message}`, variant: "destructive" });
    } finally {
      setIsSubmittingTest(false);
      setIsSubmitConfirmOpen(false);
    }
  }, [currentUser, testDetails, questions, userAnswers, timeLeft, router, toast, isSubmittingTest, testSessionState, currentQuestion]);

  const loadQuestionsAndStartTest = useCallback(async (currentTestDetails: TeacherTestDetailsRecord, isMountedGetter: () => boolean) => {
    if (!isMountedGetter()) return;
    setIsLoadingPageData(true);

    const eduNexusQuestionIds = Array.isArray(currentTestDetails.questions_edunexus) ? currentTestDetails.questions_edunexus : [];
    const teacherQuestionIds = Array.isArray(currentTestDetails.questions_teachers) ? currentTestDetails.questions_teachers : [];

    const allQuestionIdsFromTestDetails = [...eduNexusQuestionIds, ...teacherQuestionIds];
    if (allQuestionIdsFromTestDetails.length === 0) {
      if (isMountedGetter()) { setError("No questions are linked to this test. Please contact the teacher."); setQuestions([]); setIsLoadingPageData(false); setTestSessionState('terminated'); }
      return;
    }

    let fetchedAndNormalizedQuestions: NormalizedQuestionRecord[] = [];
    const originalOrderMap = new Map<string, number>();
    allQuestionIdsFromTestDetails.forEach((id, index) => originalOrderMap.set(id, index));

    try {
      if (eduNexusQuestionIds.length > 0) {
        const eduNexusQuestionRecords = await pb.collection('question_bank').getFullList<FetchedQuestionSourceRecord>({
          filter: eduNexusQuestionIds.map(id => `id="${escapeForPbFilter(id)}"`).join('||'),
          '$autoCancel': false,
        });
        if (isMountedGetter()) { fetchedAndNormalizedQuestions.push(...eduNexusQuestionRecords.map(q => normalizeFetchedQuestion(q, 'question_bank')).filter(Boolean) as NormalizedQuestionRecord[]); } else return;
      }

      if (teacherQuestionIds.length > 0) {
        const teacherQuestionRecords = await pb.collection('teacher_question_data').getFullList<FetchedQuestionSourceRecord>({
          filter: teacherQuestionIds.map(id => `id="${escapeForPbFilter(id)}"`).join('||'),
          '$autoCancel': false,
        });
        if (isMountedGetter()) { fetchedAndNormalizedQuestions.push(...teacherQuestionRecords.map(q => normalizeFetchedQuestion(q, 'teacher_question_data')).filter(Boolean) as NormalizedQuestionRecord[]); } else return;
      }

      const orderedQuestions = fetchedAndNormalizedQuestions.sort((a,b) => (originalOrderMap.get(a.id) ?? Infinity) - (originalOrderMap.get(b.id) ?? Infinity));

      if (isMountedGetter()) {
        if (orderedQuestions.length === 0) {
          setError("Could not load any questions for this test. They may have been deleted or there's a data mismatch.");
          setQuestions([]); setTestSessionState('terminated');
        } else {
          setQuestions(orderedQuestions);
          const initialAnswers: Record<string, UserAnswerLog> = {};
          orderedQuestions.forEach(q => { initialAnswers[q.id] = { questionId: q.id, selectedOption: null, correctOption: q.correctOptionString, isCorrect: false, markedForReview: false, timeSpentSeconds: 0 }; });
          setUserAnswers(initialAnswers);
          setTestSessionState('inProgress');
          const durationMinutes = parseInt(currentTestDetails.duration || "60", 10);
          setTimeLeft(durationMinutes > 0 ? durationMinutes * 60 : 3600);
          testStartTimeRef.current = Date.now();
          questionStartTimeRef.current = Date.now();
          toast({ title: "Test Started!", description: "Good luck!" });
        }
      }
    } catch (err: any) {
      if (isMountedGetter()) {
        console.error("Error in loadQuestionsAndStartTest:", err);
        let errorMsg = `Could not load questions. Error: ${err.data?.message || err.message}.`;
        setError(errorMsg); setTestSessionState('terminated');
      }
    } finally {
      if (isMountedGetter()) setIsLoadingPageData(false);
    }
  }, [escapeForPbFilter, toast]);

  const fetchTestDataAndDecideStage = useCallback(async (isMountedGetter: () => boolean) => {
    const currentTestId = typeof testId === 'string' ? testId : '';
    if (!currentTestId) { if (isMountedGetter()) { setError("Invalid test ID."); setInitialLoading(false); setIsLoadingPageData(false); setTestSessionState('terminated'); } return; }
    if (!currentUser?.id && !currentTeacherUser?.id) { if (isMountedGetter()) { setError("User not authenticated."); setInitialLoading(false); setIsLoadingPageData(false); setTestSessionState('terminated'); } return; }

    if (isMountedGetter()) { setInitialLoading(true); setIsLoadingPageData(true); }

    try {
      const fetchedTest = await pb.collection('teacher_tests').getOne<TeacherTestDetailsRecord>(currentTestId, {
        expand: 'teacherId',
        fields: 'id,testName,Admin_Password,duration,teacherId,QBExam,model,Test_Subject,questions_edunexus,questions_teachers,status,totalScore,expand.teacherId.name,expand.teacherId.EduNexus_Name',
        '$autoCancel': false
      });
      if (!isMountedGetter()) return;

      const isOwningTeacher = currentTeacherUser?.id === fetchedTest.teacherId || currentTeacherUser?.id === fetchedTest.expand?.teacherId?.id;

      if (!isOwningTeacher && fetchedTest.status !== 'Published') {
        if (isMountedGetter()) { setError("This test is not currently published or available."); setInitialLoading(false); setIsLoadingPageData(false); setTestSessionState('terminated'); }
        return;
      }
      setTestDetails(fetchedTest);
      setTeacherName(fetchedTest.expand?.teacherId?.name || 'Educator');

      const pinSessionKey = `${TEST_PIN_SESSION_KEY_PREFIX}${currentTestId}`;
      const pinIsVerifiedInSession = sessionStorage.getItem(pinSessionKey) === 'true';

      if (fetchedTest.Admin_Password && String(fetchedTest.Admin_Password).trim() !== '' && !pinIsVerifiedInSession) {
        if (isMountedGetter()) setTestSessionState('pinEntry');
      } else {
        if (isMountedGetter()) { setShowInstructionModal(true); setTestSessionState('instructions'); }
      }
    } catch (err: any) {
      if (isMountedGetter()) {
        console.error("Error in fetchTestDataAndDecideStage:", err);
        let errorMsg = `Could not load test. Error: ${err.data?.message || err.message}.`;
        if (err.status === 404) errorMsg = "Test not found or not accessible.";
        setError(errorMsg); setTestSessionState('terminated');
      }
    } finally {
      if (isMountedGetter()) { setInitialLoading(false); setIsLoadingPageData(false); }
    }
  }, [testId, currentUser?.id, currentTeacherUser?.id]);


  useEffect(() => {
    let isMounted = true;
    if (!isAuthLoading) {
      fetchTestDataAndDecideStage(() => isMounted);
    }
    return () => { isMounted = false; };
  }, [testId, isAuthLoading, fetchTestDataAndDecideStage]);


  useEffect(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (testSessionState === 'inProgress' && timeLeft !== null && timeLeft > 0 && !isSubmitConfirmOpen) {
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(timerIntervalRef.current!);
            handleSubmitTest(true, "time_up");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, [testSessionState, timeLeft, isSubmitConfirmOpen, handleSubmitTest]);

  const handlePinVerify = async () => {
    if (!testDetails || testDetails.Admin_Password === null || testDetails.Admin_Password === undefined) {
      setPinError("Test PIN configuration error by teacher."); return;
    }
    setIsVerifyingPin(true); setPinError(null);
    if (enteredPin === String(testDetails.Admin_Password).trim()) {
      toast({ title: "PIN Verified!", description: "Loading test instructions..." });
      sessionStorage.setItem(`${TEST_PIN_SESSION_KEY_PREFIX}${testId}`, 'true');
      setTestSessionState('instructions');
      setShowInstructionModal(true);
    } else {
      setPinError("Invalid PIN. Please try again.");
    }
    setIsVerifyingPin(false);
  };

  const handleStartTestAfterInstructions = () => {
    setShowInstructionModal(false);
    if (testDetails) {
        loadQuestionsAndStartTest(testDetails, () => true);
    } else {
        setError("Test details not available to start.");
        setTestSessionState('terminated');
    }
  };

  const handleOptionChange = (value: string) => { if (testSessionState !== 'inProgress' || !currentQuestion) return; setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...(prev[currentQuestion.id] || { questionId: currentQuestion.id, timeSpentSeconds: 0, markedForReview: false, correctOption: currentQuestion.correctOptionString }), selectedOption: value, isCorrect: false }})); };
  const handleClearResponse = () => { if (testSessionState !== 'inProgress' || !currentQuestion) return; setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...(prev[currentQuestion.id] || { questionId: currentQuestion.id, timeSpentSeconds: 0, correctOption: currentQuestion.correctOptionString }), selectedOption: null, isCorrect: false }})); };
  const handleMarkForReview = () => { if (testSessionState !== 'inProgress' || !currentQuestion) return; setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...(prev[currentQuestion.id] || { questionId: currentQuestion.id, selectedOption: null, isCorrect: false, timeSpentSeconds: 0, correctOption: currentQuestion.correctOptionString }), markedForReview: !prev[currentQuestion.id]?.markedForReview }})); };

  const navigateQuestion = (directionOrIndex: 'next' | 'prev' | number) => {
    if (testSessionState !== 'inProgress' || !currentQuestion) return;
    if (userAnswers[currentQuestion.id]) {
        const currentTime = Date.now(); const timeSpentCurrentQuestion = Math.round((currentTime - questionStartTimeRef.current) / 1000);
        setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...prev[currentQuestion.id], timeSpentSeconds: Math.max(0, (prev[currentQuestion.id].timeSpentSeconds || 0) + timeSpentCurrentQuestion) }}));
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

  const renderOption = (option: { label: 'A' | 'B' | 'C' | 'D'; text?: string | null; imageUrl?: string | null }): React.ReactNode => {
    if(!currentQuestion) return null;
    const optionValue = `Option ${option.label}`;
    return (
        <Label key={optionValue} htmlFor={`option-${currentQuestion.id}-${option.label}`} className={cn("flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-all hover:shadow-md", userAnswers[currentQuestion.id]?.selectedOption === optionValue ? 'bg-primary/10 border-primary ring-1 ring-primary' : 'bg-card border-border hover:border-primary/50')}>
            <RadioGroupItem value={optionValue} id={`option-${currentQuestion.id}-${option.label}`} className="mt-1 border-muted-foreground data-[state=checked]:border-primary shrink-0" />
            <div className="flex-1 text-sm">
                <div className="font-semibold">{option.label}.</div>
                {option.text && <div className="prose prose-sm dark:prose-invert max-w-none mt-0.5">{renderLatexHelper(option.text)}</div>}
                {option.imageUrl && (<div className="mt-1.5"><NextImage src={option.imageUrl} alt={`Option ${option.label}`} width={200} height={100} className="rounded object-contain border" data-ai-hint="option illustration"/></div>)}
                {!(option.text || option.imageUrl) && <p className="text-muted-foreground italic">Option {option.label} content not available.</p>}
            </div>
        </Label>
    );
  };

  const QuestionPaletteContent = () => (
    <>
      <Card className="shadow-none border-0 md:border md:shadow-sm md:rounded-lg md:bg-card">
        <CardHeader className="p-3 border-b text-center">
          <UserCircleIcon className="mx-auto h-10 w-10 text-primary mb-1" />
          <CardTitle className="text-base">{currentUser?.name || "Student"}</CardTitle>
          <CardDescription className="text-xs truncate">{currentUser?.email}</CardDescription>
          <CardDescription className="text-xs">{todayDate}</CardDescription>
        </CardHeader>
      </Card>
      <Card className="border-primary/30 bg-primary/5 flex-1 flex flex-col min-h-0 shadow-md rounded-lg md:mt-3">
        <CardHeader className="p-2 text-center border-b border-primary/20"><CardTitle className="text-sm text-primary">QUESTION NAVIGATION</CardTitle></CardHeader>
        <CardContent className="p-2 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="grid grid-cols-5 sm:grid-cols-4 gap-1.5 p-1">
            {questions.map((q, index) => {
              const status = getQuestionStatusForPalette(q.id);
              const isActive = currentQuestionIndex === index;
              return (
                <Button
                  key={`${q.id}-${index}`} // Changed key
                  variant="outline"
                  size="icon"
                  className={cn("h-8 w-full text-xs rounded-md aspect-square", questionPaletteButtonClass(status, isActive))}
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
        <AlertDialog open={isSubmitConfirmOpen} onOpenChange={setIsSubmitConfirmOpen}>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full text-sm py-2.5" disabled={testSessionState !== 'inProgress' || isSubmittingTest}>
                    <CloseIcon className="mr-1.5 h-4 w-4" /> Submit Test
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <RadixAlertDialogHeader>
                    <RadixAlertDialogTitle>Confirm Submission</RadixAlertDialogTitle>
                    <RadixAlertDialogDescription>Are you sure you want to submit your test?</RadixAlertDialogDescription>
                </RadixAlertDialogHeader>
                <RadixAlertDialogFooter>
                    <AlertDialogCancel onClick={() => setIsSubmitConfirmOpen(false)} disabled={isSubmittingTest}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleSubmitTest(false, 'manual')} disabled={isSubmittingTest}>
                        {isSubmittingTest && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Yes, Submit
                    </AlertDialogAction>
                </RadixAlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );

  if (initialLoading || isAuthLoading) { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" /> <p className="text-lg">Loading test environment...</p> </div> ); }
  if (error) { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Card className="w-full max-w-lg text-center shadow-xl bg-background text-foreground"> <CardHeader> <AlertCircle className="mx-auto h-12 w-12 text-destructive" /> <CardTitle className="text-destructive">Error Loading Test</CardTitle> </CardHeader> <CardContent><p className="text-muted-foreground whitespace-pre-wrap">{error}</p></CardContent> <CardFooter><Button onClick={() => router.back()} variant="outline" className="w-full">Go Back</Button></CardFooter> </Card> </div> ); }

  if (testSessionState === 'pinEntry') {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 p-4">
        <Card className="w-full max-w-sm shadow-xl bg-card text-foreground">
          <CardHeader><CardTitle className="text-xl flex items-center gap-2"><KeyRound className="text-primary"/>Enter Test PIN</CardTitle><CardDescription>This test requires a PIN provided by {teacherName}.</CardDescription></CardHeader>
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

  if (testSessionState === 'instructions' && showInstructionModal) {
    return (
      <Dialog open={showInstructionModal} onOpenChange={(open) => { if (!open) { setShowInstructionModal(false); if (testDetails) handleStartTestAfterInstructions(); else { setError("Cannot start test, test details missing."); setTestSessionState('terminated');}} else { setShowInstructionModal(open); }}}>
        <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader><DialogTitle className="text-2xl">Test Instructions: {testDetails?.testName}</DialogTitle><DialogDescription>Read carefully before starting. Test by {teacherName}.</DialogDescription></DialogHeader>
          <ScrollArea className="flex-grow my-4 min-h-0"><div className="prose prose-sm dark:prose-invert p-1">
            <p>Total Questions: {questions.length || (testDetails?.questions_edunexus?.length || 0) + (testDetails?.questions_teachers?.length || 0)}</p>
            <p>Duration: {testDetails?.duration || 'N/A'} minutes</p>
            <p>This test is conducted by: {teacherName}.</p>
            <h4>General Instructions:</h4>
            <ol><li>The clock will be set at the server. The countdown timer in the top right corner of screen will display the remaining time.</li><li>When the timer reaches zero, the examination will end by itself.</li><li>The Question Palette on the right shows question status.</li></ol>
            {testDetails?.Test_Description && <div className="mt-4"><h4>Specific Instructions from Teacher:</h4><p>{testDetails.Test_Description}</p></div>}
          </div></ScrollArea>
          <DialogFooter className="sm:justify-center"><Button onClick={handleStartTestAfterInstructions} size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">I'm Ready, Start Test!</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (testSessionState === 'completed' || testSessionState === 'terminated') { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Card className="w-full max-w-lg text-center shadow-xl bg-background text-foreground"> <CardHeader> {testSessionState === 'completed' ? <CheckCircle className="mx-auto h-12 w-12 text-green-500" /> : <XCircle className="mx-auto h-12 w-12 text-destructive" />} <CardTitle>{testSessionState === 'completed' ? "Test Completed" : "Test Terminated"}</CardTitle> </CardHeader> <CardContent><p className="text-muted-foreground">{testSessionState === 'completed' ? "Your responses have been submitted." : "This test session has been terminated."}</p></CardContent> <CardFooter> <Button onClick={() => { if (window.opener && !window.opener.closed) window.close(); else router.push(Routes.dashboard);}} className="w-full"> Close Window / Back to Dashboard </Button> </CardFooter> </Card> </div> ); }
  if (!currentQuestion && testSessionState === 'inProgress' && !isLoadingPageData) { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Card className="w-full max-w-lg text-center shadow-xl bg-background text-foreground"> <CardHeader> <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" /> <CardTitle>No Questions</CardTitle> </CardHeader> <CardContent><p className="text-muted-foreground">No questions available for this test, or an error occurred loading them.</p></CardContent> <CardFooter><Button onClick={() => router.back()} variant="outline" className="w-full">Go Back</Button></CardFooter> </Card> </div> );}
  if (isLoadingPageData && testSessionState === 'inProgress') { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" /> <p className="text-lg">Loading questions...</p> </div> );}

  return (
    <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-900">
      <header className="sticky top-0 z-50 bg-card shadow-md p-3 border-b border-border">
        <div className="flex justify-between items-center max-w-full px-2 sm:px-4">
          <div className="text-xs sm:text-sm font-medium text-muted-foreground truncate max-w-[calc(33%-20px)] sm:max-w-xs" title={testDetails?.testName || 'Test'}>
            {testDetails?.testName || 'Test Name'} <br/>
            <span className="text-[10px] sm:text-xs">Teacher: {teacherName}</span>
          </div>
          <div className="flex-shrink-0"> <AppLogo mainTextSize="text-lg" taglineTextSize="text-[0px]" iconSize={22} /> </div>
          <div className="text-sm font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md shadow-sm flex items-center w-auto max-w-[calc(33%-20px)] sm:max-w-xs justify-end">
            <Clock className="h-4 w-4 mr-1.5 flex-shrink-0" /> <span className="truncate">{formatTime(timeLeft)}</span>
          </div>
        </div>
      </header>
      <div className="sticky top-[var(--top-header-height,73px)] sm:top-[var(--top-header-height,57px)] z-40 bg-background shadow-sm p-3 border-b border-border">
         <div className="flex justify-between items-center max-w-full px-2 sm:px-4">
            <div className="text-sm font-semibold text-foreground truncate max-w-[calc(50%-120px)] sm:max-w-md" title={currentQuestion?.subject || testDetails?.Test_Subject || 'Subject'}>
              SUBJECT: {currentQuestion?.subject || testDetails?.Test_Subject || 'N/A'}
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
                <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}><SheetTrigger asChild><Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary h-7 w-7 md:hidden" aria-label="Open Question Navigation"><ListOrdered className="h-5 w-5" /></Button></SheetTrigger><SheetContent side="right" className="w-3/4 p-0 flex flex-col"><ShadcnSheetHeader className="p-3 border-b text-center"><ShadcnSheetTitle className="text-lg">Navigation</ShadcnSheetTitle><ShadcnSheetDescription>Jump to any question or submit.</ShadcnSheetDescription></ShadcnSheetHeader><QuestionPaletteContent /></SheetContent></Sheet>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary h-7 w-7 hidden md:inline-flex" onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)} aria-label={isRightSidebarOpen ? "Hide Question Panel" : "Show Question Panel"}><MoreVertical className="h-5 w-5" /></Button>
                <Button variant="ghost" size="icon" asChild className="text-muted-foreground hover:text-primary h-7 w-7"><Link href={Routes.studentTestInstructions(testId)} target="_blank"><Info className="h-4 w-4" /></Link></Button>
            </div>
        </div>
      </div>
      <div className={cn("flex-1 flex max-w-full p-2 sm:p-4 gap-2 sm:gap-4 overflow-hidden")}>
        <Card className="flex-1 flex flex-col bg-card shadow-xl rounded-lg border border-border overflow-hidden">
            <CardHeader className="p-3 sm:p-4 border-b border-border bg-muted/30"><div className="flex justify-between items-center"><p className="text-xs sm:text-sm font-medium text-muted-foreground">Question {currentQuestionIndex + 1} of {questions.length}</p><div className="flex items-center gap-1">{currentQuestion.difficulty && <Badge variant={currentQuestion.difficulty === 'Easy' ? 'secondary' : currentQuestion.difficulty === 'Medium' ? 'default' : 'destructive'} className="text-xs px-1.5 py-0.5">{currentQuestion.difficulty}</Badge>}{currentQuestion.marks && <Badge variant="outline" className="text-xs px-1.5 py-0.5">Marks: {currentQuestion.marks}</Badge>}</div></div></CardHeader>
            <ScrollArea className="flex-1 min-h-0"><CardContent className="p-3 sm:p-4 md:p-6 space-y-4">
                <div className="p-2 border-b border-border/50 rounded-md bg-background min-h-[80px]">{currentQuestion.displayQuestionText && (<div className="prose prose-sm dark:prose-invert max-w-none mb-3 text-foreground leading-relaxed">{renderLatexHelper(currentQuestion.displayQuestionText)}</div>)}{currentQuestion.displayQuestionImageUrl && (<div className="my-2 text-center"><NextImage src={currentQuestion.displayQuestionImageUrl} alt="Question Image" width={400} height={300} className="rounded object-contain inline-block border" data-ai-hint="question diagram"/></div>)}{!(currentQuestion.displayQuestionText || currentQuestion.displayQuestionImageUrl) && (<p className="text-xs sm:text-sm text-muted-foreground italic py-3">Question content not provided.</p>)}</div>
                <RadioGroup value={userAnswers[currentQuestion.id]?.selectedOption || ""} onValueChange={handleOptionChange} className="space-y-2.5" disabled={testSessionState !== 'inProgress'}>{currentQuestion.displayOptions.map(opt => renderOption(opt))}</RadioGroup>
            </CardContent></ScrollArea>
            <CardFooter className="p-3 sm:p-4 border-t border-border bg-muted/30 flex-wrap justify-center sm:justify-between gap-2"><Button variant="outline" size="sm" onClick={handleClearResponse} disabled={testSessionState !== 'inProgress' || !userAnswers[currentQuestion.id]?.selectedOption}>Clear Response</Button><Button variant={userAnswers[currentQuestion.id]?.markedForReview ? "secondary" : "outline"} size="sm" onClick={handleMarkForReview} disabled={testSessionState !== 'inProgress'} className="border-purple-500 text-purple-600 data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-700 hover:bg-purple-500/10"><Flag className="mr-1.5 h-4 w-4" /> {userAnswers[currentQuestion.id]?.markedForReview ? "Unmark Review" : "Mark for Review"}</Button><Button size="sm" onClick={handleSaveAndNext} disabled={testSessionState !== 'inProgress' || currentQuestionIndex === questions.length - 1} className="bg-green-600 hover:bg-green-700 text-white">Save & Next <ChevronRight className="ml-1.5 h-4 w-4" /></Button></CardFooter>
        </Card>
        {isRightSidebarOpen && (<div className="hidden md:flex w-72 lg:w-80 flex-shrink-0 flex-col space-y-0"><QuestionPaletteContent /></div>)}
      </div>
    </div>
  );
}
