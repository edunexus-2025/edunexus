
'use client';

// This page will be heavily based on src/app/student/test/[testId]/chapterwise/page.tsx
// Main differences:
// 1. Fetches test details from 'teacher_tests' collection.
// 2. Fetches questions from 'teacher_question_data' based on the 'questions' relation field in 'teacher_tests'.
// 3. Submits results to a new collection: 'teacher_test_attempts'.

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
import { AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Clock, Expand, Flag, Image as ImageIconLucide, Loader2, Minimize, Send, XCircle, ArrowLeft as BackArrowIcon, Settings as SettingsIcon, Bookmark as BookmarkIconLucide, Check, PlusCircle, Info, ListOrdered, UserCircle as UserCircleIcon, CalendarDays, NotebookText, BarChart, PieChart as PieChartIcon, UserCheck, ListChecks, Eye, X as CloseIcon, MoreVertical, Menu, PanelRightOpen } from 'lucide-react';
import NextImage from 'next/image';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { AppConfig, Routes, escapeForPbFilter } from '@/lib/constants';
import { AppLogo } from '@/components/layout/AppLogo';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { StudentBookmark, User, TeacherTestAttempt, AnswerLogItem } from '@/lib/types';
import Link from 'next/link';
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

// Interfaces specific to this page, reusing from chapterwise and adapting
interface TeacherTestDetailsRecord extends RecordModel {
  testName: string;
  duration: string; // Stored as string in 'teacher_tests', e.g., "90"
  questions: string[]; // Array of question IDs from 'teacher_question_data'
  Admin_Password?: number;
  teacherId?: string; // Relation to teacher_data
  model?: "Chapterwise" | "Full Length";
  QBExam?: string;
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
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  marks?: number; // Assuming marks are stored per question

  // For displaying images
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
      console.warn(`TeacherTestAttemptPage: Error getting URL for ${fieldName} in record ${record.id}:`, e);
      return null;
    }
  }
  return null;
};

const PREDEFINED_TAGS = ["Easy", "Hard", "Tricky", "Do Again"];

export default function TeacherTestAttemptPage() {
  const params = useParams();
  const router = useRouter();
  const { testId } = params;
  const { user, isLoading: isAuthLoading, authRefresh } = useAuth();
  const { toast } = useToast();

  const [testDetails, setTestDetails] = useState<TeacherTestDetailsRecord | null>(null);
  const [questions, setQuestions] = useState<TeacherQuestionRecord[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, AnswerLogItem>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<'not_started' | 'in_progress' | 'completed' | 'terminated'>('not_started');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState(false);
  const [userNotebooks, setUserNotebooks] = useState<StudentBookmark[]>([]);
  const [isLoadingUserNotebooks, setIsLoadingUserNotebooks] = useState(false);
  const [selectedNotebookIdsInModal, setSelectedNotebookIdsInModal] = useState<Set<string>>(new Set());
  const [selectedModalTags, setSelectedModalTags] = useState<string[]>([]);
  const [isCurrentQuestionBookmarked, setIsCurrentQuestionBookmarked] = useState(false);
  
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true); 
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  
  const currentQuestion = questions[currentQuestionIndex];
  const questionStartTimeRef = useRef<number>(Date.now());
  const todayDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const checkPinVerification = useCallback(() => {
    const pinVerified = sessionStorage.getItem(`pin_verified_${testId}`);
    if (pinVerified !== 'true') {
      toast({ title: "Access Denied", description: "PIN verification required.", variant: "destructive" });
      router.replace(Routes.studentTeacherTestPin(testId as string));
      return false;
    }
    return true;
  }, [testId, router, toast]);


  useEffect(() => {
    if (!checkPinVerification()) return; // Early exit if PIN not verified
    // Rest of useEffect logic...
  }, [checkPinVerification]);


  const checkBookmarkStatus = useCallback(async (questionIdToCheck: string) => {
    if (!user?.id || !questionIdToCheck) { setIsCurrentQuestionBookmarked(false); return; }
    try {
      const bookmarkRecords = await pb.collection('student_bookmarks').getFullList<StudentBookmark>({ filter: `user = "${user.id}" && questions ~ "${questionIdToCheck}" && archived = false`, fields: 'id', $autoCancel: false });
      setIsCurrentQuestionBookmarked(bookmarkRecords.length > 0);
    } catch (err) { console.warn("Error checking bookmark status:", err); setIsCurrentQuestionBookmarked(false); }
  }, [user?.id]);

  useEffect(() => { if (currentQuestion?.id) { checkBookmarkStatus(currentQuestion.id); } }, [currentQuestion?.id, checkBookmarkStatus]);

  const handleSubmitTest = useCallback(async (autoSubmit = false, terminationReason?: string) => {
    if (!user || !testDetails || isSubmitting || testStatus === 'completed' || testStatus === 'terminated') return;
    setIsSubmitting(true);
    if (currentQuestion && userAnswers[currentQuestion.id] && questionStartTimeRef.current) {
      const currentTime = Date.now();
      const timeSpentCurrentQuestion = Math.round((currentTime - questionStartTimeRef.current) / 1000);
      userAnswers[currentQuestion.id].timeSpentSeconds = (userAnswers[currentQuestion.id].timeSpentSeconds || 0) + timeSpentCurrentQuestion;
    }
    let correctCount = 0; let incorrectCount = 0; let attemptedCount = 0; let pointsEarnedFromTest = 0;
    const answersLog: AnswerLogItem[] = questions.map(q => {
      const userAnswerRec = userAnswers[q.id];
      const selected = userAnswerRec?.selectedOption || null;
      let isCorrectAns = false;
      const questionCorrectOption = q.CorrectOption?.replace("Option ", "") as "A" | "B" | "C" | "D" | undefined;

      if (selected && questionCorrectOption) {
        attemptedCount++;
        if (selected === `Option ${questionCorrectOption}`) {
          correctCount++; isCorrectAns = true; pointsEarnedFromTest += (q.marks || 1);
        } else {
          incorrectCount++;
        }
      }
      return { questionId: q.id, selectedOption: selected, correctOption: questionCorrectOption ? `Option ${questionCorrectOption}` : null, isCorrect: isCorrectAns, markedForReview: userAnswerRec?.markedForReview || false, timeSpentSeconds: userAnswerRec?.timeSpentSeconds || 0 };
    });

    const maxScore = questions.reduce((sum, q) => sum + (q.marks || 1), 0);
    const percentage = maxScore > 0 ? (pointsEarnedFromTest / maxScore) * 100 : 0;
    const finalTestStatus: TeacherTestAttempt['status'] = terminationReason ? 'terminated_manual' : 'completed'; // Simplified status
    const durationTaken = testDetails?.duration ? parseInt(testDetails.duration, 10) * 60 - (timeLeft || 0) : 0;

    const resultData: Omit<TeacherTestAttempt, 'id' | 'created' | 'updated' | 'collectionId' | 'collectionName' | 'expand'> = {
      user: user.id,
      teacher_test: testDetails.id,
      teacher: testDetails.teacherId || 'UNKNOWN_TEACHER', // Fallback if teacherId is missing
      score: pointsEarnedFromTest,
      max_score: maxScore,
      percentage: parseFloat(percentage.toFixed(2)),
      answers_log: JSON.stringify(answersLog),
      start_time: new Date(Date.now() - durationTaken * 1000).toISOString(),
      end_time: new Date().toISOString(),
      duration_taken_seconds: durationTaken,
      status: finalTestStatus,
      plan_details: { studentPlan: user.studentSubscriptionTier || 'Free' }, // Example plan details
      proctoring_flags: {},
    };

    try {
      const createdResultRecord = await pb.collection('teacher_test_attempts').create(resultData);
      setTestStatus(finalTestStatus); setTimeLeft(0);
      toast({ title: autoSubmit ? (terminationReason ? "Test Terminated" : "Test Auto-Submitted") : "Test Submitted Successfully!", description: `Your results for "${testDetails.testName}" have been recorded. ${terminationReason ? `Reason: ${terminationReason.replace(/_/g, ' ')}.` : ''}` });
      router.push(Routes.studentTeacherTestResult(createdResultRecord.id));
    } catch (err: any) {
      console.error("Failed to submit teacher test results:", err.data || err);
      toast({ title: "Submission Failed", description: `Could not save your results. Error: ${err.data?.message || err.message}`, variant: "destructive" });
    } finally { setIsSubmitting(false); }
  }, [user, testDetails, questions, userAnswers, timeLeft, router, toast, isSubmitting, testStatus, currentQuestion, authRefresh]);


  const fetchTestData = useCallback(async (isMountedGetter: () => boolean) => {
    const currentTestId = typeof testId === 'string' ? testId : '';
    if (!currentTestId || !user?.id) { if (isMountedGetter()) setIsLoading(false); return; }
    if (isMountedGetter()) setIsLoading(true);

    try {
      const fetchedTestDetails = await pb.collection('teacher_tests').getOne<TeacherTestDetailsRecord>(currentTestId, { '$autoCancel': false });
      if (!isMountedGetter()) return;
      setTestDetails(fetchedTestDetails);
      const durationMinutes = parseInt(fetchedTestDetails.duration, 10);
      if (!isNaN(durationMinutes)) setTimeLeft(durationMinutes * 60); else setTimeLeft(3600);

      const questionIds = fetchedTestDetails.questions || [];
      if (questionIds.length === 0) { if (isMountedGetter()) { setQuestions([]); setError("No questions are linked to this test."); } return; }

      const questionRecordsPromises = questionIds.map(id =>
        pb.collection('teacher_question_data').getOne<TeacherQuestionRecord>(id, { '$autoCancel': false })
          .catch(err => { console.error(`Failed to fetch question ${id} for teacher test:`, err.data || err); return null; })
      );
      const resolvedQuestions = (await Promise.all(questionRecordsPromises)).filter(q => q !== null) as TeacherQuestionRecord[];
      const questionsWithUrls = resolvedQuestions.map(q => ({
        ...q,
        displayQuestionImageUrl: getPbFileUrl(q, 'QuestionImage'),
        displayOptionAImageUrl: getPbFileUrl(q, 'OptionAImage'),
        displayOptionBImageUrl: getPbFileUrl(q, 'OptionBImage'),
        displayOptionCImageUrl: getPbFileUrl(q, 'OptionCImage'),
        displayOptionDImageUrl: getPbFileUrl(q, 'OptionDImage'),
        marks: typeof q.marks === 'number' ? q.marks : (q.CorrectOption ? 1 : 0) // Default marks if not set
      }));
      if (isMountedGetter()) {
        setQuestions(questionsWithUrls);
        const initialAnswers: Record<string, UserAnswer> = {};
        questionsWithUrls.forEach(q => { initialAnswers[q.id] = { questionId: q.id, selectedOption: null, isCorrect: null, markedForReview: false, timeSpentSeconds: 0 }; });
        setUserAnswers(initialAnswers);
        setTestStatus('in_progress');
        questionStartTimeRef.current = Date.now();
        toast({ title: "Test Started!", description: `Good luck with "${fetchedTestDetails.testName}"!` });
      }
    } catch (err: any) { if (isMountedGetter()) { setError(`Could not load test data. Error: ${err.data?.message || err.message}`); } }
    finally { if (isMountedGetter()) setIsLoading(false); }
  }, [testId, user?.id, toast]);

  useEffect(() => {
    let isMounted = true;
    if (!checkPinVerification()) return;

    if (!isAuthLoading && user?.id && testId) {
      fetchTestData(() => isMounted);
    } else if (!isAuthLoading && !user?.id) {
      setError("User not authenticated."); setIsLoading(false);
    } else if (!testId) {
      setError("Test ID is missing."); setIsLoading(false);
    }
    return () => { isMounted = false; };
  }, [testId, user?.id, isAuthLoading, fetchTestData, checkPinVerification]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || testStatus !== 'in_progress') { if (timeLeft !== null && timeLeft <= 0 && testStatus === 'in_progress') { handleSubmitTest(true, "time_up"); } return; }
    const timerId = setInterval(() => { setTimeLeft((prevTime) => (prevTime ? prevTime - 1 : 0)); }, 1000);
    return () => clearInterval(timerId);
  }, [timeLeft, testStatus, handleSubmitTest]);

  const handleOptionChange = (value: string) => { /* ... (Same as chapterwise) ... */ setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...(prev[currentQuestion.id] || { questionId: currentQuestion.id, timeSpentSeconds: 0, markedForReview: false }), selectedOption: value, isCorrect: null, } })); };
  const handleClearResponse = () => { /* ... (Same as chapterwise) ... */ setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...(prev[currentQuestion.id] || { questionId: currentQuestion.id, timeSpentSeconds: 0 }), selectedOption: null, isCorrect: null, } })); };
  const handleMarkForReview = () => { /* ... (Same as chapterwise) ... */ setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...(prev[currentQuestion.id] || { questionId: currentQuestion.id, selectedOption: null, isCorrect: null, timeSpentSeconds: 0 }), markedForReview: !prev[currentQuestion.id]?.markedForReview, } })); };
  const navigateQuestion = (directionOrIndex: 'next' | 'prev' | number) => { /* ... (Same as chapterwise) ... */ if (testStatus !== 'in_progress') return; if (currentQuestion && userAnswers[currentQuestion.id]) { const currentTime = Date.now(); const timeSpentCurrentQuestion = Math.round((currentTime - questionStartTimeRef.current) / 1000); setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: { ...prev[currentQuestion.id], timeSpentSeconds: (prev[currentQuestion.id].timeSpentSeconds || 0) + timeSpentCurrentQuestion, }, })); } let newIndex = currentQuestionIndex; if (directionOrIndex === 'next') { newIndex = Math.min(questions.length - 1, currentQuestionIndex + 1); } else if (directionOrIndex === 'prev') { newIndex = Math.max(0, currentQuestionIndex - 1); } else if (typeof directionOrIndex === 'number') { newIndex = Math.max(0, Math.min(questions.length - 1, directionOrIndex)); } setCurrentQuestionIndex(newIndex); questionStartTimeRef.current = Date.now(); };
  const handleSaveAndNext = () => navigateQuestion('next');

  const renderLatex = (text: string | undefined | null): React.ReactNode => { /* ... (Same as chapterwise) ... */ if (!text) return null; const parts = text.split(/(\$\$[\s\S]*?\$\$|\$.*?\$|\\\(.*?\\\)|\\\[.*?\\\]|\\begin\{.*?\}[\s\S]*?\\end\{.*?\})/g); return parts.map((part, index) => { try { if (part.startsWith('$$') && part.endsWith('$$')) return <BlockMath key={index} math={part.substring(2, part.length - 2)} />; if (part.startsWith('$') && part.endsWith('$')) return <InlineMath key={index} math={part.substring(1, part.length - 1)} />; if (part.startsWith('\\(') && part.endsWith('\\)')) return <InlineMath key={index} math={part.substring(2, part.length - 2)} />; if (part.startsWith('\\[') && part.endsWith('\\]')) return <BlockMath key={index} math={part.substring(2, part.length - 2)} />; if (part.startsWith('\\begin{') && part.includes('\\end{')) return <BlockMath key={index} math={part} />; } catch (e) { return <span key={index} className="text-destructive" title="LaTeX Error">{part}</span>; } return <span key={index}>{part}</span>; }); };
  const renderOption = (optionKey: "A" | "B" | "C" | "D"): React.ReactNode => { /* ... (Same as chapterwise, but use TeacherQuestionRecord fields) ... */ if(!currentQuestion) return null; const textKey = `Option${optionKey}Text` as keyof TeacherQuestionRecord; const imageKey = `displayOption${optionKey}ImageUrl` as keyof TeacherQuestionRecord; const optionText = currentQuestion[textKey]; const displayImageUrl = currentQuestion[imageKey]; const optionValue = `Option ${optionKey}`; return ( <Label htmlFor={`option-${currentQuestion.id}-${optionKey}`} className={cn("flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-all hover:shadow-md", userAnswers[currentQuestion.id]?.selectedOption === optionValue ? 'bg-primary/10 border-primary ring-1 ring-primary' : 'bg-card border-border hover:border-primary/50')}> <RadioGroupItem value={optionValue} id={`option-${currentQuestion.id}-${optionKey}`} className="mt-1 border-muted-foreground data-[state=checked]:border-primary shrink-0" /> <div className="flex-1 text-sm"> <div className="font-semibold">{optionKey}.</div> {optionText && <div className="prose prose-sm dark:prose-invert max-w-none mt-0.5">{renderLatex(optionText as string)}</div>} {displayImageUrl && (<div className="mt-1.5"><NextImage src={displayImageUrl as string} alt={`Option ${optionKey}`} width={200} height={100} className="rounded object-contain border" data-ai-hint="option diagram"/></div>)} {!(optionText || displayImageUrl) && <p className="text-muted-foreground italic">Option {optionKey} content not available.</p>} </div> </Label> ); };
  const formatTime = (seconds: number | null): string => { /* ... (Same as chapterwise) ... */ if (seconds === null) return '00:00:00'; const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = seconds % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; };
  const getQuestionStatusForPalette = (questionId: string): 'answered' | 'notAnswered' | 'markedForReview' | 'markedAndAnswered' | 'notVisited' => { /* ... (Same as chapterwise) ... */ const answer = userAnswers[questionId]; if (!answer || (answer.selectedOption === null && !answer.markedForReview)) return 'notVisited'; if (answer.selectedOption) { return answer.markedForReview ? 'markedAndAnswered' : 'answered'; } else { return answer.markedForReview ? 'markedForReview' : 'notAnswered'; } };
  const questionPaletteButtonClass = (status: ReturnType<typeof getQuestionStatusForPalette>, isActive: boolean) => { /* ... (Same as chapterwise) ... */ if (isActive) return "bg-primary text-primary-foreground border-primary ring-2 ring-offset-1 ring-primary"; switch (status) { case 'answered': return "bg-green-500 hover:bg-green-600 text-white border-green-500"; case 'notAnswered': return "bg-red-500 hover:bg-red-600 text-white border-red-500";  case 'markedForReview': return "bg-purple-500 hover:bg-purple-600 text-white border-purple-500"; case 'markedAndAnswered': return "bg-orange-500 hover:bg-orange-600 text-white border-orange-500"; case 'notVisited': default: return "bg-card hover:bg-muted/80 text-muted-foreground border-border"; } };

  const fetchUserNotebooks = useCallback(async () => { /* ... (Same as chapterwise) ... */ if (!user?.id) { setUserNotebooks([]); setIsLoadingUserNotebooks(false); return; } setIsLoadingUserNotebooks(true); try { const records = await pb.collection('student_bookmarks').getFullList<StudentBookmark>({ filter: `user = "${user.id}" && archived = false`, sort: '-updated', $autoCancel: false }); setUserNotebooks(records.map(r => ({ ...r, questionCount: Array.isArray(r.questions) ? r.questions.length : 0 }))); } catch (err) { toast({ title: "Error Fetching Notebooks", variant: "destructive" }); setUserNotebooks([]); } finally { setIsLoadingUserNotebooks(false); } }, [user?.id, toast]);
  const handleOpenBookmarkModal = () => { /* ... (Same as chapterwise) ... */ if (currentQuestion) { fetchUserNotebooks(); setSelectedNotebookIdsInModal(new Set()); setSelectedModalTags([]); setIsBookmarkModalOpen(true); } };
  const handleToggleNotebookSelection = (notebookId: string) => setSelectedNotebookIdsInModal(prev => { const newSet = new Set(prev); if (newSet.has(notebookId)) newSet.delete(notebookId); else newSet.add(notebookId); return newSet; });
  const handleToggleTagSelection = (tag: string) => setSelectedModalTags(prev => { const newTags = new Set(prev); if (newTags.has(tag)) newTags.delete(tag); else if (newTags.size < 5) newTags.add(tag); else toast({ title: "Tag Limit Reached", description: "Max 5 tags."}); return Array.from(newTags); });
  const handleSaveToNotebooks = async () => { /* ... (Same as chapterwise) ... */ if (!currentQuestion || !user?.id || selectedNotebookIdsInModal.size === 0) { toast({ title: "No Notebook Selected" }); return; } let successCount = 0, errorCount = 0; for (const notebookId of Array.from(selectedNotebookIdsInModal)) { try { const notebook = await pb.collection('student_bookmarks').getOne<StudentBookmark>(notebookId); const existingQuestions = Array.isArray(notebook.questions) ? notebook.questions : []; const updateData: Partial<StudentBookmark> & { [key: string]: any } = { tags: selectedModalTags }; if (!existingQuestions.includes(currentQuestion.id)) updateData["questions+"] = currentQuestion.id; await pb.collection('student_bookmarks').update(notebookId, updateData); successCount++; } catch (err) { errorCount++; console.error(`Failed to save to notebook ${notebookId}:`, err); } } if (successCount > 0) { toast({ title: "Bookmarked!", description: `Question saved to ${successCount} notebook(s).` }); checkBookmarkStatus(currentQuestion.id); } if (errorCount > 0) toast({ title: "Error Bookmarking", description: `Failed for ${errorCount} notebook(s).`, variant: "destructive" }); setIsBookmarkModalOpen(false); };

  const QuestionPaletteContent = () => ( /* ... (Same as chapterwise) ... */ <> <Card className="shadow-none border-0 md:border md:shadow-sm md:rounded-lg md:bg-card"> <CardHeader className="p-3 border-b text-center"> <UserCircleIcon className="mx-auto h-10 w-10 text-primary mb-1" /> <CardTitle className="text-base">{user?.name || "Student"}</CardTitle> <CardDescription className="text-xs truncate">{user?.email}</CardDescription> <CardDescription className="text-xs">{todayDate}</CardDescription> </CardHeader> </Card> <Card className="border-primary/30 bg-primary/5 flex-1 flex flex-col min-h-0 shadow-md rounded-lg md:mt-3"> <CardHeader className="p-2 text-center border-b border-primary/20"> <CardTitle className="text-sm text-primary">QUESTION NAVIGATION</CardTitle> </CardHeader> <CardContent className="p-2 flex-1 overflow-hidden"> <ScrollArea className="h-full"> <div className="grid grid-cols-5 sm:grid-cols-4 gap-1.5 p-1"> {questions.map((q, index) => { const status = getQuestionStatusForPalette(q.id); const isActive = currentQuestionIndex === index; return ( <Button key={q.id} variant="outline" size="icon" className={cn("h-8 w-full text-xs rounded-md aspect-square", questionPaletteButtonClass(status, isActive))} onClick={() => { navigateQuestion(index); if (isMobileSheetOpen) setIsMobileSheetOpen(false); }} disabled={testStatus !== 'in_progress'} aria-label={`Go to question ${index + 1}, Status: ${(status || 'Not Visited').replace(/([A-Z])/g, ' $1')}`}>{index + 1}{status === 'markedAndAnswered' && <Check className="absolute h-2.5 w-2.5 bottom-0.5 right-0.5 text-white" />}</Button> ); })} </div> </ScrollArea> </CardContent> </Card> <div className="p-3 border-t bg-card md:bg-transparent rounded-b-lg md:shadow-md mt-auto md:mt-3"> <AlertDialog> <AlertDialogTrigger asChild> <Button variant="destructive" className="w-full text-sm py-2.5" disabled={testStatus !== 'in_progress' || isSubmitting}> <CloseIcon className="mr-1.5 h-4 w-4" /> Submit Test </Button> </AlertDialogTrigger> <AlertDialogContent> <RadixAlertDialogHeader> <RadixAlertDialogTitle>Confirm Submission</RadixAlertDialogTitle> <RadixAlertDialogDescription>Are you sure you want to submit your test?</RadixAlertDialogDescription> </RadixAlertDialogHeader> <RadixAlertDialogFooter> <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel> <AlertDialogAction onClick={() => handleSubmitTest(false)} disabled={isSubmitting}> {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Yes, Submit </AlertDialogAction> </RadixAlertDialogFooter> </AlertDialogContent> </AlertDialog> </div> </> );

  if (isLoading || isAuthLoading) { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" /> <p className="text-lg">Loading test environment...</p> </div> ); }
  if (error) { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Card className="w-full max-w-lg text-center shadow-xl bg-background text-foreground"> <CardHeader> <AlertCircle className="mx-auto h-12 w-12 text-destructive" /> <CardTitle className="text-destructive">Error Loading Test</CardTitle> </CardHeader> <CardContent><p className="text-muted-foreground whitespace-pre-wrap">{error}</p></CardContent> <CardFooter><Button onClick={() => router.back()} variant="outline" className="w-full">Go Back</Button></CardFooter> </Card> </div> ); }
  if (testStatus === 'completed' || testStatus === 'terminated') { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Card className="w-full max-w-lg text-center shadow-xl bg-background text-foreground"> <CardHeader> {testStatus === 'completed' ? <CheckCircle className="mx-auto h-12 w-12 text-green-500" /> : <XCircle className="mx-auto h-12 w-12 text-destructive" />} <CardTitle>{testStatus === 'completed' ? "Test Completed" : "Test Terminated"}</CardTitle> </CardHeader> <CardContent><p className="text-muted-foreground">{testStatus === 'completed' ? "Your responses have been submitted." : "This test session has been terminated."}</p></CardContent> <CardFooter> <Button onClick={() => { if (window.opener && !window.opener.closed) window.close(); else router.push(Routes.dashboard);}} className="w-full"> Close Window / Back to Dashboard </Button> </CardFooter> </Card> </div> ); }
  if (!currentQuestion && !isLoading) { return ( <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 p-4 text-white"> <Card className="w-full max-w-lg text-center shadow-xl bg-background text-foreground"> <CardHeader> <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" /> <CardTitle>No Questions</CardTitle> </CardHeader> <CardContent><p className="text-muted-foreground">No questions loaded for this test.</p></CardContent> <CardFooter><Button onClick={() => router.back()} variant="outline" className="w-full">Go Back</Button></CardFooter> </Card> </div> );}

  return (
    <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-card shadow-md p-3 border-b border-border">
        <div className="flex justify-between items-center max-w-full px-2 sm:px-4">
          <div className="text-sm font-medium text-muted-foreground truncate max-w-[calc(33%-20px)] sm:max-w-xs" title={testDetails?.testName || 'Test'}>
            {testDetails?.testName || 'Test Name'}
          </div>
          <div className="flex-shrink-0"> <AppLogo mainTextSize="text-lg" taglineTextSize="text-[0px]" iconSize={22} /> </div>
          <div className="text-sm font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-md shadow-sm flex items-center w-auto max-w-[calc(33%-20px)] sm:max-w-xs justify-end">
            <Clock className="h-4 w-4 mr-1.5 flex-shrink-0" /> <span className="truncate">{formatTime(timeLeft)}</span>
          </div>
        </div>
      </header>

      {/* Sub Header */}
      <div className="sticky top-[var(--top-header-height,57px)] z-40 bg-background shadow-sm p-3 border-b border-border">
         <div className="flex justify-between items-center max-w-full px-2 sm:px-4">
            <div className="text-sm font-semibold text-foreground truncate max-w-[calc(50%-120px)] sm:max-w-md" title={testDetails?.QBExam || 'Exam'}>
                TARGET EXAM: {testDetails?.QBExam || 'N/A'}
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
                <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}><SheetTrigger asChild><Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary h-7 w-7 md:hidden" aria-label="Open Question Navigation"><ListOrdered className="h-5 w-5" /></Button></SheetTrigger><SheetContent side="right" className="w-3/4 p-0 flex flex-col"><ShadcnSheetHeader className="p-3 border-b text-center"><ShadcnSheetTitle className="text-lg">Question Navigation</ShadcnSheetTitle><ShadcnSheetDescription>Jump to any question or submit.</ShadcnSheetDescription></ShadcnSheetHeader><QuestionPaletteContent /></SheetContent></Sheet>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary h-7 w-7 hidden md:inline-flex" onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)} aria-label={isRightSidebarOpen ? "Hide Question Panel" : "Show Question Panel"}><MoreVertical className="h-5 w-5" /></Button>
                <Button variant="ghost" size="icon" asChild className="text-muted-foreground hover:text-primary h-7 w-7"><Link href={Routes.studentTeacherTestInstructions(testId as string)} target="_blank"><Info className="h-4 w-4" /></Link></Button>
            </div>
        </div>
      </div>

      <div className={cn("flex-1 flex max-w-full p-2 sm:p-4 gap-2 sm:gap-4 overflow-hidden")}>
        <Card className="flex-1 flex flex-col bg-card shadow-xl rounded-lg border border-border overflow-hidden">
            <CardHeader className="p-3 sm:p-4 border-b border-border bg-muted/30">
              <div className="flex justify-between items-center">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground"> Question {currentQuestionIndex + 1} of {questions.length} </p>
                <div className="flex items-center gap-1">
                  {currentQuestion.difficulty && <Badge variant={currentQuestion.difficulty === 'Easy' ? 'secondary' : currentQuestion.difficulty === 'Medium' ? 'default' : 'destructive'} className="text-xs px-1.5 py-0.5">{currentQuestion.difficulty}</Badge>}
                  {currentQuestion.marks && <Badge variant="outline" className="text-xs px-1.5 py-0.5">Marks: {currentQuestion.marks}</Badge>}
                  <Button variant="ghost" size="icon" onClick={handleOpenBookmarkModal} title="Bookmark this question" className="h-7 w-7 text-muted-foreground hover:text-primary"><BookmarkIconLucide className={cn("h-4 w-4", isCurrentQuestionBookmarked && "fill-primary text-primary")} /></Button>
                </div>
              </div>
            </CardHeader>
            <ScrollArea className="flex-1 min-h-0">
              <CardContent className="p-3 sm:p-4 md:p-6 space-y-4">
                  <div className="p-2 border-b border-border/50 rounded-md bg-background min-h-[80px]">
                    {currentQuestion.QuestionText && (<div className="prose prose-sm dark:prose-invert max-w-none mb-3 text-foreground leading-relaxed">{renderLatex(currentQuestion.QuestionText)}</div>)}
                    {currentQuestion.displayQuestionImageUrl && (<div className="my-2 text-center"><NextImage src={currentQuestion.displayQuestionImageUrl} alt="Question Image" width={400} height={300} className="rounded object-contain inline-block border" data-ai-hint="question image"/></div>)}
                    {!(currentQuestion.QuestionText || currentQuestion.displayQuestionImageUrl) && (<p className="text-xs sm:text-sm text-muted-foreground italic py-3">Question content not provided.</p>)}
                  </div>
                  <RadioGroup value={userAnswers[currentQuestion.id]?.selectedOption || ""} onValueChange={handleOptionChange} className="space-y-2.5" disabled={testStatus !== 'in_progress'}>
                    {renderOption("A")} {renderOption("B")} {renderOption("C")} {renderOption("D")}
                  </RadioGroup>
              </CardContent>
            </ScrollArea>
            <CardFooter className="p-3 sm:p-4 border-t border-border bg-muted/30 flex-wrap justify-center sm:justify-between gap-2">
                <Button variant="outline" size="sm" onClick={handleClearResponse} disabled={testStatus !== 'in_progress' || !userAnswers[currentQuestion.id]?.selectedOption}>Clear Response</Button>
                <Button variant={userAnswers[currentQuestion.id]?.markedForReview ? "secondary" : "outline"} size="sm" onClick={handleMarkForReview} disabled={testStatus !== 'in_progress'} className="border-purple-500 text-purple-600 data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-700 hover:bg-purple-500/10"><Flag className="mr-1.5 h-4 w-4" /> {userAnswers[currentQuestion.id]?.markedForReview ? "Unmark Review" : "Mark for Review"}</Button>
                <Button size="sm" onClick={handleSaveAndNext} disabled={testStatus !== 'in_progress' || currentQuestionIndex === questions.length - 1} className="bg-green-600 hover:bg-green-700 text-white">Save & Next <ChevronRight className="ml-1.5 h-4 w-4" /></Button>
            </CardFooter>
        </Card>

        {isRightSidebarOpen && (<div className="hidden md:flex w-72 lg:w-80 flex-shrink-0 flex-col space-y-0"><QuestionPaletteContent /></div>)}
      </div>
      
      <Dialog open={isBookmarkModalOpen} onOpenChange={setIsBookmarkModalOpen}><DialogContent className="sm:max-w-md"><ShadcnDialogHeader><ShadcnDialogTitle>Add to Notebooks</ShadcnDialogTitle><ShadcnDialogDescription>Select notebook(s).</ShadcnDialogDescription></ShadcnDialogHeader> {isLoadingUserNotebooks ? (<div className="flex justify-center items-center h-32"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>) : userNotebooks.length === 0 ? (<p className="text-sm text-muted-foreground text-center py-4">No notebooks. <Link href={Routes.notebooks} className="text-primary hover:underline">Create one!</Link></p>) : ( <ScrollArea className="max-h-60 my-4"><div className="space-y-2 pr-2">{userNotebooks.map(nb => (<div key={nb.id} className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50"> <Checkbox id={`bm-nb-${nb.id}`} checked={selectedNotebookIdsInModal.has(nb.id)} onCheckedChange={() => handleToggleNotebookSelection(nb.id)}/> <label htmlFor={`bm-nb-${nb.id}`} className="text-sm font-medium leading-none flex-1 cursor-pointer">{nb.notebook_name}</label><Badge variant="outline" className="text-xs">{nb.questionCount || 0} Qs</Badge> </div>))}</div></ScrollArea> )} <Button type="button" variant="outline" size="sm" className="w-full justify-start text-primary hover:text-primary/90" onClick={() => router.push(Routes.notebooks)} ><PlusCircle className="mr-2 h-4 w-4"/>Create New Notebook</Button> <div className="mt-4 pt-4 border-t"><p className="text-sm font-medium mb-2 text-muted-foreground">Add tags (optional):</p><div className="flex flex-wrap gap-2">{PREDEFINED_TAGS.map(tag => (<Button key={tag} variant={selectedModalTags.includes(tag) ? "default" : "outline"} size="sm" className="text-xs" onClick={() => handleToggleTagSelection(tag)}>{selectedModalTags.includes(tag) && <Check className="mr-1.5 h-3.5 w-3.5"/>}{tag}</Button>))}</div><p className="text-xs text-muted-foreground mt-2">Tags apply to this question in selected notebooks.</p></div> <ShadcnDialogFooter className="mt-4"><ShadcnDialogClose asChild><Button type="button" variant="outline">Cancel</Button></ShadcnDialogClose><Button onClick={handleSaveToNotebooks} disabled={selectedNotebookIdsInModal.size === 0 || isLoadingUserNotebooks}>Save</Button></ShadcnDialogFooter></DialogContent></Dialog>
    </div>
  );
}
    