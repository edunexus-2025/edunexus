
'use client';

import { TestSeriesCard } from '@/components/dashboard/TestSeriesCard';
import type { TestSeries, User, UserSubscriptionTierStudent } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter as FilterIcon, AlertCircle, Settings2, PanelRightOpen, PanelLeftOpen, Swords, Gamepad2 } from 'lucide-react';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardDescription, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Routes, slugify } from '@/lib/constants';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import { useToast } from '@/hooks/use-toast';
import { Button, buttonVariants } from '@/components/ui/button'; // Added buttonVariants import
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
  SheetFooter,
} from "@/components/ui/sheet";
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils'; // Added cn import

// Helper function to map PocketBase record to TestSeries type
const mapPbRecordToTestSeries = (record: RecordModel): TestSeries => {
  let subject = "Mixed Subjects";
  const typeArray: string[] = Array.isArray(record.Type) ? record.Type : (typeof record.Type === 'string' ? [record.Type] : []);
  let accessType: "Free" | "Premium" = "Premium";
  if (typeArray.includes("Free")) {
    accessType = "Free";
  }

  let unlocksAtTier: UserSubscriptionTierStudent = "Combo";
  if (accessType === "Free") {
    unlocksAtTier = "Free";
  } else if (accessType === "Premium") {
    if (record.Model === "Chapterwise") unlocksAtTier = "Chapterwise";
    else if (record.Model === "Full Length") unlocksAtTier = "Full_length";
  }

  return {
    id: record.id,
    title: record.TestName || 'Untitled Test',
    description: record.Test_Description || `A ${record.Model || ''} test for ${record.Exam || 'general'} preparation.`,
    subject: subject,
    questionCount: typeof record.TotalQuestion === 'number' ? record.TotalQuestion : 0,
    durationMinutes: typeof record.TotalTime === 'string' ? parseInt(record.TotalTime, 10) : (typeof record.TotalTime === 'number' ? record.TotalTime : 0),
    targetAudience: record.Model || 'General',
    accessType: accessType,
    syllabus: typeof record.TestTags === 'string' ? record.TestTags.split(',').map(tag => tag.trim()) : [],
    schedule: 'Available Anytime',
    price: accessType === 'Free' ? 0 : 499,
    imageUrl: `https://placehold.co/600x400.png?text=${encodeURIComponent(record.TestName || 'Test')}`,
    dataAiHint: slugify(record.TestName || 'test'),
    targetExams: record.Exam ? [record.Exam] : [],
    unlocksAtTier: unlocksAtTier,
  };
};

interface ActiveChallengeDisplay {
  id: string; // This will be the ID of the student_create_challenge record
  inviteId: string; // ID of the students_challenge_invites record
  challengeName: string;
  challengerName: string;
  subject: string;
  lesson: string;
  expiresAt: Date | null;
  status: 'Live' | 'Expired';
}

const testTypeOptions: Array<{ value: string; label: string }> = [
    { value: 'All', label: 'All Test Types' },
    { value: 'Chapterwise', label: 'Chapterwise' },
    { value: 'Full Length', label: 'Full Length' },
];

export default function TestSeriesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTestType, setFilterTestType] = useState<string>('All');
  const [filterSubject, setFilterSubject] = useState('All');
  const [filterExam, setFilterExam] = useState('all');
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [allFetchedTests, setAllFetchedTests] = useState<TestSeries[]>([]);
  const [isLoadingTests, setIsLoadingTests] = useState(true);
  const [errorLoadingTests, setErrorLoadingTests] = useState<string | null>(null);

  const [activeChallenges, setActiveChallenges] = useState<ActiveChallengeDisplay[]>([]);
  const [isLoadingChallenges, setIsLoadingChallenges] = useState(true);
  const [errorLoadingChallenges, setErrorLoadingChallenges] = useState<string | null>(null);


  const [currentUserTier, setCurrentUserTier] = useState<UserSubscriptionTierStudent | null>(null);

  useEffect(() => {
    if (user && user.studentSubscriptionTier) {
      setCurrentUserTier(user.studentSubscriptionTier);
    } else if (!authLoading && !user) {
      setCurrentUserTier('Free');
    }
  }, [user, authLoading]);

  const fetchTests = useCallback(async (isMountedGetter: () => boolean) => {
    if (!isMountedGetter()) return;
    setIsLoadingTests(true);
    setErrorLoadingTests(null);
    try {
      const records = await pb.collection('test_pages').getFullList<RecordModel>({
        fields: "id,created,TestName,TotalQuestion,TotalTime,Type,Model,Exam,TestTags"
      });
      if (isMountedGetter()) {
        setAllFetchedTests(records.map(mapPbRecordToTestSeries));
      }
    } catch (err: any) {
      if (isMountedGetter()) {
        // ... (existing error handling for fetchTests)
      }
    } finally {
      if (isMountedGetter()) {
        setIsLoadingTests(false);
      }
    }
  }, [toast]);

  const fetchActiveChallenges = useCallback(async (isMountedGetter: () => boolean) => {
    if (!user?.id || !isMountedGetter()) {
      if (isMountedGetter()) { setActiveChallenges([]); setIsLoadingChallenges(false); }
      return;
    }
    if (isMountedGetter()) setIsLoadingChallenges(true);
    if (isMountedGetter()) setErrorLoadingChallenges(null);

    try {
      const expandString = 'created_challenged_data(id,Subject,Lesson,challenge_name,expires_at,student), created_challenged_data.student(id,name)';
      const records = await pb.collection('students_challenge_invites').getFullList<RecordModel>({
        filter: `student = "${user.id}" && status = "accepted"`,
        sort: '-created_challenged_data.expires_at', // Show soon-to-expire first
        expand: expandString,
      });

      if (isMountedGetter()) {
        const now = new Date();
        const mappedChallenges: ActiveChallengeDisplay[] = records.map(invite => {
          const challengeData = invite.expand?.created_challenged_data as (RecordModel & { expires_at?: string, student: string, expand?: { student?: RecordModel } }) | undefined;
          const expiresAtDate = challengeData?.expires_at ? new Date(challengeData.expires_at) : null;
          return {
            id: challengeData?.id || invite.created_challenged_data, // Fallback to relation ID if expand fails
            inviteId: invite.id,
            challengeName: challengeData?.challenge_name || 'Unnamed Challenge',
            challengerName: challengeData?.expand?.student?.name || 'Unknown Challenger',
            subject: challengeData?.Subject || 'N/A',
            lesson: challengeData?.Lesson || 'N/A',
            expiresAt: expiresAtDate,
            status: expiresAtDate && expiresAtDate > now ? 'Live' : 'Expired',
          };
        }).filter(c => c.status === 'Live'); // Only show Live challenges initially
        setActiveChallenges(mappedChallenges);
      }
    } catch (err: any) {
      if (isMountedGetter()) {
        const clientError = err as ClientResponseError;
        // ... (existing error handling for challenges)
      }
    } finally {
      if(isMountedGetter()) setIsLoadingChallenges(false);
    }
  }, [user?.id, toast]);


  useEffect(() => {
    let isMounted = true;
    const isMountedGetter = () => isMounted;

    fetchTests(isMountedGetter);
    if (user?.id) fetchActiveChallenges(isMountedGetter); else if (isMountedGetter()) { setIsLoadingChallenges(false); setActiveChallenges([]); }

    const subscribeToRegularTests = async () => {
      if (!isMountedGetter()) return;
      try {
        const unsubscribeFn = await pb.collection('test_pages').subscribe('*', (e) => {
          if (!isMountedGetter()) return; fetchTests(isMountedGetter);
        });
        if (!isMountedGetter()) unsubscribeFn(); return unsubscribeFn;
      } catch (error) { if (isMountedGetter()) console.error("Error subscribing to test_pages:", error); return () => {}; }
    };

    const subscribeToChallengeInvites = async () => {
      if (!isMountedGetter() || !user?.id) return;
      try {
        const unsubscribeFn = await pb.collection('students_challenge_invites').subscribe('*', (e) => {
          if (!isMountedGetter()) return;
          if (e.record.student === user.id) fetchActiveChallenges(isMountedGetter);
        });
        if (!isMountedGetter()) unsubscribeFn(); return unsubscribeFn;
      } catch (error) { if (isMountedGetter()) console.error("Error subscribing to students_challenge_invites:", error); return () => {}; }
    };


    let unsubRegularTestsPromise = subscribeToRegularTests();
    let unsubChallengesPromise = subscribeToChallengeInvites();

    return () => {
      isMounted = false;
      unsubRegularTestsPromise.then(unsub => { if (typeof unsub === 'function') unsub(); });
      unsubChallengesPromise.then(unsub => { if (typeof unsub === 'function') unsub(); });
    };
  }, [fetchTests, fetchActiveChallenges, user?.id]);


  const subjects = useMemo(() => {
    const allSubjects = new Set<string>();
    allFetchedTests.forEach(ts => ts.subject && allSubjects.add(ts.subject));
    return ['All', ...Array.from(allSubjects).sort()];
  }, [allFetchedTests]);

  const exams = useMemo(() => {
    const allExams = new Set<string>();
    allFetchedTests.forEach(ts => {
      ts.targetExams.forEach(exam => allExams.add(exam));
    });
    return ['all', ...Array.from(allExams).sort()];
  }, [allFetchedTests]);

  useEffect(() => {
    if (user?.favExam && exams.includes(user.favExam)) {
      setFilterExam(user.favExam);
    } else if (!authLoading && !user) {
      setFilterExam('all');
    }
  }, [user?.favExam, exams, authLoading, user]);


  const filteredTestSeries = useMemo(() => {
    if (authLoading || currentUserTier === null || isLoadingTests) return [];
    return allFetchedTests.filter(ts => {
      const matchesSearch = ts.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            ts.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTestTypeFilter = filterTestType === 'All' ||
        (ts.targetAudience && ts.targetAudience.toLowerCase().replace(/\s+/g, '_') === filterTestType.toLowerCase().replace(/\s+/g, '_'));
      const matchesSubject = filterSubject === 'All' || ts.subject === filterSubject;
      const matchesExam = filterExam === 'all' || ts.targetExams.includes(filterExam);
      const requiredTierForTest = ts.unlocksAtTier || 'Free';
      let hasPlanAccess = false;
      if (currentUserTier) {
        switch (currentUserTier) {
          case 'Free': case 'Dpp': hasPlanAccess = requiredTierForTest === 'Free'; break;
          case 'Chapterwise': hasPlanAccess = requiredTierForTest === 'Free' || requiredTierForTest === 'Chapterwise'; break;
          case 'Full_length': hasPlanAccess = requiredTierForTest === 'Free' || requiredTierForTest === 'Full_length'; break;
          case 'Combo': hasPlanAccess = true; break;
          default: hasPlanAccess = false;
        }
      }
      return matchesSearch && matchesTestTypeFilter && matchesSubject && matchesExam && hasPlanAccess;
    });
  }, [searchTerm, filterTestType, filterSubject, filterExam, currentUserTier, authLoading, allFetchedTests, isLoadingTests]);

  const renderFilterControls = (isSheet: boolean = false) => (
    <>
      <div className={`relative ${isSheet ? 'w-full' : 'flex-grow md:flex-grow-0'}`}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search tests..."
          className={`pl-9 w-full ${!isSheet && 'md:w-[200px] lg:w-[300px]'}`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <Select value={filterTestType} onValueChange={(value) => setFilterTestType(value as string)}>
        <SelectTrigger className={`w-full ${!isSheet && 'md:w-auto min-w-[180px]'}`}>
          <FilterIcon className="h-4 w-4 mr-2 text-muted-foreground" />
          <SelectValue placeholder="All Test Types" />
        </SelectTrigger>
        <SelectContent>
          {testTypeOptions.map(option => ( <SelectItem key={option.value} value={option.value}> {option.label} </SelectItem> ))}
        </SelectContent>
      </Select>
      <Select value={filterSubject} onValueChange={setFilterSubject}>
        <SelectTrigger className={`w-full ${!isSheet && 'md:w-auto min-w-[180px]'}`}>
          <FilterIcon className="h-4 w-4 mr-2 text-muted-foreground" />
          <SelectValue placeholder="Subjects (All)" />
        </SelectTrigger>
        <SelectContent> {subjects.map(subject => ( <SelectItem key={subject} value={subject}> {subject} </SelectItem> ))} </SelectContent>
      </Select>
      <Select value={filterExam} onValueChange={setFilterExam}>
        <SelectTrigger className={`w-full ${!isSheet && 'md:w-auto min-w-[180px]'}`}>
          <FilterIcon className="h-4 w-4 mr-2 text-muted-foreground" />
          <SelectValue placeholder="All Exams" />
        </SelectTrigger>
        <SelectContent> {exams.map(exam => ( <SelectItem key={exam} value={exam}> {exam === 'all' ? 'All Exams' : exam} </SelectItem> ))} </SelectContent>
      </Select>
    </>
  );

  if (authLoading || isLoadingTests || isLoadingChallenges || currentUserTier === null) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="space-y-2"> <Skeleton className="h-8 w-1/3" /> <Skeleton className="h-4 w-2/3" /> <Skeleton className="h-4 w-1/2" /> </div>
        <div className="flex flex-col md:flex-row gap-2 justify-end"> <Skeleton className="h-10 w-full md:w-[200px] lg:w-[300px]" /> <Skeleton className="h-10 w-full md:w-[180px]" /> <Skeleton className="h-10 w-full md:w-[180px]" /> <Skeleton className="h-10 w-full md:w-[180px]" /> </div>
        <Skeleton className="h-10 w-1/2 mt-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {[...Array(4)].map((_, i) => ( <Card key={i} className="flex flex-col overflow-hidden shadow-sm h-full rounded-xl border border-border/50"> <CardHeader className="p-4 space-y-2"> <div className="flex justify-between items-center"> <Skeleton className="h-6 w-20 rounded-md"/> <Skeleton className="h-6 w-20 rounded-md"/> </div> <Skeleton className="h-5 w-3/4" /> </CardHeader> <CardContent className="flex-grow p-4 space-y-2 text-sm"> <Skeleton className="h-4 w-24" /> <Skeleton className="h-4 w-20" /> <Skeleton className="h-4 w-32" /> </CardContent> <CardFooter className="p-4 mt-auto border-t border-border/30 bg-muted/30"> <Skeleton className="h-10 w-full rounded-md" /> </CardFooter> </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Test Series</h1>
        <p className="text-muted-foreground">Browse tests for various exams and subjects. Accepted challenges will also appear here.</p>
        {user && user.studentSubscriptionTier && <p className="text-sm text-primary">Your current plan: <span className="font-semibold">{user.studentSubscriptionTier}</span></p>}
      </div>
      <div className="hidden md:flex flex-col md:flex-row gap-2 justify-end"> {renderFilterControls(false)} </div>
      <div className="md:hidden flex justify-end">
        <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
          <SheetTrigger asChild><Button variant="outline" className="w-full"><FilterIcon className="mr-2 h-4 w-4" /> Filters </Button></SheetTrigger>
          <SheetContent side="bottom" className="flex flex-col max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-4rem)] sm:max-h-[75vh]"> {/* Adjusted max-h */}
            <SheetHeader className="p-4 border-b"> <SheetTitle>Filter Tests</SheetTitle> <SheetDescription> Refine your test series view. </SheetDescription> </SheetHeader>
            <div className="flex-grow overflow-y-auto p-4 space-y-4"> {renderFilterControls(true)} </div>
            <SheetFooter className="p-4 border-t">
              <SheetClose asChild>
                <button className={cn(buttonVariants({ variant: "default" }), "w-full")}>
                  Done
                </button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {(errorLoadingTests || errorLoadingChallenges) && (
        <Card className="text-center p-10 col-span-full bg-destructive/10 border-destructive">
          <CardHeader className="items-center p-0"> <AlertCircle className="h-12 w-12 text-destructive mb-3" /> <CardTitle className="text-destructive">Error Loading Data</CardTitle> </CardHeader>
          <CardContent className="p-0 mt-2"> <CardDescription className="text-destructive/90 whitespace-pre-wrap">{errorLoadingTests || errorLoadingChallenges}</CardDescription> </CardContent>
        </Card>
      )}

      {/* Active Challenges Section */}
      {!isLoadingChallenges && !errorLoadingChallenges && activeChallenges.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold mb-4 text-primary flex items-center gap-2">
            <Swords className="h-6 w-6" /> Active Challenges & Compete Tests
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {activeChallenges.map(challenge => (
              <Card key={challenge.inviteId} className="flex flex-col overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out transform hover:-translate-y-1.5 h-full border-2 border-purple-400 dark:border-purple-600 group bg-card">
                <CardHeader className="p-4 space-y-1 bg-purple-50 dark:bg-purple-900/20">
                  <div className="flex justify-between items-center">
                    <Badge variant="default" className="text-xs py-1 px-2.5 font-semibold bg-purple-600 text-white">Challenge</Badge>
                    <Badge variant="outline" className="text-xs py-1 px-2.5 border-purple-400 text-purple-600 dark:text-purple-300 dark:border-purple-500">
                      {challenge.status} {challenge.expiresAt ? `(Ends ${formatDistanceToNow(challenge.expiresAt, { addSuffix: true })})` : ''}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg font-bold text-purple-700 dark:text-purple-300 group-hover:text-purple-600 dark:group-hover:text-purple-200 transition-colors line-clamp-2 leading-tight">
                    {challenge.challengeName}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">Challenged by: {challenge.challengerName}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow p-4 space-y-1 text-sm text-muted-foreground">
                  <p><strong>Subject:</strong> {challenge.subject}</p>
                  <p><strong>Lesson:</strong> {challenge.lesson}</p>
                </CardContent>
                <CardFooter className="p-4 mt-auto border-t border-purple-200 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20">
                  <Link href={Routes.competeTest(challenge.id)} passHref className="w-full">
                    <Button variant="default" className="w-full bg-purple-600 hover:bg-purple-700 text-white justify-between text-sm">
                      Start Challenge <Gamepad2 className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Regular Test Series Section */}
      <section className={activeChallenges.length > 0 ? "mt-12 pt-8 border-t" : ""}>
        <h2 className="text-xl font-semibold mb-4 text-foreground">
          {activeChallenges.length > 0 ? "Regular Test Series" : ""}
        </h2>
        {!errorLoadingTests && filteredTestSeries.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {filteredTestSeries.map((ts) => ( <TestSeriesCard key={ts.id} testSeries={ts} /> ))}
          </div>
        ) : (
          !errorLoadingTests && !isLoadingTests && (
              <Card className="text-center p-10 col-span-full">
              <CardHeader className="items-center p-0"> <AlertCircle className="h-12 w-12 text-muted-foreground mb-3" /> <CardTitle>No Test Series Found</CardTitle> </CardHeader>
              <CardContent className="p-0 mt-2"> <CardDescription> No test series match your current filters or subscription level. Try adjusting your search or filters. You can also <Link href={Routes.upgrade} className="text-primary hover:underline">upgrade your plan</Link> to access more tests. </CardDescription> </CardContent>
              </Card>
          )
        )}
      </section>
    </div>
  );
}
