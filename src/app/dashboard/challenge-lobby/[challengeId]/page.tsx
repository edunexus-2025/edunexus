
'use client';

import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError, UnsubscribeFunc } from 'pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Routes, AppConfig, escapeForPbFilter } from '@/lib/constants';
import { AlertCircle, Swords, Users, Clock, Loader2, CheckCircle, UserCheck, XCircle, Copy, Play, PlusCircle, ArrowLeft as BackArrowIcon } from 'lucide-react';
import { format, formatDistanceToNowStrict, isPast, addMinutes, differenceInSeconds } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ChallengeDetailsRecord extends RecordModel {
  id: string;
  challenge_name: string;
  Subject?: string;
  Lesson?: string;
  number_of_question?: number;
  Difficulty?: string;
  duration?: number;
  expiry_time_min: number; // Assuming this is number of minutes
  student: string; // Creator's ID (this field name comes from your provided schema for student_create_challenge)
  challenged_friends: string[];
  status?: 'pending' | 'active' | 'completed' | 'expired' | 'cancelled';
  created: string; // ISO timestamp string
  expand?: {
    student?: { // Creator's details
      id: string;
      name: string;
      avatarUrl?: string;
      avatar?: string;
      collectionId?: string;
      collectionName?: string;
    };
  };
}

interface InviteRecord extends RecordModel {
  id: string;
  student: string; // Invitee's ID
  created_challenged_data: string; // Challenge ID
  Accepted_or_not?: 'Accepted' | 'Rejected' | null;
  expand?: {
    student?: { // Invitee's details
      id: string;
      name: string;
      avatarUrl?: string;
      avatar?: string;
      collectionId?: string;
      collectionName?: string;
    };
  };
}

interface JoinedPlayer {
  id: string;
  name: string;
  avatarUrl?: string;
}

export default function ChallengeLobbyPage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const challengeId = typeof params.challengeId === 'string' ? params.challengeId : '';

  const [challengeDetails, setChallengeDetails] = useState<ChallengeDetailsRecord | null>(null);
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [joinedPlayers, setJoinedPlayers] = useState<JoinedPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number | null>(null);

  const challengeLink = typeof window !== 'undefined' ? `${window.location.origin}${Routes.competeTest(challengeId)}` : '';

  const formatTimeLeft = (seconds: number | null): string => {
    if (seconds === null || seconds < 0) return "00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const getStatusDisplay = (challenge: ChallengeDetailsRecord | null): string => {
    if (!challenge) {
      return 'N/A (No Data)';
    }
  
    const currentStatus = challenge.status;
  
    if (currentStatus && typeof currentStatus === 'string' && currentStatus.trim() !== '' && currentStatus !== 'pending') {
      try {
        return currentStatus.toUpperCase();
      } catch (e) {
        console.error("CRITICAL: Error in getStatusDisplay toUpperCase() despite checks. Status:", currentStatus, "Error:", e);
        return 'STATUS_ERR';
      }
    }
  
    if (challenge.created && typeof challenge.expiry_time_min === 'number') {
      if (timeLeftSeconds !== null) {
        if (timeLeftSeconds <= 0) {
          return 'EXPIRED';
        }
        return `Expires in ${formatTimeLeft(timeLeftSeconds)}`;
      }
      try {
        const creationDate = new Date(challenge.created);
        if (isNaN(creationDate.getTime())) {
          console.warn("getStatusDisplay: Invalid 'created' date in challenge object:", challenge.created);
          return 'PENDING (Invalid Date)';
        }
        const expiryDate = addMinutes(creationDate, challenge.expiry_time_min);
        if (isPast(expiryDate)) {
          return 'EXPIRED (Calculated)';
        }
        return `Expires ${formatDistanceToNowStrict(expiryDate, { addSuffix: true })}`;
      } catch (e) {
        console.error("getStatusDisplay: Error calculating expiry from created/expiry_time_min:", e);
        return 'PENDING (Date Error)';
      }
    }
    if (currentStatus === 'pending') {
      return 'PENDING';
    }
    return 'PENDING (Status Unknown)';
  };
  

  const calculateAndSetTimeLeft = useCallback((challenge: ChallengeDetailsRecord | null) => {
    if (challenge && challenge.created && typeof challenge.expiry_time_min === 'number') {
      try {
        const creationDate = new Date(challenge.created);
        if (isNaN(creationDate.getTime())) {
          setTimeLeftSeconds(null); return;
        }
        const expiryDate = addMinutes(creationDate, challenge.expiry_time_min);
        const secondsRemaining = differenceInSeconds(expiryDate, new Date());
        setTimeLeftSeconds(secondsRemaining > 0 ? secondsRemaining : 0);
      } catch (e) {
        setTimeLeftSeconds(null);
      }
    } else {
      setTimeLeftSeconds(null);
    }
  }, []);

  useEffect(() => {
    if (challengeDetails) {
      calculateAndSetTimeLeft(challengeDetails);
    }
  }, [challengeDetails, calculateAndSetTimeLeft]);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (timeLeftSeconds !== null && timeLeftSeconds > 0 && challengeDetails?.status === 'pending') {
      timer = setInterval(() => {
        setTimeLeftSeconds((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else if (timeLeftSeconds === 0 && challengeDetails?.status === 'pending' && currentUser?.id === challengeDetails?.expand?.student?.id && !isProcessingAction) {
      const autoExpire = async () => {
        if (isProcessingAction) return;
        setIsProcessingAction(true);
        try {
          await pb.collection('student_create_challenge').update(challengeId, { status: 'expired' });
          toast({ title: "Challenge Expired", description: "The time limit for this challenge has passed." });
        } catch (err: any) {
          toast({ title: "Expiry Error", description: `Could not automatically expire challenge: ${err.data?.message || err.message}`, variant: "destructive" });
        } finally {
          setIsProcessingAction(false);
        }
      };
      autoExpire();
    }
    return () => { if (timer) clearInterval(timer); };
  }, [timeLeftSeconds, challengeDetails, challengeId, toast, currentUser?.id, isProcessingAction]);


  const fetchChallengeData = useCallback(async (isMountedGetter: () => boolean = () => true, callContext: string = "unknown") => {
    console.log(`ChallengeLobby: fetchChallengeData called from "${callContext}" for challengeId: ${challengeId}. isMounted: ${isMountedGetter()}`);
    if (!challengeId) {
      if (isMountedGetter()) { setError("Challenge ID missing."); setIsLoading(false); }
      return;
    }
    if (isMountedGetter()) { setIsLoading(true); setError(null); }

    try {
      const challengeRec = await pb.collection('student_create_challenge').getOne<ChallengeDetailsRecord>(challengeId, {
        expand: 'student', // Expand the 'student' field (creator)
      });
      console.log(`ChallengeLobby (Context: ${callContext}): Fetched challengeRec. Raw:`, JSON.parse(JSON.stringify(challengeRec, null, 2)));
      
      if (!isMountedGetter()) return;
      setChallengeDetails(challengeRec);

      // Fetch invites associated with this challenge and expand the invitee's student details
      const inviteRecords = await pb.collection('students_challenge_invites').getFullList<InviteRecord>({
        filter: `created_challenged_data = "${challengeId}"`,
        expand: 'student(id,name,avatar,avatarUrl,collectionId,collectionName)', // Explicitly expand student fields on invite
      });
      console.log(`ChallengeLobby (Context: ${callContext}): Fetched inviteRecords. Count: ${inviteRecords.length}.`);
      console.log(`ChallengeLobby (Context: ${callContext}): Raw inviteRecords:`, JSON.parse(JSON.stringify(inviteRecords)));


      if (!isMountedGetter()) return;

      const acceptedPlayers = inviteRecords
        .filter(invite => {
            const isAccepted = invite.Accepted_or_not === 'Accepted';
            const hasStudentData = !!invite.expand?.student;
            // console.log(`ChallengeLobby (Context: ${callContext}): Invite ID ${invite.id}, Accepted: ${isAccepted}, HasStudentData: ${hasStudentData}`);
            // if (hasStudentData) {
            //   console.log(`ChallengeLobby (Context: ${callContext}):   Student Name: ${invite.expand?.student?.name}`);
            // }
            return isAccepted && hasStudentData;
        })
        .map(invite => {
          const studentData = invite.expand!.student!;
          const avatar = studentData.avatarUrl ||
                         (studentData.avatar && studentData.collectionId && studentData.collectionName
                           ? pb.files.getUrl(studentData as RecordModel, studentData.avatar as string)
                           : `https://ui-avatars.com/api/?name=${encodeURIComponent(studentData.name?.charAt(0) || 'P')}&background=random&color=fff&size=64`);
          return { id: studentData.id, name: studentData.name || 'A Player', avatarUrl: avatar };
        });

      if (isMountedGetter()) {
        setInvites(inviteRecords);
        setJoinedPlayers(acceptedPlayers);
        console.log(`ChallengeLobby (Context: ${callContext}, fetchChallengeData - AFTER SETTING STATE):
        - Challenge Details set. Status from record: ${challengeRec.status || 'N/A'}
        - Accepted Players Count: ${acceptedPlayers.length}. Accepted Players: ${JSON.stringify(acceptedPlayers.map(p=>p.name))}
        - Total Invited Count: ${challengeRec.challenged_friends?.length || 0}
        - Creator ID: ${challengeRec.expand?.student?.id || "Unknown (Expand Failed for creator)"}
        - Creator Name: ${challengeRec.expand?.student?.name || "Unknown (Expand Failed for creator)"}`);
      }

    } catch (err: any) {
      if (isMountedGetter()) {
        const clientError = err as ClientResponseError;
        if (clientError.isAbort || (clientError.name === 'ClientResponseError' && clientError.status === 0)) {
          console.warn('ChallengeLobby: Fetch challenge data request cancelled.');
        } else {
          console.error("ChallengeLobby: Failed to fetch challenge data:", clientError.data || clientError, "Full error object:", clientError);
          setError(`Could not load challenge details. Error: ${clientError.data?.message || clientError.message}. Check PocketBase 'student_create_challenge' & 'users' view rules.`);
        }
      }
    } finally {
      if (isMountedGetter()) setIsLoading(false);
    }
  }, [challengeId]);

  useEffect(() => {
    const tryAutoStart = async () => {
      if (challengeDetails && challengeDetails.status === 'pending' && currentUser?.id === challengeDetails.expand?.student?.id && timeLeftSeconds !== null && timeLeftSeconds > 0) {
        const totalInvited = challengeDetails.challenged_friends?.length || 0;
        if (totalInvited > 0 && joinedPlayers.length === totalInvited && !isProcessingAction) {
          console.log("ChallengeLobby: All invited players have joined. Attempting to auto-start.");
          setIsProcessingAction(true);
          try {
            await pb.collection('student_create_challenge').update(challengeId, { status: 'active' });
            toast({ title: "Challenge Auto-Started!", description: "All players have joined. The test is now active." });
          } catch (err: any) {
            toast({ title: "Auto-Start Failed", description: err.data?.message || err.message, variant: "destructive" });
          } finally {
            setIsProcessingAction(false);
          }
        }
      }
    };
    tryAutoStart();
  }, [joinedPlayers, challengeDetails, currentUser?.id, challengeId, toast, timeLeftSeconds, isProcessingAction]);


  useEffect(() => {
    let isMounted = true;
    const componentIsMounted = () => isMounted;
    let unsubscribeInvites: UnsubscribeFunc | null = null;
    let unsubscribeChallenge: UnsubscribeFunc | null = null;

    fetchChallengeData(componentIsMounted, "initial load");

    const setupSubscription = async () => {
      if (!isMounted || !challengeId) return;
      try {
        unsubscribeInvites = await pb.collection('students_challenge_invites').subscribe('*', (e) => {
          if (componentIsMounted() && e.record.created_challenged_data === challengeId) {
            fetchChallengeData(componentIsMounted, "invite subscription update");
          }
        });
        unsubscribeChallenge = await pb.collection('student_create_challenge').subscribe(challengeId, (e) => {
          if (componentIsMounted() && e.record.id === challengeId) {
             setChallengeDetails(e.record as ChallengeDetailsRecord); 
          }
        });
      } catch (subError) {
        if (componentIsMounted()) console.error("ChallengeLobby: Error subscribing:", subError);
      }
    };
    setupSubscription();

    return () => {
      isMounted = false;
      if (unsubscribeInvites) unsubscribeInvites();
      if (unsubscribeChallenge) unsubscribeChallenge();
    };
  }, [challengeId, fetchChallengeData]);

  const getAvatarFallback = (name?: string) => {
    if (!name) return 'P';
    const parts = name.split(' ');
    return parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() : name.substring(0, 2).toUpperCase();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(challengeLink)
      .then(() => toast({ title: "Challenge Link Copied!" }))
      .catch(() => toast({ title: "Failed to copy link", variant: "destructive" }));
  };

  const handleForceStartChallenge = async () => {
    if (!challengeDetails || !currentUser || challengeDetails.expand?.student?.id !== currentUser.id || challengeDetails.status !== 'pending' || (timeLeftSeconds !== null && timeLeftSeconds <= 0)) {
      toast({ title: "Error", description: "Cannot force start this challenge (not creator, not pending, or expired).", variant: "destructive" });
      return;
    }
    if (isProcessingAction) return;
    setIsProcessingAction(true);
    try {
      await pb.collection('student_create_challenge').update(challengeId, { status: 'active' });
      toast({ title: "Challenge Started!", description: "The test is now active for joined players." });
    } catch (err: any) {
      toast({ title: "Start Failed", description: err.data?.message || err.message, variant: "destructive" });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleCancelChallenge = async () => {
    if (!challengeDetails || !currentUser || challengeDetails.expand?.student?.id !== currentUser.id) {
      toast({ title: "Error", description: "You are not authorized to cancel this challenge or challenge details are missing.", variant: "destructive" });
      return;
    }
    if (!confirm("Are you sure you want to cancel this challenge? This will notify all invited players.")) return;
    if (isProcessingAction) return;
    setIsProcessingAction(true);
    try {
      await pb.collection('student_create_challenge').update(challengeDetails.id, { status: 'cancelled' });
      toast({ title: "Challenge Cancelled", description: "The challenge has been cancelled." });
    } catch (err: any) {
      toast({ title: "Cancellation Failed", description: err.data?.message || err.message, variant: "destructive" });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const totalInvitedCount = challengeDetails?.challenged_friends?.length || 0;
  const creatorName = challengeDetails?.expand?.student?.name || "Unknown Creator";
  const isCreator = currentUser?.id === challengeDetails?.expand?.student?.id;
  
  const isChallengeExpired = (challengeDetails?.status === 'expired') || (challengeDetails?.status === 'pending' && timeLeftSeconds !== null && timeLeftSeconds <= 0);
  const canStartTest = challengeDetails?.status === 'active' && !isChallengeExpired && (isCreator || joinedPlayers.some(p => p.id === currentUser?.id));


  if (isLoading && !challengeDetails) {
    return ( <div className="p-4 md:p-8 space-y-6"><Skeleton className="h-10 w-3/4" /> <Skeleton className="h-6 w-1/2 mb-4" /><div className="grid md:grid-cols-2 gap-6"> <Skeleton className="h-48 rounded-lg" /> <Skeleton className="h-48 rounded-lg" /> </div><Skeleton className="h-12 w-full rounded-lg" /></div> );
  }
  if (error) {
    return ( <div className="p-4 md:p-8 text-center"><AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" /><h2 className="text-xl font-semibold text-destructive mb-2">Error Loading Challenge Lobby</h2><p className="text-muted-foreground mb-4 whitespace-pre-wrap">{error}</p><Button onClick={() => router.push(Routes.createChallenge)} variant="outline"><BackArrowIcon className="mr-2 h-4 w-4" /> Back to Create Challenge</Button></div> );
  }
  if (!challengeDetails) {
    return ( <div className="p-4 md:p-8 text-center"><AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" /><h2 className="text-xl font-semibold mb-2">Challenge Not Found</h2><p className="text-muted-foreground mb-4">The challenge details could not be loaded or the challenge does not exist.</p><Button onClick={() => router.push(Routes.createChallenge)} variant="outline"><BackArrowIcon className="mr-2 h-4 w-4" /> Back to Create Challenge</Button></div> );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 dark:from-slate-900 dark:via-slate-800 dark:to-gray-900 py-8 px-4">
      <Card className="max-w-3xl mx-auto shadow-2xl rounded-xl overflow-hidden border-none">
        <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-500 p-6 text-white">
          <div className="flex items-center justify-between">
            <Swords className="h-10 w-10 opacity-80" />
            <Badge variant="secondary" className="bg-white/20 text-white text-xs">
              {getStatusDisplay(challengeDetails)}
            </Badge>
          </div>
          <CardTitle className="text-3xl font-bold mt-2">{challengeDetails.challenge_name}</CardTitle>
          <CardDescription className="text-purple-100">
            Challenge created by {isCreator ? "You" : creatorName}.
            {challengeDetails.status === 'pending' && !isChallengeExpired && " Waiting for players..."}
            {challengeDetails.status === 'active' && !isChallengeExpired && " Test is live!"}
            {isChallengeExpired && challengeDetails.status !== 'completed' && challengeDetails.status !== 'cancelled' && " This challenge has expired."}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-6 bg-background">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <Card className="p-3 bg-muted/50"><span className="font-semibold text-foreground">Subject:</span> {challengeDetails.Subject || 'N/A'}</Card>
            <Card className="p-3 bg-muted/50"><span className="font-semibold text-foreground">Lesson:</span> {challengeDetails.Lesson || 'N/A'}</Card>
            <Card className="p-3 bg-muted/50"><span className="font-semibold text-foreground">Questions:</span> {challengeDetails.number_of_question || 'N/A'}</Card>
            <Card className="p-3 bg-muted/50"><span className="font-semibold text-foreground">Difficulty:</span> {challengeDetails.Difficulty || 'N/A'}</Card>
            <Card className="p-3 bg-muted/50 md:col-span-2"><span className="font-semibold text-foreground">Duration:</span> {challengeDetails.duration || 'N/A'} minutes</Card>
          </div>

          <div className="text-center p-4 border-y">
            <p className="text-2xl font-bold text-primary flex items-center justify-center gap-2">
              <span>{joinedPlayers.length} / {totalInvitedCount}</span>
              {(isLoading || isProcessingAction) && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
            </p>
            <p className="text-sm text-muted-foreground">Players Joined</p>
          </div>

          <div>
            {joinedPlayers.length > 0 ? (
              <ScrollArea className="h-40 border rounded-md p-1">
                <ul className="space-y-2 p-2">
                  {joinedPlayers.map(player => (
                    <li key={player.id} className="flex items-center gap-2 p-2 bg-card rounded-md shadow-sm">
                      <Avatar className="h-8 w-8"><AvatarImage src={player.avatarUrl} alt={player.name || 'Player'} data-ai-hint="player avatar"/><AvatarFallback>{getAvatarFallback(player.name)}</AvatarFallback></Avatar>
                      <span className="text-sm text-foreground">{player.name || 'A Player'}</span>
                      <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            ) : totalInvitedCount > 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No players have joined yet.</p>
            ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No friends were invited to this challenge.</p>
            )}
          </div>
           {isCreator && challengeDetails.status === 'pending' && !isChallengeExpired && (
            <div className="mt-4 p-3 border rounded-md bg-blue-50 dark:bg-blue-900/20">
              <div className="flex items-center gap-2 mb-1"><Copy className="h-4 w-4 text-blue-600 dark:text-blue-400"/><span className="text-sm font-medium text-blue-700 dark:text-blue-300">Share this link with your friends:</span></div>
              <div className="flex items-center gap-2"><Input value={challengeLink} readOnly className="text-xs bg-white dark:bg-slate-800 h-8"/><Button size="sm" variant="outline" onClick={handleCopyLink} className="text-xs h-8 px-2.5">Copy</Button></div>
            </div>
          )}
        </CardContent>

        <CardFooter className="p-6 bg-muted/30 border-t flex flex-col sm:flex-row justify-between items-center gap-3">
          {isCreator && challengeDetails.status === 'pending' && !isChallengeExpired && (
            <>
              <Button variant="destructive" onClick={handleCancelChallenge} disabled={isProcessingAction} className="w-full sm:w-auto order-2 sm:order-1"><XCircle className="mr-2 h-4 w-4" />Cancel Challenge</Button>
              <Button variant="default" onClick={handleForceStartChallenge} disabled={isProcessingAction || joinedPlayers.length === 0} className="w-full sm:w-auto order-1 sm:order-2 bg-green-600 hover:bg-green-700">{isProcessingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}Force Start Now</Button>
            </>
          )}
          {!isCreator && challengeDetails.status === 'pending' && !isChallengeExpired && ( <Button size="lg" className="w-full sm:w-auto" disabled><Clock className="mr-2 h-5 w-5" /> Waiting for Creator to Start...</Button> )}
          {canStartTest && ( <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white shadow-lg" onClick={() => router.push(Routes.competeTest(challengeId))}><Play className="mr-2 h-5 w-5" /> Start Test Now</Button> )}
          {challengeDetails.status === 'completed' && ( <Button size="lg" className="w-full sm:w-auto" onClick={() => router.push(Routes.testResultCompete(challengeId))}>View Results</Button> )}
          {(isChallengeExpired || challengeDetails.status === 'expired' || challengeDetails.status === 'cancelled') && !canStartTest && ( <Button size="lg" className="w-full sm:w-auto" disabled>Challenge {challengeDetails.status === 'cancelled' ? 'Cancelled' : 'Expired'}</Button> )}
        </CardFooter>
      </Card>
      <div className="mt-8 text-center"><Link href={Routes.dashboard} passHref><Button variant="outline" className="text-sm"><BackArrowIcon className="mr-2 h-4 w-4" /> Back to Dashboard</Button></Link></div>
    </div>
  );
}
