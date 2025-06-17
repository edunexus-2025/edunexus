
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, BookOpen, Atom, FlaskConical, Sigma, Dna, ChevronRight, Loader2 } from 'lucide-react';
import { EXAM_SUBJECTS, Routes, unslugify, slugify, DPP_EXAM_OPTIONS, escapeForPbFilter } from '@/lib/constants';
import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import pb from '@/lib/pocketbase';
import type { RecordModel } from 'pocketbase';
import { Skeleton } from '@/components/ui/skeleton';

// Helper to get icon based on subject name
const getSubjectIcon = (subjectName: string, sizeClass = "h-6 w-6") => {
  switch (subjectName.toLowerCase()) {
    case 'physics': return <Atom className={cn("text-orange-500", sizeClass)} />;
    case 'chemistry': return <FlaskConical className={cn("text-green-500", sizeClass)} />;
    case 'mathematics': return <Sigma className={cn("text-blue-500", sizeClass)} />;
    case 'biology': return <Dna className={cn("text-teal-500", sizeClass)} />;
    default: return <BookOpen className={cn("text-gray-500", sizeClass)} />;
  }
};

const getSubjectBorderColor = (subjectName: string): string => {
    switch (subjectName.toLowerCase()) {
      case 'physics': return 'border-orange-400 hover:border-orange-500 dark:border-orange-600 dark:hover:border-orange-500';
      case 'chemistry': return 'border-green-400 hover:border-green-500 dark:border-green-600 dark:hover:border-green-500';
      case 'mathematics': return 'border-blue-400 hover:border-blue-500 dark:border-blue-600 dark:hover:border-blue-500';
      case 'biology': return 'border-teal-400 hover:border-teal-500 dark:border-teal-600 dark:hover:border-teal-500';
      default: return 'border-border hover:border-primary/50';
    }
};

const getSubjectIconBgColor = (subjectName: string): string => {
    switch (subjectName.toLowerCase()) {
      case 'physics': return 'bg-orange-100 dark:bg-orange-900/30';
      case 'chemistry': return 'bg-green-100 dark:bg-green-900/30';
      case 'mathematics': return 'bg-blue-100 dark:bg-blue-900/30';
      case 'biology': return 'bg-teal-100 dark:bg-teal-900/30';
      default: return 'bg-gray-100 dark:bg-gray-800/30';
    }
};

interface SubjectStats {
  chapterCount: number;
  questionCount: number;
}

export default function DppExamSubjectSelectionPage() {
  const params = useParams();
  const router = useRouter();
  
  const examSlug = typeof params.examDppName === 'string' ? params.examDppName : '';
  const [examDisplayName, setExamDisplayName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [subjectStats, setSubjectStats] = useState<Record<string, SubjectStats>>({});
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const currentExamOption = DPP_EXAM_OPTIONS.find(opt => opt.slug === examSlug);
    if (currentExamOption) {
      if (isMounted) setExamDisplayName(currentExamOption.name);
    } else if (examSlug === 'combined') {
      if (isMounted) setExamDisplayName('Combined DPPs');
    } else {
      if (isMounted) {
        setError("Invalid exam specified.");
        setExamDisplayName(unslugify(examSlug)); 
        setIsLoadingStats(false);
      }
      return;
    }

    const fetchStats = async () => {
      if (!isMounted || !examSlug) return;
      setIsLoadingStats(true);

      let filterParts = ["pyq = false"];
      const examNameToFilter = currentExamOption?.name || '';

      if (examSlug !== 'combined' && examNameToFilter) {
        filterParts.push(`ExamDpp = "${escapeForPbFilter(examNameToFilter)}"`);
      }
      // For 'combined', no ExamDpp filter is added, so it fetches all non-PYQ across DPP-associated exams.

      const filterString = filterParts.join(" && ");

      try {
        const records = await pb.collection('question_bank').getFullList<RecordModel>({
          filter: filterString,
          fields: 'subject,lessonName',
          '$autoCancel': false,
        });

        if (!isMounted) return;

        const stats: Record<string, { chapters: Set<string>, questionCount: number }> = {};
        records.forEach(record => {
          const subject = record.subject;
          const lessonName = record.lessonName;
          if (!subject || !lessonName) return;

          if (!stats[subject]) {
            stats[subject] = { chapters: new Set(), questionCount: 0 };
          }
          stats[subject].chapters.add(lessonName);
          stats[subject].questionCount++;
        });

        const finalStats: Record<string, SubjectStats> = {};
        for (const subject in stats) {
          finalStats[subject] = {
            chapterCount: stats[subject].chapters.size,
            questionCount: stats[subject].questionCount,
          };
        }
        setSubjectStats(finalStats);
      } catch (err) {
        if (!isMounted) return;
        console.error("Failed to fetch subject stats:", err);
        setError("Could not load subject statistics.");
      } finally {
        if (!isMounted) return;
        setIsLoadingStats(false);
      }
    };

    fetchStats();

    return () => {
      isMounted = false;
    };
  }, [examSlug]);

  const subjects = EXAM_SUBJECTS[examSlug] || [];

  if (!examSlug) {
    return (
      <div className="text-center py-10">
        <h1 className="text-2xl font-bold">Exam Not Specified</h1>
        <p className="text-muted-foreground">Could not determine the exam for subject selection.</p>
        <Button onClick={() => router.push(Routes.dpp)} className="mt-4">Go Back to DPP Exams</Button>
      </div>
    );
  }
  
  if (subjects.length === 0 && examSlug !== 'combined') {
     return (
      <div className="text-center py-10">
        <h1 className="text-2xl font-bold">No Subjects Configured</h1>
        <p className="text-muted-foreground">No subjects are configured for "{examDisplayName}".</p>
        <Button onClick={() => router.push(Routes.dpp)} className="mt-4">Go Back to DPP Exams</Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <h1 className="text-2xl font-bold text-destructive">Error</h1>
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={() => router.push(Routes.dpp)} className="mt-4">Go Back to DPP Exams</Button>
      </div>
    );
  }


  return (
    <div className="space-y-8">
      <Card className="shadow-lg border-border bg-card">
        <CardHeader className="p-6">
          <CardTitle className="text-3xl font-bold text-foreground">
            {examDisplayName} - Select Subject
          </CardTitle>
          <CardDescription className="text-md text-muted-foreground">Choose a subject to view available DPP lessons.</CardDescription>
        </CardHeader>
      </Card>

      {isLoadingStats && subjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
            {[...Array(subjects.length)].map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      ) : subjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
          {subjects.map((subject) => {
            const stats = subjectStats[subject];
            const chapterCount = stats ? stats.chapterCount : 0;
            const questionCount = stats ? stats.questionCount : 0;
            return (
              <Link key={subject} href={Routes.dppExamSubjectLessons(examSlug, slugify(subject))} passHref legacyBehavior>
                 <Card as="a" className={cn(
                    "bg-card rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 cursor-pointer group h-full flex flex-col relative overflow-hidden border-2",
                    getSubjectBorderColor(subject) 
                  )}>
                    <CardHeader className="p-5 sm:p-6">
                      <div className={cn(
                        "w-12 h-12 mb-3 rounded-lg flex items-center justify-center",
                        getSubjectIconBgColor(subject) 
                      )}>
                        {getSubjectIcon(subject, "h-6 w-6")}
                      </div>
                      <CardTitle className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors duration-300">{subject}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-grow px-5 sm:px-6 pb-5">
                      <p className="text-sm text-muted-foreground">
                        {chapterCount} Chapters
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {questionCount} Questions
                      </p>
                    </CardContent>
                    <CardFooter className={cn(
                      "p-4 border-t mt-auto",
                       getSubjectIconBgColor(subject) // Use a lighter shade for footer
                    )}>
                      <Button variant="ghost" className="w-full justify-center text-primary group-hover:underline font-medium text-sm h-auto py-2">
                        View Lessons
                        <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </Button>
                    </CardFooter>
                  </Card>
              </Link>
            );
          })}
        </div>
      ) : (
         examSlug === 'combined' ? (
            <Card className="text-center p-10 shadow-md bg-card border-border">
              <CardTitle>Combined DPPs - Subject Selection</CardTitle>
              <CardDescription className="text-muted-foreground">Subject statistics for combined DPPs will be loaded here. Please select a subject to view its lessons.</CardDescription>
            </Card>
         ) : (
            <Card className="text-center p-10 shadow-md bg-card border-border">
              <CardTitle>No Subjects Available</CardTitle>
              <CardDescription className="text-muted-foreground">There are no subjects configured or no non-PYQ DPP questions available for {examDisplayName} in the DPP section yet.</CardDescription>
            </Card>
         )
      )}
    </div>
  );
}
