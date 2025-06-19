
'use client';

import { useParams } from 'next/navigation';
import React, { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { TeacherTestSettingsSchema, type TeacherTestSettingsInput } from '@/lib/schemas';
import { AlertCircle, Loader2, Save, Settings } from 'lucide-react';
import { TeacherTestSubjectEnum } from '@/lib/schemas'; // Import the enum

interface TeacherTestRecordForSettings extends RecordModel {
  testName?: string;
  Test_Description?: string;
  Admin_Password?: number | string | null;
  duration?: string | number;
  totalScore?: number | string | null;
  PerNegativeScore?: number | string | null;
  status?: "Draft" | "Published" | "Archived";
  Students_can_view_their_results_after_the_test?: boolean;
  How_many_times_can_students_take_the_test?: number | string | null;
  Shuffle_Questions?: boolean;
  Who_can_take_your_test?: string;
  Would_you_like_to_get_admin_access_through_link?: boolean;
  teacherId?: string;
  QBExam?: "MHT CET" | "JEE MAIN" | "NEET";
  Test_Subject?: "Physics" | "Chemistry" | "Maths" | "Biology" | null; // Added Test_Subject
  model?: "Chapterwise" | "Full Length";
  type?: "Free" | "Premium";
}

const whoCanTakeTestOptions = ["EveryOne", "Group 1", "Group 2", "Group 3", "Group 4", "Group 5", "Group 6"] as const;
const qbExamOptions: Array<NonNullable<TeacherTestSettingsInput['QBExam']>> = ["MHT CET", "JEE MAIN", "NEET"];
const testModelOptions: Array<NonNullable<TeacherTestSettingsInput['model']>> = ["Chapterwise", "Full Length"];
const testTypeOptions: Array<NonNullable<TeacherTestSettingsInput['type']>> = ["Free", "Premium"];
const testSubjectOptionsForm: Array<NonNullable<TeacherTestSettingsInput['Test_Subject']>> = TeacherTestSubjectEnum.options;


export default function TestSettingsPage() {
  const params = useParams();
  const { teacher } = useAuth();
  const { toast } = useToast();
  const testId = typeof params.testId === 'string' ? params.testId : '';

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<TeacherTestSettingsInput>({
    resolver: zodResolver(TeacherTestSettingsSchema),
    defaultValues: {
      testName: '', Test_Description: '', Admin_Password: null, duration: 0,
      totalScore: null, PerNegativeScore: null, status: 'Draft',
      Students_can_view_their_results_after_the_test: true,
      How_many_times_can_students_take_the_test: 1, Shuffle_Questions: false,
      Who_can_take_your_test: 'EveryOne', Would_you_like_to_get_admin_access_through_link: false,
      QBExam: undefined, Test_Subject: undefined, model: undefined, type: undefined,
    },
  });

  const fetchTestDetails = useCallback(async (isMountedGetter: () => boolean) => {
    if (!testId || !teacher?.id) { if (isMountedGetter()) { setIsLoading(false); setError(testId ? "Auth error." : "Test ID missing."); } return; }
    if (isMountedGetter()) setIsLoading(true);

    try {
      const record = await pb.collection('teacher_tests').getOne<TeacherTestRecordForSettings>(testId);
      if (!isMountedGetter()) return;
      if (record.teacherId !== teacher.id) { if (isMountedGetter()) setError("Unauthorized."); return; }

      form.reset({
        testName: record.testName || '',
        Test_Description: record.Test_Description || '',
        Admin_Password: record.Admin_Password === null || record.Admin_Password === undefined ? null : Number(record.Admin_Password),
        duration: record.duration ? parseInt(String(record.duration), 10) : 0,
        totalScore: record.totalScore === null || record.totalScore === undefined ? null : Number(record.totalScore),
        PerNegativeScore: record.PerNegativeScore === null || record.PerNegativeScore === undefined ? null : Number(record.PerNegativeScore),
        status: record.status || 'Draft',
        Students_can_view_their_results_after_the_test: record.Students_can_view_their_results_after_the_test === undefined ? true : record.Students_can_view_their_results_after_the_test,
        How_many_times_can_students_take_the_test: record.How_many_times_can_students_take_the_test === null || record.How_many_times_can_students_take_the_test === undefined ? 1 : Number(record.How_many_times_can_students_take_the_test),
        Shuffle_Questions: record.Shuffle_Questions === undefined ? false : record.Shuffle_Questions,
        Who_can_take_your_test: record.Who_can_take_your_test as TeacherTestSettingsInput['Who_can_take_your_test'] || 'EveryOne',
        Would_you_like_to_get_admin_access_through_link: record.Would_you_like_to_get_admin_access_through_link === undefined ? false : record.Would_you_like_to_get_admin_access_through_link,
        QBExam: record.QBExam,
        Test_Subject: record.Test_Subject || undefined, // Load Test_Subject
        model: record.model,
        type: record.type,
      });
    } catch (err: any) { if (isMountedGetter()) { console.error("Error fetching test settings:", err); setError(`Could not load settings: ${err.message || 'Unknown error'}`); }
    } finally { if (isMountedGetter()) setIsLoading(false); }
  }, [testId, teacher?.id, form]);

  useEffect(() => { let isMounted = true; fetchTestDetails(() => isMounted); return () => { isMounted = false; }; }, [fetchTestDetails]);

  const onSubmit = async (data: TeacherTestSettingsInput) => {
    if (!testId || !teacher?.id) return;
    setIsSubmitting(true);

    const dataToSave: Partial<TeacherTestRecordForSettings> = {
      testName: data.testName, Test_Description: data.Test_Description || null,
      Admin_Password: data.Admin_Password === null || data.Admin_Password === undefined ? null : Number(data.Admin_Password),
      duration: String(data.duration),
      totalScore: data.totalScore === null || data.totalScore === undefined ? null : Number(data.totalScore),
      PerNegativeScore: data.PerNegativeScore === null || data.PerNegativeScore === undefined ? null : Number(data.PerNegativeScore),
      status: data.status, QBExam: data.QBExam,
      Test_Subject: data.Test_Subject || null, // Save Test_Subject
      model: data.model, type: data.type,
      Students_can_view_their_results_after_the_test: data.Students_can_view_their_results_after_the_test,
      How_many_times_can_students_take_the_test: data.How_many_times_can_students_take_the_test === null || data.How_many_times_can_students_take_the_test === undefined ? null : Number(data.How_many_times_can_students_take_the_test),
      Shuffle_Questions: data.Shuffle_Questions,
      Who_can_take_your_test: data.Who_can_take_your_test,
      Would_you_like_to_get_admin_access_through_link: data.Would_you_like_to_get_admin_access_through_link,
    };

    try {
      await pb.collection('teacher_tests').update(testId, dataToSave);
      toast({ title: "Settings Saved", description: "Test details updated successfully." });
      fetchTestDetails(() => true);
    } catch (error: any) {
      console.error("Error updating test settings:", error.data || error);
      let errorMsg = "Could not save settings.";
      if (error?.data?.data) { const fieldErrors = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; '); errorMsg = `Validation failed: ${fieldErrors}`;
      } else if (error?.data?.message) { errorMsg = error.data.message; } else if (error?.message) { errorMsg = error.message; }
      toast({ title: "Save Failed", description: errorMsg, variant: "destructive", duration: 7000 });
    } finally { setIsSubmitting(false); }
  };

  if (isLoading) { return ( <div className="p-6 space-y-4"> <Skeleton className="h-8 w-3/4 mb-2" /> <Skeleton className="h-4 w-full" /> <Skeleton className="h-10 w-full mt-4" /> <Skeleton className="h-24 w-full mt-2" /> <Skeleton className="h-10 w-28 mt-4 self-end" /> </div> ); }
  if (error) { return ( <Card className="text-center p-6 border-destructive bg-destructive/10"> <AlertCircle className="mx-auto h-10 w-10 text-destructive mb-3" /> <CardTitle className="text-destructive">Error</CardTitle> <CardDescription className="text-destructive/80">{error}</CardDescription> </Card> ); }

  return (
    <div className="p-4 md:p-6">
      <CardHeader className="px-0 pb-4">
        <CardTitle className="text-xl font-semibold flex items-center gap-2"><Settings className="h-5 w-5 text-primary"/> Test Configuration</CardTitle>
        <CardDescription>Modify the core details and behavior of this test. Fields marked * are essential.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6 px-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
              <FormField control={form.control} name="testName" render={({ field }) => (<FormItem><FormLabel>Test Name *</FormLabel><FormControl><Input placeholder="e.g., Physics - Kinematics Midterm" {...field} /></FormControl><FormMessage /></FormItem>)}/>
              <FormField control={form.control} name="duration" render={({ field }) => (<FormItem><FormLabel>Duration (minutes) *</FormLabel><FormControl><Input type="number" placeholder="e.g., 90" {...field} value={field.value || ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value,10))} /></FormControl><FormMessage /></FormItem>)}/>
              <FormField control={form.control} name="model" render={({ field }) => (<FormItem><FormLabel>Test Model *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger></FormControl><SelectContent>{testModelOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
              <FormField control={form.control} name="type" render={({ field }) => (<FormItem><FormLabel>Test Type *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl><SelectContent>{testTypeOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
              <FormField control={form.control} name="QBExam" render={({ field }) => (<FormItem><FormLabel>Exam Association *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger></FormControl><SelectContent>{qbExamOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
              <FormField
                control={form.control}
                name="Test_Subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Test Subject (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select subject" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {testSubjectOptionsForm.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField control={form.control} name="Test_Description" render={({ field }) => (<FormItem className="mt-4"><FormLabel>Test Description (Optional)</FormLabel><FormControl><Textarea placeholder="Brief overview or special instructions for students..." {...field} value={field.value ?? ''} rows={3}/></FormControl><FormMessage /></FormItem>)}/>

            <Card className="bg-muted/30 p-4 mt-6"><CardHeader className="p-0 pb-3"><CardTitle className="text-base">Scoring & Access</CardTitle></CardHeader><CardContent className="p-0 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <FormField control={form.control} name="totalScore" render={({ field }) => (<FormItem><FormLabel>Total Score (Optional)</FormLabel><FormControl><Input type="number" placeholder="e.g., 100 or 300" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : parseInt(e.target.value,10))} /></FormControl><FormDescription className="text-xs">If blank, score will be sum of question marks.</FormDescription><FormMessage /></FormItem>)}/>
                <FormField control={form.control} name="PerNegativeScore" render={({ field }) => (<FormItem><FormLabel>Negative Score Per Incorrect Question (Optional)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="e.g., -1 or -0.25 (0 for no negative)" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>)}/>
                <FormField control={form.control} name="Admin_Password" render={({ field }) => (<FormItem><FormLabel>Test Access PIN (Optional, 4-6 digits)</FormLabel><FormControl><Input type="number" placeholder="e.g., 1234" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : parseInt(e.target.value,10))}/></FormControl><FormDescription className="text-xs">Students will need this PIN to start the test.</FormDescription><FormMessage /></FormItem>)}/>
                <FormField control={form.control} name="How_many_times_can_students_take_the_test" render={({ field }) => (<FormItem><FormLabel>Max Attempts Per Student (Optional)</FormLabel><FormControl><Input type="number" placeholder="e.g., 1 (default) or 3" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? null : parseInt(e.target.value,10))}/></FormControl><FormMessage /></FormItem>)}/>
            </CardContent></Card>

            <Card className="bg-muted/30 p-4 mt-6"><CardHeader className="p-0 pb-3"><CardTitle className="text-base">Test Behavior & Security</CardTitle></CardHeader><CardContent className="p-0 grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="Who_can_take_your_test" render={({ field }) => (<FormItem><FormLabel>Target Audience *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select who can take" /></SelectTrigger></FormControl><SelectContent>{whoCanTakeTestOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
              <FormField control={form.control} name="Students_can_view_their_results_after_the_test" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 bg-background shadow-sm h-full"><div className="space-y-0.5"><FormLabel>Students View Results Immediately?</FormLabel></div><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)}/>
              <FormField control={form.control} name="Shuffle_Questions" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 bg-background shadow-sm h-full"><div className="space-y-0.5"><FormLabel>Shuffle Questions Order?</FormLabel></div><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)}/>
              <FormField control={form.control} name="Would_you_like_to_get_admin_access_through_link" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 bg-background shadow-sm h-full"><div className="space-y-0.5"><FormLabel>Enable Admin Access Link?</FormLabel><FormDescription className="text-xs">Secure link for test management.</FormDescription></div><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)}/>
            </CardContent></Card>

          </CardContent>
          <CardFooter className="px-0 pt-6">
            <Button type="submit" disabled={isSubmitting} size="lg">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Test Settings
            </Button>
          </CardFooter>
        </form>
      </Form>
    </div>
  );
}
