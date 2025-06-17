
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, AlertCircle, ListChecks } from 'lucide-react';
import pb from '@/lib/pocketbase';
import type { RecordModel } from 'pocketbase';
import { escapeForPbFilter } from '@/lib/constants';
import { Badge } from '@/components/ui/badge'; // Added Badge import

interface QuestionBankRecord extends RecordModel {
  id: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics' | 'Biology';
  lessonName: string;
  ExamDpp?: 'JEE MAIN' | 'NEET' | 'MHT CET'; // This field will be used for exam filtering
  pyq: boolean;
}

interface LessonInfo {
  name: string;
  questionCount: number;
}

interface SubjectLessons {
  subjectName: 'Physics' | 'Chemistry' | 'Mathematics' | 'Biology';
  lessons: LessonInfo[];
}

interface ExamSyllabusData {
  examName: 'MHT CET' | 'JEE MAIN' | 'NEET';
  subjects: SubjectLessons[];
}

const EXAMS_TO_DISPLAY: Array<'MHT CET' | 'JEE MAIN' | 'NEET'> = ["MHT CET", "JEE MAIN", "NEET"];
const SUBJECT_ORDER: Array<'Physics' | 'Chemistry' | 'Mathematics' | 'Biology'> = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];

export default function SyllabusOverviewPage() {
  const [syllabusData, setSyllabusData] = useState<ExamSyllabusData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      if (!isMounted) return;
      setIsLoading(true);
      setError(null);

      try {
        const examFilterParts = EXAMS_TO_DISPLAY.map(exam => `ExamDpp = "${escapeForPbFilter(exam)}"`);
        const filterString = `pyq = false && (${examFilterParts.join(' || ')})`;
        
        console.log("SyllabusOverview: Fetching questions with filter:", filterString);

        const records = await pb.collection('question_bank').getFullList<QuestionBankRecord>({
          filter: filterString,
          fields: 'id,subject,lessonName,ExamDpp,pyq', // Ensure ExamDpp is fetched
        });

        if (!isMounted) return;
        console.log("SyllabusOverview: Fetched records:", records.length);

        const processedData = EXAMS_TO_DISPLAY.map(examName => {
          const examSpecificRecords = records.filter(r => r.ExamDpp === examName && !r.pyq);
          
          const subjectsMap = new Map<string, Map<string, number>>(); // Subject -> LessonName -> Count

          examSpecificRecords.forEach(record => {
            if (!record.subject || !record.lessonName) return;

            if (!subjectsMap.has(record.subject)) {
              subjectsMap.set(record.subject, new Map<string, number>());
            }
            const lessonsMap = subjectsMap.get(record.subject)!;
            lessonsMap.set(record.lessonName, (lessonsMap.get(record.lessonName) || 0) + 1);
          });

          const subjectsArray: SubjectLessons[] = [];
          SUBJECT_ORDER.forEach(subjectKey => {
            if (subjectsMap.has(subjectKey)) {
              const lessons: LessonInfo[] = [];
              subjectsMap.get(subjectKey)!.forEach((count, lessonName) => {
                lessons.push({ name: lessonName, questionCount: count });
              });
              lessons.sort((a,b) => a.name.localeCompare(b.name)); // Sort lessons alphabetically
              subjectsArray.push({ subjectName: subjectKey, lessons });
            }
          });
          
          return { examName, subjects: subjectsArray };
        });
        
        if (isMounted) setSyllabusData(processedData);

      } catch (err: any) {
        if (isMounted) {
          console.error("SyllabusOverview: Failed to fetch syllabus data:", err);
          setError(`Could not load syllabus overview. Error: ${err.data?.message || err.message}`);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center gap-3 mb-4">
          <BookOpen className="h-8 w-8 text-primary" />
          <Skeleton className="h-8 w-72" />
        </div>
        <Skeleton className="h-10 w-full mb-4" /> 
        <div className="grid grid-cols-1 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="shadow-md">
              <CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader>
              <CardContent><Skeleton className="h-20 w-full" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6 text-center">
        <Card className="max-w-lg mx-auto shadow-lg border-destructive bg-destructive/10">
          <CardHeader>
            <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-3" />
            <CardTitle className="text-destructive">Error Loading Syllabus</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 md:p-6">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl md:text-3xl font-bold text-foreground">
                Syllabus Overview (2025)
              </CardTitle>
              <CardDescription className="text-md text-muted-foreground">
                Current lessons available per subject for MHT CET, JEE MAIN, and NEET (based on non-PYQ questions).
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue={EXAMS_TO_DISPLAY[0]} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          {EXAMS_TO_DISPLAY.map(examName => (
            <TabsTrigger key={examName} value={examName}>{examName}</TabsTrigger>
          ))}
        </TabsList>

        {syllabusData.map(examData => (
          <TabsContent key={examData.examName} value={examData.examName} className="mt-6">
            {examData.subjects.length === 0 ? (
                <Card className="text-center p-10 border-dashed">
                    <ListChecks className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <CardTitle className="text-xl">No Syllabus Content</CardTitle>
                    <CardDescription>No current syllabus lessons (non-PYQ) found for {examData.examName} in the question bank.</CardDescription>
                </Card>
            ) : (
                <Accordion type="multiple" className="w-full space-y-2">
                {examData.subjects.map(subjectData => (
                    <AccordionItem key={`${examData.examName}-${subjectData.subjectName}`} value={`${examData.examName}-${subjectData.subjectName}`} className="bg-card border rounded-md shadow-sm">
                    <AccordionTrigger className="px-4 py-3 text-lg font-medium hover:bg-muted/50 rounded-t-md">
                        {subjectData.subjectName} ({subjectData.lessons.reduce((sum, l) => sum + l.questionCount, 0)} Qs)
                    </AccordionTrigger>
                    <AccordionContent className="px-4 py-3 border-t">
                        {subjectData.lessons.length > 0 ? (
                        <ul className="space-y-1.5">
                            {subjectData.lessons.map(lesson => (
                            <li key={lesson.name} className="text-sm text-muted-foreground p-2 hover:bg-secondary/30 rounded">
                                {lesson.name} <Badge variant="outline" className="ml-2 font-normal">{lesson.questionCount} Qs</Badge>
                            </li>
                            ))}
                        </ul>
                        ) : (
                        <p className="text-sm text-muted-foreground italic">No lessons found for this subject in {examData.examName}.</p>
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
