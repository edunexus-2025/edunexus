
'use client';

import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState, useRef, useCallback, FormEvent, ChangeEvent } from 'react';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError, UnsubscribeFunc } from 'pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardDescription, CardTitle, CardHeader, CardContent } from '@/components/ui/card';
import { AlertCircle, Send, ArrowLeft, MessageSquare as MessageSquareIcon, Loader2, ThumbsUp, ThumbsDown, MessageSquareReply, X, Link as LinkIcon, Image as ImageIconLucide, Trash2, Edit2 as EditIcon, Paperclip, MessageSquareText } from 'lucide-react';
import Link from 'next/link';
import { Routes, escapeForPbFilter, AppConfig } from '@/lib/constants';
import { formatDistanceToNow } from 'date-fns';
import type { DiscussionMessage, User } from '@/lib/types';
import { cn } from '@/lib/utils';
import NextImage from 'next/image';

// Interface for the object passed to getFileUrlSafe, especially for expanded relations
interface MinimalRecordForFileUrl {
  id: string;
  collectionId?: string; // Optional, as it might be missing in some User type contexts initially
  collectionName?: string; // Optional
  [key: string]: any; // To allow for the dynamic file field (e.g., 'avatar', 'profile_picture')
}

const getFileUrlSafe = (record: MinimalRecordForFileUrl | null | undefined, fieldName: string, thumb?: string): string | undefined => {
    if (!record || !record[fieldName] || typeof record[fieldName] !== 'string') {
        return undefined;
    }
    if (!record.id || typeof record.id !== 'string' ||
        !record.collectionId || typeof record.collectionId !== 'string' ||
        !record.collectionName || typeof record.collectionName !== 'string') {
        console.warn(`getFileUrlSafe: 'id', 'collectionId', or 'collectionName' is missing or invalid for field '${fieldName}' on record:`, JSON.stringify(record));
        return undefined;
    }
    try {
        const modelForPbFiles = {
            id: record.id,
            collectionId: record.collectionId,
            collectionName: record.collectionName,
            [fieldName]: record[fieldName] as string
        };
        return pb.files.getUrl(modelForPbFiles as unknown as RecordModel, modelForPbFiles[fieldName], thumb ? { thumb } : undefined);
    } catch (e) {
        console.warn(`Error in getFileUrlSafe for field '${fieldName}', record ID ${record.id}, collection ${record.collectionName}, filename ${record[fieldName]}:`, e);
        return undefined;
    }
};

const mapMessageRecord = (record: RecordModel, currentAuthUserId?: string): DiscussionMessage => {
  const expandData = record.expand as DiscussionMessage['expand'] | undefined;

  let senderName = "Unknown User";
  let senderAvatarUrl: string | undefined = undefined;
  let isCurrentUser = false;
  let by_whom_student_id: string | undefined;
  let by_whom_teacher_id: string | undefined;

  const studentSender = expandData?.by_whom_student;
  const teacherSender = expandData?.by_whom_teacher;

  if (studentSender) {
    senderName = studentSender.name || "Student";
    by_whom_student_id = studentSender.id;
    if (studentSender.avatarUrl && studentSender.avatarUrl.startsWith('http')) {
        senderAvatarUrl = studentSender.avatarUrl;
    } else if (studentSender.avatar) {
        senderAvatarUrl = getFileUrlSafe(studentSender, 'avatar');
    }
    if (!senderAvatarUrl) senderAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName.charAt(0) || 'S')}&background=random&color=fff&size=64`;
    if (currentAuthUserId && studentSender.id === currentAuthUserId) isCurrentUser = true;
  } else if (teacherSender) {
    senderName = teacherSender.name || "Teacher";
    by_whom_teacher_id = teacherSender.id;
    if (teacherSender.avatarUrl && teacherSender.avatarUrl.startsWith('http')) {
        senderAvatarUrl = teacherSender.avatarUrl;
    } else if (teacherSender.profile_picture) {
        senderAvatarUrl = getFileUrlSafe(teacherSender, 'profile_picture');
    }
    if (!senderAvatarUrl) senderAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName.charAt(0) || 'T')}&background=random&color=fff&size=64`;
    if (currentAuthUserId && teacherSender.id === currentAuthUserId) isCurrentUser = true;
  }

  let repliedToMessageSnippet: string | undefined;
  let repliedToSenderName: string | undefined;
  let repliedToIsCurrentUser = false; // New field
  const repliedToMessageData = expandData?.replied_to_message;

  if (repliedToMessageData) {
      repliedToMessageSnippet = repliedToMessageData.message?.substring(0, 70) + (repliedToMessageData.message?.length > 70 ? '...' : '');
      const nestedExpand = repliedToMessageData.expand;
      if (nestedExpand?.by_whom_student) {
          repliedToSenderName = nestedExpand.by_whom_student.name || "Student";
          if (currentAuthUserId && nestedExpand.by_whom_student.id === currentAuthUserId) {
              repliedToIsCurrentUser = true;
          }
      } else if (nestedExpand?.by_whom_teacher) {
          repliedToSenderName = nestedExpand.by_whom_teacher.name || "Teacher";
          if (currentAuthUserId && nestedExpand.by_whom_teacher.id === currentAuthUserId) {
              repliedToIsCurrentUser = true;
          }
      } else {
          repliedToSenderName = "Original Sender";
      }
  }
  
  const displayableAnyImageUrl = getFileUrlSafe(record, 'any_image');
  const displayableAnyLinkUrl = (typeof record.any_link === 'string' && record.any_link.trim() !== '') ? record.any_link.trim() : undefined;

  return {
    id: record.id,
    group: record.group,
    message: record.message || "",
    created: record.created,
    updated: record.updated,
    senderName,
    senderAvatarUrl,
    isCurrentUser,
    by_whom_student_id,
    by_whom_teacher_id,
    likes: record.like_by?.length || 0,
    dislikes: record.unlike_by?.length || 0,
    repliedToMessageId: record.replied_to_message,
    repliedToMessageSnippet,
    repliedToSenderName,
    repliedToIsCurrentUser, // Added here
    any_image: displayableAnyImageUrl,
    any_link: displayableAnyLinkUrl,
    like_by: Array.isArray(record.like_by) ? record.like_by : [],
    unlike_by: Array.isArray(record.unlike_by) ? record.unlike_by : [],
    expand: expandData,
    collectionId: record.collectionId,
    collectionName: record.collectionName,
  };
};

export default function DiscussionGroupPage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser, teacher: currentTeacher, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const groupIdParam = typeof params.groupId === 'string' ? params.groupId : '';

  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [imageFileToSend, setImageFileToSend] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const [groupDetails, setGroupDetails] = useState<{ name: string; description?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [replyingToMessageInfo, setReplyingToMessageInfo] = useState<{ id: string; senderName: string; messageSnippet: string; isCurrentUserReplyTo: boolean } | null>(null);
  const [editingMessageContent, setEditingMessageContent] = useState<{ id: string, currentText: string } | null>(null);
  const [processingInteractionId, setProcessingInteractionId] = useState<string | null>(null);


  const scrollAreaViewportRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeUser = currentUser || currentTeacher;

  const EXPAND_STRING = 'by_whom_student(id,name,avatar,avatarUrl,collectionId,collectionName),by_whom_teacher(id,name,profile_picture,avatarUrl,collectionId,collectionName),replied_to_message(message,by_whom_student,by_whom_teacher,expand.by_whom_student(id,name),expand.by_whom_teacher(id,name)),like_by,unlike_by';

  const fetchGroupDetailsAndMessages = useCallback(async (isMountedGetter: () => boolean = () => true) => {
    if (!groupIdParam) { if (isMountedGetter()) { setError("Group ID missing."); setIsLoading(false); } return; }
    if (!activeUser?.id && !authLoading) { if (isMountedGetter()) { setError("User authentication missing."); setIsLoading(false); } return; }
    if (!activeUser?.id && authLoading) { if (isMountedGetter()) { setIsLoading(true); } return; }
    if (isMountedGetter()) { setIsLoading(true); setError(null); }

    try {
      try {
        const groupRecord = await pb.collection('discussion_groups_data').getOne(groupIdParam, { '$autoCancel': false });
        if (isMountedGetter()) setGroupDetails({ name: groupRecord.group_name, description: groupRecord.group_description });
      } catch (groupFetchError: any) {
        if (groupFetchError.status === 404) {
          const planSlugsToNames: Record<string, string> = { "free": "Free Plan Discussions", "dpp": "DPP Plan Discussions", "chapterwise": "Chapterwise Plan Discussions", "full-length": "Full Length Plan Discussions", "combo": "Combo Plan Discussions" };
          const groupNameFromSlug = planSlugsToNames[groupIdParam.toLowerCase()] || `Group: ${groupIdParam}`;
          if (isMountedGetter()) setGroupDetails({ name: groupNameFromSlug, description: `Discussions for ${groupNameFromSlug}` });
        } else { if (isMountedGetter()) { console.warn(`Error fetching group details for "${groupIdParam}":`, groupFetchError); setGroupDetails({ name: `Group: ${groupIdParam}`, description: "Details unavailable" }); }}
      }
      if (!isMountedGetter()) return;
      const escapedGroupIdParam = escapeForPbFilter(groupIdParam);
      const filter = `group = "${escapedGroupIdParam}"`;
      const records = await pb.collection('discussion_form_messages').getFullList<RecordModel>({
        filter, sort: 'created',
        expand: EXPAND_STRING,
        '$autoCancel': false,
      });
      if (isMountedGetter()) setMessages(records.map(record => mapMessageRecord(record, activeUser?.id)));
    } catch (err: any) {
      if (!isMountedGetter()) return;
      const clientError = err as ClientResponseError;
      let errorMsg = `Could not load messages for group "${groupIdParam}".`;
      if (clientError.status === 404 && clientError.data?.message?.includes("collection context")) errorMsg = `Error 404: Missing collection context. Ensure API Rules allow View and relevant "Display fields" are set for relations in PocketBase.`;
      else if (clientError.data?.message) errorMsg = clientError.data.message;
      else if (clientError.message) errorMsg = clientError.message;
      console.error("DiscussionGroupPage: Failed to fetch messages. Full Error:", clientError, "Filter used was:", `group = "${escapeForPbFilter(groupIdParam)}"`);
      setError(errorMsg);
    } finally { if (isMountedGetter()) setIsLoading(false); }
  }, [groupIdParam, activeUser?.id, authLoading, EXPAND_STRING]);

  useEffect(() => {
    let isMounted = true; const componentIsMounted = () => isMounted;
    let unsubscribeMessages: UnsubscribeFunc | undefined;
    if (!authLoading) fetchGroupDetailsAndMessages(componentIsMounted);

    const setupSubscription = async () => {
      if (!isMounted || !groupIdParam || !activeUser?.id) return;
      try {
        unsubscribeMessages = await pb.collection('discussion_form_messages').subscribe('*', async (e) => {
          if (!isMounted) return;
          if (e.record.group !== groupIdParam) return;
          try {
            const fullRecord = await pb.collection('discussion_form_messages').getOne(e.record.id, { expand: EXPAND_STRING, '$autoCancel': false });
            if (!isMounted) return;
            const mappedMessage = mapMessageRecord(fullRecord, activeUser?.id);
            if (e.action === 'create') setMessages(prev => { if (prev.find(m => m.id === mappedMessage.id)) return prev; return [...prev, mappedMessage]; });
            else if (e.action === 'update') setMessages(prev => prev.map(msg => msg.id === mappedMessage.id ? mappedMessage : msg));
          } catch (fetchError: any) { if (isMounted) console.error(`Error fetching full message on ${e.action} event (ID: ${e.record.id}). Full error:`, fetchError.data || fetchError); }
          if (e.action === 'delete') setMessages(prev => prev.filter(msg => msg.id !== e.record.id));
        });
      } catch (subError) { if (isMounted) console.error("Error subscribing:", subError); }
    };
    if (!authLoading && activeUser?.id) setupSubscription();
    return () => { isMounted = false; if (unsubscribeMessages) unsubscribeMessages(); };
  }, [groupIdParam, authLoading, activeUser?.id, fetchGroupDetailsAndMessages, EXPAND_STRING]);

  const prevMessagesLengthRef = useRef(messages.length);
  useEffect(() => {
    const viewport = scrollAreaViewportRef.current;
    if (viewport) {
      const isAtBottom = viewport.scrollHeight - viewport.scrollTop <= viewport.clientHeight + 20; 
      const newMessagesAdded = messages.length > prevMessagesLengthRef.current;
      const lastMessageIsCurrentUser = messages.length > 0 && messages[messages.length - 1].isCurrentUser;

      if (newMessagesAdded && (isAtBottom || lastMessageIsCurrentUser)) {
        setTimeout(() => { 
          viewport.scrollTop = viewport.scrollHeight;
        }, 50);
      }
      prevMessagesLengthRef.current = messages.length;
    }
  }, [messages]);


  const handleImageFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ title: "Image Too Large", description: "Please select an image smaller than 5MB.", variant: "destructive" });
        setImageFileToSend(null); setImagePreviewUrl(null); return;
      }
      setImageFileToSend(file);
      const reader = new FileReader();
      reader.onloadend = () => { setImagePreviewUrl(reader.result as string); };
      reader.readAsDataURL(file);
    } else { setImageFileToSend(null); setImagePreviewUrl(null); }
  };

  const removeSelectedImage = () => {
    setImageFileToSend(null); setImagePreviewUrl(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleSendMessage = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() && !imageFileToSend && !editingMessageContent) { toast({title: "Cannot send empty message", variant: "destructive"}); return; }
    if (editingMessageContent && !newMessage.trim()) { toast({title: "Cannot save an empty message", variant: "destructive"}); return; }
    if (!activeUser?.id || !groupIdParam) { toast({title: "Authentication or Group ID Error", variant: "destructive"}); return; }
    setIsSending(true);

    const formData = new FormData();
    if (editingMessageContent) {
        formData.append('message', newMessage.trim());
    } else {
        formData.append('group', groupIdParam);
        formData.append('message', newMessage.trim());
        if (currentUser) formData.append('by_whom_student', currentUser.id);
        else if (currentTeacher) formData.append('by_whom_teacher', currentTeacher.id);
        else { toast({title: "Authentication Error", variant: "destructive"}); setIsSending(false); return; }
        if (replyingToMessageInfo) formData.append('replied_to_message', replyingToMessageInfo.id);
        if (imageFileToSend) formData.append('any_image', imageFileToSend);
    }

    try {
      if (editingMessageContent) {
        await pb.collection('discussion_form_messages').update(editingMessageContent.id, formData);
        toast({ title: "Message Updated!" });
      } else {
        await pb.collection('discussion_form_messages').create(formData);
      }
      setNewMessage(''); setImageFileToSend(null); setImagePreviewUrl(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
      setReplyingToMessageInfo(null); setEditingMessageContent(null);
      if (textareaRef.current) textareaRef.current.style.height = 'auto'; 
    } catch (err: any) {
      console.error("Failed to send/update message:", err.data || err.message, "Full Error:", err);
      toast({ title: editingMessageContent ? "Error Updating Message" : "Error Sending Message", description: err.data?.message || err.message, variant: "destructive", duration: 7000 });
    } finally { setIsSending(false); }
  };

  const handleLikeDislike = async (messageId: string, interactionType: 'like' | 'dislike') => {
    if (!activeUser?.id) { toast({ title: "Login Required", variant: "destructive" }); return; }
    if (activeUser.collectionName !== 'users') {
        toast({ title: "Interaction Not Allowed", description: "Only students and general users can like/dislike messages.", variant: "default" });
        return;
    }
    if(processingInteractionId === messageId) return;
    setProcessingInteractionId(messageId);

    const currentUserIdStr = String(activeUser.id);

    setMessages(prevMessages => prevMessages.map(msg => {
      if (msg.id === messageId) {
        let newLikeBy = [...(msg.like_by || [])];
        let newUnlikeBy = [...(msg.unlike_by || [])];
        if (interactionType === 'like') {
          if (newLikeBy.includes(currentUserIdStr)) newLikeBy = newLikeBy.filter(id => id !== currentUserIdStr);
          else { newLikeBy.push(currentUserIdStr); newUnlikeBy = newUnlikeBy.filter(id => id !== currentUserIdStr); }
        } else { // dislike
          if (newUnlikeBy.includes(currentUserIdStr)) newUnlikeBy = newUnlikeBy.filter(id => id !== currentUserIdStr);
          else { newUnlikeBy.push(currentUserIdStr); newLikeBy = newLikeBy.filter(id => id !== currentUserIdStr); }
        }
        return { ...msg, like_by: newLikeBy, unlike_by: newUnlikeBy, likes: newLikeBy.length, dislikes: newUnlikeBy.length };
      } return msg;
    }));

    try {
      const originalMessageRecord = await pb.collection('discussion_form_messages').getOne(messageId, {'$autoCancel': false});
      let originalLikeBy = Array.isArray(originalMessageRecord.like_by) ? originalMessageRecord.like_by : [];
      let originalUnlikeBy = Array.isArray(originalMessageRecord.unlike_by) ? originalMessageRecord.unlike_by : [];
      const payload: { [key: string]: string } = {};
      const wasLiked = originalLikeBy.includes(currentUserIdStr); const wasDisliked = originalUnlikeBy.includes(currentUserIdStr);
      if (interactionType === 'like') {
        if (wasLiked) payload['like_by-'] = currentUserIdStr;
        else { payload['like_by+'] = currentUserIdStr; if (wasDisliked) payload['unlike_by-'] = currentUserIdStr; }
      } else { // dislike
        if (wasDisliked) payload['unlike_by-'] = currentUserIdStr;
        else { payload['unlike_by+'] = currentUserIdStr; if (wasLiked) payload['like_by-'] = currentUserIdStr; }
      }
      await pb.collection('discussion_form_messages').update(messageId, payload);
    } catch (err) {
      console.error(`Failed to ${interactionType} message:`, err);
      toast({ title: "Error", description: "Could not record interaction. Please try again.", variant: "destructive" });
      fetchGroupDetailsAndMessages(); 
    } finally {
        setProcessingInteractionId(null);
    }
  };

  const startReply = (message: DiscussionMessage) => {
    setEditingMessageContent(null); setNewMessage(''); setImageFileToSend(null); setImagePreviewUrl(null);
    setReplyingToMessageInfo({ id: message.id, senderName: message.senderName, messageSnippet: message.message.substring(0, 30) + "...", isCurrentUserReplyTo: message.isCurrentUser });
    textareaRef.current?.focus();
  };
  const cancelReply = () => setReplyingToMessageInfo(null);

  const startEdit = (message: DiscussionMessage) => {
    setReplyingToMessageInfo(null); setImageFileToSend(null); setImagePreviewUrl(null);
    setEditingMessageContent({ id: message.id, currentText: message.message });
    setNewMessage(message.message);
    textareaRef.current?.focus();
  };
  const cancelEdit = () => { setEditingMessageContent(null); setNewMessage(''); };

  const getAvatarFallbackName = (name?: string) => name ? name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() : '?';
  
  const handleTextareaInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };
  
  const canCurrentUserLikeDislike = activeUser?.collectionName === 'users';

  if (authLoading && messages.length === 0) return (<div className="flex flex-col h-full p-4 bg-slate-100 dark:bg-slate-900"><Skeleton className="h-10 w-1/2 mb-2" /> <Skeleton className="h-6 w-3/4 mb-4" /><div className="flex-grow space-y-3"><Skeleton className="h-20 w-full rounded-lg" /><Skeleton className="h-24 w-full rounded-lg" /><Skeleton className="h-16 w-full rounded-lg" /></div><Skeleton className="h-20 w-full mt-4 rounded-lg" /></div>);

  return (
    <div className="flex flex-col h-full bg-background dark:bg-slate-950">
      <header className="p-3 sm:p-4 border-b bg-card dark:bg-slate-900 shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-muted-foreground h-8 w-8 sm:h-9 sm:w-9"><ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" /></Button>
          <div className="flex-grow min-w-0">
            <h1 className="text-md sm:text-lg font-semibold text-foreground truncate" title={groupDetails?.name || groupIdParam}>
              {isLoading && !groupDetails ? <Skeleton className="h-6 w-40 sm:w-60" /> : (groupDetails?.name || `Group: ${groupIdParam}`)}
            </h1>
            {groupDetails?.description && !isLoading && <p className="text-xs text-muted-foreground truncate hidden sm:block">{groupDetails.description}</p>}
            {isLoading && !groupDetails && <Skeleton className="h-4 w-52 sm:w-72 mt-1" />}
          </div>
        </div>
      </header>

      <ScrollArea viewportRef={scrollAreaViewportRef} className="flex-grow bg-slate-100 dark:bg-slate-900">
        <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
          {isLoading && messages.length === 0 && !error && (<div className="flex flex-col justify-center items-center h-full text-muted-foreground"><Loader2 className="h-10 w-10 animate-spin text-primary" /><p className="mt-2 text-sm">Loading messages...</p></div>)}
          {error && (<Card className="m-4 p-6 text-center bg-destructive/10 border-destructive"><AlertCircle className="mx-auto h-10 w-10 text-destructive mb-3" /><CardTitle className="text-destructive">Error</CardTitle><CardDescription className="text-destructive/90 whitespace-pre-wrap">{error}</CardDescription></Card>)}
          {!isLoading && messages.length === 0 && !error && (
            <Card className="mt-10 text-center p-8 bg-card dark:bg-slate-800/50 border-dashed border-border">
              <CardHeader className="p-0 items-center"><MessageSquareText className="h-16 w-16 text-muted-foreground/50 mb-4" /></CardHeader>
              <CardContent className="p-0 mt-2"><CardTitle className="text-xl text-foreground">It's quiet in here...</CardTitle><CardDescription className="text-md text-muted-foreground">Be the first to break the ice! <br/> Type your message below to start the conversation.</CardDescription></CardContent>
            </Card>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex gap-2 my-1", msg.isCurrentUser ? "justify-end" : "justify-start")}>
              {!msg.isCurrentUser && (
                <Avatar className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 self-end mb-0.5 border-2 border-card"><AvatarImage src={msg.senderAvatarUrl} alt={msg.senderName} /><AvatarFallback>{getAvatarFallbackName(msg.senderName)}</AvatarFallback></Avatar>
              )}
              <div className={cn("max-w-[70%] sm:max-w-[65%] flex flex-col", msg.isCurrentUser ? "items-end" : "items-start")}>
                  {!msg.isCurrentUser && <p className="text-[11px] sm:text-xs text-muted-foreground mb-0.5 ml-2">{msg.senderName}</p>}
                  <div className={cn("p-2.5 sm:p-3 rounded-xl shadow-md flex flex-col", msg.isCurrentUser ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-card text-card-foreground rounded-bl-none dark:bg-slate-800 dark:text-slate-100')}>
                  {msg.repliedToMessageId && (
                    <div className={cn("text-xs p-2 mb-2 rounded-md border-l-4", msg.repliedToIsCurrentUser ? "border-primary-foreground/50 bg-primary-foreground/10 text-primary-foreground/80" : "border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-700/50 text-muted-foreground")}>
                      <p className="font-semibold">{msg.repliedToIsCurrentUser ? "You" : msg.repliedToSenderName || "Original Sender"}</p>
                      <p className="italic truncate text-xs">"{msg.repliedToMessageSnippet}"</p>
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                  {msg.any_image && (
                    <div className="mt-2 rounded-md overflow-hidden border border-current/10 max-w-xs sm:max-w-sm">
                      <a href={msg.any_image} target="_blank" rel="noopener noreferrer"><NextImage src={msg.any_image} alt="Attached image" width={250} height={180} className="object-cover hover:opacity-90 transition-opacity" data-ai-hint="user uploaded content"/></a>
                    </div>
                  )}
                  {msg.any_link && (<div className="mt-1.5"><a href={msg.any_link} target="_blank" rel="noopener noreferrer" className="text-xs text-current/80 hover:text-current hover:underline flex items-center gap-1 break-all"><LinkIcon size={12} /> {msg.any_link.length > 35 ? msg.any_link.substring(0, 32) + '...' : msg.any_link}</a></div>)}
                  <div className={cn("flex items-center gap-1 mt-1.5", msg.isCurrentUser ? "justify-start" : "justify-end")}>
                      <Button variant="ghost" size="icon" onClick={() => handleLikeDislike(msg.id, 'like')} disabled={!canCurrentUserLikeDislike || processingInteractionId === msg.id} className={cn("h-6 w-auto p-0.5 text-xs", msg.like_by?.includes(activeUser?.id || '') ? (msg.isCurrentUser ? 'text-sky-300' : 'text-sky-500') : (msg.isCurrentUser ? 'text-primary-foreground/60 hover:text-primary-foreground/90' : 'text-muted-foreground/70 hover:text-muted-foreground'))} title={!canCurrentUserLikeDislike ? "Teachers cannot like/dislike" : "Like"}><ThumbsUp size={12} /><span className="ml-0.5 text-[10px]">{msg.likes || 0}</span></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleLikeDislike(msg.id, 'dislike')} disabled={!canCurrentUserLikeDislike || processingInteractionId === msg.id} className={cn("h-6 w-auto p-0.5 text-xs", msg.unlike_by?.includes(activeUser?.id || '') ? (msg.isCurrentUser ? 'text-orange-300' : 'text-orange-500') : (msg.isCurrentUser ? 'text-primary-foreground/60 hover:text-primary-foreground/90' : 'text-muted-foreground/70 hover:text-muted-foreground'))} title={!canCurrentUserLikeDislike ? "Teachers cannot like/dislike" : "Dislike"}><ThumbsDown size={12} /><span className="ml-0.5 text-[10px]">{msg.dislikes || 0}</span></Button>
                      {!msg.isCurrentUser && <Button variant="ghost" size="icon" onClick={() => startReply(msg)} className="h-6 w-6 p-0.5 text-muted-foreground/70 hover:text-muted-foreground"><MessageSquareReply size={12} /></Button>}
                      {currentTeacher && (msg.isCurrentUser || currentTeacher.id === msg.by_whom_teacher_id) && (
                         <Button variant="ghost" size="icon" onClick={() => startEdit(msg)} className={cn("h-6 w-6 p-0.5", msg.isCurrentUser ? 'text-primary-foreground/60 hover:text-primary-foreground/90' : 'text-muted-foreground/70 hover:text-muted-foreground')}><EditIcon size={12} /></Button>
                      )}
                  </div>
                  <p className={cn("text-[10px] mt-0.5", msg.isCurrentUser ? 'text-primary-foreground/50 text-left' : 'text-muted-foreground/60 text-right')}>{formatDistanceToNow(new Date(msg.created), { addSuffix: true })}</p>
                  </div>
              </div>
              {msg.isCurrentUser && (
                <Avatar className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 self-end mb-0.5 border-2 border-card"><AvatarImage src={msg.senderAvatarUrl} alt={msg.senderName} /><AvatarFallback>{getAvatarFallbackName(msg.senderName)}</AvatarFallback></Avatar>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-3 sm:p-4 border-t bg-slate-100 dark:bg-slate-800 sticky bottom-0 flex flex-col gap-2">
        {(replyingToMessageInfo || editingMessageContent) && (
          <div className="text-xs text-muted-foreground px-2 py-1.5 bg-background dark:bg-slate-700 rounded-md flex justify-between items-center">
            {replyingToMessageInfo && <span>Replying to <span className="font-semibold">{replyingToMessageInfo.isCurrentUserReplyTo ? "You" : replyingToMessageInfo.senderName}</span>: "{replyingToMessageInfo.messageSnippet}"</span>}
            {editingMessageContent && <span>Editing message...</span>}
            <Button type="button" variant="ghost" size="icon" onClick={editingMessageContent ? cancelEdit : cancelReply} className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"><X size={12} /></Button>
          </div>
        )}
        {imagePreviewUrl && (
          <div className="relative w-24 h-24 p-1 border rounded-md bg-muted/30 dark:bg-slate-700/50 self-start">
            <NextImage src={imagePreviewUrl} alt="Selected image preview" layout="fill" objectFit="cover" className="rounded" data-ai-hint="image preview"/>
            <Button type="button" variant="destructive" size="icon" onClick={removeSelectedImage} className="absolute -top-2 -right-2 h-5 w-5 rounded-full shadow-md"> <Trash2 size={10} /> <span className="sr-only">Remove image</span> </Button>
          </div>
        )}
        <form onSubmit={handleSendMessage} className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={newMessage}
              onChange={handleTextareaInput}
              placeholder={editingMessageContent ? "Edit your message..." : "Type your message..."}
              className="flex-grow resize-none min-h-[40px] max-h-[120px] rounded-lg py-2 px-4 text-sm bg-background dark:bg-slate-700 border-slate-300 dark:border-slate-600 focus:border-primary focus:ring-1 focus:ring-primary"
              rows={1}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && (newMessage.trim() || imageFileToSend)) { e.preventDefault(); handleSendMessage(); }}}
              disabled={isSending || !activeUser}
            />
            <Button type="button" variant="ghost" size="icon" onClick={() => imageInputRef.current?.click()} disabled={isSending || !activeUser || !!editingMessageContent} className="rounded-full w-10 h-10 text-muted-foreground hover:text-primary self-end flex-shrink-0"> <Paperclip className="h-5 w-5" /> <span className="sr-only">Attach Image</span> </Button>
            <input type="file" ref={imageInputRef} accept="image/*" onChange={handleImageFileChange} className="hidden" disabled={isSending || !activeUser || !!editingMessageContent} />
            <Button type="submit" size="icon" disabled={isSending || (!newMessage.trim() && !imageFileToSend && !editingMessageContent) || !activeUser} className="rounded-full w-10 h-10 bg-primary text-primary-foreground hover:bg-primary/90 self-end flex-shrink-0"> {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />} <span className="sr-only">{editingMessageContent ? "Save Edit" : "Send Message"}</span> </Button>
        </form>
      </div>
    </div>
  );
}

    
