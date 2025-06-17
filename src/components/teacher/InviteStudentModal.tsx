
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from "@/components/ui/card";
import { useToast } from '@/hooks/use-toast';
import pb from '@/lib/pocketbase';
import type { User } from '@/lib/types';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import { Search, UserPlus, Loader2, Check } from 'lucide-react';
import { escapeForPbFilter } from '@/lib/constants';

interface InviteStudentModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  teacherId: string;
  teacherName?: string;
  currentStudentIds: string[];
}

const mapRecordToStudentDisplay = (record: RecordModel | undefined): User | null => {
  if (!record) return null;
  return {
    id: record.id,
    email: record.email || 'N/A',
    name: record.name || 'Unnamed User',
    avatarUrl: record.avatarUrl || (record.avatar ? pb.files.getUrl(record, record.avatar as string) : `https://ui-avatars.com/api/?name=${encodeURIComponent(record.name?.charAt(0) || 'S')}&background=random&color=fff&size=128`),
    studentSubscriptionTier: record.model as User['studentSubscriptionTier'] || undefined, // Changed N/A to undefined
    role: record.role as User['role'],
    collectionId: record.collectionId,
    collectionName: record.collectionName,
  };
};


export function InviteStudentModal({
  isOpen,
  onOpenChange,
  teacherId,
  teacherName = "Your Teacher",
  currentStudentIds,
}: InviteStudentModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [invitedStudentIds, setInvitedStudentIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const fetchStudentsToInvite = useCallback(async () => {
    if (!searchTerm.trim() || !teacherId) {
      setSearchResults([]);
      return;
    }
    setIsLoadingSearch(true);
    setSearchResults([]); 

    const searchTermEscaped = escapeForPbFilter(searchTerm.trim());
    const filterParts = [
      `(name ~ "${searchTermEscaped}" || email ~ "${searchTermEscaped}")`,
      `role = "User"`, 
      `id != "${teacherId}"`, 
    ];

    const filterString = filterParts.join(' && ');
    console.log("InviteStudentModal: Searching students with filter:", filterString);
    
    try {
      const records = await pb.collection('users').getFullList<RecordModel>({
        filter: filterString,
        fields: 'id,name,email,avatarUrl,role,model,avatar,collectionId,collectionName', 
      });

      const mappedResults = records
        .map(mapRecordToStudentDisplay)
        .filter(u => u !== null && !currentStudentIds.includes(u.id)) as User[];
      
      setSearchResults(mappedResults);
      if (mappedResults.length === 0) {
        console.log("InviteStudentModal: No students found matching the filter or all found are already linked.");
      }

    } catch (error: any) {
      const clientError = error as ClientResponseError;
      if (clientError?.isAbort || (clientError?.name === 'ClientResponseError' && clientError?.status === 0)) {
        console.warn('InviteStudentModal: Search students request was cancelled.');
      } else {
        let errorDesc = `Could not fetch students. Error: ${clientError.data?.message || clientError.message || 'Unknown error'}.`;
        if (clientError.status === 400 || clientError.status === 403) {
          errorDesc += " Please ensure the API List Rule for the 'users' collection allows teachers to view students, and that student 'role' fields are correctly set to 'User'.";
        }
        console.error('InviteStudentModal: Failed to search students. Filter:', filterString, 'Error details:', clientError);
        toast({
          title: 'Error Searching Students',
          description: errorDesc,
          variant: 'destructive',
          duration: 7000,
        });
      }
      setSearchResults([]);
    } finally {
      setIsLoadingSearch(false);
    }
  }, [searchTerm, teacherId, currentStudentIds, toast]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchTerm.trim().length >= 3) { 
        fetchStudentsToInvite();
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchTerm, fetchStudentsToInvite]);

  const handleSendInvitation = async (studentToInvite: User) => {
    if (!teacherId || !studentToInvite.id) return;

    setInvitedStudentIds(prev => new Set(prev).add(studentToInvite.id));

    const notificationData = {
      bywho: teacherId,
      towho: [studentToInvite.id], 
      message: `${teacherName} has invited you to join their student group. Please check your notifications to accept or decline.`,
      seen: false,
      deleted: false,
      approved: false, 
      type: 'invitation', // Added type
    };

    try {
      await pb.collection('notification').create(notificationData);
      toast({
        title: 'Invitation Sent!',
        description: `An invitation has been sent to ${studentToInvite.name}.`,
      });
    } catch (error: any) {
      console.error('InviteStudentModal: Failed to send invitation:', error);
      toast({
        title: 'Error Sending Invitation',
        description: error.data?.message || error.message || 'Could not send invitation.',
        variant: 'destructive',
      });
      setInvitedStudentIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(studentToInvite.id);
        return newSet;
      });
    }
  };

  const getAvatarFallback = (name: string) => {
    const nameParts = name.split(' ');
    return nameParts.length > 1 ? nameParts[0][0] + nameParts[nameParts.length - 1][0] : name.substring(0, 2).toUpperCase();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-6 w-6 text-primary" /> Invite Students
          </DialogTitle>
          <DialogDescription>
            Search for students by name or email (min. 3 characters) to invite them to your group.
          </DialogDescription>
        </DialogHeader>

        <div className="relative my-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by name or email..."
            className="pl-9 w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <ScrollArea className="flex-grow min-h-0 p-1"> {/* Adjusted padding */}
          {isLoadingSearch && (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          {!isLoadingSearch && searchResults.length > 0 && (
            <div className="space-y-3">
              {searchResults.map((student) => (
                <Card key={student.id} className="p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-grow min-w-0">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={student.avatarUrl} alt={student.name} />
                        <AvatarFallback>{getAvatarFallback(student.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate text-foreground" title={student.name}>{student.name}</p>
                        <p className="text-xs text-muted-foreground truncate" title={student.email}>{student.email}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={invitedStudentIds.has(student.id) ? "outline" : "default"}
                      onClick={() => handleSendInvitation(student)}
                      disabled={invitedStudentIds.has(student.id)}
                      className="flex-shrink-0"
                    >
                      {invitedStudentIds.has(student.id) ? (
                        <>
                          <Check className="mr-1.5 h-4 w-4" /> Invited
                        </>
                      ) : (
                        <>
                         <UserPlus className="mr-1.5 h-4 w-4" /> Invite
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
          {!isLoadingSearch && searchTerm.trim().length >= 3 && searchResults.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No students found matching your search, or they are already in your group.</p>
          )}
           {!isLoadingSearch && searchTerm.trim().length < 3 && searchResults.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Enter at least 3 characters to search.</p>
          )}
        </ScrollArea>

        <DialogFooter className="mt-auto pt-4 border-t">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    