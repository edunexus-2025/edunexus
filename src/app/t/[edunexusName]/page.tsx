
'use client';

import { useEffect, useState, useCallback, ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import NextImage from 'next/image';
import Link from 'next/link';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError, UnsubscribeFunc } from 'pocketbase';
import { useToast } from '@/hooks/use-toast';
// Navbar import removed
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AppConfig, Routes, escapeForPbFilter, APP_BASE_URL } from '@/lib/constants';
import {
  AlertCircle, GraduationCap, BarChart2, Users, Link as LinkIcon, Instagram, Facebook, Youtube, Twitter, Send as TelegramIcon, Globe as WebsiteIcon, ExternalLink, ShieldCheck, Star, TrendingUp, ListChecks, BookOpenCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { User, TeacherPlan as TeacherPlanType } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';

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

interface TeacherAdPageData {
  teacherData: TeacherDataRecord;
  adData: TeacherAdRecord | null;
  featuredPlans: TeacherPlanType[];
  teacherAvatarUrl: string;
  adSpecificAvatarUrl?: string | null;
  hasAnyContentPlans?: boolean;
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
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const edunexusNameParam = typeof params.edunexusName === 'string' ? params.edunexusName : '';

  const [pageData, setPageData] = useState<TeacherAdPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      let adData: TeacherAdRecord | null = null; let adSpecificAvatarUrl: string | null = null; let featuredPlans: TeacherPlanType[] = [];
      let hasAnyContentPlans = false;

      try {
        const adRecords = await pb.collection('teacher_ads').getFullList<TeacherAdRecord>({ filter: `user = "${teacherData.id}"`, sort: '-created' });
        if (!isMountedGetter()) return;
        if (adRecords.length > 0) {
          adData = adRecords[0];
          adSpecificAvatarUrl = getPbFileUrl(adData, 'profile_pic_if_not_edunexus_pic');
          if (adData.plan && Array.isArray(adData.plan) && adData.plan.length > 0) {
            const planFilter = adData.plan.map(id => `id = "${escapeForPbFilter(id)}"`).join(' || ');
            if (planFilter) featuredPlans = await pb.collection('teachers_upgrade_plan').getFullList<TeacherPlanType>({ filter: planFilter, sort: '-created' });
          }
        }
      } catch (adError: any) { if (isMountedGetter()) console.warn("Ad data not found or error fetching, proceeding with teacher data only:", adError.data || adError.message); }

      if (!isMountedGetter()) return;
      if (teacherData.id) {
        const allTeacherPlans = await pb.collection('teachers_upgrade_plan').getList(1, 1, { filter: `teacher = "${teacherData.id}"`, count: true });
        if (isMountedGetter()) hasAnyContentPlans = allTeacherPlans.totalItems > 0;
      }

      if (isMountedGetter()) setPageData({ teacherData, adData, featuredPlans, teacherAvatarUrl, adSpecificAvatarUrl, hasAnyContentPlans });
    } catch (err: any) { if (isMountedGetter()) { const clientError = err as ClientResponseError; if (clientError?.isAbort || (clientError?.name === 'ClientResponseError' && clientError?.status === 0)) { console.warn('Fetch data request was cancelled.'); } else { console.error("Failed to fetch page data:", clientError.data || clientError); setError(`Could not load teacher profile. Error: ${clientError.data?.message || clientError.message}`); }}}
    finally { if (isMountedGetter()) setIsLoading(false); }
  }, [edunexusName]);

  useEffect(() => {
    let isMounted = true;
    const componentIsMounted = () => isMounted;
    let unsubscribeAds: UnsubscribeFunc | undefined;
    let unsubscribeTeacherData: UnsubscribeFunc | undefined;

    fetchData(componentIsMounted);

    const setupSubscriptions = async () => {
        if (!isMounted) return;
        const teacherId = pageData?.teacherData?.id; 
        
        if (teacherId) {
            try {
                unsubscribeAds = await pb.collection('teacher_ads').subscribe('*', (e) => {
                    if (componentIsMounted() && e.record.user === teacherId) {
                        fetchData(componentIsMounted);
                    }
                });
            } catch (subError) {
                if (componentIsMounted()) console.error("Error subscribing to teacher_ads:", subError);
            }
            
            if (edunexusName) { 
                try {
                    unsubscribeTeacherData = await pb.collection('teacher_data').subscribe('*', (e) => {
                         if (componentIsMounted() && e.record.EduNexus_Name === edunexusName) {
                            fetchData(componentIsMounted);
                        }
                    });
                } catch (subError) {
                    if (componentIsMounted()) console.error("Error subscribing to teacher_data:", subError);
                }
            }
        }
    };
    
    if (pageData?.teacherData?.id) {
        setupSubscriptions();
    }

    return () => {
      isMounted = false;
      if (unsubscribeAds) unsubscribeAds();
      if (unsubscribeTeacherData) unsubscribeTeacherData();
    };
  }, [fetchData, edunexusName, pageData?.teacherData?.id]);


  if (isLoading) { return ( <div className="flex flex-col min-h-screen bg-muted/30"> {/* No Navbar */} <main className="flex-1 container mx-auto px-2 sm:px-4 py-6 md:py-8 max-w-4xl"> <Skeleton className="h-12 w-3/4 mb-4" /> <Card className="shadow-xl"><CardHeader className="p-4 sm:p-6 text-center border-b"> <Skeleton className="h-24 w-24 rounded-full mx-auto mb-3" /> <Skeleton className="h-8 w-1/2 mx-auto" /> <Skeleton className="h-5 w-1/3 mx-auto mt-1" /> </CardHeader> <CardContent className="p-4 sm:p-6 space-y-6"> <Skeleton className="h-20 w-full" /> <Skeleton className="h-32 w-full" /> </CardContent> </Card> </main> </div> ); }
  if (error) { return ( <div className="flex flex-col min-h-screen bg-muted/30"> {/* No Navbar */} <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl"> <Card className="text-center shadow-lg border-destructive bg-destructive/10"><CardHeader><AlertCircle className="mx-auto h-12 w-12 text-destructive mb-3" /><CardTitle className="text-destructive">Error Loading Profile</CardTitle></CardHeader><CardContent><p className="text-destructive/90 whitespace-pre-wrap">{error}</p></CardContent><CardFooter><Button onClick={() => router.push(Routes.home)} variant="outline" className="mx-auto">Go to Homepage</Button></CardFooter></Card> </main> </div> ); }
  if (!pageData || !pageData.teacherData) { return ( <div className="flex flex-col min-h-screen bg-muted/30"> {/* No Navbar */} <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl"> <Card className="text-center shadow-lg"><CardHeader><AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-3" /><CardTitle>Profile Not Found</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">The teacher profile does not exist or is unavailable.</p></CardContent><CardFooter><Button onClick={() => router.push(Routes.home)} variant="outline" className="mx-auto">Go to Homepage</Button></CardFooter></Card> </main> </div> ); }

  const { teacherData, adData, featuredPlans, teacherAvatarUrl, adSpecificAvatarUrl, hasAnyContentPlans } = pageData;
  const finalAbout = adData?.about || teacherData?.about || "No detailed information provided by the teacher yet.";
  const finalAvatar = adSpecificAvatarUrl || teacherAvatarUrl;

  const socialLinksList: SocialLinkProps[] = [
    { href: teacherData.EduNexus_Name ? `${APP_BASE_URL}${Routes.teacherPublicAdPage(teacherData.EduNexus_Name)}` : undefined, icon: <GraduationCap size={18}/>, label: `${AppConfig.appName} Profile`},
    { href: adData?.instagram_page, icon: <Instagram size={18} />, label: "Instagram" },
    { href: adData?.facebook_page, icon: <Facebook size={18} />, label: "Facebook" },
    { href: adData?.youtube_channel, icon: <Youtube size={18} />, label: "YouTube" },
    { href: adData?.x_page, icon: <Twitter size={18} />, label: "X (Twitter)" },
    { href: adData?.telegram_channel_username, icon: <TelegramIcon size={18} />, label: "Telegram" },
    { href: adData?.teacher_app_link, icon: <WebsiteIcon size={18} />, label: "App/Website" },
  ].filter(link => link.href && link.href.trim() !== '');

  return (
    <div className="flex flex-col min-h-screen bg-muted/30 dark:bg-slate-950">
      {/* Navbar removed */}
      <main className="flex-1 container mx-auto px-2 sm:px-4 py-6 md:py-8 max-w-4xl">
        <Card className="shadow-xl border-t-4 border-primary rounded-xl overflow-hidden">
          <CardHeader className="p-4 sm:p-6 text-center bg-gradient-to-br from-primary/10 via-background to-background border-b"> <Avatar className="h-28 w-28 sm:h-32 sm:w-32 text-4xl border-4 border-card shadow-lg mx-auto mb-3 bg-muted"> {finalAvatar ? <AvatarImage src={finalAvatar} alt={teacherData.name} data-ai-hint="teacher profile picture"/> : null} <AvatarFallback className="bg-primary/20 text-primary">{teacherData.name?.charAt(0).toUpperCase() || 'T'}</AvatarFallback> </Avatar> <CardTitle className="text-2xl sm:text-3xl font-bold text-foreground">{teacherData.name}</CardTitle> {teacherData.institute_name && <p className="text-md text-muted-foreground">{teacherData.institute_name}</p>} {teacherData.EduNexus_Name && <p className="text-sm text-accent font-mono">@{teacherData.EduNexus_Name}</p>} <div className="mt-3 flex flex-wrap justify-center gap-2"> {teacherData.level && <Badge variant="secondary">{teacherData.level}</Badge>} {teacherData.subjects_offered && teacherData.subjects_offered.map(sub => <Badge key={sub} variant="outline">{sub}</Badge>)} {teacherData.favExam && teacherData.favExam.map(exam => <Badge key={exam} variant="outline" className="border-primary/50 text-primary/90 bg-primary/5">{exam}</Badge>)} </div> </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-8">
            <section> <h2 className="text-xl font-semibold text-primary mb-3">About Me</h2> <p className="text-foreground/90 whitespace-pre-line leading-relaxed text-sm sm:text-base">{finalAbout}</p> </section>
            {socialLinksList.length > 0 && ( <section> <h2 className="text-xl font-semibold text-primary mb-4">Connect With Me</h2> <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"> {socialLinksList.map(link => <SocialLink key={link.label} {...link} />)} </div> </section> )}
            {adData && (Object.values(adData).some(val => typeof val === 'number' && val > 0) || (adData.total_student_trained || adData.total_edunexus_subscription_offered)) && ( <section> <h2 className="text-xl font-semibold text-primary mb-4">My Achievements & Reach</h2> <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4"> {getStatCard(<Users className="h-6 w-6" />, "Students Trained", adData.total_student_trained)} {getStatCard(<Star className="h-6 w-6" />, "100 Percentilers", adData.students_of_100_percentile_if_any)} {getStatCard(<TrendingUp className="h-6 w-6" />, "99+ Percentilers", adData.students_above_99_percentile_if_any)} {getStatCard(<BarChart2 className="h-6 w-6" />, "98+ Percentilers", adData.students_above_98_percentile_if_any)} {getStatCard(<GraduationCap className="h-6 w-6" />, "90+ Percentilers", adData.students_above_90_percentile_if_any)} {getStatCard(<ShieldCheck className="h-6 w-6" />, `${AppConfig.appName} Plans Sold`, adData.total_edunexus_subscription_offered)} </div> </section> )}
            
            {hasAnyContentPlans && teacherData.EduNexus_Name && (
              <section className="mt-8 pt-6 border-t text-center">
                <h2 className="text-xl font-semibold text-primary mb-3">Explore My Content Plans</h2>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  Discover the specialized subscription plans I offer to help students achieve their academic goals.
                </p>
                <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Link href={Routes.teacherPublicPlansPage(teacherData.EduNexus_Name)}>
                    View All Content Plans <BookOpenCheck className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </section>
            )}
          </CardContent>
          <CardFooter className="p-4 sm:p-6 bg-muted/30 border-t text-center"> <p className="text-xs text-muted-foreground"> To enroll in {teacherData.name}'s courses or for inquiries, please use the contact links provided or subscribe to a plan. </p> </CardFooter>
        </Card>
      </main>
      <footer className="py-6 text-center text-xs text-muted-foreground border-t bg-background dark:bg-slate-900"> © {new Date().getFullYear()} {AppConfig.appName} </footer>
    </div>
  );
}
