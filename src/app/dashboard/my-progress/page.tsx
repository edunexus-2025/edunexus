'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, History, ListChecks, TrendingUp, ArrowRight, Filter, UserCircle, Printer } from 'lucide-react';
import Link from 'next/link';
import { Routes, escapeForPbFilter } from '@/lib/constants';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TeacherTestAttempt } from '@/lib/types'; // Using existing TeacherTestAttempt as base

interface PlatformTestResultRecord extends RecordModel {
  id: string;
  test_name: string;
  score: number;
  max_score: number;
  percentage: number;
  status: string;
  created: string;
  test_id: string;
  total_questions?: number;
  expand?: {
    test_id?: {
      TotalQuestion?: number;
      TotalTime?: string | number;
      Model?: 'Chapterwise' | 'Full_length';
    };
  };
}

// Combined interface for displaying results
interface CombinedTestResultSummary extends RecordModel {
  id: string; // Attempt ID
  test_name: string;
  score: number;
  max_score: number;
  percentage: number;
  status: string;
  submission_date: string;
  
  sourceType: 'platform' | 'teacher';
  original_test_id: string; 

  platform_test_type?: 'Chapterwise' | 'Full_length' | 'Challenge';
  platform_inferred_subject?: string;

  teacherId?: string;
  teacherName?: string;

  original_total_questions?: number;
  original_duration_minutes?: number;
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
  const [allCombinedResults, setAllCombinedResults] = useState<CombinedTestResultSummary[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uniqueTeachers, setUniqueTeachers] = useState<{ id: string; name: string }[]>([]);

  const [filterTestType, setFilterTestType] = useState<'all' | 'platform_chapterwise' | 'platform_full_length' | 'teacher_test'>('platform_chapterwise');
  const [filterPlatformSubject, setFilterPlatformSubject] = useState<string>('all');
  const [filterByTeacherId, setFilterByTeacherId] = useState<string>('all');

  const fetchAllResults = useCallback(async () => {
    if (!user?.id) {
      setIsLoadingResults(false);
      setAllCombinedResults([]);
      return;
    }
    setIsLoadingResults(true);
    setError(null);
    setUniqueTeachers([]);

    try {
      // 1. Fetch Platform Test Results
      const platformResultRecords = await pb.collection('test_chapterwise_result').getFullList<PlatformTestResultRecord>({
        filter: `user = "${user.id}"`,
        sort: '-created',
        expand: 'test_id',
        fields: 'id,test_name,score,max_score,percentage,status,created,test_id,total_questions,expand.test_id.TotalQuestion,expand.test_id.TotalTime,expand.test_id.Model',
        '$autoCancel': false,
      });

      const platformResultsMapped: CombinedTestResultSummary[] = platformResultRecords.map(r => {
        const testPageDetails = r.expand?.test_id as RecordModel | undefined;
        let durationMinutes: number | undefined;
        if (testPageDetails?.TotalTime) {
          const parsedTime = parseInt(String(testPageDetails.TotalTime), 10);
          if (!isNaN(parsedTime)) durationMinutes = parsedTime;
        }
        return {
          id: r.id, test_name: r.test_name, score: r.score, max_score: r.max_score, percentage: r.percentage,
          status: r.status, submission_date: r.created, sourceType: 'platform', original_test_id: r.test_id,
          platform_test_type: testPageDetails?.Model as CombinedTestResultSummary['platform_test_type'] || 'Chapterwise',
          platform_inferred_subject: inferSubjectFromTestName(r.test_name),
          original_total_questions: typeof testPageDetails?.TotalQuestion === 'number' ? testPageDetails.TotalQuestion : r.total_questions,
          original_duration_minutes: durationMinutes,
        };
      });

      // 2. Fetch Teacher Test Results
      const teacherTestRecords = await pb.collection('teacher_test_history').getFullList<TeacherTestAttempt>({
        filter: `student = "${user.id}"`,
        sort: '-created',
        expand: 'teacher(id,name), teacher_test(Test_Subject,TotalTime,TotalQuestion)',
        fields: 'id,score,max_score,percentage,status,submitted_at,created,teacher_test,student,teacher,test_name_cache,total_questions_in_test_cache,duration_taken_seconds,expand.teacher.id,expand.teacher.name,expand.teacher_test.Test_Subject,expand.teacher_test.TotalTime,expand.teacher_test.TotalQuestion',
        '$autoCancel': false,
      });
      
      const teachersMap = new Map<string, string>();
      const teacherResultsMapped: CombinedTestResultSummary[] = teacherTestRecords.map(r => {
        const teacherDetails = r.expand?.teacher as { id: string; name: string } | undefined;
        const originalTestDetails = r.expand?.teacher_test as { Test_Subject?: string; TotalTime?: string | number; TotalQuestion?: number } | undefined;
        const teacherId = teacherDetails?.id || r.teacher;
        const teacherName = teacherDetails?.name || 'Unknown Teacher';
        if (teacherId && teacherName) teachersMap.set(teacherId, teacherName);

        let durationMins: number | undefined;
        if (originalTestDetails?.TotalTime) {
            const parsed = parseInt(String(originalTestDetails.TotalTime), 10);
            if (!isNaN(parsed)) durationMins = parsed;
        } else if (r.duration_taken_seconds !== undefined) {
            durationMins = Math.round(r.duration_taken_seconds / 60);
        }

        return {
          id: r.id, test_name: r.test_name_cache || 'Teacher Test', score: r.score, max_score: r.max_score,
          percentage: r.percentage || 0, status: r.status, submission_date: r.submitted_at || r.created,
          sourceType: 'teacher', original_test_id: r.teacher_test, teacherId: teacherId, teacherName: teacherName,
          platform_inferred_subject: originalTestDetails?.Test_Subject || undefined, // Use subject from original test
          original_total_questions: typeof originalTestDetails?.TotalQuestion === 'number' ? originalTestDetails.TotalQuestion : r.total_questions_in_test_cache,
          original_duration_minutes: durationMins,
        };
      });
      setUniqueTeachers(Array.from(teachersMap.entries()).map(([id, name]) => ({ id, name })));

      const combined = [...platformResultsMapped, ...teacherResultsMapped];
      combined.sort((a, b) => new Date(b.submission_date).getTime() - new Date(a.submission_date).getTime());
      setAllCombinedResults(combined);

    } catch (err: any) {
      const clientError = err as ClientResponseError;
       if (clientError?.isAbort || (clientError?.name === 'ClientResponseError' && clientError?.status === 0)) {
        console.warn("MyProgressPage: Fetch results request was cancelled.");
      } else {
        console.error("Failed to fetch results. Full Error:", clientError.data || clientError);
        setError(`Could not load test history. Error: ${clientError.data?.message || clientError.message}`);
      }
    } finally {
      setIsLoadingResults(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!isAuthLoading) {
      fetchAllResults();
    }
  }, [isAuthLoading, fetchAllResults]);

  const availablePlatformSubjects = useMemo(() => {
    const subjects = new Set<string>();
    allCombinedResults.forEach(result => {
      if (result.sourceType === 'platform' && result.platform_inferred_subject) {
        subjects.add(result.platform_inferred_subject);
      }
    });
    return ['all', ...Array.from(subjects).sort()];
  }, [allCombinedResults]);

  const filteredTestResults = useMemo(() => {
    return allCombinedResults.filter(result => {
      let typeMatch = false;
      if (filterTestType === 'all') { typeMatch = true;
      } else if (filterTestType === 'platform_chapterwise') { typeMatch = result.sourceType === 'platform' && result.platform_test_type === 'Chapterwise';
      } else if (filterTestType === 'platform_full_length') { typeMatch = result.sourceType === 'platform' && result.platform_test_type === 'Full_length';
      } else if (filterTestType === 'teacher_test') { typeMatch = result.sourceType === 'teacher'; }

      let subjectMatch = true;
      if (filterTestType === 'platform_chapterwise' && result.sourceType === 'platform') {
        subjectMatch = filterPlatformSubject === 'all' || result.platform_inferred_subject === filterPlatformSubject;
      }

      let teacherMatch = true;
      if (filterByTeacherId !== 'all') {
        teacherMatch = result.sourceType === 'teacher' && result.teacherId === filterByTeacherId;
        // If filtering by a specific teacher, and the current result is not by that teacher, it fails the teacherMatch.
        // Also, if it's a platform test, it doesn't match a specific teacher filter.
        if (result.sourceType !== 'teacher' || (result.sourceType === 'teacher' && result.teacherId !== filterByTeacherId)) {
            teacherMatch = false;
        }
      }
      
      return typeMatch && subjectMatch && teacherMatch;
    });
  }, [allCombinedResults, filterTestType, filterPlatformSubject, filterByTeacherId]);

  const testsCount = filteredTestResults.length;
  const handlePrint = () => { window.print(); };


  if (isAuthLoading || (isLoadingResults && allCombinedResults.length === 0)) {
    return (
      <div className="space-y-8 p-4 md:p-6">
        <div className="flex items-center gap-2 mb-6"><TrendingUp className="h-8 w-8 text-primary" /><h1 className="text-3xl font-bold text-foreground">My Test History</h1></div>
        <Tabs defaultValue="tests" className="w-full"><TabsList className="grid w-full grid-cols-1 mb-6"><TabsTrigger value="tests">Tests ({isLoadingResults ? '...' : '0'})</TabsTrigger></TabsList></Tabs>
        <div className="flex flex-col md:flex-row gap-2 mb-6"><Skeleton className="h-10 w-full md:w-48" /><Skeleton className="h-10 w-full md:w-48" />{uniqueTeachers.length > 0 && <Skeleton className="h-10 w-full md:w-48" />}</div>
        <div className="space-y-4">{[...Array(3)].map((_, i) => (<Skeleton key={i} className="h-24 w-full rounded-lg" />))}</div>
      </div>
    );
  }

  if (error) {
    return ( <div className="space-y-8 p-4 md:p-6 text-center"> <div className="flex items-center gap-2 mb-6 justify-center"><TrendingUp className="h-8 w-8 text-primary" /><h1 className="text-3xl font-bold text-foreground">My Test History</h1></div> <Card className="shadow-lg border-destructive bg-destructive/10 max-w-md mx-auto p-6"><AlertCircle className="mx-auto h-12 w-12 text-destructive mb-3" /><CardTitle className="text-xl text-destructive">Error Loading Progress</CardTitle><CardDescription className="text-destructive/80">{error}</CardDescription></Card> </div> );
  }

  return (
    <div className="space-y-8 p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div className="flex items-center gap-2"><TrendingUp className="h-8 w-8 text-primary" /><h1 className="text-3xl font-bold text-foreground">My Test History</h1></div>
        <Button onClick={handlePrint} variant="outline" size="sm"><Printer className="mr-2 h-4 w-4"/> Print Results</Button>
      </div>
       <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto md:justify-end">
          <Select value={filterTestType} onValueChange={(value) => { setFilterTestType(value as typeof filterTestType); if (value !== 'platform_chapterwise') setFilterPlatformSubject('all'); if (value !== 'teacher_test' && value !== 'all') setFilterByTeacherId('all'); }}>
            <SelectTrigger className="w-full sm:w-auto min-w-[200px]"><Filter className="mr-2 h-4 w-4 text-muted-foreground"/><SelectValue placeholder="Filter by Test Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All My Tests</SelectItem>
              <SelectItem value="platform_chapterwise">Platform: Chapterwise</SelectItem>
              <SelectItem value="platform_full_length">Platform: Full Length</SelectItem>
              <SelectItem value="teacher_test">Tests by Teacher</SelectItem>
            </SelectContent>
          </Select>

          {filterTestType === 'platform_chapterwise' && (
            <Select value={filterPlatformSubject} onValueChange={setFilterPlatformSubject} disabled={availablePlatformSubjects.length <= 1}>
              <SelectTrigger className="w-full sm:w-auto min-w-[180px]"><Filter className="mr-2 h-4 w-4 text-muted-foreground"/><SelectValue placeholder="Filter by Subject" /></SelectTrigger>
              <SelectContent>{availablePlatformSubjects.map(subject => (<SelectItem key={subject} value={subject}>{subject === 'all' ? 'All Subjects' : subject}</SelectItem>))}</SelectContent>
            </Select>
          )}

          {uniqueTeachers.length > 0 && (filterTestType === 'all' || filterTestType === 'teacher_test') && (
            <Select value={filterByTeacherId} onValueChange={setFilterByTeacherId}>
              <SelectTrigger className="w-full sm:w-auto min-w-[200px]"><UserCircle className="mr-2 h-4 w-4 text-muted-foreground"/><SelectValue placeholder="Filter by Teacher" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Teachers</SelectItem>{uniqueTeachers.map(teacher => (<SelectItem key={teacher.id} value={teacher.id}>{teacher.name}</SelectItem>))}</SelectContent>
            </Select>
          )}
        </div>
      
      <Tabs defaultValue="tests" className="w-full">
        <TabsList className="grid w-full grid-cols-1 mb-6">
          <TabsTrigger value="tests">Test Attempts ({testsCount})</TabsTrigger>
        </TabsList>
        <TabsContent value="tests">
          {filteredTestResults.length === 0 ? (
            <Card className="text-center p-10 shadow-md"><ListChecks className="mx-auto h-16 w-16 text-muted-foreground mb-4" /><CardTitle className="text-xl font-semibold">No Test History Found</CardTitle><CardDescription className="text-muted-foreground mt-2">No results match your current filters.<br /><Link href={Routes.testSeries} className="text-primary hover:underline">Explore Test Series</Link> or check tests from your teacher.</CardDescription></Card>
          ) : (
            <div className="space-y-3">
              {filteredTestResults.map((result) => {
                const resultLink = result.sourceType === 'platform' ? Routes.testResult(result.id) : Routes.testResultTeacherTest(result.id);
                const durationText = result.original_duration_minutes !== undefined ? `${result.original_duration_minutes} Min` : (result.sourceType === 'teacher' && (result as TeacherTestAttempt).duration_taken_seconds !== undefined ? `${Math.round((result as TeacherTestAttempt).duration_taken_seconds! / 60)} Min` : 'N/A Time');
                return (
                  <Card key={`${result.sourceType}-${result.id}`} className="shadow-sm hover:shadow-md transition-shadow rounded-lg border border-border bg-card">
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="flex-grow min-w-0">
                        <h3 className="text-base font-semibold text-foreground truncate group-hover:underline" title={result.test_name}>{result.test_name}</h3>
                        {result.sourceType === 'teacher' && result.teacherName && (<p className="text-xs text-purple-600 dark:text-purple-400">By: {result.teacherName}</p>)}
                        <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2 gap-y-1 items-center">
                          <span>{result.original_total_questions !== undefined ? `${result.original_total_questions} Qs` : `${result.max_score} Marks Max`}</span>
                          <span>&bull;</span><span>{durationText}</span>
                          {result.sourceType === 'platform' && result.platform_test_type && <><span>&bull;</span><Badge variant="outline" className="text-xs">{result.platform_test_type}</Badge></>}
                          {result.sourceType === 'platform' && result.platform_inferred_subject && <><span>&bull;</span><Badge variant="secondary" className="text-xs">{result.platform_inferred_subject}</Badge></>}
                          {result.sourceType === 'teacher' && <Badge variant="outline" className="text-xs border-purple-500 text-purple-600 bg-purple-500/10">Teacher Test</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{format(new Date(result.submission_date), "dd MMM yy 'at' h:mm a")}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                         <p className="text-sm font-semibold text-primary">{result.score}/{result.max_score} <span className="text-xs text-muted-foreground">({result.percentage.toFixed(1)}%)</span></p>
                         <Link href={resultLink} passHref><Button variant="outline" size="sm" className="border-green-500 text-green-600 hover:bg-green-500/10 hover:text-green-700">View Report</Button></Link>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
