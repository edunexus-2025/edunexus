
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import pb from '@/lib/pocketbase';
import type { TeacherPlan, User } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Users, UserCheck, Loader2, Save, AlertCircle, Search, PlusCircle } from 'lucide-react';
import { Routes, teacherPlatformPlansData, escapeForPbFilter } from '@/lib/constants';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import { Badge } from '@/components/ui/badge';

interface StudentForSelection extends User {
  isEnrolledInThisPlan: boolean;
}

const mapUserRecordToStudentDisplay = (record: RecordModel): User => ({
  id: record.id,
  name: record.name || "Unnamed Student",
  email: record.email || "No email",
  avatarUrl: record.avatarUrl || (record.avatar ? pb.files.getUrl(record, record.avatar) : `https://ui-avatars.com/api/?name=${encodeURIComponent(record.name?.charAt(0) || 'S')}&background=random&color=fff`),
  studentSubscriptionTier: record.model,
  role: record.role as User['role'],
});


export default function TeacherViewPlanPage() {
  const params = useParams();
  const router = useRouter();
  const { teacher, isLoadingTeacher } = useAuth();
  const { toast } = useToast();
  const planId = typeof params.planId === 'string' ? params.planId : '';

  const [planDetails, setPlanDetails] = useState<TeacherPlan | null>(null);
  const [allTeacherStudents, setAllTeacherStudents] = useState<StudentForSelection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingStudents, setIsSavingStudents] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');

  const fetchPlanAndStudents = useCallback(async (isMountedGetter: () => boolean) => {
    if (!planId || !teacher?.id || isLoadingTeacher) {
      if(isMountedGetter()) setIsLoading(false);
      return;
    }
    if (isMountedGetter()) setIsLoading(true);
    setError(null);

    try {
      const fetchedPlan = await pb.collection('teachers_upgrade_plan').getOne<TeacherPlan>(planId, {
        expand: 'enrolled_students', 
        '$autoCancel': false,
      });
      
      if (!isMountedGetter()) return;
      setPlanDetails(fetchedPlan);

      const teacherStudentRecords = await pb.collection('users').getFullList<RecordModel>({
        filter: `subscription_by_teacher ~ "${teacher.id}" && role = "User"`, 
        fields: 'id,name,email,avatar,avatarUrl,collectionId,collectionName,model,role',
        '$autoCancel': false,
      });
      
      if (!isMountedGetter()) return;
      const enrolledStudentIdsInThisPlan = new Set(fetchedPlan.enrolled_students || []);
      
      setAllTeacherStudents(teacherStudentRecords.map(record => {
        const studentUser = mapUserRecordToStudentDisplay(record);
        return {
          ...studentUser,
          isEnrolledInThisPlan: enrolledStudentIdsInThisPlan.has(record.id),
        } as StudentForSelection;
      }));

    } catch (err: any) {
      if (isMountedGetter()) {
        const clientError = err as ClientResponseError;
        let detailedMessage = `Could not load plan details. Error: ${clientError.data?.message || clientError.message || 'Unknown error'}.`;
        if (clientError.status === 404) detailedMessage = "Plan not found or you do not have access.";
        else if (clientError.isAbort || (clientError.name === 'ClientResponseError' && clientError.status === 0)) {
            console.warn('TeacherViewPlanPage: Fetch plan/students request was cancelled or network issue.');
            detailedMessage = "Request cancelled or network issue. Please try again.";
        } else {
            console.error("TeacherViewPlanPage: Failed to fetch plan/students:", clientError.data || clientError);
        }
        setError(detailedMessage);
        toast({ title: "Error", description: detailedMessage, variant: "destructive", duration: 7000 });
      }
    } finally {
      if (isMountedGetter()) setIsLoading(false);
    }
  }, [planId, teacher?.id, isLoadingTeacher, toast]);

  useEffect(() => {
    let isMounted = true;
    fetchPlanAndStudents(() => isMounted);
    return () => { isMounted = false; };
  }, [fetchPlanAndStudents]);

  const handleStudentSelectionChange = (studentId: string, isSelected: boolean) => {
    setAllTeacherStudents(prevStudents =>
      prevStudents.map(student =>
        student.id === studentId ? { ...student, isEnrolledInThisPlan: isSelected } : student
      )
    );
  };

  const handleSaveStudentEnrollments = async () => {
    if (!planDetails || !teacher?.id) return;
    setIsSavingStudents(true);

    const currentTeacherPlatformPlan = teacherPlatformPlansData.find(p => p.id === teacher.teacherSubscriptionTier);
    // Max student per plan limit check removed

    const selectedStudentIds = allTeacherStudents
      .filter(s => s.isEnrolledInThisPlan)
      .map(s => s.id);

    // Plan's own student limit check removed

    try {
      await pb.collection('teachers_upgrade_plan').update(planDetails.id, {
        enrolled_students: selectedStudentIds,
      });
      toast({ title: "Students Updated", description: "Enrolled students for this plan have been saved." });
      fetchPlanAndStudents(() => true); // Refresh data
    } catch (error: any) {
      toast({ title: "Save Failed", description: `Could not update student enrollments: ${error.message}`, variant: "destructive" });
    } finally {
      setIsSavingStudents(false);
    }
  };
  
  const filteredStudents = useMemo(() => {
    return allTeacherStudents.filter(student =>
      student.name.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
      (student.email && student.email.toLowerCase().includes(studentSearchTerm.toLowerCase()))
    );
  }, [allTeacherStudents, studentSearchTerm]);


  if (isLoading || isLoadingTeacher) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-8 w-40 mb-4" />
        <Card className="shadow-lg"><CardHeader><Skeleton className="h-10 w-3/4" /><Skeleton className="h-6 w-1/2 mt-2" /></CardHeader>
          <CardContent className="space-y-4"><Skeleton className="h-6 w-1/3" /><Skeleton className="h-20 w-full" /></CardContent>
        </Card>
        <Card className="shadow-lg"><CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader>
          <CardContent className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-32 w-full" /></CardContent>
          <CardFooter><Skeleton className="h-10 w-28 ml-auto" /></CardFooter>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6 text-center">
        <Button variant="outline" size="sm" onClick={() => router.push(Routes.teacherManagePlans)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Manage Plans
        </Button>
        <Card className="shadow-lg border-destructive bg-destructive/10 max-w-md mx-auto p-6">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-3" />
          <CardTitle className="text-xl text-destructive">Error Loading Plan</CardTitle>
          <CardDescription className="text-destructive/80 whitespace-pre-wrap">{error}</CardDescription>
        </Card>
      </div>
    );
  }
  
  if (!planDetails) {
    return (
      <div className="p-4 md:p-6 text-center">
        <Button variant="outline" size="sm" onClick={() => router.push(Routes.teacherManagePlans)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Manage Plans
        </Button>
        <Card className="text-center p-10 shadow-md">
          <CardTitle>Plan Not Found</CardTitle>
          <CardDescription>The requested plan could not be found or you do not have access.</CardDescription>
        </Card>
      </div>
    );
  }

  const getAvatarFallback = (name?: string) => name ? name.charAt(0).toUpperCase() : 'S';

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Button variant="outline" size="sm" onClick={() => router.push(Routes.teacherManagePlans)}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Plans
      </Button>

      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl md:text-3xl font-bold text-primary">{planDetails.Plan_name}</CardTitle>
          <CardDescription>Manage details and enrolled students for this plan.</CardDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge variant="secondary">Price: ₹{planDetails.plan_price} / {planDetails.plan}</Badge>
            {/* Max Students display removed */}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <h3 className="text-lg font-semibold">Plan Features:</h3>
          <ul className="list-disc list-inside pl-4 text-sm text-muted-foreground">
            {[planDetails.plan_point_1, planDetails.plan_point_2, planDetails.plan_point_3, planDetails.plan_point_4, planDetails.plan_point_5]
              .filter(Boolean).map((point, index) => <li key={index}>{point}</li>)}
          </ul>
        </CardContent>
      </Card>

      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2"><Users className="h-6 w-6 text-primary" /> Manage Enrolled Students</CardTitle>
          <CardDescription>Select students from your roster to enroll them in this plan.
          Your platform tier (<span className="font-semibold">{teacher?.teacherSubscriptionTier || 'N/A'}</span>) allows up to {teacherPlatformPlansData.find(p=>p.id === teacher?.teacherSubscriptionTier)?.maxContentPlans || 'N/A'} content plans.
          {/* This specific plan student limit display removed */}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search your students by name or email..."
              className="pl-9 w-full"
              value={studentSearchTerm}
              onChange={(e) => setStudentSearchTerm(e.target.value)}
            />
          </div>
          {isLoading ? <Skeleton className="h-48 w-full" /> :
           filteredStudents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {studentSearchTerm ? "No students match your search." : "No students found in your roster. Add students via 'My Students' page."}
            </p>
           ) : (
            <ScrollArea className="h-72 border rounded-md p-2">
              <div className="space-y-2">
                {filteredStudents.map(student => (
                  <div key={student.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`student-${student.id}`}
                        checked={student.isEnrolledInThisPlan}
                        onCheckedChange={(checked) => handleStudentSelectionChange(student.id, !!checked)}
                      />
                      <Label htmlFor={`student-${student.id}`} className="flex items-center gap-2 cursor-pointer">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={student.avatarUrl} alt={student.name} />
                          <AvatarFallback>{getAvatarFallback(student.name)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{student.name}</span>
                        <span className="text-xs text-muted-foreground hidden sm:inline">({student.email})</span>
                      </Label>
                    </div>
                    {student.isEnrolledInThisPlan && <Badge variant="default" className="text-xs bg-green-500 hover:bg-green-600">Enrolled</Badge>}
                  </div>
                ))}
              </div>
            </ScrollArea>
           )}
        </CardContent>
        <CardFooter className="border-t pt-4">
          <Button onClick={handleSaveStudentEnrollments} disabled={isSavingStudents || isLoading}>
            {isSavingStudents && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Student Enrollments
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
