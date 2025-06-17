
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, BookOpen, Atom, FlaskConical, Sigma, Dna, ChevronRight, Loader2, AlertCircle, FileText } from 'lucide-react';
import { EXAM_SUBJECTS, Routes, unslugify, slugify, DPP_EXAM_OPTIONS, escapeForPbFilter } from '@/lib/constants';
import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import pb from '@/lib/pocketbase';
import type { RecordModel } from 'pocketbase';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const getSubjectIcon = (subjectName: string, sizeClass = "h-6 w-6 sm:h-7 sm:w-7") => {
  switch (subjectName.toLowerCase()) {
    case 'physics': return <Atom className={cn("text-orange-500", sizeClass)} />;
    case 'chemistry': return <FlaskConical className={cn("text-green-500", sizeClass)} />;
    case 'mathematics': return <Sigma className={cn("text-blue-500", sizeClass)} />;
    case 'biology': return <Dna className={cn("text-teal-500", sizeClass)} />;
    default: return <FileText className={cn("text-gray-500", sizeClass)} />;
  }
};

const getSubjectThemeColor = (subjectName: string): string => {
    switch (subjectName.toLowerCase()) {
      case 'physics': return 'orange';
      case 'chemistry': return 'green';
      case 'mathematics': return 'blue';
      case 'biology': return 'teal';
      default: return 'gray';
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
    return () => { isMounted = false; };
  }, [examSlug]);

  const subjects = EXAM_SUBJECTS[examSlug] || [];

  if (!examSlug || (subjects.length === 0 && examSlug !== 'combined')) {
    return (
      <div className="text-center py-10">
        <h1 className="text-2xl font-bold">Exam Not Found or No Subjects</h1>
        <p className="text-muted-foreground">Could not determine subjects for "{examDisplayName}".</p>
        <Button onClick={() => router.push(Routes.dpp)} className="mt-4">Go Back to DPP Exams</Button>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="text-center py-10">
        <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-destructive">Error Loading Subjects</h1>
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={() => router.push(Routes.dpp)} className="mt-4">Go Back to DPP Exams</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-xl border-none bg-transparent">
        <CardHeader className="p-0 text-center">
          <CardTitle className="text-3xl font-bold text-foreground">
            {examDisplayName} - Select Subject
          </CardTitle>
          <CardDescription className="text-md text-muted-foreground mt-1">Choose a subject to view available DPP lessons.</CardDescription>
        </CardHeader>
      </Card>

      {isLoadingStats && subjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(subjects.length || 3)].map((_, i) => 
              <Card key={i} className="rounded-xl shadow-md h-48 bg-card border border-border">
                <CardContent className="p-5 flex flex-col justify-between h-full">
                  <Skeleton className="h-8 w-3/4" />
                  <div className="space-y-1 mt-auto">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                </CardContent>
              </Card>
            )}
        </div>
      ) : subjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects.map((subject) => {
            const stats = subjectStats[subject];
            const chapterCount = stats ? stats.chapterCount : 0;
            const questionCount = stats ? stats.questionCount : 0;
            const themeColor = getSubjectThemeColor(subject);

            return (
              <Link key={subject} href={Routes.dppExamSubjectLessons(examSlug, slugify(subject))} passHref>
                <Card className={cn(
                  "bg-card rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 cursor-pointer group h-full flex flex-col relative overflow-hidden border border-border",
                  `hover:border-${themeColor}-500/50 dark:hover:border-${themeColor}-400/50`
                )}>
                  <CardHeader className="pb-3 pt-5 px-5">
                     <div className={cn("p-3 rounded-lg mb-3 w-fit transition-colors duration-300", 
                        `bg-${themeColor}-100 dark:bg-${themeColor}-500/20 group-hover:bg-${themeColor}-500/20 dark:group-hover:bg-${themeColor}-500/30`
                      )}>
                        {getSubjectIcon(subject, "h-7 w-7")}
                      </div>
                    <CardTitle className="text-xl font-bold text-foreground group-hover:text-primary transition-colors duration-300">
                      {subject}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow px-5 pb-4">
                    <p className="text-xs text-muted-foreground">
                      {chapterCount} Chapters &nbsp;&bull;&nbsp; {questionCount} Questions
                    </p>
                  </CardContent>
                  <CardFooter className="p-5 border-t mt-auto bg-muted/20 group-hover:bg-primary/5 transition-colors">
                    <span className="text-sm font-medium text-primary group-hover:underline flex items-center justify-between w-full">
                      View Lessons <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </span>
                  </CardFooter>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
         examSlug === 'combined' ? (
            <Card className="text-center p-10 shadow-md bg-card border border-border">
              <CardTitle className="text-xl font-semibold">Combined DPPs - Select Subject</CardTitle>
              <CardDescription className="text-muted-foreground mt-1">Subject statistics for combined DPPs will be loaded here. Please select a subject to view its lessons.</CardDescription>
            </Card>
         ) : (
            <Card className="text-center p-10 shadow-md bg-card border border-border">
              <CardTitle className="text-xl font-semibold">No Subjects Available</CardTitle>
              <CardDescription className="text-muted-foreground mt-1">There are no subjects configured or no non-PYQ DPP questions available for {examDisplayName} in the DPP section yet.</CardDescription>
            </Card>
         )
      )}
    </div>
  );
}
