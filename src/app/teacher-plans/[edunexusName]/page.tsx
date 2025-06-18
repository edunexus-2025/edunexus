
'use client';

import { useEffect, useState, useCallback, ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import NextImage from 'next/image';
import Link from 'next/link';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import { useToast } from '@/hooks/use-toast';
// Navbar import removed
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AppConfig, Routes, escapeForPbFilter } from '@/lib/constants';
import { Input } from '@/components/ui/input';
import {
  AlertCircle, GraduationCap, ShoppingCart, DollarSign, Loader2, Tag, CheckCircle, Star, Info, BookOpenCheck, ArrowLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { User, Plan as AppPlanType, TeacherPlan as TeacherPlanType, UserSubscriptionTierStudent } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { format, isPast } from 'date-fns';

interface TeacherDataRecord extends RecordModel {
  name: string;
  profile_picture?: string;
  EduNexus_Name: string;
}

interface StudentSubscribedPlanRecord extends RecordModel {
  student: string;
  teacher: string;
  teachers_plan_id: string; // This is the relation to teachers_upgrade_plan
  payment_status: 'successful' | 'pending' | 'failed';
  expiry_date?: string;
}

interface TeacherPlansPageData {
  teacherData: TeacherDataRecord;
  contentPlans: TeacherPlanType[];
  teacherAvatarUrl: string;
  studentSubscriptionsToThisTeacher: StudentSubscribedPlanRecord[];
}

const getPbFileUrl = (record: RecordModel | null | undefined, fieldName: string): string | null => {
  if (record && record[fieldName] && typeof record[fieldName] === 'string' && record.collectionId && record.collectionName) {
    try {
      return pb.files.getUrl(record, record[fieldName] as string);
    } catch (e) { console.warn(`Error getting URL for ${fieldName} in record ${record.id}:`, e); return null; }
  }
  return null;
};

export default function TeacherPublicPlansPage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser, teacher: currentTeacher } = useAuth(); // Get both student and teacher from auth
  const { toast } = useToast();
  const edunexusNameParam = typeof params.edunexusName === 'string' ? params.edunexusName : '';

  const [pageData, setPageData] = useState<TeacherPlansPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [processingPaymentForPlanId, setProcessingPaymentForPlanId] = useState<string | null>(null);

  const edunexusName = edunexusNameParam ? escapeForPbFilter(edunexusNameParam) : '';

  const fetchData = useCallback(async (isMountedGetter: () => boolean = () => true) => {
    if (!edunexusName) { if (isMountedGetter()) { setError("Teacher identifier missing in URL."); setIsLoading(false); } return; }
    if (isMountedGetter()) { setIsLoading(true); setError(null); }

    try {
      const teacherDataRecords = await pb.collection('teacher_data').getFullList<TeacherDataRecord>({ filter: `EduNexus_Name = "${edunexusName}"` });
      if (!isMountedGetter()) return;
      if (teacherDataRecords.length === 0) { if (isMountedGetter()) { setError("Teacher profile not found."); setIsLoading(false); } return; }
      const teacherData = teacherDataRecords[0];
      const teacherAvatarUrl = getPbFileUrl(teacherData, 'profile_picture') || `https://ui-avatars.com/api/?name=${encodeURIComponent(teacherData.name?.charAt(0) || 'T')}&background=random&color=fff&size=128`;

      const contentPlans = await pb.collection('teachers_upgrade_plan').getFullList<TeacherPlanType>({ filter: `teacher = "${teacherData.id}"`, sort: '-created' });
      
      let studentSubscriptions: StudentSubscribedPlanRecord[] = [];
      if (currentUser?.id && teacherData.id) {
        try {
          studentSubscriptions = await pb.collection('students_teachers_upgrade_plan').getFullList<StudentSubscribedPlanRecord>({
            filter: `student = "${currentUser.id}" && teacher = "${teacherData.id}" && payment_status = "successful"`,
          });
        } catch (subError) {
          console.warn("Could not fetch student's current subscriptions for this teacher:", subError);
        }
      }
      
      if (!isMountedGetter()) return;
      setPageData({ teacherData, contentPlans, teacherAvatarUrl, studentSubscriptionsToThisTeacher: studentSubscriptions });
    } catch (err: any) { if (isMountedGetter()) { const clientError = err as ClientResponseError; if (clientError?.isAbort || (clientError?.name === 'ClientResponseError' && clientError?.status === 0)) { console.warn('Fetch data request was cancelled.'); } else { console.error("Failed to fetch page data:", clientError.data || clientError); setError(`Could not load teacher plans. Error: ${clientError.data?.message || clientError.message}`); }}}
    finally { if (isMountedGetter()) setIsLoading(false); }
  }, [edunexusName, currentUser?.id]);

  useEffect(() => { let isMounted = true; fetchData(() => isMounted); return () => { isMounted = false; }; }, [fetchData]);

  const handleSubscribeToTeacherPlan = async (plan: TeacherPlanType) => {
    if (!currentUser || !currentUser.id) { toast({ title: "Login Required", description: "Please login as a student to subscribe.", variant: "destructive" }); router.push(Routes.login + `?redirect=${encodeURIComponent(window.location.pathname)}`); return; }
    if (!pageData?.teacherData?.id) { toast({ title: "Error", description: "Teacher information is missing.", variant: "destructive" }); return; }
    setProcessingPaymentForPlanId(plan.id);

    const razorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    if (!razorpayKeyId) { console.error("[TeacherPlansPage] CRITICAL: Razorpay Key ID not configured."); toast({ title: "Payment Error", description: "Gateway client key missing. Contact support.", variant: "destructive" }); setProcessingPaymentForPlanId(null); return; }

    const amountForApi = parseFloat(plan.plan_price || "0"); 
    if (isNaN(amountForApi)) { toast({ title: "Payment Error", description: "Invalid plan price.", variant: "destructive" }); setProcessingPaymentForPlanId(null); return; }
    
    if (amountForApi <= 0) {
      toast({ title: "Free Plan Enrollment", description: `Enrolling you in "${plan.Plan_name}"...`, variant: "default"});
      try {
        const today = new Date(); const expiryDateISO = new Date(today.setFullYear(today.getFullYear() + 1)).toISOString();
        await pb.collection('students_teachers_upgrade_plan').create({
          student: currentUser.id, teacher: pageData.teacherData.id, teachers_plan_id: plan.id, teachers_plan_name_cache: plan.Plan_name,
          payment_status: 'successful', starting_date: new Date().toISOString(), expiry_date: expiryDateISO,
          amount_paid_to_edunexus: 0, amount_recieved_to_teacher: 0, referral_code_used: referralCodeInput.trim() || null,
        });
        await pb.collection('users').update(currentUser.id, { "subscription_by_teacher+": pageData.teacherData.id });
        await pb.collection('teachers_upgrade_plan').update(plan.id, { "enrolled_students+": currentUser.id });
        toast({ title: "Enrollment Successful!", description: `You are now enrolled in "${plan.Plan_name}".` });
        fetchData(); 
      } catch(err: any) {
        toast({ title: "Enrollment Failed", description: `Could not enroll you: ${err.data?.message || err.message}`, variant: "destructive" });
      } finally { setProcessingPaymentForPlanId(null); }
      return;
    }

    try {
      const orderResponse = await fetch('/api/razorpay/create-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountForApi, currency: 'INR', planId: plan.id, userId: currentUser.id, userType: 'student_teacher_plan', teacherIdForPlan: pageData.teacherData.id, referralCodeUsed: referralCodeInput.trim() || null, productDescription: `${pageData.teacherData.name}'s Plan - ${plan.Plan_name}` }),
      });
      const responseText = await orderResponse.text();
      if (!orderResponse.ok) { let errorData = { error: `Server error (${orderResponse.status}): ${responseText || 'Failed to create order.'}` }; try { errorData = JSON.parse(responseText); } catch (e) {} throw new Error(errorData.error); }
      const order = JSON.parse(responseText);

      const options = {
        key: razorpayKeyId, amount: order.amount, currency: order.currency, name: AppConfig.appName, description: `Subscription to ${pageData.teacherData.name}'s ${plan.Plan_name} Plan`, order_id: order.id,
        handler: async (response: any) => {
          toast({ title: "Payment Initiated", description: "Verifying your payment..." });
          try {
            const verificationResponse = await fetch('/api/razorpay/verify-payment', { method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature, planId: plan.id, userId: currentUser.id, userType: 'student_teacher_plan', teacherIdForPlan: pageData.teacherData.id, referralCodeUsed: referralCodeInput.trim() || null, productDescription: `${pageData.teacherData.name}'s Plan - ${plan.Plan_name}` }),
            });
            const verificationData = await verificationResponse.json();
            if (verificationResponse.ok && verificationData.verified) { toast({ title: "Payment Successful!", description: "Processing your subscription..." }); fetchData(); }
            else { toast({ title: "Payment Verification Failed", description: verificationData.error || "Contact support.", variant: "destructive" }); }
          } catch (verifyError: any) { toast({ title: "Verification Error", description: verifyError.message || "An error occurred.", variant: "destructive" }); }
          setProcessingPaymentForPlanId(null);
        },
        prefill: { name: currentUser.name || "", email: currentUser.email || "", contact: currentUser.phoneNumber || "" },
        notes: { plan_id: plan.id, student_id: currentUser.id, teacher_id: pageData.teacherData.id, user_type: 'student_teacher_plan', app_name: AppConfig.appName, referral_code: referralCodeInput.trim() || null },
        theme: { color: "#3F51B5" }, modal: { ondismiss: () => { toast({ title: "Payment Cancelled", variant: "default" }); setProcessingPaymentForPlanId(null); } }
      };
      const rzp = new window.Razorpay(options); rzp.on('payment.failed', (resp: any) => { toast({ title: "Payment Failed", description: `Error: ${resp.error.description}`, variant: "destructive" }); setProcessingPaymentForPlanId(null); }); rzp.open();
    } catch (error: any) { toast({ title: "Payment Setup Error", description: error.message || "Could not initiate payment.", variant: "destructive" }); setProcessingPaymentForPlanId(null); }
  };

  const isStudentSubscribedToPlan = (planId: string) => {
    return pageData?.studentSubscriptionsToThisTeacher?.some(sub => sub.teachers_plan_id === planId && sub.payment_status === 'successful' && (!sub.expiry_date || !isPast(new Date(sub.expiry_date))));
  };

  if (isLoading) { return ( <div className="flex flex-col min-h-screen bg-muted/30"> <main className="flex-1 container mx-auto px-2 sm:px-4 py-6 md:py-8 max-w-4xl"> <Skeleton className="h-12 w-3/4 mb-4" /> <Card className="shadow-xl"><CardHeader className="p-4 sm:p-6 text-center border-b"> <Skeleton className="h-24 w-24 rounded-full mx-auto mb-3" /> <Skeleton className="h-8 w-1/2 mx-auto" /> </CardHeader> <CardContent className="p-4 sm:p-6 space-y-6"> <Skeleton className="h-20 w-full" /> <Skeleton className="h-32 w-full" /> </CardContent> </Card> </main> </div> ); }
  if (error) { return ( <div className="flex flex-col min-h-screen bg-muted/30"> <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl"> <Card className="text-center shadow-lg border-destructive bg-destructive/10"><CardHeader><AlertCircle className="mx-auto h-12 w-12 text-destructive mb-3" /><CardTitle className="text-destructive">Error Loading Page</CardTitle></CardHeader><CardContent><p className="text-destructive/90 whitespace-pre-wrap">{error}</p></CardContent><CardFooter><Button onClick={() => router.push(Routes.home)} variant="outline" className="mx-auto">Go to Homepage</Button></CardFooter></Card> </main> </div> ); }
  if (!pageData || !pageData.teacherData) { return ( <div className="flex flex-col min-h-screen bg-muted/30"> <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl"> <Card className="text-center shadow-lg"><CardHeader><AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-3" /><CardTitle>Profile Not Found</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">The teacher profile does not exist or is unavailable.</p></CardContent><CardFooter><Button onClick={() => router.push(Routes.home)} variant="outline" className="mx-auto">Go to Homepage</Button></CardFooter></Card> </main> </div> ); }

  const { teacherData, contentPlans, teacherAvatarUrl } = pageData;

  return (
    <div className="flex flex-col min-h-screen bg-muted/30 dark:bg-slate-950">
      <main className="flex-1 container mx-auto px-2 sm:px-4 py-6 md:py-8 max-w-4xl">
        {(currentUser || currentTeacher) && (
             <Button variant="outline" size="sm" onClick={() => router.push(currentUser ? Routes.dashboard : Routes.teacherDashboard)} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </Button>
        )}
        <Card className="shadow-xl border-t-4 border-primary rounded-xl overflow-hidden mb-8">
          <CardHeader className="p-4 sm:p-6 text-center bg-gradient-to-br from-primary/10 via-background to-background border-b">
            <Avatar className="h-24 w-24 sm:h-28 sm:w-28 text-4xl border-4 border-card shadow-lg mx-auto mb-3 bg-muted">
              {teacherAvatarUrl ? <AvatarImage src={teacherAvatarUrl} alt={teacherData.name} data-ai-hint="teacher profile picture"/> : null}
              <AvatarFallback className="bg-primary/20 text-primary">{teacherData.name?.charAt(0).toUpperCase() || 'T'}</AvatarFallback>
            </Avatar>
            <CardTitle className="text-2xl sm:text-3xl font-bold text-foreground">{teacherData.name}'s Content Plans</CardTitle>
            {teacherData.EduNexus_Name && <p className="text-sm text-accent font-mono">@{teacherData.EduNexus_Name}</p>}
          </CardHeader>
        </Card>
        
        <Card className="mb-8 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Tag className="text-primary h-5 w-5"/>Have a Referral Code?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-2 items-start">
              <Input 
                type="text" 
                placeholder="Enter referral code from teacher" 
                value={referralCodeInput}
                onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase())}
                className="flex-grow"
              />
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => toast({title: "Referral Code Noted", description:"The code will be applied at checkout if valid for the selected plan."})}>
                Apply Code
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Enter code before selecting a plan to see potential discounts.</p>
          </CardContent>
        </Card>

        {contentPlans.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {contentPlans.map(plan => {
              const isSubscribed = isStudentSubscribedToPlan(plan.id);
              const isOwnPlan = currentTeacher?.id === teacherData.id; // Check if viewer is the teacher themself

              return (
                <Card key={plan.id} className="shadow-md hover:shadow-lg transition-shadow bg-card border flex flex-col">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-semibold text-foreground">{plan.Plan_name}</CardTitle>
                    <div className="flex items-baseline">
                      <span className="text-2xl font-bold text-primary">₹{plan.plan_price}</span>
                      <span className="text-sm text-muted-foreground ml-1">/ {plan.plan}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-1 flex-grow">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Features:</p>
                    <ul className="list-disc list-inside pl-2">
                      {[plan.plan_point_1, plan.plan_point_2, plan.plan_point_3, plan.plan_point_4, plan.plan_point_5].filter(Boolean).map((point, idx) => <li key={idx}>{point}</li>)}
                    </ul>
                  </CardContent>
                  <CardFooter className="pt-3 mt-auto">
                    {isOwnPlan ? (
                        <Button variant="outline" className="w-full" asChild>
                            <Link href={Routes.teacherViewPlan(plan.id)}>Manage This Plan</Link>
                        </Button>
                    ) : isSubscribed ? (
                      <Button variant="outline" className="w-full" disabled>
                        <CheckCircle className="mr-2 h-4 w-4 text-green-500"/> Subscribed
                      </Button>
                    ) : currentUser ? (
                      <Button 
                        size="sm" 
                        className="w-full bg-primary hover:bg-primary/90"
                        onClick={() => handleSubscribeToTeacherPlan(plan)}
                        disabled={processingPaymentForPlanId === plan.id}
                      >
                        {processingPaymentForPlanId === plan.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ShoppingCart className="mr-2 h-4 w-4"/>}
                        {processingPaymentForPlanId === plan.id ? 'Processing...' : 'Subscribe'}
                      </Button>
                    ) : (
                      <Button size="sm" className="w-full" asChild>
                        <Link href={Routes.login + `?redirect=${encodeURIComponent(window.location.pathname)}`}>Login to Subscribe</Link>
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="text-center py-10 shadow-md">
            <BookOpenCheck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle>No Content Plans Available</CardTitle>
            <CardDescription>{teacherData.name} has not published any content plans yet. Check back later!</CardDescription>
          </Card>
        )}
      </main>
      <footer className="py-6 text-center text-xs text-muted-foreground border-t bg-background dark:bg-slate-900"> © {new Date().getFullYear()} {AppConfig.appName} </footer>
    </div>
  );
}

