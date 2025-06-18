'use client';

import { useEffect, useState, useCallback, ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import NextImage from 'next/image';
import Link from 'next/link';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import { useToast } from '@/hooks/use-toast';
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
import type { User, Plan as AppPlanType, TeacherPlan as TeacherPlanType, UserSubscriptionTierStudent, TeacherReferralCode } from '@/lib/types';
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
  teachers_plan_id: string;
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
  const { user: currentUser, teacher: currentTeacher } = useAuth(); 
  const { toast } = useToast();
  const edunexusNameParam = typeof params.edunexusName === 'string' ? params.edunexusName : '';

  const [pageData, setPageData] = useState<TeacherPlansPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [processingPaymentForPlanId, setProcessingPaymentForPlanId] = useState<string | null>(null);

  const [appliedReferralDetails, setAppliedReferralDetails] = useState<{ code: string; discountPercentage: number; applicablePlanIds: string[]; expiry_date?: string; } | null>(null);
  const [isVerifyingReferral, setIsVerifyingReferral] = useState(false);
  const [referralError, setReferralError] = useState<string | null>(null);


  const edunexusName = edunexusNameParam ? escapeForPbFilter(edunexusNameParam) : '';
  const activeUser = currentUser || currentTeacher;

  const fetchData = useCallback(async (isMountedGetter: () => boolean = () => true) => {
    if (!edunexusName) { if (isMountedGetter()) { setError("Teacher identifier missing in URL."); setIsLoading(false); } return; }
    if (isMountedGetter()) { setIsLoading(true); setError(null); }
    
    console.log(`[TeacherPlansPage] fetchData called. Current viewer: Student ID: ${currentUser?.id || 'N/A'}, Teacher ID: ${currentTeacher?.id || 'N/A'}. Target teacher EduNexus_Name: ${edunexusName}`);

    try {
      const teacherDataRecords = await pb.collection('teacher_data').getFullList<TeacherDataRecord>({ filter: `EduNexus_Name = "${edunexusName}"` });
      if (!isMountedGetter()) return;
      if (teacherDataRecords.length === 0) { 
        if (isMountedGetter()) { setError("Teacher profile not found."); setIsLoading(false); }
        console.error(`[TeacherPlansPage] Teacher profile not found for EduNexus_Name: ${edunexusName}`);
        return;
      }
      const teacherData = teacherDataRecords[0];
      console.log(`[TeacherPlansPage] Successfully fetched teacherData. ID: ${teacherData.id}, Name: ${teacherData.name}`);
      const teacherAvatarUrl = getPbFileUrl(teacherData, 'profile_picture') || `https://ui-avatars.com/api/?name=${encodeURIComponent(teacherData.name?.charAt(0) || 'T')}&background=random&color=fff&size=128`;

      const plansFilter = `teacher = "${teacherData.id}"`;
      console.log(`[TeacherPlansPage] Attempting to fetch contentPlans with filter: '${plansFilter}'`);
      const contentPlans = await pb.collection('teachers_upgrade_plan').getFullList<TeacherPlanType>({ filter: plansFilter, sort: '-created' });
      console.log(`Fetched ${contentPlans.length} content plans for teacher ${teacherData.id}`);
      
      let studentSubscriptions: StudentSubscribedPlanRecord[] = [];
      if (currentUser?.id && teacherData.id) {
        const studentSubFilter = `student = "${currentUser.id}" && teacher = "${teacherData.id}" && payment_status = "successful"`;
        console.log(`[TeacherPlansPage] Fetching student subscriptions for student ${currentUser.id} and teacher ${teacherData.id} with filter: '${studentSubFilter}'`);
        try {
          studentSubscriptions = await pb.collection('students_teachers_upgrade_plan').getFullList<StudentSubscribedPlanRecord>({
            filter: studentSubFilter,
          });
           console.log(`[TeacherPlansPage] Fetched ${studentSubscriptions.length} subscriptions for current student with this teacher.`);
        } catch (subError) {
          console.warn("[TeacherPlansPage] Could not fetch student's current subscriptions for this teacher:", subError);
        }
      }
      
      if (!isMountedGetter()) return;
      setPageData({ teacherData, contentPlans, teacherAvatarUrl, studentSubscriptionsToThisTeacher: studentSubscriptions });
      if (contentPlans.length === 0) {
        console.warn(`[TeacherPlansPage] No content plans were found for teacher ${teacherData.id} using filter "${plansFilter}". Check PocketBase data and 'teachers_upgrade_plan' API rules if they are not fully public or if the teacher has no plans linked.`);
      }

    } catch (err: any) { 
      if (isMountedGetter()) { 
        const clientError = err as ClientResponseError; 
        if (clientError?.isAbort || (clientError?.name === 'ClientResponseError' && clientError?.status === 0)) { 
          console.warn('[TeacherPlansPage] Fetch data request was cancelled.'); 
        } else { 
          console.error("[TeacherPlansPage] Failed to fetch page data:", clientError.data || clientError); 
          setError(`Could not load teacher plans. Error: ${clientError.data?.message || clientError.message}`); 
        }
      }
    }
    finally { if (isMountedGetter()) setIsLoading(false); }
  }, [edunexusName, currentUser?.id, currentTeacher?.id]);

  useEffect(() => { 
    let isMounted = true; 
    fetchData(() => isMounted); 
    return () => { isMounted = false; }; 
  }, [fetchData]);

  const handleApplyReferralCode = async () => {
    if (!referralCodeInput.trim() || !pageData?.teacherData?.id) {
      setReferralError("Please enter a code and ensure teacher data is loaded.");
      return;
    }
    setIsVerifyingReferral(true);
    setReferralError(null);
    setAppliedReferralDetails(null);

    try {
      const codeString = referralCodeInput.trim().toUpperCase();
      const filter = `teacher = "${pageData.teacherData.id}" && referral_code_string = "${escapeForPbFilter(codeString)}"`;
      const promoRecord = await pb.collection('teacher_refferal_code').getFirstListItem<TeacherReferralCode>(filter);

      if (promoRecord.expiry_date && isPast(new Date(promoRecord.expiry_date))) {
        setReferralError("This referral code has expired.");
        toast({ title: "Code Expired", variant: "destructive" });
        return;
      }
      
      setAppliedReferralDetails({
        code: promoRecord.referral_code_string,
        discountPercentage: Number(promoRecord.discount_percentage),
        applicablePlanIds: Array.isArray(promoRecord.applicable_plan_ids) ? promoRecord.applicable_plan_ids : [],
        expiry_date: promoRecord.expiry_date
      });
      toast({ title: "Referral Code Applied!", description: `Discount of ${promoRecord.discount_percentage}% will be applied to eligible plans.` });

    } catch (error: any) {
      if (error.status === 404) {
        setReferralError("Invalid or expired referral code for this teacher.");
        toast({ title: "Invalid Code", variant: "destructive" });
      } else {
        setReferralError("Could not verify code. Please try again.");
        toast({ title: "Verification Error", variant: "destructive" });
      }
    } finally {
      setIsVerifyingReferral(false);
    }
  };


  const handleSubscribeToTeacherPlan = async (plan: TeacherPlanType, finalPrice: number) => {
    if (!currentUser || !currentUser.id) { toast({ title: "Login Required", description: "Please login as a student to subscribe.", variant: "destructive" }); router.push(Routes.login + `?redirect=${encodeURIComponent(window.location.pathname)}`); return; }
    if (!pageData?.teacherData?.id) { toast({ title: "Error", description: "Teacher information is missing.", variant: "destructive" }); return; }
    setProcessingPaymentForPlanId(plan.id);

    const razorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    if (!razorpayKeyId) { console.error("[TeacherPlansPage] CRITICAL: Razorpay Key ID not configured."); toast({ title: "Payment Error", description: "Gateway client key missing. Contact support.", variant: "destructive" }); setProcessingPaymentForPlanId(null); return; }

    const amountForApi = parseFloat(finalPrice.toFixed(2)); 
    if (isNaN(amountForApi)) { toast({ title: "Payment Error", description: "Invalid plan price.", variant: "destructive" }); setProcessingPaymentForPlanId(null); return; }
    
    if (amountForApi <= 0) { // Allows for 100% discount or free plans
      toast({ title: "Enrollment Initiated", description: `Processing enrollment for "${plan.Plan_name}"...`, variant: "default"});
      try {
        const today = new Date(); const expiryDateISO = new Date(today.setFullYear(today.getFullYear() + 1)).toISOString();
        await pb.collection('students_teachers_upgrade_plan').create({
          student: currentUser.id, teacher: pageData.teacherData.id, teachers_plan_id: plan.id, teachers_plan_name_cache: plan.Plan_name,
          payment_status: 'successful', starting_date: new Date().toISOString(), expiry_date: expiryDateISO,
          amount_paid_to_edunexus: 0, amount_recieved_to_teacher: 0, referral_code_used: appliedReferralDetails?.code || referralCodeInput.trim() || null,
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
        body: JSON.stringify({ amount: amountForApi, currency: 'INR', planId: plan.id, userId: currentUser.id, userType: 'student_teacher_plan', teacherIdForPlan: pageData.teacherData.id, referralCodeUsed: appliedReferralDetails?.code || referralCodeInput.trim() || null, productDescription: `${pageData.teacherData.name}'s Plan - ${plan.Plan_name}` }),
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
              body: JSON.stringify({ razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature, planId: plan.id, userId: currentUser.id, userType: 'student_teacher_plan', teacherIdForPlan: pageData.teacherData.id, referralCodeUsed: appliedReferralDetails?.code || referralCodeInput.trim() || null, productDescription: `${pageData.teacherData.name}'s Plan - ${plan.Plan_name}` }),
            });
            const verificationData = await verificationResponse.json();
            if (verificationResponse.ok && verificationData.verified) { toast({ title: "Payment Successful!", description: "Processing your subscription..." }); fetchData(); }
            else { toast({ title: "Payment Verification Failed", description: verificationData.error || "Contact support.", variant: "destructive" }); }
          } catch (verifyError: any) { toast({ title: "Verification Error", description: verifyError.message || "An error occurred.", variant: "destructive" }); }
          setProcessingPaymentForPlanId(null);
        },
        prefill: { name: currentUser.name || "", email: currentUser.email || "", contact: currentUser.phoneNumber || "" },
        notes: { plan_id: plan.id, student_id: currentUser.id, teacher_id: pageData.teacherData.id, user_type: 'student_teacher_plan', app_name: AppConfig.appName, referral_code: appliedReferralDetails?.code || referralCodeInput.trim() || null },
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
             <Button variant="outline" size="sm" onClick={() => router.push(currentTeacher ? Routes.teacherDashboard : Routes.dashboard)} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </Button>
        )}
        <Card className="shadow-xl border-t-4 border-primary rounded-xl overflow-hidden mb-8">
          <CardHeader className="p-4 sm:p-6 text-center bg-gradient-to-br from-primary/10 via-background to-background border-b">
            <Avatar className="h-24 w-24 sm:h-28 sm:w-28 text-4xl border-4 border-card shadow-lg mx-auto mb-3 bg-muted">
              {teacherAvatarUrl ? <NextImage src={teacherAvatarUrl} alt={teacherData.name} width={112} height={112} className="rounded-full object-cover" data-ai-hint="teacher avatar"/> : null}
              <AvatarFallback className="bg-primary/20 text-primary">{teacherData.name?.charAt(0).toUpperCase() || 'T'}</AvatarFallback>
            </Avatar>
            <CardTitle className="text-2xl sm:text-3xl font-bold text-foreground">{teacherData.name}'s Content Plans</CardTitle>
            {teacherData.EduNexus_Name && <p className="text-sm text-accent font-mono">@{teacherData.EduNexus_Name}</p>}
          </CardHeader>
        </Card>
        
        <Card className="mb-8 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Tag className="text-primary h-5 w-5"/>Have a Referral Code from {teacherData.name}?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-2 items-start">
              <Input 
                type="text" 
                placeholder="Enter referral code" 
                value={referralCodeInput}
                onChange={(e) => {
                  setReferralCodeInput(e.target.value.toUpperCase());
                  setReferralError(null);
                  if (appliedReferralDetails && e.target.value.toUpperCase() !== appliedReferralDetails.code) {
                    setAppliedReferralDetails(null);
                  }
                }}
                className="flex-grow"
              />
              <Button variant="outline" className="w-full sm:w-auto" onClick={handleApplyReferralCode} disabled={isVerifyingReferral || !referralCodeInput.trim()}>
                {isVerifyingReferral ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                Apply Code
              </Button>
            </div>
            {referralError && <p className="text-sm text-destructive mt-2">{referralError}</p>}
            {appliedReferralDetails && !referralError && (
              <div className="text-sm text-green-600 mt-2 flex items-center gap-1">
                <CheckCircle className="h-4 w-4"/> Code "{appliedReferralDetails.code}" applied! {appliedReferralDetails.discountPercentage > 0 ? `${appliedReferralDetails.discountPercentage}% off eligible plans.` : 'Discount applied.'}
              </div>
            )}
          </CardContent>
        </Card>

        {contentPlans.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {contentPlans.map(plan => {
              const isSubscribed = isStudentSubscribedToPlan(plan.id);
              const isOwnPlan = currentTeacher?.id === teacherData.id; 

              let finalPrice = parseFloat(plan.plan_price || "0");
              let originalPriceDisplay: string | null = null;
              if (appliedReferralDetails && 
                  finalPrice > 0 &&
                  (appliedReferralDetails.applicablePlanIds.length === 0 || appliedReferralDetails.applicablePlanIds.includes(plan.id)) &&
                  (!appliedReferralDetails.expiry_date || !isPast(new Date(appliedReferralDetails.expiry_date)))) {
                originalPriceDisplay = `₹${finalPrice.toFixed(0)}`;
                finalPrice = finalPrice * (1 - appliedReferralDetails.discountPercentage / 100);
                finalPrice = Math.max(0, finalPrice); // Ensure price doesn't go negative
              }
              const effectivePriceString = `₹${finalPrice.toFixed(0)}`;


              return (
                <Card key={plan.id} className={cn("shadow-md hover:shadow-lg transition-shadow bg-card border flex flex-col", isSubscribed && "border-2 border-green-500 ring-1 ring-green-500/30 bg-green-500/5")}>
                  <CardHeader className="pb-3">
                    {isSubscribed && <Badge variant="default" className="absolute top-3 right-3 bg-green-500 text-white">Subscribed</Badge>}
                    <CardTitle className="text-lg font-semibold text-foreground">{plan.Plan_name}</CardTitle>
                    <div className="flex items-baseline">
                      {originalPriceDisplay && (
                        <span className="text-xl line-through text-muted-foreground mr-2">{originalPriceDisplay}</span>
                      )}
                      <span className="text-2xl font-bold text-primary">{effectivePriceString}</span>
                      <span className="text-sm text-muted-foreground ml-1">/ {plan.plan}</span>
                    </div>
                    {originalPriceDisplay && appliedReferralDetails && (
                         <Badge variant="secondary" className="text-xs mt-1 bg-green-100 text-green-700 border-green-300">
                            {appliedReferralDetails.discountPercentage}% off with code {appliedReferralDetails.code}!
                        </Badge>
                    )}
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
                        onClick={() => handleSubscribeToTeacherPlan(plan, finalPrice)}
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
