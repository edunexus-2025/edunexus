
'use client';

import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import pb from '@/lib/pocketbase';
import type { RecordModel } from 'pocketbase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Routes, unslugify, DPP_EXAM_OPTIONS, slugify, escapeForPbFilter, AppConfig } from '@/lib/constants'; // Added AppConfig
import { ArrowLeft, BookOpen, Edit3, BarChart2, Bookmark as BookmarkIcon, ListFilter, Video, ArrowDownUp, CheckCircle, XCircle, Loader2, SortAsc, SortDesc, CircleSlash, Home, Brain, Users, ListChecks, Lock, ChevronRight, Info } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { StudentBookmark, UserSubscriptionTierStudent } from '@/lib/types';


interface DppAttemptRecord extends RecordModel {
  user: string;
  subject: string;
  lessonName: string;
  attemptDate: string; // ISO String
  questionsAttempted: string; // JSON string
  score: number;
  totalQuestions: number;
  correct?: boolean;
  timeTakenSeconds?: number;
  solvedhistory?: number;
}

interface ParsedQuestionAttemptInLog {
  questionId: string;
  selectedOption: string | null;
  correctOption: string | null;
  isCorrect: boolean;
}


interface QuestionTeaser {
  id: string;
  questionText: string | null;
  questionType?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  pyqExamName?: string;
  pyqYear?: number;
  pyqDate?: string;
  pyqShift?: string;
  attemptStatus?: 'correct' | 'incorrect' | 'not_attempted';
  isBookmarked?: boolean; 
  lessonTopic?: string; 
}

type DifficultyFilter = 'All' | 'Easy' | 'Medium' | 'Hard';
type SortOrder = 'default' | 'correctFirst' | 'incorrectFirst' | 'unattemptedFirst';
type TopicWiseSyllabusFilter = 'all_topics' | 'as_per_syllabus' | 'removed' | 'reduced';


const renderLatexSnippet = (text: string | undefined | null, maxLength: number = 120): React.ReactNode => {
  if (!text) return null;
  const snippet = text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  // More robust regex to handle different LaTeX delimiters including escaped ones
  const parts = snippet.split(/(\$\$[\s\S]*?\$\$|\$.*?\$|\\\(.*?\\\)|\\\[.*?\\\]|\\begin\{.*?\}[\s\S]*?\\end\{.*?\})/g);
  return parts.map((part, index) => {
    try {
      if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
        return <BlockMath key={index} math={part.substring(2, part.length - 2)} />;
      }
      if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
        return <InlineMath key={index} math={part.substring(1, part.length - 1)} />;
      }
      if (part.startsWith('\\(') && part.endsWith('\\)') && part.length > 4) {
        return <InlineMath key={index} math={part.substring(2, part.length - 2)} />;
      }
      if (part.startsWith('\\[') && part.endsWith('\\]') && part.length > 4) {
        return <BlockMath key={index} math={part.substring(2, part.length - 2)} />;
      }
      // Handle environments like \begin{equation} ... \end{equation}
      if (part.startsWith('\\begin{') && part.includes('\\end{')) {
        // Simple check, KaTeX will throw error for unsupported environments
        const envMatch = part.match(/^\\begin\{(.*?)\}/);
        if (envMatch && ['equation', 'align', 'gather', 'matrix', 'pmatrix', 'bmatrix', 'vmatrix', 'Vmatrix', 'cases', 'array', 'subequations'].includes(envMatch[1])) {
          return <BlockMath key={index} math={part} />
        }
      }
    } catch (e) {
      // Fallback for parsing errors: render the original part with an error indicator
      // Clean common delimiters for display if KaTeX fails
      const cleanedPart = part.replace(/^\$(\$)?|(\$)?\$$/, '').replace(/^\\(\[|\()|\\(\]|\))$/, '');
      return <span key={index} style={{color: 'red', fontFamily: 'monospace'}} title="LaTeX Parsing Error">{cleanedPart}</span>;
    }
    // Remove specific problematic command if necessary, or render as plain text
    const simplifiedPart = part.replace(/\\overrightarrow/g, ''); // Example of problematic command removal
    return <span key={index}>{simplifiedPart}</span>;
  });
};


const sortOrderLabels: Record<SortOrder, string> = {
  default: 'Default Order',
  correctFirst: 'Correct First',
  incorrectFirst: 'Incorrect First',
  unattemptedFirst: 'Unattempted First',
};

interface LessonTopicData {
  name: string;
  questionCount: number;
}

export default function DppQuestionListingPage() {
  const params = useParams();
  const { toast } = useToast();
  const { user: currentUser, isLoading: authLoading } = useAuth(); 
  const router = useRouter();

  const examSlug = typeof params.examDppName === 'string' ? params.examDppName : '';
  const subjectSlug = typeof params.subjectName === 'string' ? params.subjectName : '';
  const lessonSlug = typeof params.lessonSlug === 'string' ? params.lessonSlug : '';

  const [questions, setQuestions] = useState<QuestionTeaser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDebugInfo, setFilterDebugInfo] = useState<string>('');
  const [attemptFetchError, setAttemptFetchError] = useState<string | null>(null);

  const [examDisplayName, setExamDisplayName] = useState<string>('');
  const [subjectDisplayName, setSubjectDisplayName] = useState<string>('');
  const [lessonDisplayName, setLessonDisplayName] = useState<string>('');
  
  // Filters for "All Questions" tab
  const [difficultyFilterAll, setDifficultyFilterAll] = useState<DifficultyFilter>('All');
  const [sortOrderAll, setSortOrderAll] = useState<SortOrder>('default');
  
  // Filters for "Topic-Wise" tab
  const [topicWiseSyllabusFilter, setTopicWiseSyllabusFilter] = useState<TopicWiseSyllabusFilter>('as_per_syllabus');
  const [availableLessonTopics, setAvailableLessonTopics] = useState<LessonTopicData[]>([]);
  
  const currentUserTier = currentUser?.studentSubscriptionTier;


  const fetchQuestionsAndAttempts = useCallback(async (isMountedGetter: () => boolean) => {
    const currentExamOption = DPP_EXAM_OPTIONS.find(opt => opt.slug === examSlug);
    const currentExamNameForFilter = currentExamOption?.name || '';
    const currentSubjectNameForFilter = unslugify(subjectSlug);
    const currentLessonNameForFilter = unslugify(lessonSlug);
    const userId = currentUser?.id;

    if (!isMountedGetter()) return;

    if (!examSlug || !subjectSlug || !lessonSlug || (!currentExamNameForFilter && examSlug !== 'combined')) {
      if (isMountedGetter()) { setError("Exam, Subject, or Lesson not specified correctly."); setIsLoading(false); }
      return;
    }

    if (isMountedGetter()) { setIsLoading(true); setError(null); setAttemptFetchError(null); setFilterDebugInfo(''); }
    
    let questionFilterString = '';
    let fetchedQuestions: QuestionTeaser[] = [];
    let bookmarkedQuestionIds = new Set<string>();

    try {
      const filterParts = [ `pyq = false`, `subject = "${escapeForPbFilter(currentSubjectNameForFilter)}"`, `lessonName = "${escapeForPbFilter(currentLessonNameForFilter)}"` ];
      if (examSlug !== 'combined' && currentExamNameForFilter) { filterParts.push(`ExamDpp = "${escapeForPbFilter(currentExamNameForFilter)}"`); }
      questionFilterString = filterParts.join(' && ');

      if (!isMountedGetter()) return;
      if (isMountedGetter()) setFilterDebugInfo(questionFilterString);
      console.log("DPP Page: Fetching DPP questions from 'question_bank' with filter:", questionFilterString);

      const records = await pb.collection('question_bank').getFullList<RecordModel>({ filter: questionFilterString, fields: 'id,questionText,difficulty,questionType,pyqExamName,pyqYear,pyqDate,pyqShift,lessonTopic', });
      if (!isMountedGetter()) return;
      
      fetchedQuestions = records.map(record => ({
        id: record.id,
        questionText: record.questionText || null,
        questionType: record.questionType,
        difficulty: record.difficulty as QuestionTeaser['difficulty'],
        pyqExamName: record.pyqExamName,
        pyqYear: record.pyqYear,
        pyqDate: record.pyqDate,
        pyqShift: record.pyqShift,
        lessonTopic: record.lessonTopic,
        attemptStatus: 'not_attempted',
        isBookmarked: false, 
      }));

      if (isMountedGetter() && userId && currentLessonNameForFilter && currentSubjectNameForFilter && fetchedQuestions.length > 0) {
        const escapedSubjectName = escapeForPbFilter(String(currentSubjectNameForFilter));
        const escapedLessonName = escapeForPbFilter(String(currentLessonNameForFilter));
        const escapedUserId = escapeForPbFilter(String(userId));
        const attemptsFilter = `user = "${escapedUserId}" && lessonName = "${escapedLessonName}" && subject = "${escapedSubjectName}"`;
        
        if (!String(userId).trim() || !String(currentLessonNameForFilter).trim() || !String(currentSubjectNameForFilter).trim()) {
            console.warn("DPP Page: Skipping dpp_attempts fetch due to empty key filter values.");
        } else if (!pb.authStore.isValid || pb.authStore.model?.id !== userId) {
            console.warn('DPP Page: Auth state mismatch or invalid according to SDK before fetching attempts. Skipping dpp_attempts fetch.');
        } else {
            try {
              if (!isMountedGetter()) return;
              const attemptRecords = await pb.collection('dpp_attempts').getFullList<DppAttemptRecord>({ filter: attemptsFilter, sort: '-attemptDate', });
              if (!isMountedGetter()) return;
              const attemptStatusMap = new Map<string, { status: 'correct' | 'incorrect', date: string }>();
              attemptRecords.forEach(attemptRecord => {
                  try {
                      let parsedQsAttempted: ParsedQuestionAttemptInLog[] = [];
                      if (typeof attemptRecord.questionsAttempted === 'string') { parsedQsAttempted = JSON.parse(attemptRecord.questionsAttempted); }
                      else if (Array.isArray(attemptRecord.questionsAttempted)) { parsedQsAttempted = attemptRecord.questionsAttempted as any; }
                      parsedQsAttempted.forEach(qa => { if (fetchedQuestions.some(fq => fq.id === qa.questionId)) { if (!attemptStatusMap.has(qa.questionId) || new Date(attemptRecord.attemptDate) > new Date(attemptStatusMap.get(qa.questionId)!.date)) { let status: 'correct' | 'incorrect'; if (typeof qa.isCorrect === 'boolean') { status = qa.isCorrect ? 'correct' : 'incorrect'; } else if (typeof attemptRecord.correct === 'boolean') { status = attemptRecord.correct ? 'correct' : 'incorrect'; } else { status = 'incorrect'; } attemptStatusMap.set(qa.questionId, { status: status, date: attemptRecord.attemptDate }); }}});
                  } catch (e) { console.error("DPP Page: Error parsing questionsAttempted JSON from dpp_attempts:", e, "Record ID:", attemptRecord.id); }
              });
              fetchedQuestions = fetchedQuestions.map(q => ({ ...q, attemptStatus: attemptStatusMap.get(q.id)?.status || 'not_attempted' }));
            } catch (attemptErr: any) {
                if (!isMountedGetter()) return;
                if (attemptErr?.status === 0 && (attemptErr?.originalError?.name === 'AbortError' || (attemptErr.name === 'ClientResponseError' && attemptErr.message.includes("autocancelled")))) { console.warn('DPP Page: Fetch dpp_attempts request was cancelled. Filter:', attemptsFilter); }
                else { console.error("DPP Page: Failed to fetch dpp_attempts. Filter was:", attemptsFilter, "Error data:", attemptErr.data, "Full error:", attemptErr); let errorDescription = `Could not load previous attempt statuses. Filter: ${attemptsFilter}. Error: ${attemptErr.data?.message || attemptErr.message}`; if (attemptErr.status === 400) { errorDescription += " This might be due to incorrect PocketBase collection permissions for 'dpp_attempts'. Please ensure the List/View rules allow access for authenticated users (e.g. @request.auth.id != '' && user = @request.auth.id)."; if(isMountedGetter()) setAttemptFetchError(errorDescription); } toast({ title: "Error Fetching Attempt Status", description: errorDescription, variant: "destructive", duration: 9000 }); }
            }
        }
      }

      if (isMountedGetter() && userId && fetchedQuestions.length > 0) {
        try { const bookmarkRecords = await pb.collection('student_bookmarks').getFullList<StudentBookmark>({ filter: `user = "${escapeForPbFilter(userId)}"`, fields: 'questions' }); if (isMountedGetter()) { bookmarkRecords.forEach(notebook => { if (Array.isArray(notebook.questions)) { notebook.questions.forEach(qId => bookmarkedQuestionIds.add(qId)); } }); } }
        catch (bookmarkErr: any) { if (isMountedGetter()) { console.warn("DPP Page: Failed to fetch student_bookmarks, bookmark status may be inaccurate.", bookmarkErr); }}
      }
      
      if (isMountedGetter()) {
        fetchedQuestions = fetchedQuestions.map(q => ({ ...q, isBookmarked: bookmarkedQuestionIds.has(q.id), }));
        setQuestions(fetchedQuestions);

        const topicsMap = new Map<string, number>();
        fetchedQuestions.forEach(q => {
          if (q.lessonTopic) {
            topicsMap.set(q.lessonTopic, (topicsMap.get(q.lessonTopic) || 0) + 1);
          }
        });
        setAvailableLessonTopics(Array.from(topicsMap.entries()).map(([name, count]) => ({ name, questionCount: count })).sort((a, b) => a.name.localeCompare(b.name)));
      }

    } catch (err: any) {
      if (!isMountedGetter()) return;
      const errorMessage = err.message || "Unknown error";
      if (err?.status === 0 && (err?.originalError?.name === 'AbortError' || (err.name === 'ClientResponseError' && err.message.includes("autocancelled")))) { console.warn('DPP Page: DPP questions fetch request was cancelled. Filter:', filterDebugInfo || questionFilterString); if (isMountedGetter()) setError(`Data loading was interrupted.`); }
      else if (err?.status === 400 && err.name === 'ClientResponseError') { console.error("DPP Page: PocketBase 400 Error fetching DPP questions:", err.data || err, "Filter:", filterDebugInfo || questionFilterString); if (isMountedGetter()) setError(`Error fetching questions (400): ${err.data?.message || errorMessage}. Filter used: ${filterDebugInfo || questionFilterString}. Ensure PocketBase collection rules allow access and field names in filter match schema exactly.`); }
      else { console.error("DPP Page: Failed to fetch DPP questions:", err, "Filter:", filterDebugInfo || questionFilterString); if (isMountedGetter()) setError(`Could not load questions. Error: ${errorMessage}. Filter used: ${filterDebugInfo || questionFilterString}`); }
    } finally { if (isMountedGetter()) setIsLoading(false); }
  }, [examSlug, subjectSlug, lessonSlug, currentUser?.id, toast, unslugify, escapeForPbFilter]);


  useEffect(() => {
    let isMounted = true; const isMountedGetter = () => isMounted;
    
    const currentExamOption = DPP_EXAM_OPTIONS.find(opt => opt.slug === examSlug);
    if(isMounted) setExamDisplayName(currentExamOption?.name || (examSlug === 'combined' ? 'Combined DPPs' : 'Unknown Exam'));
    if(isMounted) setSubjectDisplayName(unslugify(subjectSlug));
    if(isMounted) setLessonDisplayName(unslugify(lessonSlug));
    
    if (!authLoading) fetchQuestionsAndAttempts(isMountedGetter);

    let unsubQuestions: (() => void) | undefined; let unsubAttempts: (() => void) | undefined; let unsubBookmarks: (() => void) | undefined;
    (async () => {
        if(!isMountedGetter()) return;
        try { unsubQuestions = await pb.collection('question_bank').subscribe('*', (e) => { if (isMountedGetter() && (e.action === 'create' || e.action === 'update' || e.action === 'delete')) { fetchQuestionsAndAttempts(isMountedGetter); }}); }
        catch (subError) { console.warn("DPP Page: Failed to subscribe to question_bank for DPP list:", subError); }
        if(!isMountedGetter()) return;
        try { unsubAttempts = await pb.collection('dpp_attempts').subscribe('*', (e) => { if (isMountedGetter() && (e.action === 'create' || e.action === 'update' || e.action === 'delete')) { if (e.record.user === currentUser?.id && e.record.lessonName === unslugify(lessonSlug) && e.record.subject === unslugify(subjectSlug)) { fetchQuestionsAndAttempts(isMountedGetter); } }}); }
        catch (subError) { console.warn("DPP Page: Failed to subscribe to dpp_attempts for DPP list:", subError); }
        if(!isMountedGetter()) return;
        try { unsubBookmarks = await pb.collection('student_bookmarks').subscribe('*', (e) => { if (isMountedGetter() && e.record.user === currentUser?.id) { fetchQuestionsAndAttempts(isMountedGetter); }}); }
        catch (subError) { console.warn("DPP Page: Failed to subscribe to student_bookmarks:", subError); }
    })();
    return () => { isMounted = false; if (unsubQuestions) unsubQuestions(); if (unsubAttempts) unsubAttempts(); if (unsubBookmarks) unsubBookmarks(); };
  }, [examSlug, subjectSlug, lessonSlug, currentUser?.id, authLoading, fetchQuestionsAndAttempts, unslugify]);


  const applyFiltersAndSort = (questionList: QuestionTeaser[], difficulty: DifficultyFilter, sort: SortOrder, topic?: string | null): QuestionTeaser[] => {
    let processed = questionList;
    if (topic) processed = processed.filter(q => q.lessonTopic === topic);
    if (difficulty !== 'All') processed = processed.filter(q => q.difficulty === difficulty);
    if (sort !== 'default') {
      processed.sort((a, b) => {
        const statusOrder = { correct: 1, incorrect: 2, not_attempted: 3 };
        const statusA = statusOrder[a.attemptStatus || 'not_attempted'];
        const statusB = statusOrder[b.attemptStatus || 'not_attempted'];
        if (sort === 'correctFirst') return statusA - statusB;
        if (sort === 'incorrectFirst') { if (statusA === 2 && statusB !== 2) return -1; if (statusB === 2 && statusA !== 2) return 1; return statusA - statusB; }
        if (sort === 'unattemptedFirst') { if (statusA === 3 && statusB !== 3) return -1; if (statusB === 3 && statusA !== 3) return 1; return statusA - statusB; }
        return 0;
      });
    }
    return processed;
  };

  const allQuestionsFilteredAndSorted = useMemo(() => applyFiltersAndSort(questions, difficultyFilterAll, sortOrderAll), [questions, difficultyFilterAll, sortOrderAll]);
  
  const getPyqTag = (q: QuestionTeaser) => {
    if (!q.pyqExamName) return null; let tag = q.pyqExamName; if (q.pyqYear) tag += ` ${q.pyqYear}`;
    if (q.pyqDate) { try { const date = new Date(q.pyqDate); const day = String(date.getDate()).padStart(2, '0'); const month = date.toLocaleString('default', { month: 'short' }); tag += ` (${day} ${month}`; if (q.pyqShift && q.pyqShift !== 'N/A') { tag += ` ${q.pyqShift}`; } tag += `)`; } catch (e) { /* ignore */ }}
    else if (q.pyqShift && q.pyqShift !== 'N/A') { tag += ` (${q.pyqShift})`; }
    return tag;
  };

  const difficultyFilterButtons: { label: DifficultyFilter; value: DifficultyFilter }[] = [ { label: 'All', value: 'All' }, { label: 'Easy', value: 'Easy' }, { label: 'Medium', value: 'Medium' }, { label: 'Hard', value: 'Hard' }, ];
  const sortOptions: { label: string; value: SortOrder; icon?: React.ReactNode }[] = [ { label: 'Default Order', value: 'default', icon: <ArrowDownUp className="h-3.5 w-3.5 mr-1.5 text-muted-foreground"/> }, { label: 'Correct First', value: 'correctFirst', icon: <SortAsc className="h-3.5 w-3.5 mr-1.5 text-green-500"/> }, { label: 'Incorrect First', value: 'incorrectFirst', icon: <SortDesc className="h-3.5 w-3.5 mr-1.5 text-red-500"/>}, { label: 'Unattempted First', value: 'unattemptedFirst', icon: <CircleSlash className="h-3.5 w-3.5 mr-1.5 text-gray-500"/> }, ];

  const getAttemptStatusIcon = (status?: 'correct' | 'incorrect' | 'not_attempted') => {
    if (status === 'correct') return <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />;
    if (status === 'incorrect') return <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />;
    return <CircleSlash className="h-5 w-5 text-slate-400 flex-shrink-0" />;
  };
  
  const renderAllQuestionsList = () => {
    if (allQuestionsFilteredAndSorted.length === 0) {
      return ( <Card className="text-center p-6 md:p-10 shadow-md bg-card dark:bg-slate-800"> <CardHeader className="p-0"><Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" /></CardHeader> <CardTitle className="text-lg text-foreground">No Questions Match Filters</CardTitle> <CardContent className="p-0 mt-2"><CardDescription className="text-muted-foreground text-sm">Try adjusting the difficulty or sort options for "All Questions".</CardDescription></CardContent> </Card> );
    }
    return (
      <div className="space-y-3">
        {allQuestionsFilteredAndSorted.map((question, index) => {
          const pyqTag = getPyqTag(question);
          return (
            <Card asChild key={question.id} className="bg-card dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow duration-200 group rounded-lg border border-border/70 hover:border-primary/30">
              <Link href={Routes.qbankView(question.id)} className="block focus:outline-none focus:ring-2 focus:ring-primary rounded-lg">
                <CardContent className="p-4 flex items-center gap-4"> {/* Standardized padding */}
                  <div className="flex flex-col items-center justify-center w-10 text-center flex-shrink-0">
                    <span className="text-base font-semibold text-primary/80 group-hover:text-primary">{String(index + 1).padStart(2, '0')}</span>
                    <div className="mt-1.5 scale-90 group-hover:scale-100 transition-transform"> {getAttemptStatusIcon(question.attemptStatus)} </div>
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-start">
                        <div className="text-sm text-foreground group-hover:text-primary transition-colors leading-relaxed line-clamp-2 prose prose-sm dark:prose-invert max-w-none"> {question.questionText ? renderLatexSnippet(question.questionText) : (question.questionType === 'image' || question.questionType === 'text_image' ? 'Image-based Question' : 'Question (No text preview)')} </div>
                        {question.isBookmarked && <BookmarkIcon className="h-4 w-4 text-primary fill-primary flex-shrink-0 ml-2" />}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                        {pyqTag && ( <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 px-1.5 py-0.5">{pyqTag}</Badge> )}
                        <Badge variant={question.difficulty === 'Easy' ? 'secondary' : question.difficulty === 'Medium' ? 'default' : 'destructive'} className={cn( "text-xs px-1.5 py-0.5", question.difficulty === 'Easy' && 'bg-green-100 text-green-700 border-green-300 dark:bg-green-800/30 dark:text-green-300 dark:border-green-700', question.difficulty === 'Medium' && 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-800/30 dark:text-yellow-300 dark:border-yellow-700', question.difficulty === 'Hard' && 'bg-red-100 text-red-700 border-red-300 dark:bg-red-800/30 dark:text-red-300 dark:border-red-700' )}>{question.difficulty}</Badge>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors transform group-hover:translate-x-0.5 flex-shrink-0" />
                </CardContent>
              </Link>
            </Card>
          );
        })}
      </div>
    );
  };

  const topicWiseSyllabusFilters: { label: string, value: TopicWiseSyllabusFilter }[] = [
    { label: "As per syllabus", value: "as_per_syllabus" }, { label: "Removed", value: "removed" },
    { label: "Reduced", value: "reduced" }, { label: "All", value: "all_topics" },
  ];


  if (authLoading || (isLoading && questions.length === 0)) { // Adjusted loading condition
    return ( <div className="space-y-4 p-4 md:p-6"> <Skeleton className="h-8 w-3/4 mb-2" /> <Skeleton className="h-6 w-1/2 mb-4" /> <div className="flex flex-wrap gap-2 mb-4"> {[...Array(4)].map((_,i) => <Skeleton key={i} className="h-8 w-24 rounded-full"/>)} </div> <div className="flex justify-between items-center mb-3"> <Skeleton className="h-6 w-1/4" /> <Skeleton className="h-8 w-40" /> </div> <div className="space-y-3"> {[...Array(5)].map((_, i) => ( <Card key={i} className="p-4 rounded-lg shadow-sm bg-card"> <div className="flex items-start gap-4"> <Skeleton className="h-6 w-6 mt-1 rounded-full" /> <div className="flex-grow min-w-0 space-y-2"> <Skeleton className="h-4 w-4/5" /> <Skeleton className="h-4 w-3/5" /> <div className="flex gap-2"><Skeleton className="h-5 w-16 rounded-md" /><Skeleton className="h-5 w-20 rounded-md" /></div> </div> <Skeleton className="h-6 w-6 rounded-md" /> </div> </Card> ))} </div> </div> );
  }

  return (
    <div className="min-h-screen bg-background"> {/* Ensure main background is white */}
      <div className="bg-card shadow-sm sticky top-16 z-20"> {/* Header on white card */}
        <div className="container mx-auto px-4 md:px-6 py-4">
            <div className="mb-1 text-xs text-muted-foreground"> <Link href={Routes.home} className="hover:text-primary">Home</Link> &gt; <Link href={Routes.dpp} className="hover:text-primary"> DPP</Link> &gt; <Link href={Routes.dppExamSubjects(examSlug)} className="hover:text-primary"> {examDisplayName}</Link> &gt; <Link href={Routes.dppExamSubjectLessons(examSlug, subjectSlug)} className="hover:text-primary"> {subjectDisplayName}</Link> &gt; <span className="font-medium text-foreground"> {lessonDisplayName}</span> </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                 <div> <h1 className="text-2xl md:text-3xl font-bold text-foreground">{lessonDisplayName}</h1> <p className="text-sm text-muted-foreground">{questions.length} Questions</p> </div>
                 <div className="flex items-center gap-2 mt-2 sm:mt-0"> <Button variant="outline" size="sm" className="text-xs" onClick={() => alert("Quiz feature coming soon!")}><Brain className="h-4 w-4 mr-1.5"/> Start Quiz</Button> <Button variant="outline" size="sm" className="text-xs" onClick={() => alert("Bookmarks feature coming soon!")}><BookmarkIcon className="h-4 w-4 mr-1.5"/> Bookmarks</Button> <Button variant="default" size="sm" className="text-xs" asChild><Link href={Routes.dppAnalysis(examSlug, subjectSlug, lessonSlug)}><BarChart2 className="h-4 w-4 mr-1.5"/> View Analysis</Link></Button> </div>
            </div>
        </div>
      </div>
      
      <Tabs defaultValue="all-questions" className="container mx-auto px-4 md:px-6 py-4">
        <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted"> <TabsTrigger value="all-questions" className="data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm">All Questions</TabsTrigger> <TabsTrigger value="topic-wise" className="data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm">Topic-Wise</TabsTrigger> </TabsList>
        
        <TabsContent value="all-questions">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 p-3 bg-card rounded-lg shadow-md">
              <div className="flex items-center gap-2 flex-wrap"> <span className="text-sm font-medium text-muted-foreground mr-1">Difficulty:</span> {difficultyFilterButtons.map(fb => ( <Button key={fb.value} variant={difficultyFilterAll === fb.value ? "default" : "outline"} size="sm" onClick={() => setDifficultyFilterAll(fb.value)} className={cn( "rounded-full px-3 py-1 text-xs h-auto", difficultyFilterAll === fb.value && "bg-primary text-primary-foreground shadow-md", difficultyFilterAll !== fb.value && "border-border text-foreground hover:bg-accent/50" )}>{fb.label}</Button> ))} </div>
              <DropdownMenu> <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="text-xs h-auto px-3 py-1.5 min-w-[150px] justify-between border-border">{sortOptions.find(opt => opt.value === sortOrderAll)?.icon}<span>{sortOrderLabels[sortOrderAll]}</span><ListFilter className="h-3.5 w-3.5 ml-1.5 opacity-70"/></Button></DropdownMenuTrigger> <DropdownMenuContent align="end" className="w-56 bg-card border-border"><DropdownMenuLabel>Sort By</DropdownMenuLabel><DropdownMenuSeparator className="bg-border"/><DropdownMenuRadioGroup value={sortOrderAll} onValueChange={(value) => setSortOrderAll(value as SortOrder)}>{sortOptions.map(opt => ( <DropdownMenuRadioItem key={opt.value} value={opt.value} className="cursor-pointer flex items-center gap-2 text-sm focus:bg-accent/50">{opt.icon || <span className="w-[14px]"/>} {opt.label}</DropdownMenuRadioItem> ))}</DropdownMenuRadioGroup></DropdownMenuContent> </DropdownMenu>
          </div>
          {attemptFetchError && ( <Alert variant="destructive" className="mb-4 bg-destructive/10 border-destructive text-destructive-foreground"> <AlertCircle className="h-4 w-4" /> <AlertTitle>Error Fetching Attempt Status</AlertTitle> <AlertDescription className="text-xs whitespace-pre-wrap">{attemptFetchError}</AlertDescription> </Alert> )}
          {error && allQuestionsFilteredAndSorted.length === 0 && !attemptFetchError && ( <Card className="text-center p-6 md:p-10 shadow-md border-destructive bg-destructive/10"> <CardHeader className="p-0"><AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" /></CardHeader> <CardTitle className="text-lg text-destructive">Error Loading Questions</CardTitle> <CardContent className="p-0 mt-2"><CardDescription className="text-destructive/80 text-sm whitespace-pre-wrap">{error}</CardDescription></CardContent> </Card> )}
          {renderAllQuestionsList()}
          {!isLoading && allQuestionsFilteredAndSorted.length === 0 && !error && !attemptFetchError && ( <Card className="text-center p-6 md:p-10 shadow-md border-accent bg-accent/5"> <CardHeader className="p-0"><AlertCircle className="h-10 w-10 text-accent mx-auto mb-3" /></CardHeader> <CardTitle className="text-lg text-accent-foreground">No Questions Found</CardTitle> <CardContent className="p-0 mt-2"><CardDescription className="text-muted-foreground text-sm">No questions found for "{lessonDisplayName}" in "{subjectDisplayName}" for exam "{examDisplayName}".</CardDescription></CardContent> </Card> )}
        </TabsContent>

        <TabsContent value="topic-wise">
          <div className="mb-4 p-3 bg-card rounded-lg shadow-md flex flex-wrap items-center justify-start gap-2">
            {topicWiseSyllabusFilters.map(f => (<Button key={f.value} variant={topicWiseSyllabusFilter === f.value ? "default" : "outline"} size="sm" className={cn("rounded-full px-3 py-1 text-xs h-auto", topicWiseSyllabusFilter === f.value && "bg-accent text-accent-foreground", topicWiseSyllabusFilter !== f.value && "text-muted-foreground border-border hover:bg-accent/50")} onClick={() => {setTopicWiseSyllabusFilter(f.value); toast({title: "Filter Clicked", description: `${f.label} filter (functionality coming soon).`}) }}>{f.label}</Button>))}
          </div>
          {currentUserTier === 'Free' || authLoading ? ( 
            <>
              <div className="space-y-3 mb-6">
                  {availableLessonTopics.slice(0,3).map(topic => ( // Show a few locked examples
                       <Card key={topic.name} className="bg-card shadow-sm rounded-lg border border-border/70 opacity-60">
                          <CardContent className="p-4 flex items-center justify-between gap-3">
                            <Lock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            <div className="flex-grow min-w-0"> <p className="text-base font-medium text-muted-foreground truncate" title={topic.name}>{topic.name}</p> <p className="text-xs text-muted-foreground">{topic.questionCount} Questions</p> </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0"/>
                          </CardContent>
                       </Card>
                  ))}
                  {availableLessonTopics.length > 3 && <p className="text-xs text-center text-muted-foreground">...and more topics available.</p>}
              </div>
              <Card className="text-center p-6 md:p-10 shadow-lg border-dashed border-amber-500 bg-amber-50 dark:bg-amber-900/20">
                <CardHeader className="p-0"><Lock className="h-10 w-10 text-amber-600 dark:text-amber-400 mx-auto mb-3" /></CardHeader>
                <CardTitle className="text-lg text-amber-700 dark:text-amber-300">Topic-Wise DPPs Locked</CardTitle>
                <CardContent className="p-0 mt-2"><CardDescription className="text-amber-600 dark:text-amber-400 text-sm mb-4">This feature is available for premium users. Upgrade to access topic-specific practice problems and enhance your preparation.</CardDescription></CardContent>
                <CardFooter className="p-0 justify-center"><Button asChild className="bg-primary hover:bg-primary/90"><Link href={Routes.upgrade}>Unlock with {AppConfig.appName} Premium <ChevronRight className="ml-1.5 h-4 w-4"/></Link></Button></CardFooter>
              </Card>
            </>
          ) : (
            <>
              {availableLessonTopics.length === 0 ? (<Card className="text-center p-6 md:p-10 shadow-md bg-card border-border"><CardHeader className="p-0"><Info className="h-10 w-10 text-muted-foreground mx-auto mb-3" /></CardHeader><CardTitle className="text-lg text-foreground">No Topics Available</CardTitle><CardContent className="p-0 mt-2"><CardDescription className="text-muted-foreground text-sm">No specific topics found within this lesson. Questions might not be tagged with topics yet.</CardDescription></CardContent></Card>)
              : (
                <div className="space-y-3">
                  {availableLessonTopics.map(topic => (
                    <Card key={topic.name} className="bg-card shadow-sm hover:shadow-md transition-shadow duration-200 group rounded-lg border border-border/70 hover:border-primary/30">
                      <button onClick={() => {toast({title: "Topic Clicked", description: `Viewing questions for ${topic.name} (functionality coming soon).`})}} className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-primary rounded-lg">
                        <CardContent className="p-4 flex items-center justify-between gap-3">
                          <div className="flex-grow min-w-0"> <p className="text-base font-medium text-foreground group-hover:text-primary truncate" title={topic.name}>{topic.name}</p> <p className="text-xs text-muted-foreground">{topic.questionCount} Questions</p> </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors transform group-hover:translate-x-0.5 flex-shrink-0"/>
                        </CardContent>
                      </button>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
