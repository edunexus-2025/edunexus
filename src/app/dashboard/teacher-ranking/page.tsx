
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import pb from '@/lib/pocketbase';
import type { User } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { Award, UserPlus, UserCheck, Loader2, ShieldAlert, Users, CheckCircle, Star, BookOpen, TrendingUp, ChevronLeft, ChevronRight, Search as SearchIcon } from 'lucide-react'; // Added SearchIcon
import type { RecordModel, ClientResponseError } from 'pocketbase';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { AppConfig } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input'; // Added Input

interface TeacherRankingRecord extends RecordModel {
  teacher: string; // Teacher ID
  followed_by?: string[];
  ranking?: number;
  totalfollowing?: string; 
  expand?: {
    teacher?: RecordModel;
  };
}

interface DisplayTeacher {
  id: string;
  name: string;
  avatarUrl?: string;
  instituteName?: string;
  subjectsOffered?: string[];
  teacherFavExams?: Array<'MHT CET' | 'JEE MAIN' | 'NEET'>;
  level?: 'Beginner' | 'Experienced';
  followersCount: number;
  isFollowedByCurrentUser: boolean;
  overallRank: number;
  teacherRankingRecordId: string; 
  followed_by_from_ranking_record?: string[];
  totalfollowing_from_db?: string; 
  EduNexus_Name?: string;
}

const DISCOVER_ITEMS_PER_PAGE = 10; // Items per page for discover section

export default function StudentTeacherRankingPage() {
  const { user: currentUser, isLoading: authIsLoading } = useAuth();
  const [rankedTeachers, setRankedTeachers] = useState<DisplayTeacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [updatingFollowId, setUpdatingFollowId] = useState<string | null>(null);
  const [currentFollowedTeacherIndex, setCurrentFollowedTeacherIndex] = useState(0);

  const [discoverSearchTerm, setDiscoverSearchTerm] = useState('');
  const [discoverCurrentPage, setDiscoverCurrentPage] = useState(1);

  const loadData = useCallback(async (isMountedChecker: () => boolean) => {
    if (authIsLoading && isMountedChecker()) {
      setIsLoading(true);
      return;
    }
    // No early return if !currentUser?.id, as we want to load all teachers for discovery
    
    if (isMountedChecker()) {
      setIsLoading(true);
      setError(null);
    }

    try {
      const rankingRecords = await pb.collection('teacher_ranking').getFullList<TeacherRankingRecord>({
        expand: 'teacher',
        fields: '*,expand.teacher.id,expand.teacher.name,expand.teacher.profile_picture,expand.teacher.institute_name,expand.teacher.subjects_offered,expand.teacher.favExam,expand.teacher.level,expand.teacher.EduNexus_Name,expand.teacher.collectionId,expand.teacher.collectionName',
      }).catch(err => {
        const clientError = err as ClientResponseError;
        if (clientError?.isAbort || (clientError?.name === 'ClientResponseError' && clientError?.status === 0)) {
          if (isMountedChecker()) console.warn('StudentTeacherRankingPage: Fetch teacher_ranking request was cancelled.');
        } else { throw err; }
        return [];
      });
      if (!isMountedChecker()) return;

      const allTeacherDataRecords = await pb.collection('teacher_data').getFullList<RecordModel>({
        fields: 'id,name,profile_picture,institute_name,subjects_offered,favExam,level,EduNexus_Name,collectionId,collectionName',
      }).catch(err => {
        const clientError = err as ClientResponseError;
        if (clientError?.isAbort || (clientError?.name === 'ClientResponseError' && clientError?.status === 0)) {
          if (isMountedChecker()) console.warn('StudentTeacherRankingPage: Fetch teacher_data request was cancelled.');
        } else { throw err; }
        return [];
      });
      if (!isMountedChecker()) return;
      
      const teacherDataMap = new Map<string, RecordModel>();
      allTeacherDataRecords.forEach(td => teacherDataMap.set(td.id, td));

      const processedTeachersTemp: DisplayTeacher[] = [];
      const processedTeacherIds = new Set<string>();

      rankingRecords.forEach(record => {
        const teacherInfoFromExpand = record.expand?.teacher;
        const teacherData = teacherInfoFromExpand || teacherDataMap.get(record.teacher);

        if (!teacherData) {
          console.warn(`Teacher data for ranking record ${record.id} (teacher ID: ${record.teacher}) not found.`);
          return;
        }
        
        processedTeacherIds.add(teacherData.id);
        let followersCountNum = 0;
        if (record.totalfollowing && !isNaN(parseInt(record.totalfollowing, 10))) {
          followersCountNum = parseInt(record.totalfollowing, 10);
        } else {
          followersCountNum = record.followed_by?.length || 0;
        }
        
        const isFollowed = currentUser?.id ? record.followed_by?.includes(currentUser.id) || false : false;
        let avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(teacherData.name?.charAt(0) || 'T')}&background=random&color=fff&size=128`;
        if (teacherData.profile_picture && teacherData.collectionId && teacherData.collectionName) {
          avatar = pb.files.getUrl(teacherData as RecordModel, teacherData.profile_picture as string);
        }

        processedTeachersTemp.push({
          id: teacherData.id,
          name: teacherData.name || 'Unnamed Teacher',
          avatarUrl: avatar,
          instituteName: teacherData.institute_name,
          subjectsOffered: teacherData.subjects_offered || [],
          teacherFavExams: Array.isArray(teacherData.favExam) ? teacherData.favExam : (teacherData.favExam ? [teacherData.favExam] : []),
          level: teacherData.level as DisplayTeacher['level'],
          followersCount: followersCountNum,
          isFollowedByCurrentUser: isFollowed,
          teacherRankingRecordId: record.id,
          overallRank: 0, // Will be set after sorting
          followed_by_from_ranking_record: record.followed_by || [],
          totalfollowing_from_db: record.totalfollowing,
          EduNexus_Name: teacherData.EduNexus_Name,
        });
      });

      allTeacherDataRecords.forEach(teacherData => {
        if (!processedTeacherIds.has(teacherData.id)) {
          let avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(teacherData.name?.charAt(0) || 'T')}&background=random&color=fff&size=128`;
          if (teacherData.profile_picture && teacherData.collectionId && teacherData.collectionName) {
            avatar = pb.files.getUrl(teacherData as RecordModel, teacherData.profile_picture as string);
          }
          processedTeachersTemp.push({
            id: teacherData.id,
            name: teacherData.name || 'Unnamed Teacher',
            avatarUrl: avatar,
            instituteName: teacherData.institute_name,
            subjectsOffered: teacherData.subjects_offered || [],
            teacherFavExams: Array.isArray(teacherData.favExam) ? teacherData.favExam : (teacherData.favExam ? [teacherData.favExam] : []),
            level: teacherData.level as DisplayTeacher['level'],
            followersCount: 0, 
            isFollowedByCurrentUser: false, 
            teacherRankingRecordId: `CREATE_RANKING_FOR_${teacherData.id}`,
            overallRank: 0, // Will be set after sorting
            followed_by_from_ranking_record: [],
            totalfollowing_from_db: "0",
            EduNexus_Name: teacherData.EduNexus_Name,
          });
        }
      });

      if (!isMountedChecker()) return;

      const finalTeachersToDisplay = processedTeachersTemp
        .sort((a, b) => b.followersCount - a.followersCount)
        .map((teacher, index) => ({ ...teacher, overallRank: index + 1, isFollowedByCurrentUser: currentUser?.id ? (teacher.followed_by_from_ranking_record?.includes(currentUser.id) || false) : false }));
      
      if (isMountedChecker()) setRankedTeachers(finalTeachersToDisplay);

    } catch (err) {
      if (isMountedChecker()) {
        const clientError = err as ClientResponseError;
        let errorMsg = `Error loading teacher data: ${clientError.data?.message || clientError.message || 'Unknown error'}.`;
        console.error("Error in loadData:", clientError);
        setError(errorMsg);
        setRankedTeachers([]);
        toast({ title: "Error", description: errorMsg, variant: "destructive", duration: 7000 });
      }
    } finally {
      if (isMountedChecker()) setIsLoading(false);
    }
  }, [authIsLoading, currentUser?.id, toast]);

  useEffect(() => {
    let isMounted = true;
    const componentIsMountedChecker = () => isMounted;
    
    loadData(componentIsMountedChecker);

    let unsubRankings: (() => void) | null = null;
    let unsubTeachers: (() => void) | null = null;

    // Only subscribe if user is logged in, as subscriptions might depend on auth state for rules
    if (currentUser?.id) {
      const subscribe = async () => {
        if (!componentIsMountedChecker()) return;
        try {
          unsubRankings = await pb.collection('teacher_ranking').subscribe('*', (e) => {
            if (componentIsMountedChecker()) {
              console.log('Teacher ranking subscription event:', e.action, e.record.id);
              loadData(componentIsMountedChecker);
            }
          });
        } catch (subErr) { if(componentIsMountedChecker()) console.error("Failed to subscribe to teacher_ranking:", subErr); }

        if (!componentIsMountedChecker()) return;
        try {
          unsubTeachers = await pb.collection('teacher_data').subscribe('*', (e) => {
             if (componentIsMountedChecker() && (e.action === 'create' || e.action === 'delete' || (e.action === 'update' && (e.record.name !== undefined || e.record.profile_picture !== undefined || e.record.institute_name !== undefined)))) {
              console.log('Teacher data subscription event:', e.action, e.record.id);
              loadData(componentIsMountedChecker);
            }
          });
        } catch (subErr) { if(componentIsMountedChecker()) console.error("Failed to subscribe to teacher_data:", subErr); }
      };
      subscribe();
    } else { // if no user, still load data once without subscription
      loadData(componentIsMountedChecker);
    }


    return () => {
      isMounted = false;
      if (unsubRankings) unsubRankings();
      if (unsubTeachers) unsubTeachers();
    };
  }, [currentUser?.id, loadData]); // loadData is memoized

  const handleFollowToggle = async (teacherToToggle: DisplayTeacher) => {
    if (!currentUser) {
      toast({ title: "Login Required", description: "Please login to follow teachers.", variant: "destructive" });
      return;
    }
    if (updatingFollowId) return;

    setUpdatingFollowId(teacherToToggle.id);

    const isCreatingNewRankingRecord = teacherToToggle.teacherRankingRecordId.startsWith('CREATE_RANKING_FOR_');
    const actualTeacherIdForRanking = isCreatingNewRankingRecord
        ? teacherToToggle.teacherRankingRecordId.replace('CREATE_RANKING_FOR_', '')
        : teacherToToggle.id;

    try {
        let newFollowerCount = 0;
        let updatedFollowedByList: string[];

        if (isCreatingNewRankingRecord) {
            if (teacherToToggle.isFollowedByCurrentUser) { // Should not happen logically if creating
                toast({ title: "Error", description: "Cannot unfollow a teacher not yet in rankings.", variant: "destructive" });
                setUpdatingFollowId(null);
                return;
            }
            updatedFollowedByList = [currentUser.id];
            newFollowerCount = 1;
            await pb.collection('teacher_ranking').create<TeacherRankingRecord>({
                teacher: actualTeacherIdForRanking,
                followed_by: updatedFollowedByList,
                ranking: 0, // Initial ranking, can be updated by a background process
                totalfollowing: String(newFollowerCount),
            });
            toast({ title: "Followed", description: `You are now following ${teacherToToggle.name}.` });
        } else {
            const currentFollowedByArray = teacherToToggle.followed_by_from_ranking_record || [];
            if (teacherToToggle.isFollowedByCurrentUser) { // Currently following, so unfollow
                updatedFollowedByList = currentFollowedByArray.filter(id => id !== currentUser.id);
            } else { // Not following, so follow
                updatedFollowedByList = [...currentFollowedByArray, currentUser.id];
            }
            newFollowerCount = updatedFollowedByList.length;
            await pb.collection('teacher_ranking').update(teacherToToggle.teacherRankingRecordId, {
                followed_by: updatedFollowedByList,
                totalfollowing: String(newFollowerCount),
            });
            toast({
                title: teacherToToggle.isFollowedByCurrentUser ? "Unfollowed" : "Followed",
                description: `You are ${teacherToToggle.isFollowedByCurrentUser ? "no longer following" : "now following"} ${teacherToToggle.name}.`,
            });
        }
        // loadData will be triggered by subscription, or call it manually if subscriptions are off for non-logged-in
        if (!currentUser?.id) loadData(() => true);

    } catch (err: any) {
      const clientError = err as ClientResponseError;
      console.error("Failed to update follow status:", clientError);
      toast({
        title: "Error",
        description: `Could not update follow status for ${teacherToToggle.name}. Error: ${clientError.data?.message || clientError.message}`,
        variant: "destructive",
      });
    } finally {
      setUpdatingFollowId(null);
    }
  };


  const getAvatarFallback = (name: string) => {
    const nameParts = name.split(' ');
    return nameParts.length > 1 ? nameParts[0][0] + nameParts[nameParts.length - 1][0] : name.substring(0, 2).toUpperCase();
  };

  const renderTeacherCard = (teacher: DisplayTeacher, isTopThreeCard: boolean = false, variant: 'card' | 'listItem' = 'card') => {
    if (variant === 'listItem') {
      return (
        <Card 
          key={teacher.id} 
          className={cn(
            "shadow-sm hover:shadow-md transition-shadow duration-200 w-full rounded-lg border",
            isTopThreeCard && teacher.overallRank <= 3 ? "border-amber-400 bg-amber-50/30 dark:bg-amber-900/10" : "border-border bg-card"
          )}
        >
          <CardContent className="p-3 sm:p-4 flex items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4 flex-grow min-w-0">
              <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-primary/30">
                <AvatarImage src={teacher.avatarUrl} alt={teacher.name} data-ai-hint="teacher portrait" />
                <AvatarFallback>{getAvatarFallback(teacher.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm sm:text-base font-semibold text-foreground truncate" title={teacher.name}>
                  {isTopThreeCard && teacher.overallRank <= 3 && <Star className="inline h-4 w-4 mr-1.5 text-amber-500 fill-amber-400" />}
                  {teacher.name}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate" title={teacher.instituteName || teacher.EduNexus_Name}>
                  {teacher.instituteName || teacher.EduNexus_Name || 'Independent Educator'}
                </p>
                <p className="text-xs text-muted-foreground">Followers: {teacher.followersCount} <span className="ml-1">| Rank: #{teacher.overallRank}</span></p>
              </div>
            </div>
            <Button
              variant={teacher.isFollowedByCurrentUser ? "outline" : "default"}
              size="sm"
              onClick={(e) => { e.preventDefault(); handleFollowToggle(teacher); }}
              disabled={updatingFollowId === teacher.id || !currentUser}
              className={cn(
                "transition-all duration-200 px-3 py-1.5 text-xs sm:text-sm rounded-full flex-shrink-0",
                teacher.isFollowedByCurrentUser 
                  ? "border-green-500 text-green-600 hover:bg-green-500/10 bg-transparent"
                  : "bg-primary hover:bg-primary/90"
              )}
            >
              {updatingFollowId === teacher.id ? <Loader2 className="h-4 w-4 animate-spin" /> :
              teacher.isFollowedByCurrentUser ? <><UserCheck className="mr-1.5 h-4 w-4" />Following</> : <><UserPlus className="mr-1.5 h-4 w-4" />Follow</>}
            </Button>
          </CardContent>
        </Card>
      );
    }
    // 'card' variant for carousel
    return (
      <Card 
        key={teacher.id} 
        className={cn(
          "shadow-xl hover:shadow-2xl transition-all duration-300 ease-in-out group bg-card overflow-hidden w-full rounded-xl border border-border/60 h-full flex flex-col",
          // Top three styling is primarily for the list items now, but can be adapted if needed for carousel too
        )}
      >
        <CardContent className="p-4 flex flex-col items-center text-center space-y-3 flex-grow">
           <p className={cn(
              "text-3xl font-bold group-hover:text-amber-400 transition-colors",
               "text-amber-500" 
            )}>
              #{teacher.overallRank}
            </p>
          <Avatar className="h-24 w-24 text-3xl border-4 border-primary/20 group-hover:border-primary/50 transition-all">
            <AvatarImage src={teacher.avatarUrl} alt={teacher.name} data-ai-hint="teacher portrait" />
            <AvatarFallback>{getAvatarFallback(teacher.name)}</AvatarFallback>
          </Avatar>

          <div>
            <CardTitle className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors" title={teacher.name}>
              {teacher.name}
            </CardTitle>
            <p className="text-sm text-muted-foreground" title={teacher.instituteName || teacher.EduNexus_Name}>
              {teacher.instituteName || teacher.EduNexus_Name || 'Independent Educator'}
            </p>
            {teacher.level && <Badge variant="outline" className="text-xs mt-1.5 bg-muted text-muted-foreground">{teacher.level}</Badge>}
          </div>

          <div className="w-full max-w-xs space-y-3 pt-4 border-t border-border/30">
            {(teacher.subjectsOffered && teacher.subjectsOffered.length > 0) && (
              <div className="text-left">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">SUBJECTS OFFERED</h4>
                <div className="flex flex-wrap gap-1.5 justify-start">
                  {teacher.subjectsOffered.map(subject => (
                    <Badge key={subject} variant="secondary" className="text-xs px-2 py-0.5">{subject}</Badge>
                  ))}
                </div>
              </div>
            )}
            {(teacher.teacherFavExams && teacher.teacherFavExams.length > 0) && (
              <div className="text-left">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">OFFERING EXAM</h4>
                <div className="flex flex-wrap gap-1.5 justify-start">
                  {teacher.teacherFavExams.map(exam => (
                    <Badge key={exam} variant="outline" className="text-xs px-2 py-0.5 border-primary/40 text-primary/90">{exam}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="p-4 flex flex-col items-center gap-2 mt-auto border-t border-border/30 w-full">
            <div className="text-center">
                <p className="text-lg font-bold text-primary">{teacher.followersCount}</p>
                <p className="text-xs text-muted-foreground -mt-0.5">Followers</p>
            </div>
            <Button
                variant={teacher.isFollowedByCurrentUser ? "outline" : "default"}
                size="sm"
                onClick={(e) => { e.preventDefault(); handleFollowToggle(teacher); }}
                disabled={updatingFollowId === teacher.id || !currentUser}
                className={cn(
                  "transition-all duration-200 px-6 py-2 text-sm w-auto rounded-full",
                  teacher.isFollowedByCurrentUser 
                    ? "border-green-500 text-green-600 hover:bg-green-500/10 bg-background"
                    : "bg-primary hover:bg-primary/90"
                )}
            >
                {updatingFollowId === teacher.id ? <Loader2 className="h-4 w-4 animate-spin" /> :
                teacher.isFollowedByCurrentUser ? <><UserCheck className="mr-1.5 h-4 w-4" />Following</> : <><UserPlus className="mr-1.5 h-4 w-4" />Follow</>}
            </Button>
        </CardFooter>
      </Card>
    );
  };

  const followedTeachersList = useMemo(() => rankedTeachers.filter(t => t.isFollowedByCurrentUser), [rankedTeachers]);
  const currentFollowedTeacher = followedTeachersList[currentFollowedTeacherIndex];

  const discoverTeachersFilteredByName = useMemo(() => {
    return rankedTeachers.filter(teacher => {
      const searchTermLower = discoverSearchTerm.toLowerCase();
      return (
        teacher.name.toLowerCase().includes(searchTermLower) ||
        (teacher.instituteName && teacher.instituteName.toLowerCase().includes(searchTermLower)) ||
        (teacher.EduNexus_Name && teacher.EduNexus_Name.toLowerCase().includes(searchTermLower))
      );
    });
  }, [rankedTeachers, discoverSearchTerm]);

  const totalDiscoverPages = Math.ceil(discoverTeachersFilteredByName.length / DISCOVER_ITEMS_PER_PAGE);
  const paginatedDiscoverTeachers = useMemo(() => {
    const startIndex = (discoverCurrentPage - 1) * DISCOVER_ITEMS_PER_PAGE;
    return discoverTeachersFilteredByName.slice(startIndex, startIndex + DISCOVER_ITEMS_PER_PAGE);
  }, [discoverTeachersFilteredByName, discoverCurrentPage]);


  useEffect(() => {
    setCurrentFollowedTeacherIndex(0); // Reset when followed list changes externally
  }, [followedTeachersList.length]);

  const handleNextFollowedTeacher = () => {
    setCurrentFollowedTeacherIndex(prev => Math.min(followedTeachersList.length - 1, prev + 1));
  };

  const handlePreviousFollowedTeacher = () => {
    setCurrentFollowedTeacherIndex(prev => Math.max(0, prev - 1));
  };

  const handleDiscoverPageChange = (newPage: number) => {
    setDiscoverCurrentPage(newPage);
  };


  if (isLoading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Skeleton className="h-10 w-1/3 mb-4" />
        <Skeleton className="h-8 w-2/3 mb-6" />
        <div className="relative mb-6">
             <Skeleton className="h-96 w-full rounded-xl" />
             <Skeleton className="absolute top-1/2 -translate-y-1/2 left-2 sm:left-4 h-10 w-10 rounded-full" />
             <Skeleton className="absolute top-1/2 -translate-y-1/2 right-2 sm:right-4 h-10 w-10 rounded-full" />
        </div>
        <Skeleton className="h-10 w-full md:w-1/2 mb-4" /> {/* Search Box Skeleton */}
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="p-3 w-full">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-grow space-y-2">
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
                <Skeleton className="h-8 w-24 rounded-full" />
              </div>
            </Card>
          ))}
        </div>
        <div className="flex justify-between items-center mt-4"> {/* Pagination Skeleton */}
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-2 sm:p-4 md:p-6">
      <Card className="shadow-lg border-primary border-t-4">
        <CardHeader>
          <CardTitle className="text-2xl md:text-3xl font-bold text-foreground flex items-center">
            <Award className="mr-3 h-7 w-7 text-primary" /> Teacher Ranking
          </CardTitle>
          <CardDescription>
            Discover top educators on {AppConfig.appName} and follow your favorites.
          </CardDescription>
        </CardHeader>
      </Card>

      {error && (
        <Card className="text-center p-6 bg-destructive/10 border-destructive">
          <ShieldAlert className="mx-auto h-10 w-10 text-destructive mb-3" />
          <CardTitle className="text-destructive">Error Loading Rankings</CardTitle>
          <CardDescription className="text-destructive/80 whitespace-pre-wrap">{error}</CardDescription>
        </Card>
      )}

      {!error && !isLoading && (
        <>
          <section>
            <h2 className="text-xl font-semibold mb-4 text-primary flex items-center gap-2">
                <Star className="text-yellow-500 fill-yellow-400"/> Teachers You Follow
            </h2>
            {followedTeachersList.length > 0 && currentFollowedTeacher ? (
              <div className="relative group/carousel md:px-12 lg:px-16">
                {renderTeacherCard(currentFollowedTeacher, false, 'card')}
                {followedTeachersList.length > 1 && (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handlePreviousFollowedTeacher}
                      disabled={currentFollowedTeacherIndex === 0}
                      className="absolute top-1/2 -translate-y-1/2 left-0 sm:left-1 md:left-2 transform opacity-50 group-hover/carousel:opacity-100 focus:opacity-100 transition-opacity duration-200 rounded-full shadow-lg bg-background/70 hover:bg-background border-primary/30 hover:border-primary text-primary h-10 w-10 sm:h-12 sm:w-12 z-10"
                      aria-label="Previous followed teacher"
                    >
                      <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleNextFollowedTeacher}
                      disabled={currentFollowedTeacherIndex === followedTeachersList.length - 1}
                      className="absolute top-1/2 -translate-y-1/2 right-0 sm:right-1 md:right-2 transform opacity-50 group-hover/carousel:opacity-100 focus:opacity-100 transition-opacity duration-200 rounded-full shadow-lg bg-background/70 hover:bg-background border-primary/30 hover:border-primary text-primary h-10 w-10 sm:h-12 sm:w-12 z-10"
                      aria-label="Next followed teacher"
                    >
                      <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
                    </Button>
                  </>
                )}
                 <p className="text-center text-sm text-muted-foreground mt-3">
                    {currentFollowedTeacherIndex + 1} / {followedTeachersList.length}
                 </p>
              </div>
            ) : (
              <Card className="text-center p-6 border-dashed bg-card">
                <Users className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <CardTitle className="text-lg">You're Not Following Any Teachers Yet</CardTitle>
                <CardDescription>Discover and follow educators from the list below to see them here.</CardDescription>
              </Card>
            )}
          </section>

          <section className="mt-10">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-3">
                <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                    <TrendingUp className="text-green-500"/>
                    Discover Teachers
                </h2>
                <div className="relative w-full sm:w-auto sm:max-w-xs">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search teachers..."
                        className="pl-9"
                        value={discoverSearchTerm}
                        onChange={(e) => {
                            setDiscoverSearchTerm(e.target.value);
                            setDiscoverCurrentPage(1); // Reset to first page on new search
                        }}
                    />
                </div>
            </div>
            {paginatedDiscoverTeachers.length > 0 ? (
              <div className="space-y-3">
                {paginatedDiscoverTeachers.map(teacher => {
                    const isTopThreeGlobal = teacher.overallRank <= 3;
                    return renderTeacherCard(teacher, isTopThreeGlobal, 'listItem'); 
                })}
              </div>
            ) : (
                <Card className="text-center p-10 border-dashed bg-card">
                    <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <CardTitle>{discoverSearchTerm ? "No Teachers Found Matching Your Search" : "No Teachers Found"}</CardTitle>
                    <CardDescription>
                       {discoverSearchTerm ? "Try a different search term." : "We couldn't find any teachers listed at the moment. This might be because the 'teacher_ranking' and 'teacher_data' collections are empty or initial setup is in progress."}
                    </CardDescription>
                </Card>
            )}
            {totalDiscoverPages > 1 && (
              <div className="mt-6 flex justify-between items-center">
                <Button
                  variant="outline"
                  onClick={() => handleDiscoverPageChange(discoverCurrentPage - 1)}
                  disabled={discoverCurrentPage === 1}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" /> Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {discoverCurrentPage} of {totalDiscoverPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => handleDiscoverPageChange(discoverCurrentPage + 1)}
                  disabled={discoverCurrentPage === totalDiscoverPages}
                >
                  Next <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
    

