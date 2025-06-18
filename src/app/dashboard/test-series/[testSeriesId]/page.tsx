
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Routes, AppConfig, escapeForPbFilter } from '@/lib/constants';
import { ArrowLeft, CalendarDays, CheckCircle, ChevronRight, Clock, ListChecks, PlayCircle, HelpCircle, AlertTriangle, Video, ShieldAlert, NotebookText } from 'lucide-react'; // Added NotebookText
import { useEffect, useState, useCallback } from 'react';
import pb from '@/lib/pocketbase';
import type { RecordModel } from 'pocketbase';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { TestPagesRecord } from '@/lib/types';

// This interface is now simplified to primarily handle platform tests from 'test_pages'
interface TestDisplayData extends TestPagesRecord {
  // Any additional display-specific fields can be added here if needed
}

const inferSubjectFromTestName = (testName: string): string | undefined => {
    const lowerTestName = testName.toLowerCase();
    if (lowerTestName.includes("physics")) return "Physics";
    if (lowerTestName.includes("chemistry")) return "Chemistry";
    if (lowerTestName.includes("maths") || lowerTestName.includes("mathematics")) return "Mathematics";
    if (lowerTestName.includes("biology")) return "Biology";
    return undefined;
};

export default function TestSeriesDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const testSeriesId = typeof params.testSeriesId === 'string' ? params.testSeriesId : '';

  const [testData, setTestData] = useState<TestDisplayData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  const fetchTestDetails = useCallback(async (isMountedGetter: () => boolean) => {
    if (!testSeriesId) {
      if (isMountedGetter()) { setError("Test ID not found."); setIsLoading(false); }
      return;
    }
    if (isMountedGetter()) { setIsLoading(true); setError(null); }
    try {
      // Only fetch from 'test_pages' for platform tests
      const record = await pb.collection('test_pages').getOne<RecordModel>(testSeriesId);
      if (!isMountedGetter()) return;

      const typeArray: string[] = Array.isArray(record.Type) ? record.Type : (typeof record.Type === 'string' ? [record.Type] : []);
      
      const syllabusArray = typeof record.TestTags === 'string'
        ? record.TestTags.split(',').map(tag => tag.trim()).filter(tag => tag)
        : (record.Test_Description ? [record.Test_Description] : ['Syllabus not specified']);

      const derivedSubject = record.Model === 'Chapterwise' 
        ? inferSubjectFromTestName(record.TestName || '') 
        : undefined;

      const mappedData: TestDisplayData = {
        ...record,
        id: record.id,
        TestName: record.TestName || 'Untitled Test',
        TotalTime: String(record.TotalTime || '0'),
        Type: typeArray as TestDisplayData['Type'],
        Model: record.Model as TestDisplayData['Model'] || 'Full_length',
        Exam: record.Exam as TestDisplayData['Exam'] || 'General',
        TestTags: record.TestTags || undefined,
        PhysicsQuestion: record.PhysicsQuestion as string[] | undefined,
        ChemistryQuestion: record.ChemistryQuestion as string[] | undefined,
        MathsQuestion: record.MathsQuestion as string[] | undefined,
        BiologyQuestion: record.BiologyQuestion as string[] | undefined,
        derivedSubject: derivedSubject, 
        TotalQuestion: typeof record.TotalQuestion === 'number' ? record.TotalQuestion : 0,
      };
      if (isMountedGetter()) setTestData(mappedData);
    } catch (err: any) {
      if (isMountedGetter()) {
        if (err.isAbort || (err.name === 'ClientResponseError' && err.status === 0)) {
          console.warn('Fetch test details request was cancelled.');
        } else {
          console.error("Failed to fetch test series details:", err);
          setError("Could not load test details. It might have been removed or an error occurred.");
        }
      }
    } finally {
      if (isMountedGetter()) setIsLoading(false);
    }
  }, [testSeriesId]);

  useEffect(() => {
    let isMounted = true;
    fetchTestDetails(() => isMounted);
    return () => { isMounted = false; };
  }, [fetchTestDetails]);
  

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 md:p-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <Card className="shadow-xl border-border rounded-xl overflow-hidden">
          <CardContent className="p-6 space-y-6 bg-background">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Skeleton className="h-6 w-24 rounded-full" /> <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <Skeleton className="h-10 w-3/4" /> <Skeleton className="h-6 w-1/4" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 pt-4 border-t mt-4">
              <Skeleton className="h-8 w-full" /> <Skeleton className="h-8 w-full" />
            </div>
            <Skeleton className="h-8 w-1/2 mt-2" />
          </CardContent>
          <CardFooter className="p-6 bg-background border-t"><Skeleton className="h-12 w-full sm:w-auto" /></CardFooter>
        </Card>
      </div>
    );
  }

  if (error || !testData) {
    return (
      <div className="space-y-6 p-4 md:p-8 text-center">
        <Card className="shadow-xl border-destructive bg-destructive/10 max-w-md mx-auto p-6">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-3" />
          <CardTitle className="text-xl text-destructive">Error Loading Test</CardTitle>
          <CardDescription className="text-destructive/80">{error || "The test data could not be loaded."}</CardDescription>
          <Button variant="outline" asChild className="mt-6">
            <Link href={Routes.testSeries} className="flex items-center gap-2"><ArrowLeft className="h-4 w-4" /> Back to Test Series</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const isFreeTest = testData.Type.includes("Free");
  
  // For platform tests, it always goes to the standard instructions page
  const startButtonLink = Routes.studentTestInstructions(testData.id);
  const startButtonText = "View Instructions & Start";


  return (
    <div className="bg-muted/30 min-h-screen">
        <div className="container mx-auto max-w-5xl py-6 px-0 md:px-4">
            <Button variant="ghost" asChild className="mb-4 text-sm text-muted-foreground hover:text-primary">
                <Link href={Routes.testSeries} className="flex items-center gap-1"><ArrowLeft className="h-4 w-4" /> Back to Test Series</Link>
            </Button>
            <Card className="shadow-xl overflow-hidden border-none rounded-xl">
                <CardContent className="p-6 space-y-6 bg-background">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs border-primary/40 text-primary/90 bg-primary/5"><CalendarDays className="h-3.5 w-3.5 mr-1.5"/>For: {testData.Exam}</Badge>
                        <Badge variant="outline" className="text-xs border-indigo-400 text-indigo-600 bg-indigo-50"><NotebookText className="h-3.5 w-3.5 mr-1.5"/>{testData.Model}</Badge>
                        {testData.Model === 'Chapterwise' && testData.derivedSubject && (
                             <Badge variant="outline" className="text-xs border-teal-400 text-teal-600 bg-teal-50"><ListChecks className="h-3.5 w-3.5 mr-1.5"/>{testData.derivedSubject}</Badge>
                        )}
                         {isFreeTest && (<Badge className="bg-green-500 text-white text-xs px-2.5 py-1 shadow-sm">Free</Badge>)}
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">{testData.TestName}</h1>
                    <p className="text-sm text-muted-foreground font-mono">Test Code: {testData.id.substring(0, 8).toUpperCase()}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 pt-4 border-t mt-4">
                        <div className="flex items-center gap-2 text-foreground"><HelpCircle className="h-5 w-5 text-primary" /><span>Questions: {testData.TotalQuestion || 0}</span></div>
                        <div className="flex items-center gap-2 text-foreground"><Clock className="h-5 w-5 text-primary" /><span>Duration: {parseInt(testData.TotalTime, 10) || 0} minutes</span></div>
                    </div>
                    <div>
                        <h3 className="text-md font-semibold mb-1.5 flex items-center gap-2 text-foreground"><ListChecks className="h-5 w-5 text-primary"/> Syllabus Covered</h3>
                        <ul className="list-disc list-inside pl-2 space-y-1 text-sm text-muted-foreground">
                           {(testData.TestTags ? testData.TestTags.split(',').map(tag => tag.trim()).filter(tag => tag) : (testData.Test_Description ? [testData.Test_Description] : ['Syllabus not specified'])).map((item, index) => (<li key={index}>{item}</li>))}
                        </ul>
                    </div>
                     {isFreeTest && (<div className="flex items-center gap-2 text-green-600 font-medium pt-3"><CheckCircle className="h-5 w-5" /><span>Free Access</span></div>)}
                </CardContent>
                <CardFooter className="p-6 bg-background border-t">
                     <Link href={startButtonLink} passHref className="w-full sm:w-auto">
                        <Button 
                            size="lg" 
                            className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground text-base py-3 px-6 shadow-md"
                          >
                            <PlayCircle className="h-5 w-5 mr-2"/> {startButtonText}
                        </Button>
                      </Link>
                </CardFooter>
            </Card>
        </div>
    </div>
  );
}
```
</changes>