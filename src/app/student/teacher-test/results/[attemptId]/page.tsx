
'use client';

import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState, useCallback, useRef } from 'react';
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
import type { StudentBookmark, User, TeacherTestAttempt, AnswerLogItem as BaseAnswerLogItem } from '@/lib/types';

import { AlertCircle, ArrowLeft, CheckCircle, ChevronLeft, ChevronRight, Clock, FileText, BarChart3, Target as TargetIcon, Info, TrendingUp, XCircle, Percent, Users, Star, ThumbsDown, Zap, Turtle, ClipboardList, Eye as EyeIcon, BookOpen, AlertTriangle as ReportIcon, Loader2, ListFilter, CalendarDays, NotebookText, BarChart, PieChart as PieChartIcon, UserCheck, Bookmark as BookmarkIcon, LayoutDashboard, PlusCircle, Check, Printer } from 'lucide-react';
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
import { Label } from '@/components/ui/label';

interface StoredAnswerLogItem extends BaseAnswerLogItem {
  markedForReview?: boolean;
  timeSpentSeconds: number;
}

interface OriginalTeacherTestRecord extends RecordModel {
  id: string;
  testName: string;
  teacherId: string;
  questions_edunexus?: string[];
  questions_teachers?: string[];
  totalScore?: number;
  expand?: {
    teacherId?: {
      name?: string;
    };
  };
}

interface NormalizedQuestionRecordForDisplay {
  id: string;
  questionText?: string | null;
  questionImageUrl?: string | null;
  options: Array<{ label: 'A' | 'B' | 'C' | 'D'; text?: string | null; imageUrl?: string | null; }>;
  correctOptionEnum: 'A' | 'B' | 'C' | 'D';
  correctOptionString: 'Option A' | 'Option B' | 'Option C' | 'Option D';
  explanationText?: string | null;
  explanationImageUrl?: string | null;
  marks: number;
  difficulty?: 'Easy' | 'Medium' | 'Hard' | null;
  subject?: string | null;
  rawRecord: RecordModel;
}

interface DifficultyStats { attempted: number; correct: number; total: number; }
interface OverallStats { correct: number; incorrect: number; attempted: number; unattempted: number; totalQuestions: number; accuracy: number; percentage: number; score: number; maxScore: number; }

const ReportErrorTypes = [ "Wrong Question", "Incomplete Question", "Incorrect Grammar", "Question is out of syllabus", "Question an old pattern", "Repeated Question" ] as const;
const ReportSchema = z.object({ TypeOfError: z.enum(ReportErrorTypes, { required_error: "Please select an error type."}), Please_write_your_report_here: z.string().min(10, "Report must be at least 10 characters.").max(500, "Report cannot exceed 500 characters.").optional().nullable() });
type ReportInput = z.infer<typeof ReportSchema>;

const PREDEFINED_TAGS = ["Easy", "Hard", "Tricky", "Do Again"];

const getPbFileUrl = (record: RecordModel | null | undefined, fieldName: string): string | null => {
  if (record && record[fieldName] && record.collectionId && record.collectionName && typeof record[fieldName] === 'string') {
    try { return pb.files.getUrl(record, record[fieldName] as string); }
    catch (e) { console.warn(`Error getting URL for ${fieldName} in record ${record.id}:`, e); return null; }
  }
  return null;
};

const renderLatex = (text: string | undefined | null): React.ReactNode => {
    if (!text) return null;
    const parts = text.split(/(\$\$[\s\S]*?\$\$|\$.*?\$|\\\(.*?\\\)|\\\[.*?\\\]|\\begin\{.*?\}[\s\S]*?\\end\{.*?\})/g);
    return parts.map((part, index) => {
      try {
        if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
          return <BlockMath key={index} math={part.substring(2, part.length - 2)} />;
        }
        if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
          return <InlineMath key={index} math={part.substring(1, part.length - 1)} />;
        }
        if (part.startsWith('\\(') && part.endsWith('\\)')) {
          return <InlineMath key={index} math={part.substring(2, part.length - 2)} />;
        }
        if (part.startsWith('\\[') && part.endsWith('\\]')) {
          return <BlockMath key={index} math={part.substring(2, part.length - 2)} />;
        }
        if (part.startsWith('\\begin{') && part.includes('\\end{')) {
             const envMatch = part.match(/^\\begin\{(.*?)\}/);
            if (envMatch && ['equation', 'align', 'gather', 'matrix', 'pmatrix', 'bmatrix', 'vmatrix', 'Vmatrix', 'cases', 'array', 'subequations'].includes(envMatch[1])) {
                 return <BlockMath key={index} math={part} />;
            }
            return <BlockMath key={index} math={part} />;
        }
      } catch (e) {
        const cleanedPart = part.replace(/^\$(\$)?|(\$)?\$$/, '').replace(/^\\(\[|\()|\\(\]|\))$/, '');
        return <span key={index} className="text-destructive" title="LaTeX Error">{cleanedPart}</span>;
      }
      return <span key={index}>{part}</span>;
    });
};

export default function TeacherTestStudentResultPage() {
  const params = useParams();
  const router = useRouter();
  const attemptId = typeof params.attemptId === 'string' ? params.attemptId : '';

  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const [attemptData, setAttemptData] = useState<TeacherTestAttempt | null>(null);
  const [originalTestDetails, setOriginalTestDetails] = useState<OriginalTeacherTestRecord | null>(null);
  const [testQuestions, setTestQuestions] = useState<NormalizedQuestionRecordForDisplay[]>([]);
  const [answersLog, setAnswersLog] = useState<StoredAnswerLogItem[]>([]);
  const [stats, setStats] = useState<OverallStats | null>(null);
  const [difficultyStats, setDifficultyStats] = useState<{ Easy: DifficultyStats; Medium: DifficultyStats; Hard: DifficultyStats } | null>(null);

  const [currentReviewQuestionIndex, setCurrentReviewQuestionIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"summary" | "review">("summary");

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportingQuestionId, setReportingQuestionId] = useState<string | null>(null);
  const reportForm = useForm<ReportInput>({ resolver: zodResolver(ReportSchema), defaultValues: { TypeOfError: undefined, Please_write_your_report_here: "" } });

  const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState(false);
  const [userNotebooks, setUserNotebooks] = useState<StudentBookmark[]>([]);
  const [isLoadingUserNotebooks, setIsLoadingUserNotebooks] = useState(false);
  const [selectedNotebookIdsInModal, setSelectedNotebookIdsInModal] = useState<Set<string>>(new Set());
  const [generatedDate, setGeneratedDate] = useState('');
  const [isPrintPreviewActive, setIsPrintPreviewActive] = useState(false);
  const [showAnswersInPrint, setShowAnswersInPrint] = useState(false);

  const fetchResultData = useCallback(async (isMountedGetter: () => boolean = () => true) => {
    if (!attemptId || !user?.id) { if (isMountedGetter()) { setError("Attempt ID or User ID missing."); setIsLoading(false); } return; }
    if (isMountedGetter()) setIsLoading(true);

    try {
      const fetchedAttemptData = await pb.collection('teacher_test_history').getOne<TeacherTestAttempt>(attemptId, { expand: 'teacher_test,teacher_test.teacherId', '$autoCancel': false });
      if (!isMountedGetter()) return;
      setAttemptData(fetchedAttemptData);
      setGeneratedDate(new Date(fetchedAttemptData.created).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }));

      let parsedLog: StoredAnswerLogItem[] = [];
      if (typeof fetchedAttemptData.answers_log === 'string') { try { parsedLog = JSON.parse(fetchedAttemptData.answers_log); } catch (e) { console.error("Error parsing answers_log:", e); }}
      else if (Array.isArray(fetchedAttemptData.answers_log)) { parsedLog = fetchedAttemptData.answers_log as StoredAnswerLogItem[]; }
      setAnswersLog(parsedLog);

      const fetchedOriginalTest = fetchedAttemptData.expand?.teacher_test as OriginalTeacherTestRecord | undefined;
      if (!fetchedOriginalTest) { if (isMountedGetter()) { setError("Original test details not found for this attempt."); setIsLoading(false); return; } } else { setOriginalTestDetails(fetchedOriginalTest); }

      const eduNexusQuestionIds = Array.isArray(fetchedOriginalTest?.questions_edunexus) ? fetchedOriginalTest.questions_edunexus : [];
      const teacherQuestionIds = Array.isArray(fetchedOriginalTest?.questions_teachers) ? fetchedOriginalTest.questions_teachers : [];

      let allQuestionsFromDb: RecordModel[] = [];
      if (eduNexusQuestionIds.length > 0) {
        const qbQuestions = await pb.collection('question_bank').getFullList<RecordModel>({ filter: eduNexusQuestionIds.map(id => `id="${escapeForPbFilter(id)}"`).join('||'), '$autoCancel': false });
        allQuestionsFromDb.push(...qbQuestions.map(q => ({...q, __source: 'question_bank'})));
      }
      if (teacherQuestionIds.length > 0) {
        const teacherQs = await pb.collection('teacher_question_data').getFullList<RecordModel>({ filter: teacherQuestionIds.map(id => `id="${escapeForPbFilter(id)}"`).join('||'), '$autoCancel': false });
        allQuestionsFromDb.push(...teacherQs.map(q => ({...q, __source: 'teacher_question_data'})));
      }
      if (!isMountedGetter()) return;

      const originalOrder = [...eduNexusQuestionIds, ...teacherQuestionIds];
      allQuestionsFromDb.sort((a,b) => {
          const indexA = originalOrder.indexOf(a.id); const indexB = originalOrder.indexOf(b.id);
          if (indexA === -1 && indexB === -1) return 0; if (indexA === -1) return 1; if (indexB === -1) return -1;
          return indexA - indexB;
      });

      const normalizedQs: NormalizedQuestionRecordForDisplay[] = allQuestionsFromDb.map(q => {
        const sourceCollection = q.__source as 'question_bank' | 'teacher_question_data';
        const correctOptRaw = sourceCollection === 'question_bank' ? q.correctOption : q.CorrectOption;
        const correctOptEnum = (typeof correctOptRaw === 'string' ? correctOptRaw.replace('Option ', '') : 'A') as 'A'|'B'|'C'|'D';
        return {
          id: q.id,
          questionText: sourceCollection === 'question_bank' ? q.questionText : q.QuestionText,
          questionImageUrl: sourceCollection === 'question_bank' ? getPbFileUrl(q, 'questionImage') : getPbFileUrl(q, 'QuestionImage'),
          options: (['A', 'B', 'C', 'D'] as const).map(label => ({
            label,
            text: q[`${sourceCollection === 'question_bank' ? 'option' : 'Option'}${label}Text`],
            imageUrl: getPbFileUrl(q, `${sourceCollection === 'question_bank' ? 'option' : 'Option'}${label}Image`),
          })),
          correctOptionEnum: correctOptEnum,
          correctOptionString: `Option ${correctOptEnum}` as 'Option A' | 'Option B' | 'Option C' | 'Option D',
          explanationText: sourceCollection === 'question_bank' ? q.explanationText : q.explanationText_teacher,
          explanationImageUrl: sourceCollection === 'question_bank' ? getPbFileUrl(q, 'explanationImage') : getPbFileUrl(q, 'explanationImage_teacher'),
          difficulty: q.difficulty,
          subject: q.subject,
          marks: typeof q.marks === 'number' ? q.marks : 1,
          rawRecord: q,
        };
      });
      if (isMountedGetter()) setTestQuestions(normalizedQs);

      const diffStatsCalc: { Easy: DifficultyStats; Medium: DifficultyStats; Hard: DifficultyStats } = { Easy: { attempted: 0, correct: 0, total: 0 }, Medium: { attempted: 0, correct: 0, total: 0 }, Hard: { attempted: 0, correct: 0, total: 0 } };
      normalizedQs.forEach(q => {
        const difficulty = q.difficulty || 'Medium';
        diffStatsCalc[difficulty].total++;
        const logEntry = parsedLog.find(a => a.questionId === q.id);
        if (logEntry && logEntry.selectedOption) {
          diffStatsCalc[difficulty].attempted++;
          if (logEntry.isCorrect) diffStatsCalc[difficulty].correct++;
        }
      });
      if (isMountedGetter()) setDifficultyStats(diffStatsCalc);

      if (isMountedGetter()) {
        const correct = fetchedAttemptData.correct_answers_count ?? fetchedAttemptData.score ?? 0; // Prioritize detailed counts if available
        const attempted = fetchedAttemptData.attempted_questions_count ?? 0;
        const totalQuestions = fetchedAttemptData.total_questions_in_test_cache ?? 0;
        setStats({
          correct: correct,
          incorrect: attempted - correct,
          attempted: attempted,
          unattempted: totalQuestions - attempted,
          totalQuestions: totalQuestions,
          accuracy: attempted > 0 ? (correct / attempted) * 100 : 0,
          percentage: fetchedAttemptData.percentage || 0,
          score: fetchedAttemptData.score,
          maxScore: fetchedAttemptData.max_score,
        });
      }

    } catch (err: any) {
      if (!isMountedGetter()) return;
      const clientError = err as ClientResponseError;
      let errorMsg = `Could not load results. Error: ${clientError.data?.message || clientError.message || 'Unknown error'}.`;
      if (clientError.status === 404) errorMsg = "Test result not found.";
      console.error("Student's View TeacherTestResultPage: Full error object:", clientError);
      setError(errorMsg); toast({ title: "Error Loading Results", description: errorMsg, variant: "destructive", duration: 7000 });
    } finally { if (isMountedGetter()) setIsLoading(false); }
  }, [attemptId, user?.id, toast, escapeForPbFilter]);

  useEffect(() => {
    let isMounted = true;
    if (!isAuthLoading && user?.id && attemptId) {
      fetchResultData(() => isMounted);
    } else if (!isAuthLoading && !user?.id) {
      if (isMounted) { setIsLoading(false); setError("User not authenticated."); }
    } else if (!attemptId) {
      if (isMounted) { setIsLoading(false); setError("Attempt ID is missing."); }
    }
    return () => { isMounted = false; };
  }, [attemptId, isAuthLoading, user?.id, fetchResultData]);

  const fetchUserNotebooks = useCallback(async () => {
    if (!user?.id) { setUserNotebooks([]); setIsLoadingUserNotebooks(false); return; }
    setIsLoadingUserNotebooks(true);
    try {
      const records = await pb.collection('student_bookmarks').getFullList<StudentBookmark>({ filter: `user = "${user.id}"`, sort: '-updated', });
      setUserNotebooks(records.map(r => ({ ...r, questionCount: Array.isArray(r.questions) ? r.questions.length : 0 })));
    } catch (err) {
      toast({ title: "Error Fetching Notebooks", variant: "destructive" });
      setUserNotebooks([]);
    } finally {
      setIsLoadingUserNotebooks(false);
    }
  }, [user?.id, toast]);

  const handleOpenBookmarkModal = () => {
    if (currentReviewQuestion) {
      fetchUserNotebooks();
      setSelectedNotebookIdsInModal(new Set());
      setIsBookmarkModalOpen(true);
    }
  };

  const handleToggleNotebookSelection = (notebookId: string) => {
    setSelectedNotebookIdsInModal(prev => {
      const newSet = new Set(prev);
      if (newSet.has(notebookId)) newSet.delete(notebookId);
      else newSet.add(notebookId);
      return newSet;
    });
  };

  const handleSaveToNotebooks = async () => {
    if (!currentReviewQuestion || !user?.id || selectedNotebookIdsInModal.size === 0) {
      toast({ title: "No Notebook Selected" });
      return;
    }
    let successCount = 0;
    let errorCount = 0;
    for (const notebookId of Array.from(selectedNotebookIdsInModal)) {
      try {
        const notebook = await pb.collection('student_bookmarks').getOne<StudentBookmark>(notebookId);
        const existingQuestions = Array.isArray(notebook.questions) ? notebook.questions : [];
        if (!existingQuestions.includes(currentReviewQuestion.id)) {
          await pb.collection('student_bookmarks').update(notebookId, { "questions+": currentReviewQuestion.id });
        }
        successCount++;
      } catch (err) {
        errorCount++;
        console.error(`Failed to add question to notebook ${notebookId}:`, err);
      }
    }
    if (successCount > 0) toast({ title: "Bookmarked!", description: `Question saved to ${successCount} notebook(s).` });
    if (errorCount > 0) toast({ title: "Error Bookmarking", description: `Failed for ${errorCount} notebook(s).`, variant: "destructive" });
    setIsBookmarkModalOpen(false);
  };

  const handleReportSubmit = async (data: ReportInput) => {
    if (!user || !reportingQuestionId || !attemptData?.teacher_test) {
      toast({ title: "Error", description: "Missing data for report.", variant: "destructive" });
      return;
    }
    try {
      await pb.collection('report_by_students').create({ user: user.id, question: reportingQuestionId, test_in_which_report_is_made: attemptData.teacher_test, TypeOfError: data.TypeOfError, Please_write_your_report_here: data.Please_write_your_report_here || null, });
      toast({ title: "Report Submitted", description: "Thank you!" });
      setIsReportModalOpen(false);
      reportForm.reset();
    } catch (err: any) {
      toast({ title: "Error Submitting Report", description: err.data?.message || err.message, variant: "destructive" });
    }
  };

  const openReportModal = (questionId: string) => {
    setReportingQuestionId(questionId);
    setIsReportModalOpen(true);
  };

  const chartData = useMemo(() => stats ? [
    { name: "Correct", value: stats.correct, fill: "hsl(var(--chart-1))" },
    { name: "Incorrect", value: stats.incorrect, fill: "hsl(var(--chart-2))" },
    { name: "Unattempted", value: Math.max(0, stats.unattempted), fill: "hsl(var(--chart-3))" },
  ] : [], [stats]);

  const donutChartConfig = useMemo(() => ({
    value: { label: "Questions" },
    Correct: { label: "Correct", color: "hsl(var(--chart-1))" },
    Incorrect: { label: "Incorrect", color: "hsl(var(--chart-2))" },
    Unattempted: { label: "Unattempted", color: "hsl(var(--chart-3))" },
  } satisfies ChartConfig), []);

  const getQuestionStatusColor = (questionId: string, isActive: boolean): string => {
    const log = answersLog.find(a => a.questionId === questionId);
    if (isActive) return "bg-primary text-primary-foreground border-primary ring-2 ring-offset-1 ring-primary";
    if (!log || !log.selectedOption) return log?.markedForReview ? "bg-purple-500 hover:bg-purple-600 text-white" : "bg-muted hover:bg-muted/80 text-muted-foreground";
    if (log.isCorrect) return "bg-green-500 hover:bg-green-600 text-white";
    if (!log.isCorrect) return log.markedForReview ? "bg-yellow-400 hover:bg-yellow-500 text-black" : "bg-red-500 hover:bg-red-600 text-white";
    return "bg-muted hover:bg-muted/80 text-muted-foreground";
  };

  const currentReviewQuestion = testQuestions[currentReviewQuestionIndex];
  const currentReviewAnswerLog = currentReviewQuestion ? answersLog.find(a => a.questionId === currentReviewQuestion.id) : null;

  const formatDetailedDuration = (totalSeconds?: number): string => {
    if (totalSeconds === undefined || totalSeconds < 0) totalSeconds = 0;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes} Min ${seconds} Sec`;
  };

  const statCardsData = useMemo(() => stats ? [
    { title: "SCORE", value: `${stats.score} / ${stats.maxScore}`, icon: <ClipboardList className="h-5 w-5 text-blue-500" /> },
    { title: "PERCENTAGE", value: `${stats.percentage.toFixed(1)}%`, icon: <Percent className="h-5 w-5 text-purple-500" /> },
    { title: "ACCURACY", value: `${stats.accuracy.toFixed(1)}%`, icon: <TargetIcon className="h-5 w-5 text-green-500" /> },
    { title: "ATTEMPTED", value: `${stats.attempted} / ${stats.totalQuestions}`, icon: <UserCheck className="h-5 w-5 text-orange-500" /> },
  ] : [], [stats]);

  const handlePrint = () => {
    const printableElement = document.getElementById('printableTestContent');
    if (printableElement) {
      printableElement.setAttribute('data-test-name', attemptData?.test_name_cache || originalTestDetails?.testName || 'Test');
    }
    setIsPrintPreviewActive(true);
  };

  useEffect(() => {
    let afterPrintHandler: () => void;
    if (isPrintPreviewActive) {
      const printTimeout = setTimeout(() => {
        document.body.setAttribute('data-watermark-text', `EduNexus - ${attemptData?.test_name_cache || originalTestDetails?.testName || 'Test'}`);
        window.print();
      }, 100);
      
      afterPrintHandler = () => {
        setIsPrintPreviewActive(false);
        document.body.removeAttribute('data-watermark-text');
        window.removeEventListener('afterprint', afterPrintHandler);
      };
      window.addEventListener('afterprint', afterPrintHandler);
      
      return () => {
        clearTimeout(printTimeout);
        window.removeEventListener('afterprint', afterPrintHandler);
        document.body.removeAttribute('data-watermark-text'); 
      };
    }
  }, [isPrintPreviewActive, attemptData?.test_name_cache, originalTestDetails?.testName]);

  const getAriaLabelForPaletteButton = (q_id: string, index: number): string => {
    const logEntry = answersLog.find(a => a.questionId === q_id);
    let statusText = 'Not Visited';
    if (logEntry) {
      if (logEntry.selectedOption) {
        statusText = logEntry.isCorrect ? 'Correct' : 'Incorrect';
        if (logEntry.markedForReview) statusText += ' & Marked';
      } else if (logEntry.markedForReview) {
        statusText = 'Marked for Review';
      }
    }
    return `Go to question ${index + 1}, Status: ${statusText}`;
  };
  
  function PrintLayout() {
    return (
    <div id="printableTestContent" className={cn(showAnswersInPrint ? 'answers-visible' : 'answers-hidden')}>
      <header className="print-header text-center mb-6">
        <h1 className="text-2xl font-bold">Test: {attemptData?.test_name_cache || originalTestDetails?.testName || 'N/A'}</h1>
        <p className="text-sm">Teacher: {originalTestDetails?.expand?.teacherId?.name || 'Educator'}</p>
        <p className="text-sm">Student: {user?.name || 'N/A'}</p>
        <p className="text-sm">Taken on: {generatedDate}</p>
      </header>
      {testQuestions.map((q, index) => {
        const answerLogForPrint = answersLog.find(a => a.questionId === q.id);
        return (
        <div key={`print-q-${q.id}`} className="print-question-item">
          <h3 className="font-semibold text-base mt-4">Question {index + 1}:</h3>
          {q.questionText && <div className="prose prose-sm max-w-none">{renderLatex(q.questionText)}</div>}
          {q.questionImageUrl && <div className="my-2"><NextImage src={q.questionImageUrl} alt="Question Image" width={300} height={200} className="rounded object-contain border print:max-w-xs print:max-h-60" data-ai-hint="question diagram"/></div>}
          <ul className="list-none p-0 my-2 space-y-1">
            {q.options.map(opt => (<li key={opt.label} className="flex items-start gap-2"><span className="font-semibold">{opt.label}.</span><div className="prose prose-sm max-w-none">{opt.text && renderLatex(opt.text)}{opt.imageUrl && <div className="mt-1"><NextImage src={opt.imageUrl} alt={`Option ${opt.label}`} width={150} height={90} className="rounded object-contain border print:max-w-[100px] print:max-h-[60px]" data-ai-hint="option diagram"/></div>}</div></li>))}
          </ul>
          <div className="correct-answer-block text-sm"><strong>Correct Answer:</strong> {q.correctOptionEnum}</div>
          {answerLogForPrint?.selectedOption && <div className="text-sm"><strong>Your Answer:</strong> {answerLogForPrint.selectedOption.replace('Option ', '')} {answerLogForPrint.isCorrect ? <span className="text-green-600">(Correct)</span> : <span className="text-red-600">(Incorrect)</span>}</div>}
          {q.explanationText && <div className="explanation-block mt-1 text-sm"><strong className="text-xs">Explanation:</strong> <div className="prose prose-xs max-w-none">{renderLatex(q.explanationText)}</div></div>}
          {q.explanationImageUrl && <div className="explanation-block mt-1"><NextImage src={q.explanationImageUrl} alt="Explanation" width={200} height={120} className="rounded object-contain border print:max-w-xs print:max-h-52" data-ai-hint="explanation diagram"/></div>}
        </div>
      );
      })}
    </div>
  )};

  function QuestionPaletteContent() {
    return (
    <Card className="border-primary/30 bg-primary/5 flex-1 flex flex-col min-h-0 shadow-md rounded-lg md:mt-0">
      <CardHeader className="p-2 text-center border-b border-primary/20">
        <CardTitle className="text-sm text-primary">QUESTIONS ({testQuestions.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-2 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="grid grid-cols-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 gap-1.5 p-1">
            {testQuestions.map((q, index) => {
              const ariaLabel = getAriaLabelForPaletteButton(q.id, index);
              return (
                <Button
                  key={q.id}
                  variant="outline"
                  size="icon"
                  className={cn("h-8 w-full text-xs rounded-md aspect-square", getQuestionStatusColor(q.id, currentReviewQuestionIndex === index))}
                  onClick={() => setCurrentReviewQuestionIndex(index)}
                  aria-label={ariaLabel}
                >
                  {index + 1}
                  {answersLog.find(a => a.questionId === q.id)?.markedForReview && answersLog.find(a => a.questionId === q.id)?.selectedOption && <Check className="absolute h-2.5 w-2.5 bottom-0.5 right-0.5 text-white" />}
                </Button>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )};
  
  if (isLoading || isAuthLoading) { return ( <div className="space-y-6 p-4 md:p-6"> <Skeleton className="h-10 w-3/4" /> <Skeleton className="h-8 w-1/2 mb-4" /> <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4"> {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)} </div> <Skeleton className="h-64 w-full rounded-lg" /> </div> ); }
  if (error) { return ( <div className="p-4 md:p-6 text-center"> <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" /> <h2 className="text-xl font-semibold text-destructive mb-2">Error Loading Test Result</h2> <p className="text-muted-foreground mb-4 whitespace-pre-wrap">{error}</p> <Button onClick={() => router.back()} variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button> </div> ); }
  if (!attemptData || !stats || !originalTestDetails) { return ( <div className="p-4 md:p-6 text-center"> <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" /> <h2 className="text-xl font-semibold mb-2">Test Result Not Found</h2> <p className="text-muted-foreground mb-4">The result for this test could not be found or is still processing.</p> <Button onClick={() => router.push(Routes.myProgress)} variant="default">Back to My Progress</Button> </div> ); }
  if (isPrintPreviewActive) return <PrintLayout />;

  return (
    <div className="min-h-screen bg-muted/30 dark:bg-slate-950 print:bg-white">
      <header className="bg-background shadow-sm sticky top-0 z-40 print:hidden">
        <div className="container mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          <h1 className="text-lg md:text-xl font-bold text-foreground truncate pr-4">Result: {attemptData.test_name_cache || originalTestDetails.testName}</h1>
           <div className="flex items-center gap-2">
             <Button onClick={() => setShowAnswersInPrint(prev => !prev)} variant="outline" size="sm" className="text-xs">{showAnswersInPrint ? "Hide Answers (Print)" : "Show Answers (Print)"}</Button>
             <Button onClick={handlePrint} variant="outline" size="sm"><Printer className="mr-2 h-4 w-4"/> Print</Button>
             <Button onClick={() => setActiveTab(activeTab === "summary" ? "review" : "summary")} variant="default" size="sm">
               <EyeIcon className="mr-2 h-4 w-4"/>{activeTab === "summary" ? "Review Answers" : "View Summary"}
             </Button>
           </div>
        </div>
      </header>
      <main className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="print:text-center print:mb-4"><h2 className="text-2xl md:text-3xl font-bold text-foreground">Performance Analysis</h2><CardDescription>Test: {attemptData.test_name_cache || originalTestDetails.testName} <span className="hidden print:inline">| By: {originalTestDetails.expand?.teacherId?.name || 'Educator'}</span><span className="print:block">Taken on: {format(new Date(attemptData.submitted_at || attemptData.created), "dd MMM yyyy, HH:mm")}</span></CardDescription></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6"> {statCardsData.map(card => ( <Card key={card.title} className="shadow-md rounded-lg bg-card print:border print:shadow-none"> <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0"><CardTitle className="text-xs font-medium uppercase text-muted-foreground">{card.title}</CardTitle>{card.icon}</CardHeader> <CardContent className="px-4 pb-4"><div className="text-2xl font-bold text-foreground">{card.value}</div></CardContent> </Card> ))}</div>
        {activeTab === "summary" && ( <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"> <div className="lg:col-span-1 grid grid-cols-1 gap-6"> <Card className="shadow-md print:border print:shadow-none"><CardHeader className="items-center text-center pb-2"><CardTitle className="text-md font-medium">Overview</CardTitle><CardDescription className="text-xs">Question Breakdown</CardDescription></CardHeader><CardContent className="h-[200px] flex items-center justify-center p-0"> {(stats.attempted === 0 && stats.unattempted === 0 && stats.totalQuestions === 0) ? <p className="text-muted-foreground text-sm">No questions/data.</p> : (<ChartContainer config={donutChartConfig} className="aspect-square h-full w-full max-w-[250px] mx-auto"><PieChart><Tooltip content={<ChartTooltipContent hideLabel nameKey="name" />} /><Pie data={chartData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={75} strokeWidth={2}>{chartData.map((entry) => ( <Cell key={`cell-${entry.name}`} fill={entry.fill} /> ))}</PieChart></ChartContainer>)} </CardContent><CardFooter className="text-xs text-muted-foreground text-center block pt-2 pb-4 print:hidden">Hover chart for details.</CardFooter></Card> </Card></div> <Card className="lg:col-span-2 shadow-md print:border print:shadow-none"><CardHeader><CardTitle className="text-md font-medium">Performance by Difficulty</CardTitle></CardHeader><CardContent className="space-y-3"> {(['Easy', 'Medium', 'Hard'] as const).map(level => { const difficultyData = difficultyStats ? difficultyStats[level] : { attempted: 0, correct: 0, total: 0 }; const accuracy = difficultyData.attempted > 0 ? (difficultyData.correct / difficultyData.attempted) * 100 : 0; let indicatorColorClass = 'bg-primary print:bg-gray-700'; if (level === 'Easy') indicatorColorClass = 'bg-green-500 print:bg-green-700'; else if (level === 'Medium') indicatorColorClass = 'bg-yellow-500 print:bg-yellow-700'; else if (level === 'Hard') indicatorColorClass = 'bg-red-500 print:bg-red-700'; return ( <div key={level} className="p-2.5 rounded-md border border-border bg-card print:border-gray-300"> <div className="flex justify-between items-center mb-1"><span className="font-semibold text-sm">{level}</span><Badge variant="outline" className="text-xs px-1.5 py-0.5 print:border-gray-400">{difficultyData.correct}/{difficultyData.attempted} Correct (of {difficultyData.total} Total)</Badge></div> <div className="flex items-center gap-2"><Progress value={accuracy} className="h-1.5 flex-grow bg-muted/50 print:bg-gray-200" indicatorClassName={indicatorColorClass} /><span className="text-xs font-medium">{accuracy.toFixed(1)}% Acc.</span></div> </div> ); })} </CardContent></Card> </Card> )}
        {activeTab === "review" && ( testQuestions.length > 0 && currentReviewQuestion ? ( <> <Card className="mb-4 shadow-sm bg-card print:hidden"><CardHeader className="p-3"><CardTitle className="text-sm font-medium text-center text-muted-foreground">Questions</CardTitle></CardHeader><CardContent className="p-2"><ScrollArea className="h-auto max-h-28"><div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-15 xl:grid-cols-20 gap-1.5 p-1">{testQuestions.map((q, index) => (<Button key={q.id} variant="outline" size="icon" className={cn("h-7 w-7 text-xs rounded-md transition-all duration-150 ease-in-out", getQuestionStatusColor(q.id, currentReviewQuestionIndex === index))} onClick={() => setCurrentReviewQuestionIndex(index)} aria-label={getAriaLabelForPaletteButton(q.id, index)}>{index + 1}</Button>))}</div></ScrollArea></CardContent></Card> <div className="print-questions-container space-y-4"> {testQuestions.map((qToPrint, index) => { const answerLogForPrint = answersLog.find(a => a.questionId === qToPrint.id); return ( <Card key={`review-q-${qToPrint.id}`} className={cn("bg-card p-4 md:p-6 rounded-lg shadow-md border border-border print-question-item print:shadow-none print:border-gray-300", (currentReviewQuestionIndex !== index && "hidden print:block"))}> <div className="flex justify-between items-center mb-3"><h3 className="text-lg font-semibold text-primary">Question {index + 1}:</h3><div className="flex items-center gap-2 print:hidden"><span className="text-xs text-muted-foreground flex items-center"><Clock className="h-3.5 w-3.5 mr-1"/> {formatDetailedDuration(answerLogForPrint?.timeSpentSeconds)}</span><Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-destructive p-1 h-auto" onClick={() => openReportModal(qToPrint.id)}><ReportIcon className="h-3.5 w-3.5 mr-1"/> Report</Button><Button variant="ghost" size="sm" onClick={handleOpenBookmarkModal} className="text-xs text-muted-foreground hover:text-primary p-1 h-auto"><BookmarkIcon className={cn("h-3.5 w-3.5 mr-1", "text-muted-foreground")} />Bookmark</Button></div></div> <div className="prose prose-sm dark:prose-invert max-w-none mb-4 text-foreground leading-relaxed">{renderLatex(qToPrint.questionText)}</div> {qToPrint.questionImageUrl && <div className="my-4 text-center"><NextImage src={qToPrint.questionImageUrl} alt="Question Image" width={400} height={300} className="rounded object-contain inline-block border max-h-80 print:max-w-xs print:max-h-60" data-ai-hint="question diagram"/></div>} {!(qToPrint.questionText || qToPrint.questionImageUrl) && <p className="text-sm text-muted-foreground italic py-4">No question text or image provided.</p>} <div className="space-y-3 mt-6"> {qToPrint.options.map(optChar => { const isSelected = answerLogForPrint?.selectedOption === `Option ${optChar.label}`; const isCorrectDbOption = qToPrint.correctOptionEnum === optChar.label; let optionBgClass = "bg-card hover:bg-muted/30 print:bg-white"; let optionBorderClass = "border-border print:border-gray-300"; let answerIndicator: React.ReactNode = null; let optionTextColor = "text-foreground print:text-black"; if (isCorrectDbOption) { optionBgClass = "bg-green-500/10 dark:bg-green-700/20 print:bg-green-100"; optionBorderClass = "border-green-500/50 dark:border-green-600/50 print:border-green-400"; optionTextColor = "text-green-700 dark:text-green-400 print:text-green-700"; answerIndicator = <Badge className="ml-auto text-xs bg-green-600 text-white px-2 py-0.5 print:bg-green-600 print:text-white">Correct Answer</Badge>; } if (isSelected) { if (answerLogForPrint?.isCorrect) answerIndicator = (<div className="ml-auto flex items-center gap-2"><Badge variant="outline" className="text-xs border-green-500 text-green-600 bg-transparent px-2 py-0.5 print:border-green-500 print:text-green-600">Your Answer</Badge><Badge className="text-xs bg-green-600 text-white px-2 py-0.5 print:bg-green-600 print:text-white">Correct Answer</Badge></div>); else { optionBgClass = "bg-red-500/10 dark:bg-red-700/20 print:bg-red-100"; optionBorderClass = "border-red-500/50 dark:border-red-600/50 print:border-red-400"; optionTextColor = "text-red-700 dark:text-red-400 print:text-red-700"; answerIndicator = (<div className="ml-auto flex items-center gap-2"><Badge variant="outline" className="text-xs border-red-500 text-red-600 bg-transparent px-2 py-0.5 print:border-red-500 print:text-red-600">Your Answer</Badge><Badge className="text-xs bg-red-600 text-white px-2 py-0.5 print:bg-red-600 print:text-white">Wrong Answer</Badge></div>); }} return (<div key={optChar.label} className={cn("p-3 border rounded-md transition-all flex items-start gap-3", optionBgClass, optionBorderClass)}> <span className={cn("font-semibold", isCorrectDbOption ? "text-green-700 dark:text-green-300 print:text-green-700" : "text-primary print:text-blue-600")}>{optChar.label}.</span> <div className={cn("flex-1 text-sm", optionTextColor)}> {(optChar.text || optChar.imageUrl) ? (<>{optChar.text && <div className={cn("prose prose-sm dark:prose-invert max-w-none")}>{renderLatex(optChar.text)}</div>}{optChar.imageUrl && <div className="mt-1.5"><NextImage src={optChar.imageUrl} alt={`Option ${optChar.label}`} width={150} height={90} className="rounded object-contain border print:max-w-[100px] print:max-h-[60px]" data-ai-hint="option diagram"/></div>}</>) : (<p className="italic">Option {optChar.label} content not available.</p>)} </div>{answerIndicator}</div>); })} </div> {(qToPrint.explanationText || qToPrint.explanationImageUrl) && <div className="mt-6 pt-4 border-t print:pt-2 print:mt-2"><h4 className="text-md font-semibold text-muted-foreground mb-2 print:text-sm">Explanation:</h4>{qToPrint.explanationText && <div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed print:text-xs">{renderLatex(qToPrint.explanationText)}</div>}{qToPrint.explanationImageUrl && <div className="my-3 text-center"><NextImage src={qToPrint.explanationImageUrl} alt="Explanation Image" width={300} height={200} className="rounded object-contain inline-block border max-h-72 print:max-w-xs print:max-h-52" data-ai-hint="explanation diagram"/></div>}</div>} {!(qToPrint.explanationText || qToPrint.explanationImageUrl) && <p className="text-sm text-muted-foreground mt-4 text-center italic">No explanation available for this question.</p>} </Card> ); })} </div> <div className="flex justify-between items-center mt-4 print:hidden"><Button variant="outline" onClick={() => setCurrentReviewQuestionIndex(prev => Math.max(0, prev - 1))} disabled={currentReviewQuestionIndex === 0}><ChevronLeft className="mr-2 h-4 w-4" /> Previous</Button><Button variant="outline" onClick={() => setCurrentReviewQuestionIndex(prev => Math.min(testQuestions.length - 1, prev + 1))} disabled={currentReviewQuestionIndex === testQuestions.length - 1}><ChevronRight className="ml-2 h-4 w-4" /> Next</Button></div> </> ) : <p className="text-center text-muted-foreground py-10 print:hidden">Select a question from the palette above to review.</p> )}
        <div className="mt-8 text-center print:hidden"><Link href={Routes.myProgress} passHref><Button variant="outline" size="lg"><LayoutDashboard className="mr-2 h-5 w-5" /> Back to My Progress</Button></Link></div>
      </main>
      <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}><DialogContent><DialogHeader><DialogTitle>Report Question {currentReviewQuestionIndex + 1}</DialogTitle><DialogDescription>Please let us know what's wrong.</DialogDescription></DialogHeader><Form {...reportForm}><form onSubmit={reportForm.handleSubmit(handleReportSubmit)} className="space-y-4"><FormField control={reportForm.control} name="TypeOfError" render={({ field }) => (<FormItem><FormLabel>Type of Error</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select error type" /></SelectTrigger></FormControl><SelectContent>{ReportErrorTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/> <FormField control={reportForm.control} name="Please_write_your_report_here" render={({ field }) => (<FormItem><FormLabel>Details (Optional)</FormLabel><FormControl><Textarea placeholder="Provide more details..." {...field} value={field.value ?? ''} rows={3}/></FormControl><FormMessage /></FormItem>)}/> <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={reportForm.formState.isSubmitting}>{reportForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit Report</Button></DialogFooter></form></Form></DialogContent></Dialog>
      <Dialog open={isBookmarkModalOpen} onOpenChange={setIsBookmarkModalOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Add to Notebooks</DialogTitle><DialogDescription>Select notebook(s).</DialogDescription></DialogHeader> {isLoadingUserNotebooks ? <div className="flex justify-center items-center h-32"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div> : userNotebooks.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No notebooks. <Link href={Routes.notebooks} className="text-primary hover:underline">Create one!</Link></p> : ( <ScrollArea className="max-h-60 my-4"><div className="space-y-2 pr-2">{userNotebooks.map(nb => (<div key={nb.id} className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50"> <Checkbox id={`nb-${nb.id}`} checked={selectedNotebookIdsInModal.has(nb.id)} onCheckedChange={() => handleToggleNotebookSelection(nb.id)}/> <label htmlFor={`nb-${nb.id}`} className="text-sm font-medium leading-none flex-1 cursor-pointer">{nb.notebook_name}</label><Badge variant="outline" className="text-xs">{nb.questionCount || 0} Qs</Badge> </div>))}</div></ScrollArea> )} <Button type="button" variant="outline" size="sm" className="w-full justify-start text-primary hover:text-primary/90" onClick={() => router.push(Routes.notebooks)}><PlusCircle className="mr-2 h-4 w-4"/> Create New Notebook</Button> <div className="mt-4 pt-4 border-t"><p className="text-sm font-medium mb-2 text-muted-foreground">Add tags (optional):</p><div className="flex flex-wrap gap-2">{PREDEFINED_TAGS.map(tag => (<Button key={tag} variant="outline" size="sm" className="text-xs" onClick={() => toast({title: "Tagging coming soon!", description: `Selected tag: ${tag}`})}>{tag}</Button>))}</div><p className="text-xs text-muted-foreground mt-2">Tags apply to this question in selected notebooks.</p></div> <DialogFooter className="mt-4"><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button onClick={handleSaveToNotebooks} disabled={selectedNotebookIdsInModal.size === 0 || isLoadingUserNotebooks}>Save</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}

