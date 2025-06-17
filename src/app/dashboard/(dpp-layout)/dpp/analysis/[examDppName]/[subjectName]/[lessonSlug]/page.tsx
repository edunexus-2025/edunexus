
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
  proctoring_flags: string;
}

interface DppAttemptRecord extends RecordModel {
  user: string;
  subject: string;
  lessonName: string;
  attemptDate: string; // ISO String
  questionsAttempted: string | AnswerLogItem[]; // JSON string from DB, parsed to array
  score: number;
  totalQuestions: number;
  correct?: boolean;
  timeTakenSeconds?: number;
  solvedhistory?: number;
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
}

interface TestPagesRecord extends RecordModel {
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
  if (record && record[fieldName] && record.collectionId && record.collectionName) {
    try {
      return pb.files.getUrl(record, record[fieldName] as string);
    } catch (e) {
      console.warn(`Error getting URL for ${fieldName} in record ${record.id}:`, e);
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

interface StatsData {
  correct: number;
  incorrect: number;
  attempted: number;
  unattempted: number;
  totalQuestionsInDpp: number;
  accuracy: number;
}


export default function DppLessonAnalysisPage() {
  const params = useParams();
  const router = useRouter();
  
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const examDppNameParam = typeof params.examDppName === 'string' ? params.examDppName : '';
  const subjectNameParam = typeof params.subjectName === 'string' ? params.subjectName : '';
  const lessonSlugParam = typeof params.lessonSlug === 'string' ? params.lessonSlug : '';

  const [examSlugState, setExamSlugState] = useState('');
  const [subjectSlugState, setSubjectSlugState] = useState('');
  const [lessonSlugState, setLessonSlugState] = useState('');

  const [resultData, setResultData] = useState<ChapterwiseResultRecord | null>(null);
  const [testPageRecord, setTestPageRecord] = useState<TestPagesRecord | null>(null);
  const [testQuestions, setTestQuestions] = useState<QuestionBankRecord[]>([]);
  const [answersLog, setAnswersLog] = useState<AnswerLogItem[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
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
    defaultValues: {
      TypeOfError: undefined,
      Please_write_your_report_here: "",
    },
  });

  const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState(false);
  const [userNotebooks, setUserNotebooks] = useState<StudentBookmark[]>([]);
  const [isLoadingUserNotebooks, setIsLoadingUserNotebooks] = useState(false);
  const [selectedNotebookIdsInModal, setSelectedNotebookIdsInModal] = useState<Set<string>>(new Set());

  const [examDisplayName, setExamDisplayName] = useState<string>('');
  const [subjectDisplayName, setSubjectDisplayName] = useState<string>('');
  const [lessonDisplayName, setLessonDisplayName] = useState<string>('');

  useEffect(() => {
    setExamSlugState(examDppNameParam);
    setSubjectSlugState(subjectNameParam);
    setLessonSlugState(lessonSlugParam);
  }, [examDppNameParam, subjectNameParam, lessonSlugParam]);


  const fetchUserNotebooks = useCallback(async () => {
    if (!user?.id) {
      setUserNotebooks([]); 
      setIsLoadingUserNotebooks(false);
      return;
    }
    setIsLoadingUserNotebooks(true);
    try {
      const userId = user.id; 
      if (!userId || typeof userId !== 'string' || !userId.trim()) {
          console.error("User ID is invalid for notebook fetch:", userId);
          throw new Error("Invalid user ID for fetching notebooks.");
      }
      const filter = `user = "${userId}" && archived = false`;
      console.log("Fetching user notebooks with filter:", filter); 

      const records = await pb.collection('student_bookmarks').getFullList<StudentBookmark>({
        filter: filter,
        sort: '-updated',
      });
      setUserNotebooks(records.map(r => ({
        ...r,
        questionCount: Array.isArray(r.questions) ? r.questions.length : 0,
      })));
    } catch (err: any) {
      let detailedMessage = 'Unknown error during notebook fetch.';
      let errorForConsole: any = err; 
      if (err instanceof Error) { detailedMessage = err.message; }
      if (err && typeof err === 'object') {
        if ('isAbort' in err && err.isAbort) { detailedMessage = 'Request cancelled.'; setIsLoadingUserNotebooks(false); return; }
        if ('name' in err && err.name === 'ClientResponseError' && 'status' in err && err.status === 0) { detailedMessage = 'Network issue or request cancelled.'; setIsLoadingUserNotebooks(false); return; }
        if ('response' in err && typeof err.response === 'object' && err.response !== null && 'data' in err.response) {
          const responseData = err.response.data; errorForConsole = responseData; 
          if (responseData && typeof responseData === 'object') {
            detailedMessage = (responseData as any).message || JSON.stringify((responseData as any).data) || 'Server error with no specific message.';
            if ((responseData as any).data && typeof (responseData as any).data === 'object' && Object.keys((responseData as any).data).length > 0) {
                const fieldErrors = Object.entries((responseData as any).data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
                detailedMessage += ` Details: ${fieldErrors}`;
            }
          } else if ((err.response as any).message) { detailedMessage = (err.response as any).message; }
        } else if ('message' in err && typeof err.message === 'string') { detailedMessage = err.message; }
      }
      console.error("Failed to fetch user notebooks. Error details logged:", errorForConsole);
      toast({ title: "Error Fetching Notebooks", description: `Could not load your notebooks. ${detailedMessage}`, variant: "destructive", duration: 9000 });
      setUserNotebooks([]);
    } finally {
      setIsLoadingUserNotebooks(false);
    }
  }, [user?.id, toast]);

  const handleOpenBookmarkModal = () => {
    if (currentReviewQuestion) {
      fetchUserNotebooks(); setSelectedNotebookIdsInModal(new Set()); setIsBookmarkModalOpen(true);
    }
  };

  const handleToggleNotebookSelection = (notebookId: string) => {
    setSelectedNotebookIdsInModal(prev => { const newSet = new Set(prev); if (newSet.has(notebookId)) newSet.delete(notebookId); else newSet.add(notebookId); return newSet; });
  };

  const handleSaveToNotebooks = async () => {
    if (!currentReviewQuestion || !user?.id || selectedNotebookIdsInModal.size === 0) {
      toast({ title: "No Selection", description: "Please select at least one notebook.", variant: "default" }); return;
    }
    const questionIdToAdd = currentReviewQuestion.id; let successCount = 0; let errorCount = 0;
    for (const notebookId of Array.from(selectedNotebookIdsInModal)) {
      try {
        const notebook = await pb.collection('student_bookmarks').getOne<StudentBookmark>(notebookId);
        const existingQuestions = Array.isArray(notebook.questions) ? notebook.questions : [];
        if (!existingQuestions.includes(questionIdToAdd)) {
          await pb.collection('student_bookmarks').update(notebookId, { "questions+": questionIdToAdd });
        } successCount++;
      } catch (err) { errorCount++; console.error(`Failed to add question to notebook ${notebookId}:`, err); }
    }
    if (successCount > 0) toast({ title: "Bookmarked!", description: `Question added to ${successCount} notebook(s).` });
    if (errorCount > 0) toast({ title: "Error Bookmarking", description: `Failed to add question to ${errorCount} notebook(s).`, variant: "destructive" });
    setIsBookmarkModalOpen(false);
  };

  const fetchPerformanceData = useCallback(async (isMountedGetter: () => boolean) => {
    if (!examSlugState || !subjectSlugState || !lessonSlugState) {
        if(isMountedGetter()) {
            setError("Route parameters are not yet available.");
            setIsLoading(false);
        }
        return;
    }

    const currentExamOption = DPP_EXAM_OPTIONS.find(opt => opt.slug === examSlugState);
    const currentExamNameForFilter = currentExamOption?.name || '';
    const currentSubjectNameForFilter = unslugify(subjectSlugState).trim();
    const currentLessonNameForFilter = unslugify(lessonSlugState).trim();
    
    console.log(`DPP Analysis URL Params: examSlug='${examSlugState}', subjectSlug='${subjectSlugState}', lessonSlug='${lessonSlugState}'`);
    console.log(`DPP Analysis Derived Filters: examName='${currentExamNameForFilter}', subjectName='${currentSubjectNameForFilter}', lessonName='${currentLessonNameForFilter}'`);


    if (isMountedGetter()) {
      setExamDisplayName(currentExamOption?.name || (examSlugState === 'combined' ? 'Combined DPPs' : 'Unknown Exam'));
      setSubjectDisplayName(currentSubjectNameForFilter);
      setLessonDisplayName(currentLessonNameForFilter);
    }

    if (!user?.id || !currentLessonNameForFilter || !currentSubjectNameForFilter) {
      if (isMountedGetter()) {
        setError("User not logged in or lesson/subject details are invalid/missing after processing.");
        setIsLoading(false);
      }
      return;
    }
    if(isMountedGetter()) setIsLoading(true);

    try {
      const dppQuestionFilterParts = [ `pyq = false`, `subject = "${escapeForPbFilter(currentSubjectNameForFilter)}"`, `lessonName = "${escapeForPbFilter(currentLessonNameForFilter)}"` ];
      if (examSlugState !== 'combined' && currentExamNameForFilter) dppQuestionFilterParts.push(`ExamDpp = "${escapeForPbFilter(currentExamNameForFilter)}"`);
      const dppQuestionFilter = dppQuestionFilterParts.join(' && ');
      if (!isMountedGetter()) return;
      
      console.log("DPP Analysis: Fetching questions from 'question_bank' with filter:", dppQuestionFilter);
      const allDppQuestions = await pb.collection('question_bank').getFullList<QuestionBankRecord>({ filter: dppQuestionFilter, fields: 'id,subject,difficulty', requestKey: null });
      const totalQuestionsInDpp = allDppQuestions.length;
      if (!isMountedGetter()) return;
      console.log(`DPP Analysis: Found ${totalQuestionsInDpp} questions for this DPP criteria from 'question_bank'.`);


      console.log(`DPP Analysis: Fetching ALL dpp_attempts for user: ${user.id} with filter: user = "${user.id}"`);
      
      const allUserAttemptRecords = await pb.collection('dpp_attempts').getFullList<DppAttemptRecord>({
        filter: `user = "${user.id}"`,
        requestKey: null, 
      });

      if (!isMountedGetter()) return;
      console.log(`DPP Analysis: Fetched ${allUserAttemptRecords.length} total attempts for user ${user.id}.`);
      
      const relevantAttemptsForThisDpp = allUserAttemptRecords
        .filter(attempt => {
          const attemptLesson = attempt.lessonName ? attempt.lessonName.trim().toLowerCase() : '';
          const attemptSubject = attempt.subject ? attempt.subject.trim().toLowerCase() : '';
          const filterLessonLower = currentLessonNameForFilter.toLowerCase();
          const filterSubjectLower = currentSubjectNameForFilter.toLowerCase();
          return attemptLesson === filterLessonLower && attemptSubject === filterSubjectLower;
        })
        .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()); 
      
      const latestAttempt = relevantAttemptsForThisDpp.length > 0 ? relevantAttemptsForThisDpp[0] : null;
      
      console.log(`DPP Analysis: Found ${relevantAttemptsForThisDpp.length} relevant attempts for DPP: ${currentLessonNameForFilter} / ${currentSubjectNameForFilter}.`);
      if (latestAttempt) {
        console.log("DPP Analysis: Using latest relevant attempt ID:", latestAttempt.id, "created:", latestAttempt.created, "Raw questionsAttempted data:", latestAttempt.questionsAttempted);
      } else {
         console.log("DPP Analysis: No matching attempt found for this lesson/subject after fetching and client-side filtering user's attempts.");
          if (allUserAttemptRecords.length > 0) {
            console.log("DPP Analysis: Sample of all user attempts (to help debug mismatch):");
            allUserAttemptRecords.slice(0, 3).forEach(att => {
              console.log(`  - Attempt ID: ${att.id}, Lesson: '${att.lessonName}', Subject: '${att.subject}', Created: ${att.created}`);
            });
          } else {
            console.log("DPP Analysis: The 'allUserAttemptRecords' array was empty before filtering for this specific DPP. This could be due to API rules on 'dpp_attempts' or no attempts made by the user.");
          }
      }


      if (!latestAttempt) {
        if(isMountedGetter()) {
          setStats({ correct: 0, incorrect: 0, attempted: 0, unattempted: totalQuestionsInDpp, totalQuestionsInDpp: totalQuestionsInDpp, accuracy: 0 });
          setTestQuestions(allDppQuestions.map(q => ({...q, displayQuestionImageUrl: getPbFileUrl(q, 'questionImage')})));
          setAnswersLog([]); 
        } 
        return;
      }
      
      let parsedAnswers: AnswerLogItem[] = [];
      if (latestAttempt && latestAttempt.questionsAttempted) {
        if (typeof latestAttempt.questionsAttempted === 'string') {
          try {
            const parsed = JSON.parse(latestAttempt.questionsAttempted);
            if (Array.isArray(parsed)) {
              parsedAnswers = parsed;
            } else if (typeof parsed === 'object' && parsed !== null) { 
              parsedAnswers = [parsed as AnswerLogItem];
            } else {
              console.warn("DPP Analysis: Parsed questionsAttempted is not an array or object:", parsed);
            }
          } catch (e) {
            console.error("DPP Analysis: Failed to parse questionsAttempted JSON:", e, "Value was:", latestAttempt.questionsAttempted);
            if (isMountedGetter()) setError("Error reading your attempt data (JSON parsing failed).");
            return; 
          }
        } else if (Array.isArray(latestAttempt.questionsAttempted)) {
          parsedAnswers = latestAttempt.questionsAttempted as AnswerLogItem[];
        } else {
           console.warn("DPP Analysis: questionsAttempted is neither a string nor an array, defaulting to empty. Value:", latestAttempt.questionsAttempted);
        }
      }
      if (!Array.isArray(parsedAnswers)) { 
          console.warn("DPP Analysis: parsedAnswers was not an array after processing, defaulting to empty. Initial type:", typeof latestAttempt.questionsAttempted);
          parsedAnswers = [];
      }
      
      if(isMountedGetter()) setAnswersLog(parsedAnswers);
      console.log("DPP Analysis: Parsed answers log for latest attempt:", JSON.stringify(parsedAnswers, null, 2));

      const correct = parsedAnswers.filter(a => a.isCorrect).length;
      const attempted = parsedAnswers.filter(a => a.selectedOption !== null).length;
      const incorrect = attempted - correct;
      const unattempted = totalQuestionsInDpp - attempted;
      const accuracy = attempted > 0 ? (correct / attempted) * 100 : 0;
      
      console.log("DPP Analysis: Calculated Stats from latest attempt log:", { correct, incorrect, attempted, unattempted, totalQuestionsInDpp, accuracy });


      if(isMountedGetter()) setStats({ correct, incorrect, attempted, unattempted, totalQuestionsInDpp, accuracy });

      const questionIdsFromLog = parsedAnswers.map(a => a.questionId);
      const allQuestionIdsForDisplay = Array.from(new Set([...allDppQuestions.map(q => q.id), ...questionIdsFromLog]));

      if (allQuestionIdsForDisplay.length > 0) {
          const questionDetailsPromises = allQuestionIdsForDisplay.map(id => 
              pb.collection('question_bank').getOne<QuestionBankRecord>(id).catch(err => {
                  console.warn(`DPP Analysis: Failed to fetch details for question ${id}:`, err);
                  return null;
              })
          );
          const fetchedQuestionDetails = (await Promise.all(questionDetailsPromises)).filter(q => q !== null) as QuestionBankRecord[];
          const questionsWithImageUrls = fetchedQuestionDetails.map(q => ({
            ...q,
            displayQuestionImageUrl: getPbFileUrl(q, 'questionImage'),
            displayOptionAImageUrl: getPbFileUrl(q, 'optionAImage'),
            displayOptionBImageUrl: getPbFileUrl(q, 'optionBImage'),
            displayOptionCImageUrl: getPbFileUrl(q, 'optionCImage'),
            displayOptionDImageUrl: getPbFileUrl(q, 'optionDImage'),
            displayExplanationImageUrl: getPbFileUrl(q, 'explanationImage'),
          }));
          if(isMountedGetter()) setTestQuestions(questionsWithImageUrls);

            const diffStats: { Easy: DifficultyStats; Medium: DifficultyStats; Hard: DifficultyStats } = {
                Easy: { attempted: 0, correct: 0, total: 0 },
                Medium: { attempted: 0, correct: 0, total: 0 },
                Hard: { attempted: 0, correct: 0, total: 0 },
            };
            const subjPerformanceMap: Record<string, Omit<SubjectPerformance, 'name' | 'accuracy'>> = {};

            for (const q of questionsWithImageUrls) {
                const dppQuestionSource = allDppQuestions.find(dppQ => dppQ.id === q.id);
                const difficulty = q.difficulty || dppQuestionSource?.difficulty; 
                const subject = q.subject || dppQuestionSource?.subject || 'Uncategorized';

                if (difficulty) diffStats[difficulty].total++;
                
                if (!subjPerformanceMap[subject]) {
                  subjPerformanceMap[subject] = { correct: 0, attempted: 0, total: 0 };
                }
                subjPerformanceMap[subject].total++;

                const loggedAnswer = parsedAnswers.find(a => a.questionId === q.id);
                if (loggedAnswer && loggedAnswer.selectedOption) {
                  if (difficulty) diffStats[difficulty].attempted++;
                  subjPerformanceMap[subject].attempted++;
                  if (loggedAnswer.isCorrect) {
                    if (difficulty) diffStats[difficulty].correct++;
                    subjPerformanceMap[subject].correct++;
                  }
                }
            }
            if(isMountedGetter()) setDifficultyStats(diffStats);
            const finalSubjPerformance = Object.entries(subjPerformanceMap).map(([name, statsData]) => ({
                name, ...statsData, accuracy: statsData.attempted > 0 ? (statsData.correct / statsData.attempted) * 100 : 0,
            }));
            if(isMountedGetter()) setSubjectPerformance(finalSubjPerformance);
      }

    } catch (err: any) {
      if (!isMountedGetter()) return;
      const clientError = err as ClientResponseError;
      let errorMsg = "Could not load performance data.";
      
      console.error("DPP Analysis: Error fetching performance data. Full ClientResponseError:", JSON.stringify(clientError, null, 2));

      if (clientError.isAbort || (clientError.name === 'ClientResponseError' && clientError.status === 0)) {
        console.warn('DPP Analysis: Fetch request was cancelled or failed due to client-side/network issue.');
        errorMsg = "Request cancelled. Please try refreshing.";
      } else {
        const pbErrorData = clientError.data?.data;
        let specificFieldErrors = "";
        if (pbErrorData && typeof pbErrorData === 'object') {
          specificFieldErrors = Object.entries(pbErrorData).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
        }
        errorMsg = `Error Status ${clientError.status}: ${clientError.data?.message || clientError.message || 'Unknown error'}. ${specificFieldErrors ? `Details: ${specificFieldErrors}` : ''}`;
      }
      if(isMountedGetter()) setError(errorMsg);
      toast({ title: "Error Loading Data", description: errorMsg, variant: "destructive", duration: 9000 });
    } finally {
      if(isMountedGetter()) setIsLoading(false);
    }
  }, [user?.id, examSlugState, subjectSlugState, lessonSlugState, toast, unslugify, escapeForPbFilter]);

  useEffect(() => {
    let isMounted = true; const isMountedGetter = () => isMounted;
    if (!isAuthLoading && examSlugState && subjectSlugState && lessonSlugState) {
      fetchPerformanceData(isMountedGetter);
    } else if (!isAuthLoading && (!examSlugState || !subjectSlugState || !lessonSlugState)) {
        if (isMountedGetter()) {
            setIsLoading(false); 
        }
    }
    
    let unsubDppAttempts: (() => void) | undefined;
    (async () => {
        if(!isMountedGetter()) return;
        if (user?.id) {
            try {
                unsubDppAttempts = await pb.collection('dpp_attempts').subscribe('*', (e) => {
                    if (isMountedGetter() && (e.action === 'create' || e.action === 'update')) {
                        if (e.record.user === user.id && 
                            e.record.lessonName === unslugify(lessonSlugState) && 
                            e.record.subject === unslugify(subjectSlugState)) {
                           console.log("DPP Analysis: dpp_attempts subscription triggered, re-fetching performance data for user:", user.id, "lesson:", unslugify(lessonSlugState), "subject:", unslugify(subjectSlugState));
                           fetchPerformanceData(isMountedGetter);
                        } else {
                           console.log("DPP Analysis: dpp_attempts subscription event for other user/DPP, ignoring. Event user:", e.record.user, "Event lesson:", e.record.lessonName);
                        }
                    }
                });
            } catch (subError) {
                console.warn("DPP Analysis: Failed to subscribe to dpp_attempts:", subError);
            }
        }
    })();
    
    return () => { 
        isMounted = false; 
        if (unsubDppAttempts) unsubDppAttempts();
    };
  }, [isAuthLoading, examSlugState, subjectSlugState, lessonSlugState, user?.id, fetchPerformanceData, unslugify]);


  const chartData = stats ? [
    { name: "Correct", value: stats.correct, fill: "hsl(var(--chart-1))" }, 
    { name: "Incorrect", value: stats.incorrect, fill: "hsl(var(--chart-2))" }, 
    { name: "Unattempted", value: stats.unattempted < 0 ? 0 : stats.unattempted, fill: "hsl(var(--chart-3))" }, 
  ] : [];

  const donutChartConfig = {
    value: { label: "Questions" },
    Correct: { label: "Correct", color: "hsl(var(--chart-1))" },
    Incorrect: { label: "Incorrect", color: "hsl(var(--chart-2))" },
    Unattempted: { label: "Unattempted", color: "hsl(var(--chart-3))" },
  } satisfies ChartConfig;

  const getQuestionStatusColor = (questionId: string, isActive: boolean): string => {
    const log = answersLog.find(a => a.questionId === questionId);
    if (isActive) return "bg-primary text-primary-foreground border-primary ring-2 ring-offset-1 ring-primary";
    if (!log || !log.selectedOption) return log?.markedForReview ? "bg-purple-500 hover:bg-purple-600 text-white" : "bg-muted hover:bg-muted/80 text-muted-foreground";
    if (log.isCorrect) return "bg-green-500 hover:bg-green-600 text-white";
    if (!log.isCorrect) return log.markedForReview ? "bg-yellow-400 hover:bg-yellow-500 text-black" : "bg-red-500 hover:bg-red-600 text-white";
    return "bg-muted hover:bg-muted/80 text-muted-foreground"; 
  };

  const handleReportSubmit = async (data: ReportInput) => {
    if (!user || !reportingQuestionId || !resultData?.test_id) { 
        toast({ title: "Error", description: "Missing user, question, or context information for report.", variant: "destructive" }); return;
    }
    try {
        const contextIdForReport = resultData?.test_id || stats?.totalQuestionsInDpp ? `dpp_set_${lessonDisplayName.replace(/\s+/g, '_')}` : 'dpp_context_not_available';


        await pb.collection('report_by_students').create({
            user: user.id, question: reportingQuestionId, test_in_which_report_is_made: contextIdForReport,
            TypeOfError: data.TypeOfError, Please_write_your_report_here: data.Please_write_your_report_here || null,
        });
        toast({ title: "Report Submitted", description: "Thank you for your feedback!" });
        setIsReportModalOpen(false); reportForm.reset();
    } catch (err: any) { toast({ title: "Error Submitting Report", description: err.data?.message || err.message, variant: "destructive" }); }
  };

  const openReportModal = (questionId: string) => { setReportingQuestionId(questionId); setIsReportModalOpen(true); };

  if (isLoading || isAuthLoading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Skeleton className="h-8 w-3/4" /> <Skeleton className="h-6 w-1/2 mb-4" />
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div> <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-4 md:p-6 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-destructive mb-2">Error Loading Analysis</h2>
        <p className="text-muted-foreground mb-4 whitespace-pre-wrap">{error}</p>
        <Button onClick={() => router.back()} variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
      </div>
    );
  }
  if (!stats) {
    return (
      <div className="p-4 md:p-6 text-center">
        <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Attempt Data Found</h2>
        <p className="text-muted-foreground mb-1">It seems you haven&apos;t attempted this DPP lesson yet, or there was an issue loading your progress.</p>
        <p className="text-xs text-muted-foreground mb-4">If you expect to see data, please check your browser&apos;s developer console for diagnostic logs. These logs may help identify discrepancies in lesson/subject names. (Look for logs starting with &quot;DPP Analysis:&quot;).</p>
        <Button onClick={() => router.push(Routes.dppExamSubjectLessonQuestions(examSlugState, subjectSlugState, lessonSlugState))} variant="default">Go to DPP Questions</Button>
      </div>
    );
  }

  const currentReviewQuestion = testQuestions[currentReviewQuestionIndex];
  const currentReviewAnswerLog = currentReviewQuestion ? answersLog.find(a => a.questionId === currentReviewQuestion.id) : null;
  const formatDetailedDuration = (totalSeconds: number): string => {
    if (totalSeconds < 0) totalSeconds = 0;
    const minutes = Math.floor(totalSeconds / 60); const seconds = totalSeconds % 60;
    return `${minutes} Min ${seconds} Sec`;
  };
  
  const statCardsData = stats ? [
    { title: "CORRECT / ATTEMPTED", value: stats.attempted > 0 ? `${stats.correct} / ${stats.attempted}` : '0 / 0', icon: <CheckCircle className="h-5 w-5 text-green-500" /> },
    { title: "INCORRECT / ATTEMPTED", value: stats.attempted > 0 ? `${stats.incorrect} / ${stats.attempted}` : '0 / 0', icon: <XCircle className="h-5 w-5 text-red-500" /> },
    { title: "OVERALL SCORE / TOTAL", value: `${stats.correct} / ${stats.totalQuestionsInDpp}`, icon: <ClipboardList className="h-5 w-5 text-blue-500" /> },
    { title: "ACCURACY", value: `${stats.accuracy.toFixed(1)}%`, icon: <TargetIcon className="h-5 w-5 text-green-500" /> },
  ] : [];


  return (
    <div className="min-h-screen bg-muted/30 dark:bg-slate-950">
      <header className="bg-background shadow-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            <Link href={Routes.home} className="hover:text-primary">Home</Link> &gt; 
            <Link href={Routes.dpp} className="hover:text-primary"> DPP</Link> &gt; 
            <Link href={Routes.dppExamSubjects(examSlugState)} className="hover:text-primary"> {examDisplayName}</Link> &gt; 
            <Link href={Routes.dppExamSubjectLessons(examSlugState, subjectSlugState)} className="hover:text-primary"> {subjectDisplayName}</Link> &gt; 
            <Link href={Routes.dppExamSubjectLessonQuestions(examSlugState, subjectSlugState, lessonSlugState)} className="hover:text-primary"> {lessonDisplayName}</Link> &gt; 
            <span className="text-foreground font-medium"> Analysis</span>
          </div>
           <Button onClick={() => setActiveTab(activeTab === "summary" ? "review" : "summary")} variant="default" size="sm">
             <Eye className="mr-2 h-4 w-4"/>{activeTab === "summary" ? "View Solution" : "View Summary"}
           </Button>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-6 space-y-6">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground">Performance Analysis: {lessonDisplayName}</h2>
        
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
                <Card className="shadow-md">
                    <CardHeader className="items-center text-center pb-2"><CardTitle className="text-md font-medium">Overview</CardTitle><CardDescription className="text-xs">Breakdown of your performance</CardDescription></CardHeader>
                    <CardContent className="h-[200px] flex items-center justify-center p-0">
                      {(stats.attempted === 0 && stats.unattempted === 0 && stats.totalQuestionsInDpp === 0) ? <p className="text-muted-foreground text-sm">No questions/data.</p> : (
                        <ChartContainer config={donutChartConfig} className="aspect-square h-full w-full max-w-[250px] mx-auto">
                          <PieChart>
                            <Tooltip content={<ChartTooltipContent hideLabel nameKey="name" />} />
                            <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={75} strokeWidth={2}>
                              {chartData.map((entry) => ( <Cell key={`cell-${entry.name}`} fill={entry.fill} /> ))}
                            </Pie>
                          </PieChart>
                        </ChartContainer>
                      )}
                    </CardContent><CardFooter className="text-xs text-muted-foreground text-center block pt-2 pb-4">Hover over chart for details.</CardFooter>
                </Card>
              </div>
               <Card className="lg:col-span-2 shadow-md">
                  <CardHeader><CardTitle className="text-md font-medium">Performance by Difficulty</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {(['Easy', 'Medium', 'Hard'] as const).map(level => {
                      const difficultyData = difficultyStats ? difficultyStats[level] : { attempted: 0, correct: 0, total: 0 };
                      const accuracy = difficultyData.attempted > 0 ? (difficultyData.correct / difficultyData.attempted) * 100 : 0;
                      let indicatorColorClass = 'bg-primary'; 
                      if (level === 'Easy') indicatorColorClass = 'bg-green-500'; else if (level === 'Medium') indicatorColorClass = 'bg-yellow-500'; else if (level === 'Hard') indicatorColorClass = 'bg-red-500';
                      return (
                        <div key={level} className="p-2.5 rounded-md border border-border bg-card">
                          <div className="flex justify-between items-center mb-1"><span className="font-semibold text-sm">{level}</span><Badge variant="outline" className="text-xs px-1.5 py-0.5">{difficultyData.correct}/{difficultyData.attempted} Correct (Out of {difficultyData.total} Total)</Badge></div>
                          <div className="flex items-center gap-2"><Progress value={accuracy} className="h-1.5 flex-grow bg-muted/50" indicatorClassName={indicatorColorClass} /><span className="text-xs font-medium">{accuracy.toFixed(1)}% Acc.</span></div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
            </div>
        )}

        {activeTab === "review" && (
            testQuestions.length > 0 && currentReviewQuestion ? (
              <>
                <Card className="mb-4 shadow-sm bg-card">
                  <CardHeader className="p-3"><CardTitle className="text-sm font-medium text-center text-muted-foreground">Questions</CardTitle></CardHeader>
                  <CardContent className="p-2"><ScrollArea className="h-auto max-h-28"><div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-15 xl:grid-cols-20 gap-1.5 p-1">
                    {testQuestions.map((q, index) => (<Button key={q.id} variant="outline" size="icon" className={cn("h-7 w-7 text-xs rounded-md transition-all duration-150 ease-in-out", getQuestionStatusColor(q.id, currentReviewQuestionIndex === index))} onClick={() => setCurrentReviewQuestionIndex(index)}>{index + 1}</Button>))}
                  </div></ScrollArea></CardContent>
                </Card>
                <Card className="bg-card p-4 md:p-6 rounded-lg shadow-md border border-border">
                    <div className="flex justify-between items-center mb-3"><h3 className="text-lg font-semibold text-primary">Question {currentReviewQuestionIndex + 1}:</h3><div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground flex items-center"><Clock className="h-3.5 w-3.5 mr-1"/> {formatDetailedDuration(currentReviewAnswerLog?.timeSpentSeconds || 0)}</span>
                        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-destructive p-1 h-auto" onClick={() => openReportModal(currentReviewQuestion.id)}><ReportIcon className="h-3.5 w-3.5 mr-1"/> Report</Button>
                        <Button variant="ghost" size="sm" onClick={handleOpenBookmarkModal} className="text-xs text-muted-foreground hover:text-primary p-1 h-auto"><BookmarkIcon className={cn("h-3.5 w-3.5 mr-1", "text-muted-foreground")} />Bookmark</Button>
                    </div></div>
                    <div className="prose prose-sm dark:prose-invert max-w-none mb-4 text-foreground leading-relaxed">{renderLatex(currentReviewQuestion.questionText)}</div>
                    {currentReviewQuestion.displayQuestionImageUrl && <div className="my-4 text-center"><NextImage src={currentReviewQuestion.displayQuestionImageUrl} alt="Question Image" width={400} height={300} className="rounded object-contain inline-block border" data-ai-hint="question diagram"/></div>}
                    {!(currentReviewQuestion.questionText || currentReviewQuestion.displayQuestionImageUrl) && <p className="text-sm text-muted-foreground italic py-4">No question text or image provided.</p>}
                    <div className="space-y-3 mt-6">
                        {['A', 'B', 'C', 'D'].map(optChar => {
                            const optionFullLabel = `Option ${optChar}`; const textKey = `option${optChar}Text` as keyof QuestionBankRecord; const imageKey = `displayOption${optChar}ImageUrl` as keyof QuestionBankRecord;
                            const isSelected = currentReviewAnswerLog?.selectedOption === optionFullLabel; const isCorrectDbOption = currentReviewQuestion.correctOption === optChar; 
                            let optionBgClass = "bg-card hover:bg-muted/30"; let optionBorderClass = "border-border"; let answerIndicator: React.ReactNode = null; let optionTextColor = "text-foreground";
                            if (isCorrectDbOption) { optionBgClass = "bg-green-500/10 dark:bg-green-700/20"; optionBorderClass = "border-green-500/50 dark:border-green-600/50"; optionTextColor = "text-green-700 dark:text-green-400"; answerIndicator = <Badge className="ml-auto text-xs bg-green-600 text-white px-2 py-0.5">Correct Answer</Badge>; }
                            if (isSelected) { if (currentReviewAnswerLog?.isCorrect) answerIndicator = (<div className="ml-auto flex items-center gap-2"><Badge variant="outline" className="text-xs border-green-500 text-green-600 bg-transparent px-2 py-0.5">Your Answer</Badge><Badge className="text-xs bg-green-600 text-white px-2 py-0.5">Correct Answer</Badge></div>);
                                else { optionBgClass = "bg-red-500/10 dark:bg-red-700/20"; optionBorderClass = "border-red-500/50 dark:border-red-600/50"; optionTextColor = "text-red-700 dark:text-red-400"; answerIndicator = (<div className="ml-auto flex items-center gap-2"><Badge variant="outline" className="text-xs border-red-500 text-red-600 bg-transparent px-2 py-0.5">Your Answer</Badge><Badge className="text-xs bg-red-600 text-white px-2 py-0.5">Wrong Answer</Badge></div>); }}
                            return (<div key={optChar} className={cn("p-3 border rounded-md transition-all flex items-start gap-3", optionBgClass, optionBorderClass)}>
                                <span className={cn("font-semibold", isCorrectDbOption ? "text-green-700 dark:text-green-300" : "text-primary")}>{optChar}.</span>
                                <div className={cn("flex-1 text-sm", optionTextColor)}>
                                {(currentReviewQuestion[textKey] || currentReviewQuestion[imageKey]) ? (<>{currentReviewQuestion[textKey] && <div className={cn("prose prose-sm dark:prose-invert max-w-none")}>{renderLatex(currentReviewQuestion[textKey] as string)}</div>}{currentReviewQuestion[imageKey] && <div className="mt-1.5"><NextImage src={currentReviewQuestion[imageKey] as string} alt={`Option ${optChar}`} width={150} height={80} className="rounded object-contain border" data-ai-hint="option illustration"/></div>}</>) : (<p className="italic">Option {optChar} content not available.</p>)}
                                </div>{answerIndicator}</div>);
                        })}
                    </div>
                    {(currentReviewQuestion.explanationText || currentReviewQuestion.displayExplanationImageUrl) && <div className="mt-6 pt-4 border-t"><h4 className="text-md font-semibold text-muted-foreground mb-2">Explanation:</h4>{currentReviewQuestion.explanationText && <div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed">{renderLatex(currentReviewQuestion.explanationText)}</div>}{currentReviewQuestion.displayExplanationImageUrl && <div className="my-3 text-center"><NextImage src={currentReviewQuestion.displayExplanationImageUrl} alt="Explanation Image" width={300} height={200} className="rounded object-contain inline-block border" data-ai-hint="explanation diagram"/></div>}</div>}
                    {!(currentReviewQuestion.explanationText || currentReviewQuestion.displayExplanationImageUrl) && <p className="text-sm text-muted-foreground mt-4 text-center italic">No explanation available for this question.</p>}
                </Card>
                <div className="flex justify-between items-center mt-4">
                    <Button variant="outline" onClick={() => setCurrentReviewQuestionIndex(prev => Math.max(0, prev - 1))} disabled={currentReviewQuestionIndex === 0}><ChevronLeft className="mr-2 h-4 w-4" /> Previous</Button>
                    <Button variant="outline" onClick={() => setCurrentReviewQuestionIndex(prev => Math.min(testQuestions.length - 1, prev + 1))} disabled={currentReviewQuestionIndex === testQuestions.length - 1}><ChevronRight className="ml-2 h-4 w-4" /> Next</Button>
                </div>
              </>
            ) : <p className="text-center text-muted-foreground py-10">Select a question from the palette above to review.</p>
        )}
        <div className="mt-8 text-center"><Link href={Routes.dashboard} passHref><Button variant="outline" size="lg"><LayoutDashboard className="mr-2 h-5 w-5" /> Go to Dashboard</Button></Link></div>
      </main>
      <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
        <DialogContent><DialogHeader><DialogTitle>Report Question {currentReviewQuestionIndex + 1}</DialogTitle><DialogDescription>Please let us know what's wrong.</DialogDescription></DialogHeader>
          <Form {...reportForm}><form onSubmit={reportForm.handleSubmit(handleReportSubmit)} className="space-y-4">
              <FormField control={reportForm.control} name="TypeOfError" render={({ field }) => (<FormItem><FormLabel>Type of Error</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select error type" /></SelectTrigger></FormControl><SelectContent>{ReportErrorTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>
              <FormField control={reportForm.control} name="Please_write_your_report_here" render={({ field }) => (<FormItem><FormLabel>Details (Optional)</FormLabel><FormControl><Textarea placeholder="Provide more details..." {...field} value={field.value ?? ''} rows={3}/></FormControl><FormMessage /></FormItem>)}/>
              <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={reportForm.formState.isSubmitting}>{reportForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit Report</Button></DialogFooter>
          </form></Form>
        </DialogContent>
      </Dialog>
      <Dialog open={isBookmarkModalOpen} onOpenChange={setIsBookmarkModalOpen}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Add to Notebooks</DialogTitle><DialogDescription>Select notebook(s).</DialogDescription></DialogHeader>
          {isLoadingUserNotebooks ? <div className="flex justify-center items-center h-32"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div> : userNotebooks.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No notebooks. <Link href={Routes.notebooks} className="text-primary hover:underline">Create one!</Link></p> : (
            <ScrollArea className="max-h-60 my-4"><div className="space-y-2 pr-2">{userNotebooks.map(nb => (<div key={nb.id} className="flex items-center space-x-2 p-2 border rounded-md hover:bg-muted/50">
                <Checkbox id={`nb-${nb.id}`} checked={selectedNotebookIdsInModal.has(nb.id)} onCheckedChange={() => handleToggleNotebookSelection(nb.id)}/>
                <label htmlFor={`nb-${nb.id}`} className="text-sm font-medium leading-none flex-1 cursor-pointer">{nb.notebook_name}</label><Badge variant="outline" className="text-xs">{nb.questionCount || 0} Qs</Badge>
            </div>))}</div></ScrollArea>
          )}
          <Button type="button" variant="outline" size="sm" className="w-full justify-start text-primary hover:text-primary/90" onClick={() => router.push(Routes.notebooks)}><PlusCircle className="mr-2 h-4 w-4"/> Create New Notebook</Button>
          <div className="mt-4 pt-4 border-t"><p className="text-sm font-medium mb-2 text-muted-foreground">Add tags (optional):</p><div className="flex flex-wrap gap-2">{PREDEFINED_TAGS.map(tag => (<Button key={tag} variant="outline" size="sm" className="text-xs" onClick={() => toast({title: "Tagging coming soon!", description: `Selected tag: ${tag}`})}>{tag}</Button>))}</div><p className="text-xs text-muted-foreground mt-2">Tags apply to this question in selected notebooks.</p></div>
          <DialogFooter className="mt-4"><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button onClick={handleSaveToNotebooks} disabled={selectedNotebookIdsInModal.size === 0 || isLoadingUserNotebooks}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

