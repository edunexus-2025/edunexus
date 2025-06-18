
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TeacherPlanInput } from '@/lib/schemas';
import { TeacherPlanSchema } from '@/lib/schemas';
import pb from '@/lib/pocketbase';
import { useToast } from '@/hooks/use-toast';
import { Loader2, DollarSign, CalendarDays } from 'lucide-react';
import type { TeacherPlan } from '@/lib/types';

interface TeacherPlanModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingPlan: TeacherPlan | null;
  teacherId: string;
  onPlanSaved: () => void;
}

const planDurationOptions: Array<TeacherPlanInput['plan_duration']> = ["Monthly", "Weekly", "Yearly"];

export function TeacherPlanModal({
  isOpen,
  onOpenChange,
  editingPlan,
  teacherId,
  onPlanSaved,
}: TeacherPlanModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<TeacherPlanInput>({
    resolver: zodResolver(TeacherPlanSchema),
    defaultValues: {
      Plan_name: '',
      plan_price: '',
      plan_duration: 'Monthly',
      plan_point_1: '',
      plan_point_2: '',
      plan_point_3: '',
      plan_point_4: '',
      plan_point_5: '',
      // max_students: undefined, // Removed this field
    },
  });

  useEffect(() => {
    if (isOpen) { 
      if (editingPlan) {
        form.reset({
          Plan_name: editingPlan.Plan_name,
          plan_price: editingPlan.plan_price,
          plan_duration: editingPlan.plan as TeacherPlanInput['plan_duration'],
          plan_point_1: editingPlan.plan_point_1 || '',
          plan_point_2: editingPlan.plan_point_2 || '',
          plan_point_3: editingPlan.plan_point_3 || '',
          plan_point_4: editingPlan.plan_point_4 || '',
          plan_point_5: editingPlan.plan_point_5 || '',
          // max_students: editingPlan.max_students === null ? undefined : editingPlan.max_students, // Removed
        });
      } else {
        form.reset({
          Plan_name: '',
          plan_price: '',
          plan_duration: 'Monthly',
          plan_point_1: '',
          plan_point_2: '',
          plan_point_3: '',
          plan_point_4: '',
          plan_point_5: '',
          // max_students: undefined, // Removed
        });
      }
    }
  }, [editingPlan, form, isOpen]);

  const onSubmit = async (values: TeacherPlanInput) => {
    setIsSubmitting(true);
    const dataToSave = {
      teacher: teacherId,
      Plan_name: values.Plan_name,
      plan_price: values.plan_price,
      plan: values.plan_duration,
      plan_point_1: values.plan_point_1 || null,
      plan_point_2: values.plan_point_2 || null,
      plan_point_3: values.plan_point_3 || null,
      plan_point_4: values.plan_point_4 || null,
      plan_point_5: values.plan_point_5 || null,
      // max_students: values.max_students === undefined || values.max_students === null ? null : Number(values.max_students), // Removed
    };

    try {
      if (editingPlan) {
        await pb.collection('teachers_upgrade_plan').update(editingPlan.id, dataToSave);
        toast({ title: 'Plan Updated', description: `"${values.Plan_name}" has been updated.` });
      } else {
        await pb.collection('teachers_upgrade_plan').create(dataToSave);
        toast({ title: 'Plan Created', description: `"${values.Plan_name}" has been created.` });
      }
      onPlanSaved();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: editingPlan ? 'Update Failed' : 'Creation Failed',
        description: error.data?.message || error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg md:max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader className="pt-6 px-6 pb-4 border-b">
          <DialogTitle className="text-xl">
            {editingPlan ? 'Edit Content Plan' : 'Create New Content Plan'}
          </DialogTitle>
          <DialogDescription>
            {editingPlan ? 'Update the details of this plan.' : 'Set up a new subscription plan for your students.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto px-6 py-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" id="teacherPlanFormModal">
              <FormField
                control={form.control}
                name="Plan_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plan Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Premium Physics Batch" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="plan_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1"><DollarSign className="h-4 w-4"/>Plan Price (INR) *</FormLabel>
                      <FormControl>
                        <Input type="text" placeholder="e.g., 299 or 0 for free" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="plan_duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1"><CalendarDays className="h-4 w-4"/>Plan Duration *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select duration" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {planDurationOptions.map(opt => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {/* Max Students field removed */}
              
              <FormLabel className="text-sm font-medium pt-2 block">Plan Features (Key Points)</FormLabel>
              {[1, 2, 3, 4, 5].map((num) => (
                <FormField
                  key={num}
                  control={form.control}
                  name={`plan_point_${num}` as keyof TeacherPlanInput}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Feature Point {num} {num <=3 ? '*' : '(Optional)'}</FormLabel>
                      <FormControl>
                        <Textarea placeholder={`Describe feature point ${num}`} {...field} value={field.value || ''} rows={1} className="min-h-[40px]"/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </form>
          </Form>
        </div>
        <DialogFooter className="p-6 pt-4 border-t flex-shrink-0">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSubmitting}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" form="teacherPlanFormModal" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editingPlan ? 'Save Changes' : 'Create Plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
