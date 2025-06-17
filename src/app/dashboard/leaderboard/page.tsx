
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import pb from '@/lib/pocketbase';
import type { User } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { Crown, Loader2, AlertCircle, Star, Users as UsersIcon, BadgeHelp, Medal, Award } from 'lucide-react';
import type { RecordModel, ClientResponseError, UnsubscribeFunc } from 'pocketbase';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';
import Image from 'next/image'; // Ensured Image is imported

interface StudentPointsRecord extends RecordModel {
  students: string; // User ID
  dpp_points: string;
  test_points: string;
  expand?: {
    students?: UserRecord; // From 'users' collection
  };
}

interface UserRecord extends RecordModel {
  name: string;
  avatarUrl?: string;
  avatar?: string; // filename
  collectionId?: string;
  collectionName?: string;
}

interface LeaderboardUser {
  rank: number;
  id: string;
  name: string;
  avatarUrl?: string;
  totalPoints: number;
  isCurrentUser: boolean;
}

export default function LeaderboardPage() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (isMountedGetter: () => boolean = () => true) => {
    if (!isMountedGetter()) return;
    setIsLoading(true);

    try {
      const pointsRecords = await pb.collection('students_points').getFullList<StudentPointsRecord>({
        expand: 'students',
        fields: 'id,dpp_points,test_points,students,expand.students.id,expand.students.name,expand.students.avatarUrl,expand.students.avatar,expand.students.collectionId,expand.students.collectionName',
        '$autoCancel': false,
      });

      if (!isMountedGetter()) return;

      const processedUsers = pointsRecords.map(record => {
        const studentData = record.expand?.students;
        const dppPoints = parseInt(record.dpp_points || '0', 10) || 0;
        const testPoints = parseInt(record.test_points || '0', 10) || 0;
        const totalPoints = dppPoints + testPoints;

        let avatarUrlResult;
        if (studentData?.avatarUrl && studentData.avatarUrl.startsWith('http')) {
          avatarUrlResult = studentData.avatarUrl;
        } else if (studentData?.avatar && studentData.collectionId && studentData.collectionName) {
          try {
            avatarUrlResult = pb.files.getUrl(studentData as RecordModel, studentData.avatar as string);
          } catch (e) { console.warn("Error getting avatar URL:", e); avatarUrlResult = undefined; }
        }
        
        if (!avatarUrlResult && studentData?.name) {
            avatarUrlResult = `https://ui-avatars.com/api/?name=${encodeURIComponent(studentData.name.charAt(0))}&background=random&color=fff`;
        }
        
        return {
          id: studentData?.id || record.students,
          name: studentData?.name || 'Unknown User',
          avatarUrl: avatarUrlResult,
          totalPoints: totalPoints,
          isCurrentUser: currentUser?.id === (studentData?.id || record.students),
        };
      });

      processedUsers.sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) {
          return b.totalPoints - a.totalPoints;
        }
        return a.name.localeCompare(b.name);
      });

      let rank = 1;
      const rankedUsers = processedUsers.map((user, index, arr) => {
        if (index > 0 && user.totalPoints < arr[index - 1].totalPoints) {
          rank = index + 1;
        }
        return { ...user, rank };
      });
      if (isMountedGetter()) {
        setLeaderboardData(rankedUsers);
        setError(null); 
      }

    } catch (err: any) {
      if (!isMountedGetter()) return;
      const clientError = err as ClientResponseError;
      if (clientError?.isAbort || (clientError?.name === 'ClientResponseError' && clientError?.status === 0)) {
        console.warn('LeaderboardPage: Fetch leaderboard data request was cancelled.');
        if (leaderboardData.length === 0) { // Only set error if we don't have old data to show
          setError("Could not load leaderboard due to a network issue or cancellation. Please try again.");
        }
      } else {
        console.error("LeaderboardPage: Failed to fetch leaderboard data:", clientError.data || clientError);
        const errorMsg = `Could not load leaderboard. Error: ${clientError.data?.message || clientError.message}`;
        setError(errorMsg);
      }
    } finally {
      if (isMountedGetter()) setIsLoading(false);
    }
  }, [currentUser?.id, leaderboardData.length]); // leaderboardData.length helps avoid error if data already exists and cancellation happens

  useEffect(() => {
    let isMounted = true;
    const componentIsMountedChecker = () => isMounted;
    
    if (!authLoading) { 
      loadData(componentIsMountedChecker);
    }

    let unsubscribe: UnsubscribeFunc | null = null;

    const setupSubscription = async () => {
      if (!isMounted) return;
      try {
        unsubscribe = await pb.collection('students_points').subscribe('*', (e) => {
          if (componentIsMountedChecker()) {
            console.log('Leaderboard: students_points collection changed, reloading data.', e.action, e.record.id);
            loadData(componentIsMountedChecker);
          }
        });
      } catch (subError) {
        if (componentIsMountedChecker()) {
            console.error("LeaderboardPage: Error subscribing to students_points:", subError);
        }
      }
    };
    
    if(!authLoading) { 
        setupSubscription();
    }

    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [authLoading, loadData]);


  const getAvatarFallback = (name: string) => {
    const nameParts = name.split(' ');
    if (nameParts.length > 1) {
      return nameParts[0][0] + nameParts[nameParts.length - 1][0];
    }
    return name.substring(0, 2).toUpperCase();
  };
  
  const renderLeaderboardContent = () => {
    if (isLoading && leaderboardData.length === 0) {
      return (
        <div className="space-y-3 mt-6">
          <Skeleton className="h-6 w-1/3 mx-auto mt-8 mb-4" />
          {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg bg-muted/50" />)}
        </div>
      );
    }
    if (error && leaderboardData.length === 0) { // Only show full error if no data is displayable
      return (
        <Card className="mt-6 text-center p-6 bg-destructive/10 border-destructive">
          <AlertCircle className="mx-auto h-10 w-10 text-destructive mb-3" />
          <CardTitle className="text-destructive">Error Loading Leaderboard</CardTitle>
          <CardDescription className="text-destructive/80 whitespace-pre-wrap">{error}</CardDescription>
        </Card>
      );
    }
    if (leaderboardData.length === 0 && !isLoading) {
      return (
        <Card className="mt-6 text-center p-10 border-dashed">
          <UsersIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <CardTitle className="text-xl">LeaderBoard is Empty</CardTitle>
          <CardDescription>No student data available yet. Start practicing to appear here!</CardDescription>
        </Card>
      );
    }

    const top20Users = leaderboardData.slice(0, 20);
    const currentUserData = leaderboardData.find(u => u.isCurrentUser);
    const isCurrentUserInTop20 = currentUserData && currentUserData.rank <= 20;

    const rankToIconAndStyle: Record<number, { icon: React.ReactNode; cardClass: string; textClass: string; pointClass: string }> = {
      1: { icon: <Crown className="h-5 w-5 text-yellow-500" />, cardClass: "bg-yellow-500/10 border-yellow-500 ring-2 ring-yellow-500/50", textClass: "text-yellow-700 dark:text-yellow-400", pointClass: "text-yellow-600 dark:text-yellow-400" },
      2: { icon: <Medal className="h-5 w-5 text-slate-500" />, cardClass: "bg-slate-500/10 border-slate-500", textClass: "text-slate-700 dark:text-slate-400", pointClass: "text-slate-600 dark:text-slate-400" },
      3: { icon: <Award className="h-5 w-5 text-orange-600" />, cardClass: "bg-orange-600/10 border-orange-600", textClass: "text-orange-700 dark:text-orange-400", pointClass: "text-orange-600 dark:text-orange-400" },
    };

    return (
      <>
        <div className="mt-6 space-y-2">
          {top20Users.map((userToList) => {
            const rankStyle = rankToIconAndStyle[userToList.rank];
            return (
              <Card key={userToList.id} className={cn(
                "p-3 shadow-sm hover:shadow-md transition-shadow duration-150 ease-in-out bg-card border",
                userToList.isCurrentUser && !rankStyle && "border-primary ring-2 ring-primary/50 bg-primary/5 dark:bg-primary/10",
                rankStyle?.cardClass
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                      "flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold",
                      rankStyle ? (rankStyle.textClass.includes("yellow") ? "bg-yellow-400 text-yellow-900" : rankStyle.textClass.includes("slate") ? "bg-slate-400 text-slate-900" : "bg-orange-400 text-orange-900")
                        : userToList.isCurrentUser ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    {userToList.rank}
                  </div>
                  <Avatar className="h-9 w-9 border">
                    <AvatarImage src={userToList.avatarUrl} alt={userToList.name} data-ai-hint="student avatar"/>
                    <AvatarFallback>{getAvatarFallback(userToList.name)}</AvatarFallback>
                  </Avatar>
                  <p className={cn("text-sm font-medium flex-grow truncate", rankStyle?.textClass || "text-foreground")} title={userToList.name}>
                    {rankStyle?.icon && <span className="mr-1.5 align-middle">{rankStyle.icon}</span>}
                    {userToList.name} {userToList.isCurrentUser && <span className="text-xs text-primary font-normal ml-1">(You)</span>}
                  </p>
                  <div className={cn(
                      "flex items-center text-sm font-semibold ml-auto flex-shrink-0", 
                      rankStyle?.pointClass || (userToList.isCurrentUser ? "text-primary" : "text-muted-foreground/80")
                  )}>
                    <Star className="h-4 w-4 mr-1 fill-current opacity-90" />
                    {userToList.totalPoints}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {currentUserData && !isCurrentUserInTop20 && (
          <>
            {top20Users.length > 0 && currentUserData.rank > 20 && (
              <div className="text-center text-muted-foreground py-4 text-2xl tracking-widest">...</div>
            )}
            <div className="mt-8 pt-6 border-t border-border/50">
              <h2 className="text-xl font-semibold mb-4 text-center text-primary">Your Current Rank</h2>
              <Card key={currentUserData.id} className="p-4 shadow-lg transition-shadow duration-150 ease-in-out bg-primary/10 border-2 border-primary ring-2 ring-primary/50 dark:bg-primary/20">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="flex-shrink-0 bg-primary text-primary-foreground h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center text-sm sm:text-base font-bold">
                    {currentUserData.rank}
                  </div>
                  <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-primary">
                    <AvatarImage src={currentUserData.avatarUrl} alt={currentUserData.name} data-ai-hint="student avatar"/>
                    <AvatarFallback className="text-lg">{getAvatarFallback(currentUserData.name)}</AvatarFallback>
                  </Avatar>
                  <p className="text-base sm:text-lg font-semibold text-primary flex-grow truncate" title={currentUserData.name}>
                    {currentUserData.name} <span className="text-xs font-normal">(You)</span>
                  </p>
                  <div className="flex items-center text-base sm:text-lg font-bold ml-auto flex-shrink-0 text-primary">
                    <Star className="h-5 w-5 mr-1.5 fill-current opacity-90" />
                    {currentUserData.totalPoints}
                  </div>
                </div>
              </Card>
            </div>
          </>
        )}
      </>
    );
  };

  return (
    <div className="bg-gradient-to-b from-slate-50 via-slate-100 to-slate-200 dark:from-slate-900 dark:via-slate-800 dark:to-slate-700 min-h-screen">
        <CardHeader className="bg-primary text-primary-foreground text-center py-4 sticky top-0 z-30 shadow-md">
            <div className="container mx-auto flex items-center justify-between relative px-2 sm:px-4">
                <div className="w-8"></div> {/* Spacer for left */}
                <CardTitle className="text-xl md:text-2xl font-bold">
                  LeaderBoard {/* Title Updated */}
                </CardTitle>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/20 h-8 w-8">
                            <BadgeHelp className="h-5 w-5"/>
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="max-w-md">
                        <AlertDialogHeader>
                        <AlertDialogTitle>How Rank is Calculated?</AlertDialogTitle>
                         <AlertDialogDescription className="text-sm text-muted-foreground space-y-2 pt-2">
                            <div>This is how we calculate ranks for the LeaderBoard:</div>
                            <ul className="list-disc list-inside space-y-1 pl-4">
                            <li>Points are earned when students attempt a DPP question correctly.</li>
                            <li>Points from tests also contribute to your total score reflected here.</li>
                            <li>If two or more students have the same total score, they are assigned the same rank (then sorted alphabetically by name).</li>
                            </ul>
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogAction>OK</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </CardHeader>
        
        <div className="container mx-auto max-w-sm sm:max-w-xl md:max-w-2xl pb-8 px-2 sm:px-4">
            <div className="mt-0 pt-4 pb-2 px-2 sm:px-4 rounded-b-lg bg-card dark:bg-slate-800 shadow-md">
                 {renderLeaderboardContent()}
            </div>
        </div>
    </div>
  );
}
