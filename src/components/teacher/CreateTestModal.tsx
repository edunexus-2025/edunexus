
'use client';

import { useState } from 'react';
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
  FormDescription as ShadcnFormDescription, 
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TeacherCreateTestModalSchema, type TeacherCreateTestModalInput } from '@/lib/schemas';
import { useAuth } from '@/contexts/AuthContext';
import pb from '@/lib/pocketbase';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TeacherTestSubjectEnumOptions } from '@/lib/constants'; // Import the enum options

interface CreateTestModalProps {
  onTestCreated?: () => void; 
}

const qbExamOptions: Array<NonNullable<TeacherCreateTestModalInput['QBExam']>> = ["MHT CET", "JEE MAIN", "NEET"];
const testModelOptions: Array<NonNullable<TeacherCreateTestModalInput['model']>> = ["Chapterwise", "Full Length"];
const testTypeOptions: Array<NonNullable<TeacherCreateTestModalInput['type']>> = ["Free", "Premium"];

// Special placeholder value for the "None" option in Test Subject select
const NONE_SUBJECT_PLACEHOLDER = "_NONE_SUBJECT_PLACEHOLDER_";

export function CreateTestModal({ onTestCreated }: CreateTestModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { teacher } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<TeacherCreateTestModalInput>({
    resolver: zodResolver(TeacherCreateTestModalSchema),
    defaultValues: {
      testName: '',
      duration: undefined, 
      model: undefined,
      type: undefined,
      QBExam: undefined,
      Test_Subject: undefined, // Default to undefined
      adminPassword: undefined,
    },
  });

  const onSubmit = async (values: TeacherCreateTestModalInput) => {
    if (!teacher) {
      toast({ title: "Authentication Error", description: "You must be logged in as a teacher.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    
    const dataToSave = {
      teacherId: teacher.id,
      testName: values.testName,
      duration: String(values.duration), 
      model: values.model,
      type: values.type,
      QBExam: values.QBExam,
      Test_Subject: values.Test_Subject === NONE_SUBJECT_PLACEHOLDER ? null : values.Test_Subject, // Save as null if placeholder was used
      status: "Draft", 
      Admin_Password: values.adminPassword,
    };

    console.log("Attempting to create test with values:", dataToSave);

    try {
      await pb.collection('teacher_tests').create(dataToSave);
      toast({
        title: 'Test Created (Draft)',
        description: `Test "${values.testName}" has been saved as a draft.`,
      });
      form.reset();
      setIsOpen(false);
      onTestCreated?.(); 
    } catch (error: any) {
      console.error("Failed to create teacher test:", error);
      toast({
        title: 'Failed to Create Test',
        description: error.data?.message || error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">
          <PlusCircle className="mr-2 h-5 w-5" /> Create New Test
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px] flex flex-col max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b flex-shrink-0">
          <DialogTitle>Create New Test</DialogTitle>
          <DialogDescription>
            Fill in the details below to create a new test. It will be saved as a draft.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" id="createTestActualForm">
                <FormField
                  control={form.control}
                  name="testName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Test Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Physics Chapter 1: Units & Measurements" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (in minutes) *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="e.g., 90" 
                          {...field} 
                          value={field.value === undefined ? '' : field.value}
                          onChange={e => {
                            const val = parseInt(e.target.value, 10);
                            field.onChange(isNaN(val) ? undefined : val);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Test Model *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select model" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {testModelOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <ShadcnFormDescription className="text-xs">
                          For a single chapter, select "Chapterwise". For multiple lessons or full syllabus, use "Full Length".
                        </ShadcnFormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Test Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {testTypeOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                 <FormField
                  control={form.control}
                  name="Test_Subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Test Subject (Optional)</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(value === NONE_SUBJECT_PLACEHOLDER ? undefined : value as TeacherCreateTestModalInput['Test_Subject'])} 
                        value={field.value || NONE_SUBJECT_PLACEHOLDER}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select subject (if applicable)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NONE_SUBJECT_PLACEHOLDER}>None (General Test)</SelectItem>
                          {TeacherTestSubjectEnumOptions.map(subject => (
                            <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="QBExam"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Exam Association (QBExam) *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select exam association" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {qbExamOptions.map(exam => (
                            <SelectItem key={exam} value={exam}>{exam}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="adminPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admin Password (Numeric Code, 4-6 digits) *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="e.g., 123456" 
                          {...field} 
                          value={field.value === undefined ? '' : field.value}
                          onChange={e => {
                            const val = parseInt(e.target.value, 10);
                            field.onChange(isNaN(val) ? undefined : val);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground pt-1">
                        This is a numeric code for test management (e.g., 1234 or 987654). Students will need this to take the test.
                      </p>
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </div>
        </ScrollArea>
        
        <DialogFooter className="p-6 pt-4 border-t flex-shrink-0">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSubmitting}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" form="createTestActualForm" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Creating...' : 'Create Test (Draft)'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

