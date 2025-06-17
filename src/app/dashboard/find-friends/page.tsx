
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import pb from '@/lib/pocketbase';
import type { User, UserSubscriptionTierStudent } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { UserPlus, Check, Search, Loader2, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import { useToast } from '@/hooks/use-toast';
import { AppConfig, escapeForPbFilter, Routes } from '@/lib/constants';

interface FollowRecord extends RecordModel {
  user: string;
  following: string[];
  followers: string[];
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
            BLANK API RULES for 'Base' type collections default to ADMIN-ONLY access. You MUST set appropriate API rules in your PocketBase Admin UI.
            PLEASE VERIFY THE FOLLOWING:
            1. "Create Rule": MUST NOT BE BLANK. Set it to allow the authenticated user to create their own record (e.g., '@request.auth.id != "" && @request.data.user:isset && @request.data.user = @request.auth.id').
            2. Required Fields: Ensure 'user' field is correctly provided. <<<<`;
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
        BLANK API RULES for 'Base' type collections (like 'following_followed') default to ADMIN-ONLY access. You MUST set appropriate API rules in your PocketBase Admin UI.
        PLEASE VERIFY THE FOLLOWING in your PocketBase admin UI for the 'following_followed' collection:
        1. "List Rule": Ensure it allows the currently authenticated user (ID: ${pb.authStore.model?.id || 'unknown'}) to perform this lookup (e.g., '@request.auth.id != "" && user = @request.auth.id').
        2. Field Filterability: Ensure the 'user' field is marked as 'Filterable'. <<<<`;
      }
      console.error(detailedMessage, "Full Error Object:", error);
      throw error;
    }
  }
}

export default function FindFriendsPage() {
  const { user: currentUser, isLoading: authIsLoading } = useAuth();
  const [usersList, setUsersList] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followingStatus, setFollowingStatus] = useState<Record<string, boolean>>({});
  const [updatingFollowId, setUpdatingFollowId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

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

    const fetchInitialData = async () => {
      if (!isMountedGetter() || !currentUser?.id) {
        if (isMountedGetter()) {
          setUsersList([]);
          setFollowingStatus({});
          setIsLoadingUsers(false);
          if (!currentUser?.id && !authIsLoading) setError("User not authenticated.");
        }
        return;
      }

      if (isMountedGetter()) {
        setIsLoadingUsers(true);
        setError(null);
      }

      try {
        let currentUserFollowRecord: FollowRecord | null = null;
        try {
          if (isMountedGetter()) currentUserFollowRecord = await getOrCreateFollowRecord(currentUser.id, "FindFriendsPage-CurrentUser", signal);
        } catch (followRecordError: any) {
          if (!isMountedGetter()) return;
          if (followRecordError.name !== 'AbortError') {
            console.warn("FindFriendsPage: Could not fetch/create current user's follow record. Follow statuses might be inaccurate.", followRecordError);
          } else {
            console.warn("FindFriendsPage: Fetch current user's follow record aborted.");
          }
        }

        if (!isMountedGetter()) return;

        const allUsersRecords = await pb.collection('users').getFullList<RecordModel>({ '$autoCancel': false, signal });
        if (!isMountedGetter()) return;

        const mappedUsers = allUsersRecords
          .map(mapRecordToUserDisplay)
          .filter(user => user !== null && user.id !== currentUser?.id) as User[];
        
        if (isMountedGetter()) {
          setUsersList(mappedUsers);
          const initialFollowingStatus: Record<string, boolean> = {};
          if (currentUserFollowRecord) {
            mappedUsers.forEach(user => {
              initialFollowingStatus[user.id] = currentUserFollowRecord.following?.includes(user.id) || false;
            });
          }
          setFollowingStatus(initialFollowingStatus);
          setError(null);
        }
      } catch (err: any) {
        if (isMountedGetter()) {
          if (err.name === 'AbortError') {
            console.warn("FindFriendsPage: Initial data fetch (allUsersRecords) aborted.");
          } else {
            console.error('FindFriendsPage: Failed to fetch initial data:', err);
            setError('Could not load users. Please try again later. Details: ' + (err.message || 'Unknown error'));
          }
        }
      } finally {
        if (isMountedGetter()) {
          setIsLoadingUsers(false);
        }
      }
    };

    if (!authIsLoading && currentUser?.id) {
      fetchInitialData();
    } else if (!authIsLoading && !currentUser?.id && isMountedGetter()) {
      setIsLoadingUsers(false);
      setError("Please login to find friends.");
    }
    
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [currentUser?.id, authIsLoading, mapRecordToUserDisplay]);

  const filteredUsers = useMemo(() => {
    if (!searchTerm) {
      return usersList;
    }
    return usersList.filter(user =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [usersList, searchTerm]);

  const getAvatarFallback = (name: string) => {
    const nameParts = name.split(' ');
    if (nameParts.length > 1) {
      return nameParts[0][0] + nameParts[nameParts.length - 1][0];
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleFollowToggle = async (targetUserId: string) => {
    if (!currentUser?.id) {
      toast({ title: "Authentication Error", description: "You must be logged in to follow users.", variant: "destructive" });
      return;
    }
    if (currentUser.id === targetUserId) {
      toast({ title: "Action not allowed", description: "You cannot follow or unfollow yourself.", variant: "default" });
      return;
    }

    setUpdatingFollowId(targetUserId);
    const isCurrentlyFollowing = followingStatus[targetUserId];
    const controller = new AbortController();
    const signal = controller.signal;

    try {
      // Step 1: Get/Create current user's follow record
      const currentUserFollowRecord = await getOrCreateFollowRecord(currentUser.id, "FindFriendsPage-FollowToggle-CurrentUser", signal);
      if (!currentUserFollowRecord || !currentUserFollowRecord.id) {
        console.error("handleFollowToggle: currentUserFollowRecord is invalid after getOrCreate.", currentUserFollowRecord);
        toast({ title: "Operation Failed", description: "Could not process your follow record. Please refresh and try again.", variant: "destructive" });
        setUpdatingFollowId(null);
        return;
      }
      if (signal.aborted) throw new Error("Request aborted after getting current user's follow record.");

      // Optimistically update UI for current user's action
      setFollowingStatus(prev => ({ ...prev, [targetUserId]: !isCurrentlyFollowing }));

      // Step 2: Update current user's 'following' list
      await pb.collection('following_followed').update(currentUserFollowRecord.id, {
        [isCurrentlyFollowing ? 'following-' : 'following+']: targetUserId,
      }, { '$autoCancel': false, signal });
      if (signal.aborted) throw new Error("Request aborted after updating current user's following list.");
      
      toast({ title: isCurrentlyFollowing ? "Unfollowed" : "Followed", description: `You ${isCurrentlyFollowing ? "are no longer following" : "are now following"} this user.` });

      // Removed attempt to update target user's followers list here.
      // The target user's follower count will update when their data is next fetched or through their own interactions.

      if (!signal.aborted) {
        const reFetchController = new AbortController();
        try {
            const record = await getOrCreateFollowRecord(currentUser.id, "FindFriendsPage-FollowToggle-ReFetch", reFetchController.signal);
            if (record && !reFetchController.signal.aborted) {
                const newFollowingStatus: Record<string, boolean> = {};
                usersList.forEach(u => { newFollowingStatus[u.id] = record.following?.includes(u.id) || false; });
                setFollowingStatus(newFollowingStatus);
            }
        } catch (reFetchErr: any) {
            if (!reFetchController.signal.aborted) console.error("FindFriendsPage: Re-fetch current user follow record after toggle failed:", reFetchErr);
        }
      }

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error(`Failed to update follow status for target ${targetUserId}. Full error object:`, err);
        toast({ title: "Update Failed", description: `Could not ${isCurrentlyFollowing ? 'unfollow' : 'follow'} user. ${err.message || "An unknown error occurred."}`, variant: "destructive" });
        setFollowingStatus(prev => ({ ...prev, [targetUserId]: isCurrentlyFollowing })); // Revert optimistic UI
      } else {
        console.warn("Follow/Unfollow action aborted.");
      }
    } finally {
      if (!signal?.aborted) {
         setUpdatingFollowId(null);
      }
    }
  };


  const renderUserCard = (userToList: User) => {
    const isFollowingTarget = followingStatus[userToList.id];
    const isLoadingThisUser = updatingFollowId === userToList.id;

    return (
        <Card key={userToList.id} className="overflow-hidden shadow-md hover:shadow-lg transition-shadow">
        <CardContent className="p-6 flex flex-col items-center text-center">
            <Avatar className="h-20 w-20 text-2xl mb-4 border-2 border-primary">
            <AvatarImage src={userToList.avatarUrl} alt={userToList.name} />
            <AvatarFallback>{getAvatarFallback(userToList.name)}</AvatarFallback>
            </Avatar>
            <h3 className="text-lg font-semibold text-foreground">{userToList.name}</h3>
            <p className="text-sm text-muted-foreground truncate max-w-full">{userToList.email}</p>
            {userToList.favExam && (
                <p className="text-sm text-muted-foreground">Targets: {userToList.favExam}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
                Joined: {userToList.joineddate ? new Date(userToList.joineddate).toLocaleDateString() : (userToList.created ? new Date(userToList.created).toLocaleDateString() : 'N/A')}
            </p>
            <Button
            variant={isFollowingTarget ? 'secondary' : 'default'}
            className="mt-4 w-full"
            onClick={() => handleFollowToggle(userToList.id)}
            disabled={isLoadingThisUser || authIsLoading}
            >
            {isLoadingThisUser ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : isFollowingTarget ? (
                <>
                <Check className="mr-2 h-4 w-4" /> Following
                </>
            ) : (
                <>
                <UserPlus className="mr-2 h-4 w-4" /> Follow
                </>
            )}
            </Button>
        </CardContent>
        </Card>
    );
  };

  if (authIsLoading) {
    return (
      <div className="space-y-8 p-4 md:p-6">
        <Card className="shadow-lg">
          <CardHeader>
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-2/3 mt-1" />
          </CardHeader>
          <CardContent>
            <div className="relative mb-6">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="Search by name or email..." className="pl-8 w-full" disabled />
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={`skel-load-${i}`} className="p-4">
              <div className="flex items-center space-x-4"><Skeleton className="h-12 w-12 rounded-full" /><div className="space-y-2"><Skeleton className="h-4 w-[150px]" /><Skeleton className="h-4 w-[100px]" /></div></div>
              <Skeleton className="h-8 w-full mt-4" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-foreground">Find Friends</CardTitle>
          <CardDescription>
            Discover and connect with other students on { AppConfig.appName }.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by name or email..."
              className="pl-8 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={isLoadingUsers || !currentUser}
            />
          </div>
        </CardContent>
      </Card>

      {isLoadingUsers && !error && (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={`skel-noload-${i}`} className="p-4">
              <div className="flex items-center space-x-4"><Skeleton className="h-12 w-12 rounded-full" /><div className="space-y-2"><Skeleton className="h-4 w-[150px]" /><Skeleton className="h-4 w-[100px]" /></div></div>
              <Skeleton className="h-8 w-full mt-4" />
            </Card>
          ))}
        </div>
      )}

      {error && (
        <Card className="text-center p-10 bg-destructive/10 border-destructive">
          <CardHeader className="p-0"><AlertCircle className="mx-auto h-12 w-12 text-destructive mb-3" /></CardHeader>
          <CardTitle className="text-destructive">Error Loading Users</CardTitle>
          <CardDescription className="text-destructive/80 whitespace-pre-wrap">{error}</CardDescription>
        </Card>
      )}

      {!currentUser && !authIsLoading && !isLoadingUsers && !error && (
         <Card className="text-center p-10">
          <CardTitle>Please Log In</CardTitle>
          <CardDescription>You need to be logged in to find friends.</CardDescription>
        </Card>
      )}

      {currentUser && !isLoadingUsers && !error && usersList.length === 0 && (
        <Card className="text-center p-10">
          <CardTitle>No Other Users Found</CardTitle>
          <CardDescription>
            It looks like you're the pioneer here, or perhaps invite some friends to join!
          </CardDescription>
        </Card>
      )}

      {currentUser && !isLoadingUsers && !error && usersList.length > 0 && filteredUsers.length === 0 && searchTerm.trim() !== '' && (
        <Card className="text-center p-10">
          <CardTitle>No Users Found Matching Your Search</CardTitle>
          <CardDescription>Try a different name or email.</CardDescription>
        </Card>
      )}

      {currentUser && !isLoadingUsers && !error && filteredUsers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map(userToList => renderUserCard(userToList))}
        </div>
      )}
    </div>
  );
}
