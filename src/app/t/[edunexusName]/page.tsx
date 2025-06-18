
'use client';

import { useEffect, useState, useCallback, ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import NextImage from 'next/image';
import Link from 'next/link';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import { useToast } from '@/hooks/use-toast';
import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AppConfig, Routes, escapeForPbFilter } from '@/lib/constants';
import { Input } from '@/components/ui/input';
import {
  AlertCircle, GraduationCap, BarChart2, Users, Link as LinkIcon, Instagram, Facebook, Youtube, Twitter, Send as TelegramIcon, Globe as WebsiteIcon, ExternalLink, ShieldCheck, Star, TrendingUp, ShoppingCart, ListChecks, DollarSign, Loader2, Tag
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { User, Plan as AppPlanType } from '@/lib/types'; // Use AppPlanType for pricing, TeacherPlan for content plans
import { useAuth } from '@/contexts/AuthContext'; // Added import

// --- Types ---
interface TeacherDataRecord extends RecordModel {
  name: string;
  profile_picture?: string;
  institute_name?: string;
  EduNexus_Name: string;
  about?: string;
  subjects_offered?: string[];
  favExam?: string[];
  level?: 'Beginner' | 'Experienced';
}

interface TeacherAdRecord extends RecordModel {
  user: string; // Teacher ID
  instagram_page?: string;
  facebook_page?: string;
  edunexus_profile?: string;
  youtube_channel?: string;
  x_page?: string;
  telegram_channel_username?: string;
  teacher_app_link?: string;
  about?: string;
  profile_pic_if_not_edunexus_pic?: string;
  total_student_trained?: number;
  students_of_100_percentile_if_any?: number;
  students_above_99_percentile_if_any?: number;
  students_above_98_percentile_if_any?: number;
  students_above_90_percentile_if_any?: number;
  followers?: number;
  total_edunexus_subscription_offered?: number;
  plan?: string[]; // Array of TeacherPlan IDs to feature
}

interface TeacherPlanRecord extends RecordModel { // This is for `teachers_upgrade_plan` collection
  id: string;
  Plan_name: string;
  plan_price: string; // Stored as string "0" or "299"
  plan: 'Monthly' | 'Weekly' | 'Yearly'; // This is plan_duration in schema
  plan_point_1?: string;
  plan_point_2?: string;
  plan_point_3?: string;
  plan_point_4?: string;
  plan_point_5?: string;
  teacher: string;
}

interface TeacherAdPageData {
  teacherData: TeacherDataRecord;
  adData: TeacherAdRecord | null;
  contentPlans: TeacherPlanRecord[]; // Renamed from featuredPlans
  teacherAvatarUrl: string;
  adSpecificAvatarUrl?: string | null;
}

interface SocialLinkProps {
  href?: string;
  icon: ReactNode;
  label: string;
}

// --- Helper Function (Module Scope) ---
const getPbFileUrl = (record: RecordModel | null | undefined, fieldName: string): string | null => {
  if (record && record[fieldName] && typeof record[fieldName] === 'string' && record.collectionId && record.collectionName) {
    try {
      return pb.files.getUrl(record, record[fieldName] as string);
    } catch (e) {
      console.warn(`Error getting URL for ${fieldName} in record ${record.id}:`, e);
      return null;
    }
  }
  return null;
};

// --- Main Component ---
export default function TeacherPublicAdPage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser } = useAuth(); // This is the student user viewing the page
  const { toast } = useToast();
  const edunexusNameParam = typeof params.edunexusName === 'string' ? params.edunexusName : '';

  const [pageData, setPageData] = useState<TeacherAdPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [processingPaymentForPlanId, setProcessingPaymentForPlanId] = useState<string | null>(null);


  const edunexusName = edunexusNameParam ? escapeForPbFilter(edunexusNameParam) : '';

  const SocialLink: React.FC<SocialLinkProps> = ({ href, icon, label }) => {
    if (!href || !href.trim()) return null;
    let displayHref = href;
    try { const url = new URL(href); displayHref = url.hostname.replace('www.', '') + (url.pathname === '/' ? '' : url.pathname); } catch (e) {/* Use original */}
    return ( <a href={href} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2 rounded-lg border bg-card p-3 text-sm text-card-foreground shadow-sm transition-all hover:shadow-md hover:border-primary/50 hover:bg-primary/5"> <div className="text-primary group-hover:text-primary/80 transition-colors">{icon}</div> <div className="flex-grow min-w-0"> <span className="block font-medium text-foreground group-hover:text-primary truncate" title={label}>{label}</span> <span className="block text-xs text-muted-foreground truncate" title={href}>{displayHref}</span> </div> <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" /> </a> );
  };

  const getStatCard = (icon: ReactNode, label: string, value?: number | string | null): ReactNode => {
    if (value === undefined || value === null || String(value).trim() === '') return null;
    return ( <Card className="bg-card p-3 text-center shadow-sm hover:shadow-md transition-shadow"> <div className="flex justify-center text-primary mb-1.5">{icon}</div> <p className="text-xl font-bold text-foreground">{String(value)}</p> <p className="text-xs text-muted-foreground">{label}</p> </Card> );
  };

  const fetchData = useCallback(async (isMountedGetter: () => boolean = () => true) => {
    if (!edunexusName) { if (isMountedGetter()) { setError("Teacher identifier missing in URL."); setIsLoading(false); } return; }
    if (isMountedGetter()) { setIsLoading(true); setError(null); }

    try {
      const teacherDataRecords = await pb.collection('teacher_data').getFullList<TeacherDataRecord>({ filter: `EduNexus_Name = "${edunexusName}"` });
      if (!isMountedGetter()) return;
      if (teacherDataRecords.length === 0) { if (isMountedGetter()) { setError("Teacher profile not found."); setIsLoading(false); } return; }
      const teacherData = teacherDataRecords[0];
      const teacherAvatarUrl = getPbFileUrl(teacherData, 'profile_picture') || `https://ui-avatars.com/api/?name=${encodeURIComponent(teacherData.name?.charAt(0) || 'T')}&background=random&color=fff&size=128`;

      let adData: TeacherAdRecord | null = null; let adSpecificAvatarUrl: string | null = null; let contentPlans: TeacherPlanRecord[] = [];
      try {
        const adRecords = await pb.collection('teacher_ads').getFullList<TeacherAdRecord>({ filter: `user = "${teacherData.id}"`, sort: '-created' });
        if (!isMountedGetter()) return;
        if (adRecords.length > 0) { adData = adRecords[0]; adSpecificAvatarUrl = getPbFileUrl(adData, 'profile_pic_if_not_edunexus_pic');
          if (adData.plan && Array.isArray(adData.plan) && adData.plan.length > 0) {
            const planFilter = adData.plan.map(id => `id = "${escapeForPbFilter(id)}"`).join(' || ');
            if (planFilter) contentPlans = await pb.collection('teachers_upgrade_plan').getFullList<TeacherPlanRecord>({ filter: planFilter, sort: '-created' });
          }
        }
      } catch (adError: any) { if (isMountedGetter()) console.warn("Ad data not found or error fetching, proceeding with teacher data only:", adError.data || adError.message); }
      
      if (!isMountedGetter()) return;
      // If no featured plans in ad OR if adData itself is null, fetch all plans for this teacher
      if (contentPlans.length === 0 && teacherData.id) {
        contentPlans = await pb.collection('teachers_upgrade_plan').getFullList<TeacherPlanRecord>({ filter: `teacher = "${teacherData.id}"`, sort: '-created' });
      }
      if (isMountedGetter()) setPageData({ teacherData, adData, contentPlans, teacherAvatarUrl, adSpecificAvatarUrl });
    } catch (err: any) { if (isMountedGetter()) { const clientError = err as ClientResponseError; if (clientError?.isAbort || (clientError?.name === 'ClientResponseError' && clientError?.status === 0)) { console.warn('Fetch data request was cancelled.'); } else { console.error("Failed to fetch page data:", clientError.data || clientError); setError(`Could not load teacher profile. Error: ${clientError.data?.message || clientError.message}`); }}}
    finally { if (isMountedGetter()) setIsLoading(false); }
  }, [edunexusName]);

  useEffect(() => { let isMounted = true; fetchData(() => isMounted); return () => { isMounted = false; }; }, [fetchData]);

  const handleSubscribeToTeacherPlan = async (plan: TeacherPlanRecord) => {
    if (!currentUser || !currentUser.id) { toast({ title: "Login Required", description: "Please login as a student to subscribe.", variant: "destructive" }); router.push(Routes.login); return; }
    if (!pageData?.teacherData?.id) { toast({ title: "Error", description: "Teacher information is missing.", variant: "destructive" }); return; }
    setProcessingPaymentForPlanId(plan.id);

    const razorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    if (!razorpayKeyId) { console.error("[TeacherAdPage] CRITICAL: Razorpay Key ID not configured."); toast({ title: "Payment Error", description: "Gateway client key missing. Contact support.", variant: "destructive" }); setProcessingPaymentForPlanId(null); return; }

    const amountForApi = parseFloat(plan.plan_price || "0"); 
    if (isNaN(amountForApi)) { toast({ title: "Payment Error", description: "Invalid plan price.", variant: "destructive" }); setProcessingPaymentForPlanId(null); return; }
    
    if (amountForApi <= 0) { // Handle "free" plans directly
      toast({ title: "Free Plan Enrollment", description: `Enrolling you in "${plan.Plan_name}"...`, variant: "default"});
      try {
        // Simulate verification by directly calling update logic (which would be in verify API)
        const today = new Date(); const expiryDateISO = new Date(today.setFullYear(today.getFullYear() + 1)).toISOString();
        await pb.collection('students_teachers_upgrade_plan').create({
          student: currentUser.id, teacher: pageData.teacherData.id, teachers_plan_id: plan.id, teachers_plan_name_cache: plan.Plan_name,
          payment_status: 'successful', starting_date: new Date().toISOString(), expiry_date: expiryDateISO,
          amount_paid_to_edunexus: 0, amount_recieved_to_teacher: 0, referral_code_used: referralCodeInput.trim() || null,
        });
        await pb.collection('users').update(currentUser.id, { "subscription_by_teacher+": pageData.teacherData.id });
        await pb.collection('teachers_upgrade_plan').update(plan.id, { "enrolled_students+": currentUser.id });
        toast({ title: "Enrollment Successful!", description: `You are now enrolled in "${plan.Plan_name}".` });
        router.push(Routes.myTeacherPortal); // Or wherever appropriate
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
            if (verificationResponse.ok && verificationData.verified) { toast({ title: "Payment Successful!", description: "Processing your subscription..." }); router.push(Routes.myTeacherPortal); }
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


  if (isLoading) { return ( <div className="flex flex-col min-h-screen bg-muted/30"> <Navbar /> <main className="flex-1 container mx-auto px-2 sm:px-4 py-6 md:py-8 max-w-4xl"> <Skeleton className="h-12 w-3/4 mb-4" /> <Card className="shadow-xl"><CardHeader className="p-4 sm:p-6 text-center border-b"> <Skeleton className="h-24 w-24 rounded-full mx-auto mb-3" /> <Skeleton className="h-8 w-1/2 mx-auto" /> <Skeleton className="h-5 w-1/3 mx-auto mt-1" /> </CardHeader> <CardContent className="p-4 sm:p-6 space-y-6"> <Skeleton className="h-20 w-full" /> <Skeleton className="h-32 w-full" /> <Skeleton className="h-48 w-full" /> </CardContent> </Card> </main> </div> ); }
  if (error) { return ( <div className="flex flex-col min-h-screen bg-muted/30"> <Navbar /> <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl"> <Card className="text-center shadow-lg border-destructive bg-destructive/10"><CardHeader><AlertCircle className="mx-auto h-12 w-12 text-destructive mb-3" /><CardTitle className="text-destructive">Error Loading Profile</CardTitle></CardHeader><CardContent><p className="text-destructive/90 whitespace-pre-wrap">{error}</p></CardContent><CardFooter><Button onClick={() => router.push(Routes.home)} variant="outline" className="mx-auto">Go to Homepage</Button></CardFooter></Card> </main> </div> ); }
  if (!pageData || !pageData.teacherData) { return ( <div className="flex flex-col min-h-screen bg-muted/30"> <Navbar /> <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl"> <Card className="text-center shadow-lg"><CardHeader><AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-3" /><CardTitle>Profile Not Found</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">The teacher profile does not exist or is unavailable.</p></CardContent><CardFooter><Button onClick={() => router.push(Routes.home)} variant="outline" className="mx-auto">Go to Homepage</Button></CardFooter></Card> </main> </div> ); }

  const { teacherData, adData, contentPlans, teacherAvatarUrl, adSpecificAvatarUrl } = pageData;
  const finalAbout = adData?.about || teacherData?.about || "No detailed information provided by the teacher yet.";
  const finalAvatar = adSpecificAvatarUrl || teacherAvatarUrl;

  const socialLinksList: SocialLinkProps[] = [ { href: adData?.instagram_page, icon: <Instagram size={18} />, label: "Instagram" }, { href: adData?.facebook_page, icon: <Facebook size={18} />, label: "Facebook" }, { href: adData?.youtube_channel, icon: <Youtube size={18} />, label: "YouTube" }, { href: adData?.x_page, icon: <Twitter size={18} />, label: "X (Twitter)" }, { href: adData?.telegram_channel_username, icon: <TelegramIcon size={18} />, label: "Telegram" }, { href: adData?.teacher_app_link, icon: <WebsiteIcon size={18} />, label: "App/Website" }, { href: adData?.edunexus_profile, icon: (AppConfig.appName === 'EduNexus' ? <GraduationCap size={18}/> : <LinkIcon size={18}/>), label: `${AppConfig.appName} Profile`}, ].filter(link => link.href && link.href.trim() !== '');

  return (
    <div className="flex flex-col min-h-screen bg-muted/30">
      <Navbar />
      <main className="flex-1 container mx-auto px-2 sm:px-4 py-6 md:py-8 max-w-4xl">
        <Card className="shadow-xl border-t-4 border-primary rounded-xl overflow-hidden">
          <CardHeader className="p-4 sm:p-6 text-center bg-gradient-to-br from-primary/10 via-background to-background border-b"> <Avatar className="h-28 w-28 sm:h-32 sm:w-32 text-4xl border-4 border-card shadow-lg mx-auto mb-3 bg-muted"> {finalAvatar ? <AvatarImage src={finalAvatar} alt={teacherData.name} data-ai-hint="teacher profile"/> : null} <AvatarFallback className="bg-primary/20 text-primary">{teacherData.name?.charAt(0).toUpperCase() || 'T'}</AvatarFallback> </Avatar> <CardTitle className="text-2xl sm:text-3xl font-bold text-foreground">{teacherData.name}</CardTitle> {teacherData.institute_name && <p className="text-md text-muted-foreground">{teacherData.institute_name}</p>} {teacherData.EduNexus_Name && <p className="text-sm text-accent font-mono">@{teacherData.EduNexus_Name}</p>} <div className="mt-3 flex flex-wrap justify-center gap-2"> {teacherData.level && <Badge variant="secondary">{teacherData.level}</Badge>} {teacherData.subjects_offered && teacherData.subjects_offered.map(sub => <Badge key={sub} variant="outline">{sub}</Badge>)} {teacherData.favExam && teacherData.favExam.map(exam => <Badge key={exam} variant="outline" className="border-primary/50 text-primary/90 bg-primary/5">{exam}</Badge>)} </div> </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-8">
            <section> <h2 className="text-xl font-semibold text-primary mb-3">About Me</h2> <p className="text-foreground/90 whitespace-pre-line leading-relaxed text-sm sm:text-base">{finalAbout}</p> </section>
            {socialLinksList.length > 0 && ( <section> <h2 className="text-xl font-semibold text-primary mb-4">Connect With Me</h2> <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"> {socialLinksList.map(link => <SocialLink key={link.label} {...link} />)} </div> </section> )}
            {adData && (Object.values(adData).some(val => typeof val === 'number' && val > 0) || (adData.total_student_trained || adData.total_edunexus_subscription_offered)) && ( <section> <h2 className="text-xl font-semibold text-primary mb-4">My Achievements & Reach</h2> <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4"> {getStatCard(<Users className="h-6 w-6" />, "Students Trained", adData.total_student_trained)} {getStatCard(<Star className="h-6 w-6" />, "100 Percentilers", adData.students_of_100_percentile_if_any)} {getStatCard(<TrendingUp className="h-6 w-6" />, "99+ Percentilers", adData.students_above_99_percentile_if_any)} {getStatCard(<BarChart2 className="h-6 w-6" />, "98+ Percentilers", adData.students_above_98_percentile_if_any)} {getStatCard(<GraduationCap className="h-6 w-6" />, "90+ Percentilers", adData.students_above_90_percentile_if_any)} {getStatCard(<ShieldCheck className="h-6 w-6" />, `${AppConfig.appName} Plans Sold`, adData.total_edunexus_subscription_offered)} </div> </section> )}
            
            {contentPlans.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold text-primary mb-4">Subscription Plans</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {contentPlans.map(plan => (
                    <Card key={plan.id} className="shadow-md hover:shadow-lg transition-shadow bg-card border flex flex-col">
                      <CardHeader className="pb-3"> <CardTitle className="text-lg text-foreground">{plan.Plan_name}</CardTitle> <div className="flex items-baseline"> <span className="text-2xl font-bold text-primary">₹{plan.plan_price}</span> <span className="text-sm text-muted-foreground ml-1">/ {plan.plan}</span> </div> </CardHeader>
                      <CardContent className="text-sm text-muted-foreground space-y-1 flex-grow"> <p className="text-xs font-semibold text-muted-foreground uppercase">Features:</p> <ul className="list-disc list-inside pl-2"> {[plan.plan_point_1, plan.plan_point_2, plan.plan_point_3, plan.plan_point_4, plan.plan_point_5].filter(Boolean).map((point, idx) => <li key={idx}>{point}</li>)} </ul> </CardContent>
                      <CardFooter className="pt-3 mt-auto flex flex-col sm:flex-row gap-2">
                        <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild><Link href={Routes.testSeries}>View Related Tests</Link></Button>
                        <Button size="sm" className="w-full sm:w-auto bg-primary hover:bg-primary/90" onClick={() => handleSubscribeToTeacherPlan(plan)} disabled={processingPaymentForPlanId === plan.id}>
                           {processingPaymentForPlanId === plan.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ShoppingCart className="mr-2 h-4 w-4"/>}
                           {processingPaymentForPlanId === plan.id ? 'Processing...' : 'Subscribe'}
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </section>
            )}
            {contentPlans.length > 0 && (
                <section className="mt-6 pt-6 border-t">
                    <h3 className="text-lg font-semibold text-foreground mb-2">Have a Referral Code?</h3>
                    <div className="flex flex-col sm:flex-row gap-2 items-start max-w-sm">
                        <Input 
                            type="text" 
                            placeholder="Enter referral code" 
                            value={referralCodeInput}
                            onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase())}
                            className="flex-grow"
                        />
                        <Button variant="outline" onClick={() => toast({title: "Referral Applied (Mock)", description: "If valid, discount will reflect on payment."})} className="w-full sm:w-auto">
                            <Tag className="mr-2 h-4 w-4"/>Apply Code
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Enter a code provided by the teacher before subscribing to a plan.</p>
                </section>
            )}
          </CardContent>
          <CardFooter className="p-4 sm:p-6 bg-muted/30 border-t text-center"> <p className="text-xs text-muted-foreground"> To enroll in {teacherData.name}'s courses or for inquiries, please use the contact links provided or subscribe to a plan. </p> </CardFooter>
        </Card>
      </main>
      <footer className="py-6 text-center text-xs text-muted-foreground border-t bg-background"> © {new Date().getFullYear()} {AppConfig.appName} </footer>
    </div>
  );
}

