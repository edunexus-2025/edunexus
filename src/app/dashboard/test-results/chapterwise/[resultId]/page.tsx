
'use client';

import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState, useCallback } from 'react';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { StudentBookmark } from '@/lib/types';

import { AlertCircle, ArrowLeft, CheckCircle, ChevronLeft, ChevronRight, Clock, FileText, BarChart3, Target as TargetIcon, Info, TrendingUp, XCircle, Percent, Users, Star, ThumbsDown, Zap, Turtle, ClipboardList, Eye, BookOpen, AlertTriangle as ReportIcon, Loader2, ListFilter, CalendarDays, NotebookText, BarChart, PieChart as PieChartIcon, UserCheck, Bookmark as BookmarkIcon, LayoutDashboard, PlusCircle, Check } from 'lucide-react';
import NextImage from 'next/image';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { format, formatDistanceStrict } from 'date-fns';
import { Routes, unslugify, DPP_EXAM_OPTIONS, escapeForPbFilter } from '@/lib/constants';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';


interface ChapterwiseResultRecord extends RecordModel {
  user: string;
  test_id: string;
  test_name: string;
  start_time: string;
  end_time: string;
  duration_taken_seconds: number;
  total_questions: number;
  attempted_questions: number;
  correct_answers: number;
  incorrect_answers: number;
  unattempted_questions: number;
  score: number;
  max_score: number;
  percentage: number;
  answers_log: string | AnswerLogItem[];
  status: 'completed' | 'in_progress' | 'terminated_proctoring' | 'terminated_tab_switches' | 'terminated_time_up';
  proctoring_flags?: string;
  mark_for_review_not_answered?: number; 
  mark_for_review_answered?: number; 
}


interface AnswerLogItem {
  questionId: string;
  selectedOption: string | null; 
  correctOption: string | null; 
  isCorrect: boolean;
  markedForReview: boolean;
  timeSpentSeconds: number;
}

interface QuestionBankRecord extends RecordModel {
  id: string;
  questionText?: string;
  questionImage?: string | null;
  displayQuestionImageUrl?: string | null;
  optionAText?: string;
  optionAImage?: string | null;
  displayOptionAImageUrl?: string | null;
  optionBText?: string;
  optionBImage?: string | null;
  displayOptionBImageUrl?: string | null;
  optionCText?: string;
  optionCImage?: string | null;
  displayOptionCImageUrl?: string | null;
  optionDText?: string;
  optionDImage?: string | null;
  displayOptionDImageUrl?: string | null;
  correctOption: "A" | "B" | "C" | "D"; 
  explanationText?: string;
  explanationImage?: string | null;
  displayExplanationImageUrl?: string | null;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  subject?: string;
  lessonName?: string;
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
  ExplanationText?: string; 
  ExplanationImage?: string | null; 
}


interface TestPagesRecord extends RecordModel {
    id: string;
    TestName: string;
    PhysicsQuestion?: string[];
    ChemistryQuestion?: string[];
    MathsQuestion?: string[];
    BiologyQuestion?: string[];
}

interface DifficultyStats {
  attempted: number;
  correct: number;
  total: number;
}

interface SubjectPerformance {
  name: string;
  correct: number;
  attempted: number;
  total: number;
  accuracy: number;
}

const ReportErrorTypes = [
  "Wrong Question",
  "Incomplete Question",
  "Incorrect Grammar",
  "Question is out of syllabus",
  "Question an old pattern",
  "Repeated Question"
] as const;

const ReportSchema = z.object({
  TypeOfError: z.enum(ReportErrorTypes, {
    required_error: "Please select a type of error.",
  }),
  Please_write_your_report_here: z.string().min(10, "Report must be at least 10 characters.").max(500, "Report cannot exceed 500 characters.").optional().nullable(),
});
type ReportInput = z.infer<typeof ReportSchema>;

const PREDEFINED_TAGS = ["Easy", "Hard", "Tricky", "Do Again"];

const getPbFileUrl = (record: RecordModel | null | undefined, fieldName: string): string | null => {
  if (record && record[fieldName] && record.collectionId && record.collectionName && typeof record[fieldName] === 'string') {
    try {
      return pb.files.getUrl(record, record[fieldName] as string);
    } catch (e) {
      console.warn(`ChapterwiseTestResultPage: Error getting URL for ${fieldName} in record ${record.id}:`, e);
      return null;
    }
  }
  return null;
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


export default function ChapterwiseTestResultPage() {
  const params = useParams();
  const router = useRouter();
  const { resultId: resultIdParam } = params;
  const resultId = typeof resultIdParam === 'string' ? resultIdParam : '';
  
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const [resultData, setResultData] = useState<ChapterwiseResultRecord | null>(null);
  const [testPageRecord, setTestPageRecord] = useState<TestPagesRecord | null>(null);
  const [testQuestions, setTestQuestions] = useState<QuestionBankRecord[]>([]);
  const [answersLog, setAnswersLog] = useState<AnswerLogItem[]>([]);
  const [stats, setStats] = useState<{
    correct: number; incorrect: number; attempted: number; unattempted: number;
    totalQuestions: number; accuracy: number; percentage: number; score: number; maxScore: number;
  } | null>(null);
  const [difficultyStats, setDifficultyStats] = useState<{ Easy: DifficultyStats; Medium: DifficultyStats; Hard: DifficultyStats } | null>(null);
  const [subjectPerformance, setSubjectPerformance] = useState<SubjectPerformance[]>([]);
  const [currentReviewQuestionIndex, setCurrentReviewQuestionIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"summary" | "review">("summary");

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportingQuestionId, setReportingQuestionId] = useState<string | null>(null);
  const reportForm = useForm<ReportInput>({
    resolver: zodResolver(ReportSchema),
    defaultValues: { TypeOfError: undefined, Please_write_your_report_here: "" },
  });

  const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState(false);
  const [userNotebooks, setUserNotebooks] = useState<StudentBookmark[]>([]);
  const [isLoadingUserNotebooks, setIsLoadingUserNotebooks] = useState(false);
  const [selectedNotebookIdsInModal, setSelectedNotebookIdsInModal] = useState<Set<string>>(new Set());

  const fetchUserNotebooks = useCallback(async () => {
    if (!user?.id) { setUserNotebooks([]); setIsLoadingUserNotebooks(false); return; }
    setIsLoadingUserNotebooks(true);
    try {
      const records = await pb.collection('student_bookmarks').getFullList<StudentBookmark>({ filter: `user = "${user.id}"`, sort: '-updated', });
      setUserNotebooks(records.map(r => ({ ...r, questionCount: Array.isArray(r.questions) ? r.questions.length : 0 })));
    } catch (err) { toast({ title: "Error Fetching Notebooks", variant: "destructive" }); setUserNotebooks([]); }
    finally { setIsLoadingUserNotebooks(false); }
  }, [user?.id, toast]);

  const handleOpenBookmarkModal = () => { if (currentReviewQuestion) { fetchUserNotebooks(); setSelectedNotebookIdsInModal(new Set()); setIsBookmarkModalOpen(true); } };
  const handleToggleNotebookSelection = (notebookId: string) => setSelectedNotebookIdsInModal(prev => { const newSet = new Set(prev); if (newSet.has(notebookId)) newSet.delete(notebookId); else newSet.add(notebookId); return newSet; });
  const handleSaveToNotebooks = async () => {
    if (!currentReviewQuestion || !user?.id || selectedNotebookIdsInModal.size === 0) { toast({ title: "No Notebook Selected" }); return; }
    let successCount = 0, errorCount = 0;
    for (const notebookId of Array.from(selectedNotebookIdsInModal)) {
      try {
        const notebook = await pb.collection('student_bookmarks').getOne<StudentBookmark>(notebookId);
        const existingQuestions = Array.isArray(notebook.questions) ? notebook.questions : [];
        if (!existingQuestions.includes(currentReviewQuestion.id)) {
          await pb.collection('student_bookmarks').update(notebookId, { "questions+": currentReviewQuestion.id });
        } successCount++;
      } catch (err) { errorCount++; console.error(`Failed to add question to notebook ${notebookId}:`, err); }
    }
    if (successCount > 0) toast({ title: "Bookmarked!", description: `Question added to ${successCount} notebook(s).` });
    if (errorCount > 0) toast({ title: "Error Bookmarking", description: `Failed for ${errorCount} notebook(s).`, variant: "destructive" });
    setIsBookmarkModalOpen(false);
  };


  const fetchResultData = useCallback(async (isMountedGetter: () => boolean) => {
    console.log("ChapterwiseTestResultPage: fetchResultData called. resultId:", resultId);
    if (!resultId || !user?.id) {
      if (isMountedGetter()) {
        setError("Result ID or User ID missing.");
        setIsLoading(false);
      }
      return;
    }
    if (isMountedGetter()) setIsLoading(true);

    try {
      console.log(`ChapterwiseTestResultPage: Fetching from 'test_chapterwise_result', ID: ${resultId}`);
      const fetchedResultData = await pb.collection('test_chapterwise_result').getOne<ChapterwiseResultRecord>(resultId, { expand: 'test_id', $autoCancel: false });
      console.log("ChapterwiseTestResultPage: Fetched resultData:", fetchedResultData);
      if (!isMountedGetter()) return;
      setResultData(fetchedResultData);

      let parsedLog: AnswerLogItem[] = [];
      if (typeof fetchedResultData.answers_log === 'string') {
        try { parsedLog = JSON.parse(fetchedResultData.answers_log); } catch (e) { console.error("Error parsing answers_log:", e); }
      } else if (Array.isArray(fetchedResultData.answers_log)) {
        parsedLog = fetchedResultData.answers_log;
      }
      setAnswersLog(parsedLog);

      const fetchedTestPage = fetchedResultData.expand?.test_id as TestPagesRecord | undefined;
      console.log("ChapterwiseTestResultPage: Fetched testPage (expanded):", fetchedTestPage);
      if (!fetchedTestPage) {
        if (isMountedGetter()) setError("Original test details not found.");
        return;
      }
      setTestPageRecord(fetchedTestPage);

      const questionIdFields: Array<keyof TestPagesRecord> = ['PhysicsQuestion', 'ChemistryQuestion', 'MathsQuestion', 'BiologyQuestion'];
      let allQuestionIds: string[] = [];
      for (const field of questionIdFields) {
        const ids = fetchedTestPage[field] as string[] | undefined;
        if (ids && Array.isArray(ids)) allQuestionIds = allQuestionIds.concat(ids);
      }
      console.log("ChapterwiseTestResultPage: All question IDs from testPage:", allQuestionIds);

      if (allQuestionIds.length > 0) {
        const questionPromises = allQuestionIds.map(id =>
          pb.collection('question_bank').getOne<QuestionBankRecord>(id, { $autoCancel: false }).catch(err => {
            console.warn(`Failed to fetch question ${id} from question_bank, trying add_questions:`, err.data);
            return pb.collection('add_questions').getOne<QuestionBankRecord>(id, { $autoCancel: false }).catch(addQErr => {
              console.error(`Failed to fetch question ${id} from both question_bank and add_questions:`, addQErr.data);
              return null;
            });
          })
        );
        const fetchedQuestionsRaw = (await Promise.all(questionPromises)).filter(q => q !== null) as QuestionBankRecord[];
        
        const questionsWithUrls = fetchedQuestionsRaw.map(q => ({
          ...q,
          displayQuestionImageUrl: q.questionImage ? getPbFileUrl(q, 'questionImage') : (q.QuestionImage || null),
          displayOptionAImageUrl: q.optionAImage ? getPbFileUrl(q, 'optionAImage') : (q.OptionAImage || null),
          displayOptionBImageUrl: q.optionBImage ? getPbFileUrl(q, 'optionBImage') : (q.OptionBImage || null),
          displayOptionCImageUrl: q.optionCImage ? getPbFileUrl(q, 'optionCImage') : (q.OptionCImage || null),
          displayOptionDImageUrl: q.optionDImage ? getPbFileUrl(q, 'optionDImage') : (q.OptionDImage || null),
          displayExplanationImageUrl: q.explanationImage ? getPbFileUrl(q, 'explanationImage') : (q.ExplanationImage || null),
        }));
        if (isMountedGetter()) setTestQuestions(questionsWithUrls);


        const diffStats: { Easy: DifficultyStats; Medium: DifficultyStats; Hard: DifficultyStats } = { Easy: { attempted: 0, correct: 0, total: 0 }, Medium: { attempted: 0, correct: 0, total: 0 }, Hard: { attempted: 0, correct: 0, total: 0 } };
        const subjPerformanceMap: Record<string, Omit<SubjectPerformance, 'name' | 'accuracy'>> = {};
        questionsWithUrls.forEach(q => {
            if (q.difficulty) diffStats[q.difficulty].total++;
            const subject = q.subject || 'Uncategorized';
            if (!subjPerformanceMap[subject]) subjPerformanceMap[subject] = { correct: 0, attempted: 0, total: 0 };
            subjPerformanceMap[subject].total++;
            const logEntry = parsedLog.find(a => a.questionId === q.id);
            if (logEntry && logEntry.selectedOption) {
                if (q.difficulty) diffStats[q.difficulty].attempted++;
                subjPerformanceMap[subject].attempted++;
                if (logEntry.isCorrect) {
                    if (q.difficulty) diffStats[q.difficulty].correct++;
                    subjPerformanceMap[subject].correct++;
                }
            }
        });
        if (isMountedGetter()) setDifficultyStats(diffStats);
        const finalSubjPerformance = Object.entries(subjPerformanceMap).map(([name, data]) => ({ name, ...data, accuracy: data.attempted > 0 ? (data.correct / data.attempted) * 100 : 0 }));
        if (isMountedGetter()) setSubjectPerformance(finalSubjPerformance);

      } else {
        if (isMountedGetter()) setTestQuestions([]);
      }

      if (isMountedGetter()) {
        setStats({
          correct: fetchedResultData.correct_answers,
          incorrect: fetchedResultData.incorrect_answers,
          attempted: fetchedResultData.attempted_questions,
          unattempted: fetchedResultData.unattempted_questions,
          totalQuestions: fetchedResultData.total_questions,
          accuracy: fetchedResultData.attempted_questions > 0 ? (fetchedResultData.correct_answers / fetchedResultData.attempted_questions) * 100 : 0,
          percentage: fetchedResultData.percentage,
          score: fetchedResultData.score,
          maxScore: fetchedResultData.max_score,
        });
      }

    } catch (err: any) {
      if (isMountedGetter()) {
        const clientError = err as ClientResponseError;
        console.error("ChapterwiseTestResultPage: Full error object:", clientError);
        let errorMsg = `Could not load test results. Error: ${clientError.data?.message || clientError.message || 'Unknown error'}.`;
        if (clientError.status === 404) errorMsg = "Test result not found. It may have been deleted or the ID is incorrect.";
        setError(errorMsg);
        toast({ title: "Error Loading Results", description: errorMsg, variant: "destructive", duration: 7000 });
      }
    } finally {
      if (isMountedGetter()) setIsLoading(false);
    }
  }, [resultId, user?.id, toast]);

  useEffect(() => {
    let isMounted = true;
    if (!isAuthLoading && user?.id && resultId) {
      fetchResultData(() => isMounted);
    } else if (!isAuthLoading && !user?.id) {
      setError("User not authenticated."); setIsLoading(false);
    } else if (!resultId) {
      setError("Test Result ID is missing."); setIsLoading(false);
    }

    let unsubscribeFromUpdates: (() => void) | null = null;
    
    const setupSubscription = async () => {
      if (resultId && isMounted) {
        try {
          unsubscribeFromUpdates = await pb.collection('test_chapterwise_result').subscribe(resultId, (e) => {
            if (isMounted && e.action === 'update') {
              console.log("ChapterwiseTestResultPage: Test result record updated via subscription, re-fetching...");
              fetchResultData(() => isMounted);
            }
          });
        } catch (subError) {
          console.warn("ChapterwiseTestResultPage: Failed to subscribe to test result updates:", subError);
        }
      }
    };

    setupSubscription();

    return () => { 
      isMounted = false; 
      if (unsubscribeFromUpdates) {
        unsubscribeFromUpdates();
      }
    };
  }, [resultId, isAuthLoading, user?.id, fetchResultData]);


  const chartData = stats ? [
    { name: "Correct", value: stats.correct, fill: "hsl(var(--chart-1))" }, 
    { name: "Incorrect", value: stats.incorrect, fill: "hsl(var(--chart-2))" }, 
    { name: "Unattempted", value: stats.unattempted < 0 ? 0 : stats.unattempted, fill: "hsl(var(--chart-3))" }, 
  ] : [];
  const donutChartConfig = { value: { label: "Questions" }, Correct: { label: "Correct", color: "hsl(var(--chart-1))" }, Incorrect: { label: "Incorrect", color: "hsl(var(--chart-2))" }, Unattempted: { label: "Unattempted", color: "hsl(var(--chart-3))" }, } satisfies ChartConfig;

  const getQuestionStatusColor = (questionId: string, isActive: boolean): string => {
    const log = answersLog.find(a => a.questionId === questionId);
    if (isActive) return "bg-primary text-primary-foreground border-primary ring-2 ring-offset-1 ring-primary";
    if (!log || !log.selectedOption) return log?.markedForReview ? "bg-purple-500 hover:bg-purple-600 text-white" : "bg-muted hover:bg-muted/80 text-muted-foreground";
    if (log.isCorrect) return "bg-green-500 hover:bg-green-600 text-white";
    if (!log.isCorrect) return log.markedForReview ? "bg-yellow-400 hover:bg-yellow-500 text-black" : "bg-red-500 hover:bg-red-600 text-white";
    return "bg-muted hover:bg-muted/80 text-muted-foreground"; 
  };

  const handleReportSubmit = async (data: ReportInput) => {
    if (!user || !reportingQuestionId || !resultData?.test_id) { toast({ title: "Error", description: "Missing user, question, or context information for report.", variant: "destructive" }); return; }
    try {
      await pb.collection('report_by_students').create({ user: user.id, question: reportingQuestionId, test_in_which_report_is_made: resultData.test_id, TypeOfError: data.TypeOfError, Please_write_your_report_here: data.Please_write_your_report_here || null, });
      toast({ title: "Report Submitted", description: "Thank you for your feedback!" }); setIsReportModalOpen(false); reportForm.reset();
    } catch (err: any) { toast({ title: "Error Submitting Report", description: err.data?.message || err.message, variant: "destructive" }); }
  };
  const openReportModal = (questionId: string) => { setReportingQuestionId(questionId); setIsReportModalOpen(true); };

  const currentReviewQuestion = testQuestions[currentReviewQuestionIndex];
  const currentReviewAnswerLog = currentReviewQuestion ? answersLog.find(a => a.questionId === currentReviewQuestion.id) : null;
  const formatDetailedDuration = (totalSeconds: number): string => { if (totalSeconds < 0) totalSeconds = 0; const minutes = Math.floor(totalSeconds / 60); const seconds = totalSeconds % 60; return `${minutes} Min ${seconds} Sec`; };
  
  const statCardsData = stats ? [
    { title: "SCORE", value: `${stats.score} / ${stats.maxScore}`, icon: <ClipboardList className="h-5 w-5 text-blue-500" /> },
    { title: "PERCENTAGE", value: `${stats.percentage.toFixed(1)}%`, icon: <Percent className="h-5 w-5 text-purple-500" /> },
    { title: "ACCURACY", value: `${stats.accuracy.toFixed(1)}%`, icon: <TargetIcon className="h-5 w-5 text-green-500" /> },
    { title: "ATTEMPTED", value: `${stats.attempted} / ${stats.totalQuestions}`, icon: <UserCheck className="h-5 w-5 text-orange-500" /> },
  ] : [];


  if (isLoading || isAuthLoading) {
    return ( <div className="space-y-6 p-4 md:p-6"> <Skeleton className="h-10 w-3/4" /> <Skeleton className="h-8 w-1/2 mb-4" /> <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4"> {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)} </div> <Skeleton className="h-64 w-full rounded-lg" /> </div> );
  }
  if (error) {
    return ( <div className="p-4 md:p-6 text-center"> <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" /> <h2 className="text-xl font-semibold text-destructive mb-2">Error Loading Test Result</h2> <p className="text-muted-foreground mb-4 whitespace-pre-wrap">{error}</p> <Button onClick={() => router.back()} variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button> </div> );
  }
  if (!resultData || !stats) {
    return ( <div className="p-4 md:p-6 text-center"> <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" /> <h2 className="text-xl font-semibold mb-2">Test Result Not Found</h2> <p className="text-muted-foreground mb-4">The result for this test could not be found or is still processing.</p> <Button onClick={() => router.push(Routes.myProgress)} variant="default">Back to My Progress</Button> </div> );
  }

  return (
    <div className="min-h-screen bg-muted/30 dark:bg-slate-950">
      <header className="bg-background shadow-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          <h1 className="text-lg md:text-xl font-bold text-foreground truncate pr-4">Test Result: {resultData.test_name}</h1>
           <Button onClick={() => setActiveTab(activeTab === "summary" ? "review" : "summary")} variant="default" size="sm">
             <Eye className="mr-2 h-4 w-4"/>{activeTab === "summary" ? "Review Answers" : "View Summary"}
           </Button>
        </div>
      </header>
      <main className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {statCardsData.map(card => (
            <Card key={card.title} className="shadow-md rounded-lg bg-card">
              <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0"><CardTitle className="text-xs font-medium uppercase text-muted-foreground">{card.title}</CardTitle>{card.icon}</CardHeader>
              <CardContent className="px-4 pb-4"><div className="text-2xl font-bold text-foreground">{card.value}</div></CardContent>
            </Card>
          ))}
        </div>
        {activeTab === "summary" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 grid grid-cols-1 gap-6">
                <Card className="shadow-md"><CardHeader className="items-center text-center pb-2"><CardTitle className="text-md font-medium">Overview</CardTitle><CardDescription className="text-xs">Question Breakdown</CardDescription></CardHeader>
                    <CardContent className="h-[200px] flex items-center justify-center p-0">
                      {(stats.attempted === 0 && stats.unattempted === 0 && stats.totalQuestions === 0) ? <p className="text-muted-foreground text-sm">No questions/data.</p> : (
                        <ChartContainer config={donutChartConfig} className="aspect-square h-full w-full max-w-[250px] mx-auto">
                          <PieChart><Tooltip content={<ChartTooltipContent hideLabel nameKey="name" />} /><Pie data={chartData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={75} strokeWidth={2}>{chartData.map((entry) => ( <Cell key={`cell-${entry.name}`} fill={entry.fill} /> ))}</Pie></PieChart>
                        </ChartContainer>
                      )}
                    </CardContent><CardFooter className="text-xs text-muted-foreground text-center block pt-2 pb-4">Hover chart for details.</CardFooter>
                </Card>
              </div>
               <Card className="lg:col-span-2 shadow-md"><CardHeader><CardTitle className="text-md font-medium">Performance by Difficulty</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {(['Easy', 'Medium', 'Hard'] as const).map(level => {
                      const difficultyData = difficultyStats ? difficultyStats[level] : { attempted: 0, correct: 0, total: 0 };
                      const accuracy = difficultyData.attempted > 0 ? (difficultyData.correct / difficultyData.attempted) * 100 : 0;
                      let indicatorColorClass = 'bg-primary'; if (level === 'Easy') indicatorColorClass = 'bg-green-500'; else if (level === 'Medium') indicatorColorClass = 'bg-yellow-500'; else if (level === 'Hard') indicatorColorClass = 'bg-red-500';
                      return ( <div key={level} className="p-2.5 rounded-md border border-border bg-card"> <div className="flex justify-between items-center mb-1"><span className="font-semibold text-sm">{level}</span><Badge variant="outline" className="text-xs px-1.5 py-0.5">{difficultyData.correct}/{difficultyData.attempted} Correct (of {difficultyData.total} Total)</Badge></div> <div className="flex items-center gap-2"><Progress value={accuracy} className="h-1.5 flex-grow bg-muted/50" indicatorClassName={indicatorColorClass} /><span className="text-xs font-medium">{accuracy.toFixed(1)}% Acc.</span></div> </div> );
                    })}
                  </CardContent>
                </Card>
            </div>
        )}
        {activeTab === "review" && (
            testQuestions.length > 0 && currentReviewQuestion ? (
              <>
                <Card className="mb-4 shadow-sm bg-card"><CardHeader className="p-3"><CardTitle className="text-sm font-medium text-center text-muted-foreground">Questions</CardTitle></CardHeader><CardContent className="p-2"><ScrollArea className="h-auto max-h-28"><div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-15 xl:grid-cols-20 gap-1.5 p-1">{testQuestions.map((q, index) => (<Button key={q.id} variant="outline" size="icon" className={cn("h-7 w-7 text-xs rounded-md transition-all duration-150 ease-in-out", getQuestionStatusColor(q.id, currentReviewQuestionIndex === index))} onClick={() => setCurrentReviewQuestionIndex(index)}>{index + 1}</Button>))}</div></ScrollArea></CardContent></Card>
                <Card className="bg-card p-4 md:p-6 rounded-lg shadow-md border border-border">
                    <div className="flex justify-between items-center mb-3"><h3 className="text-lg font-semibold text-primary">Question {currentReviewQuestionIndex + 1}:</h3><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground flex items-center"><Clock className="h-3.5 w-3.5 mr-1"/> {formatDetailedDuration(currentReviewAnswerLog?.timeSpentSeconds || 0)}</span><Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-destructive p-1 h-auto" onClick={() => openReportModal(currentReviewQuestion.id)}><ReportIcon className="h-3.5 w-3.5 mr-1"/> Report</Button><Button variant="ghost" size="sm" onClick={handleOpenBookmarkModal} className="text-xs text-muted-foreground hover:text-primary p-1 h-auto"><BookmarkIcon className={cn("h-3.5 w-3.5 mr-1", "text-muted-foreground")} />Bookmark</Button></div></div>
                    <div className="prose prose-sm dark:prose-invert max-w-none mb-4 text-foreground leading-relaxed">{renderLatex(currentReviewQuestion.QuestionText || currentReviewQuestion.questionText)}</div>
                    {currentReviewQuestion.displayQuestionImageUrl && <div className="my-4 text-center"><NextImage src={currentReviewQuestion.displayQuestionImageUrl} alt="Question Image" width={400} height={300} className="rounded object-contain inline-block border" data-ai-hint="question diagram"/></div>}
                    {!(currentReviewQuestion.QuestionText || currentReviewQuestion.questionText || currentReviewQuestion.displayQuestionImageUrl) && <p className="text-sm text-muted-foreground italic py-4">No question text or image provided.</p>}
                    <div className="space-y-3 mt-6">
                        {['A', 'B', 'C', 'D'].map(optChar => {
                            const optionFullLabel = `Option ${optChar}`; const textKey = `Option${optChar}Text` as keyof QuestionBankRecord; const imageKey = `displayOption${optChar}ImageUrl` as keyof QuestionBankRecord; const altTextKey = `option${optChar}Text` as keyof QuestionBankRecord; const altImageKey = `displayOption${optChar}ImageUrl` as keyof QuestionBankRecord;
                            const actualText = currentReviewQuestion[textKey] || currentReviewQuestion[altTextKey]; const actualImage = currentReviewQuestion[imageKey] || currentReviewQuestion[altImageKey];
                            const isSelected = currentReviewAnswerLog?.selectedOption === optionFullLabel; const isCorrectDbOption = (currentReviewQuestion.CorrectOption || currentReviewQuestion.correctOption) === optionFullLabel || (currentReviewQuestion.CorrectOption || currentReviewQuestion.correctOption) === optChar;
                            let optionBgClass = "bg-card hover:bg-muted/30"; let optionBorderClass = "border-border"; let answerIndicator: React.ReactNode = null; let optionTextColor = "text-foreground";
                            if (isCorrectDbOption) { optionBgClass = "bg-green-500/10 dark:bg-green-700/20"; optionBorderClass = "border-green-500/50 dark:border-green-600/50"; optionTextColor = "text-green-700 dark:text-green-400"; answerIndicator = <Badge className="ml-auto text-xs bg-green-600 text-white px-2 py-0.5">Correct Answer</Badge>; }
                            if (isSelected) { if (currentReviewAnswerLog?.isCorrect) answerIndicator = (<div className="ml-auto flex items-center gap-2"><Badge variant="outline" className="text-xs border-green-500 text-green-600 bg-transparent px-2 py-0.5">Your Answer</Badge><Badge className="text-xs bg-green-600 text-white px-2 py-0.5">Correct Answer</Badge></div>); else { optionBgClass = "bg-red-500/10 dark:bg-red-700/20"; optionBorderClass = "border-red-500/50 dark:border-red-600/50"; optionTextColor = "text-red-700 dark:text-red-400"; answerIndicator = (<div className="ml-auto flex items-center gap-2"><Badge variant="outline" className="text-xs border-red-500 text-red-600 bg-transparent px-2 py-0.5">Your Answer</Badge><Badge className="text-xs bg-red-600 text-white px-2 py-0.5">Wrong Answer</Badge></div>); }}
                            return (<div key={optChar} className={cn("p-3 border rounded-md transition-all flex items-start gap-3", optionBgClass, optionBorderClass)}> <span className={cn("font-semibold", isCorrectDbOption ? "text-green-700 dark:text-green-300" : "text-primary")}>{optChar}.</span> <div className={cn("flex-1 text-sm", optionTextColor)}> {(actualText || actualImage) ? (<>{actualText && <div className={cn("prose prose-sm dark:prose-invert max-w-none")}>{renderLatex(actualText as string)}</div>}{actualImage && <div className="mt-1.5"><NextImage src={actualImage as string} alt={`Option ${optChar}`} width={150} height={80} className="rounded object-contain border" data-ai-hint="option illustration"/></div>}</>) : (<p className="italic">Option {optChar} content not available.</p>)} </div>{answerIndicator}</div>);
                        })}
                    </div>
                    {(currentReviewQuestion.explanationText || currentReviewQuestion.ExplanationText || currentReviewQuestion.displayExplanationImageUrl) && <div className="mt-6 pt-4 border-t"><h4 className="text-md font-semibold text-muted-foreground mb-2">Explanation:</h4>{(currentReviewQuestion.explanationText || currentReviewQuestion.ExplanationText) && <div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed">{renderLatex(currentReviewQuestion.explanationText || currentReviewQuestion.ExplanationText)}</div>}{currentReviewQuestion.displayExplanationImageUrl && <div className="my-3 text-center"><NextImage src={currentReviewQuestion.displayExplanationImageUrl} alt="Explanation Image" width={300} height={200} className="rounded object-contain inline-block border" data-ai-hint="explanation diagram"/></div>}</div>}
                    {!(currentReviewQuestion.explanationText || currentReviewQuestion.ExplanationText || currentReviewQuestion.displayExplanationImageUrl) && <p className="text-sm text-muted-foreground mt-4 text-center italic">No explanation available for this question.</p>}
                </Card>
                <div className="flex justify-between items-center mt-4"><Button variant="outline" onClick={() => setCurrentReviewQuestionIndex(prev => Math.max(0, prev - 1))} disabled={currentReviewQuestionIndex === 0}><ChevronLeft className="mr-2 h-4 w-4" /> Previous</Button><Button variant="outline" onClick={() => setCurrentReviewQuestionIndex(prev => Math.min(testQuestions.length - 1, prev + 1))} disabled={currentReviewQuestionIndex === testQuestions.length - 1}><ChevronRight className="ml-2 h-4 w-4" /> Next</Button></div>
              </>
            ) : <p className="text-center text-muted-foreground py-10">Select a question from the palette above to review.</p>
        )}
        <div className="mt-8 text-center"><Link href={Routes.myProgress} passHref><Button variant="outline" size="lg"><LayoutDashboard className="mr-2 h-5 w-5" /> Back to My Progress</Button></Link></div>
      </main>
      <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}><DialogContent><DialogHeader><DialogTitle>Report Question {currentReviewQuestionIndex + 1}</DialogTitle><DialogDescription>Please let us know what's wrong.</DialogDescription></DialogHeader><Form {...reportForm}><form onSubmit={reportForm.handleSubmit(handleReportSubmit)} className="space-y-4"><FormField control={reportForm.control} name="TypeOfError" render={({ field }) => (<FormItem><FormLabel>Type of Error</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select error type" /></SelectTrigger></FormControl><SelectContent>{ReportErrorTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/> <FormField control={reportForm.control} name="Please_write_your_report_here" render={({ field }) => (<FormItem><FormLabel>Details (Optional)</FormLabel><FormControl><Textarea placeholder="Provide more details..." {...field} value={field.value ?? ''} rows={3}/></FormControl><FormMessage /></FormItem>)}/> <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={reportForm.formState.isSubmitting}>{reportForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit Report</Button></DialogFooter></form></Form></DialogContent></Dialog>
      <Dialog open={isBookmarkModalOpen} onOpenChange={setIsBookmarkModalOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Add to Notebooks</DialogTitle><DialogDescription>Select notebook(s).</DialogDescription></DialogHeader> {isLoadingUserNotebooks ? <div className="flex justify-center items-center h-32"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div> : userNotebooks.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No notebooks. <Link href={Routes.notebooks} className="text-primary hover:underline">Create one!</Link></p> : ( <ScrollArea className="max-h-60 my-4"><div className="space-y-2 pr-2">{userNotebooks.map(nb => (<div key={nb.id} className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50"> <Checkbox id={`nb-${nb.id}`} checked={selectedNotebookIdsInModal.has(nb.id)} onCheckedChange={() => handleToggleNotebookSelection(nb.id)}/> <label htmlFor={`nb-${nb.id}`} className="text-sm font-medium leading-none flex-1 cursor-pointer">{nb.notebook_name}</label><Badge variant="outline" className="text-xs">{nb.questionCount || 0} Qs</Badge> </div>))}</div></ScrollArea> )} <Button type="button" variant="outline" size="sm" className="w-full justify-start text-primary hover:text-primary/90" onClick={() => router.push(Routes.notebooks)}><PlusCircle className="mr-2 h-4 w-4"/> Create New Notebook</Button> <div className="mt-4 pt-4 border-t"><p className="text-sm font-medium mb-2 text-muted-foreground">Add tags (optional):</p><div className="flex flex-wrap gap-2">{PREDEFINED_TAGS.map(tag => (<Button key={tag} variant="outline" size="sm" className="text-xs" onClick={() => toast({title: "Tagging coming soon!", description: `Selected tag: ${tag}`})}>{tag}</Button>))}</div><p className="text-xs text-muted-foreground mt-2">Tags apply to this question in selected notebooks.</p></div> <DialogFooter className="mt-4"><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button onClick={handleSaveToNotebooks} disabled={selectedNotebookIdsInModal.size === 0 || isLoadingUserNotebooks}>Save</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
      

    