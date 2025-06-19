
'use client';

import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState, useCallback } from 'react';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, BarChart3, Users, Clock, CheckCircle, TrendingUp, ChevronRight, ListFilter } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import Link from 'next/link';
import { Routes } from '@/lib/constants';
import type { TeacherTestAttempt } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface TestResultDisplay extends TeacherTestAttempt {
    studentName?: string;
    studentEmail?: string;
}

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
      const testRecord = await pb.collection('teacher_tests').getOne(testId, { fields: 'testName,teacherId' });
      if (!isMountedGetter()) return;
      if (testRecord.teacherId !== teacher.id) { if(isMountedGetter()) setError("Unauthorized."); return; }
      setTestName(testRecord.testName || 'Untitled Test');

      const resultRecords = await pb.collection('teacher_test_attempts').getFullList<TestResultDisplay>({
        filter: `teacher_test = "${testId}" && teacher = "${teacher.id}"`,
        sort: '-score', expand: 'student(id,name,email)',
      });
      if (!isMountedGetter()) return;

      const mappedResults = resultRecords.map(r => ({
        ...r,
        studentName: r.expand?.student?.name || 'Unknown Student',
        studentEmail: r.expand?.student?.email || 'N/A',
      }));
      setAllResults(mappedResults);
      setFilteredResults(mappedResults); 

    } catch (err: any) { if (isMountedGetter()) { console.error("Error fetching test results:", err); setError("Could not load test results."); }
    } finally { if (isMountedGetter()) setIsLoading(false); }
  }, [testId, teacher?.id]);

  useEffect(() => { let isMounted = true; fetchTestResults(() => isMounted); return () => { isMounted = false; }; }, [fetchTestResults]);
  
  useEffect(() => {
    let currentResults = [...allResults];
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

  return (
    <div className="p-4 md:p-6">
      <CardHeader className="px-0 pb-4">
        <CardTitle className="text-xl font-semibold flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary"/> Student Results for: {testName}</CardTitle>
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
                <SelectTrigger className="w-full sm:w-[180px] bg-card">
                     <ListFilter className="mr-2 h-4 w-4 text-muted-foreground"/>
                    <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="terminated_time_up">Time Up</SelectItem>
                    <SelectItem value="terminated_manual">Terminated Manually</SelectItem>
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
                  <TableHead className="w-[50px]">Rank</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>%</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResults.map((result, index) => (
                  <TableRow key={result.id}>
                    <TableCell className="font-medium text-muted-foreground">#{index + 1}</TableCell>
                    <TableCell className="font-medium text-foreground">{result.studentName}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{result.studentEmail}</TableCell>
                    <TableCell className="font-semibold text-primary">{result.score} / {result.max_score}</TableCell>
                    <TableCell className="font-semibold">{result.percentage?.toFixed(1)}%</TableCell>
                    <TableCell>
                        <Badge variant={result.status === 'completed' ? 'default' : result.status.startsWith('terminated') ? 'destructive' : 'secondary'}
                               className={result.status === 'completed' ? 'bg-green-500 text-white' : result.status.startsWith('terminated') ? '' : ''}>
                            {result.status.replace(/_/g, ' ')}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">{format(new Date(result.created), "dd MMM yy, HH:mm")}</TableCell>
                    <TableCell className="text-right">
                       <Button variant="link" size="sm" className="p-0 h-auto text-primary" asChild>
                         <Link href={Routes.testResultTeacherTest(result.id)}>View Details</Link>
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
    