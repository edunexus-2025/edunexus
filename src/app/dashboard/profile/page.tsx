'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from '@/contexts/AuthContext';
import { Routes } from '@/lib/constants';
import pb from '@/lib/pocketbase';
import type { RecordModel, UnsubscribeFunc } from 'pocketbase';
import { Separator } from "@/components/ui/separator"; 
import { ArrowLeft, Settings, Trophy, History, Target, CalendarClock, ChevronRight, ClipboardList, CheckCircle2, BarChart3, Flame, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState, useCallback } from "react";
import { format } from 'date-fns';

interface RecentTestResult {
  id: string;
  test_name: string;
  score: number;
  max_score: number;
  percentage: number;
  created: string; // Submission date
}

const mockDppSnapshot = {
  questions: 0,
  correct: 0,
  accuracy: 0,
  dppSets: 0,
};

const mockDailyDppGoal = {
  solved: 0,
  total: 10,
};

interface StudentPointsRecord extends RecordModel {
  students: string; 
  dpp_points: string; 
  test_points: string; 
}

export default function ProfilePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [studentPoints, setStudentPoints] = useState<{ dpp: number; test: number; total: number } | null>(null);
  const [isLoadingPoints, setIsLoadingPoints] = useState(true);
  const [recentTestResults, setRecentTestResults] = useState<RecentTestResult[]>([]);
  const [isLoadingRecentTests, setIsLoadingRecentTests] = useState(true);
  const [recentTestsError, setRecentTestsError] = useState<string | null>(null);

  const fetchStudentPoints = useCallback(async (userId: string, isMountedGetter: () => boolean) => {
    if (!isMountedGetter()) return;
    setIsLoadingPoints(true);
    try {
      const record = await pb.collection('students_points').getFirstListItem<StudentPointsRecord>(`students = "${userId}"`, { '$autoCancel': false });
      if (isMountedGetter()) {
        const dpp = parseInt(record.dpp_points, 10);
        const test = parseInt(record.test_points, 10);

        if (isNaN(dpp) || isNaN(test)) {
            console.warn(`ProfilePage: Parsed points are NaN for user ${userId}. Raw DPP: "${record.dpp_points}", Raw Test: "${record.test_points}". Defaulting to 0.`);
            setStudentPoints({ dpp: isNaN(dpp) ? 0 : dpp, test: isNaN(test) ? 0 : test, total: (isNaN(dpp) ? 0 : dpp) + (isNaN(test) ? 0 : test) });
        } else {
            setStudentPoints({ dpp, test, total: dpp + test });
        }
      }
    } catch (error: any) {
      if (isMountedGetter()) {
        if (error.status === 404) { 
          console.log(`ProfilePage: No students_points record found for ${userId}. Defaulting to 0.`);
          setStudentPoints({ dpp: 0, test: 0, total: 0 });
        } else {
          console.error("ProfilePage: Error fetching student points:", error);
          setStudentPoints(null); 
        }
      }
    } finally {
      if (isMountedGetter()) setIsLoadingPoints(false);
    }
  }, []);

  const fetchRecentTests = useCallback(async (userId: string, isMountedGetter: () => boolean) => {
    if (!isMountedGetter()) return;
    setIsLoadingRecentTests(true);
    setRecentTestsError(null);
    try {
      const records = await pb.collection('test_chapterwise_result').getList<RecentTestResult>(1, 3, {
        filter: `user = "${userId}"`,
        sort: '-created',
        fields: 'id,test_name,score,max_score,percentage,created',
        '$autoCancel': false,
      });
      if (isMountedGetter()) {
        setRecentTestResults(records.items);
      }
    } catch (error: any) {
      if (isMountedGetter()) {
        console.error("ProfilePage: Error fetching recent tests:", error);
        setRecentTestsError("Could not load recent test history.");
      }
    } finally {
      if (isMountedGetter()) setIsLoadingRecentTests(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let unsubscribePoints: UnsubscribeFunc | null = null;
    let unsubscribeResults: UnsubscribeFunc | null = null;

    if (!isLoading && user?.id) {
      fetchStudentPoints(user.id, () => isMounted);
      fetchRecentTests(user.id, () => isMounted);

      const setupSubscriptions = async () => {
        if (!isMounted || !user?.id) return;
        try {
          unsubscribePoints = await pb.collection('students_points').subscribe(
            '*', 
            (e) => {
              if (isMounted && e.record.students === user.id) { 
                fetchStudentPoints(user.id, () => isMounted);
              }
            },
            { filter: `students = "${user.id}"` } 
          );
          unsubscribeResults = await pb.collection('test_chapterwise_result').subscribe(
            '*', 
            (e) => {
              if (isMounted && e.record.user === user.id) {
                fetchRecentTests(user.id, () => isMounted);
              }
            },
            { filter: `user = "${user.id}"` }
          );
        } catch (subError) {
          if(isMounted) console.error("ProfilePage: Error subscribing:", subError);
        }
      };
      setupSubscriptions();

    } else if (!isLoading && !user) {
      setIsLoadingPoints(false); 
      setStudentPoints(null);
      setIsLoadingRecentTests(false);
      setRecentTestResults([]);
    }

    return () => {
      isMounted = false;
      if (unsubscribePoints) unsubscribePoints();
      if (unsubscribeResults) unsubscribeResults();
    };
  }, [user, isLoading, fetchStudentPoints, fetchRecentTests]);


  if (isLoading || isLoadingPoints) {
    return (
      <div className="p-4 md:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <Skeleton className="h-40 w-full rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
        <Skeleton className="h-24 w-full rounded-lg" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
        </div>
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  if (!user) {
    router.push(Routes.login);
    return null;
  }

  const getAvatarFallback = (name: string) => {
    const nameParts = name.split(' ');
    if (nameParts.length > 1) {
      return nameParts[0][0] + nameParts[nameParts.length -1][0];
    }
    return name.substring(0,2).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between p-4 sticky top-0 bg-background/80 backdrop-blur-sm z-10 md:hidden border-b">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">My Profile</h1>
        <Link href={Routes.settings} passHref>
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
        </Link>
      </header>

      <main className="p-4 md:p-8 space-y-6">
        <div className="hidden md:flex items-center justify-between mb-6">
            <Button variant="ghost" onClick={() => router.back()} className="flex items-center gap-2 text-sm">
                <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <h1 className="text-3xl font-bold text-center flex-1">My Profile</h1>
            <Link href={Routes.settings} passHref>
                <Button variant="ghost" size="icon" aria-label="Settings">
                    <Settings className="h-6 w-6" />
                </Button>
            </Link>
        </div>

        <Card className="shadow-lg">
          <CardContent className="p-6 flex flex-col md:flex-row items-center gap-6">
            <Avatar className="h-24 w-24 text-3xl border-2 border-primary">
              <AvatarImage src={user.avatarUrl} alt={user.name} />
              <AvatarFallback>{getAvatarFallback(user.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-semibold">{user.name}</h2>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <div className="mt-2 flex flex-wrap justify-center md:justify-start gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Class: <span className="font-medium text-foreground">{user.grade || 'N/A'}</span></span>
                <span>Target Exam: <span className="font-medium text-foreground">{user.favExam || 'N/A'}</span></span>
                {user.targetYear && <span>Target Year: <span className="font-medium text-foreground">{user.targetYear}</span></span>}
                <span>Plan: <span className="font-medium text-foreground">{user.studentSubscriptionTier || 'N/A'}</span></span>
              </div>
            </div>
            <Card className="p-3 rounded-lg text-center shadow-inner bg-card border md:min-w-[150px] min-h-[100px] flex flex-col justify-center">
              <CardHeader className="p-0 pb-0.5 items-center">
                <Trophy className="h-4 w-4 text-primary" />
                <CardTitle className="text-xs mt-0.5 font-medium text-muted-foreground">Total Points</CardTitle>
              </CardHeader>
              <CardContent className="p-0 mt-0.5">
                {isLoadingPoints ? (
                  <div className="flex justify-center items-center h-[36px]">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <p className="text-3xl font-bold text-primary">{studentPoints?.total ?? 0}</p>
                )}
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href={Routes.myProgress} passHref>
            <Button variant="outline" className="w-full justify-between h-14 text-base py-3 px-4 shadow hover:shadow-md">
              <div className="flex items-center gap-3">
                <History className="h-6 w-6 text-primary" /> My Test History
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Button>
          </Link>
          <Link href={Routes.leaderboard} passHref>
            <Button variant="outline" className="w-full justify-between h-14 text-base py-3 px-4 shadow hover:shadow-md">
              <div className="flex items-center gap-3">
                <Trophy className="h-6 w-6 text-primary" /> View Leaderboard
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Button>
          </Link>
        </div>

        <section>
          <h3 className="text-xl font-semibold mb-3">My Learning Activity</h3>
          <Card className="shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-sm flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" /> My Daily DPP Goal
                </p>
                <p className="text-xs text-muted-foreground">
                  {mockDailyDppGoal.solved}/{mockDailyDppGoal.total} Questions Solved Today (DPP)
                </p>
              </div>
              <Progress value={(mockDailyDppGoal.solved / mockDailyDppGoal.total) * 100} className="h-2" />
            </CardContent>
          </Card>
        </section>

        <section>
          <h3 className="text-xl font-semibold mb-3">This Week's Snapshot (DPP)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { title: 'QUESTIONS', value: mockDppSnapshot.questions, icon: <ClipboardList className="h-6 w-6 text-blue-500" /> },
              { title: 'CORRECT', value: mockDppSnapshot.correct, icon: <CheckCircle2 className="h-6 w-6 text-green-500" /> },
              { title: 'ACCURACY', value: `${mockDppSnapshot.accuracy}%`, icon: <BarChart3 className="h-6 w-6 text-yellow-500" /> },
              { title: 'DPP SETS', value: mockDppSnapshot.dppSets, icon: <Flame className="h-6 w-6 text-red-500" /> },
            ].map(item => (
              <Card key={item.title} className="text-center p-4 shadow hover:shadow-md">
                <div className="mb-2">{item.icon}</div>
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.title}</p>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-xl font-semibold mb-3">Recent Tests</h3>
          <CardDescription className="mb-4 text-sm">Your latest test performance.</CardDescription>
          <div className="space-y-4">
            {isLoadingRecentTests && (
              <>
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-20 w-full rounded-lg" />
              </>
            )}
            {!isLoadingRecentTests && recentTestsError && (
              <Card className="p-4 text-center text-destructive border-destructive bg-destructive/10">
                <p>{recentTestsError}</p>
              </Card>
            )}
            {!isLoadingRecentTests && !recentTestsError && recentTestResults.length === 0 && (
              <p className="text-muted-foreground">No recent tests to display. <Link href={Routes.testSeries} className="text-primary hover:underline">Attempt a test!</Link></p>
            )}
            {!isLoadingRecentTests && !recentTestsError && recentTestResults.map(test => (
              <Card key={test.id} className="shadow hover:shadow-md">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{test.test_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Score: {test.score}/{test.max_score} ({test.percentage.toFixed(1)}%)
                      <span className="mx-1">·</span>
                      {format(new Date(test.created), "dd MMM yyyy")}
                    </p>
                  </div>
                  <Link href={Routes.testResult(test.id)} passHref>
                    <Button variant="ghost" size="sm" className="flex items-center gap-1 text-primary">
                      View Details <ExternalLink className="h-3 w-3" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Link href={Routes.myProgress} passHref>
          <Button size="lg" className="w-full mt-6">
            View All Test History
          </Button>
        </Link>
      </main>
    </div>
  );
}
