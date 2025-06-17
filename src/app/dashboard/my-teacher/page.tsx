
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Routes, AppConfig, escapeForPbFilter } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowLeft, BookOpenCheck, UserCircle, AlertCircle, ChevronRight, ListChecks, Clock, HelpCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { User } from '@/lib/types';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface TeacherDisplayedTest {
  id: string;
  testName: string;
  model: 'Chapterwise' | 'Full Length';
  type: 'Free' | 'Premium';
  status: 'Draft' | 'Published' | 'Archived';
  QBExam?: string; // From teacher_tests
  durationMinutes?: number;
  questionCount?: number;
  // Add other fields you want to display for each test
}

const mapPbTeacherTestToDisplay = (record: RecordModel): TeacherDisplayedTest => {
  // Calculate question count (assuming 'questions' is a relation field in teacher_tests)
  const questionIds = record.questions as string[] | undefined;
  const questionCount = Array.isArray(questionIds) ? questionIds.length : 0;

  return {
    id: record.id,
    testName: record.testName || 'Untitled Test',
    model: record.model as TeacherDisplayedTest['model'] || 'Chapterwise',
    type: record.type as TeacherDisplayedTest['type'] || 'Free',
    status: record.status as TeacherDisplayedTest['status'] || 'Draft',
    QBExam: record.QBExam,
    durationMinutes: typeof record.duration === 'string' ? parseInt(record.duration, 10) : (typeof record.duration === 'number' ? record.duration : undefined),
    questionCount: questionCount,
  };
};

export default function MyTeacherPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [subscribedTeacherInfo, setSubscribedTeacherInfo] = useState<User | null>(null);
  const [teacherTests, setTeacherTests] = useState<TeacherDisplayedTest[]>([]);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMyTeacherData = useCallback(async () => {
    if (!user || authLoading) return;

    setIsLoadingPage(true);
    setError(null);

    if (!user.subscription_by_teacher || user.subscription_by_teacher.length === 0) {
      setSubscribedTeacherInfo(null);
      setTeacherTests([]);
      setIsLoadingPage(false);
      return;
    }

    const teacherId = user.subscription_by_teacher[0]; // Assuming student subscribes to one main teacher for now

    try {
      // Fetch teacher details
      const teacherRecord = await pb.collection('teacher_data').getOne<RecordModel>(teacherId, {
        fields: 'id,name,profile_picture,institute_name,EduNexus_Name,collectionId,collectionName', // Fetch necessary fields
      });
      
      let avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(teacherRecord.name?.charAt(0) || 'T')}&background=random&color=fff&size=128`;
      if (teacherRecord.profile_picture && teacherRecord.collectionId && teacherRecord.collectionName) {
        avatarUrl = pb.files.getUrl(teacherRecord, teacherRecord.profile_picture as string);
      }

      setSubscribedTeacherInfo({
        id: teacherRecord.id,
        name: teacherRecord.name,
        avatarUrl: avatarUrl,
        email: '', // Not fetched, but required by User type
        role: 'Teacher', // Assuming this context
        EduNexus_Name: teacherRecord.EduNexus_Name,
        institute_name: teacherRecord.institute_name,
      } as User);

      // Fetch teacher's published tests
      const testsFilter = `teacherId = "${escapeForPbFilter(teacherId)}" && status = "Published"`;
      const testRecords = await pb.collection('teacher_tests').getFullList<RecordModel>({
        filter: testsFilter,
        sort: '-created',
        fields: 'id,testName,model,type,status,QBExam,duration,questions', // Add questions to get count
      });
      setTeacherTests(testRecords.map(mapPbTeacherTestToDisplay));

    } catch (err: any) {
      const clientError = err as ClientResponseError;
      console.error("Error fetching teacher data or tests:", clientError.data || clientError);
      setError(`Could not load teacher's content. Error: ${clientError.data?.message || clientError.message}`);
    } finally {
      setIsLoadingPage(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (!authLoading) {
      fetchMyTeacherData();
    }
  }, [authLoading, fetchMyTeacherData]);

  if (isLoadingPage || authLoading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Card className="shadow-lg">
          <CardHeader>
            <Skeleton className="h-8 w-1/2 mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </CardHeader>
        </Card>
        <Card className="shadow-lg">
          <CardHeader>
            <Skeleton className="h-6 w-1/3" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 p-4 md:p-6 text-center">
        <Card className="shadow-lg border-destructive bg-destructive/10 max-w-md mx-auto p-6">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-3" />
          <CardTitle className="text-xl text-destructive">Error Loading Content</CardTitle>
          <CardDescription className="text-destructive/80 whitespace-pre-wrap">{error}</CardDescription>
        </Card>
      </div>
    );
  }

  if (!subscribedTeacherInfo) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl md:text-3xl font-bold text-foreground">My Teacher's Content</CardTitle>
          </CardHeader>
          <CardContent className="text-center py-10">
            <UserCircle className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg text-muted-foreground">You are not currently subscribed to any teacher's plan.</p>
            <Button asChild className="mt-4">
              <Link href={Routes.studentTeacherRanking}>Discover Teachers</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Card className="shadow-xl bg-gradient-to-r from-primary to-accent text-primary-foreground">
        <CardHeader className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Avatar className="h-20 w-20 border-2 border-primary-foreground/50">
              <AvatarImage src={subscribedTeacherInfo.avatarUrl} alt={subscribedTeacherInfo.name} data-ai-hint="teacher profile"/>
              <AvatarFallback className="text-3xl bg-primary-foreground/20 text-primary-foreground">
                {subscribedTeacherInfo.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="text-center sm:text-left">
              <CardDescription className="text-sm text-primary-foreground/80">Content from</CardDescription>
              <CardTitle className="text-3xl font-bold">{subscribedTeacherInfo.name}</CardTitle>
              {(subscribedTeacherInfo.institute_name || subscribedTeacherInfo.EduNexus_Name) && (
                <p className="text-xs text-primary-foreground/70 mt-0.5">
                    {subscribedTeacherInfo.institute_name} {subscribedTeacherInfo.EduNexus_Name && `(@${subscribedTeacherInfo.EduNexus_Name})`}
                </p>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <section>
        <h2 className="text-xl font-semibold mb-4 text-foreground">Published Tests by {subscribedTeacherInfo.name}</h2>
        {teacherTests.length === 0 ? (
          <Card className="text-center p-10 border-dashed">
            <BookOpenCheck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {subscribedTeacherInfo.name} has not published any tests yet. Check back later!
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teacherTests.map((test) => (
              <Link key={test.id} href={Routes.viewTestSeries(test.id)} passHref>
                <Card className="shadow-md hover:shadow-lg transition-shadow cursor-pointer group bg-card border border-border hover:border-primary/30 h-full flex flex-col">
                  <CardHeader className="pb-3">
                     <div className="flex justify-between items-start">
                        <CardTitle className="text-base font-semibold text-foreground group-hover:text-primary line-clamp-2">
                        {test.testName}
                        </CardTitle>
                        <Badge variant={test.type === 'Free' ? 'secondary' : 'default'} 
                               className={test.type === 'Free' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-primary/10 text-primary border-primary/30'}>
                            {test.type}
                        </Badge>
                    </div>
                    <CardDescription className="text-xs text-muted-foreground">
                      {test.model} {test.QBExam ? `• ${test.QBExam}` : ''}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground flex-grow">
                     <div className="flex items-center gap-2 mb-1">
                        <ListChecks className="h-3.5 w-3.5 text-primary/80" />
                        <span>{test.questionCount || 'N/A'} Questions</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-primary/80" />
                        <span>{test.durationMinutes || 'N/A'} min</span>
                      </div>
                  </CardContent>
                  <CardFooter className="pt-3 mt-auto">
                    <Button variant="link" size="sm" className="p-0 h-auto text-primary group-hover:underline">
                        View Test Details <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
      
      {/* Placeholder for other content types like DPPs, Notes from this teacher */}
      <section className="mt-8 pt-6 border-t">
        <h2 className="text-xl font-semibold mb-4 text-foreground">More from {subscribedTeacherInfo.name}</h2>
        <div className="text-center p-6 border-dashed rounded-md bg-muted/50">
            <p className="text-muted-foreground">Stay tuned! More content like DPPs and notes from this teacher will appear here soon.</p>
        </div>
      </section>

    </div>
  );
}

