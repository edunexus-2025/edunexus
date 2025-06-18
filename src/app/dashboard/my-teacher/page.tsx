
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Routes, AppConfig, escapeForPbFilter } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowLeft, BookOpenCheck, UserCircle, AlertCircle, ChevronRight, ListChecks, Clock, DollarSign, Info, ShieldCheck } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { User, TeacherPlan as TeacherPlanType } from '@/lib/types';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

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
  expiry_date?: string; 
  teachers_plan_name_cache?: string;
  // expand is not used client-side for this type due to permission constraints
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
  const { toast } = useToast();

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

    let teacherId: string | undefined = undefined;
    if (Array.isArray(user.subscription_by_teacher) && user.subscription_by_teacher.length > 0 && user.subscription_by_teacher[0] && typeof user.subscription_by_teacher[0] === 'string' && user.subscription_by_teacher[0].trim() !== '') {
        teacherId = user.subscription_by_teacher[0];
    }

    if (!teacherId) {
      if (isMountedGetter()) {
        setSubscribedTeacherInfo(null); setTeacherTests([]); setTeacherContentPlans([]); setCurrentStudentSubscription(null);
        setIsLoadingPage(false);
      }
      return;
    }

    console.log(`MyTeacherPage: Attempting to fetch data for teacher ID: ${teacherId}`);

    try {
      if (!isMountedGetter()) return;
      
      let teacherRecordFetched: RecordModel | null = null;
      try {
        teacherRecordFetched = await pb.collection('teacher_data').getOne<RecordModel>(teacherId, {
          fields: 'id,name,profile_picture,institute_name,EduNexus_Name,collectionId,collectionName,about',
          '$autoCancel': false,
        });
      } catch (teacherFetchError: any) {
        if (isMountedGetter()) {
          if (teacherFetchError.status === 404) {
            setError(`The linked teacher (ID: ${teacherId.substring(0,7)}...) could not be found. This link might be outdated or incorrect. Please contact support if this issue persists.`);
            setSubscribedTeacherInfo(null); setTeacherTests([]); setTeacherContentPlans([]); setCurrentStudentSubscription(null);
          } else {
            console.error("MyTeacherPage: Error fetching teacher_data:", teacherFetchError.data || teacherFetchError);
            setError(`Error fetching teacher details: ${teacherFetchError.data?.message || teacherFetchError.message}`);
          }
          // setIsLoadingPage(false); // Moved to main finally block
        }
        return; 
      }
      
      if (!isMountedGetter() || !teacherRecordFetched) return;

      let avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(teacherRecordFetched.name?.charAt(0) || 'T')}&background=random&color=fff&size=128`;
      if (teacherRecordFetched.profile_picture && teacherRecordFetched.collectionId && teacherRecordFetched.collectionName) {
        try { avatarUrl = pb.files.getUrl(teacherRecordFetched, teacherRecordFetched.profile_picture as string); }
        catch (e) { console.warn(`MyTeacherPage: Error getting avatar URL for teacher ${teacherRecordFetched.id}:`, e); }
      }
      if (isMountedGetter()) {
        setSubscribedTeacherInfo({
          id: teacherRecordFetched.id, name: teacherRecordFetched.name, avatarUrl: avatarUrl, email: '', role: 'Teacher',
          EduNexus_Name: teacherRecordFetched.EduNexus_Name, institute_name: teacherRecordFetched.institute_name, about: teacherRecordFetched.about
        } as User);
      } else { return; }

      const testsFilter = `teacherId = "${escapeForPbFilter(teacherId)}" && status = "Published"`;
      const testRecords = await pb.collection('teacher_tests').getFullList<RecordModel>({ filter: testsFilter, sort: '-created', fields: 'id,testName,model,type,status,QBExam,duration,questions', '$autoCancel': false });
      if (isMountedGetter()) setTeacherTests(testRecords.map(mapPbTeacherTestToDisplay)); else return;

      const contentPlansFilter = `teacher = "${escapeForPbFilter(teacherId)}"`;
      const contentPlanRecords = await pb.collection('teachers_upgrade_plan').getFullList<TeacherPlanType>({ filter: contentPlansFilter, sort: '-created', '$autoCancel': false });
      if (isMountedGetter()) setTeacherContentPlans(contentPlanRecords); else return;
      
      if (user?.id && teacherId) {
        const studentSubscriptionFilter = `student = "${user.id}" && payment_status = "successful"`;
        console.log(`MyTeacherPage: Fetching current student's subscriptions with filter: ${studentSubscriptionFilter}`);
        try {
          const allStudentSubRecords = await pb.collection('students_teachers_upgrade_plan').getFullList<StudentSubscribedPlan>({
            filter: studentSubscriptionFilter,
            sort: '-created',
            fields: 'id,student,teacher,teachers_plan_id,payment_status,expiry_date,teachers_plan_name_cache,created',
            '$autoCancel': false,
          });

          if (isMountedGetter()) {
            const relevantSubRecordsForThisTeacher = allStudentSubRecords.filter(sub => sub.teacher === teacherId);
            console.log(`MyTeacherPage: Found ${allStudentSubRecords.length} total successful subs for student, ${relevantSubRecordsForThisTeacher.length} for this teacher (${teacherId}).`);

            if (relevantSubRecordsForThisTeacher.length > 0) {
              const now = new Date();
              const activeSubscriptions = relevantSubRecordsForThisTeacher.filter(sub => {
                if (!sub.expiry_date) return true; 
                try {
                  return new Date(sub.expiry_date) > now; 
                } catch (e) {
                  console.warn(`MyTeacherPage: Invalid expiry_date format for subscription ${sub.id}: ${sub.expiry_date}. Treating as expired.`);
                  return false; 
                }
              });

              if (activeSubscriptions.length > 0) {
                activeSubscriptions.sort((a, b) => {
                  const dateA = a.expiry_date ? new Date(a.expiry_date).getTime() : Infinity;
                  const dateB = b.expiry_date ? new Date(b.expiry_date).getTime() : Infinity;
                  if (dateB !== dateA) return dateB - dateA; 
                  return new Date(b.created).getTime() - new Date(a.created).getTime();
                });
                setCurrentStudentSubscription(activeSubscriptions[0]);
                console.log("MyTeacherPage: Successfully set active student subscription for this teacher:", activeSubscriptions[0]);
              } else {
                setCurrentStudentSubscription(null);
                console.log(`MyTeacherPage: No *active* successful subscription found for student "${user.id}" with teacher "${teacherId}". All successful plans may have expired.`);
              }
            } else {
              setCurrentStudentSubscription(null);
              console.log(`MyTeacherPage: No successful subscription records found for student "${user.id}" with teacher "${teacherId}" after client-side filtering.`);
            }
          }
        } catch (subError: any) {
          if (isMountedGetter()) {
            const clientError = subError as ClientResponseError;
            let specificErrorMessage = `Could not load your plan details with this teacher.`;
            if (clientError.status === 400) {
              specificErrorMessage = `There appears to be an issue with your subscription data for this teacher. Please contact support. (Ref: STUP_INTEGRITY_400) This may be due to invalid teacher reference in your subscription record.`;
              console.error(
                `MyTeacherPage: ClientResponseError 400 when fetching 'students_teachers_upgrade_plan'.
                Filter used: "${studentSubscriptionFilter}".
                This error often indicates that the 'teacher' field in your PocketBase 'students_teachers_upgrade_plan' collection (for records matching the student and payment_status) contains an ID that is NOT a valid ID from the 'teacher_data' collection.
                Please verify data integrity in PocketBase for student "${user.id}" and teacher target "${teacherId}".
                PocketBase error: ${JSON.stringify(clientError.data || {})} "Full Error:"`, clientError
              );
            } else if (clientError.status === 404) {
              setCurrentStudentSubscription(null);
              console.log(`MyTeacherPage: No 'students_teachers_upgrade_plan' records found for student "${user.id}" with payment_status "successful".`);
              specificErrorMessage = "No active subscription plan found with this teacher."; // More user-friendly for 404
            } else if (clientError.isAbort || (clientError.name === 'ClientResponseError' && clientError.status === 0)) {
                console.warn('MyTeacherPage: Fetch student subscriptions request was cancelled/network issue.');
                specificErrorMessage = `Network issue loading your plan. Please refresh.`;
            } else {
              console.error(`MyTeacherPage: Other error fetching 'students_teachers_upgrade_plan' for student ${user.id}. Filter: ${studentSubscriptionFilter}. PB error:`, clientError.data || clientError.message, "Full Error:", clientError);
              specificErrorMessage = `Could not load your plan status with this teacher due to a data access issue. (Ref: STUP_DATA_FAIL)`;
            }
            setError(prevError => prevError ? `${prevError}\n${specificErrorMessage}` : specificErrorMessage); 
            setCurrentStudentSubscription(null);
          }
        }
      }

    } catch (mainErr: any) {
      if (!isMountedGetter()) return;
      let errorToLog: any = mainErr; let errorMessage = "An unexpected error occurred while loading teacher content.";
      if (mainErr instanceof Error && 'isAbort' in mainErr && (mainErr as any).isAbort) { errorMessage = "Request was cancelled."; }
      else if (mainErr && typeof mainErr === 'object') {
        const clientError = mainErr as ClientResponseError; errorToLog = clientError.data || clientError;
        if (clientError.name === 'ClientResponseError' && clientError.status === 0) { errorMessage = "Network error while loading teacher content."; }
        else if (clientError.status === 404) { errorMessage = "The teacher's profile or content could not be found."; }
        else if (clientError.data && clientError.data.message) { errorMessage = `Error: ${clientError.data.message}`; }
        else if (clientError.message) { errorMessage = `Error: ${clientError.message}`; }
      }
      console.error("MyTeacherPage: Error fetching overall data:", errorToLog); 
      if (isMountedGetter()) setError(errorMessage);
    } finally { if (isMountedGetter()) setIsLoadingPage(false); }
  }, [user, authLoading, escapeForPbFilter, toast]);

  useEffect(() => {
    let isMounted = true;
    if (!authLoading) fetchMyTeacherData(() => isMounted);
    return () => { isMounted = false; };
  }, [authLoading, fetchMyTeacherData]);


  if (isLoadingPage || authLoading) {
    return ( <div className="space-y-6 p-4 md:p-6"> <Card className="shadow-lg"><CardHeader><Skeleton className="h-20 w-20 rounded-full mb-2" /><Skeleton className="h-8 w-1/2 mb-2" /><Skeleton className="h-4 w-3/4" /></CardHeader></Card> <Card className="shadow-lg"><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent className="space-y-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></CardContent></Card> <Card className="shadow-lg"><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent className="space-y-3"><Skeleton className="h-24 w-full" /></CardContent></Card> </div> );
  }
  if (error && !subscribedTeacherInfo) { 
    return ( <div className="space-y-6 p-4 md:p-6 text-center"> <Card className="shadow-lg border-destructive bg-destructive/10 max-w-md mx-auto p-6"> <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-3" /> <CardTitle className="text-xl text-destructive">Error Loading Content</CardTitle> <CardDescription className="text-destructive/80 whitespace-pre-wrap">{error}</CardDescription> </Card> </div> );
  }
   if (!subscribedTeacherInfo) { 
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
          {currentStudentSubscription ? (
            <div className="mt-4 p-3 bg-black/20 rounded-lg text-center sm:text-left">
              <p className="text-xs font-medium text-yellow-300 uppercase tracking-wider">Your Active Plan with this Teacher:</p>
              <p className="text-lg font-semibold text-white">{currentStudentSubscription.teachers_plan_name_cache || 'Subscribed Plan'}</p>
              {currentStudentSubscription.expiry_date && 
                <p className="text-xs text-yellow-200/80">
                  Expires: {new Date(currentStudentSubscription.expiry_date).toLocaleDateString()}
                </p>
              }
            </div>
          ) : error && !isLoadingPage && error.includes("STUP_INTEGRITY_400") ? ( 
             <div className="mt-4 p-3 bg-red-700/30 rounded-lg text-center sm:text-left">
                <p className="text-xs font-medium text-red-100 uppercase tracking-wider">Subscription Info Error:</p>
                <p className="text-sm text-red-50 line-clamp-2" title={error}>{error}</p>
             </div>
          ) : !isLoadingPage && !error ? (
            <div className="mt-4 p-3 bg-blue-700/30 rounded-lg text-center sm:text-left">
               <p className="text-xs font-medium text-blue-100 uppercase tracking-wider">No Active Plan</p>
               <p className="text-sm text-blue-50">You are not currently subscribed to an active plan from this teacher, or previous plans may have expired.</p>
            </div>
          ): null}
        </CardHeader>
         {subscribedTeacherInfo.about && (
            <CardContent className="p-6 pt-0">
                <h3 className="text-sm font-semibold text-primary-foreground/80 mb-1">About {subscribedTeacherInfo.name}:</h3>
                <p className="text-xs text-primary-foreground/90 line-clamp-3">{subscribedTeacherInfo.about}</p>
            </CardContent>
        )}
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
        : (<div className="grid grid-cols-1 md:grid-cols-2 gap-4">{teacherContentPlans.map(plan => {
            const isThisTheSubscribedPlan = currentStudentSubscription?.teachers_plan_id === plan.id;
            return (
              <Card key={plan.id} className={cn("shadow-md hover:shadow-lg transition-shadow bg-card border border-border h-full flex flex-col", isThisTheSubscribedPlan && "border-2 border-green-500 ring-1 ring-green-500/30 bg-green-500/5")}>
                <CardHeader className="pb-3">
                  {isThisTheSubscribedPlan && <Badge variant="default" className="absolute top-3 right-3 bg-green-500 text-white">Your Active Plan</Badge>}
                  <CardTitle className="text-lg font-semibold text-foreground">{plan.Plan_name}</CardTitle>
                  <div className="flex items-baseline">
                    <span className="text-2xl font-bold text-primary">₹{plan.plan_price}</span>
                    <span className="text-sm text-muted-foreground ml-1">/ {plan.plan}</span>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-1 flex-grow">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Features:</p>
                  <ul className="list-disc list-inside pl-2">
                    {[plan.plan_point_1, plan.plan_point_2, plan.plan_point_3, plan.plan_point_4, plan.plan_point_5]
                      .filter(Boolean).map((point, idx) => <li key={idx}>{point}</li>)}
                  </ul>
                </CardContent>
                <CardFooter className="pt-3 mt-auto">
                  {isThisTheSubscribedPlan ? (<Button variant="outline" disabled className="w-full bg-green-100 text-green-700 border-green-400"><CheckCircle className="mr-2 h-4 w-4" />Currently Subscribed</Button>) :
                   (<Button variant="outline" className="w-full" onClick={() => alert(`Subscription to "${plan.Plan_name}" from teacher coming soon!`)}>View & Subscribe <ChevronRight className="ml-2 h-4 w-4" /></Button>)}
                </CardFooter>
              </Card>
            );
        })}</div>
        )}
      </section>
    </div>
  );
}

