
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import pb from '@/lib/pocketbase';
import type { User } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { UserPlus, Users as UsersIcon, AlertCircle, Search, RefreshCw, BarChart3, Check } from 'lucide-react';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { escapeForPbFilter } from '@/lib/constants';
import { Loader2 } from 'lucide-react';


interface StudentDisplayInfo extends User {
  // Add any student-specific display fields if needed
}

const mapRecordToStudentDisplay = (record: RecordModel | undefined): StudentDisplayInfo | null => {
  if (!record) return null;
  return {
    id: record.id,
    email: record.email || 'N/A',
    name: record.name || 'Unnamed User',
    avatarUrl: record.avatarUrl || (record.avatar ? pb.files.getUrl(record, record.avatar as string) : `https://ui-avatars.com/api/?name=${encodeURIComponent(record.name?.charAt(0) || 'S')}&background=random&color=fff&size=128`),
    studentSubscriptionTier: record.model as User['studentSubscriptionTier'] || undefined,
    grade: record.class,
    favExam: record.favExam,
    joineddate: record.joineddate,
    created: record.created,
    phoneNumber: record.phone,
    role: record.role as User['role'],
    targetYear: record.targetYear,
    totalPoints: record.totalPoints,
    teacherSubscriptionTier: undefined,
    institute_name: undefined,
    total_students: undefined,
    level: undefined,
    EduNexus_Name: undefined,
    teacherFavExams: undefined,
    about: undefined,
    subjects_offered: undefined,
    used_free_trial: undefined,
    collectionId: record.collectionId,
    collectionName: record.collectionName,
    emailVisibility: record.emailVisibility,
    username: record.username,
    verified: record.verified,
    updated: record.updated,
    referralCode: record.referralCode,
    referredByCode: record.referredByCode,
    referralStats: record.referralStats,
    studyPlan: record.studyPlan,
    subscription_by_teacher: record.subscription_by_teacher,
  };
};

interface AddStudentModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  teacherId: string;
  currentStudentIds: string[];
  onStudentAdded: () => void; // Callback to refresh student list
}

function AddStudentModal({
  isOpen,
  onOpenChange,
  teacherId,
  currentStudentIds,
  onStudentAdded,
}: AddStudentModalProps) {
  const [searchTermModal, setSearchTermModal] = useState('');
  const [searchResultsModal, setSearchResultsModal] = useState<User[]>([]);
  const [isLoadingSearchModal, setIsLoadingSearchModal] = useState(false);
  const [addedStudentIdsModal, setAddedStudentIdsModal] = useState<Set<string>>(new Set());
  const [processingStudentId, setProcessingStudentId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchStudentsToModal = useCallback(async () => {
    if (!searchTermModal.trim() || !teacherId) {
      setSearchResultsModal([]);
      return;
    }
    setIsLoadingSearchModal(true);
    setSearchResultsModal([]);

    const searchTermEscaped = escapeForPbFilter(searchTermModal.trim());
    const filterParts = [
      `(name ~ "${searchTermEscaped}" || email ~ "${searchTermEscaped}")`,
      `role = "User"`,
      `id != "${teacherId}"`,
    ];

    const filterString = filterParts.join(' && ');
    console.log("AddStudentModal: Searching students with filter:", filterString);

    try {
      const records = await pb.collection('users').getFullList<RecordModel>({
        filter: filterString,
        fields: 'id,name,email,avatarUrl,role,model,avatar,collectionId,collectionName,subscription_by_teacher',
      });

      const mappedResults = records
        .map(mapRecordToStudentDisplay)
        .filter(u => {
            if (u === null) return false;
            // Exclude if already in teacher's list OR if already added in this session
            const isAlreadySubscribed = u.subscription_by_teacher?.includes(teacherId) || currentStudentIds.includes(u.id);
            return !isAlreadySubscribed;
        }) as User[];
      
      setSearchResultsModal(mappedResults);
      if (mappedResults.length === 0) {
        console.log("AddStudentModal: No students found matching filter or all found are already linked/added.");
      }

    } catch (error: any) {
      // Error handling (same as before)
      const clientError = error as ClientResponseError;
      if (clientError?.isAbort || (clientError?.name === 'ClientResponseError' && clientError?.status === 0)) {
        console.warn('AddStudentModal: Search students request was cancelled.');
      } else {
        let errorDesc = `Could not fetch students. Error: ${clientError.data?.message || clientError.message || 'Unknown error'}.`;
        if (clientError.status === 400 || clientError.status === 403) {
          errorDesc += " Please ensure the API List Rule for 'users' collection allows appropriate access.";
        }
        console.error('AddStudentModal: Failed to search students. Filter:', filterString, 'Error details:', clientError);
        toast({ title: 'Error Searching Students', description: errorDesc, variant: 'destructive', duration: 7000 });
      }
      setSearchResultsModal([]);
    } finally {
      setIsLoadingSearchModal(false);
    }
  }, [searchTermModal, teacherId, currentStudentIds, toast]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchTermModal.trim().length >= 3) {
        fetchStudentsToModal();
      } else {
        setSearchResultsModal([]);
      }
    }, 500);
    return () => clearTimeout(debounceTimer);
  }, [searchTermModal, fetchStudentsToModal]);

  const handleAddStudentToTeacher = async (studentToAdd: User) => {
    if (!teacherId || !studentToAdd.id) return;
    setProcessingStudentId(studentToAdd.id);

    try {
      // Update the student's record to add this teacher to their `subscription_by_teacher`
      await pb.collection('users').update(studentToAdd.id, {
        "subscription_by_teacher+": teacherId,
      });
      
      toast({
        title: 'Student Added!',
        description: `${studentToAdd.name} has been successfully added to your students list.`,
      });
      setAddedStudentIdsModal(prev => new Set(prev).add(studentToAdd.id));
      onStudentAdded(); // Trigger refresh on the parent page
    } catch (error: any) {
      console.error('AddStudentModal: Failed to add student:', error.data?.data || error.message, "Full error:", error);
      let errorMsg = `Could not add ${studentToAdd.name}. Please try again.`;
      if (error.data?.data) {
        errorMsg = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
      } else if (error.message) {
        errorMsg = error.message;
      }
      toast({
        title: 'Error Adding Student',
        description: errorMsg,
        variant: 'destructive',
      });
      setAddedStudentIdsModal(prev => {
        const newSet = new Set(prev);
        newSet.delete(studentToAdd.id); // Revert if error
        return newSet;
      });
    } finally {
      setProcessingStudentId(null);
    }
  };

  const getAvatarFallbackModal = (name: string) => {
    const nameParts = name.split(' ');
    return nameParts.length > 1 ? nameParts[0][0] + nameParts[nameParts.length - 1][0] : name.substring(0, 2).toUpperCase();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-6 w-6 text-primary" /> Add Students to Your Roster
          </DialogTitle>
          <DialogDescription>
            Search for students by name or email (min. 3 characters) to add them directly.
          </DialogDescription>
        </DialogHeader>

        <div className="relative my-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by name or email..."
            className="pl-9 w-full"
            value={searchTermModal}
            onChange={(e) => setSearchTermModal(e.target.value)}
          />
        </div>

        <ScrollArea className="flex-grow min-h-0 p-1">
          {isLoadingSearchModal && (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          {!isLoadingSearchModal && searchResultsModal.length > 0 && (
            <div className="space-y-3">
              {searchResultsModal.map((student) => (
                <Card key={student.id} className="p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-grow min-w-0">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={student.avatarUrl} alt={student.name} />
                        <AvatarFallback>{getAvatarFallbackModal(student.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate text-foreground" title={student.name}>{student.name}</p>
                        <p className="text-xs text-muted-foreground truncate" title={student.email}>{student.email}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={addedStudentIdsModal.has(student.id) ? "outline" : "default"}
                      onClick={() => handleAddStudentToTeacher(student)}
                      disabled={addedStudentIdsModal.has(student.id) || processingStudentId === student.id}
                      className="flex-shrink-0"
                    >
                      {processingStudentId === student.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : 
                       addedStudentIdsModal.has(student.id) ? <Check className="mr-1.5 h-4 w-4" /> : <UserPlus className="mr-1.5 h-4 w-4" />}
                      {processingStudentId === student.id ? 'Adding...' : (addedStudentIdsModal.has(student.id) ? 'Added' : 'Add Student')}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
          {!isLoadingSearchModal && searchTermModal.trim().length >= 3 && searchResultsModal.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No students found matching your search, or they are already associated with you.</p>
          )}
          {!isLoadingSearchModal && searchTermModal.trim().length < 3 && searchResultsModal.length === 0 && (
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


export default function TeacherMyStudentsPage() {
  const { teacher, isLoadingTeacher } = useAuth();
  const { toast } = useToast(); // Main page toast
  const [students, setStudents] = useState<StudentDisplayInfo[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTermMain, setSearchTermMain] = useState(''); // Separate search for main page
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);

  const fetchStudents = useCallback(async () => {
    if (!teacher?.id) {
      setIsLoadingStudents(false);
      setStudents([]);
      return;
    }

    setIsLoadingStudents(true);
    setError(null);
    setStudents([]); 

    try {
      const filterString = `subscription_by_teacher = "${teacher.id}"`;
      console.log(`Fetching students for teacher ID: ${teacher.id} with filter: ${filterString}`);
      
      const studentRecords = await pb.collection('users').getFullList<RecordModel>({
        filter: filterString,
        fields: 'id,name,email,avatarUrl,model,class,favExam,joineddate,created,phone,role,targetYear,totalPoints,avatar,collectionId,collectionName,subscription_by_teacher',
      });
      
      console.log(`Fetched ${studentRecords.length} student records directly.`);
      
      const mappedStudents = studentRecords.map(mapRecordToStudentDisplay).filter(s => s !== null) as StudentDisplayInfo[];
      
      setStudents(mappedStudents);
      if(mappedStudents.length === 0) {
        console.log("No students found linked to this teacher via 'subscription_by_teacher'.");
      }

    } catch (err: any) {
      const clientError = err as ClientResponseError;
      if (clientError?.isAbort || (clientError?.name === 'ClientResponseError' && clientError?.status === 0)) {
        console.warn('TeacherMyStudentsPage: Fetch students request was cancelled.');
      } else {
        let detailedErrorMessage = `Could not load students. Error: ${clientError?.data?.message || clientError?.message || 'Unknown error'}.`;
        if (clientError?.status === 404) {
             detailedErrorMessage += " Ensure the 'users' collection exists and the filter is correct."
        } else if (clientError?.status === 400 || clientError?.status === 403) {
            detailedErrorMessage += ` This often indicates an issue with the 'users' collection API List Rule. Please verify these in PocketBase. Ensure 'users' collection List Rule allows teachers to view students, and that 'subscription_by_teacher' is filterable.`;
        }
        console.error("TeacherMyStudentsPage: Failed to fetch students. Full error:", clientError);
        setError(detailedErrorMessage);
        toast({
            title: "Error Fetching Students",
            description: detailedErrorMessage,
            variant: "destructive",
            duration: 9000,
        });
      }
    } finally {
      setIsLoadingStudents(false);
    }
  }, [teacher?.id, toast]);

  useEffect(() => {
    if (!isLoadingTeacher && teacher) {
      fetchStudents();
    } else if (!isLoadingTeacher && !teacher) {
      setIsLoadingStudents(false);
      setStudents([]);
      setError("Teacher not authenticated.");
    }
  }, [isLoadingTeacher, teacher, fetchStudents]);

  const filteredStudentsMain = students.filter(student =>
    student.name.toLowerCase().includes(searchTermMain.toLowerCase()) ||
    (student.email && student.email.toLowerCase().includes(searchTermMain.toLowerCase()))
  );

  const getAvatarFallbackMain = (name: string) => {
    const nameParts = name.split(' ');
    return nameParts.length > 1 ? nameParts[0][0] + nameParts[nameParts.length - 1][0] : name.substring(0, 2).toUpperCase();
  };

  if (isLoadingTeacher || (!teacher && isLoadingStudents)) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="space-y-1"> <Skeleton className="h-9 w-64" /> <Skeleton className="h-4 w-80" /> </div>
          <Skeleton className="h-10 w-full sm:w-40 rounded-md" />
        </div>
        <Skeleton className="h-10 w-full md:w-1/3 rounded-md mb-4" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6 p-2 sm:p-4 md:p-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <CardTitle className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground flex items-center">
              <UsersIcon className="mr-2 sm:mr-3 h-6 w-6 sm:h-7 sm:w-7 text-primary" /> My Students
            </CardTitle>
            <CardDescription className="text-sm sm:text-base">
              View and manage students linked to your teacher account.
            </CardDescription>
          </div>
          <Button onClick={() => setIsAddStudentModalOpen(true)} className="w-full md:w-auto mt-2 md:mt-0">
            <UserPlus className="mr-2 h-4 sm:h-5 w-4 sm:w-5" /> Add Students
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-grow w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search students by name or email..."
                className="pl-8 w-full"
                value={searchTermMain}
                onChange={(e) => setSearchTermMain(e.target.value)}
              />
            </div>
            <Button onClick={fetchStudents} variant="outline" disabled={isLoadingStudents} className="w-full sm:w-auto flex-shrink-0">
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingStudents ? 'animate-spin' : ''}`} />
              Refresh List
            </Button>
          </div>

          {isLoadingStudents && students.length === 0 && !error && (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
          )}

          {error && (
            <Card className="text-center p-6 bg-destructive/10 border-destructive">
              <AlertCircle className="mx-auto h-10 w-10 text-destructive mb-3" />
              <CardTitle className="text-destructive">Error Loading Students</CardTitle>
              <CardDescription className="text-destructive/80 whitespace-pre-wrap">{error}</CardDescription>
            </Card>
          )}

          {!isLoadingStudents && !error && filteredStudentsMain.length === 0 && (
            <Card className="text-center p-10 border-dashed">
              <UsersIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <CardTitle className="text-xl">No Students Found</CardTitle>
              <CardDescription>
                {searchTermMain ? "No students match your search criteria." : "You currently don't have any students linked. Use the 'Add Students' button."}
              </CardDescription>
            </Card>
          )}

          {!isLoadingStudents && !error && filteredStudentsMain.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px] sm:w-[60px] px-2 sm:px-4">Avatar</TableHead>
                    <TableHead className="px-2 sm:px-4">Name</TableHead>
                    <TableHead className="hidden md:table-cell px-2 sm:px-4">Email</TableHead>
                    <TableHead className="px-2 sm:px-4">Plan</TableHead>
                    <TableHead className="hidden lg:table-cell px-2 sm:px-4">Joined</TableHead>
                    <TableHead className="text-right px-2 sm:px-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudentsMain.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="px-2 sm:px-4 py-2">
                        <Avatar className="h-8 w-8 sm:h-10 sm:w-10 text-xs sm:text-sm">
                          <AvatarImage src={student.avatarUrl} alt={student.name} />
                          <AvatarFallback>{getAvatarFallbackMain(student.name)}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium px-2 sm:px-4 py-2">{student.name}</TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell px-2 sm:px-4 py-2">{student.email}</TableCell>
                      <TableCell className="px-2 sm:px-4 py-2">
                        <Badge variant="secondary">
                          {student.studentSubscriptionTier || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden lg:table-cell px-2 sm:px-4 py-2">
                        {student.joineddate ? new Date(student.joineddate).toLocaleDateString() : (student.created ? new Date(student.created).toLocaleDateString() : 'N/A')}
                      </TableCell>
                      <TableCell className="text-right px-2 sm:px-4 py-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => alert(`View progress for ${student.name} - Coming Soon!`)}
                          className="p-1 sm:p-2 h-auto"
                          aria-label={`View progress for ${student.name}`}
                        >
                          <BarChart3 className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Progress</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      {teacher && (
        <AddStudentModal
          isOpen={isAddStudentModalOpen}
          onOpenChange={setIsAddStudentModalOpen}
          teacherId={teacher.id}
          currentStudentIds={students.map(s => s.id)}
          onStudentAdded={fetchStudents} // Pass the refresh callback
        />
      )}
    </div>
  );
}
