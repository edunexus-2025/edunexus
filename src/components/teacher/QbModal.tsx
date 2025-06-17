
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DatabaseZap, ListFilter, BookUser, AlertTriangle, Info, Lock, BadgeHelp, Loader2, Eye, Image as ImageIconLucide, Search as SearchIcon, Filter as FilterIconLucide, ChevronsUpDown } from 'lucide-react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError as PocketBaseClientResponseError } from 'pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Routes, escapeForPbFilter } from '@/lib/constants';
import NextImage from 'next/image';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { cn } from '@/lib/utils';

interface QbModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onQuestionSelect?: (questionId: string) => void;
}

interface QuestionFromBank {
  id: string;
  questionText?: string; // For EduNexus QB (from question_bank collection)
  QuestionText?: string;  // For My Teacher QB (from add_questions collection)
  difficulty?: 'Easy' | 'Medium' | 'Hard'; // For EduNexus QB
  CorrectOption?: string; // For My Teacher QB
  
  questionImage_filename?: string | null; 
  collectionId?: string; 
  collectionName?: string; 

  QuestionImage_url?: string | null; 

  displayImageUrl?: string | null; 
}

const renderLatexSnippet = (text: string | undefined | null, maxLength: number = 100): React.ReactNode => {
  if (!text) return <span className="italic text-muted-foreground">No text preview.</span>;
  const snippet = text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
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
      if (part.startsWith('\\begin{') && part.includes('\\end{')) {
        const envMatch = part.match(/^\\begin\{(.*?)\}/);
        if (envMatch && ['equation', 'align', 'gather', 'matrix', 'pmatrix', 'bmatrix', 'vmatrix', 'Vmatrix', 'cases', 'array', 'subequations'].includes(envMatch[1])) {
          return <BlockMath key={index} math={part} />;
        }
      }
    } catch (e) {
      // console.warn("Katex parsing error for part:", part, e);
      return <span key={index} className="text-destructive" title="LaTeX Error">{part}</span>;
    }
    return <span key={index}>{part}</span>;
  });
};

export function QbModal({ isOpen, onOpenChange, onQuestionSelect }: QbModalProps) {
  const { teacher, isLoadingTeacher } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"my-teacher-qb" | "edunexus-qb">("my-teacher-qb");

  // EduNexus QB State
  const [subjectsEduNexusQb, setSubjectsEduNexusQb] = useState<string[]>([]);
  const [selectedSubjectEduNexusQb, setSelectedSubjectEduNexusQb] = useState<string | null>(null);
  const [isLoadingSubjectsEduNexus, setIsLoadingSubjectsEduNexus] = useState(false);
  const [lessonsEduNexusQb, setLessonsEduNexusQb] = useState<string[]>([]);
  const [selectedLessonEduNexusQb, setSelectedLessonEduNexusQb] = useState<string | null>(null);
  const [isLoadingLessonsEduNexus, setIsLoadingLessonsEduNexus] = useState(false);
  const [questionsEduNexusQb, setQuestionsEduNexusQb] = useState<QuestionFromBank[]>([]);
  const [isLoadingQuestionsEduNexus, setIsLoadingQuestionsEduNexus] = useState(false);
  const [errorEduNexusQb, setErrorEduNexusQb] = useState<string | null>(null);
  const [searchEduNexusQb, setSearchEduNexusQb] = useState('');

  // My Teacher QB State
  const [examsMyQb, setExamsMyQb] = useState<string[]>([]);
  const [selectedExamMyQb, setSelectedExamMyQb] = useState<string | null>(null);
  const [isLoadingExamsMyQb, setIsLoadingExamsMyQb] = useState(false);
  const [lessonsMyQb, setLessonsMyQb] = useState<string[]>([]);
  const [selectedLessonMyQb, setSelectedLessonMyQb] = useState<string | null>(null);
  const [isLoadingLessonsMyQb, setIsLoadingLessonsMyQb] = useState(false);
  const [questionsMyQb, setQuestionsMyQb] = useState<QuestionFromBank[]>([]);
  const [isLoadingQuestionsMyQb, setIsLoadingQuestionsMyQb] = useState(false);
  const [errorMyQb, setErrorMyQb] = useState<string | null>(null);
  const [searchMyQb, setSearchMyQb] = useState('');

  const [imageToViewUrl, setImageToViewUrl] = useState<string | null>(null);


  // Fetch EduNexus QB Subjects
  useEffect(() => {
    let isMounted = true;
    if (isOpen && teacher?.teacherSubscriptionTier === 'Pro' && !isLoadingTeacher) {
      setIsLoadingSubjectsEduNexus(true);
      setErrorEduNexusQb(null);
      pb.collection('question_bank').getFullList<{ subject: string }>({ fields: 'subject', $autoCancel: false })
        .then(records => {
          if (isMounted) {
            const distinctSubjects = Array.from(new Set(records.map(r => r.subject).filter(Boolean))).sort();
            setSubjectsEduNexusQb(distinctSubjects);
          }
        })
        .catch(err => { if (isMounted) { console.error("QBModal: Failed to fetch EduNexus QB subjects:", err); setErrorEduNexusQb("Could not load subjects."); }})
        .finally(() => { if (isMounted) setIsLoadingSubjectsEduNexus(false); });
    } else if (isOpen && (isLoadingTeacher || teacher?.teacherSubscriptionTier !== 'Pro')) {
        setSubjectsEduNexusQb([]);
    }
    return () => { isMounted = false; };
  }, [isOpen, teacher?.teacherSubscriptionTier, isLoadingTeacher]);

  // Fetch EduNexus QB Lessons
  useEffect(() => {
    let isMounted = true;
    setLessonsEduNexusQb([]); setSelectedLessonEduNexusQb(null); setQuestionsEduNexusQb([]);
    if (selectedSubjectEduNexusQb && teacher?.teacherSubscriptionTier === 'Pro') {
      setIsLoadingLessonsEduNexus(true); setErrorEduNexusQb(null);
      pb.collection('question_bank').getFullList<{ lessonName: string }>({
        filter: `subject = "${escapeForPbFilter(selectedSubjectEduNexusQb)}"`,
        fields: 'lessonName', $autoCancel: false
      })
        .then(records => { if (isMounted) { const distinctLessons = Array.from(new Set(records.map(r => r.lessonName).filter(Boolean))).sort(); setLessonsEduNexusQb(distinctLessons); }})
        .catch(err => { if (isMounted) { console.error("QBModal: Failed to fetch EduNexus QB lessons:", err); setErrorEduNexusQb("Could not load lessons."); }})
        .finally(() => { if (isMounted) setIsLoadingLessonsEduNexus(false); });
    }
    return () => { isMounted = false; };
  }, [selectedSubjectEduNexusQb, teacher?.teacherSubscriptionTier]);

  // Fetch EduNexus QB Questions
  useEffect(() => {
    let isMounted = true;
    setQuestionsEduNexusQb([]);
    if (selectedSubjectEduNexusQb && selectedLessonEduNexusQb && teacher?.teacherSubscriptionTier === 'Pro') {
      setIsLoadingQuestionsEduNexus(true); setErrorEduNexusQb(null);
      
      const trimmedSubject = selectedSubjectEduNexusQb.trim();
      const trimmedLesson = selectedLessonEduNexusQb.trim();

      if (!trimmedSubject || !trimmedLesson) {
        if (isMounted) {
          setErrorEduNexusQb("Subject and Lesson must be selected.");
          setIsLoadingQuestionsEduNexus(false);
        }
        return;
      }
      const filterString = `subject = "${escapeForPbFilter(trimmedSubject)}" && lessonName = "${escapeForPbFilter(trimmedLesson)}"`;
      pb.collection('question_bank').getFullList<RecordModel>({
        filter: filterString,
        fields: 'id,questionText,difficulty,questionImage,collectionId,collectionName',
        $autoCancel: false
      })
      .then(records => {
        if (isMounted) {
          const mappedQuestions = records.map(r => {
            let imageUrl: string | null = null;
            if (r.questionImage && r.collectionId && r.collectionName) {
              try { imageUrl = pb.files.getUrl(r, r.questionImage as string); } catch (e) { /* ignore */ }
            }
            return {
              id: r.id,
              questionText: r.questionText,
              difficulty: r.difficulty as QuestionFromBank['difficulty'],
              questionImage_filename: r.questionImage || null,
              collectionId: r.collectionId,
              collectionName: r.collectionName,
              displayImageUrl: imageUrl,
            };
          });
          setQuestionsEduNexusQb(mappedQuestions);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          const clientError = err as PocketBaseClientResponseError;
          let detailedErrorMessage = "Could not load questions.";
          if (clientError && clientError.url && clientError.status && clientError.data) {
            detailedErrorMessage = `Error: ${clientError.data?.message || clientError.message}. Filter: ${filterString}. Status: ${clientError.status}. URL: ${clientError.url}. Data: ${JSON.stringify(clientError.data, null, 2)}.`;
          } else { detailedErrorMessage = `An unexpected error occurred: ${err?.message || "Unknown error"}.`; }
          console.error("QBModal: Failed to fetch EduNexus QB questions. Filter:", filterString, "Error Details:", clientError?.data, "Full Error:", clientError);
          setErrorEduNexusQb(detailedErrorMessage);
        }
      })
      .finally(() => { if (isMounted) setIsLoadingQuestionsEduNexus(false); });
    }
    return () => { isMounted = false; };
  }, [selectedLessonEduNexusQb, selectedSubjectEduNexusQb, teacher?.teacherSubscriptionTier]);


  // Fetch My Teacher QB Exams
  useEffect(() => {
    let isMounted = true;
    if (isOpen && teacher?.id && !isLoadingTeacher) {
      setIsLoadingExamsMyQb(true); setErrorMyQb(null);
      pb.collection('add_questions').getFullList<{ QBExam: string }>({ filter: `teacher = "${teacher.id}"`, fields: 'QBExam', $autoCancel: false })
        .then(records => { if (isMounted) { const distinctExams = Array.from(new Set(records.map(r => r.QBExam).filter(Boolean))).sort(); setExamsMyQb(distinctExams); }})
        .catch(err => { if (isMounted) { console.error("QBModal: Failed to fetch My QB exams:", err); setErrorMyQb("Could not load your exams."); }})
        .finally(() => { if (isMounted) setIsLoadingExamsMyQb(false); });
    }
    return () => { isMounted = false; };
  }, [isOpen, teacher?.id, isLoadingTeacher]);

  // Fetch My Teacher QB Lessons
  useEffect(() => {
    let isMounted = true;
    setLessonsMyQb([]); setSelectedLessonMyQb(null); setQuestionsMyQb([]);
    if (selectedExamMyQb && teacher?.id) {
      setIsLoadingLessonsMyQb(true); setErrorMyQb(null);
      const filterString = `teacher = "${teacher.id}" && QBExam = "${escapeForPbFilter(selectedExamMyQb)}"`;
      pb.collection('add_questions').getFullList<{ LessonName: string }>({ filter: filterString, fields: 'LessonName', $autoCancel: false })
        .then(records => { if (isMounted) { const distinctLessons = Array.from(new Set(records.map(r => r.LessonName).filter(Boolean))).sort(); setLessonsMyQb(distinctLessons); }})
        .catch(err => { if (isMounted) { console.error("QBModal: Failed to fetch My QB lessons:", err); setErrorMyQb("Could not load your lessons."); }})
        .finally(() => { if (isMounted) setIsLoadingLessonsMyQb(false); });
    }
    return () => { isMounted = false; };
  }, [selectedExamMyQb, teacher?.id]);

  // Fetch My Teacher QB Questions
  useEffect(() => {
    let isMounted = true;
    setQuestionsMyQb([]);
    if (selectedExamMyQb && selectedLessonMyQb && teacher?.id) {
      setIsLoadingQuestionsMyQb(true); setErrorMyQb(null);
      const trimmedExam = selectedExamMyQb.trim();
      const trimmedLesson = selectedLessonMyQb.trim();
      if (!trimmedExam || !trimmedLesson) { if (isMounted) { setErrorMyQb("Exam and Lesson must be selected."); setIsLoadingQuestionsMyQb(false); } return; }
      const filterString = `teacher = "${teacher.id}" && QBExam = "${escapeForPbFilter(trimmedExam)}" && LessonName = "${escapeForPbFilter(trimmedLesson)}"`;
      pb.collection('add_questions').getFullList<RecordModel>({ filter: filterString, fields: 'id,QuestionText,CorrectOption,QuestionImage', $autoCancel: false })
        .then(records => {
          if (isMounted) {
            const mappedQuestions = records.map(r => ({
              id: r.id,
              QuestionText: r.QuestionText,
              CorrectOption: r.CorrectOption as QuestionFromBank['CorrectOption'],
              QuestionImage_url: r.QuestionImage || null, // Direct URL from add_questions
              displayImageUrl: r.QuestionImage || null,
            }));
            setQuestionsMyQb(mappedQuestions);
          }
        })
        .catch((err: any) => { if (isMounted) { console.error("QBModal: Failed to fetch My QB questions. Filter:", filterString, "Error:", err); setErrorMyQb(`Could not load your questions: ${err.data?.message || err.message}`); }})
        .finally(() => { if (isMounted) setIsLoadingQuestionsMyQb(false); });
    }
    return () => { isMounted = false; };
  }, [selectedLessonMyQb, selectedExamMyQb, teacher?.id]);

  const handleSelectQuestion = (questionId: string) => {
    if (onQuestionSelect) {
      onQuestionSelect(questionId);
      toast({ title: "Question Selected", description: `Question ID ${questionId.substring(0, 6)}... ready.` });
      onOpenChange(false);
    }
  };

  const filteredEduNexusQuestions = useMemo(() => {
    if (!searchEduNexusQb) return questionsEduNexusQb;
    return questionsEduNexusQb.filter(q => q.questionText?.toLowerCase().includes(searchEduNexusQb.toLowerCase()));
  }, [questionsEduNexusQb, searchEduNexusQb]);

  const filteredMyQbQuestions = useMemo(() => {
    if (!searchMyQb) return questionsMyQb;
    return questionsMyQb.filter(q => q.QuestionText?.toLowerCase().includes(searchMyQb.toLowerCase()));
  }, [questionsMyQb, searchMyQb]);

  const renderQuestionItem = (q: QuestionFromBank, source: 'EduNexus' | 'MyQB') => (
    <Card key={`${source}-${q.id}`} className="p-3 shadow-sm hover:shadow-md transition-shadow border border-border/70 bg-card">
      <div className="flex justify-between items-start gap-3">
        <div className="flex-grow min-w-0">
          {q.displayImageUrl && (
            <div className="mb-2 cursor-pointer w-24 h-16 relative" onClick={() => setImageToViewUrl(q.displayImageUrl!)}>
              <NextImage src={q.displayImageUrl} alt="Question thumbnail" layout="fill" objectFit="contain" className="rounded border bg-muted" data-ai-hint="diagram illustration"/>
            </div>
          )}
          <div className="text-sm text-foreground line-clamp-3 prose prose-sm dark:prose-invert max-w-none">
            {renderLatexSnippet(source === 'EduNexus' ? q.questionText : q.QuestionText, 150)}
          </div>
          <div className="mt-1.5">
            <Badge variant={q.difficulty ? (q.difficulty === 'Easy' ? 'secondary' : q.difficulty === 'Medium' ? 'default' : 'destructive') : 'outline'} className="text-xs px-1.5 py-0.5">
              {q.difficulty || (source === 'MyQB' ? `Ans: ${q.CorrectOption || 'N/A'}` : 'N/A')}
            </Badge>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => handleSelectQuestion(q.id)} className="flex-shrink-0 self-center">Select</Button>
      </div>
    </Card>
  );

  const renderTabContent = (
    primaryFilterOptions: string[],
    selectedPrimaryFilter: string | null,
    onPrimaryFilterChange: (value: string | null) => void,
    primaryFilterPlaceholder: string,
    isLoadingPrimaryFilter: boolean,
    secondaryFilterOptions: string[],
    selectedSecondaryFilter: string | null,
    onSecondaryFilterChange: (value: string | null) => void,
    secondaryFilterPlaceholder: string,
    isLoadingSecondaryFilter: boolean,
    searchQuery: string,
    onSearchQueryChange: (value: string) => void,
    searchPlaceholder: string,
    questionsToDisplay: QuestionFromBank[],
    isLoadingQuestions: boolean,
    errorState: string | null,
    sourceType: 'EduNexus' | 'MyQB',
    onEditFilters: () => void
  ) => {
    const showFilterSummary = selectedPrimaryFilter && selectedSecondaryFilter;

    return (
      <div className="flex flex-col h-full">
        <Card className="m-4 mb-0 p-3 border-b rounded-b-none shadow sticky top-0 bg-background z-10 flex-shrink-0">
          {showFilterSummary ? (
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                className="flex-grow justify-between text-left font-normal h-10"
                onClick={onEditFilters}
              >
                <span className="truncate">
                  <span className="font-medium">{selectedPrimaryFilter}</span>
                  <span className="text-muted-foreground mx-1">&gt;</span>
                  {selectedSecondaryFilter}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
              <div className="relative flex-shrink-0" style={{ minWidth: '180px' }}>
                <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder={searchPlaceholder} className="pl-8 w-full h-10" value={searchQuery} onChange={(e) => onSearchQueryChange(e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
              <Select value={selectedPrimaryFilter || ''} onValueChange={value => onPrimaryFilterChange(value || null)} disabled={isLoadingPrimaryFilter}>
                <SelectTrigger className="h-10"><SelectValue placeholder={isLoadingPrimaryFilter ? "Loading..." : primaryFilterPlaceholder} /></SelectTrigger>
                <SelectContent>{primaryFilterOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={selectedSecondaryFilter || ''} onValueChange={value => onSecondaryFilterChange(value || null)} disabled={!selectedPrimaryFilter || isLoadingSecondaryFilter}>
                <SelectTrigger className="h-10"><SelectValue placeholder={isLoadingSecondaryFilter ? "Loading..." : (selectedPrimaryFilter ? secondaryFilterPlaceholder : "Select primary filter first")} /></SelectTrigger>
                <SelectContent>{secondaryFilterOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
              </Select>
              <div className="relative lg:col-span-1">
                <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder={searchPlaceholder} className="pl-8 w-full h-10" value={searchQuery} onChange={(e) => onSearchQueryChange(e.target.value)} disabled={!selectedSecondaryFilter && !showFilterSummary} />
              </div>
            </div>
          )}
        </Card>
        <ScrollArea className="flex-1 p-4 pt-2 min-h-0"> 
          <div className="space-y-2 pt-2">
            {errorState && (
              <Card className="border-destructive bg-destructive/10 p-4 text-center my-4">
                <AlertTriangle className="mx-auto h-8 w-8 text-destructive mb-2" />
                <p className="text-sm text-destructive font-medium whitespace-pre-wrap">{errorState}</p>
              </Card>
            )}
            {isLoadingQuestions && (
              <div className="space-y-2 mt-4">
                {[...Array(5)].map((_, i) => <Skeleton key={`skel-${sourceType}-${i}`} className="h-24 w-full rounded-lg" />)}
              </div>
            )}
            {!isLoadingQuestions && questionsToDisplay.length > 0 && (
              questionsToDisplay.map(q => renderQuestionItem(q, sourceType))
            )}
            {!isLoadingQuestions && (selectedPrimaryFilter && selectedSecondaryFilter) && questionsToDisplay.length === 0 && !errorState && (
              <Card className="text-center p-6 border-dashed mt-4 bg-card">
                <BadgeHelp className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  No questions found for {`"${selectedSecondaryFilter}"`} in {`"${selectedPrimaryFilter}"`}.
                  {searchQuery && ` matching "${searchQuery}"`}
                </p>
              </Card>
            )}
             {!isLoadingQuestions && !(selectedPrimaryFilter && selectedSecondaryFilter) && !errorState && (
               <Card className="text-center p-6 border-dashed mt-4 bg-card">
                  <FilterIconLucide className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Please select filters above to view questions.</p>
               </Card>
             )}
          </div>
        </ScrollArea>
      </div>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b flex-shrink-0">
            <DialogTitle className="text-xl flex items-center gap-2">
              <DatabaseZap className="h-6 w-6 text-primary" />
              Question Bank Explorer
            </DialogTitle>
            <DialogDescription>
              Browse, filter, and select questions. Pro features are enabled.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-2 p-1 border-b flex-shrink-0 rounded-none h-auto">
              <TabsTrigger value="my-teacher-qb" className="py-2.5 text-sm">
                <BookUser className="mr-2 h-4 w-4" /> My Teacher QB
              </TabsTrigger>
              <TabsTrigger value="edunexus-qb" className="py-2.5 text-sm">
                <DatabaseZap className="mr-2 h-4 w-4" /> EduNexus QB
              </TabsTrigger>
            </TabsList>
            
            <div className="flex-1 overflow-hidden"> 
              <TabsContent value="my-teacher-qb" className="mt-0 h-full">
                {renderTabContent(
                  examsMyQb, selectedExamMyQb, (val) => {setSelectedExamMyQb(val); setSelectedLessonMyQb(null); setQuestionsMyQb([]); setSearchMyQb('');}, "Select Your Exam", isLoadingExamsMyQb,
                  lessonsMyQb, selectedLessonMyQb, (val) => {setSelectedLessonMyQb(val); setQuestionsMyQb([]); setSearchMyQb('');}, "Select Your Lesson", isLoadingLessonsMyQb,
                  searchMyQb, setSearchMyQb, "Search your questions...",
                  filteredMyQbQuestions, isLoadingQuestionsMyQb, errorMyQb, "MyQB",
                  () => { setSelectedLessonMyQb(null); setQuestionsMyQb([]); setSearchMyQb(''); } 
                )}
              </TabsContent>
              <TabsContent value="edunexus-qb" className="mt-0 h-full">
                {teacher?.teacherSubscriptionTier === 'Pro' ? renderTabContent(
                  subjectsEduNexusQb, selectedSubjectEduNexusQb, (val) => {setSelectedSubjectEduNexusQb(val); setSelectedLessonEduNexusQb(null); setQuestionsEduNexusQb([]); setSearchEduNexusQb('');}, "Select Subject", isLoadingSubjectsEduNexus,
                  lessonsEduNexusQb, selectedLessonEduNexusQb, (val) => {setSelectedLessonEduNexusQb(val); setQuestionsEduNexusQb([]); setSearchEduNexusQb('');}, "Select Lesson", isLoadingLessonsEduNexus,
                  searchEduNexusQb, setSearchEduNexusQb, "Search EduNexus questions...",
                  filteredEduNexusQuestions, isLoadingQuestionsEduNexus, errorEduNexusQb, "EduNexus",
                  () => { setSelectedLessonEduNexusQb(null); setQuestionsEduNexusQb([]); setSearchEduNexusQb(''); } 
                ) : (
                  <div className="text-center p-10 flex flex-col items-center justify-center h-full">
                    <Lock className="h-12 w-12 text-amber-500 mb-4" />
                    <h3 className="text-xl font-semibold text-foreground mb-2">Pro Feature Locked</h3>
                    <p className="text-muted-foreground mb-6">
                      Access to the full EduNexus Question Bank is a Pro feature.
                      Upgrade your plan to unlock thousands of questions.
                    </p>
                    <Button asChild><Link href={Routes.teacherPlan}>View Pro Plans</Link></Button>
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="p-4 border-t flex-shrink-0">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!imageToViewUrl} onOpenChange={(open) => !open && setImageToViewUrl(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] p-2 sm:p-4">
          <DialogHeader className="p-0"><DialogTitle className="sr-only">Image Preview</DialogTitle></DialogHeader>
          {imageToViewUrl && (
            <NextImage src={imageToViewUrl} alt="Enlarged question image" width={800} height={600} className="rounded-md object-contain max-w-full max-h-[70vh]" data-ai-hint="question diagram illustration"/>
          )}
          <DialogFooter className="pt-2 sm:pt-4"><DialogClose asChild><Button type="button" variant="outline">Close Preview</Button></DialogClose></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

    