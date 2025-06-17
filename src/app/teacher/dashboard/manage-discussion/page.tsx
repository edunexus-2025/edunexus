
'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DiscussionGroupManagementFormSchema, type DiscussionGroupManagementInput } from '@/lib/schemas';
import type { User } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import { useToast } from '@/hooks/use-toast';
import { Users2, PlusCircle, Edit, Trash2, Search, Loader2, AlertCircle, Save, MessageSquare, PencilLine, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { escapeForPbFilter, Routes } from '@/lib/constants';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface DiscussionGroupRecord extends RecordModel {
  group_name: string;
  group_description?: string;
  teacher: string[];
  students?: string[];
  EduNexus_plan?: string;
  teacher_plan?: string;
  created: string;
  updated: string;
}

const mapRecordToUserDisplay = (record: RecordModel | undefined): User | null => {
  if (!record) return null;
  return {
    id: record.id,
    email: record.email || 'N/A',
    name: record.name || 'Unnamed User',
    avatarUrl: record.avatarUrl || (record.avatar ? pb.files.getUrl(record, record.avatar as string, {'thumb': '50x50'}) : `https://ui-avatars.com/api/?name=${encodeURIComponent(record.name?.charAt(0) || 'S')}&background=random&color=fff&size=64`),
    role: record.role as User['role'],
    studentSubscriptionTier: record.model as User['studentSubscriptionTier'],
    collectionId: record.collectionId,
    collectionName: record.collectionName,
  };
};

export default function ManageDiscussionGroupsPage() {
  const { teacher, isLoadingTeacher } = useAuth();
  const { toast } = useToast();

  const [groups, setGroups] = useState<DiscussionGroupRecord[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingGroup, setEditingGroup] = useState<DiscussionGroupRecord | null>(null);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [allTeacherStudents, setAllTeacherStudents] = useState<User[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [studentSearchTermForm, setStudentSearchTermForm] = useState(''); 
  const [mainPageSearchTerm, setMainPageSearchTerm] = useState(''); 

  const teacherId = teacher?.id;

  const form = useForm<DiscussionGroupManagementInput>({
    resolver: zodResolver(DiscussionGroupManagementFormSchema),
    defaultValues: {
      group_name: '',
      group_description: '',
      students: [],
    },
  });

  const fetchGroups = useCallback(async (isMountedGetter: () => boolean = () => true) => {
    if (!teacherId) {
      if (isMountedGetter()) { setIsLoadingGroups(false); setGroups([]); }
      return;
    }
    if (isMountedGetter()) setIsLoadingGroups(true);
    try {
      const records = await pb.collection('discussion_groups_data').getFullList<DiscussionGroupRecord>({
        filter: `teacher ~ "${teacherId}"`,
        sort: '-updated', 
        expand: 'students',
      });
      if (isMountedGetter()) setGroups(records);
    } catch (err: any) {
      if (isMountedGetter()) {
        console.error("Failed to fetch groups:", err.data || err);
        setError(`Could not load groups. Error: ${err.data?.message || err.message}`);
      }
    } finally {
      if (isMountedGetter()) setIsLoadingGroups(false);
    }
  }, [teacherId]);

  const fetchStudentsForTeacher = useCallback(async (isMountedGetter: () => boolean = () => true) => {
    if (!teacherId) {
      if (isMountedGetter()) setAllTeacherStudents([]);
      return;
    }
    if (isMountedGetter()) setIsLoadingStudents(true);
    try {
      const studentRecords = await pb.collection('users').getFullList<RecordModel>({
        filter: `subscription_by_teacher = "${teacherId}" && role = "User"`,
        fields: 'id,name,email,avatar,avatarUrl,collectionId,collectionName,model,role',
      });
      if (isMountedGetter()) {
        const mappedStudents = studentRecords.map(mapRecordToUserDisplay).filter(s => s !== null) as User[];
        setAllTeacherStudents(mappedStudents);
      }
    } catch (err: any) {
      if (isMountedGetter()) {
        console.error("Failed to fetch students for teacher:", err.data || err);
        toast({ title: "Error", description: "Could not load your student list.", variant: "destructive" });
      }
    } finally {
      if (isMountedGetter()) setIsLoadingStudents(false);
    }
  }, [teacherId, toast]);

  useEffect(() => {
    let isMounted = true;
    if (!isLoadingTeacher && teacherId) {
      fetchGroups(() => isMounted);
      fetchStudentsForTeacher(() => isMounted);
    } else if (!isLoadingTeacher && !teacherId) {
      setIsLoadingGroups(false);
      setIsLoadingStudents(false);
      setError("Teacher not authenticated.");
    }
    return () => { isMounted = false; };
  }, [isLoadingTeacher, teacherId, fetchGroups, fetchStudentsForTeacher]);

  const handleEditGroup = (group: DiscussionGroupRecord) => {
    setEditingGroup(group);
    form.reset({
      group_name: group.group_name,
      group_description: group.group_description || '',
      students: group.students || [],
    });
    setShowCreateForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateNewGroup = () => {
    setEditingGroup(null);
    form.reset({ group_name: '', group_description: '', students: [] });
    setShowCreateForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (!confirm(`Are you sure you want to delete the group "${groupName}"?`)) return;
    try {
      await pb.collection('discussion_groups_data').delete(groupId);
      toast({ title: "Group Deleted", description: `Group "${groupName}" has been removed.` });
      fetchGroups();
    } catch (error: any) {
      toast({ title: "Deletion Failed", description: error.data?.message || error.message, variant: "destructive" });
    }
  };

  const onSubmitForm = async (values: DiscussionGroupManagementInput) => {
    if (!teacherId) {
      toast({ title: "Error", description: "Teacher ID is missing.", variant: "destructive" });
      return;
    }
    setIsSubmittingForm(true);
    
    const dataToSave = {
      teacher: teacherId ? [teacherId] : null,
      group_name: values.group_name,
      group_description: values.group_description || null,
      students: values.students && values.students.length > 0 ? values.students : null,
      EduNexus_plan: null,
      teacher_plan: null,
    };

    try {
      if (editingGroup) {
        await pb.collection('discussion_groups_data').update(editingGroup.id, dataToSave);
        toast({ title: "Group Updated", description: `"${values.group_name}" has been updated.` });
      } else {
        await pb.collection('discussion_groups_data').create(dataToSave);
        toast({ title: "Group Created", description: `"${values.group_name}" has been created.` });
      }
      fetchGroups();
      setShowCreateForm(false);
      setEditingGroup(null);
      form.reset({ group_name: '', group_description: '', students: [] });
    } catch (error: any) {
      const clientError = error as ClientResponseError;
      let detailedMessage = "An unexpected error occurred while saving the group.";
      if (clientError.data?.message?.includes("Failed to create record.") && clientError.data?.data && Object.keys(clientError.data.data).length === 0) {
        detailedMessage = `Error: ${clientError.data.message}. This often means a server-side API rule was not met or a required field (as defined on the server) is missing or has an incorrect type. Specifically, ensure your 'Create Rule' for 'discussion_groups_data' collection allows the 'teacher' field (if it's multi-select and sent as an array like [teacherId]) to be compared correctly (e.g., using '@request.data.teacher[0] = @request.auth.id'). Please check the PocketBase server logs for more specific details.`;
      } else if (clientError.data?.message) {
        detailedMessage = clientError.data.message;
      } else if (clientError.data?.data && typeof clientError.data.data === 'object') {
        detailedMessage = Object.entries(clientError.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
      } else if (clientError.message) {
        detailedMessage = clientError.message;
      }
      toast({ title: "Save Failed", description: detailedMessage, variant: "destructive", duration: 12000 });
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const filteredStudentsForSelection = allTeacherStudents.filter(student =>
    student.name.toLowerCase().includes(studentSearchTermForm.toLowerCase()) ||
    (student.email && student.email.toLowerCase().includes(studentSearchTermForm.toLowerCase()))
  );

  const filteredGroupsForDisplay = groups.filter(group => 
    group.group_name.toLowerCase().includes(mainPageSearchTerm.toLowerCase()) ||
    (group.group_description && group.group_description.toLowerCase().includes(mainPageSearchTerm.toLowerCase()))
  );

  if (isLoadingTeacher) {
    return <div className="p-6"><Skeleton className="h-12 w-1/2 mb-4" /><Skeleton className="h-64 w-full" /></div>;
  }
  if (!teacherId && !isLoadingTeacher) {
    return <div className="p-6 text-center text-destructive">Error: Teacher not authenticated. Please login again.</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-var(--header-height,0px))] bg-background dark:bg-slate-900">
      <header className="p-4 border-b bg-card shadow-sm sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Manage Discussion</h1>
          <Button variant="outline" size="sm" onClick={handleCreateNewGroup} aria-label="Create new group">
            <PlusCircle className="h-4 w-4 mr-2" /> Create New Group
          </Button>
        </div>
        <div className="mt-3 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search groups or start a new one"
            className="pl-9 w-full bg-muted dark:bg-slate-800 border-transparent focus:border-primary focus:bg-background dark:focus:bg-slate-700"
            value={mainPageSearchTerm}
            onChange={(e) => setMainPageSearchTerm(e.target.value)}
          />
        </div>
      </header>

      {showCreateForm && (
        <div className="p-4 md:p-6 border-b bg-card shadow-md">
          <Card className="shadow-none border-0">
            <CardHeader className="px-0 pt-0">
              <CardTitle>{editingGroup ? "Edit Group" : "Create New Group"}</CardTitle>
              <CardDescription>{editingGroup ? "Update the details of this group." : "Set up a new discussion group."}</CardDescription>
            </CardHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitForm)}>
                <CardContent className="space-y-4 px-0">
                  <FormField control={form.control} name="group_name" render={({ field }) => (<FormItem><FormLabel>Group Name *</FormLabel><FormControl><Input placeholder="e.g., JEE Physics Batch 1" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                  <FormField control={form.control} name="group_description" render={({ field }) => (<FormItem><FormLabel>Group Description (Optional)</FormLabel><FormControl><Textarea placeholder="A brief description..." {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)}/>
                  <FormField control={form.control} name="students" render={() => (
                    <FormItem>
                      <FormLabel>Select Students (Optional)</FormLabel>
                      <div className="relative my-1"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input type="search" placeholder="Search students..." className="pl-8" value={studentSearchTermForm} onChange={(e) => setStudentSearchTermForm(e.target.value)} /></div>
                      {isLoadingStudents ? <Skeleton className="h-32 w-full" /> : allTeacherStudents.length === 0 ? <p className="text-xs text-muted-foreground">No students linked.</p> : filteredStudentsForSelection.length === 0 && studentSearchTermForm ? <p className="text-xs text-muted-foreground">No students match search.</p> :
                        <ScrollArea className="h-40 rounded-md border p-2"><div className="space-y-1">
                          {filteredStudentsForSelection.map((student) => (<FormField key={student.id} control={form.control} name="students" render={({ field: checkboxField }) => (
                            <FormItem className="flex flex-row items-center space-x-2 space-y-0 p-1.5 hover:bg-muted/50 rounded-md"><FormControl><Checkbox checked={checkboxField.value?.includes(student.id)} onCheckedChange={(checked) => checkboxField.onChange(checked ? [...(checkboxField.value || []), student.id] : checkboxField.value?.filter(id => id !== student.id))} /></FormControl>
                              <FormLabel className="font-normal text-xs flex items-center gap-1.5 cursor-pointer w-full"><Avatar className="h-6 w-6 text-xs"><AvatarImage src={student.avatarUrl} alt={student.name} /><AvatarFallback>{student.name.charAt(0).toUpperCase()}</AvatarFallback></Avatar>{student.name}</FormLabel>
                            </FormItem>)} />))}
                        </div></ScrollArea>}
                      <FormMessage />
                    </FormItem>)}/>
                </CardContent>
                <CardFooter className="px-0 pb-0 pt-4 flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => { setShowCreateForm(false); setEditingGroup(null); }} disabled={isSubmittingForm}>Cancel</Button>
                  <Button type="submit" disabled={isSubmittingForm}>{isSubmittingForm && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingGroup ? "Save Changes" : "Create Group"}</Button>
                </CardFooter>
              </form>
            </Form>
          </Card>
        </div>
      )}

      <ScrollArea className="flex-grow">
        <div className="p-2 space-y-0.5">
          {isLoadingGroups && groups.length === 0 && !error && (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
          )}
          {error && !isLoadingGroups && (
            <Card className="m-4 p-6 text-center bg-destructive/10 border-destructive"><AlertCircle className="mx-auto h-10 w-10 text-destructive mb-3" /><CardTitle className="text-destructive">Error Loading Groups</CardTitle><CardDescription className="text-destructive/80 whitespace-pre-wrap">{error}</CardDescription></Card>
          )}
          {!isLoadingGroups && filteredGroupsForDisplay.length === 0 && !error && (
            <div className="text-center text-muted-foreground py-10 px-4"><MessageSquare className="mx-auto h-12 w-12 mb-2" /><p>{mainPageSearchTerm ? "No groups match your search." : "No discussion groups yet. Click 'Create New Group' to start!"}</p></div>
          )}
          
          {!isLoadingGroups && filteredGroupsForDisplay.length > 0 && !error && (
            filteredGroupsForDisplay.map(group => (
              <Link key={group.id} href={Routes.discussionForumGroup(group.id)} passHref>
                <div className="flex items-center gap-3 p-3 hover:bg-muted dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={`https://ui-avatars.com/api/?name=${encodeURIComponent(group.group_name.charAt(0))}&background=random&color=fff&size=128`} alt={group.group_name} data-ai-hint="group chat community"/>
                    <AvatarFallback>{group.group_name.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-grow min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{group.group_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{group.group_description || `Students: ${group.students?.length || 0}`}</p>
                  </div>
                  <div className="text-xs text-muted-foreground text-right flex-shrink-0">
                    {format(new Date(group.updated), "p")}
                    <div className="mt-1 flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={(e) => { e.preventDefault(); handleEditGroup(group);}}><Edit2 size={14}/></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={(e) => { e.preventDefault(); handleDeleteGroup(group.id, group.group_name);}}><Trash2 size={14}/></Button>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
