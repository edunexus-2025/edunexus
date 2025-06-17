
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BookCopy, AlertCircle, ListChecks, PlusCircle, Layers, BookOpen, Filter, Activity, Loader2, CheckCircle } from 'lucide-react';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import { escapeForPbFilter, Routes, DPP_ASSOCIATED_EXAMS } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { SYLLABUS_DATA, type ExamName, type SubjectSyllabus, type Lesson as SyllabusLesson } from '@/data/syllabus-data'; // Adjusted import
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface TopicWithCount extends SyllabusLesson {
  topics: Array<{ name: string; questionCount: number | 'loading' | 'error' }>;
  totalLessonQuestions: number | 'loading' | 'error';
}

interface SubjectWithCounts extends SubjectSyllabus {
  lessons: TopicWithCount[];
  totalSubjectQuestions: number | 'loading' | 'error';
}

interface ExamSyllabusWithCounts {
  examName: ExamName;
  subjects: SubjectWithCounts[];
  totalExamQuestions: number | 'loading' | 'error';
}

// Allowed exam names for this page based on DPP_ASSOCIATED_EXAMS
const VALID_EXAMS_FOR_SYLLABUS_MANAGER = DPP_ASSOCIATED_EXAMS;

export default function ContentSyllabusManagerPage() {
  const [syllabusViewData, setSyllabusViewData] = useState<ExamSyllabusWithCounts[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeExamTab, setActiveExamTab] = useState<ExamName>(VALID_EXAMS_FOR_SYLLABUS_MANAGER[0]);
  const [filterTerm, setFilterTerm] = useState('');
  const [expandedAccordions, setExpandedAccordions] = useState<Record<string, string[]>>({});
  const { toast } = useToast();

  const fetchQuestionCounts = useCallback(async (
    examName: ExamName,
    subjectName: string,
    lessonName: string,
    topicName: string
  ): Promise<number | 'error'> => {
    const filterParts = [
      `pyq = false`,
      `ExamDpp = "${escapeForPbFilter(examName)}"`,
      `subject = "${escapeForPbFilter(subjectName)}"`,
      `lessonName = "${escapeForPbFilter(lessonName)}"`,
      `lessonTopic = "${escapeForPbFilter(topicName)}"`,
    ];
    const filterString = filterParts.join(' && ');
    try {
      const resultList = await pb.collection('question_bank').getList(1, 1, { filter: filterString, count: true, $autoCancel: false });
      return resultList.totalItems;
    } catch (err: any) {
      const clientError = err as ClientResponseError;
      if (!(clientError?.isAbort || (clientError?.name === 'ClientResponseError' && clientError?.status === 0))) {
        console.error(`Error fetching count for ${examName}/${subjectName}/${lessonName}/${topicName}:`, clientError.data || clientError);
      }
      return 'error';
    }
  }, []);

  const loadSyllabusWithCounts = useCallback(async (isMountedGetter: () => boolean) => {
    if (!isMountedGetter()) return;
    setIsLoading(true);
    setError(null);
    const processedExamsAccumulator: ExamSyllabusWithCounts[] = [];

    try {
      for (const examName of VALID_EXAMS_FOR_SYLLABUS_MANAGER) {
        const examSyllabus = SYLLABUS_DATA[examName];
        if (!examSyllabus) continue;

        let totalExamQs: number | 'loading' | 'error' = 0;
        const processedSubjects: SubjectWithCounts[] = [];

        for (const subject of examSyllabus) {
          if (!isMountedGetter()) return;
          let totalSubjectQs: number | 'loading' | 'error' = 0;
          const processedLessons: TopicWithCount[] = [];

          for (const lesson of subject.lessons) {
            if (!isMountedGetter()) return;
            let totalLessonQs: number | 'loading' | 'error' = 0;
            const processedTopics: Array<{ name: string; questionCount: number | 'loading' | 'error' }> = [];

            for (const topicName of lesson.topics) {
              if (!isMountedGetter()) return;
              const count = await fetchQuestionCounts(examName, subject.subjectName, lesson.name, topicName);
              processedTopics.push({ name: topicName, questionCount: count });
              if (typeof count === 'number' && typeof totalLessonQs === 'number') totalLessonQs += count;
              else if (count === 'error') totalLessonQs = 'error';
            }
            processedLessons.push({ ...lesson, topics: processedTopics, totalLessonQuestions: totalLessonQs });
            if (typeof totalLessonQs === 'number' && typeof totalSubjectQs === 'number') totalSubjectQs += totalLessonQs;
            else if (totalLessonQs === 'error') totalSubjectQs = 'error';
          }
          processedSubjects.push({ ...subject, lessons: processedLessons, totalSubjectQuestions: totalSubjectQs });
          if (typeof totalSubjectQs === 'number' && typeof totalExamQs === 'number') totalExamQs += totalExamQs;
          else if (totalSubjectQs === 'error') totalExamQs = 'error';
        }
        processedExamsAccumulator.push({ examName, subjects: processedSubjects, totalExamQuestions: totalExamQs });
      }
      if (isMountedGetter()) {
        setSyllabusViewData(processedExamsAccumulator);
      }
    } catch (e: any) {
        if (isMountedGetter()) {
            console.error("ContentSyllabusManagerPage: Uncaught error during loadSyllabusWithCounts processing:", e);
            setError("An unexpected error occurred while loading syllabus data. Please try refreshing.");
            setSyllabusViewData([]); 
        }
    } finally {
      if (isMountedGetter()) {
        setIsLoading(false);
      }
    }
  }, [fetchQuestionCounts]);

  useEffect(() => {
    let isMounted = true;
    loadSyllabusWithCounts(() => isMounted);
    return () => { isMounted = false; };
  }, [loadSyllabusWithCounts]);

  const toggleAccordion = (type: 'subject' | 'lesson', examName: string, subjectName: string, lessonName?: string) => {
    const key = lessonName ? `${examName}-${subjectName}-${lessonName}` : `${examName}-${subjectName}`;
    setExpandedAccordions(prev => {
      const currentExamPath = prev[examName] || [];
      const newExamPath = currentExamPath.includes(key)
        ? currentExamPath.filter(k => k !== key)
        : [...currentExamPath, key];
      return { ...prev, [examName]: newExamPath };
    });
  };

  const isExpanded = (type: 'subject' | 'lesson', examName: string, subjectName: string, lessonName?: string): boolean => {
    const key = lessonName ? `${examName}-${subjectName}-${lessonName}` : `${examName}-${subjectName}`;
    return expandedAccordions[examName]?.includes(key) || false;
  };

  const getFilteredSyllabus = (examData: ExamSyllabusWithCounts | undefined) => {
    if (!examData) return undefined;
    if (!filterTerm.trim()) return examData;

    const lowerFilterTerm = filterTerm.toLowerCase();
    const filteredSubjects = examData.subjects.map(subject => {
      const filteredLessons = subject.lessons.map(lesson => {
        const filteredTopics = lesson.topics.filter(topic =>
          topic.name.toLowerCase().includes(lowerFilterTerm)
        );
        if (filteredTopics.length > 0 || lesson.name.toLowerCase().includes(lowerFilterTerm)) {
          return { ...lesson, topics: filteredTopics };
        }
        return null;
      }).filter(Boolean) as TopicWithCount[];

      if (filteredLessons.length > 0 || subject.subjectName.toLowerCase().includes(lowerFilterTerm)) {
        return { ...subject, lessons: filteredLessons };
      }
      return null;
    }).filter(Boolean) as SubjectWithCounts[];

    return { ...examData, subjects: filteredSubjects };
  };

  const currentFilteredExamData = getFilteredSyllabus(syllabusViewData.find(e => e.examName === activeExamTab));

  if (isLoading && syllabusViewData.length === 0) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Skeleton className="h-10 w-1/3" /><Skeleton className="h-10 w-full mb-4" />
        <div className="space-y-2"> {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)} </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6 text-center">
        <Card className="max-w-lg mx-auto shadow-lg border-destructive bg-destructive/10">
          <CardHeader><AlertCircle className="mx-auto h-12 w-12 text-destructive mb-3" /><CardTitle className="text-destructive">Error Loading Syllabus Manager</CardTitle></CardHeader>
          <CardContent><p className="whitespace-pre-wrap">{error}</p></CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="space-y-8 p-4 md:p-6">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-3"> <BookCopy className="h-8 w-8 text-primary" />
            <div> <CardTitle className="text-2xl md:text-3xl font-bold text-foreground">Content Syllabus Manager</CardTitle>
                  <CardDescription className="text-md text-muted-foreground">View predefined syllabus and add new questions.</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="mb-6">
        <Input type="search" placeholder="Filter lessons or topics..." value={filterTerm} onChange={(e) => setFilterTerm(e.target.value)} className="w-full md:w-1/2 lg:w-1/3 bg-card border-border"/>
      </div>

      <Tabs value={activeExamTab} onValueChange={(value) => setActiveExamTab(value as ExamName)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 sticky top-0 z-10 bg-background/90 backdrop-blur-sm">
          {VALID_EXAMS_FOR_SYLLABUS_MANAGER.map(examName => ( <TabsTrigger key={examName} value={examName}>{examName}</TabsTrigger> ))}
        </TabsList>
        
        {VALID_EXAMS_FOR_SYLLABUS_MANAGER.map(examName => (
          <TabsContent key={examName} value={examName} className="mt-6">
            {isLoading && !currentFilteredExamData ? <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary my-10" /> :
             !currentFilteredExamData || currentFilteredExamData.subjects.length === 0 ? (
              <Card className="text-center p-10 border-dashed"> <ListChecks className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <CardTitle className="text-xl">{filterTerm ? "No Matching Content" : "No Syllabus Defined"}</CardTitle>
                <CardDescription>{filterTerm ? `No lessons or topics match "${filterTerm}" for ${examName}.` : `Syllabus structure for ${examName} is not yet defined in syllabus-data.ts or no subjects were found.`}</CardDescription>
              </Card>
            ) : (
              <Accordion type="multiple" value={expandedAccordions[examName] || []} onValueChange={(value) => setExpandedAccordions(prev => ({ ...prev, [examName]: value }))} className="w-full space-y-2">
                {currentFilteredExamData.subjects.map(subject => (
                  <AccordionItem key={`${examName}-${subject.subjectName}`} value={`${examName}-${subject.subjectName}`} className="bg-card border rounded-md shadow-sm data-[state=open]:shadow-lg">
                    <AccordionTrigger className="px-4 py-3 text-lg font-medium hover:bg-muted/50 rounded-t-md" onClick={() => toggleAccordion('subject', examName, subject.subjectName)}>
                      <div className="flex justify-between items-center w-full">
                        <span className="truncate text-left flex items-center gap-2" title={subject.subjectName}><Layers className="h-5 w-5 text-primary/70"/> {subject.subjectName}</span>
                        {/* Question count for subject removed */}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="border-t bg-background/30">
                      {subject.lessons.length === 0 ? <p className="p-4 text-sm text-muted-foreground italic">No lessons defined for this subject in the syllabus data or matches current filter.</p> : (
                        <Accordion type="multiple" value={expandedAccordions[examName]?.filter(key => key.startsWith(`${examName}-${subject.subjectName}-`)) || []} onValueChange={(value) => {
                            const subjectKeys = expandedAccordions[examName]?.filter(k => !k.startsWith(`${examName}-${subject.subjectName}-`)) || [];
                            setExpandedAccordions(prev => ({ ...prev, [examName]: [...subjectKeys, ...value] }));
                        }} className="w-full space-y-1 p-2">
                          {subject.lessons.map(lesson => (
                            <AccordionItem key={`${examName}-${subject.subjectName}-${lesson.name}`} value={`${examName}-${subject.subjectName}-${lesson.name}`} className="bg-background border rounded data-[state=open]:shadow-md">
                              <AccordionTrigger className="px-3 py-2.5 text-md font-normal hover:bg-muted/30 rounded-t-sm" onClick={() => toggleAccordion('lesson', examName, subject.subjectName, lesson.name)}>
                                <div className="flex justify-between items-center w-full"><span className="truncate text-left flex items-center gap-2"><BookOpen className="h-4 w-4 text-muted-foreground"/>{lesson.name}</span>
                                {/* Question count for lesson removed */}
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="border-t">
                                {lesson.topics.length === 0 ? <p className="p-3 text-xs text-muted-foreground italic">No topics defined for this lesson or matches current filter.</p> : (
                                  <ul className="space-y-1 p-2">
                                    {lesson.topics.map(topic => (
                                      <li key={topic.name} className="text-xs p-2 hover:bg-primary/5 rounded-sm flex justify-between items-center">
                                        <div className="flex items-center gap-2"><Activity className="h-3.5 w-3.5 text-primary/50 "/><span className="text-foreground truncate" title={topic.name}>{topic.name}</span>
                                        {/* Topic question count badge removed */}
                                        </div>
                                        <Link href={`${Routes.adminQuestionBank}?examDpp=${encodeURIComponent(examName)}&subject=${encodeURIComponent(subject.subjectName)}&lessonName=${encodeURIComponent(lesson.name)}&lessonTopic=${encodeURIComponent(topic.name)}`} passHref>
                                          <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 h-auto py-0.5 px-1.5 text-[10px]"><PlusCircle className="h-3 w-3 mr-1"/> Add</Button>
                                        </Link>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

