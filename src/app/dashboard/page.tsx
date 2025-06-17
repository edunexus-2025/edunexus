
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Routes, AppConfig, escapeForPbFilter, slugify } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowRight, ShieldCheck, Zap, ListChecks, TrendingUp, Loader2, Search, Users, Library, AlertCircle, BookOpenCheck, Target as TargetIcon, Megaphone, ChevronLeft, ChevronRight as ChevronRightIcon, Brain, MessageSquare, Activity, CalendarDays, Swords, FileText, BookHeart, NotebookText } from 'lucide-react';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import type { User, UserSubscriptionTierStudent, ChallengeInviteRecordType } from '@/lib/types';
import { Progress } from '@/components/ui/progress';
import pb from '@/lib/pocketbase';
import type { RecordModel, UnsubscribeFunc, ClientResponseError } from 'pocketbase';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface FavExamDetails {
  iconUrl: string;
  dataAiHint: string;
}

const favExamDetailsMap: Record<Exclude<User['favExam'], undefined | null>, FavExamDetails> = {
  'JEE MAIN': { iconUrl: 'https://i.filecdn.in/755esias/image-1718508545561.png', dataAiHint: 'engineering exam' },
  'NEET': { iconUrl: 'https://i.filecdn.in/755esias/image-1718508545561.png', dataAiHint: 'medical exam' },
  'MHT CET': { iconUrl: 'https://upload.wikimedia.org/wikipedia/en/6/60/MHT-CET_logo.png', dataAiHint: 'state exam' },
  'NDA': { iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/6e/National_Defence_Academy_NDA.png', dataAiHint: 'defense exam' },
  'KCET': { iconUrl: 'https://education.indianexpress.com/storage/images/kcet-exam_1686728759.jpg', dataAiHint: 'karnataka exam' },
};

const DAILY_DPP_LIMIT = 20; 

interface TeacherSearchResult extends RecordModel {
  id: string;
  name: string;
  EduNexus_Name?: string;
  institute_name?: string;
  profile_picture?: string; 
  avatarUrl?: string; 
}

interface TestSearchResult extends RecordModel {
  id: string;
  TestName: string;
  Model?: 'Chapterwise' | 'Full Length';
  Exam?: string;
}

interface AdRecord extends RecordModel {
  id: string;
  ad_name: string;
  ad_expiry_date?: string;
  ad_image: string; 
  add_button?: string; 
  ad_button_name?: string;
  ad_description: string;
  background_colour?: string; 
  collectionId: string; 
  collectionName: string; 
}

function DynamicAdCarousel() {
  const [ads, setAds] = useState<AdRecord[]>([]);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [adError, setAdError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchAds = async () => {
      if (!isMounted) return;
      setIsLoadingAds(true);
      try {
        const today = new Date().toISOString().split('T')[0];
        const records = await pb.collection('student_dashboard_ads').getFullList<AdRecord>({
          filter: `(ad_expiry_date >= "${today}" || ad_expiry_date = "")`,
          sort: '-created',
          '$autoCancel': false,
        });
        if (isMounted) { setAds(records); setAdError(null); }
      } catch (error: any) {
        if(isMounted) {
            const clientError = error as ClientResponseError;
             if (clientError?.isAbort || (clientError?.name === 'ClientResponseError' && clientError?.status === 0)) {
                console.warn('DynamicAdCarousel: Fetch ads request was cancelled.');
             } else {
                console.error("DynamicAdCarousel: Failed to fetch ads:", clientError.data || clientError);
                setAdError("Could not load advertisements at this time.");
             }
        }
      } finally {
        if (isMounted) setIsLoadingAds(false);
      }
    };
    fetchAds();
    return () => { isMounted = false; };
  }, []); 

  useEffect(() => {
    if (ads.length <= 1) return;
    const timer = setInterval(() => setCurrentAdIndex((prevIndex) => (prevIndex + 1) % ads.length), 7000);
    return () => clearInterval(timer);
  }, [ads.length]);

  const handleNextAd = () => ads.length > 1 && setCurrentAdIndex((prevIndex) => (prevIndex + 1) % ads.length);
  const handlePrevAd = () => ads.length > 1 && setCurrentAdIndex((prevIndex) => (prevIndex - 1 + ads.length) % ads.length);

  if (isLoadingAds) return <Skeleton className="h-48 md:h-56 w-full rounded-lg mb-8" />;
  
  if (!adError && ads.length === 0) return ( 
    <Card className="shadow-lg mb-8 text-center p-6 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-xl border border-border">
      <CardHeader className="p-0 mb-3 items-center">
        <Megaphone className="h-12 w-12 text-muted-foreground opacity-50" />
      </CardHeader>
      <CardTitle className="text-lg font-semibold text-muted-foreground">No Advertisements Right Now</CardTitle>
      <CardDescription className="text-sm text-muted-foreground mt-1">Check back later for updates and offers!</CardDescription>
    </Card> 
  );
  if (adError && ads.length === 0) return ( <Card className="shadow-lg mb-8 text-center p-6 bg-destructive/10 border-destructive rounded-xl"><CardHeader className="p-0 mb-2 items-center"><AlertCircle className="mx-auto h-10 w-10 text-destructive" /></CardHeader><CardTitle className="text-destructive text-lg">Advertisement Error</CardTitle><CardDescription className="text-destructive/80 text-sm">{adError}</CardDescription></Card> );
  
  if (ads.length > 0) {
    const currentAd = ads[currentAdIndex];
    const adImageUrl = currentAd.ad_image && currentAd.collectionId && currentAd.collectionName ? pb.files.getUrl(currentAd, currentAd.ad_image) : "https://placehold.co/1200x200.png?text=Advertisement";
    let backgroundStyle: React.CSSProperties = {};
    let backgroundClasses = "bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500"; 
    if (currentAd.background_colour) { try { const bgColorObj = JSON.parse(currentAd.background_colour); if (bgColorObj.type === "solid" && bgColorObj.value) { if (bgColorObj.value.startsWith("#")) { backgroundStyle = { backgroundColor: bgColorObj.value }; backgroundClasses = ""; } else { backgroundClasses = `bg-${bgColorObj.value}`;}} else if (bgColorObj.type === "gradient" && bgColorObj.from && bgColorObj.to) { const direction = bgColorObj.direction || "r"; backgroundClasses = `bg-gradient-to-${direction} from-${bgColorObj.from} to-${bgColorObj.to}`;}} catch (e) { console.warn("Could not parse ad background_colour JSON:", currentAd.background_colour, e);}}
    return (
      <Card className={cn("shadow-lg mb-8 text-white group hover:shadow-xl transition-shadow duration-300 overflow-hidden relative rounded-xl", backgroundClasses)} style={backgroundStyle}>
        <div className="flex flex-col md:flex-row items-center min-h-[200px] md:min-h-[220px]">
          <div className="md:w-1/3 relative h-48 md:h-auto self-stretch overflow-hidden min-h-[150px] md:min-h-[220px]"><Image src={adImageUrl} alt={currentAd.ad_name || "Advertisement"} layout="fill" objectFit="cover" className="group-hover:scale-105 transition-transform duration-500" data-ai-hint="promotion education advertisement" priority={currentAdIndex === 0} /><div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors duration-300"></div></div>
          <div className="md:w-2/3 p-6 text-center md:text-left"><h3 className="text-xl md:text-2xl font-bold mb-2 flex items-center gap-2 justify-center md:justify-start">{currentAd.ad_name}</h3><p className="text-sm md:text-base opacity-90 mb-4 line-clamp-3">{currentAd.ad_description}</p>{currentAd.add_button && currentAd.ad_button_name && (<Button size="lg" variant="secondary" asChild className="bg-white text-purple-600 hover:bg-gray-100 shadow-md group-hover:scale-105 transition-transform duration-300"><Link href={currentAd.add_button} target="_blank" rel="noopener noreferrer">{currentAd.ad_button_name} <ArrowRight className="ml-2 h-5 w-5" /></Link></Button>)}</div>
        </div>
        {ads.length > 1 && ( <><Button variant="ghost" size="icon" onClick={handlePrevAd} className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-black/30 hover:bg-black/50 text-white h-8 w-8 rounded-full opacity-70 hover:opacity-100 transition-opacity"><ChevronLeft className="h-5 w-5" /></Button><Button variant="ghost" size="icon" onClick={handleNextAd} className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-black/30 hover:bg-black/50 text-white h-8 w-8 rounded-full opacity-70 hover:opacity-100 transition-opacity"><ChevronRightIcon className="h-5 w-5" /></Button><div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex space-x-1.5">{ads.map((_, index) => ( <button key={index} onClick={() => setCurrentAdIndex(index)} className={cn("h-2 w-2 rounded-full transition-all duration-300", index === currentAdIndex ? "bg-white scale-125 w-4" : "bg-white/50 hover:bg-white/75")} aria-label={`Go to ad ${index + 1}`}/>))}</div></> )}
      </Card>
    );
  } 
  return null; 
}

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [dailyDppQuestionCount, setDailyDppQuestionCount] = useState<number | null>(0);
  const [isLoadingDppCount, setIsLoadingDppCount] = useState(true);
  
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [teacherResults, setTeacherResults] = useState<TeacherSearchResult[]>([]);
  const [testResults, setTestResults] = useState<TestSearchResult[]>([]);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const selectedFavExamDetails = user?.favExam ? favExamDetailsMap[user.favExam] : null;
  const showUpgradeCard = user && user.studentSubscriptionTier && ['Free', 'Dpp', 'Chapterwise'].includes(user.studentSubscriptionTier);

  const fetchDailyDppQuestionCount = useCallback(async (userIdForFetch: string) => {
    setIsLoadingDppCount(true);
    const now = new Date();
    const todayStartUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const todayEndUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    const filter = `user = "${escapeForPbFilter(userIdForFetch)}" && attemptTimestamp >= "${todayStartUTC.toISOString()}" && attemptTimestamp <= "${todayEndUTC.toISOString()}"`;
    try {
      const resultList = await pb.collection('daily_dpp_question_logs').getList(1, 1, { filter, count: true, "$autoCancel": false });
      setDailyDppQuestionCount(resultList.totalItems);
    } catch (error: any) {
      console.error("Dashboard: Error fetching daily DPP question count. Filter used:", filter, "Full Error Object:", JSON.parse(JSON.stringify(error)));
      setDailyDppQuestionCount(0); 
    } finally {
      setIsLoadingDppCount(false);
    }
  }, []);

  useEffect(() => {
    let unsubscribeDppLogs: UnsubscribeFunc | null = null;
    let isEffectMounted = true; 
    const currentUserId = user?.id;
    if (!authLoading && currentUserId) {
      fetchDailyDppQuestionCount(currentUserId);
      const setupSubscription = async () => {
        if(!isEffectMounted) return;
        try {
            unsubscribeDppLogs = await pb.collection('daily_dpp_question_logs').subscribe('*', (e) => {
                if (isEffectMounted && e.record.user === currentUserId) {
                     fetchDailyDppQuestionCount(currentUserId);
                }
            }, { '$autoCancel': false });
        } catch (subError) {
            if(isEffectMounted) console.error("Error subscribing to daily DPP logs:", subError);
        }
      };
      setupSubscription();
    } else if (!authLoading && !currentUserId) {
      setDailyDppQuestionCount(0); setIsLoadingDppCount(false);
    } else if (authLoading) {
      setIsLoadingDppCount(true);
    }
    return () => { isEffectMounted = false; if (unsubscribeDppLogs) unsubscribeDppLogs(); };
  }, [authLoading, user?.id, fetchDailyDppQuestionCount]);

  const performSearch = useCallback(async (term: string) => {
    setIsLoadingSearch(true); setSearchError(null); setTeacherResults([]); setTestResults([]);
    const termEscaped = escapeForPbFilter(term);
    try {
      const [teachers, tests] = await Promise.all([
        pb.collection('teacher_data').getFullList<TeacherSearchResult>({ filter: `(can_create_ads = true && ads_subscription = "Ads Model") && (name ~ "${termEscaped}" || EduNexus_Name ~ "${termEscaped}")`, fields: 'id,name,EduNexus_Name,institute_name,profile_picture,collectionId,collectionName', '$autoCancel': false }).then(records => records.map(r => ({ ...r, avatarUrl: r.profile_picture ? pb.files.getUrl(r, r.profile_picture) : `https://ui-avatars.com/api/?name=${encodeURIComponent(r.name?.charAt(0) || 'T')}&background=random&color=fff&size=128` }))),
        pb.collection('test_pages').getFullList<TestSearchResult>({ filter: `(TestName ~ "${termEscaped}" || TestTags ~ "${termEscaped}")`, fields: 'id,TestName,Model,Exam', '$autoCancel': false, })
      ]);
      setTeacherResults(teachers); setTestResults(tests);
    } catch (error: any) {
      const clientError = error as ClientResponseError;
      if (clientError?.isAbort || (clientError?.name === 'ClientResponseError' && clientError?.status === 0)) {
          console.warn('DashboardPage: Global search request was cancelled.');
      } else {
          console.error("DashboardPage: Global search failed:", clientError.data || clientError);
          setSearchError("Search failed. Please try again.");
      }
    } finally {
      setIsLoadingSearch(false);
    }
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => { if (globalSearchTerm.trim().length >= 2) { performSearch(globalSearchTerm.trim()); } else { setTeacherResults([]); setTestResults([]); setSearchError(null);}}, 500); 
    return () => clearTimeout(handler);
  }, [globalSearchTerm, performSearch]);
  
  const getAvatarFallback = (name?: string) => {
    if (!name) return 'T';
    const nameParts = name.split(' ');
    return nameParts.length > 1 ? nameParts[0][0] + nameParts[nameParts.length - 1][0] : name.substring(0, 2).toUpperCase();
  };

  const ActionCard = ({ title, description, href, icon, badgeText, badgeVariant = 'secondary' }: { title: string; description: string; href: string; icon: React.ReactNode; badgeText?: string; badgeVariant?: "default" | "secondary" | "destructive" | "outline" }) => (
    <Link href={href} passHref>
      <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 ease-in-out group h-full flex flex-col bg-card hover:border-primary/30 border border-border">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">{icon}</div>
            {badgeText && <Badge variant={badgeVariant} className="text-xs">{badgeText}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="flex-grow">
          <CardTitle className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">{title}</CardTitle>
          <CardDescription className="text-xs mt-1 text-muted-foreground">{description}</CardDescription>
        </CardContent>
        <CardFooter className="pt-3">
          <Button variant="ghost" size="sm" className="w-full justify-start text-primary group-hover:underline p-0 h-auto">
            Explore <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    </Link>
  );

  return (
    <div className="space-y-8">
      <Card className="shadow-xl bg-gradient-to-r from-primary to-accent text-primary-foreground p-6 md:p-8 rounded-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">Welcome back, {user?.name || 'Student'}!</h1>
            <p className="text-lg text-primary-foreground/80 mt-1">Ready to conquer your exams? Let's get started.</p>
          </div>
          {user && user.studentSubscriptionTier && (
            <div className="flex-shrink-0 mt-3 sm:mt-0">
              <Badge variant="secondary" className="text-sm py-2 px-4 shadow-md bg-primary-foreground/20 text-primary-foreground">
                <ShieldCheck className="h-5 w-5 mr-2 text-green-300" />
                Active Plan: <span className="font-semibold ml-1">{user.studentSubscriptionTier}</span>
              </Badge>
            </div>
          )}
        </div>
      </Card>

      <DynamicAdCarousel />

      <Card className="shadow-lg">
         <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Search className="h-6 w-6 text-primary" />
              Explore {AppConfig.appName}
            </CardTitle>
            <CardDescription>
              Find teachers, test series, or specific topics.
            </CardDescription>
          </div>
          <Button 
            variant="default" 
            size="sm" 
            className="mt-2 md:mt-0 w-full md:w-auto bg-green-500 hover:bg-green-600 text-white"
            onClick={() => alert("AI Doubt Solver - Coming Soon!")}
          >
            <MessageSquare className="mr-2 h-4 w-4" /> Solve Doubts Now 
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3">
            <div className="relative flex-grow w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search for teachers, tests, topics..."
                className="pl-9 w-full h-11 text-base bg-muted/50 focus:bg-background"
                value={globalSearchTerm}
                onChange={(e) => setGlobalSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoadingSearch && ( <div className="space-y-4 mt-4"><Card><CardContent className="p-4"><Skeleton className="h-8 w-1/3 mb-3" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full mt-2" /></CardContent></Card></div> )}
      {searchError && ( <Card className="mt-4 text-center p-6 bg-destructive/10 border-destructive"><AlertCircle className="mx-auto h-10 w-10 text-destructive mb-2" /><CardTitle className="text-destructive">Search Error</CardTitle><CardDescription className="text-destructive/80">{searchError}</CardDescription></Card> )}
      {!isLoadingSearch && !searchError && globalSearchTerm.trim().length >= 2 && (
        <div className="mt-6 space-y-6">
          {teacherResults.length > 0 && ( <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5 text-accent" /> Teachers ({teacherResults.length})</CardTitle></CardHeader><CardContent className="space-y-3">{teacherResults.map((teacher) => ( <Link key={teacher.id} href={teacher.EduNexus_Name ? Routes.teacherPublicAdPage(teacher.EduNexus_Name) : '#'} passHref className={!teacher.EduNexus_Name ? 'pointer-events-none opacity-70' : ''} title={!teacher.EduNexus_Name ? 'This teacher does not have a public profile page setup yet.' : `View ${teacher.name}'s profile`}><Card className="p-3 hover:shadow-md transition-shadow cursor-pointer border border-border/70 bg-card"><div className="flex items-center gap-3"><Avatar className="h-10 w-10"><AvatarImage src={teacher.avatarUrl} alt={teacher.name} data-ai-hint="teacher photo"/><AvatarFallback>{getAvatarFallback(teacher.name)}</AvatarFallback></Avatar><div><p className="font-semibold text-sm text-foreground">{teacher.name}</p><p className="text-xs text-muted-foreground">{teacher.EduNexus_Name ? `@${teacher.EduNexus_Name}` : teacher.institute_name || 'Educator'}</p></div><ArrowRight className="h-4 w-4 text-muted-foreground ml-auto" /></div></Card></Link> ))}</CardContent></Card> )}
          {testResults.length > 0 && ( <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Library className="h-5 w-5 text-accent" /> Tests ({testResults.length})</CardTitle></CardHeader><CardContent className="space-y-3">{testResults.map((test) => ( <Link key={test.id} href={Routes.viewTestSeries(test.id)} passHref><Card className="p-3 hover:shadow-md transition-shadow cursor-pointer border border-border/70 bg-card"><div className="flex items-center justify-between"><div><p className="font-semibold text-sm text-foreground">{test.TestName}</p><div className="flex items-center gap-2 mt-1">{test.Model && <Badge variant="outline" className="text-xs">{test.Model}</Badge>}{test.Exam && <Badge variant="secondary" className="text-xs">{test.Exam}</Badge>}</div></div><ArrowRight className="h-4 w-4 text-muted-foreground" /></div></Card></Link> ))}</CardContent></Card> )}
          {teacherResults.length === 0 && testResults.length === 0 && ( <Card className="text-center p-6 border-dashed bg-card"><Search className="mx-auto h-10 w-10 text-muted-foreground mb-2" /><CardTitle>No Results Found</CardTitle><CardDescription>Try a different search term or check your spelling.</CardDescription></Card> )}
        </div>
      )}

      {!globalSearchTerm.trim() && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <ActionCard title="Daily Practice (DPP)" description="Sharpen your skills with daily problems." href={Routes.dpp} icon={<FileText className="h-7 w-7 text-primary"/>} />
            <ActionCard title="Test Series" description="Attempt full-length and chapterwise mock tests." href={Routes.testSeries} icon={<BookOpenCheck className="h-7 w-7 text-primary"/>} badgeText="New" />
            <ActionCard title="PYQ Practice" description="Solve Previous Year Questions." href={Routes.pyqPractice} icon={<TargetIcon className="h-7 w-7 text-primary"/>} />
            <ActionCard title="My Progress" description="Track your performance and growth." href={Routes.myProgress} icon={<TrendingUp className="h-7 w-7 text-primary"/>} />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-lg">
              <CardHeader><CardTitle className="text-xl flex items-center"><ListChecks className="mr-2 h-6 w-6 text-primary" />Today's DPP Status</CardTitle></CardHeader>
              <CardContent>{authLoading || isLoadingDppCount ? ( <><Skeleton className="h-6 w-3/4 mb-2" /><Skeleton className="h-4 w-full" /><Skeleton className="h-2.5 w-full mt-1" /></> ) : user?.studentSubscriptionTier === 'Free' ? ( dailyDppQuestionCount !== null ? ( <><p className="text-muted-foreground mb-2">You've solved <span className="font-bold text-foreground">{dailyDppQuestionCount}</span> out of <span className="font-bold text-foreground">{DAILY_DPP_LIMIT}</span> allowed DPP questions today.</p><Progress value={(dailyDppQuestionCount / DAILY_DPP_LIMIT) * 100} className="w-full h-2.5" />{dailyDppQuestionCount >= DAILY_DPP_LIMIT && ( <p className="text-sm text-destructive mt-2 font-semibold">Daily limit reached! Upgrade for unlimited practice.</p> )}</> ) : ( <p className="text-muted-foreground">DPP progress for free users is loading or unavailable.</p> ) ) : (  <div className="space-y-2"><p className="text-muted-foreground">You've solved <span className="font-bold text-foreground">{dailyDppQuestionCount ?? 0}</span> DPP questions today.</p><div className="flex items-center text-green-600"><Zap className="mr-2 h-5 w-5" /><p className="font-semibold">Enjoy your unlimited access!</p></div></div> )}</CardContent>
              <CardFooter><Button variant="outline" asChild><Link href={Routes.dpp}>Go to DPP Section <ArrowRight className="ml-2 h-4 w-4"/></Link></Button></CardFooter>
            </Card>
            
            <Card className="shadow-lg">
              <CardHeader><CardTitle className="text-xl flex items-center"><Swords className="mr-2 h-6 w-6 text-primary" />Active Challenges</CardTitle></CardHeader>
              <CardContent><p className="text-muted-foreground">No active challenges right now. <Link href={Routes.createChallenge} className="text-primary hover:underline font-medium">Start one with friends!</Link></p></CardContent>
              <CardFooter><Button variant="outline" asChild><Link href={Routes.challengeInvites}>View Challenge Invites <ArrowRight className="ml-2 h-4 w-4"/></Link></Button></CardFooter>
            </Card>
          </div>

          {selectedFavExamDetails && user?.favExam && (
              <Card className="shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 md:col-span-2 bg-card border-t-4 border-primary">
                <CardHeader className="p-6"><div className="flex flex-col sm:flex-row items-center gap-4"><div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0"><Image src={selectedFavExamDetails.iconUrl} alt={`${user.favExam} Logo`} fill className="rounded-lg object-contain" data-ai-hint={selectedFavExamDetails.dataAiHint}/></div><div className="text-center sm:text-left"><CardTitle className="text-2xl text-foreground">Focus: {user.favExam}!</CardTitle><CardDescription className="mt-1 text-muted-foreground">Sharpen your edge with targeted PYQ practice.</CardDescription></div></div></CardHeader>
                <CardContent className="p-6 text-center sm:text-left"><p className="text-muted-foreground mb-4">Dive into Previous Year Questions for {user.favExam} to master concepts and boost confidence.</p></CardContent>
                 <CardFooter className="p-6 bg-muted/30"><Button asChild size="lg" className="w-full sm:w-auto"><Link href={Routes.pyqPractice}>Solve {user.favExam} PYQs <ArrowRight className="ml-2 h-5 w-5" /></Link></Button></CardFooter>
              </Card>
            )}

            {showUpgradeCard && (
              <Card className="shadow-xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white overflow-hidden group hover:shadow-2xl transition-all duration-300 md:col-span-2 rounded-xl">
                <div className="relative p-6 md:p-8"><div className="absolute top-0 right-0 -mt-4 -mr-4 opacity-20 group-hover:opacity-30 transition-opacity duration-300"><TrendingUp className="h-24 w-24 text-yellow-300 transform group-hover:rotate-12 transition-transform duration-500" /></div><div className="relative z-10"><CardHeader className="p-0 mb-4"><div className="flex items-center gap-3 mb-2"><Brain className="h-8 w-8 text-yellow-300 animate-pulse" /><CardTitle className="text-2xl md:text-3xl font-bold">Unlock Your Full Potential</CardTitle></div><CardDescription className="text-indigo-100 text-sm md:text-base">Upgrade to access exclusive tests, unlimited DPPs, and advanced analytics.</CardDescription></CardHeader><CardContent className="p-0 mb-6"><ul className="space-y-2 text-sm text-indigo-50 list-disc list-inside pl-1"><li>All Chapterwise & Full-Length tests.</li><li>Unlimited Daily Practice Problems.</li><li>Advanced performance reports.</li></ul></CardContent><CardFooter className="p-0"><Button variant="secondary" size="lg" className="bg-yellow-400 hover:bg-yellow-500 text-indigo-700 font-bold shadow-lg group-hover:scale-105 transition-transform duration-300 w-full sm:w-auto" asChild><Link href={Routes.upgrade}>View Upgrade Options <ArrowRight className="ml-2 h-5 w-5" /></Link></Button></CardFooter></div></div>
              </Card>
            )}
        </>
      )}
    </div>
  );
}
      
    
