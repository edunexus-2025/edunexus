
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, PlusCircle, Edit, Trash2, AlertCircle, Loader2, UsersIcon, CheckCircle, ChevronRight, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Routes, teacherPlatformPlansData } from '@/lib/constants';
import { TeacherPlanModal } from '@/components/teacher/TeacherPlanModal'; 
import type { TeacherPlan, Plan as PlatformPlan } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

export default function TeacherManagePlansPage() {
  const { teacher, isLoading: isLoadingTeacher } = useAuth();
  const { toast } = useToast();

  const [plans, setPlans] = useState<TeacherPlan[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<TeacherPlan | null>(null);
  
  const teacherId = teacher?.id;

  const fetchTeacherPlans = useCallback(async (isMountedGetter: () => boolean = () => true) => {
    if (!teacherId) {
      if (isMountedGetter()) { setIsLoadingPlans(false); setPlans([]); }
      return;
    }
    if (isMountedGetter()) setIsLoadingPlans(true);
    setError(null);

    let abortController = new AbortController();
    if (!isMountedGetter()) abortController.abort();


    try {
      const records = await pb.collection('teachers_upgrade_plan').getFullList<TeacherPlan>({
        filter: `teacher = "${teacherId}"`,
        sort: '-created',
        signal: abortController.signal,
        expand: 'enrolled_students' 
      });
      if (isMountedGetter()) {
        const mappedPlans = records.map(r => ({
          ...r,
          enrolledStudentCount: Array.isArray(r.expand?.enrolled_students) ? r.expand.enrolled_students.length : (Array.isArray(r.enrolled_students) ? r.enrolled_students.length : 0)
        }));
        setPlans(mappedPlans);
      }
    } catch (err: any) {
      if (isMountedGetter()) {
        if (err.name === 'AbortError' || (err.name === 'ClientResponseError' && err.status === 0)) {
          console.warn('TeacherManagePlansPage: Fetch teacher plans request was aborted or network issue.');
        } else {
          console.error("TeacherManagePlansPage: Failed to fetch teacher plans:", err);
          setError(err.message || "Could not load your plans.");
        }
      }
    } finally {
      if (isMountedGetter()) setIsLoadingPlans(false);
    }
  }, [teacherId]);

  useEffect(() => {
    let isMounted = true;
    if (!isLoadingTeacher && teacherId) {
      fetchTeacherPlans(() => isMounted);
    } else if (!isLoadingTeacher && !teacherId) {
      setIsLoadingPlans(false); setPlans([]);
    }
    return () => { isMounted = false; };
  }, [isLoadingTeacher, teacherId, fetchTeacherPlans]);

  const handleShowCreateModal = () => {
    setEditingPlan(null);
    setIsModalOpen(true);
  };

  const handleShowEditModal = (planToEdit: TeacherPlan) => {
    setEditingPlan(planToEdit);
    setIsModalOpen(true);
  };

  const handleDeletePlan = async (planId: string, planName: string) => {
    if (!confirm(`Are you sure you want to delete the plan "${planName}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await pb.collection('teachers_upgrade_plan').delete(planId);
      toast({ title: "Plan Deleted", description: `"${planName}" has been deleted.` });
      fetchTeacherPlans(() => true);
    } catch (error: any) {
      toast({ title: "Deletion Failed", description: error.message, variant: "destructive" });
    }
  };

  const currentTeacherPlatformPlan = teacherPlatformPlansData.find(p => p.id === teacher?.teacherSubscriptionTier);
  const canCreateMorePlans = currentTeacherPlatformPlan?.maxContentPlans ? plans.length < currentTeacherPlatformPlan.maxContentPlans : true;

  if (isLoadingTeacher || isLoadingPlans) {
    return (
      <div className="space-y-6 p-4 md:p-8">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-8 w-2/3" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-56 rounded-lg" />)}
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6 p-4 md:p-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <CardTitle className="text-2xl md:text-3xl font-bold text-foreground flex items-center">
              <DollarSign className="mr-3 h-7 w-7 text-primary" /> Manage Your Content Plans
            </CardTitle>
            <CardDescription>Create and manage subscription plans for students to access your content.</CardDescription>
            {currentTeacherPlatformPlan && (
              <p className="text-xs text-muted-foreground mt-1">
                Your current platform plan (<span className="font-semibold text-primary">{currentTeacherPlatformPlan.name}</span>) allows you to create up to <span className="font-semibold">{currentTeacherPlatformPlan.maxContentPlans ?? 'Unlimited'}</span> content plans.
                Created: {plans.length}/{currentTeacherPlatformPlan.maxContentPlans ?? '∞'}
              </p>
            )}
          </div>
          <Button onClick={handleShowCreateModal} disabled={!canCreateMorePlans || isLoadingPlans}>
            <PlusCircle className="mr-2 h-5 w-5" /> Create New Plan
            {!canCreateMorePlans && <span className="ml-1 text-xs">(Limit Reached)</span>}
          </Button>
        </CardHeader>
      </Card>

      {error && (
        <Card className="text-center p-6 bg-destructive/10 border-destructive">
          <AlertCircle className="mx-auto h-10 w-10 text-destructive mb-3" />
          <CardTitle className="text-destructive">Error Loading Plans</CardTitle>
          <CardDescription className="text-destructive/80">{error}</CardDescription>
        </Card>
      )}

      {!isLoadingPlans && !error && plans.length === 0 && (
        <Card className="text-center p-10 border-dashed">
          <DollarSign className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <CardTitle className="text-xl">No Content Plans Created Yet</CardTitle>
          <CardDescription>Click "Create New Plan" to offer subscriptions to your students.</CardDescription>
        </Card>
      )}

      {!isLoadingPlans && !error && plans.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map(plan => {
            const planFeatures = [plan.plan_point_1, plan.plan_point_2, plan.plan_point_3, plan.plan_point_4, plan.plan_point_5].filter(Boolean);
            const enrolledCount = plan.enrolledStudentCount || 0;
            return (
              <Card key={plan.id} className="flex flex-col rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out relative overflow-hidden border border-border hover:border-primary">
                <CardHeader className="p-6 bg-card">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl font-bold text-primary mb-1 truncate" title={plan.Plan_name}>{plan.Plan_name}</CardTitle>
                    <Link href={Routes.teacherViewPlan(plan.id)} passHref>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary">
                            <Eye className="h-4 w-4"/>
                        </Button>
                    </Link>
                  </div>
                  <CardDescription className="text-xs text-muted-foreground">
                    Last updated: {format(new Date(plan.updated), "dd MMM yyyy, p")}
                  </CardDescription>
                  <div className="mt-3">
                    <span className="text-3xl font-bold text-foreground">
                      ₹{plan.plan_price}
                    </span>
                    <span className="text-sm ml-1 text-muted-foreground">
                      / {plan.plan || 'N/A'}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow p-6 space-y-3 bg-card">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">FEATURES</p>
                  <ul className="space-y-2">
                    {planFeatures.slice(0,3).map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0 text-green-500" />
                        <span className="text-sm text-foreground/90 line-clamp-1">{feature}</span>
                      </li>
                    ))}
                     {planFeatures.length === 0 && <li className="text-sm text-muted-foreground italic">No features listed.</li>}
                     {planFeatures.length > 3 && <li className="text-sm text-muted-foreground italic">+ {planFeatures.length - 3} more...</li>}
                  </ul>
                   <Badge variant="secondary" className="mt-3">
                    <UsersIcon className="mr-1.5 h-3.5 w-3.5" /> {enrolledCount} / {plan.max_students ?? (currentTeacherPlatformPlan?.maxStudentsPerContentPlan || '∞')} Students
                  </Badge>
                </CardContent>
                <CardFooter className="p-6 mt-auto border-t flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleShowEditModal(plan)}>
                    <Edit className="mr-1.5 h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDeletePlan(plan.id, plan.Plan_name)}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
      {teacherId && 
        <TeacherPlanModal
          isOpen={isModalOpen}
          onOpenChange={setIsModalOpen}
          editingPlan={editingPlan}
          teacherId={teacherId}
          onPlanSaved={() => {
            fetchTeacherPlans(() => true);
            setIsModalOpen(false);
            setEditingPlan(null);
          }}
        />
      }
    </div>
  );
}
