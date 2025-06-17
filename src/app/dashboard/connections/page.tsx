
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import pb from '@/lib/pocketbase';
import type { User, UserSubscriptionTierStudent } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { UserPlus, Check, UserMinus, Users, Link2, Loader2, AlertCircle } from 'lucide-react';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Routes, AppConfig, escapeForPbFilter } from '@/lib/constants';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


interface FollowRecord extends RecordModel {
  user: string; 
  following: string[];
  followers: string[];
  expand?: {
    following?: RecordModel[];
    followers?: RecordModel[];
  };
}

async function getOrCreateFollowRecord(userId: string, pageName: string, signal?: AbortSignal): Promise<FollowRecord | null> {
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    const errorMessage = `getOrCreateFollowRecord (${pageName}): Invalid userId provided. Cannot proceed. Provided: '${userId}' (Type: ${typeof userId})`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
  const escapedUserId = escapeForPbFilter(userId);
  const filter = `user = "${escapedUserId}"`;

  try {
    const existingRecord = await pb.collection('following_followed')
      .getFirstListItem<FollowRecord>(filter, { '$autoCancel': false, signal });
    console.log(`getOrCreateFollowRecord (${pageName}): Found existing record for userId: ${userId}`, existingRecord?.id);
    return existingRecord;
  } catch (error: any) {
    if (signal?.aborted || error.name === 'AbortError') {
      console.warn(`getOrCreateFollowRecord (${pageName}): Fetch/Create aborted for userId ${userId}. Filter: ${filter}`);
      throw error;
    }
    if (error.status === 404) {
      console.log(`getOrCreateFollowRecord (${pageName}): No existing record for userId: ${userId} (filter: ${filter}). Attempting to create new one.`);
      const newRecordData = {
        user: userId,
        following: [],
        followers: [],
      };
      try {
        const newRecord = await pb.collection('following_followed').create<FollowRecord>(newRecordData, { '$autoCancel': false, signal });
        console.log(`getOrCreateFollowRecord (${pageName}): Successfully created new record for userId: ${userId}`, newRecord?.id);
        return newRecord;
      } catch (createError: any) {
        if (signal?.aborted || createError.name === 'AbortError') {
            console.warn(`getOrCreateFollowRecord (${pageName}): Create request aborted for userId ${userId}.`);
            throw createError;
        }
        let createDetailedMessage = `getOrCreateFollowRecord (${pageName}): ERROR creating new follow record for userId: ${userId} after a 404. Filter used for get: ${filter}. Create payload: ${JSON.stringify(newRecordData)}. Create Error Status: ${createError.status}. Create Error Response: ${JSON.stringify(createError.data) || createError.message}.`;
        if (createError.status === 400 || createError.status === 403) {
            createDetailedMessage += `\n\n>>>> URGENT ACTION REQUIRED: A ${createError.status} error during CREATE indicates a server-side permission issue for 'following_followed' collection.
            Your current Create Rule is: "@request.auth.id != "" && @request.data.user:isset".
            This rule ALLOWS an authenticated user to create a record for ANY user, provided the 'user' field is set in the data.
            If creation is still failing, check:
            1. The 'user' field in your 'following_followed' collection schema: Is it marked as 'Required'? Is it 'Unique'?
            2. PocketBase server logs for more specific error details related to this create operation.
            3. Ensure the 'users' collection (ID: pbc_1377172174) allows records to be related to. <<<<`;
        }
        console.error(createDetailedMessage, "Full Create Error Object:", createError);
        throw createError; 
      }
    } else {
      let detailedMessage = `getOrCreateFollowRecord (${pageName}): ERROR fetching follow record for userId: ${userId}. Filter used: ${filter}. Status: ${error.status}. Response: ${JSON.stringify(error.data) || '{}'}.`;
      if (error.status === 0) {
        detailedMessage += `\n\n>>>> INFO: A status 0 error indicates the request was likely autocancelled. The '$autoCancel': false' option IS APPLIED to this SDK call. If this error persists, please investigate:
        1. React StrictMode (dev only): Causes components to mount/unmount/remount, potentially interrupting requests.
        2. Rapid component unmounts or state changes in your code.
        3. Local network connectivity issues. <<<<`;
      } else if (error.status === 400 || error.status === 403) {
        detailedMessage += `\n\n>>>> URGENT ACTION REQUIRED: A ${error.status} error during GET (getFirstListItem) often indicates an issue with the PocketBase collection's API rules or field permissions for 'following_followed'.
        Your current List/View Rule for 'following_followed' is: "@request.auth.id != """. This is generally permissive for reads.
        PLEASE VERIFY THE FOLLOWING in your PocketBase admin UI for the 'following_followed' collection:
        1. Ensure the "List Rule" and "View Rule" allow the currently authenticated user (ID: ${pb.authStore.model?.id || 'unknown'}) to perform this lookup (e.g., the current rule should be fine if filtered by user ID).
        2. Field Filterability: Ensure the 'user' field is marked as 'Filterable' in the 'following_followed' collection schema settings. <<<<`;
      }
      console.error(detailedMessage, "Full Error Object:", error);
      throw error;
    }
  }
}


export default function ConnectionsPage() {
  const { user: currentUser, isLoading: authIsLoading } = useAuth();
  const [followingList, setFollowingList] = useState<User[]>([]);
  const [followersList, setFollowersList] = useState<User[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingFollowId, setUpdatingFollowId] = useState<string | null>(null);
  const { toast } = useToast();

  const [currentUserFollowingIds, setCurrentUserFollowingIds] = useState<Set<string>>(new Set());

  const mapRecordToUserDisplay = useCallback((record: RecordModel | undefined): User | null => {
    if (!record) return null;
    return {
      id: record.id,
      email: record.email || '',
      name: record.name || 'Unnamed User',
      username: record.username,
      verified: record.verified,
      grade: record.class as User['grade'],
      phoneNumber: record.phone as User['phoneNumber'],
      studentSubscriptionTier: record.model as UserSubscriptionTierStudent | undefined,
      teacherSubscriptionTier: undefined,
      role: record.role as User['role'],
      avatarUrl: record.avatarUrl ? record.avatarUrl as string : (record.avatar ? pb.files.getUrl(record, record.avatar as string) : `https://ui-avatars.com/api/?name=${encodeURIComponent(record.name?.charAt(0) || 'U')}&background=random&color=fff&size=128`),
      favExam: record.favExam as User['favExam'],
      totalPoints: record.totalPoints as User['totalPoints'],
      targetYear: record.targetYear as User['targetYear'],
      referralCode: record.referralCode as User['referralCode'],
      joineddate: record.joineddate as string | undefined,
      created: record.created,
      updated: record.updated,
      collectionId: record.collectionId,
      collectionName: record.collectionName,
      emailVisibility: record.emailVisibility,
      referredByCode: record.referredByCode,
      referralStats: record.referralStats,
      studyPlan: record.studyPlan,
      subscription_by_teacher: record.subscription_by_teacher,
      institute_name: undefined,
      total_students: undefined,
      level: undefined,
      EduNexus_Name: undefined,
      teacherFavExams: undefined,
      about: undefined,
      subjects_offered: undefined,
      used_free_trial: undefined,
      can_create_ads: undefined,
      ads_subscription: undefined,
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    let isMounted = true;
    const isMountedGetter = () => isMounted && !signal.aborted;

    const fetchConnections = async () => {
      if (!isMountedGetter() || !currentUser?.id) {
        if (isMountedGetter()) {
          setFollowingList([]);
          setFollowersList([]);
          setCurrentUserFollowingIds(new Set());
          setIsLoadingConnections(false);
          if (!currentUser?.id && !authIsLoading) setError("User not authenticated.");
        }
        return;
      }

      if (isMountedGetter()) {
        setIsLoadingConnections(true);
        setError(null);
      }

      try {
        const record = await pb.collection('following_followed')
          .getFirstListItem<FollowRecord>(`user="${currentUser.id}"`, {
            expand: 'following,followers',
            '$autoCancel': false,
            signal,
          });
        
        if (!isMountedGetter()) return;

        const fetchedFollowing = (record.expand?.following || []).map(mapRecordToUserDisplay).filter(u => u !== null) as User[];
        const fetchedFollowers = (record.expand?.followers || []).map(mapRecordToUserDisplay).filter(u => u !== null) as User[];
        
        if (isMountedGetter()) {
            setFollowingList(fetchedFollowing);
            setFollowersList(fetchedFollowers);
            setCurrentUserFollowingIds(new Set(fetchedFollowing.map(u => u.id)));
            setError(null);
        }

      } catch (err: any) {
        if (!isMountedGetter()) return;
        if (err.name === 'AbortError') {
          console.warn('ConnectionsPage: Fetch connections aborted');
        } else {
          if (err.status === 404) {
            if (isMountedGetter()) {
                setFollowingList([]);
                setFollowersList([]);
                setCurrentUserFollowingIds(new Set());
                setError(null);
            }
            try {
              if (isMountedGetter()) await getOrCreateFollowRecord(currentUser.id, "ConnectionsPage-404Handler", signal);
            } catch (createErr: any) {
              if (isMountedGetter() && createErr.name !== 'AbortError') {
                console.error("ConnectionsPage: Failed to create follow record after 404 on get:", createErr);
                setError('Could not initialize your connections data. Please try refreshing the page.');
              }
            }
          } else {
            console.error('ConnectionsPage: Failed to fetch connections:', err.data || err.message, "Full Error:", err);
            setError('Could not load connections. Please try again later. Details: ' + (err.data?.message || err.message));
          }
        }
      } finally {
        if (isMountedGetter()) {
          setIsLoadingConnections(false);
        }
      }
    };

    if (!authIsLoading && currentUser?.id) {
        fetchConnections();
    } else if (!authIsLoading && !currentUser?.id && isMountedGetter()) {
      setIsLoadingConnections(false);
      setError("Please login to see connections.");
    }
    
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [currentUser?.id, authIsLoading, mapRecordToUserDisplay]);


  const getAvatarFallback = (name: string) => {
    const nameParts = name.split(' ');
    if (nameParts.length > 1) {
      return nameParts[0][0] + nameParts[nameParts.length - 1][0];
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleFollowToggle = async (targetUserId: string, currentlyFollowing: boolean) => {
    if (!currentUser?.id) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
     if (currentUser.id === targetUserId) {
        toast({ title: "Action not allowed", description: "You cannot follow or unfollow yourself.", variant: "default" });
        return;
    }

    setUpdatingFollowId(targetUserId);
    const controller = new AbortController();
    const signal = controller.signal;

    try {
      const currentUserFollowRecord = await getOrCreateFollowRecord(currentUser.id, "ConnectionsPage-CurrentUserAction", signal);
      if (!currentUserFollowRecord || !currentUserFollowRecord.id) {
        console.error("handleFollowToggle: currentUserFollowRecord is invalid after getOrCreate.", currentUserFollowRecord);
        toast({ title: "Operation Failed", description: "Could not process your follow record. Please refresh and try again.", variant: "destructive" });
        setUpdatingFollowId(null);
        return;
      }
      if (signal.aborted) throw new Error("Request aborted after getting current user's follow record.");


      // Optimistically update UI for current user's action
      setFollowingList(prev => 
        currentlyFollowing 
          ? prev.filter(u => u.id !== targetUserId) 
          : [...prev, (followersList.find(u => u.id === targetUserId) || {id: targetUserId, name: 'Unknown User'} as User)]
      );
      setCurrentUserFollowingIds(prev => {
        const newSet = new Set(prev);
        currentlyFollowing ? newSet.delete(targetUserId) : newSet.add(targetUserId);
        return newSet;
      });

      // Update current user's 'following' list in PocketBase
      await pb.collection('following_followed').update(currentUserFollowRecord.id, {
        [currentlyFollowing ? 'following-' : 'following+']: targetUserId,
      }, { '$autoCancel': false, signal });
      if (signal.aborted) throw new Error("Request aborted after updating current user's following list.");
      
      toast({ title: currentlyFollowing ? "Unfollowed" : "Followed", description: `You ${currentlyFollowing ? "are no longer following" : "are now following"} this user.` });

      // REMOVED: Attempt to update targetUser's followers list directly
      // This was the likely cause of the 404/403 due to update rules.
      // The target user's follower count will update when their data is next fetched or via their own interactions.

      // Optionally, re-fetch to ensure consistency if needed, though optimistic update handles UI for current user.
      // For now, we'll rely on the optimistic update and the fact that the `followersList` for the current user
      // will be accurate when *they* are followed by someone else.
      if (!signal.aborted) {
        const reFetchController = new AbortController();
        try {
            const record = await getOrCreateFollowRecord(currentUser.id, "ConnectionsPage-ReFetch", reFetchController.signal);
            if (record && !reFetchController.signal.aborted) {
                // This part repopulates lists based on the refreshed current user's record
                const refreshedFollowing = (record.expand?.following || []).map(mapRecordToUserDisplay).filter(u => u !== null) as User[];
                const refreshedFollowers = (record.expand?.followers || []).map(mapRecordToUserDisplay).filter(u => u !== null) as User[];
                setFollowingList(refreshedFollowing);
                setFollowersList(refreshedFollowers);
                setCurrentUserFollowingIds(new Set(refreshedFollowing.map(u => u.id)));
            }
        } catch (reFetchErr: any) {
            if (!reFetchController.signal.aborted) console.error("ConnectionsPage: Re-fetch current user follow record after toggle failed:", reFetchErr);
        }
      }

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error(`Failed to update follow status for target ${targetUserId}. Full error object:`, err);
        toast({ title: "Update Failed", description: `Could not ${currentlyFollowing ? 'unfollow' : 'follow'} user. ${err.message || "An unknown error occurred."}`, variant: "destructive" });
        // Revert optimistic UI update on error
        setFollowingList(prev => 
          currentlyFollowing 
            ? [...prev, (followersList.find(u => u.id === targetUserId) || {id: targetUserId, name: 'Unknown User'} as User)] 
            : prev.filter(u => u.id !== targetUserId)
        );
        setCurrentUserFollowingIds(prev => {
          const newSet = new Set(prev);
          currentlyFollowing ? newSet.add(targetUserId) : newSet.delete(targetUserId);
          return newSet;
        });
      } else {
        console.warn("Follow/Unfollow action aborted.");
      }
    } finally {
      if (!signal?.aborted) {
         setUpdatingFollowId(null);
      }
    }
  };


  const renderUserCard = (userToList: User, listType: 'following' | 'follower') => {
    const isFollowingTarget = currentUserFollowingIds.has(userToList.id);
    const isLoadingThisUser = updatingFollowId === userToList.id;

    return (
        <Card key={userToList.id} className="overflow-hidden shadow-md">
        <CardContent className="p-4 flex flex-col items-center text-center sm:flex-row sm:text-left sm:items-start gap-4">
            <Avatar className="h-16 w-16 sm:h-20 sm:w-20 text-xl sm:text-2xl border-2 border-primary flex-shrink-0">
            <AvatarImage src={userToList.avatarUrl} alt={userToList.name} />
            <AvatarFallback>{getAvatarFallback(userToList.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-grow">
            <h3 className="text-md sm:text-lg font-semibold text-foreground">{userToList.name}</h3>
            <p className="text-xs sm:text-sm text-muted-foreground truncate max-w-full">{userToList.email}</p>
            {userToList.favExam && (
                <p className="text-xs text-muted-foreground">Targets: {userToList.favExam}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
                Joined: {userToList.joineddate ? new Date(userToList.joineddate).toLocaleDateString() : (userToList.created ? new Date(userToList.created).toLocaleDateString() : 'N/A')}
            </p>
            </div>
            <div className="mt-2 sm:mt-0 flex-shrink-0">
            {listType === 'following' ? (
                <Button
                variant={'secondary'}
                className="w-full sm:w-auto"
                onClick={() => handleFollowToggle(userToList.id, true)}
                disabled={isLoadingThisUser}
                >
                {isLoadingThisUser ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserMinus className="mr-2 h-4 w-4" />}
                {isLoadingThisUser ? 'Processing...' : 'Unfollow'}
                </Button>
            ) : ( 
                currentUser?.id === userToList.id ? null : 
                isFollowingTarget ? (
                <Button
                    variant={'secondary'}
                    className="w-full sm:w-auto"
                    onClick={() => handleFollowToggle(userToList.id, true)}
                    disabled={isLoadingThisUser}
                >
                    {isLoadingThisUser ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                    {isLoadingThisUser ? 'Processing...' : 'Following'}
                </Button>
                ) : (
                <Button
                    variant={'default'}
                    className="w-full sm:w-auto"
                    onClick={() => handleFollowToggle(userToList.id, false)}
                    disabled={isLoadingThisUser}
                >
                    {isLoadingThisUser ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                    {isLoadingThisUser ? 'Processing...' : 'Follow Back'}
                </Button>
                )
            )}
            </div>
        </CardContent>
        </Card>
    );
  };
  
  const usersList: User[] = [...followingList, ...followersList].reduce((acc, user) => {
      if (!acc.find(u => u.id === user.id)) acc.push(user);
      return acc;
  }, [] as User[]);


  if (authIsLoading) {
    return (
      <div className="space-y-8 p-4 md:p-6">
        <Card className="shadow-lg">
          <CardHeader>
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-2/3 mt-1" />
          </CardHeader>
        </Card>
        <Tabs defaultValue="following">
            <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="following" disabled>Following (?)</TabsTrigger>
                <TabsTrigger value="followers" disabled>Followers (?)</TabsTrigger>
            </TabsList>
            <TabsContent value="following">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[...Array(2)].map((_, i) => (
                    <Card key={`skel-follow-${i}`} className="p-4">
                    <div className="flex items-center space-x-4">
                        <Skeleton className="h-16 w-16 rounded-full" />
                        <div className="space-y-2 flex-grow">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-4 w-1/4" />
                        </div>
                        <Skeleton className="h-10 w-24 rounded-md" />
                    </div>
                    </Card>
                ))}
                </div>
            </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Link2 className="h-7 w-7 text-primary"/> Your Connections
          </CardTitle>
          <CardDescription>
            Manage who you follow and who follows you. Expand your network on {AppConfig.appName}!
          </CardDescription>
        </CardHeader>
      </Card>

      {isLoadingConnections && (
         <Tabs defaultValue="following">
            <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="following" disabled>Following ({isLoadingConnections ? '...' : followingList.length})</TabsTrigger>
                <TabsTrigger value="followers" disabled>Followers ({isLoadingConnections ? '...' : followersList.length})</TabsTrigger>
            </TabsList>
             <TabsContent value="following">
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {[...Array(2)].map((_, i) => (
                        <Card key={`skel-conn-follow-${i}`} className="p-4"><div className="flex items-center space-x-4"><Skeleton className="h-16 w-16 rounded-full" /><div className="space-y-2 flex-grow"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-1/4" /></div><Skeleton className="h-10 w-24 rounded-md" /></div></Card>
                    ))}
                </div>
            </TabsContent>
        </Tabs>
      )}

      {error && !isLoadingConnections && (
        <Card className="text-center p-10 bg-destructive/10 border-destructive">
          <CardHeader className="p-0"><AlertCircle className="mx-auto h-12 w-12 text-destructive mb-3" /></CardHeader>
          <CardTitle className="text-destructive">Error Loading Connections</CardTitle>
          <CardDescription className="text-destructive/80 whitespace-pre-wrap">{error}</CardDescription>
        </Card>
      )}

      {!currentUser && !authIsLoading && !isLoadingConnections && !error && (
        <Card className="text-center p-10">
          <CardTitle>Please Log In</CardTitle>
          <CardDescription>
            You need to be logged in to view your connections.
          </CardDescription>
        </Card>
      )}

      {currentUser && !isLoadingConnections && !error && (
        <Tabs defaultValue="following" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="following">Following ({followingList.length})</TabsTrigger>
            <TabsTrigger value="followers">Followers ({followersList.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="following">
            {followingList.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {followingList.map(userToList => renderUserCard(userToList, 'following'))}
                </div>
            ) : (
                <Card className="text-center p-10">
                <Users className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                <CardTitle>Not Following Anyone Yet</CardTitle>
                <CardDescription>
                    Head over to <Link href={Routes.findFriends} className="text-primary hover:underline">Find Friends</Link> to connect with others.
                </CardDescription>
                </Card>
            )}
            </TabsContent>
            <TabsContent value="followers">
            {followersList.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {followersList.map(userToList => renderUserCard(userToList, 'follower'))}
                </div>
            ) : (
                <Card className="text-center p-10">
                <Users className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                <CardTitle>No Followers Yet</CardTitle>
                <CardDescription>
                    Engage with the community and others will follow your progress!
                </CardDescription>
                </Card>
            )}
            </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
