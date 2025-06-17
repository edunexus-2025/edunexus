
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Settings2, Loader2 } from 'lucide-react';
import { Routes } from '@/lib/constants';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TeacherTestSettingsSchema, type TeacherTestSettingsInput } from '@/lib/schemas';
import { useEffect, useState, useCallback } from 'react';
import pb from '@/lib/pocketbase';
import type { RecordModel } from 'pocketbase';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

// Define enums for select options based on schema
const statusOptions: Array<TeacherTestSettingsInput['status']> = ["Draft", "Published", "Archived"];
const whoCanTakeTestOptions: Array<TeacherTestSettingsInput['Who_can_take_your_test']> = [
    "EveryOne", "Group 1", "Group 2", "Group 3", "Group 4", "Group 5", "Group 6"
];

export default function TestSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const testId = typeof params.testId === 'string' ? params.testId : '';

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<TeacherTestSettingsInput>({
    resolver: zodResolver(TeacherTestSettingsSchema),
    defaultValues: {
        testName: '',
        Test_Description: '',
        Admin_Password: undefined, 
        duration: undefined, 
        totalScore: undefined,
        PerNegativeScore: undefined,
        status: "Draft",
        Students_can_view_their_results_after_the_test: true,
        How_many_times_can_students_take_the_test: 1,
        Shuffle_Questions: false,
        Who_can_take_your_test: "EveryOne",
        Would_you_like_to_get_admin_access_through_link: false,
    },
  });

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      if (!testId) {
        if (isMounted) setIsLoading(false);
        return;
      }
      if (isMounted) setIsLoading(true);
      try {
        const record = await pb.collection('teacher_tests').getOne<RecordModel>(testId);
        if (isMounted) { 
          form.reset({
            testName: record.testName || '',
            Test_Description: record.Test_Description || '',
            Admin_Password: typeof record.Admin_Password === 'number' ? record.Admin_Password : undefined,
            duration: typeof record.duration === 'string' ? parseInt(record.duration, 10) : (typeof record.duration === 'number' ? record.duration : undefined),
            totalScore: typeof record.totalScore === 'number' ? record.totalScore : undefined,
            PerNegativeScore: typeof record.PerNegativeScore === 'number' ? record.PerNegativeScore : undefined,
            status: record.status as TeacherTestSettingsInput['status'] || "Draft",
            Students_can_view_their_results_after_the_test: !!record.Students_can_view_their_results_after_the_test,
            How_many_times_can_students_take_the_test: typeof record.How_many_times_can_students_take_the_test === 'number' ? record.How_many_times_can_students_take_the_test : undefined,
            Shuffle_Questions: !!record.Shuffle_Questions,
            Who_can_take_your_test: record.Who_can_take_your_test as TeacherTestSettingsInput['Who_can_take_your_test'] || "EveryOne",
            Would_you_like_to_get_admin_access_through_link: !!record.Would_you_like_to_get_admin_access_through_link,
          });
        }
      } catch (error: any) {
        if (isMounted) { 
          if (error.isAbort || (error.name === 'ClientResponseError' && error.status === 0)) {
            console.warn("Test settings fetch request was autocancelled. This is often benign in development due to React StrictMode.");
            toast({ title: "Fetching Settings Interrupted", description: "The request was cancelled. This can happen during page navigation or if the component re-rendered quickly. If this persists, please check your network.", variant: "default", duration: 7000 });
          } else {
            toast({ title: "Error Fetching Settings", description: error.message || "Could not load test settings.", variant: "destructive" });
          }
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, [testId, form, toast]);


  const onSubmit = async (data: TeacherTestSettingsInput) => {
    setIsSubmitting(true);
    const dataToSave: Record<string, any> = {
        testName: data.testName,
        Test_Description: data.Test_Description || null,
        duration: String(data.duration), // Duration is stored as string in PB
        status: data.status,
        Students_can_view_their_results_after_the_test: data.Students_can_view_their_results_after_the_test,
        Shuffle_Questions: data.Shuffle_Questions,
        Who_can_take_your_test: data.Who_can_take_your_test,
        Would_you_like_to_get_admin_access_through_link: data.Would_you_like_to_get_admin_access_through_link,
    };

    // Only include numeric fields if they are valid numbers, otherwise send null to PocketBase
    if (data.Admin_Password !== undefined && !isNaN(data.Admin_Password)) dataToSave.Admin_Password = data.Admin_Password; else dataToSave.Admin_Password = null;
    if (data.totalScore !== undefined && !isNaN(data.totalScore)) dataToSave.totalScore = data.totalScore; else dataToSave.totalScore = null;
    if (data.PerNegativeScore !== undefined && !isNaN(data.PerNegativeScore)) dataToSave.PerNegativeScore = data.PerNegativeScore; else dataToSave.PerNegativeScore = null;
    if (data.How_many_times_can_students_take_the_test !== undefined && !isNaN(data.How_many_times_can_students_take_the_test)) dataToSave.How_many_times_can_students_take_the_test = data.How_many_times_can_students_take_the_test; else dataToSave.How_many_times_can_students_take_the_test = null;


    console.log("Submitting test settings:", dataToSave);

    try {
      await pb.collection('teacher_tests').update(testId, dataToSave);
      toast({ title: "Settings Saved", description: "Your test settings have been updated." });
    } catch (error: any) {
      toast({ title: "Error Saving Settings", description: error.data?.message || error.message || "Could not save settings.", variant: "destructive" });
      console.error("Error updating test settings:", error.data || error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" /> 
        <Card className="shadow-lg">
          <CardHeader>
            <Skeleton className="h-7 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <Skeleton className="h-10 w-24" />
          </CardFooter>
        </Card>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => router.push(Routes.teacherTestPanel(testId))}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Test Panel
      </Button>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl md:text-2xl flex items-center gap-2">
            <Settings2 className="h-6 w-6 text-primary" />
            Settings for: <span className="text-primary">{form.getValues('testName') || `Test (ID: ${testId.substring(0,7)}...)`}</span>
          </CardTitle>
          <CardDescription>
            Adjust settings for this specific test.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              <FormField control={form.control} name="testName" render={({ field }) => ( <FormItem> <FormLabel>Test Name</FormLabel> <FormControl><Input placeholder="Enter test name" {...field} /></FormControl> <FormMessage /> </FormItem> )}/>
              <FormField control={form.control} name="Test_Description" render={({ field }) => ( <FormItem> <FormLabel>Test Description</FormLabel> <FormControl><Textarea placeholder="Describe your test..." {...field} value={field.value ?? ''} /></FormControl> <FormMessage /> </FormItem> )}/>
              <div className="grid md:grid-cols-2 gap-6">
                <FormField control={form.control} name="Admin_Password" render={({ field }) => ( <FormItem> <FormLabel>Admin Password (Numeric)</FormLabel> <FormControl><Input type="number" placeholder="e.g., 123456" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value,10))} value={field.value ?? ''} /></FormControl> <FormMessage /> </FormItem> )}/>
                <FormField control={form.control} name="duration" render={({ field }) => ( <FormItem> <FormLabel>Duration (minutes)</FormLabel> <FormControl><Input type="number" placeholder="e.g., 90" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value,10))} value={field.value ?? ''} /></FormControl> <FormMessage /> </FormItem> )}/>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                 <FormField control={form.control} name="totalScore" render={({ field }) => ( <FormItem> <FormLabel>Total Score (Optional)</FormLabel> <FormControl><Input type="number" placeholder="e.g., 100" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value,10))} value={field.value ?? ''} /></FormControl> <FormMessage /> </FormItem> )}/>
                 <FormField control={form.control} name="PerNegativeScore" render={({ field }) => ( <FormItem> <FormLabel>Negative Mark per Wrong Answer (Optional)</FormLabel> <FormControl><Input type="number" placeholder="e.g., -1 or 0.25" {...field} step="0.01" onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} value={field.value ?? ''} /></FormControl> <FormMessage /> </FormItem> )}/>
              </div>
              <FormField control={form.control} name="status" render={({ field }) => ( <FormItem> <FormLabel>Test Status</FormLabel> <Select onValueChange={field.onChange} value={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl> <SelectContent>{statusOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )}/>
              <FormField control={form.control} name="How_many_times_can_students_take_the_test" render={({ field }) => ( <FormItem> <FormLabel>Max Attempts per Student (1-10, Optional)</FormLabel> <FormControl><Input type="number" min="1" max="10" placeholder="e.g., 1" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value,10))} value={field.value ?? ''} /></FormControl> <FormMessage /> </FormItem> )}/>
              <FormField control={form.control} name="Who_can_take_your_test" render={({ field }) => ( <FormItem> <FormLabel>Who Can Take Your Test?</FormLabel> <Select onValueChange={field.onChange} value={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Select audience" /></SelectTrigger></FormControl> <SelectContent>{whoCanTakeTestOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )}/>
              
              <div className="space-y-4 pt-4 border-t">
                <FormField control={form.control} name="Students_can_view_their_results_after_the_test" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"> <div className="space-y-0.5"> <FormLabel>Allow Students to View Results Immediately</FormLabel> <FormDescription className="text-xs">If enabled, students see their score and explanations right after submission.</FormDescription> </div> <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl> </FormItem> )}/>
                <FormField control={form.control} name="Shuffle_Questions" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"> <div className="space-y-0.5"> <FormLabel>Shuffle Questions</FormLabel> <FormDescription className="text-xs">Randomize question order for each student.</FormDescription> </div> <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl> </FormItem> )}/>
                <FormField control={form.control} name="Would_you_like_to_get_admin_access_through_link" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"> <div className="space-y-0.5"> <FormLabel>Enable Admin Access via Link</FormLabel> <FormDescription className="text-xs">Allows management access using a special link (use with caution).</FormDescription> </div> <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl> </FormItem> )}/>
              </div>

            </CardContent>
            <CardFooter className="border-t pt-6">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Settings
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
