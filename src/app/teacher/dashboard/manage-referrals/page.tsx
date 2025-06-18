
'use client';

import { useState, useEffect, useCallback } from 'react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TeacherReferralCodeSchema, type TeacherReferralCodeInput } from '@/lib/schemas';
import type { TeacherPlan, TeacherReferralCode } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import pb from '@/lib/pocketbase';
import { useToast } from '@/hooks/use-toast';
import { TicketPercent, PlusCircle, Edit, Trash2, CalendarDays, Loader2, AlertCircle, Save, BadgeHelp } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link'; // Added missing import
import { Routes } from '@/lib/constants';


interface TeacherReferralCodeWithPlanNames extends TeacherReferralCode {
  applicable_plan_names?: string[];
}

export default function TeacherManageReferralsPage() {
  const { teacher, isLoadingTeacher } = useAuth();
  const { toast } = useToast();

  const [referralCodes, setReferralCodes] = useState<TeacherReferralCodeWithPlanNames[]>([]);
  const [teacherContentPlans, setTeacherContentPlans] = useState<TeacherPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<TeacherReferralCodeWithPlanNames | null>(null);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  const teacherId = teacher?.id;

  const form = useForm<TeacherReferralCodeInput>({
    resolver: zodResolver(TeacherReferralCodeSchema),
    defaultValues: {
      referral_code_string: '',
      discount_percentage: 0,
      applicable_plan_ids: [],
      expiry_date: '',
    },
  });

  const fetchAllData = useCallback(async (isMountedGetter: () => boolean = () => true) => {
    if (!teacherId) {
      if (isMountedGetter()) { setIsLoading(false); setReferralCodes([]); setTeacherContentPlans([]); }
      return;
    }
    if (isMountedGetter()) setIsLoading(true);
    setError(null);

    try {
      const [codesRecords, plansRecords] = await Promise.all([
        pb.collection('teacher_refferal_code').getFullList<TeacherReferralCode>({
          filter: `teacher = "${teacherId}"`,
          sort: '-created',
          '$autoCancel': false,
        }),
        pb.collection('teachers_upgrade_plan').getFullList<TeacherPlan>({
          filter: `teacher = "${teacherId}"`,
          fields: 'id,Plan_name', // Only fetch necessary fields
          '$autoCancel': false,
        })
      ]);

      if (isMountedGetter()) {
        setTeacherContentPlans(plansRecords);
        
        const planIdToNameMap = new Map(plansRecords.map(p => [p.id, p.Plan_name]));
        const mappedCodes = codesRecords.map(code => ({
            ...code,
            applicable_plan_names: (Array.isArray(code.applicable_plan_ids) ? code.applicable_plan_ids : []).map(id => planIdToNameMap.get(id) || `Plan ID: ${id.substring(0,5)}...`).filter(Boolean),
        }));
        setReferralCodes(mappedCodes);
      }
    } catch (err: any) {
      if (isMountedGetter()) {
        console.error("Failed to fetch referral data:", err.data || err);
        setError(`Could not load data. Error: ${err.data?.message || err.message}`);
      }
    } finally {
      if (isMountedGetter()) setIsLoading(false);
    }
  }, [teacherId]);

  useEffect(() => {
    let isMounted = true;
    if (!isLoadingTeacher && teacherId) {
      fetchAllData(() => isMounted);
    } else if (!isLoadingTeacher && !teacherId) {
      setIsLoading(false); setError("Teacher not authenticated.");
    }
    return () => { isMounted = false; };
  }, [isLoadingTeacher, teacherId, fetchAllData]);

  const handleOpenCreateModal = () => {
    setEditingCode(null);
    form.reset({ referral_code_string: '', discount_percentage: 0, applicable_plan_ids: [], expiry_date: '' });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (code: TeacherReferralCodeWithPlanNames) => {
    setEditingCode(code);
    form.reset({
      referral_code_string: code.referral_code_string,
      discount_percentage: code.discount_percentage,
      applicable_plan_ids: code.applicable_plan_ids,
      expiry_date: code.expiry_date ? format(new Date(code.expiry_date), 'yyyy-MM-dd') : '',
    });
    setIsModalOpen(true);
  };

  const handleDeleteCode = async (codeId: string, codeString: string) => {
    if (!confirm(`Are you sure you want to delete the referral code "${codeString}"?`)) return;
    try {
      await pb.collection('teacher_refferal_code').delete(codeId);
      toast({ title: "Referral Code Deleted", description: `Code "${codeString}" has been removed.` });
      fetchAllData(() => true);
    } catch (error: any) {
      toast({ title: "Deletion Failed", description: error.message, variant: "destructive" });
    }
  };

  const onSubmitModal = async (values: TeacherReferralCodeInput) => {
    if (!teacherId) return;
    setIsSubmittingForm(true);
    const dataToSave = {
      ...values,
      teacher: teacherId,
      expiry_date: values.expiry_date ? new Date(values.expiry_date).toISOString() : null,
    };

    try {
      if (editingCode) {
        await pb.collection('teacher_refferal_code').update(editingCode.id, dataToSave);
        toast({ title: "Referral Code Updated", description: `"${values.referral_code_string}" updated.` });
      } else {
        await pb.collection('teacher_refferal_code').create(dataToSave);
        toast({ title: "Referral Code Created", description: `"${values.referral_code_string}" created.` });
      }
      fetchAllData(() => true);
      setIsModalOpen(false);
      setEditingCode(null);
    } catch (error: any) {
      let errorMsg = error.data?.data?.referral_code_string?.message || error.data?.message || error.message || 'An unexpected error occurred.';
      toast({ title: editingCode ? "Update Failed" : "Creation Failed", description: errorMsg, variant: "destructive" });
    } finally {
      setIsSubmittingForm(false);
    }
  };

  if (isLoadingTeacher || (isLoading && referralCodes.length === 0)) {
    return ( <div className="space-y-6 p-4 md:p-6"> <Skeleton className="h-10 w-1/3 mb-4" /> <Skeleton className="h-8 w-2/3 mb-6" /> <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-48 rounded-lg" />)} </div> </div> );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <CardTitle className="text-2xl md:text-3xl font-bold text-foreground flex items-center"><TicketPercent className="mr-3 h-7 w-7 text-primary" /> Teacher Referral Codes</CardTitle>
            <CardDescription>Create and manage referral codes for your content plans.</CardDescription>
          </div>
          <Button onClick={handleOpenCreateModal} disabled={isLoading}><PlusCircle className="mr-2 h-5 w-5" /> Create New Code</Button>
        </CardHeader>
      </Card>

      {error && ( <Card className="text-center p-6 bg-destructive/10 border-destructive"><AlertCircle className="mx-auto h-10 w-10 text-destructive mb-3" /><CardTitle className="text-destructive">Error Loading Data</CardTitle><CardDescription className="text-destructive/80">{error}</CardDescription></Card> )}

      {!isLoading && !error && referralCodes.length === 0 && (
        <Card className="text-center p-10 border-dashed"><TicketPercent className="mx-auto h-12 w-12 text-muted-foreground mb-4" /><CardTitle className="text-xl">No Referral Codes Yet</CardTitle><CardDescription>Click "Create New Code" to get started.</CardDescription></Card>
      )}

      {!isLoading && !error && referralCodes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {referralCodes.map(code => (
            <Card key={code.id} className="shadow-md hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-primary">{code.referral_code_string}</CardTitle>
                <CardDescription>Discount: <span className="font-medium text-foreground">{code.discount_percentage}%</span></CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">APPLIES TO PLANS:</p>
                  {code.applicable_plan_names && code.applicable_plan_names.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {code.applicable_plan_names.map(name => <Badge key={name} variant="secondary">{name}</Badge>)}
                    </div>
                  ): <p className="text-xs text-muted-foreground italic">No specific plans linked.</p>}
                </div>
                <p className="text-xs text-muted-foreground">Expires: {code.expiry_date ? format(new Date(code.expiry_date), "dd MMM yyyy") : 'Never'}</p>
                <p className="text-xs text-muted-foreground">Created: {format(new Date(code.created), "dd MMM yyyy, p")}</p>
              </CardContent>
              <CardFooter className="border-t pt-3 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => handleOpenEditModal(code)}><Edit className="mr-1.5 h-3.5 w-3.5" /> Edit</Button>
                <Button variant="destructive" size="sm" onClick={() => handleDeleteCode(code.id, code.referral_code_string)}><Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete</Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {teacherId && 
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-lg md:max-w-xl max-h-[85vh] flex flex-col">
            <DialogHeader className="pt-6 px-6 pb-4 border-b"><DialogTitle>{editingCode ? "Edit Referral Code" : "Create New Referral Code"}</DialogTitle><DialogDescription>{editingCode ? "Update details for this code." : "Set up a new referral code."}</DialogDescription></DialogHeader>
            <ScrollArea className="flex-grow px-6 py-4 overflow-y-auto">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmitModal)} className="space-y-4" id="teacherReferralForm">
                  <FormField control={form.control} name="referral_code_string" render={({ field }) => (<FormItem><FormLabel>Code String *</FormLabel><FormControl><Input placeholder="E.g., TEACHER20" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                  <FormField control={form.control} name="discount_percentage" render={({ field }) => (<FormItem><FormLabel>Discount Percentage *</FormLabel><FormControl><Input type="number" step="0.01" placeholder="E.g., 10 or 15.5" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>)}/>
                  <FormField control={form.control} name="expiry_date" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-1"><CalendarDays className="h-4 w-4"/>Expiry Date (Optional)</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)}/>
                  <FormField control={form.control} name="applicable_plan_ids" render={() => (<FormItem><FormLabel className="text-sm font-medium">Applicable Content Plans *</FormLabel>
                    {teacherContentPlans.length === 0 ? (<p className="text-xs text-muted-foreground">You need to <Link href={Routes.teacherManagePlans} className="text-primary underline">create content plans</Link> first.</p>)
                    : (<ScrollArea className="h-32 border rounded-md p-2"><div className="space-y-1.5">
                      {teacherContentPlans.map((plan) => (<FormField key={plan.id} control={form.control} name="applicable_plan_ids" render={({ field: checkboxField }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0"><FormControl><Checkbox checked={checkboxField.value?.includes(plan.id)} onCheckedChange={(checked) => checkboxField.onChange(checked ? [...(checkboxField.value || []), plan.id] : checkboxField.value?.filter(id => id !== plan.id))} /></FormControl><FormLabel className="font-normal text-xs cursor-pointer">{plan.Plan_name}</FormLabel></FormItem>)}/>))}
                    </div></ScrollArea>)}<FormMessage /></FormItem>)}/>
                </form>
              </Form>
            </ScrollArea>
            <DialogFooter className="p-6 pt-4 border-t flex-shrink-0">
              <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmittingForm}>Cancel</Button></DialogClose>
              <Button type="submit" form="teacherReferralForm" disabled={isSubmittingForm}>{isSubmittingForm && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingCode ? "Save Changes" : "Create Code"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
       <Card className="mt-6 bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700">
        <CardHeader><CardTitle className="text-blue-700 dark:text-blue-300 text-md flex items-center gap-2"><BadgeHelp className="h-5 w-5"/>How Teacher Referrals Work</CardTitle></CardHeader>
        <CardContent className="text-xs text-blue-600 dark:text-blue-200 space-y-1">
          <p><strong>1. Create Codes:</strong> You create unique referral codes for your content plans.</p>
          <p><strong>2. Share Codes:</strong> Share these codes with potential students.</p>
          <p><strong>3. Students Use Codes:</strong> Students enter your code when subscribing to one of your *specific content plans* via your public teacher page (<Link href={teacher?.EduNexus_Name ? Routes.teacherPublicAdPage(teacher.EduNexus_Name) : '#'} className="font-medium hover:underline">found here if username set</Link>).</p>
          <p><strong>4. Discount Applied:</strong> If valid, the discount is applied to their purchase of YOUR plan.</p>
          <p><strong>5. Track Earnings:</strong> Your earnings (after EduNexus commission) will reflect in your Wallet.</p>
          <p className="mt-2 italic">Note: These codes are for your content plans, not for student platform upgrades to EduNexus premium tiers.</p>
        </CardContent>
      </Card>
    </div>
  );
}

