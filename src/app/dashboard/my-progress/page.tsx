
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, History, ListChecks, TrendingUp, ArrowRight, Filter } from 'lucide-react';
import Link from 'next/link';
import { Routes } from '@/lib/constants';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Added Tabs import

interface TestResultSummary extends RecordModel {
  id: string;
  test_name: string;
  score: number;
  max_score: number;
  percentage: number;
  status: string;
  created: string; // Submission date
  inferredSubject?: string;
  test_type_model?: 'Chapterwise' | 'Full_length' | 'Challenge'; // Corrected to Full_length
  test_id: string; // Added to fetch original test details
  original_total_questions?: number; // From test_pages
  original_duration_minutes?: number; // From test_pages
}

const inferSubjectFromTestName = (testName: string): string | undefined => {
  const lowerTestName = testName.toLowerCase();
  if (lowerTestName.includes("physics")) return "Physics";
  if (lowerTestName.includes("chemistry")) return "Chemistry";
  if (lowerTestName.includes("maths") || lowerTestName.includes("mathematics")) return "Mathematics";
  if (lowerTestName.includes("biology")) return "Biology";
  return undefined;
};


export default function MyProgressPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [allTestResults, setAllTestResults] = useState<TestResultSummary[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterTestType, setFilterTestType] = useState<'all' | 'chapterwise' | 'fullLength' | 'challenge'>('chapterwise');
  const [filterSubject, setFilterSubject] = useState<string>('all');

  const fetchTestResults = useCallback(async () => {
    if (!user?.id) {
      setIsLoadingResults(false);
      setAllTestResults([]);
      return;
    }
    setIsLoadingResults(true);
    setError(null);
    try {
      const resultRecords = await pb.collection('test_chapterwise_result').getFullList<TestResultSummary>({
        filter: `user = "${user.id}"`,
        sort: '-created',
        fields: 'id,test_name,score,max_score,percentage,status,created,test_id,total_questions', // Include test_id and total_questions
      });

      const mappedResultsWithOriginalDetails = await Promise.all(
        resultRecords.map(async (r) => {
          let originalTotalQuestions: number | undefined = r.total_questions; // Fallback to attempted test's total_questions
          let originalDurationMinutes: number | undefined = undefined;

          if (r.test_id) {
            try {
              const testPageRecord = await pb.collection('test_pages').getOne(r.test_id, {
                fields: 'TotalQuestion,TotalTime',
              });
              originalTotalQuestions = typeof testPageRecord.TotalQuestion === 'number' ? testPageRecord.TotalQuestion : r.total_questions;
              originalDurationMinutes = typeof testPageRecord.TotalTime === 'string' ? parseInt(testPageRecord.TotalTime, 10) : (typeof testPageRecord.TotalTime === 'number' ? testPageRecord.TotalTime : undefined);
            } catch (testPageError) {
              console.warn(`Failed to fetch test_pages record for test_id ${r.test_id}:`, testPageError);
              // Keep fallback values if test_pages fetch fails
            }
          }

          return {
            ...r,
            inferredSubject: inferSubjectFromTestName(r.test_name),
            test_type_model: 'Chapterwise' as const, // Assuming these are all chapterwise for now
            original_total_questions: originalTotalQuestions,
            original_duration_minutes: originalDurationMinutes,
          };
        })
      );
      setAllTestResults(mappedResultsWithOriginalDetails);

    } catch (err: any) {
      const clientError = err as ClientResponseError;
      if (clientError.isAbort || (clientError.name === 'ClientResponseError' && clientError.status === 0)) {
        console.warn("MyProgressPage: Fetch test results request was autocancelled. This is often benign in development due to React StrictMode. Message:", clientError.message);
      } else {
        console.error("Failed to fetch test results. Message:", clientError.message, "Data:", clientError.data, "Full Error:", clientError);
        setError(`Could not load test history. Error: ${clientError.data?.message || clientError.message}`);
      }
    } finally {
      setIsLoadingResults(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!isAuthLoading) {
      fetchTestResults();
    }
  }, [isAuthLoading, fetchTestResults]);

  const availableSubjects = useMemo(() => {
    const subjects = new Set<string>();
    if (filterTestType === 'chapterwise') {
      allTestResults.forEach(result => {
        if (result.inferredSubject) {
          subjects.add(result.inferredSubject);
        }
      });
    }
    return ['all', ...Array.from(subjects).sort()];
  }, [allTestResults, filterTestType]);

  const filteredTestResults = useMemo(() => {
    return allTestResults.filter(result => {
      let typeMatch = false;
      if (filterTestType === 'all') {
        typeMatch = true;
      } else if (filterTestType === 'chapterwise') {
        typeMatch = result.test_type_model === 'Chapterwise';
      } else if (filterTestType === 'fullLength') {
        typeMatch = result.test_type_model === 'Full_length'; // Corrected
      } else if (filterTestType === 'challenge') {
        typeMatch = result.test_type_model === 'Challenge';
      }

      const subjectMatch = filterTestType !== 'chapterwise' || filterSubject === 'all' || result.inferredSubject === filterSubject;

      return typeMatch && subjectMatch;
    });
  }, [allTestResults, filterTestType, filterSubject]);


  if (isAuthLoading || isLoadingResults) {
    return (
      <div className="space-y-8 p-4 md:p-6">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">My Progress</h1>
        </div>
        <Tabs defaultValue="tests" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="tests">Tests ({isLoadingResults ? '...' : '0'})</TabsTrigger>
            <TabsTrigger value="quizzes" disabled>Quizzes (0)</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-col md:flex-row gap-2 mb-6">
            <Skeleton className="h-10 w-full md:w-48" />
            <Skeleton className="h-10 w-full md:w-48" />
        </div>
        
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8 p-4 md:p-6 text-center">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <TrendingUp className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">My Progress</h1>
        </div>
        <Card className="shadow-lg border-destructive bg-destructive/10 max-w-md mx-auto p-6">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-3" />
          <CardTitle className="text-xl text-destructive">Error Loading Progress</CardTitle>
          <CardDescription className="text-destructive/80">{error}</CardDescription>
        </Card>
      </div>
    );
  }

  const testsCount = filteredTestResults.filter(r => r.test_type_model === 'Chapterwise' || r.test_type_model === 'Full_length').length;

  return (
    <div className="space-y-8 p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div className="flex items-center gap-2">
            <TrendingUp className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">My Test History</h1>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <Select value={filterTestType} onValueChange={(value) => {
                setFilterTestType(value as 'all' | 'chapterwise' | 'fullLength' | 'challenge');
                if (value !== 'chapterwise') setFilterSubject('all');
            }}>
                <SelectTrigger className="w-full sm:w-[200px]">
                    <Filter className="mr-2 h-4 w-4 text-muted-foreground"/>
                    <SelectValue placeholder="Filter by Test Type" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="chapterwise">Chapterwise</SelectItem>
                    <SelectItem value="all">All My Tests</SelectItem>
                    <SelectItem value="fullLength" disabled>Full Length (Coming Soon)</SelectItem>
                    <SelectItem value="challenge" disabled>Challenges (Coming Soon)</SelectItem>
                </SelectContent>
            </Select>
            {filterTestType === 'chapterwise' && (
                <Select value={filterSubject} onValueChange={setFilterSubject} disabled={availableSubjects.length <= 1}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                         <Filter className="mr-2 h-4 w-4 text-muted-foreground"/>
                        <SelectValue placeholder="Filter by Subject" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableSubjects.map(subject => (
                            <SelectItem key={subject} value={subject}>
                                {subject === 'all' ? 'All Subjects' : subject}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}
        </div>
      </div>
      
      <Tabs defaultValue="tests" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="tests">Tests ({testsCount})</TabsTrigger>
          <TabsTrigger value="quizzes" disabled>Quizzes (0)</TabsTrigger>
        </TabsList>
        <TabsContent value="tests">
          {filteredTestResults.length === 0 ? (
            <Card className="text-center p-10 shadow-md">
              <ListChecks className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
              <CardTitle className="text-xl font-semibold">No Test History Found</CardTitle>
              <CardDescription className="text-muted-foreground mt-2">
                No results match your current filters.
                <br />
                <Link href={Routes.testSeries} className="text-primary hover:underline">
                  Explore Test Series
                </Link> to attempt tests.
              </CardDescription>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredTestResults.map((result) => (
                <Card key={result.id} className="shadow-sm hover:shadow-md transition-shadow rounded-lg border border-border bg-card">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex-grow min-w-0">
                      <h3 className="text-base font-semibold text-foreground truncate group-hover:underline" title={result.test_name}>
                        {result.test_name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {result.original_total_questions !== undefined ? `${result.original_total_questions} Qs` : `${result.total_questions} Qs (Attempted)`}
                        {result.max_score !== undefined && ` | ${result.max_score} Marks`}
                        {result.original_duration_minutes !== undefined && ` | ${result.original_duration_minutes} Min`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(result.created), "dd MMM yy 'at' h:mm a")}
                      </p>
                    </div>
                    
                    <Link href={Routes.testResult(result.id)} passHref>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="border-green-500 text-green-600 hover:bg-green-500/10 hover:text-green-700 flex-shrink-0"
                      >
                        Result
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="quizzes">
            <Card className="text-center p-10 shadow-md">
                <ListChecks className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
                <CardTitle className="text-xl font-semibold">No Quizzes Yet</CardTitle>
                <CardDescription className="text-muted-foreground mt-2">
                    Quiz history will appear here once you attempt quizzes.
                </CardDescription>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
