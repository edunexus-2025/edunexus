
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TeacherPlanSchema, type TeacherPlanInput } from '@/lib/schemas';
import type { TeacherPlan } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import pb from '@/lib/pocketbase';
import type { UnsubscribeFunc, RecordModel, ClientResponseError } from 'pocketbase';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, PlusCircle, Edit, Trash2, AlertCircle, Loader2, XCircle, UsersIcon, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const planDurationOptions: Array<TeacherPlanInput['plan_duration']> = ["Monthly", "Weekly", "Yearly"];

export default function TeacherManagePlansPage() {
  const { teacher, isLoading: isLoadingTeacher } = useAuth();
  const { toast } = useToast();

  const [plans, setPlans] = useState<TeacherPlan[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<TeacherPlan | null>(null);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  const form = useForm<TeacherPlanInput>({
    resolver: zodResolver(TeacherPlanSchema),
    defaultValues: {
      Plan_name: '',
      plan_price: '',
      plan_duration: undefined,
      plan_point_1: '',
      plan_point_2: '',
      plan_point_3: '',
      plan_point_4: '',
      plan_point_5: '',
    },
  });

  const teacherId = teacher?.id; // Use primitive for dependency

  const fetchTeacherPlans = useCallback(async (isMountedGetter: () => boolean = () => true) => {
    if (!teacherId || isLoadingTeacher) { // Rely on teacherId from outer scope
      if(isMountedGetter()) {
        setIsLoadingPlans(false);
        setPlans([]);
      }
      return;
    }
    if (isMountedGetter()) setIsLoadingPlans(true);
    if (isMountedGetter()) setError(null);

    let abortController = new AbortController();
    if (!isMountedGetter()) abortController.abort();


    try {
      const records = await pb.collection('teachers_upgrade_plan').getFullList<TeacherPlan>({
        filter: `teacher = "${teacherId}"`, // Use teacherId
        sort: '-created',
        signal: abortController.signal,
      });
      if (isMountedGetter()) {
        setPlans(records);
      }
    } catch (err: any) {
      if (isMountedGetter()) {
        if (err.name === 'AbortError') {
          console.warn('TeacherManagePlansPage: Fetch teacher plans request was aborted.');
        } else if (err.name === 'ClientResponseError' && err.status === 0) {
          console.warn('TeacherManagePlansPage: Fetch teacher plans request failed due to network issue or cancellation.');
          setError("Network error: Could not load your plans. Please check your connection and try again.");
          setPlans([]);
        } else {
          console.error("TeacherManagePlansPage: Failed to fetch teacher plans:", err);
          setError(err.message || "Could not load your plans.");
          setPlans([]);
        }
      }
    } finally {
      if (isMountedGetter()) setIsLoadingPlans(false);
    }
  }, [teacherId, isLoadingTeacher, toast]); // Use teacherId here

  useEffect(() => {
    let isMounted = true;
    const componentIsMounted = () => isMounted; 

    let unsubscribe: UnsubscribeFunc | null = null;

    const setupSubscription = async () => {
      if (!isMounted || !teacherId) return;  // Use teacherId
      try {
        unsubscribe = await pb.collection('teachers_upgrade_plan').subscribe('*', (e) => {
          if (isMounted && e.record.teacher === teacherId) { // Use teacherId
            fetchTeacherPlans(componentIsMounted);
          }
        });
      } catch (subError) {
        if (isMounted) {
          console.error("Failed to subscribe to teacher plans:", subError);
          setError("Could not set up real-time updates for plans.");
          setIsLoadingPlans(false); // Make sure to stop loading on sub error
        }
      }
    };

    if (!isLoadingTeacher && teacherId) { // Check teacherId instead of teacher object
        fetchTeacherPlans(componentIsMounted);
        setupSubscription();
    } else if (!isLoadingTeacher && !teacherId) {
        setIsLoadingPlans(false);
        setPlans([]);
        // setError("Teacher not authenticated."); // This might be too aggressive if just loading initially
    }
    
    return () => {
      isMounted = false;
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [isLoadingTeacher, teacherId, fetchTeacherPlans]); // Depend on teacherId and memoized fetchTeacherPlans


  const handleShowCreateForm = () => {
    setEditingPlan(null);
    form.reset({ Plan_name: '', plan_price: '', plan_duration: undefined, plan_point_1: '', plan_point_2: '', plan_point_3: '', plan_point_4: '', plan_point_5: '' });
    setShowPlanForm(true);
  };

  const handleShowEditForm = (planToEdit: TeacherPlan) => {
    setEditingPlan(planToEdit);
    form.reset({
      Plan_name: planToEdit.Plan_name,
      plan_price: planToEdit.plan_price,
      plan_duration: planToEdit.plan as TeacherPlanInput['plan_duration'], 
      plan_point_1: planToEdit.plan_point_1 || '',
      plan_point_2: planToEdit.plan_point_2 || '',
      plan_point_3: planToEdit.plan_point_3 || '',
      plan_point_4: planToEdit.plan_point_4 || '',
      plan_point_5: planToEdit.plan_point_5 || '',
    });
    setShowPlanForm(true);
  };

  const handleCancelForm = () => {
    setShowPlanForm(false);
    setEditingPlan(null);
    form.reset();
  };

  const onSubmitPlanForm = async (values: TeacherPlanInput) => {
    if (!teacherId) return; // Use teacherId
    setIsSubmittingForm(true);
    
    const dataToSave: Record<string, any> = {
      teacher: teacherId, // Use teacherId
      Plan_name: values.Plan_name,
      plan_price: values.plan_price, 
      plan: values.plan_duration, 
      plan_point_1: values.plan_point_1,
      plan_point_2: values.plan_point_2,
      plan_point_3: values.plan_point_3,
      plan_point_4: values.plan_point_4 || null,
      plan_point_5: values.plan_point_5 || null,
    };

    try {
      if (editingPlan) {
        await pb.collection('teachers_upgrade_plan').update(editingPlan.id, dataToSave);
        toast({ title: "Plan Updated", description: `"${values.Plan_name}" has been updated.` });
      } else {
        await pb.collection('teachers_upgrade_plan').create(dataToSave);
        toast({ title: "Plan Created", description: `"${values.Plan_name}" has been created.` });
      }
      fetchTeacherPlans(() => true); 
      setShowPlanForm(false);
      setEditingPlan(null);
    } catch (error: any) {
      toast({
        title: editingPlan ? "Update Failed" : "Creation Failed",
        description: error.data?.message || error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const handleDeletePlan = async (planId: string, planName: string) => {
    const confirmationMessage = `Are you sure you want to delete the plan "${planName}"? This action cannot be undone.`;
    if (!confirm(confirmationMessage)) {
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
  
  const canCreateMorePlans = plans.length < 3;

  if (isLoadingTeacher || isLoadingPlans) {
    return (
      <div className="space-y-6 p-4 md:p-8">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-8 w-2/3" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 rounded-lg" />)}
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
              <DollarSign className="mr-3 h-7 w-7 text-primary" /> Manage Subscription Plans
            </CardTitle>
            <CardDescription>Create and manage custom subscription plans for your students.</CardDescription>
          </div>
          {!showPlanForm && (
            <Button onClick={handleShowCreateForm} disabled={!canCreateMorePlans || isLoadingPlans}>
              <PlusCircle className="mr-2 h-5 w-5" /> Create New Plan ({plans.length}/3)
            </Button>
          )}
        </CardHeader>
      </Card>

      {showPlanForm && (
        <Card className="shadow-xl mt-6">
          <CardHeader className="p-6 pb-4 border-b">
            <CardTitle>{editingPlan ? "Edit Plan" : "Create New Plan"}</CardTitle>
            <CardDescription>
              {editingPlan ? "Update the details of your subscription plan." : "Define a new subscription plan for your students."}
            </CardDescription>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitPlanForm)} className="space-y-4" id="planForm">
              <CardContent className="p-6">
                <FormField control={form.control} name="Plan_name" render={({ field }) => ( <FormItem> <FormLabel>Plan Name *</FormLabel> <FormControl><Input placeholder="e.g., Premium Physics Batch" {...field} /></FormControl> <FormMessage /> </FormItem> )}/>
                <FormField control={form.control} name="plan_price" render={({ field }) => ( <FormItem> <FormLabel>Price *</FormLabel> <FormControl><Input type="text" placeholder='e.g., 0 or 299 etc' {...field} /></FormControl> <FormMessage /> </FormItem> )}/>
                <FormField control={form.control} name="plan_duration" render={({ field }) => ( <FormItem> <FormLabel>Plan Duration *</FormLabel> <Select onValueChange={field.onChange} value={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Select duration" /></SelectTrigger></FormControl> <SelectContent>{planDurationOptions.map(duration => (<SelectItem key={duration} value={duration}>{duration}</SelectItem>))}</SelectContent> </Select> <FormMessage /> </FormItem> )}/>
                {[1, 2, 3, 4, 5].map(num => (
                  <FormField key={num} control={form.control} name={`plan_point_${num}` as keyof TeacherPlanInput} render={({ field }) => ( <FormItem> <FormLabel>Feature Point {num} {num <=3 ? "*" : "(Optional)"}</FormLabel> <FormControl><Input placeholder={`Describe feature point ${num}`} {...field} value={field.value || ''} /></FormControl> <FormMessage /> </FormItem> )}/>
                ))}
              </CardContent>
              <CardFooter className="p-6 pt-4 border-t flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCancelForm} disabled={isSubmittingForm}>
                  <XCircle className="mr-2 h-4 w-4" /> Cancel
                </Button>
                <Button type="submit" form="planForm" disabled={isSubmittingForm}>
                  {isSubmittingForm && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingPlan ? "Save Changes" : "Create Plan"}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      )}


      {isLoadingPlans && plans.length === 0 && !showPlanForm && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(Math.min(3, plans.length || 3))].map((_, i) => (
            <Card key={`skel-plan-${i}`} className="shadow-md flex flex-col rounded-xl">
              <CardHeader className="p-6">
                <Skeleton className="h-7 w-3/4 mb-1" />
                <Skeleton className="h-4 w-1/2 mb-3" />
                <Skeleton className="h-8 w-1/3" />
              </CardHeader>
              <CardContent className="flex-grow p-6 space-y-3">
                <Skeleton className="h-4 w-1/4 mb-2" />
                <Skeleton className="h-4 w-full" /> <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-5 w-1/2 mt-3" />
              </CardContent>
              <CardFooter className="p-6 mt-auto border-t flex justify-end gap-2">
                <Skeleton className="h-9 w-20" /> <Skeleton className="h-9 w-20" />
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {error && !showPlanForm && (
        <Card className="text-center p-6 bg-destructive/10 border-destructive">
          <AlertCircle className="mx-auto h-10 w-10 text-destructive mb-3" />
          <CardTitle className="text-destructive">Error Loading Plans</CardTitle>
          <CardDescription className="text-destructive/80">{error}</CardDescription>
        </Card>
      )}

      {!isLoadingPlans && !error && plans.length === 0 && !showPlanForm && (
        <Card className="text-center p-10 border-dashed">
          <DollarSign className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <CardTitle className="text-xl">No Plans Created Yet</CardTitle>
          <CardDescription>Click "Create New Plan" to offer subscriptions to your students.</CardDescription>
        </Card>
      )}

      {!isLoadingPlans && !error && plans.length > 0 && !showPlanForm && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map(plan => {
            const planFeatures = [plan.plan_point_1, plan.plan_point_2, plan.plan_point_3, plan.plan_point_4, plan.plan_point_5].filter(Boolean);
            return (
              <Card key={plan.id} className="flex flex-col rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out relative overflow-hidden">
                <CardHeader className="p-6 bg-card">
                  <CardTitle className="text-xl font-bold text-primary mb-1">{plan.Plan_name}</CardTitle>
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
                    {planFeatures.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0 text-green-500" />
                        <span className="text-sm text-foreground/90">{feature}</span>
                      </li>
                    ))}
                     {planFeatures.length === 0 && <li className="text-sm text-muted-foreground italic">No features listed.</li>}
                  </ul>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5 pt-3">
                    <UsersIcon className="h-4 w-4" /> Students Enrolled: {plan.total_student_intake || 0}
                  </p>
                </CardContent>
                <CardFooter className="p-6 mt-auto border-t flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleShowEditForm(plan)}>
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
    </div>
  );
}
