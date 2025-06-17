
'use client';

import { useState } from 'react';
import { Bell, X, Info, Check, UserX, Loader2, Swords, MessageSquareHeart, ChevronRight, UserPlus } from 'lucide-react'; // Added UserPlus
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { NotificationMessage, User } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import pb from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Routes } from '@/lib/constants';

interface NotificationPopoverProps {
  notifications: NotificationMessage[];
  deleteNotification: (id: string) => void;
  clearAllNotifications: () => void;
  isLoading?: boolean;
}

const getNotificationIcon = (type?: NotificationMessage['type']) => {
  switch (type) {
    case 'challenge_invite':
      return <Swords className="h-4 w-4 text-purple-500 mr-2" />;
    case 'challenge_accepted':
      return <Check className="h-4 w-4 text-green-500 mr-2" />;
    case 'challenge_rejected':
      return <UserX className="h-4 w-4 text-red-500 mr-2" />;
    case 'test_assigned':
      return <MessageSquareHeart className="h-4 w-4 text-blue-500 mr-2" />;
    case 'invitation': // For group invites
      return <UserPlus className="h-4 w-4 text-teal-500 mr-2" />;
    default:
      return <Info className="h-4 w-4 text-muted-foreground mr-2" />;
  }
};

export function NotificationPopover({
  notifications,
  deleteNotification,
  clearAllNotifications,
  isLoading = false,
}: NotificationPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const { user: currentUser, teacher: currentTeacher, authRefresh } = useAuth();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const router = useRouter();

  const activeUser = currentUser || currentTeacher;

  const handleNotificationClick = async (notification: NotificationMessage) => {
    if (!notification.read) {
      try {
        await pb.collection('notification').update(notification.id, { seen: true });
        // Optimistic update or rely on subscription would be better here
        // For now, just marking read on server
      } catch (error) {
        console.error("Failed to mark notification as read:", error);
      }
    }

    if (notification.type === 'challenge_invite' || notification.type === 'challenge_accepted' || notification.type === 'challenge_rejected') {
      if (notification.related_invite_id) { // Only navigate if there's an invite ID
        router.push(Routes.challengeInvites);
      } else {
        // Default or fallback navigation if no specific ID, or just close popover
        console.warn("Challenge related notification missing related_invite_id, cannot navigate to specific invite.");
      }
    } else if (notification.type === 'invitation') {
      // Group invitations: if already actioned (approved is not null/undefined), maybe navigate to teacher page or group.
      // For now, if pending, the buttons will handle action. If actioned, just closes popover.
      if (notification.approved !== null && notification.approved !== undefined) {
        // Potentially navigate somewhere if needed, e.g., to the teacher's page or a "my groups" page
        // Example: if (notification.bywho_if_teacher) router.push(Routes.teacherPublicAdPage(notification.bywho_if_teacher));
      }
    }
    setIsOpen(false);
  };

  const handleInvitationResponse = async (notification: NotificationMessage, accepted: boolean) => {
    if (!activeUser?.id || !notification.id) return;
    setProcessingId(notification.id);

    try {
      if (notification.type === 'invitation' && notification.bywho_if_teacher) {
        // Group Invitation Logic
        await pb.collection('notification').update(notification.id, { approved: accepted, seen: true });
        
        if (accepted && currentUser) { // Only students can accept teacher group invites this way
          try {
            // Add teacher to student's subscription_by_teacher list
            // Using "+=" to append to a relation field
            await pb.collection('users').update(currentUser.id, {
              "subscription_by_teacher+": notification.bywho_if_teacher,
            });
            toast({ title: "Group Invitation Accepted", description: "You've joined the teacher's group!" });
            authRefresh(); // Refresh auth context to get updated user data
          } catch (userUpdateError) {
            console.error("Failed to update student's teacher subscription:", userUpdateError);
            toast({ title: "Error Joining Group", description: "Could not update your teacher link.", variant: "destructive" });
            // Optionally revert notification approval if user update fails
            await pb.collection('notification').update(notification.id, { approved: null });
            setProcessingId(null);
            return;
          }
        } else if (accepted) {
          toast({ title: "Group Invitation Accepted"});
        } else {
           toast({ title: "Group Invitation Declined"});
        }
        deleteNotification(notification.id); // Remove from popover after action
      } else if (notification.type === 'challenge_invite' && notification.related_invite_id && notification.bywho_if_student) {
        // Challenge Invite Logic
        await pb.collection('students_challenge_invites').update(notification.related_invite_id, {
          Accepted_or_not: accepted, // PocketBase stores boolean as true/false
        });
        await pb.collection('notification').update(notification.id, { approved: accepted, seen: true });

        const responseMessage = `${activeUser.name || 'A friend'} has ${accepted ? 'accepted' : 'rejected'} your challenge.`;
        await pb.collection('notification').create({
          bywho_if_student: activeUser.id, // The one responding
          towho: [notification.bywho_if_student], // To the original challenger
          message: responseMessage,
          type: accepted ? 'challenge_accepted' : 'challenge_rejected',
          related_challenge_id: notification.related_challenge_id,
          related_invite_id: notification.related_invite_id,
          seen: false, // New notification for the challenger
          deleted: false,
          approved: accepted, // Reflect the action
        });
        toast({ title: accepted ? "Challenge Accepted!" : "Challenge Declined" });
        if (accepted && notification.related_challenge_id) router.push(Routes.challengeLobby(notification.related_challenge_id));
        deleteNotification(notification.id); // Remove from popover
      }
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to process invitation: ${error.message}`, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };


  const hasNotifications = notifications.length > 0;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-7 w-7"
          aria-label="Notifications"
        >
          <Bell className="h-[1.2rem] w-[1.2rem]" />
          {hasNotifications && !isLoading && (
            <span className="absolute top-0 right-0 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
          )}
          {isLoading && (
            <span className="absolute top-0 right-0 flex h-2.5 w-2.5">
                 <Loader2 className="h-2 w-2 animate-spin" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-medium leading-none">Notifications</h3>
          {hasNotifications && (
             <Button variant="link" size="sm" className="text-xs h-auto p-0" onClick={clearAllNotifications}>
                Clear All
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {isLoading && notifications.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Loading notifications...</p>
            </div>
          ) : hasNotifications ? (
            <div className="p-2 space-y-1">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="p-3 rounded-md hover:bg-muted/50 transition-colors border"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-grow flex items-start cursor-pointer" onClick={() => handleNotificationClick(notification)}>
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="ml-1">
                        <p className="text-sm font-semibold text-foreground">{notification.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 ml-2"
                      onClick={(e) => { e.stopPropagation(); deleteNotification(notification.id); }}
                      aria-label="Delete notification"
                      disabled={processingId === notification.id}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {/* Accept/Decline buttons for pending invitations */}
                  {notification.type === 'invitation' && notification.bywho_if_teacher && (notification.approved === null || notification.approved === undefined) && (
                    <div className="mt-2 pt-2 border-t flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 px-2 border-red-500 text-red-600 hover:bg-red-500/10 hover:text-red-700"
                        onClick={() => handleInvitationResponse(notification, false)}
                        disabled={processingId === notification.id}
                      >
                        {processingId === notification.id && !notification.approved ? <Loader2 className="h-3 w-3 animate-spin"/> : <UserX className="h-3 w-3 mr-1"/>}
                        Decline
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs h-7 px-2 bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleInvitationResponse(notification, true)}
                        disabled={processingId === notification.id}
                      >
                         {processingId === notification.id && notification.approved ? <Loader2 className="h-3 w-3 animate-spin"/> : <Check className="h-3 w-3 mr-1"/>}
                        Accept
                      </Button>
                    </div>
                  )}
                  {/* Display status if already actioned */}
                   {notification.type === 'invitation' && notification.approved === true && (
                    <p className="mt-2 text-xs text-green-600 font-medium flex items-center"><Check className="h-3 w-3 mr-1"/>Accepted Teacher's Invitation</p>
                  )}
                  {notification.type === 'invitation' && notification.approved === false && (
                    <p className="mt-2 text-xs text-red-600 font-medium flex items-center"><UserX className="h-3 w-3 mr-1"/>Declined Teacher's Invitation</p>
                  )}

                  {/* Challenge specific buttons - Assuming challenge invites are different from general 'invitation' type */}
                  {notification.type === 'challenge_invite' && (notification.approved === null || notification.approved === undefined) && (
                    <div className="mt-2 pt-2 border-t flex justify-end gap-2">
                      <Button size="sm" variant="outline" className="text-xs h-7 px-2 border-red-500 text-red-600 hover:bg-red-500/10 hover:text-red-700" onClick={() => handleInvitationResponse(notification, false)} disabled={processingId === notification.id}>
                         {processingId === notification.id && !notification.approved ? <Loader2 className="h-3 w-3 animate-spin"/> : <UserX className="h-3 w-3 mr-1"/>} Decline Challenge
                      </Button>
                      <Button size="sm" className="text-xs h-7 px-2 bg-green-600 hover:bg-green-700 text-white" onClick={() => handleInvitationResponse(notification, true)} disabled={processingId === notification.id}>
                        {processingId === notification.id && notification.approved ? <Loader2 className="h-3 w-3 animate-spin"/> : <Check className="h-3 w-3 mr-1"/>} Accept Challenge
                      </Button>
                    </div>
                  )}
                   {notification.type === 'challenge_invite' && notification.approved === true && (
                    <p className="mt-2 text-xs text-green-600 font-medium flex items-center"><Check className="h-3 w-3 mr-1"/>Challenge Accepted</p>
                  )}
                  {notification.type === 'challenge_invite' && notification.approved === false && (
                    <p className="mt-2 text-xs text-red-600 font-medium flex items-center"><UserX className="h-3 w-3 mr-1"/>Challenge Declined</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center flex flex-col items-center justify-center h-full">
              <Info className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">No Notifications</p>
              <p className="text-xs text-muted-foreground">You're all caught up!</p>
            </div>
          )}
        </ScrollArea>
         <div className="p-2 border-t text-center">
            <Button variant="link" size="sm" className="text-xs h-auto p-0 text-primary" onClick={() => {
              if (notifications.some(n => n.type === 'challenge_invite')) router.push(Routes.challengeInvites);
              setIsOpen(false);
            }}>
                View Details <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
