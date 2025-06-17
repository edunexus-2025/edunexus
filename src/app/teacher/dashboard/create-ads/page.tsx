
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Megaphone, Construction, Loader2, Zap, ArrowRight, Info, Image as ImageIconLucide, Link as LinkIcon, Users, BarChart2, GraduationCap, ShieldPlus, Edit, Trash2, PlusCircle, Eye, AlertCircle, Save } from "lucide-react";
import Link from "next/link";
import { Routes, AppConfig } from "@/lib/constants";
// import Image from 'next/image'; // NextImage is used conditionally later
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect, useCallback } from "react";
import pb from "@/lib/pocketbase";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TeacherAdSchema, type TeacherAdInput } from "@/lib/schemas";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription as ShadcnFormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import type { ClientResponseError, RecordModel } from 'pocketbase';
import { format } from "date-fns";
import NextImage from 'next/image'; // Use NextImage for consistency

interface TeacherPlanOption {
  id: string;
  Plan_name: string;
}

interface TeacherAdRecord extends RecordModel, Omit<TeacherAdInput, 'profile_pic_if_not_edunexus_pic' | 'featured_plan_ids'> {
  user: string;
  profile_pic_if_not_edunexus_pic: string | null;
  plan: string[]; // This is how PocketBase stores multi-relation
}

export default function ManageAdsPage() {
  const { teacher, isLoadingTeacher, authRefresh } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [adsSubscriptionStatus, setAdsSubscriptionStatus] = useState<'Free' | 'Ads Model' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [teacherAvailablePlans, setTeacherAvailablePlans] = useState<TeacherPlanOption[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);

  const [ads, setAds] = useState<TeacherAdRecord[]>([]);
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [editingAd, setEditingAd] = useState<TeacherAdRecord | null>(null);
  const [currentAdImagePreview, setCurrentAdImagePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);


  const form = useForm<TeacherAdInput>({
    resolver: zodResolver(TeacherAdSchema),
    defaultValues: {
      instagram_page: '', facebook_page: '', edunexus_profile: '', youtube_channel: '',
      x_page: '', telegram_channel_username: '', teacher_app_link: '', about: '',
      profile_pic_if_not_edunexus_pic: null,
      total_student_trained: undefined, students_of_100_percentile_if_any: undefined,
      students_above_99_percentile_if_any: undefined, students_above_98_percentile_if_any: undefined,
      students_above_90_percentile_if_any: undefined, followers: undefined,
      total_edunexus_subscription_offered: undefined,
      featured_plan_ids: [],
    },
  });

  const fetchTeacherAds = useCallback(async (isMountedGetter: () => boolean = () => true) => {
    if (!teacher?.id || !isMountedGetter()) {
      if(isMountedGetter()) {
        setAds([]);
        setIsLoadingAds(false);
      }
      return;
    }
    if(isMountedGetter()) {
      setIsLoadingAds(true);
      setError(null);
    }
    try {
      const records = await pb.collection('teacher_ads').getFullList<TeacherAdRecord>({
        filter: `user = "${teacher.id}"`,
        sort: '-created',
      });
      if (isMountedGetter()) {
        setAds(records);
      }
    } catch (fetchError: any) {
      if (isMountedGetter()) {
        const clientError = fetchError as ClientResponseError;
        if (clientError?.isAbort || (clientError?.name === 'ClientResponseError' && clientError?.status === 0)) {
            console.warn('ManageAdsPage: Fetch teacher ads request was cancelled.');
        } else {
            console.error("Failed to fetch teacher ads:", clientError.data || clientError);
            setError("Could not load your existing ads. Please try refreshing.");
            toast({ title: "Error", description: "Could not load your existing ads.", variant: "destructive" });
        }
      }
    } finally {
      if(isMountedGetter()) setIsLoadingAds(false);
    }
  }, [teacher?.id, toast]);

  useEffect(() => {
    let isMounted = true;
    const componentIsMounted = () => isMounted;
    if (teacher) {
      setAdsSubscriptionStatus(teacher.ads_subscription || 'Free');
      fetchTeacherAds(componentIsMounted);
    } else if (!isLoadingTeacher && !teacher) {
        setIsLoadingAds(false);
        setAdsSubscriptionStatus('Free');
    }
    return () => { isMounted = false; };
  }, [teacher, isLoadingTeacher, fetchTeacherAds]);

  useEffect(() => {
    let isMounted = true;
    if (teacher?.id) {
      setIsLoadingPlans(true);
      pb.collection('teachers_upgrade_plan')
        .getFullList<TeacherPlanOption>({ filter: `teacher = "${teacher.id}"`, fields: 'id,Plan_name' })
        .then(plans => { if (isMounted) setTeacherAvailablePlans(plans); })
        .catch(err => {
          if (isMounted) {
            const clientError = err as ClientResponseError;
             if (clientError?.isAbort || (clientError?.name === 'ClientResponseError' && clientError?.status === 0)) {
              console.warn('Create Ads Page: Fetch teacher plans request was cancelled.');
            } else {
              console.error("Failed to fetch teacher plans for ad creation:", clientError.data || clientError);
              toast({title: "Error", description: "Could not load your existing plans.", variant: "destructive"});
            }
          }
        })
        .finally(() => { if (isMounted) setIsLoadingPlans(false); });
    }
    return () => { isMounted = false; };
  }, [teacher?.id, toast]);

  const handleEditAd = (ad: TeacherAdRecord) => {
    setEditingAd(ad);
    let imageUrl: string | null = null;
    if (ad.profile_pic_if_not_edunexus_pic && ad.collectionId && ad.collectionName) {
      imageUrl = pb.files.getUrl(ad, ad.profile_pic_if_not_edunexus_pic);
    }
    setCurrentAdImagePreview(imageUrl);
    form.reset({
      instagram_page: ad.instagram_page || '',
      facebook_page: ad.facebook_page || '',
      edunexus_profile: ad.edunexus_profile || (typeof window !== 'undefined' && teacher?.EduNexus_Name ? `${window.location.origin}/t/${teacher.EduNexus_Name}` : ''),
      youtube_channel: ad.youtube_channel || '',
      x_page: ad.x_page || '',
      telegram_channel_username: ad.telegram_channel_username || '',
      teacher_app_link: ad.teacher_app_link || '',
      about: ad.about || teacher?.about || '',
      profile_pic_if_not_edunexus_pic: null, // Field for new upload
      total_student_trained: ad.total_student_trained === null || ad.total_student_trained === undefined ? undefined : Number(ad.total_student_trained),
      students_of_100_percentile_if_any: ad.students_of_100_percentile_if_any === null || ad.students_of_100_percentile_if_any === undefined ? undefined : Number(ad.students_of_100_percentile_if_any),
      students_above_99_percentile_if_any: ad.students_above_99_percentile_if_any === null || ad.students_above_99_percentile_if_any === undefined ? undefined : Number(ad.students_above_99_percentile_if_any),
      students_above_98_percentile_if_any: ad.students_above_98_percentile_if_any === null || ad.students_above_98_percentile_if_any === undefined ? undefined : Number(ad.students_above_98_percentile_if_any),
      students_above_90_percentile_if_any: ad.students_above_90_percentile_if_any === null || ad.students_above_90_percentile_if_any === undefined ? undefined : Number(ad.students_above_90_percentile_if_any),
      followers: ad.followers === null || ad.followers === undefined ? undefined : Number(ad.followers),
      total_edunexus_subscription_offered: ad.total_edunexus_subscription_offered === null || ad.total_edunexus_subscription_offered === undefined ? undefined : Number(ad.total_edunexus_subscription_offered),
      featured_plan_ids: Array.isArray(ad.plan) ? ad.plan : [],
    });
  };
  
  useEffect(() => {
    if (editingAd) {
      // Form reset is handled by handleEditAd
    } else if (adsSubscriptionStatus === 'Ads Model' && !isLoadingAds && !error && ads.length === 0) {
      // This is the 'create' mode because no ad exists
      form.reset({
        edunexus_profile: typeof window !== 'undefined' && teacher?.EduNexus_Name ? `${window.location.origin}/t/${teacher.EduNexus_Name}` : '',
        about: teacher?.about || '',
        instagram_page: '', facebook_page: '', youtube_channel: '',
        x_page: '', telegram_channel_username: '', teacher_app_link: '',
        profile_pic_if_not_edunexus_pic: null,
        total_student_trained: undefined, students_of_100_percentile_if_any: undefined,
        students_above_99_percentile_if_any: undefined, students_above_98_percentile_if_any: undefined,
        students_above_90_percentile_if_any: undefined, followers: undefined,
        total_edunexus_subscription_offered: undefined,
        featured_plan_ids: [],
      });
      setCurrentAdImagePreview(null);
    }
  }, [editingAd, adsSubscriptionStatus, isLoadingAds, error, ads, teacher, form]);


  const handleDeleteAd = async (adId: string) => {
    if (!confirm("Are you sure you want to delete this advertisement? This action cannot be undone.")) return;
    try {
      await pb.collection('teacher_ads').delete(adId);
      toast({ title: "Advertisement Deleted", description: "The ad has been successfully removed." });
      fetchTeacherAds();
      setEditingAd(null); 
      setCurrentAdImagePreview(null);
    } catch (error: any) {
      toast({ title: "Deletion Failed", description: error.data?.message || error.message, variant: "destructive" });
    }
  };

  const onSubmit = async (values: TeacherAdInput) => {
    if (!teacher?.id) {
      toast({ title: "Error", description: "Teacher not authenticated.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append('user', teacher.id);

    Object.entries(values).forEach(([key, value]) => {
      const currentKey = key as keyof TeacherAdInput;
      if (currentKey === 'profile_pic_if_not_edunexus_pic') {
        if (value instanceof File) {
          formData.append(currentKey, value);
        } else if (editingAd && value === null) {
          formData.append(currentKey, ''); // Signal to clear the file
        }
      } else if (currentKey === 'featured_plan_ids') {
        if (Array.isArray(value) && value.length > 0) {
          value.forEach(planId => {
            if (planId && planId.trim() !== '') formData.append('plan', planId);
          });
        } else {
          // If empty array or undefined, send empty string for 'plan' to clear relation
          // PocketBase expects field name 'plan' for multi-relation 'featured_plan_ids'
          formData.append('plan', ''); 
        }
      } else {
        const numericKeys: Array<keyof TeacherAdInput> = [
          'total_student_trained', 'students_of_100_percentile_if_any',
          'students_above_99_percentile_if_any', 'students_above_98_percentile_if_any',
          'students_above_90_percentile_if_any', 'followers', 'total_edunexus_subscription_offered'
        ];

        if (value === undefined || value === null || value === '') { // Treat empty string for text/URL fields as clear
          if (editingAd) { // If editing, an explicitly undefined/null/empty value means clear it
            formData.append(currentKey, '');
          }
          // If creating and value is undefined/null/empty, don't append, let PB handle default
        } else if (numericKeys.includes(currentKey)) {
          const numValue = Number(value);
          if (!isNaN(numValue)) {
            formData.append(currentKey, String(numValue));
          } else if (editingAd) { // If NaN during edit, clear it
            formData.append(currentKey, '');
          }
        } else {
          formData.append(currentKey, String(value));
        }
      }
    });
    
    console.log("Submitting FormData to PocketBase. Entries:");
    for (let [key, val] of formData.entries()) {
      console.log(key, val);
    }

    try {
      if (editingAd) {
        await pb.collection('teacher_ads').update(editingAd.id, formData);
        toast({ title: "Advertisement Updated!", description: "Your ad has been successfully updated." });
      } else {
        await pb.collection('teacher_ads').create(formData);
        toast({ title: "Advertisement Created!", description: "Your ad has been successfully submitted." });
      }
      setEditingAd(null);
      fetchTeacherAds(); 
      setCurrentAdImagePreview(null);
      form.reset({ // Reset form to default creation state after successful submission
        edunexus_profile: typeof window !== 'undefined' && teacher?.EduNexus_Name ? `${window.location.origin}/t/${teacher.EduNexus_Name}` : '',
        about: teacher?.about || '',
        instagram_page: '', facebook_page: '', youtube_channel: '',
        x_page: '', telegram_channel_username: '', teacher_app_link: '',
        profile_pic_if_not_edunexus_pic: null,
        total_student_trained: undefined, students_of_100_percentile_if_any: undefined,
        students_above_99_percentile_if_any: undefined, students_above_98_percentile_if_any: undefined,
        students_above_90_percentile_if_any: undefined, followers: undefined,
        total_edunexus_subscription_offered: undefined,
        featured_plan_ids: [],
      });
    } catch (error: any) {
      let errorMessage = "Could not save your ad. An unexpected error occurred.";
      let errorForConsole: any = error;
      if (error instanceof Error && 'isAbort' in error && error.isAbort) {
        errorMessage = "Ad operation request was cancelled."; console.warn(errorMessage);
      } else if (error && typeof error === 'object' && 'name' in error && error.name === 'ClientResponseError') {
        const pbError = error as ClientResponseError; errorForConsole = pbError.data || pbError;
        if (pbError.data && typeof pbError.data === 'object') {
          if (pbError.data.message) errorMessage = pbError.data.message;
          if (pbError.data.data && typeof pbError.data.data === 'object' && Object.keys(pbError.data.data).length > 0) {
            const fieldErrors = Object.entries(pbError.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
            errorMessage += ` Details: ${fieldErrors}`;
          } else if (Object.keys(pbError.data).length > 0 && !pbError.data.message) errorMessage = `Server error: ${JSON.stringify(pbError.data)}`;
        } else if (pbError.message) errorMessage = pbError.message;
        else if (pbError.originalError?.message) errorMessage = pbError.originalError.message;
      } else if (error instanceof Error && error.message) errorMessage = error.message;
      console.error("Failed to save ad. Full error object:", error, "Parsed error data for console:", errorForConsole);
      toast({ title: editingAd ? "Ad Update Failed" : "Ad Creation Failed", description: errorMessage, variant: "destructive", duration: 9000 });
    } finally {
      setIsSubmitting(false);
    }
  };


  if (isLoadingTeacher || adsSubscriptionStatus === null) {
    return (
      <div className="space-y-8 p-4 md:p-6">
        <Card className="shadow-lg"><CardHeader><Skeleton className="h-10 w-3/4" /><Skeleton className="h-6 w-1/2 mt-2" /></CardHeader><CardContent className="p-10"><Skeleton className="h-48 w-full" /></CardContent></Card>
      </div>
    );
  }

  // Determine if the form should be shown for creating a new ad or editing an existing one.
  const showFormForCreate = adsSubscriptionStatus === 'Ads Model' && !isLoadingAds && !error && ads.length === 0 && !editingAd;
  const showFormForEdit = editingAd !== null;
  const shouldShowForm = showFormForCreate || showFormForEdit;


  return (
    <div className="space-y-8 p-4 md:p-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-3">
              <Megaphone className="h-8 w-8 text-primary" />
              <CardTitle className="text-3xl font-bold text-foreground">
                {editingAd ? "Edit Advertisement" : (showFormForCreate ? "Create Your Advertisement" : "Manage Advertisements")}
              </CardTitle>
            </div>
            <CardDescription>
              {editingAd ? "Update the details of your ad." : (showFormForCreate ? "Set up your promotional ad." : `Promote your courses. Current Ad Subscription: ${adsSubscriptionStatus}`)}
            </CardDescription>
          </div>
          {/* Conditionally render "View My Ad" button if an ad exists and not editing */}
          {adsSubscriptionStatus === 'Ads Model' && !isLoadingAds && !error && ads.length > 0 && !editingAd && teacher?.EduNexus_Name && (
            <Link href={`/t/${teacher.EduNexus_Name}`} passHref legacyBehavior>
              <Button variant="outline" asChild>
                <a><Eye className="mr-2 h-4 w-4"/> View My Ad Page</a>
              </Button>
            </Link>
          )}
           {adsSubscriptionStatus === 'Ads Model' && !isLoadingAds && !error && ads.length > 0 && !editingAd && !teacher?.EduNexus_Name && (
            <div className="text-xs text-muted-foreground p-2 border rounded-md bg-amber-50 border-amber-200">
              <Info className="inline h-4 w-4 mr-1 text-amber-600" />
              Set your unique EduNexus Username in your <Link href={Routes.teacherSettings} className="underline text-primary">profile</Link> to enable your public ad page.
            </div>
          )}
        </CardHeader>
        
        <CardContent className="p-0">
          {adsSubscriptionStatus === 'Free' && (
            <div className="text-center p-10 border-t">
              <Construction className="h-10 w-10 text-amber-600 mb-2 mx-auto" />
              <p className="text-lg font-semibold text-amber-700 dark:text-amber-300 mb-1">Unlock Ad Creation!</p>
              <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">To create advertisements, please upgrade to our "Ads Model" subscription.</p>
              <Button onClick={() => router.push(Routes.teacherUpgradeAds)} size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">Learn More & Upgrade <ArrowRight className="ml-2 h-5 w-5" /></Button>
            </div>
          )}

          {adsSubscriptionStatus === 'Ads Model' && (
            <>
              {isLoadingAds && (
                <div className="p-6"><Skeleton className="h-48 w-full" /></div>
              )}
              {error && !isLoadingAds && (
                <div className="p-6 text-center text-destructive border-t">{error}</div>
              )}

              {!isLoadingAds && !error && (
                <>
                  {shouldShowForm ? (
                    <div className="border-t pt-6 p-6">
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                          <Card className="border-primary/20"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><LinkIcon className="text-primary h-5 w-5"/>Social & Profile Links</CardTitle></CardHeader><CardContent className="grid md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="instagram_page" render={({ field }) => ( <FormItem><FormLabel>Instagram Page URL</FormLabel><FormControl><Input type="url" placeholder="https://instagram.com/yourpage" {...field} value={field.value ?? ''} /></FormControl><FormMessage/></FormItem> )}/>
                            <FormField control={form.control} name="facebook_page" render={({ field }) => ( <FormItem><FormLabel>Facebook Page URL</FormLabel><FormControl><Input type="url" placeholder="https://facebook.com/yourpage" {...field} value={field.value ?? ''} /></FormControl><FormMessage/></FormItem> )}/>
                            <FormField control={form.control} name="edunexus_profile" render={({ field }) => ( <FormItem><FormLabel>EduNexus Profile URL</FormLabel><FormControl><Input type="url" placeholder="Your EduNexus profile link" {...field} value={field.value ?? ''} /></FormControl><FormMessage/></FormItem> )}/>
                            <FormField control={form.control} name="youtube_channel" render={({ field }) => ( <FormItem><FormLabel>YouTube Channel URL</FormLabel><FormControl><Input type="url" placeholder="https://youtube.com/yourchannel" {...field} value={field.value ?? ''} /></FormControl><FormMessage/></FormItem> )}/>
                            <FormField control={form.control} name="x_page" render={({ field }) => ( <FormItem><FormLabel>X (Twitter) Page URL</FormLabel><FormControl><Input type="url" placeholder="https://x.com/yourprofile" {...field} value={field.value ?? ''} /></FormControl><FormMessage/></FormItem> )}/>
                            <FormField control={form.control} name="telegram_channel_username" render={({ field }) => ( <FormItem><FormLabel>Telegram Channel URL</FormLabel><FormControl><Input type="url" placeholder="https://t.me/yourchannel" {...field} value={field.value ?? ''} /></FormControl><ShadcnFormDescription className="text-xs">Must be a full URL (e.g., https://t.me/yourchannelname)</ShadcnFormDescription><FormMessage/></FormItem> )}/>
                            <FormField control={form.control} name="teacher_app_link" render={({ field }) => ( <FormItem><FormLabel>Your App/Website Link (if any)</FormLabel><FormControl><Input type="url" placeholder="https://yourapp.com" {...field} value={field.value ?? ''} /></FormControl><FormMessage/></FormItem> )}/>
                          </CardContent></Card>
                          <Card className="border-primary/20"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Users className="text-primary h-5 w-5"/>Student Achievements & Reach</CardTitle></CardHeader><CardContent className="grid md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="total_student_trained" render={({ field }) => ( <FormItem><FormLabel>Total Students Trained</FormLabel><FormControl><Input type="number" placeholder="e.g., 500" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value))} value={field.value ?? ''} /></FormControl><FormMessage/></FormItem> )}/>
                            <FormField control={form.control} name="followers" render={({ field }) => ( <FormItem><FormLabel>Followers (Social Media)</FormLabel><FormControl><Input type="number" placeholder="e.g., 10000" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value))} value={field.value ?? ''} /></FormControl><FormMessage/></FormItem> )}/>
                            <FormField control={form.control} name="students_of_100_percentile_if_any" render={({ field }) => ( <FormItem><FormLabel>Students with 100 Percentile</FormLabel><FormControl><Input type="number" placeholder="e.g., 5" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value))} value={field.value ?? ''} /></FormControl><FormMessage/></FormItem> )}/>
                            <FormField control={form.control} name="students_above_99_percentile_if_any" render={({ field }) => ( <FormItem><FormLabel>Students Above 99 Percentile</FormLabel><FormControl><Input type="number" placeholder="e.g., 20" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value))} value={field.value ?? ''} /></FormControl><FormMessage/></FormItem> )}/>
                            <FormField control={form.control} name="students_above_98_percentile_if_any" render={({ field }) => ( <FormItem><FormLabel>Students Above 98 Percentile</FormLabel><FormControl><Input type="number" placeholder="e.g., 50" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value))} value={field.value ?? ''} /></FormControl><FormMessage/></FormItem> )}/>
                            <FormField control={form.control} name="students_above_90_percentile_if_any" render={({ field }) => ( <FormItem><FormLabel>Students Above 90 Percentile</FormLabel><FormControl><Input type="number" placeholder="e.g., 100" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value))} value={field.value ?? ''} /></FormControl><FormMessage/></FormItem> )}/>
                          </CardContent></Card>
                          <Card className="border-primary/20"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><GraduationCap className="text-primary h-5 w-5"/>About & Offerings</CardTitle></CardHeader><CardContent className="space-y-6">
                            <FormField control={form.control} name="about" render={({ field }) => ( <FormItem><FormLabel>About Section for Ad</FormLabel><FormControl><Textarea placeholder="Briefly describe your teaching, courses, or achievements for the ad..." {...field} value={field.value ?? ''} rows={5}/></FormControl><FormMessage/></FormItem> )}/>
                            <FormField control={form.control} name="profile_pic_if_not_edunexus_pic" render={({ field: { onChange, value, ...rest } }) => ( <FormItem>
                              <FormLabel>Ad Profile Picture (Optional, overrides default)</FormLabel>
                              {currentAdImagePreview && (<div className="my-2"><p className="text-xs text-muted-foreground">Current Image:</p><NextImage src={currentAdImagePreview} alt="Current Ad Image" width={100} height={100} className="rounded border" data-ai-hint="teacher profile"/></div> )}
                              <FormControl><Input type="file" accept="image/*" onChange={(e) => onChange(e.target.files ? e.target.files[0] : null)} {...rest} /></FormControl><FormMessage/>
                              {value && <p className="text-xs text-green-600">New image selected: {value.name}</p>}
                            </FormItem> )}/>
                            <FormField control={form.control} name="total_edunexus_subscription_offered" render={({ field }) => ( <FormItem><FormLabel>Total EduNexus Subscriptions Offered</FormLabel><FormControl><Input type="number" placeholder="e.g., 3" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value))} value={field.value ?? ''} /></FormControl><FormMessage/></FormItem> )}/>
                            <FormField control={form.control} name="featured_plan_ids" render={() => ( <FormItem>
                              <div><FormLabel className="text-base">Featured Plan IDs (Optional, up to 3)</FormLabel><ShadcnFormDescription>Select your existing plans to feature in this ad.</ShadcnFormDescription></div>
                              {isLoadingPlans ? <Skeleton className="h-20 w-full" /> : teacherAvailablePlans.length === 0 ? <p className="text-sm text-muted-foreground">You haven't created any plans yet. <Link href={Routes.teacherManagePlans} className="text-primary hover:underline">Create plans first</Link>.</p> : (
                              <div className="space-y-2 rounded-md border p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {teacherAvailablePlans.map((plan) => (<FormField key={plan.id} control={form.control} name="featured_plan_ids" render={({ field: checkboxField }) => (
                                  <FormItem className="flex flex-row items-center space-x-2 space-y-0 bg-background p-2 rounded-md border hover:bg-muted/50">
                                    <FormControl><Checkbox checked={checkboxField.value?.includes(plan.id)} onCheckedChange={(checked) => {
                                      const currentValues = checkboxField.value || []; let newValues;
                                      if (checked) { if (currentValues.length < 3) { newValues = [...currentValues, plan.id]; } else { toast({ title: "Limit Reached", description: "Max 3 plans.", variant: "default" }); return false; }}
                                      else { newValues = currentValues.filter(id => id !== plan.id); }
                                      checkboxField.onChange(newValues);}} /></FormControl>
                                    <FormLabel className="font-normal text-sm cursor-pointer w-full">{plan.Plan_name} <span className="text-xs text-muted-foreground">({plan.id.substring(0,5)}...)</span></FormLabel>
                                  </FormItem>)} />))}
                              </div>)}<FormMessage /> </FormItem> )}/>
                          </CardContent></Card>
                          <div className="flex justify-end gap-2 pt-8">
                            {editingAd && <Button type="button" variant="outline" onClick={() => { setEditingAd(null); setCurrentAdImagePreview(null); form.reset(); }} disabled={isSubmitting}>Cancel Edit</Button>}
                            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{editingAd ? 'Update Ad' : 'Create Ad'}</Button>
                          </div>
                        </form>
                      </Form>
                    </div>
                  ) : ( // This is when ads.length > 0 and !editingAd
                    <div className="border-t pt-6 p-6">
                      {ads.length > 0 ? (
                         <>
                          <h3 className="text-lg font-semibold mb-4">Your Advertisement</h3>
                          <Card key={ads[0].id} className="p-4 flex flex-col sm:flex-row justify-between items-start gap-3 bg-muted/30">
                            <div className="flex-grow">
                              <p className="font-semibold text-primary">{ads[0].about?.substring(0,100) || "Ad Preview"}{ads[0].about && ads[0].about.length > 100 && "..."}</p>
                              <p className="text-xs text-muted-foreground">Created: {format(new Date(ads[0].created), "dd MMM yyyy")}</p>
                              <p className="text-xs text-muted-foreground">Last Updated: {format(new Date(ads[0].updated), "dd MMM yyyy, p")}</p>
                              {ads[0].plan && ads[0].plan.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">Featured Plans: {ads[0].plan.length}</p>
                              )}
                            </div>
                            <div className="flex gap-2 flex-shrink-0 self-start sm:self-center">
                              <Button variant="outline" size="sm" onClick={() => handleEditAd(ads[0])}><Edit className="mr-1 h-3.5 w-3.5"/> Edit</Button>
                              <Button variant="destructive" size="sm" onClick={() => handleDeleteAd(ads[0].id)}><Trash2 className="mr-1 h-3.5 w-3.5"/> Delete</Button>
                            </div>
                          </Card>
                        </>
                      ) : (
                        <p className="text-muted-foreground text-center p-6">Error: Should display creation form here if no ads exist.</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground text-center p-4 border-t">
          Ads are subject to review by {AppConfig.appName} team.
        </CardFooter>
      </Card>
    </div>
  );
}

