
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Routes } from '@/lib/constants';
import { AlertCircle, Check, Loader2, Swords, UserX, Info, Bell, History, CheckCircle, XCircle, ChevronRight, Gamepad2, Eye } from 'lucide-react';
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState, useCallback, useMemo } from "react";
import pb from '@/lib/pocketbase';
import type { RecordModel, UnsubscribeFunc, ClientResponseError } from 'pocketbase';
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow, isPast, addMinutes } from 'date-fns';
import { Skeleton } from "@/components/ui/skeleton";
import type { ChallengeInviteRecord as ChallengeInviteRecordType } from '@/lib/types';
import { cn } from "@/lib/utils";
import { useRouter } from 'next/navigation';

const getAvatarFallback = (name?: string) => {
  if (!name) return 'U';
  const parts = name.split(' ');
  return parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() : name.substring(0, 2).toUpperCase();
};


export default function ChallengeInvitesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [invites, setInvites] = useState<ChallengeInviteRecordType[]>([]);
  const [isLoadingInvites, setIsLoadingInvites] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingInviteId, setProcessingInviteId] = useState<string | null>(null);

  const fetchInvites = useCallback(async (isMountedGetter: () => boolean = () => true) => {
    if (!user?.id || !isMountedGetter()) {
      if(isMountedGetter()) { setInvites([]); setIsLoadingInvites(false); }
      return;
    }
    if(isMountedGetter()) setIsLoadingInvites(true);

    try {
      // Standard nested expand. PocketBase will use displayFields from schema.
      const expandString = 'created_challenged_data.student'; 
      // This means: for each invite, get its `created_challenged_data` (the challenge),
      // and for that challenge, get its `student` (the creator of the challenge).

      console.log("ChallengeInvites: Fetching invites with expand string:", expandString);

      const records = await pb.collection('students_challenge_invites').getFullList<ChallengeInviteRecordType>({
        filter: `student = "${user.id}"`, 
        sort: '-created',
        expand: expandString,
      });
      
      console.log("ChallengeInvites: Raw inviteRecords after fetch:", JSON.parse(JSON.stringify(records)));


      if(isMountedGetter()) {
        setInvites(records);
        if (records.length === 0) {
            console.log("ChallengeInvites: No invites found for this user.");
        } else {
            records.forEach((invite, index) => {
                const challengeInfo = invite.expand?.created_challenged_data;
                // console.log(`ChallengeInvites: Invite ${index} - challengeInfo:`, challengeInfo ? JSON.parse(JSON.stringify(challengeInfo)) : 'undefined');
                const challengerInfo = challengeInfo?.expand?.student;
                // console.log(`ChallengeInvites: Invite ${index} - challengerInfo (creator):`, challengerInfo ? JSON.parse(JSON.stringify(challengerInfo)) : 'undefined');
                if(!challengerInfo?.name){
                    console.warn(`ChallengeInvites: Challenger name missing for invite ID ${invite.id}, challenge ID ${challengeInfo?.id}. Expands:`, invite.expand);
                }
            });
        }
      }
    } catch (err: any) {
      if(isMountedGetter()){
        const clientError = err as ClientResponseError;
        console.error("ChallengeInvites: Failed to fetch challenge invites:", clientError.data || clientError);
        setError(`Could not load invites. Error: ${clientError.data?.message || clientError.message}`);
      }
    } finally {
      if(isMountedGetter()) setIsLoadingInvites(false);
    }
  }, [user?.id]);

  useEffect(() => {
    let isMounted = true;
    const componentIsMounted = () => isMounted;
    let unsubscribe: UnsubscribeFunc | null = null;

    if (!authLoading && user?.id) {
      fetchInvites(componentIsMounted);

      const setupSubscription = async () => {
        if (!isMounted || !user?.id) return;
        try {
          unsubscribe = await pb.collection('students_challenge_invites').subscribe('*', (e) => {
            if (componentIsMounted() && e.record.student === user.id) {
              fetchInvites(componentIsMounted);
            }
          });
        } catch (subError) { 
          if(componentIsMounted()) console.error("ChallengeInvites: Error subscribing to challenge invites:", subError); 
        }
      };
      setupSubscription();
    } else if (!authLoading && !user && isMounted) {
       setIsLoadingInvites(false);
       setInvites([]);
    }

    return () => { 
      isMounted = false; 
      if (unsubscribe) unsubscribe(); 
    };
  }, [authLoading, user?.id, fetchInvites]);

  const handleInviteResponse = async (invite: ChallengeInviteRecordType, accept: boolean) => {
    if (!user?.id) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }
    setProcessingInviteId(invite.id);

    const challengeData = invite.expand?.created_challenged_data;
    const challengerRecord = challengeData?.expand?.student; // This is the creator of the challenge

    if (!challengerRecord?.id) {
      console.error("handleInviteResponse error: Challenger ID (creator of challenge) missing.", { userId: user?.id, inviteId: invite.id, inviteData: invite });
      toast({ title: "Error Processing Invite", description: `Could not identify the challenger. Please ensure data is correctly linked. More details in console.`, variant: "destructive", duration: 7000 });
      setProcessingInviteId(null); 
      return;
    }
    
    try {
      await pb.collection('students_challenge_invites').update(invite.id, {
        Accepted_or_not: accept, // Boolean value
      });

      // Optimistically update local state
      setInvites(prevInvites =>
        prevInvites.map(inv =>
          inv.id === invite.id
            ? { ...inv, Accepted_or_not: accept }
            : inv
        )
      );

      const notificationMessage = `${user.name || 'A friend'} has ${accept ? 'accepted' : 'rejected'} your challenge for ${challengeData?.challenge_name || 'a test'}.`;
      
      await pb.collection('notification').create({
        bywho_if_student: user.id,
        towho: [challengerRecord.id], // Notify the creator of the challenge
        message: notificationMessage,
        type: accept ? 'challenge_accepted' : 'challenge_rejected',
        related_challenge_id: challengeData?.id,
        related_invite_id: invite.id,
        approved: accept, 
      });

      if (accept) {
        if (challengeData?.id) {
          toast({ title: "Challenge Accepted!", description: "Redirecting to the challenge lobby..." });
          router.push(Routes.challengeLobby(challengeData.id));
        } else {
          toast({ title: "Challenge Accepted!", description: "Challenge details are missing, cannot redirect to lobby.", variant: "default" });
        }
      } else {
        toast({ title: "Challenge Declined"});
      }
    } catch (error: any) {
      console.error("ChallengeInvites: Failed to respond to invite:", error);
      toast({ title: "Error Responding", description: error.data?.message || error.message, variant: "destructive" });
      // Revert optimistic update if API call fails - better to refetch to ensure consistency
      fetchInvites();
    } finally {
      setProcessingInviteId(null);
    }
  };

  const pendingInvites = useMemo(() => invites.filter(invite => invite.Accepted_or_not === null || typeof invite.Accepted_or_not === 'undefined'), [invites]);
  const pastInvites = useMemo(() => invites.filter(invite => typeof invite.Accepted_or_not === 'boolean'), [invites]);


  return (
    <div className="space-y-8 p-4 md:p-6">
      <div className="text-center mb-10">
        <Bell className="h-16 w-16 text-primary mx-auto mb-4" />
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">My Challenge Invitations</h1>
        <p className="text-muted-foreground mt-1">Accept or reject challenges from your friends.</p>
      </div>

      {isLoadingInvites && !error && (
         <div className="space-y-6">
            <Skeleton className="h-8 w-1/4 mb-4" />
            <div className="space-y-4">
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-28 w-full rounded-lg" />
            </div>
        </div>
      )}
      {error && (
        <Card className="text-center p-6 border border-destructive bg-destructive/10 rounded-md">
            <AlertCircle className="mx-auto h-8 w-8 text-destructive mb-2" />
            <p className="text-destructive font-semibold">Error loading invites:</p>
            <p className="text-sm text-destructive/80 whitespace-pre-wrap">{error}</p>
        </Card>
      )}

      {!isLoadingInvites && !error && (
        <>
          {pendingInvites.length > 0 && (
            <section>
              <h2 className="text-2xl font-semibold mb-4 text-foreground flex items-center">
                <Swords className="mr-2 h-6 w-6 text-muted-foreground" /> Pending Challenges
              </h2>
              <div className="space-y-4">
                {pendingInvites.map(invite => {
                  const challengeInfo = invite.expand?.created_challenged_data;
                  const challengerInfo = challengeInfo?.expand?.student; // Creator of the challenge
                  
                  const challengerNameDisplay = challengerInfo?.name || 'Unknown Challenger';
                  let challengerAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(challengerNameDisplay.charAt(0) || 'C')}&background=random&color=fff&size=64`;
                  if (challengerInfo?.avatarUrl && challengerInfo.avatarUrl.startsWith('http')) {
                      challengerAvatar = challengerInfo.avatarUrl;
                  } else if (challengerInfo?.avatar && challengerInfo.collectionId && challengerInfo.collectionName) {
                      challengerAvatar = pb.files.getUrl(challengerInfo as RecordModel, challengerInfo.avatar as string);
                  }
                  
                  console.log(`Rendering Pending Invite Card: Invite ID ${invite.id}, Challenger Name: ${challengerNameDisplay}`);
                  if (!challengerInfo?.name) {
                    console.warn(`Challenger name missing for invite card (ID: ${invite.id}). Challenge Info:`, challengeInfo, `Challenger (creator) Info:`, challengerInfo);
                  }


                  return (
                    <Card key={invite.id} className="shadow-md overflow-hidden">
                      <CardHeader className="p-4 flex flex-row items-start gap-3 bg-card">
                        <Avatar className="h-10 w-10 border">
                          <AvatarImage src={challengerAvatar} alt={challengerNameDisplay} />
                          <AvatarFallback>{getAvatarFallback(challengerNameDisplay)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-grow">
                          <CardTitle className="text-base font-semibold">
                            Challenge from <span className="text-primary">{challengerNameDisplay}</span>
                            {challengeInfo?.challenge_name && <span className="text-xs text-muted-foreground ml-1">({challengeInfo.challenge_name})</span>}
                          </CardTitle>
                          <CardDescription className="text-xs text-muted-foreground">
                            Received {formatDistanceToNow(new Date(invite.created), { addSuffix: true })}
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-700/20 dark:text-yellow-300 dark:border-yellow-600">Pending</Badge>
                      </CardHeader>
                      <CardContent className="p-4 text-sm space-y-1">
                        {challengeInfo?.Subject && <p><strong>Subject:</strong> {challengeInfo.Subject}</p>}
                        {challengeInfo?.Lesson && <p><strong>Lesson:</strong> {challengeInfo.Lesson}</p>}
                        {challengeInfo?.number_of_question !== undefined && <p><strong>Questions:</strong> {challengeInfo.number_of_question}</p>}
                        {challengeInfo?.Difficulty && <p><strong>Difficulty:</strong> {challengeInfo.Difficulty}</p>}
                        {challengeInfo?.duration !== undefined && <p><strong>Duration:</strong> {challengeInfo.duration} minutes</p>}
                      </CardContent>
                      <CardFooter className="p-4 flex justify-end gap-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleInviteResponse(invite, false)}
                          disabled={processingInviteId === invite.id}
                          className="border-destructive text-destructive hover:bg-destructive/10"
                        >
                          {processingInviteId === invite.id && invite.Accepted_or_not === false ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="mr-1.5 h-4 w-4" />}
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleInviteResponse(invite, true)}
                          disabled={processingInviteId === invite.id}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          {processingInviteId === invite.id && invite.Accepted_or_not === true ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="mr-1.5 h-4 w-4" />}
                          Accept
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {pastInvites.length > 0 && (
             <section className={pendingInvites.length > 0 ? "mt-10" : ""}>
              <h2 className="text-2xl font-semibold mb-4 text-foreground flex items-center">
                <History className="mr-2 h-6 w-6 text-muted-foreground" /> Past Invitations
              </h2>
              <Card className="shadow-md">
                <CardContent className="p-0">
                  <ul className="divide-y divide-border">
                    {pastInvites.map(invite => {
                      const challengeInfo = invite.expand?.created_challenged_data;
                      const challengerInfo = challengeInfo?.expand?.student; // Creator of the challenge
                      const isAccepted = invite.Accepted_or_not === true;
                      const isRejected = invite.Accepted_or_not === false;
                      
                      const challengeDisplayTitle = challengeInfo?.challenge_name || 
                                                    (challengeInfo?.Subject && challengeInfo?.Lesson ? `${challengeInfo.Subject} - ${challengeInfo.Lesson}` : 
                                                    'Challenge');
                      
                      let canViewLobby = false;
                      let canViewResults = false;
                      if(isAccepted && challengeInfo?.id){
                        const challengeStatus = challengeInfo.status;
                        let isChallengeExpired = false;
                        if(challengeInfo.created && typeof challengeInfo.expiry_time_min === 'number'){
                            const creationDate = new Date(challengeInfo.created);
                            const expiryDate = addMinutes(creationDate, challengeInfo.expiry_time_min);
                            isChallengeExpired = isPast(expiryDate);
                        }
                        if((challengeStatus === 'pending' || challengeStatus === 'active') && !isChallengeExpired) {
                            canViewLobby = true;
                        } else if (challengeStatus === 'completed') {
                            canViewResults = true;
                        }
                      }

                      return (
                        <li key={invite.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-muted/30">
                          <div className="flex-grow">
                            <p className="text-sm font-semibold text-foreground">
                              Challenge from <span className="text-primary">{challengerInfo?.name || 'Unknown Challenger'}</span>
                              <span className="text-xs text-muted-foreground ml-1">
                                ({challengeDisplayTitle})
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Responded: {formatDistanceToNow(new Date(invite.updated), { addSuffix: true })}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 mt-2 sm:mt-0 flex-shrink-0">
                            {isAccepted && <Badge variant="default" className="bg-green-100 text-green-700 border-green-300 dark:bg-green-700/20 dark:text-green-300 dark:border-green-600">Accepted</Badge>}
                            {isRejected && <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 dark:bg-red-700/20 dark:text-red-300 dark:border-red-600">Rejected</Badge>}
                            
                            {canViewLobby && challengeInfo?.id && (
                              <Button variant="link" size="sm" className="text-xs text-primary p-0 h-auto" 
                                onClick={() => router.push(Routes.challengeLobby(challengeInfo.id))}
                              > 
                                View Lobby <ChevronRight className="h-3 w-3 ml-0.5" />
                              </Button>
                            )}
                            {canViewResults && challengeInfo?.id && (
                              <Button variant="link" size="sm" className="text-xs text-primary p-0 h-auto" 
                                onClick={() => router.push(Routes.testResultCompete(challengeInfo.id))}
                              > 
                                View Results <ChevronRight className="h-3 w-3 ml-0.5" />
                              </Button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            </section>
          )}

          {invites.length === 0 && !isLoadingInvites && !error && (
             <div className="text-center py-10">
                <Swords className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-xl font-semibold text-muted-foreground">No Challenge Invites Yet</p>
                <p className="text-sm text-muted-foreground">Challenge your friends or wait for them to challenge you!</p>
                <Button asChild className="mt-4"><Link href={Routes.createChallenge}>Create a Challenge</Link></Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

