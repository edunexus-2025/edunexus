
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, BookCopy, ChevronRight, ListChecks } from 'lucide-react'; // Added ListChecks
import { Routes, unslugify, slugify, DPP_EXAM_OPTIONS } from '@/lib/constants';
import { useEffect, useState } from 'react';
import pb from '@/lib/pocketbase';
import type { RecordModel } from 'pocketbase';
import { Skeleton } from '@/components/ui/skeleton';

interface Lesson {
  name: string;
  questionCount: number;
  slug: string;
  id?: string; 
}

export default function DppLessonListingPage() {
  const params = useParams();
  const router = useRouter();

  const examSlug = typeof params.examDppName === 'string' ? params.examDppName : '';
  const subjectSlug = typeof params.subjectName === 'string' ? params.subjectName : '';
  
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [examDisplayName, setExamDisplayName] = useState<string>('');
  const [subjectDisplayName, setSubjectDisplayName] = useState<string>('');


  useEffect(() => {
    let isMounted = true;

    const currentExamOption = DPP_EXAM_OPTIONS.find(opt => opt.slug === examSlug);
    const currentExamNameForFilter = currentExamOption?.name || ''; 
    const currentSubjectNameForFilter = unslugify(subjectSlug);

    if (isMounted) {
        if (currentExamOption) {
            setExamDisplayName(currentExamOption.name); 
        } else if (examSlug === 'combined') {
            setExamDisplayName('Combined DPPs'); 
        } else {
            setError("Invalid exam specified.");
            setIsLoading(false);
            return;
        }
        setSubjectDisplayName(currentSubjectNameForFilter);
    }

    if (!examSlug || !subjectSlug || (!currentExamNameForFilter && examSlug !== 'combined')) {
      if(isMounted) {
        setIsLoading(false);
        if (!currentExamNameForFilter && examSlug !== 'combined') setError("Exam details not found for slug.");
        else setError("Exam or Subject not specified correctly.");
      }
      return;
    }

    const fetchLessons = async () => {
      if (!isMounted) return;
      setIsLoading(true);
      setError(null);
      try {
        let filterString = `pyq = false && subject = "${currentSubjectNameForFilter}"`;
        if (examSlug !== 'combined' && currentExamNameForFilter) {
            filterString += ` && ExamDpp = "${currentExamNameForFilter}"`; 
        }
        
        console.log("Fetching lessons for DPP with filter:", filterString);

        const records = await pb.collection('question_bank').getFullList<RecordModel>({
          filter: filterString,
          fields: 'lessonName', 
        });

        if (isMounted) {
            const lessonMap = new Map<string, number>();
            records.forEach(record => {
            const lesson = record.lessonName || 'Uncategorized';
            lessonMap.set(lesson, (lessonMap.get(lesson) || 0) + 1);
            });
            
            const fetchedLessons: Lesson[] = Array.from(lessonMap.entries()).map(([name, count], index) => ({
            id: `lesson-${slugify(name)}-${index}`, 
            name,
            questionCount: count,
            slug: slugify(name),
            }));
            
            setLessons(fetchedLessons);
        }
      } catch (err: any) {
        if (isMounted) {
            if ((err instanceof Error && err.name === 'AbortError') || (err.data && err.data.message && err.data.message.includes("request was autocancelled")) || err.status === 0 ) {
                console.warn('Fetch lessons request was cancelled (likely due to component unmount or StrictMode).');
            } else {
                console.error("Failed to fetch lessons:", err);
                setError("Could not load lessons. Please try again. Error: " + err.message);
            }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchLessons();

    return () => {
      isMounted = false;
    };
  }, [examSlug, subjectSlug]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-8 w-1/2 mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <h1 className="text-2xl font-bold text-destructive">Error</h1>
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader className="p-6">
          <CardTitle className="text-3xl font-bold text-foreground">
            {examDisplayName} - {subjectDisplayName} - Lessons
          </CardTitle>
          <CardDescription className="text-md text-muted-foreground">Select a lesson to start practicing DPP questions.</CardDescription>
        </CardHeader>
      </Card>

      {lessons.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {lessons.map((lesson) => {
            let currentLinkHref: string | undefined = undefined;
            let canRenderLink = true;
            const lessonKey = lesson.id || lesson.slug || lesson.name || `lesson-${Math.random()}`;

            if (typeof Routes.dppExamSubjectLessonQuestions !== 'function') {
              console.warn(`DppLessonListingPage: Routes.dppExamSubjectLessonQuestions is not a function for lesson "${lesson.name}".`);
              canRenderLink = false;
            } else if (typeof examSlug !== 'string' || typeof subjectSlug !== 'string' || typeof lesson.slug !== 'string') {
              console.warn(`DppLessonListingPage: Invalid slug types for lesson "${lesson.name}". examSlug: ${typeof examSlug}, subjectSlug: ${typeof subjectSlug}, lesson.slug: ${typeof lesson.slug}`);
              canRenderLink = false;
            } else {
              const tempHref = Routes.dppExamSubjectLessonQuestions(examSlug, subjectSlug, lesson.slug);
              if (typeof tempHref !== 'string') {
                console.warn(`DppLessonListingPage: Generated href for lesson "${lesson.name}" is not a string:`, tempHref);
                canRenderLink = false;
              } else {
                currentLinkHref = tempHref;
              }
            }

            if (!canRenderLink || !currentLinkHref) {
              return (
                <Card key={lessonKey} className="bg-destructive/10 rounded-lg shadow-sm group p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-destructive/20 rounded-md">
                            <ListChecks className="h-5 w-5 text-destructive" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-destructive">{lesson.name} (Link Error)</h3>
                            <p className="text-xs text-destructive/80">Could not generate link.</p>
                        </div>
                    </div>
                </Card>
              );
            }
            
            return (
              <Link key={lessonKey} href={currentLinkHref} passHref>
                <Card className="bg-card rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer group p-4 flex items-center justify-between border hover:border-primary/30">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-md group-hover:bg-primary/20 transition-colors">
                            {/* Using a generic icon, replace if specific icons are available per lesson */}
                            <ListChecks className="h-5 w-5 text-primary group-hover:text-primary-dark transition-colors" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{lesson.name}</h3>
                            <p className="text-xs text-muted-foreground">{lesson.questionCount} Qs</p>
                        </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors opacity-70 group-hover:opacity-100" />
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card className="text-center p-10 shadow-md">
          <CardTitle>No Lessons Found</CardTitle>
          <CardDescription className="text-muted-foreground">There are no DPP lessons available for {subjectDisplayName} in {examDisplayName} yet.</CardDescription>
        </Card>
      )}
    </div>
  );
}

