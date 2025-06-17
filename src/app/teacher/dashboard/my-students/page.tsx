
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
import { UserPlus, Users as UsersIcon, AlertCircle, Search, RefreshCw, BarChart3 } from 'lucide-react';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { InviteStudentModal } from '@/components/teacher/InviteStudentModal';
import { Badge } from '@/components/ui/badge';

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
    studentSubscriptionTier: record.model as User['studentSubscriptionTier'] || undefined, // Changed N/A to undefined
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


export default function TeacherMyStudentsPage() {
  const { teacher, isLoadingTeacher } = useAuth();
  const { toast } = useToast();
  const [students, setStudents] = useState<StudentDisplayInfo[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

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
        // You can specify fields here if needed, e.g., fields: "id,name,email,avatarUrl,model,class,favExam,joineddate,created,phone,role,targetYear,totalPoints"
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

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (student.email && student.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getAvatarFallback = (name: string) => {
    const nameParts = name.split(' ');
    return nameParts.length > 1 ? nameParts[0][0] + nameParts[nameParts.length - 1][0] : name.substring(0, 2).toUpperCase();
  };

  if (isLoadingTeacher || (!teacher && isLoadingStudents)) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="space-y-1">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-4 w-80" />
          </div>
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
              View and manage students associated with your account.
            </CardDescription>
          </div>
          <Button onClick={() => setIsInviteModalOpen(true)} className="w-full md:w-auto mt-2 md:mt-0">
            <UserPlus className="mr-2 h-4 sm:h-5 w-4 sm:w-5" /> Invite Students
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
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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

          {!isLoadingStudents && !error && filteredStudents.length === 0 && (
            <Card className="text-center p-10 border-dashed">
              <UsersIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <CardTitle className="text-xl">No Students Found</CardTitle>
              <CardDescription>
                {searchTerm ? "No students match your search criteria." : "You currently don't have any students associated. Use the 'Invite Students' button to add them."}
              </CardDescription>
            </Card>
          )}

          {!isLoadingStudents && !error && filteredStudents.length > 0 && (
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
                  {filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="px-2 sm:px-4 py-2">
                        <Avatar className="h-8 w-8 sm:h-10 sm:w-10 text-xs sm:text-sm">
                          <AvatarImage src={student.avatarUrl} alt={student.name} />
                          <AvatarFallback>{getAvatarFallback(student.name)}</AvatarFallback>
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
        <InviteStudentModal
          isOpen={isInviteModalOpen}
          onOpenChange={setIsInviteModalOpen}
          teacherId={teacher.id}
          teacherName={teacher.name}
          currentStudentIds={students.map(s => s.id)}
        />
      )}
    </div>
  );
}

    