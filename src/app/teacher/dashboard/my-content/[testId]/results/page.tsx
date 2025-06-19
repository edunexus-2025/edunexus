
'use client';

import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, BarChart3, Users, Clock, Eye, TrendingUp, ChevronRight, ListFilter, Printer } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { Routes } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// Interface matching the teacher_test_history schema and expanded student
interface FetchedTestHistoryRecord extends RecordModel {
  id: string;
  student: string; // student ID
  score: number;
  max_score: number;
  percentage?: number;
  duration_taken_seconds?: number;
  submitted_at?: string; // ISO Date string
  created: string; // Fallback if submitted_at is missing
  status: 'completed' | 'terminated_time_up' | 'terminated_proctoring' | 'terminated_manual'; // Added terminated_manual
  test_name_cache?: string;
  expand?: {
    student?: {
      id: string;
      name: string;
      email: string;
      avatar?: string; // filename
      avatarUrl?: string; // direct URL
      collectionId?: string;
      collectionName?: string;
    };
  };
}

interface TestResultDisplay extends FetchedTestHistoryRecord {
  studentName?: string;
  studentEmail?: string;
  avatarUrl?: string;
  rank?: number; // Added rank
}


const formatDuration = (totalSeconds?: number): string => {
    if (totalSeconds === undefined || totalSeconds === null || totalSeconds < 0) return 'N/A';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
};

const formatDateToIST = (dateString?: string): string => {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true,
        });
    } catch (e) {
        console.warn("Error formatting date to IST:", e);
        try { // Fallback to a more generic locale if IST fails
            return new Date(dateString).toLocaleDateString('en-GB', {
                year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true
            });
        } catch (fallbackError) { return "Invalid Date"; }
    }
};

const getAvatarFallback = (name?: string) => {
  if (!name) return 'S';
  const nameParts = name.split(' ');
  return nameParts.length > 1 ? nameParts[0][0] + nameParts[nameParts.length - 1][0] : name.substring(0, 2).toUpperCase();
};

export default function TestResultsPage() {
  const params = useParams();
  const router = useRouter();
  const { teacher } = useAuth();
  const testId = typeof params.testId === 'string' ? params.testId : '';

  const [testName, setTestName] = useState<string | null>(null);
  const [allResults, setAllResults] = useState<TestResultDisplay[]>([]);
  const [filteredResults, setFilteredResults] = useState<TestResultDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchTestResults = useCallback(async (isMountedGetter: () => boolean) => {
    if (!testId || !teacher?.id) { if(isMountedGetter()) setIsLoading(false); return; }
    if(isMountedGetter()) setIsLoading(true);

    try {
      const testRecord = await pb.collection('teacher_tests').getOne(testId, { fields: 'testName,teacherId', '$autoCancel': false });
      if (!isMountedGetter()) return;
      if (testRecord.teacherId !== teacher.id) { if(isMountedGetter()) setError("Unauthorized."); return; }
      setTestName(testRecord.testName || 'Untitled Test');

      const resultRecords = await pb.collection('teacher_test_history').getFullList<FetchedTestHistoryRecord>({
        filter: `teacher_test = "${testId}" && teacher = "${teacher.id}"`, // Ensure results are for this teacher
        sort: '-score', 
        expand: 'student', // Simpler expand, assuming default user fields are sufficient or set in PB
        fields: 'id,student,score,max_score,duration_taken_seconds,submitted_at,status,test_name_cache,percentage,expand.student.id,expand.student.name,expand.student.email,expand.student.avatar,expand.student.avatarUrl,expand.student.collectionId,expand.student.collectionName,created',
        '$autoCancel': false,
      });
      if (!isMountedGetter()) return;

      const mappedResults = resultRecords.map((r, index) => {
        let avatarUrlResult;
        const studentData = r.expand?.student;
        if (!studentData) {
            console.warn(`Student data missing for history record ${r.id}. Expand might have failed or relation is empty.`);
        }

        if (studentData?.avatarUrl && typeof studentData.avatarUrl === 'string' && studentData.avatarUrl.startsWith('http')) {
          avatarUrlResult = studentData.avatarUrl;
        } else if (studentData?.avatar && typeof studentData.avatar === 'string' && studentData.collectionId && studentData.collectionName) {
          try {
            avatarUrlResult = pb.files.getUrl(studentData as RecordModel, studentData.avatar);
          } catch (e) { console.warn("Error getting student avatar URL for results page:", e); avatarUrlResult = undefined; }
        }
        
        if (!avatarUrlResult && studentData?.name && typeof studentData.name === 'string') {
            avatarUrlResult = `https://ui-avatars.com/api/?name=${encodeURIComponent(studentData.name.charAt(0))}&background=random&color=fff`;
        }

        return {
          ...r,
          studentName: studentData?.name || 'Unknown Student',
          studentEmail: studentData?.email || 'N/A',
          avatarUrl: avatarUrlResult,
          submitted_at: r.submitted_at || r.created, // Use created as fallback for submission time
          rank: index + 1, // Basic rank based on initial sort by score
        };
      });
      setAllResults(mappedResults);
      setFilteredResults(mappedResults); 

    } catch (err: any) { 
      if (isMountedGetter()) { 
        const clientError = err as ClientResponseError;
        if (clientError?.isAbort || (clientError?.name === 'ClientResponseError' && clientError?.status === 0)) {
          console.warn('TeacherTestResultsPage: Fetch results request was cancelled.');
        } else {
          console.error("Error fetching test results:", clientError.data || clientError); 
          setError(`Could not load test results. Details: ${clientError.data?.message || clientError.message}`); 
        }
      }
    } finally { if (isMountedGetter()) setIsLoading(false); }
  }, [testId, teacher?.id]);

  useEffect(() => { let isMounted = true; fetchTestResults(() => isMounted); return () => { isMounted = false; }; }, [fetchTestResults]);
  
  useEffect(() => {
    let currentResults = [...allResults];
    // Sort by score descending, then by duration ascending (faster is better)
    currentResults.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return (a.duration_taken_seconds || Infinity) - (b.duration_taken_seconds || Infinity);
    });
    // Assign ranks
    let rank = 0;
    let lastScore = -Infinity;
    let lastDuration = Infinity;
    currentResults = currentResults.map((r, index) => {
      if (r.score !== lastScore || (r.duration_taken_seconds || Infinity) !== lastDuration) {
        rank = index + 1;
        lastScore = r.score;
        lastDuration = r.duration_taken_seconds || Infinity;
      }
      return { ...r, rank };
    });

    if (filterStatus !== 'all') {
      currentResults = currentResults.filter(r => r.status === filterStatus);
    }
    if (searchTerm) {
      const termLower = searchTerm.toLowerCase();
      currentResults = currentResults.filter(r => 
        r.studentName?.toLowerCase().includes(termLower) || 
        r.studentEmail?.toLowerCase().includes(termLower)
      );
    }
    setFilteredResults(currentResults);
  }, [allResults, filterStatus, searchTerm]);


  if (isLoading) { return (<Card><CardHeader><Skeleton className="h-8 w-3/4" /><Skeleton className="h-4 w-1/2 mt-1" /></CardHeader><CardContent><Skeleton className="h-10 w-full mb-4" /><Skeleton className="h-64 w-full" /></CardContent></Card>); }
  if (error) { return (<Card className="text-center border-destructive bg-destructive/10 p-6"><AlertCircle className="mx-auto h-10 w-10 text-destructive mb-3" /><CardTitle className="text-destructive">Error</CardTitle><CardDescription className="text-destructive/80">{error}</CardDescription></Card>); }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 md:p-6">
      <CardHeader className="px-0 pb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <CardTitle className="text-xl font-semibold flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary"/> Student Results for: {testName}</CardTitle>
            <Button onClick={handlePrint} variant="outline" size="sm"><Printer className="mr-2 h-4 w-4"/> Print Results</Button>
        </div>
        <CardDescription>View performance of students. Total Attempts: {allResults.length}. Displaying: {filteredResults.length}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-0">
        <div className="flex flex-col sm:flex-row gap-3">
            <Input 
                type="search" 
                placeholder="Search by student name or email..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-grow bg-card"
            />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-[220px] bg-card">
                     <ListFilter className="mr-2 h-4 w-4 text-muted-foreground"/>
                    <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="terminated_time_up">Terminated (Time Up)</SelectItem>
                    <SelectItem value="terminated_manual">Terminated (Manual)</SelectItem>
                    <SelectItem value="terminated_proctoring">Terminated (Proctoring)</SelectItem>
                </SelectContent>
            </Select>
        </div>

        {filteredResults.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed rounded-lg bg-card">
            <Users className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">{searchTerm || filterStatus !== 'all' ? "No results match your filters." : "No students have attempted this test yet."}</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[calc(100vh-420px)] border rounded-md bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px] sm:w-[50px] text-center">Rank</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center hidden sm:table-cell">%</TableHead>
                  <TableHead className="text-center">Time</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Submitted (IST)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResults.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell className="font-medium text-muted-foreground text-center">#{result.rank}</TableCell>
                    <TableCell className="font-medium text-foreground">
                        <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={result.avatarUrl} alt={result.studentName} data-ai-hint="student profile"/>
                                <AvatarFallback>{getAvatarFallback(result.studentName)}</AvatarFallback>
                            </Avatar>
                            <span>{result.studentName}</span>
                        </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{result.studentEmail}</TableCell>
                    <TableCell className="font-semibold text-primary text-center">{result.score} / {result.max_score}</TableCell>
                    <TableCell className="font-semibold text-center hidden sm:table-cell">{result.percentage?.toFixed(1)}%</TableCell>
                    <TableCell className="text-xs text-muted-foreground text-center">{formatDuration(result.duration_taken_seconds)}</TableCell>
                    <TableCell className="text-center">
                        <Badge 
                            variant={result.status === 'completed' ? 'default' : result.status?.startsWith('terminated') ? 'destructive' : 'secondary'}
                            className={result.status === 'completed' ? 'bg-green-500 text-white hover:bg-green-600' : result.status?.startsWith('terminated') ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
                        >
                            {result.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">{formatDateToIST(result.submitted_at || result.created)}</TableCell>
                    <TableCell className="text-right">
                       <Button variant="link" size="sm" className="p-0 h-auto text-primary" asChild>
                         <Link href={Routes.teacherStudentResultView(result.id)}>
                           <Eye className="mr-1 h-3.5 w-3.5"/>View Report
                         </Link>
                       </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </div>
  );
}
    
