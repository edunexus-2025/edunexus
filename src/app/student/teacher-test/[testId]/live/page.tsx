
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
import { AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Clock, Flag, Image as ImageIconLucide, Loader2, Minimize, Send, XCircle, ArrowLeft as BackArrowIcon, Settings as SettingsIcon, Bookmark as BookmarkIconLucide, Check, PlusCircle, Info, ListOrdered, UserCircle as UserCircleIcon, Menu, PanelRightOpen, KeyRound, Lock, X as CloseIcon, MoreVertical } from 'lucide-react';
import NextImage from 'next/image';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { AppConfig, Routes, escapeForPbFilter } from '@/lib/constants';
import { AppLogo } from '@/components/layout/AppLogo';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { User } from '@/lib/types';
import Link from 'next/link';
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from '@/components/ui/badge';
import { format, addMinutes } from 'date-fns';

const TEST_PIN_SESSION_KEY_PREFIX = "testPinVerified_";

interface TeacherTestsRecordForLiveTest extends RecordModel {
  id: string;
  testName: string;
  duration: string;
  Admin_Password?: number | string | null;
  status: "Draft" | "Published" | "Archived";
  teacherId: string;
  questions_edunexus?: string[];
  questions_teachers?: string[];
  QBExam?: string;
  model?: "Chapterwise" | "Full Length";
  Test_Subject?: string; // For context
  expand?: {
    teacherId?: {
      id: string;
      name: string;
      EduNexus_Name?: string;
    };
    // The expand for questions_edunexus and questions_teachers will be handled by separate fetches
  };
}

interface FetchedQuestionSourceRecord extends RecordModel {
  id: string;
  marks?: number;
  difficulty?: 'Easy' | 'Medium' | 'Hard' | null;
  subject?: string | null;
  lessonName?: string | null; // From question_bank
  lesson_name?: string | null; // From teacher_question_data (context from testName)

  // question_bank specific (lowercase, filenames)
  questionText?: string | null;
  optionAText?: string | null;
  optionBText?: string | null;
  optionCText?: string | null;
  optionDText?: string | null;
  correctOption?: 'A' | 'B' | 'C' | 'D' | null;
  explanationText?: string | null;
  questionImage?: string | null; // filename
  optionAImage?: string | null;  // filename
  optionBImage?: string | null;  // filename
  optionCImage?: string | null;  // filename
  optionDImage?: string | null;  // filename
  explanationImage?: string | null; // filename
  collectionId?: string; // Always present on fetched records
  collectionName?: 'question_bank' | 'teacher_question_data'; // Always present

  // teacher_question_data specific (PascalCase, direct URLs or filenames)
  QuestionText?: string | null;
  // OptionAText from teacher_question_data is already covered by the lowercase version for mapping
  // OptionBText from teacher_question_data is already covered
  // OptionCText from teacher_question_data is already covered
  // OptionDText from teacher_question_data is already covered
  CorrectOption?: 'Option A' | 'Option B' | 'Option C' | 'Option D' | null;
  explanationText_teacher?: string | null; // Assuming this is the field name if different
  QuestionImage_teacher?: string | null; // direct URL or filename
  OptionAImage_teacher?: string | null;  // direct URL or filename
  OptionBImage_teacher?: string | null;  // direct URL or filename
  OptionCImage_teacher?: string | null;  // direct URL or filename
  OptionDImage_teacher?: string | null;  // direct URL or filename
  explanationImage_teacher?: string | null; // direct URL or filename
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
  displayExplanationText?: string | null;
  displayExplanationImageUrl?: string | null;
  marks: number;
  subject?: string | null;
  difficulty?: 'Easy' | 'Medium' | 'Hard' | null;
  lessonName?: string | null;
  originalSourceCollection: 'question_bank' | 'teacher_question_data';
  rawRecord: FetchedQuestionSourceRecord;
}

interface UserAnswer {
  questionId: string;
  selectedOption: string | null;
  isCorrect: boolean | null;
  markedForReview: boolean;
  timeSpentSeconds: number;
}

const isValidHttpUrl = (str: string | null | undefined): str is string => {
  if (!str) return false;
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
};

const getPbFileUrl = (record: FetchedQuestionSourceRecord | null | undefined, fieldName: keyof FetchedQuestionSourceRecord): string | null => {
  if (!record) return null;
  const filename = record[fieldName] as string | undefined | null;
  if (record && filename && record.collectionId && record.collectionName) {
    try {
      return pb.files.getUrl(record as RecordModel, filename);
    } catch (e) {
      console.warn(`StudentTeacherTestLivePage (getPbFileUrl): Error for field '${fieldName}' in record '${record.id}'. Value: '${filename}'. Collection: ${record.collectionName}. Error:`, e);
      return null;
    }
  }
  return null;
};

export default function StudentTakeTeacherTestLivePage() {
  const params = useParams();
  const router = useRouter();
  const testIdFromParams = params.testId;
  const testId = typeof testIdFromParams === 'string' ? testIdFromParams : Array.isArray(testIdFromParams) ? testIdFromParams[0] : '';

  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const [testDetails, setTestDetails] = useState<TeacherTestsRecordForLiveTest | null>(null);
  const [teacherName, setTeacherName] = useState<string>('Your Teacher');
  const [questions, setQuestions] = useState<NormalizedQuestionRecord[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, UserAnswer>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  
  const [isLoadingPageData, setIsLoadingPageData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testSessionState, setTestSessionState] = useState<'initialLoading' | 'pinEntry' | 'instructions' | 'inProgress' | 'completed' | 'terminated'>('initialLoading');
  
  const [isSubmittingTest, setIsSubmittingTest] = useState(false);
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false);
  
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  const currentQuestion = questions[currentQuestionIndex];
  const questionStartTimeRef = useRef<number>(Date.now());
  const todayDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const normalizeFetchedQuestion = (q: FetchedQuestionSourceRecord): NormalizedQuestionRecord => {
    const sourceCollection = q.collectionName;
    let displayCorrectOptLabel: 'A' | 'B' | 'C' | 'D' = 'A';

    if (sourceCollection === 'question_bank' && q.correctOption) {
      displayCorrectOptLabel = q.correctOption;
    } else if (sourceCollection === 'teacher_question_data' && q.CorrectOption) {
      const mapped = q.CorrectOption.replace('Option ', '');
      if (['A', 'B', 'C', 'D'].includes(mapped)) {
        displayCorrectOptLabel = mapped as 'A' | 'B' | 'C' | 'D';
      }
    }
    
    const getText = (qbField: keyof FetchedQuestionSourceRecord, teacherField: keyof FetchedQuestionSourceRecord) => 
      sourceCollection === 'question_bank' ? q[qbField] : q[teacherField];

    const getImageUrl = (qbFileField: keyof FetchedQuestionSourceRecord, teacherDirectUrlField: keyof FetchedQuestionSourceRecord) => 
      sourceCollection === 'question_bank' 
        ? getPbFileUrl(q, qbFileField) 
        : (isValidHttpUrl(q[teacherDirectUrlField] as string | null) ? q[teacherDirectUrlField] as string | null : null);

    return {
      id: q.id,
      displayQuestionText: getText('questionText', 'QuestionText') as string | null,
      displayQuestionImageUrl: getImageUrl('questionImage', 'QuestionImage_teacher'),
      displayOptions: (['A', 'B', 'C', 'D'] as const).map(label => ({
        label,
        text: getText(`option${label}Text` as keyof FetchedQuestionSourceRecord, `Option${label}Text` as keyof FetchedQuestionSourceRecord) as string | null,
        imageUrl: getImageUrl(`option${label}Image` as keyof FetchedQuestionSourceRecord, `Option${label}Image_teacher` as keyof FetchedQuestionSourceRecord),
      })),
      displayCorrectOptionLabel,
      displayExplanationText: getText('explanationText', 'explanationText_teacher') as string | null,
      displayExplanationImageUrl: getImageUrl('explanationImage', 'explanationImage_teacher'),
      marks: typeof q.marks === 'number' ? q.marks : 1,
      subject: q.subject || null,
      difficulty: q.difficulty || null,
      lessonName: q.lessonName || q.lesson_name || null,
      originalSourceCollection: sourceCollection!,
      rawRecord: q,
    };
  };
  
  const loadQuestions = useCallback(async (currentTestDetails: TeacherTestsRecordForLiveTest, isMountedGetter: () => boolean) => {
    if (!isMountedGetter()) return;
    setIsLoadingPageData(true); 
    setError(null); 
  
    try {
      const eduNexusQuestionIds = Array.isArray(currentTestDetails.questions_edunexus) ? currentTestDetails.questions_edunexus.map((item: any) => typeof item === 'string' ? item : item?.id).filter(Boolean) : [];
      const teacherQuestionIds = Array.isArray(currentTestDetails.questions_teachers) ? currentTestDetails.questions_teachers.map((item: any) => typeof item === 'string' ? item : item?.id).filter(Boolean) : [];
      
      let eduNexusQuestionRecords: FetchedQuestionSourceRecord[] = [];
      if (eduNexusQuestionIds.length > 0) {
        const filter = eduNexusQuestionIds.map(id => `id="${escapeForPbFilter(id)}"`).join('||');
        eduNexusQuestionRecords = await pb.collection('question_bank').getFullList<FetchedQuestionSourceRecord>({ filter, '$autoCancel': false });
      }
  
      let teacherQuestionRecords: FetchedQuestionSourceRecord[] = [];
      if (teacherQuestionIds.length > 0) {
        const filter = teacherQuestionIds.map(id => `id="${escapeForPbFilter(id)}"`).join('||');
        teacherQuestionRecords = await pb.collection('teacher_question_data').getFullList<FetchedQuestionSourceRecord>({ filter, '$autoCancel': false });
      }
      if (!isMountedGetter()) return;
  
      const normalizedEduNexusQs = eduNexusQuestionRecords.map(q => normalizeFetchedQuestion({ ...q, collectionName: 'question_bank' }));
      const normalizedTeacherQs = teacherQuestionRecords.map(q => normalizeFetchedQuestion({ ...q, collectionName: 'teacher_question_data' }));
      
      const allNormalizedQuestions = [...normalizedEduNexusQs, ...normalizedTeacherQs];
      const originalOrder = [...eduNexusQuestionIds, ...teacherQuestionIds];
  
      let orderedQuestions = allNormalizedQuestions;
      if (originalOrder.length > 0) {
         orderedQuestions.sort((a, b) => {
            const indexA = originalOrder.indexOf(a.id); const indexB = originalOrder.indexOf(b.id);
            if (indexA === -1 && indexB === -1) return 0; if (indexA === -1) return 1; if (indexB === -1) return -1;
            return indexA - indexB;
         });
      }
  
      if (isMountedGetter()) {
        if (orderedQuestions.length === 0) {
          setError(`No questions found for "${currentTestDetails.testName}". This might be because the linked questions were deleted or there's a configuration issue. Please contact the teacher.`);
          setTestSessionState('terminated');
        } else {
          setQuestions(orderedQuestions);
          const initialAnswers: Record<string, UserAnswer> = {};
          orderedQuestions.forEach(q => {
            initialAnswers[q.id] = { questionId: q.id, selectedOption: null, isCorrect: null, markedForReview: false, timeSpentSeconds: 0 };
          });
          setUserAnswers(initialAnswers);
          setTestSessionState('inProgress'); 
          questionStartTimeRef.current = Date.now();
          toast({ title: "Test Started!", description: `Good luck on "${currentTestDetails.testName}"!` });
        }
      }
    } catch (loadErr: any) {
      if (isMountedGetter()) {
        console.error("StudentTeacherTestLivePage (loadQuestions): Error loading questions.", loadErr);
        setError(`Failed to load questions for the test: ${loadErr.message || 'Unknown error'}`);
        setTestSessionState('terminated');
      }
    } finally {
      if (isMountedGetter()) setIsLoadingPageData(false);
    }
  }, [toast, escapeForPbFilter]);
  
  const fetchTestDataAndDecideStage = useCallback(async (isMountedGetter: () => boolean) => {
    if (!testId || !user?.id) {
      if (isMountedGetter()) { setError(testId ? "User not authenticated." : "Test ID is missing."); setTestSessionState('terminated'); setIsLoadingPageData(false); }
      return;
    }
    if (isMountedGetter()) setTestSessionState('initialLoading');

    try {
      const fetchedTest = await pb.collection('teacher_tests').getOne<TeacherTestsRecordForLiveTest>(testId, {
        expand: 'teacherId', 
        '$autoCancel': false,
      });
      if (!isMountedGetter()) return;

      if (fetchedTest.status !== 'Published') {
        if (isMountedGetter()) { setError("This test is not currently published by the teacher."); setTestSessionState('terminated'); }
        return;
      }
      if (!fetchedTest.teacherId || !fetchedTest.expand?.teacherId) {
        if (isMountedGetter()) { setError("Test configuration error: Teacher details missing."); setTestSessionState('terminated');}
        return;
      }

      setTestDetails(fetchedTest);
      setTeacherName(fetchedTest.expand.teacherId.name || 'Your Teacher');

      const pinSessionKey = `${TEST_PIN_SESSION_KEY_PREFIX}${testId}`;
      const pinIsVerifiedInSession = sessionStorage.getItem(pinSessionKey) === 'true';

      if (fetchedTest.Admin_Password && String(fetchedTest.Admin_Password).trim() !== '' && !pinIsVerifiedInSession) {
        if (isMountedGetter()) setTestSessionState('pinEntry');
      } else {
        if (isMountedGetter()) setTestSessionState('instructions');
      }
    } catch (err: any) {
      if (isMountedGetter()) {
        console.error("StudentTeacherTestLivePage (fetchTestDataAndDecideStage): Error fetching test details.", err);
        let errorMsg = `Could not load test. Error: ${err.data?.message || err.message}.`;
        if (err.status === 404) errorMsg = "Test not found or not accessible.";
        setError(errorMsg);
        setTestSessionState('terminated');
      }
    } finally {
      // setIsLoadingPageData(false) is handled by loadQuestions or if pinEntry is shown
      if (testSessionState === 'pinEntry' && isMountedGetter()) {
        setIsLoadingPageData(false);
      }
    }
  }, [testId, user?.id]);

  const handleSubmitTest = useCallback(async (autoSubmit = false, terminationReason?: string) => {
    if (!user || !testDetails || !testDetails.teacherId || isSubmittingTest || testSessionState === 'completed' || testSessionState === 'terminated') {
      console.warn("handleSubmitTest (teacher test) blocked. Conditions not met:", { user: !!user, testDetails: !!testDetails, teacherId: testDetails?.teacherId, isSubmittingTest, testSessionState });
      return;
    }
    setIsSubmittingTest(true);

    if (currentQuestion && userAnswers[currentQuestion.id] && questionStartTimeRef.current && testSessionState === 'inProgress') {
        const currentTime = Date.now();
        const timeSpentCurrentQuestion = Math.round((currentTime - questionStartTimeRef.current) / 1000);
        userAnswers[currentQuestion.id].timeSpentSeconds = (userAnswers[currentQuestion.id].timeSpentSeconds || 0) + timeSpentCurrentQuestion;
    }

    let correctCount = 0; let attemptedCount = 0; let totalMarksForTest = 0;
    const answersLogForDb = questions.map(q => {
      const userAnswerRec = userAnswers[q.id];
      const selected = userAnswerRec?.selectedOption || null;
      let isCorrectAns = false;
      const questionMarks = q.marks || 1;
      totalMarksForTest += questionMarks;

      if (selected) {
        attemptedCount++;
        if (selected === `Option ${q.displayCorrectOptionLabel}`) {
          correctCount++;
          isCorrectAns = true;
        }
      }
      return { questionId: q.id, selectedOption: selected, correctOption: `Option ${q.displayCorrectOptionLabel}`, isCorrect: isCorrectAns, markedForReview: userAnswerRec?.markedForReview || false, timeSpentSeconds: userAnswerRec?.timeSpentSeconds || 0 };
    });

    const score = correctCount; 
    const percentage = totalMarksForTest > 0 ? (score / totalMarksForTest) * 100 : 0;
    const finalTestStatusString: "completed" | "terminated_time_up" | "terminated_proctoring" = terminationReason === 'time_up' ? 'terminated_time_up' : (autoSubmit && terminationReason ? 'terminated_proctoring' : 'completed');
    const durationTakenSecs = testDetails?.duration ? parseInt(testDetails.duration, 10) * 60 - (timeLeft || 0) : 0;
    const safeDurationTakenSecs = Math.max(0, durationTakenSecs);

    const resultDataToSave = {
      student: user.id,
      teacher_test: testDetails.id,
      teacher: testDetails.teacherId,
      test_name_cache: testDetails.testName,
      teacher_name_cache: teacherName,
      score: score,
      max_score: totalMarksForTest,
      total_questions: questions.length,
      attempted_questions: attemptedCount,
      correct_answers: correctCount,
      incorrect_answers: attemptedCount - correctCount,
      unattempted_questions: questions.length - attemptedCount,
      percentage: parseFloat(percentage.toFixed(2)),
      duration_taken_seconds: safeDurationTakenSecs,
      answers_log: JSON.stringify(answersLogForDb),
      status: finalTestStatusString,
      plan_context: "Subscribed - Teacher Plan", 
      started_at: new Date(Date.now() - safeDurationTakenSecs * 1000).toISOString(),
      submitted_at: new Date().toISOString(),
      marked_for_review_without_selecting_option: answersLogForDb.filter(a => a.markedForReview && !a.selectedOption).length,
      marked_for_review_with_selecting_option: answersLogForDb.filter(a => a.markedForReview && a.selectedOption).length,
    };

    try {
      const createdResultRecord = await pb.collection('teacher_test_history').create(resultDataToSave);
      setTestSessionState(finalTestStatusString === 'completed' ? 'completed' : 'terminated');
      setTimeLeft(0);
      toast({ title: autoSubmit ? (terminationReason ? "Test Terminated" : "Test Auto-Submitted") : "Test Submitted Successfully!", description: `Your results have been recorded. ${terminationReason ? `Reason: ${terminationReason.replace(/_/g, ' ')}.` : ''}` });
      router.push(Routes.testResultTeacherTest(createdResultRecord.id));
    } catch (err: any) {
      console.error("Failed to submit teacher test results to teacher_test_history. Payload:", resultDataToSave, "Error:", err.data?.data || err.message, "Full Error:", err);
      toast({ title: "Submission Failed", description: `Could not save your results. Error: ${err.data?.message || err.message}`, variant: "destructive" });
    } finally {
      setIsSubmittingTest(false);
      setIsSubmitConfirmOpen(false); // Ensure dialog closes on attempt
    }
  }, [user, testDetails, questions, userAnswers, timeLeft, router, toast, teacherName, testSessionState, currentQuestion, isSubmittingTest]);


  useEffect(() => {
    let isMounted = true;
    if (!isAuthLoading) {
      fetchTestDataAndDecideStage(() => isMounted);
    }
    return () => { isMounted = false; };
  }, [testId, isAuthLoading, fetchTestDataAndDecideStage]);

  useEffect(() => {
    let isMounted = true;
    if (testSessionState === 'instructions' && testDetails && questions.length === 0 && !isLoadingPageData && !error) {
      loadQuestions(testDetails, () => isMounted);
    }
    return () => { isMounted = false; };
  }, [testSessionState, testDetails, questions.length, isLoadingPageData, error, loadQuestions]);

  useEffect(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (testSessionState === 'inProgress' && timeLeft !== null && timeLeft > 0 && !isSubmitConfirmOpen) { // Pause if submit dialog is open
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else if (timeLeft === 0 && testSessionState === 'inProgress') {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (!isSubmittingTest) handleSubmitTest(true, "time_up");
    }
    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, [testSessionState, timeLeft, handleSubmitTest, isSubmitConfirmOpen, isSubmittingTest]);

  const handlePinVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (!testDetails || !testDetails.Admin_Password) { setPinError("Test details or PIN not loaded."); return; }
    setIsVerifyingPin(true); setPinError(null);
    if (String(enteredPin) === String(testDetails.Admin_Password)) {
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
    if (!testDetails || !testDetails.duration ) { // Removed questions.length === 0 check here, as it's handled by loadQuestions
      toast({ title: "Error", description: "Cannot start: Test details (like duration) missing.", variant: "destructive" });
      setTestSessionState('terminated');
      return;
    }
    // If questions aren't loaded yet by the effect, loadQuestions will be triggered by state change to 'instructions'
    // and then it will move to 'inProgress' or 'terminated'
    // For now, just set time and proceed. The useEffect for 'instructions' will handle question loading if needed.
    const durationMinutes = parseInt(testDetails.duration, 10);
    setTimeLeft(durationMinutes > 0 ? durationMinutes * 60 : 3600);

    // If questions are already loaded (e.g., quick navigation or re-entry), go to inProgress
    if (questions.length > 0) {
        setTestSessionState('inProgress');
        questionStartTimeRef.current = Date.now();
        toast({ title: "Test Started!", description: `Good luck on "${testDetails.testName}"!` });
    } else {
        // If questions are not loaded, loadQuestions effect will run.
        // To avoid a flicker of "Preparing test..." ensure isLoadingPageData is true until questions load or fail.
        setIsLoadingPageData(true); 
    }
  };
  
  const handleOptionChange = (value: string) => { if (testSessionState !== 'inProgress' || !currentQuestion) return; setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...(prev[currentQuestion.id] || { questionId: currentQuestion.id, timeSpentSeconds: 0, markedForReview: false }), selectedOption: value, isCorrect: null, }})); };
  const handleClearResponse = () => { if (testSessionState !== 'inProgress' || !currentQuestion) return; setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...(prev[currentQuestion.id] || { questionId: currentQuestion.id, timeSpentSeconds: 0 }), selectedOption: null, isCorrect: null, }})); };
  const handleMarkForReview = () => { if (testSessionState !== 'inProgress' || !currentQuestion) return; setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...(prev[currentQuestion.id] || { questionId: currentQuestion.id, selectedOption: null, isCorrect: null, timeSpentSeconds: 0 }), markedForReview: !prev[currentQuestion.id]?.markedForReview, }})); };
  
  const navigateQuestion = (directionOrIndex: 'next' | 'prev' | number) => {
    if (testSessionState !== 'inProgress' || !currentQuestion || !questions.length) return;
    if (userAnswers[currentQuestion.id]) {
        const currentTime = Date.now(); const timeSpentCurrentQuestion = Math.round((currentTime - questionStartTimeRef.current) / 1000);
        setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...prev[currentQuestion.id], timeSpentSeconds: (prev[currentQuestion.id].timeSpentSeconds || 0) + timeSpentCurrentQuestion }}));
    }
    let newIndex = currentQuestionIndex;
    if (directionOrIndex === 'next') newIndex = Math.min(questions.length - 1, currentQuestionIndex + 1);
    else if (directionOrIndex === 'prev') newIndex = Math.max(0, currentQuestionIndex - 1);
    else if (typeof directionOrIndex === 'number') newIndex = Math.max(0, Math.min(questions.length - 1, directionOrIndex));
    
    if (newIndex >= 0 && newIndex < questions.length) {
        setCurrentQuestionIndex(newIndex); 
        questionStartTimeRef.current = Date.now();
    }
  };
  const handleSaveAndNext = () => navigateQuestion('next');

  const _renderLatex = (text: string | undefined | null): React.ReactNode => {
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

  const renderOption = (opt: NormalizedQuestionRecord['displayOptions'][0]): React.ReactNode => {
    if (!currentQuestion) return null;
    const optionValue = `Option ${opt.label}`;
    return (
      <Label key={optionValue} htmlFor={`option-${currentQuestion.id}-${opt.label}`} className={cn(
        "flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-all hover:shadow-md",
        userAnswers[currentQuestion.id]?.selectedOption === optionValue ? 'bg-primary/10 border-primary ring-1 ring-primary' : 'bg-card border-border hover:border-primary/50'
      )}>
        <RadioGroupItem value={optionValue} id={`option-${currentQuestion.id}-${opt.label}`} className="mt-1 border-muted-foreground data-[state=checked]:border-primary shrink-0" />
        <div className="flex-1 text-sm">
          <div className="font-semibold">{opt.label}.</div>
          {opt.text && <div className="prose prose-sm dark:prose-invert max-w-none mt-0.5">{_renderLatex(opt.text)}</div>}
          {opt.imageUrl && (<div className="mt-1.5"><NextImage src={opt.imageUrl} alt={`Option ${opt.label}`} width={200} height={100} className="rounded object-contain border" data-ai-hint="option illustration"/></div>)}
          {!(opt.text || opt.imageUrl) && <p className="text-muted-foreground italic">Option {opt.label} content not available.</p>}
        </div>
      </Label>
    );
  };

  const formatTime = (seconds: number | null): string => { if (seconds === null || seconds < 0) seconds = 0; const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = seconds % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; };
  const getQuestionStatusForPalette = (questionId: string): 'answered' | 'notAnswered' | 'markedForReview' | 'markedAndAnswered' | 'notVisited' => { const answer = userAnswers[questionId]; if (!answer || (answer.selectedOption === null && !answer.markedForReview)) return 'notVisited'; if (answer.selectedOption) { return answer.markedForReview ? 'markedAndAnswered' : 'answered'; } else { return answer.markedForReview ? 'markedForReview' : 'notAnswered'; }};
  const questionPaletteButtonClass = (status: ReturnType<typeof getQuestionStatusForPalette>, isActive: boolean) => { if (isActive) return "bg-primary text-primary-foreground border-primary ring-2 ring-offset-1 ring-primary"; switch (status) { case 'answered': return "bg-green-500 hover:bg-green-600 text-white border-green-500"; case 'notAnswered': return "bg-red-500 hover:bg-red-600 text-white border-red-500"; case 'markedForReview': return "bg-purple-500 hover:bg-purple-600 text-white border-purple-500"; case 'markedAndAnswered': return "bg-orange-500 hover:bg-orange-600 text-white border-orange-500"; case 'notVisited': default: return "bg-card hover:bg-muted/80 text-muted-foreground border-border"; }};
  
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
            <div className="grid grid-cols-5 sm:grid-cols-4 gap-1.5 p-1">
              {questions.map((q, index) => {
                const status = getQuestionStatusForPalette(q.id);
                const isActive = currentQuestionIndex === index;
                return (
                  <Button
                    key={q.id}
                    variant="outline"
                    size="icon"
                    className={cn("h-8 w-full text-xs rounded-md aspect-square", questionPaletteButtonClass(status, isActive))}
                    onClick={() => { navigateQuestion(index); if (isMobileSheetOpen) setIsMobileSheetOpen(false); }}
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
            <Button variant="destructive" className="w-full text-sm py-2.5" disabled={testSessionState !== 'inProgress' || isSubmittingTest} onClick={() => setIsSubmitConfirmOpen(true)}>
              <CloseIcon className="mr-1.5 h-4 w-4" /> Submit Test
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <RadixAlertDialogHeader>
              <RadixAlertDialogTitle>Confirm Submission</RadixAlertDialogTitle>
              <RadixAlertDialogDescription>Are you sure you want to submit your test?</RadixAlertDialogDescription>
            </RadixAlertDialogHeader>
            <RadixAlertDialogFooter>
              <AlertDialogCancel disabled={isSubmittingTest} onClick={() => setIsSubmitConfirmOpen(false)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleSubmitTest(false)} disabled={isSubmittingTest}>
                {isSubmittingTest && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Yes, Submit
              </AlertDialogAction>
            </RadixAlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );

  if (testSessionState === 'initialLoading' || isAuthLoading || (testSessionState === 'instructions' && isLoadingPageData) ) { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" /> <p className="text-lg">Loading test environment...</p> </div> ); }
  if (error) { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Card className="w-full max-w-lg text-center shadow-xl bg-background text-foreground"> <CardHeader> <AlertCircle className="mx-auto h-12 w-12 text-destructive" /> <CardTitle className="text-destructive">Error Loading Test</CardTitle> </CardHeader> <CardContent><p className="text-muted-foreground whitespace-pre-wrap">{error}</p></CardContent> <CardFooter><Button onClick={() => router.back()} variant="outline" className="w-full">Go Back</Button></CardFooter> </Card> </div> ); }
  if (testSessionState === 'pinEntry') { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 p-4"> <Card className="w-full max-w-sm shadow-xl bg-card text-foreground"> <CardHeader><CardTitle className="text-xl flex items-center gap-2"><KeyRound className="text-primary"/>Enter Test PIN</CardTitle><CardDescription>This test for "{testDetails?.testName || 'Test'}" is PIN protected by {teacherName}.</CardDescription></CardHeader> <CardContent className="space-y-4"><form onSubmit={handlePinVerify}><Input type="password" placeholder="Enter PIN" value={enteredPin} onChange={(e) => setEnteredPin(e.target.value)} className="text-center text-lg tracking-widest" maxLength={6} autoFocus disabled={isVerifyingPin}/>{pinError && <p className="text-sm text-destructive text-center mt-2">{pinError}</p>}<Button type="submit" className="w-full mt-4" disabled={isVerifyingPin || enteredPin.length < 4}> {isVerifyingPin && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Verify PIN & Continue </Button></form></CardContent> <CardFooter><Button variant="ghost" size="sm" onClick={() => router.back()} className="text-xs text-muted-foreground mx-auto">Cancel & Go Back</Button></CardFooter> </Card> </div> ); }
  if (testSessionState === 'instructions') { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 p-4"> <Card className="w-full max-w-2xl shadow-xl bg-card text-foreground"> <CardHeader><CardTitle className="text-2xl">Test Instructions: {testDetails?.testName || "Test"}</CardTitle><CardDescription>Test by {teacherName}. Duration: {testDetails?.duration || 'N/A'} minutes. Total Questions: {testDetails?.questions_edunexus?.length || 0 + testDetails?.questions_teachers?.length || 0}</CardDescription></CardHeader> <CardContent className="max-h-[60vh] overflow-y-auto prose prose-sm dark:prose-invert"><p>Read carefully before starting. The clock will start once you begin.</p><ol><li>This test contains multiple-choice questions.</li><li>Each question has only one correct answer.</li><li>The Question Palette on the right (or in menu on mobile) shows the status of each question.</li><li>Ensure you submit the test before the timer runs out.</li></ol></CardContent> <CardFooter className="justify-center"><Button onClick={handleStartTestAfterInstructions} size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">I am ready to Begin</Button></CardFooter> </Card> </div> ); }
  if (testSessionState === 'completed' || testSessionState === 'terminated') { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Card className="w-full max-w-lg text-center shadow-xl bg-background text-foreground"> <CardHeader> {testSessionState === 'completed' ? <CheckCircle className="mx-auto h-12 w-12 text-green-500" /> : <XCircle className="mx-auto h-12 w-12 text-destructive" />} <CardTitle>{testSessionState === 'completed' ? "Test Completed" : "Test Terminated"}</CardTitle> </CardHeader> <CardContent><p className="text-muted-foreground">{testSessionState === 'completed' ? "Your responses have been submitted." : "This test session has been terminated."}</p></CardContent> <CardFooter> <Button onClick={() => { if (window.opener && !window.opener.closed) window.close(); else router.push(Routes.dashboard);}} className="w-full"> Close Window / Back to Dashboard </Button> </CardFooter> </Card> </div> ); }
  if ((testSessionState === 'inProgress' || testSessionState === 'instructions') && questions.length === 0 && !isLoadingPageData && !error) { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Card className="w-full max-w-lg text-center shadow-xl bg-background text-foreground"> <CardHeader> <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" /> <CardTitle>No Questions</CardTitle> </CardHeader> <CardContent><p className="text-muted-foreground">No questions are loaded for this test. This might be a setup issue. Please contact {teacherName}.</p></CardContent> <CardFooter><Button onClick={() => router.back()} variant="outline" className="w-full">Go Back</Button></CardFooter> </Card> </div> );}
  if (testSessionState !== 'inProgress' || !currentQuestion) { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" /> <p className="text-lg">Preparing test...</p> </div> );}

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
            <div className="text-sm font-semibold text-foreground truncate max-w-[calc(50%-120px)] sm:max-w-md" title={currentQuestion?.subject || testDetails?.Test_Subject || 'Subject'}>
              SUBJECT: {currentQuestion?.subject || testDetails?.Test_Subject || 'N/A'}
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary h-7 w-7 md:hidden" onClick={() => setIsMobileSheetOpen(true)} aria-label="Open Question Navigation"> <ListOrdered className="h-5 w-5" /> </Button>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary h-7 w-7 hidden md:inline-flex" onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)} aria-label={isRightSidebarOpen ? "Hide Question Panel" : "Show Question Panel"}><Menu className="h-5 w-5" /></Button>
                <Button variant="ghost" size="icon" asChild className="text-muted-foreground hover:text-primary h-7 w-7"><Link href={Routes.studentTestInstructions(testId)} target="_blank"><Info className="h-4 w-4" /></Link></Button>
            </div>
        </div>
      </div>
      <div className={cn("flex-1 flex max-w-full p-2 sm:p-4 gap-2 sm:gap-4 overflow-hidden")}>
        <Card className="flex-1 flex flex-col bg-card shadow-xl rounded-lg border border-border overflow-hidden">
            <CardHeader className="p-3 sm:p-4 border-b border-border bg-muted/30"><div className="flex justify-between items-center"><p className="text-xs sm:text-sm font-medium text-muted-foreground">Question {currentQuestionIndex + 1} of {questions.length}</p><div className="flex items-center gap-1">{currentQuestion.difficulty && <Badge variant={currentQuestion.difficulty === 'Easy' ? 'secondary' : currentQuestion.difficulty === 'Medium' ? 'default' : 'destructive'} className="text-xs px-1.5 py-0.5">{currentQuestion.difficulty}</Badge>}{currentQuestion.marks && <Badge variant="outline" className="text-xs px-1.5 py-0.5">Marks: {currentQuestion.marks}</Badge>}</div></div></CardHeader>
            <ScrollArea className="flex-1 min-h-0"><CardContent className="p-3 sm:p-4 md:p-6 space-y-4">
                <div className="p-2 border-b border-border/50 rounded-md bg-background min-h-[80px]">{currentQuestion.displayQuestionText && (<div className="prose prose-sm dark:prose-invert max-w-none mb-3 text-foreground leading-relaxed">{_renderLatex(currentQuestion.displayQuestionText)}</div>)}{currentQuestion.displayQuestionImageUrl && (<div className="my-2 text-center"><NextImage src={currentQuestion.displayQuestionImageUrl} alt="Question Image" width={400} height={300} className="rounded object-contain inline-block border max-h-80" data-ai-hint="question diagram"/></div>)}{!(currentQuestion.displayQuestionText || currentQuestion.displayQuestionImageUrl) && (<p className="text-xs sm:text-sm text-muted-foreground italic py-3">Question content not provided.</p>)}</div>
                <RadioGroup value={userAnswers[currentQuestion.id]?.selectedOption || ""} onValueChange={handleOptionChange} className="space-y-2.5" disabled={testSessionState !== 'inProgress' || isSubmittingTest}>
                  {currentQuestion.displayOptions.map(opt => renderOption(opt))}
                </RadioGroup>
            </CardContent></ScrollArea>
            <CardFooter className="p-3 sm:p-4 border-t border-border bg-muted/30 flex-wrap justify-center sm:justify-between gap-2"><Button variant="outline" size="sm" onClick={handleClearResponse} disabled={testSessionState !== 'inProgress' || !userAnswers[currentQuestion.id]?.selectedOption || isSubmittingTest}>Clear Response</Button><Button variant={userAnswers[currentQuestion.id]?.markedForReview ? "secondary" : "outline"} size="sm" onClick={handleMarkForReview} disabled={testSessionState !== 'inProgress' || isSubmittingTest} className="border-purple-500 text-purple-600 data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-700 hover:bg-purple-500/10"><Flag className="mr-1.5 h-4 w-4" /> {userAnswers[currentQuestion.id]?.markedForReview ? "Unmark Review" : "Mark for Review"}</Button><Button size="sm" onClick={handleSaveAndNext} disabled={testSessionState !== 'inProgress' || currentQuestionIndex === questions.length - 1 || isSubmittingTest} className="bg-green-600 hover:bg-green-700 text-white">Save & Next <ChevronRight className="ml-1.5 h-4 w-4" /></Button></CardFooter>
        </Card>
        {isRightSidebarOpen && (<div className="hidden md:flex w-72 lg:w-80 flex-shrink-0 flex-col space-y-0"><QuestionPaletteContent /></div>)}
      </div>
      <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}><SheetContent side="right" className="w-3/4 p-0 flex flex-col"><ShadcnSheetHeader className="p-3 border-b text-center"><ShadcnSheetTitle className="text-lg">Question Navigation</ShadcnSheetTitle><ShadcnSheetDescription>Jump to any question or submit.</ShadcnSheetDescription></ShadcnSheetHeader><QuestionPaletteContent /></SheetContent></Sheet>
    </div>
  );
}
      
