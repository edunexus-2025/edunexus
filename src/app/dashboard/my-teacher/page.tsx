
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Routes, AppConfig, escapeForPbFilter } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowLeft, BookOpenCheck, UserCircle, AlertCircle, ChevronRight, ListChecks, Clock, DollarSign, Info, ShieldCheck } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { User, TeacherPlan as TeacherPlanType } from '@/lib/types';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TeacherDisplayedTest {
  id: string;
  testName: string;
  model: 'Chapterwise' | 'Full Length';
  type: 'Free' | 'Premium';
  status: 'Draft' | 'Published' | 'Archived';
  QBExam?: string;
  durationMinutes?: number;
  questionCount?: number;
}

interface StudentSubscribedPlan extends RecordModel {
  id: string;
  student: string;
  teacher: string;
  teachers_plan_id: string;
  payment_status: 'pending' | 'successful' | 'failed' | 'refunded';
  expiry_date: string;
  teachers_plan_name_cache?: string; // Added for caching
  expand?: {
    teachers_plan_id?: Pick<TeacherPlanType, 'id' | 'Plan_name' | 'plan_price' | 'plan'>;
  };
}

const mapPbTeacherTestToDisplay = (record: RecordModel): TeacherDisplayedTest => {
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
  const [teacherContentPlans, setTeacherContentPlans] = useState<TeacherPlanType[]>([]);
  const [currentStudentSubscription, setCurrentStudentSubscription] = useState<StudentSubscribedPlan | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMyTeacherData = useCallback(async (isMountedGetter: () => boolean = () => true) => {
    if (!user || authLoading) {
      if (isMountedGetter()) setIsLoadingPage(false);
      return;
    }
    if (isMountedGetter()) { setIsLoadingPage(true); setError(null); }

    if (!user.subscription_by_teacher || user.subscription_by_teacher.length === 0) {
      if (isMountedGetter()) {
        setSubscribedTeacherInfo(null); setTeacherTests([]); setTeacherContentPlans([]); setCurrentStudentSubscription(null);
        setIsLoadingPage(false);
      }
      return;
    }

    const teacherId = user.subscription_by_teacher[0];

    try {
      if (!isMountedGetter()) return;
      const teacherRecord = await pb.collection('teacher_data').getOne<RecordModel>(teacherId, {
        fields: 'id,name,profile_picture,institute_name,EduNexus_Name,collectionId,collectionName',
      });
      if (!isMountedGetter()) return;

      let avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(teacherRecord.name?.charAt(0) || 'T')}&background=random&color=fff&size=128`;
      if (teacherRecord.profile_picture && teacherRecord.collectionId && teacherRecord.collectionName) {
        try { avatarUrl = pb.files.getUrl(teacherRecord, teacherRecord.profile_picture as string); }
        catch (e) { console.warn(`MyTeacherPage: Error getting avatar URL for teacher ${teacherRecord.id}:`, e); }
      }
      if (isMountedGetter()) {
        setSubscribedTeacherInfo({
          id: teacherRecord.id, name: teacherRecord.name, avatarUrl: avatarUrl, email: '', role: 'Teacher',
          EduNexus_Name: teacherRecord.EduNexus_Name, institute_name: teacherRecord.institute_name,
        } as User);
      } else { return; }

      const testsFilter = `teacherId = "${escapeForPbFilter(teacherId)}" && status = "Published"`;
      const testRecords = await pb.collection('teacher_tests').getFullList<RecordModel>({ filter: testsFilter, sort: '-created', fields: 'id,testName,model,type,status,QBExam,duration,questions' });
      if (isMountedGetter()) setTeacherTests(testRecords.map(mapPbTeacherTestToDisplay)); else return;

      const contentPlansFilter = `teacher = "${escapeForPbFilter(teacherId)}"`;
      const contentPlanRecords = await pb.collection('teachers_upgrade_plan').getFullList<TeacherPlanType>({ filter: contentPlansFilter, sort: '-created' });
      if (isMountedGetter()) setTeacherContentPlans(contentPlanRecords); else return;
      
      const studentSubscriptionFilter = `student = "${user.id}" && teacher = "${teacherId}" && payment_status = "successful"`;
      try {
        const studentSubRecords = await pb.collection('students_teachers_upgrade_plan').getFullList<StudentSubscribedPlan>({
          filter: studentSubscriptionFilter,
          sort: '-expiry_date', 
          expand: 'teachers_plan_id(Plan_name,plan_price,plan)', // Expand only necessary fields
        });
        if (isMountedGetter()) {
          if (studentSubRecords.length > 0) {
            const activeSub = studentSubRecords.find(sub => !sub.expiry_date || new Date(sub.expiry_date) > new Date());
            setCurrentStudentSubscription(activeSub || studentSubRecords[0]); // Fallback to latest if no active non-expired
          } else {
            setCurrentStudentSubscription(null);
          }
        }
      } catch (subError: any) {
        if (isMountedGetter() && subError.status !== 404) {
            console.error("Error fetching student subscription for this teacher:", subError);
            // Don't set main page error, just log for this optional fetch
        } else if (isMountedGetter()) {
            setCurrentStudentSubscription(null);
        }
      }

    } catch (err: any) {
      if (!isMountedGetter()) return;
      let errorToLog: any = err; let errorMessage = "An unexpected error occurred.";
      if (err instanceof Error && 'isAbort' in err && (err as any).isAbort) { errorMessage = "Request was cancelled."; }
      else if (err && typeof err === 'object') {
        const clientError = err as ClientResponseError; errorToLog = clientError.data || clientError;
        if (clientError.name === 'ClientResponseError' && clientError.status === 0) { errorMessage = "Network error."; }
        else if (clientError.status === 404) { errorMessage = "The teacher or their content could not be found."; }
        else if (clientError.data && clientError.data.message) { errorMessage = `Error: ${clientError.data.message}`; }
        else if (clientError.message) { errorMessage = `Error: ${clientError.message}`; }
      }
      console.error("MyTeacherPage: Error fetching data:", errorToLog); setError(errorMessage);
    } finally { if (isMountedGetter()) setIsLoadingPage(false); }
  }, [user, authLoading, escapeForPbFilter]);

  useEffect(() => {
    let isMounted = true;
    if (!authLoading) fetchMyTeacherData(() => isMounted);
    return () => { isMounted = false; };
  }, [authLoading, fetchMyTeacherData]);

  if (isLoadingPage || authLoading) { /* Skeleton rendering */
    return ( <div className="space-y-6 p-4 md:p-6"> <Card className="shadow-lg"><CardHeader><Skeleton className="h-20 w-20 rounded-full mb-2" /><Skeleton className="h-8 w-1/2 mb-2" /><Skeleton className="h-4 w-3/4" /></CardHeader></Card> <Card className="shadow-lg"><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent className="space-y-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></CardContent></Card> <Card className="shadow-lg"><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent className="space-y-3"><Skeleton className="h-24 w-full" /></CardContent></Card> </div> );
  }
  if (error) { /* Error rendering */
    return ( <div className="space-y-6 p-4 md:p-6 text-center"> <Card className="shadow-lg border-destructive bg-destructive/10 max-w-md mx-auto p-6"> <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-3" /> <CardTitle className="text-xl text-destructive">Error Loading Content</CardTitle> <CardDescription className="text-destructive/80 whitespace-pre-wrap">{error}</CardDescription> </Card> </div> );
  }
  if (!subscribedTeacherInfo) { /* No subscribed teacher rendering */
    return ( <div className="space-y-6 p-4 md:p-6"> <Card className="shadow-lg"><CardHeader><CardTitle className="text-2xl md:text-3xl font-bold text-foreground">My Teacher's Content</CardTitle></CardHeader><CardContent className="text-center py-10"><UserCircle className="mx-auto h-16 w-16 text-muted-foreground mb-4" /><p className="text-lg text-muted-foreground">You are not currently subscribed to any teacher's plan.</p><Button asChild className="mt-4"><Link href={Routes.studentTeacherRanking}>Discover Teachers</Link></Button></CardContent></Card> </div> );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Card className="shadow-xl bg-gradient-to-r from-primary to-accent text-primary-foreground">
        <CardHeader className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Avatar className="h-20 w-20 border-2 border-primary-foreground/50">
              <AvatarImage src={subscribedTeacherInfo.avatarUrl} alt={subscribedTeacherInfo.name} data-ai-hint="teacher profile"/>
              <AvatarFallback className="text-3xl bg-primary-foreground/20 text-primary-foreground">{subscribedTeacherInfo.name?.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="text-center sm:text-left">
              <CardDescription className="text-sm text-primary-foreground/80">Content from</CardDescription>
              <CardTitle className="text-3xl font-bold">{subscribedTeacherInfo.name}</CardTitle>
              {(subscribedTeacherInfo.institute_name || subscribedTeacherInfo.EduNexus_Name) && (<p className="text-xs text-primary-foreground/70 mt-0.5">{subscribedTeacherInfo.institute_name} {subscribedTeacherInfo.EduNexus_Name && `(@${subscribedTeacherInfo.EduNexus_Name})`}</p>)}
            </div>
          </div>
          {currentStudentSubscription && currentStudentSubscription.expand?.teachers_plan_id && (
            <div className="mt-4 p-3 bg-black/20 rounded-lg text-center sm:text-left">
              <p className="text-xs font-medium text-yellow-300 uppercase tracking-wider">Your Current Plan with this Teacher:</p>
              <p className="text-lg font-semibold text-white">{currentStudentSubscription.expand.teachers_plan_id.Plan_name}</p>
              <p className="text-xs text-yellow-200/80">
                (Price: ₹{currentStudentSubscription.expand.teachers_plan_id.plan_price} / {currentStudentSubscription.expand.teachers_plan_id.plan})
                {currentStudentSubscription.expiry_date && `, Expires: ${new Date(currentStudentSubscription.expiry_date).toLocaleDateString()}`}
              </p>
            </div>
          )}
        </CardHeader>
      </Card>

      <section>
        <h2 className="text-xl font-semibold mb-4 text-foreground">Published Tests by {subscribedTeacherInfo.name}</h2>
        {teacherTests.length === 0 ? (<Card className="text-center p-10 border-dashed"><BookOpenCheck className="mx-auto h-12 w-12 text-muted-foreground mb-4" /><p className="text-muted-foreground">{subscribedTeacherInfo.name} has not published any tests yet. Check back later!</p></Card>)
        : (<div className="grid grid-cols-1 md:grid-cols-2 gap-4">{teacherTests.map((test) => (
          <Link key={test.id} href={Routes.viewTestSeries(test.id)} passHref>
            <Card className="shadow-md hover:shadow-lg transition-shadow cursor-pointer group bg-card border border-border hover:border-primary/30 h-full flex flex-col"><CardHeader className="pb-3"><div className="flex justify-between items-start"><CardTitle className="text-base font-semibold text-foreground group-hover:text-primary line-clamp-2">{test.testName}</CardTitle><Badge variant={test.type === 'Free' ? 'secondary' : 'default'} className={test.type === 'Free' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-primary/10 text-primary border-primary/30'}>{test.type}</Badge></div><CardDescription className="text-xs text-muted-foreground">{test.model} {test.QBExam ? `• ${test.QBExam}` : ''}</CardDescription></CardHeader><CardContent className="text-xs text-muted-foreground flex-grow"><div className="flex items-center gap-2 mb-1"><ListChecks className="h-3.5 w-3.5 text-primary/80" /><span>{test.questionCount || 'N/A'} Questions</span></div><div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-primary/80" /><span>{test.durationMinutes || 'N/A'} min</span></div></CardContent><CardFooter className="pt-3 mt-auto"><Button variant="link" size="sm" className="p-0 h-auto text-primary group-hover:underline">View Test Details <ChevronRight className="ml-1 h-4 w-4" /></Button></CardFooter></Card>
          </Link>))}</div>
        )}
      </section>
      
      <section className="mt-8 pt-6 border-t">
        <h2 className="text-xl font-semibold mb-4 text-foreground">More from {subscribedTeacherInfo.name} (Content Plans)</h2>
        {teacherContentPlans.length === 0 ? (<Card className="text-center p-10 border-dashed"><Info className="mx-auto h-12 w-12 text-muted-foreground mb-4" /><p className="text-muted-foreground">{subscribedTeacherInfo.name} has not created any specific content plans yet.</p></Card>)
        : (<div className="grid grid-cols-1 md:grid-cols-2 gap-4">{teacherContentPlans.map(plan => (
          <Card key={plan.id} className="shadow-md hover:shadow-lg transition-shadow bg-card border border-border h-full flex flex-col">
            <CardHeader className="pb-3"><CardTitle className="text-lg font-semibold text-foreground">{plan.Plan_name}</CardTitle><div className="flex items-baseline"><span className="text-2xl font-bold text-primary">₹{plan.plan_price}</span><span className="text-sm text-muted-foreground ml-1">/ {plan.plan}</span></div></CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1 flex-grow"><p className="text-xs font-semibold text-muted-foreground uppercase">Features:</p><ul className="list-disc list-inside pl-2">{[plan.plan_point_1, plan.plan_point_2, plan.plan_point_3, plan.plan_point_4, plan.plan_point_5].filter(Boolean).map((point, idx) => <li key={idx}>{point}</li>)}</ul></CardContent>
            <CardFooter className="pt-3 mt-auto">
              {currentStudentSubscription?.teachers_plan_id === plan.id ? (<Button variant="default" disabled className="w-full bg-green-600 hover:bg-green-700"><CheckCircle className="mr-2 h-4 w-4" />Currently Subscribed</Button>) :
               (<Button variant="outline" className="w-full" onClick={() => alert(`Subscription to "${plan.Plan_name}" coming soon!`)}>View & Subscribe <ChevronRight className="ml-2 h-4 w-4" /></Button>)}
            </CardFooter>
          </Card>))}</div>
        )}
      </section>
    </div>
  );
}
