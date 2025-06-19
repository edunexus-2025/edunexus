
'use client';

import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState, useCallback, ChangeEvent, FormEvent, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { TeacherQuestionDataCreateSchema } from '@/lib/schemas';
import type { TeacherQuestionDataCreateInput } from '@/lib/schemas';
import { AlertCircle, Loader2, Save, ImagePlus as ImageIcon, Trash2, BookOpen, FilePlus } from 'lucide-react';
import { ImageImportModal } from '@/components/teacher/ImageImportModal';
import NextImage from 'next/image';
import { Routes, TeacherQBExamEnumOptions, TeacherTestSubjectEnumOptions } from '@/lib/constants';

// Helper to check if a string is a valid HTTP/S URL
const isValidHttpUrl = (string: string | null | undefined): string is string => {
  if (!string) return false;
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
};

const correctOptionSelect: Array<TeacherQuestionDataCreateInput['CorrectOption']> = ["Option A", "Option B", "Option C", "Option D"];

interface ParentTestDetails {
  testName: string | null;
  QBExam: TeacherQuestionDataCreateInput['QBExam'] | undefined;
  Test_Subject: TeacherQuestionDataCreateInput['subject'] | undefined;
}

export default function TeacherCreateQuestionForTestPage() {
  const params = useParams();
  const { teacher } = useAuth();
  const { toast } = useToast();
  const testId = typeof params.testId === 'string' ? params.testId : '';
  const router = useRouter();

  const [isLoadingTestDetails, setIsLoadingTestDetails] = useState(true);
  const [parentTestDetails, setParentTestDetails] = useState<ParentTestDetails | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isImageImportModalOpen, setIsImageImportModalOpen] = useState(false);
  const [imageTargetField, setImageTargetField] = useState<keyof TeacherQuestionDataCreateInput | null>(null);
  
  const [imagePreviews, setImagePreviews] = useState<Partial<Record<keyof TeacherQuestionDataCreateInput, string | null>>>({
    QuestionImage: null, OptionAImage: null, OptionBImage: null, OptionCImage: null, OptionDImage: null, explanationImage: null,
  });

  const form = useForm<TeacherQuestionDataCreateInput>({
    resolver: zodResolver(TeacherQuestionDataCreateSchema),
    defaultValues: {
      lesson_name: '', 
      QuestionText: '', QuestionImage: null,
      OptionAText: '', OptionAImage: null,
      OptionBText: '', OptionBImage: null,
      OptionCText: '', OptionCImage: null,
      OptionDText: '', OptionDImage: null,
      CorrectOption: "Option A",
      explanationText: '', explanationImage: null,
      QBExam: undefined, 
      subject: undefined,
      marks: 1,
    },
  });

  const fetchParentTestDetails = useCallback(async (isMountedGetter: () => boolean) => {
    if (!testId || !teacher?.id) { 
      if (isMountedGetter()) { setIsLoadingTestDetails(false); setError(testId ? "Auth error." : "Test ID missing."); }
      return;
    }
    if (isMountedGetter()) setIsLoadingTestDetails(true);
    try {
      const record = await pb.collection('teacher_tests').getOne(testId, { fields: 'id,testName,teacherId,QBExam,Test_Subject' });
      if (!isMountedGetter()) return;
      if (record.teacherId !== teacher.id) { 
        if (isMountedGetter()) { setError("Unauthorized to add questions to this test."); setIsLoadingTestDetails(false); }
        return; 
      }
      const details: ParentTestDetails = {
        testName: record.testName || 'Untitled Test',
        QBExam: record.QBExam as TeacherQuestionDataCreateInput['QBExam'] || undefined,
        Test_Subject: record.Test_Subject as TeacherQuestionDataCreateInput['subject'] || undefined,
      };
      setParentTestDetails(details);
      form.reset({
        ...form.getValues(),
        lesson_name: details.testName || '',
        QBExam: details.QBExam,
        subject: details.Test_Subject,
        marks: form.getValues('marks') || 1,
        CorrectOption: form.getValues('CorrectOption') || "Option A",
      });

    } catch (err) { 
      if (isMountedGetter()) {
        console.error("Error fetching parent test details for add question page:", err);
        setError("Could not load context for adding questions.");
      }
    } finally { 
      if (isMountedGetter()) setIsLoadingTestDetails(false);
    }
  }, [testId, teacher?.id, form]);

  useEffect(() => { 
    let isMounted = true; 
    fetchParentTestDetails(() => isMounted);
    return () => { isMounted = false; };
  }, [fetchParentTestDetails]);

  const openImageModalFor = (targetField: keyof TeacherQuestionDataCreateInput) => {
    setImageTargetField(targetField);
    setIsImageImportModalOpen(true);
  };

  const handleImageAssignFromModal = (imageUrl: string | null) => {
    if (imageTargetField && imageUrl) {
      form.setValue(imageTargetField, imageUrl as any); 
      setImagePreviews(prev => ({ ...prev, [imageTargetField]: imageUrl }));
      toast({ title: "Image URL Set", description: "URL from library has been set to the field." });
    } else if (imageTargetField && imageUrl === null) { 
      form.setValue(imageTargetField, null);
      setImagePreviews(prev => ({ ...prev, [imageTargetField]: null }));
    }
    setIsImageImportModalOpen(false);
    setImageTargetField(null);
  };
  
  const removeImagePreview = (fieldKey: keyof TeacherQuestionDataCreateInput) => {
    form.setValue(fieldKey, null);
    setImagePreviews(prev => ({...prev, [fieldKey]: null}));
  };

  const handleUrlInputChange = (fieldKey: keyof TeacherQuestionDataCreateInput, url: string) => {
    const trimmedUrl = url.trim();
    form.setValue(fieldKey, trimmedUrl === '' ? null : trimmedUrl);
    if (isValidHttpUrl(trimmedUrl)) {
      setImagePreviews(prev => ({ ...prev, [fieldKey]: trimmedUrl }));
    } else {
      setImagePreviews(prev => ({ ...prev, [fieldKey]: null }));
    }
  };

  const onSubmit = async (values: TeacherQuestionDataCreateInput) => {
    if (!teacher?.id || !testId || !parentTestDetails?.testName || !parentTestDetails.QBExam || !parentTestDetails.Test_Subject) {
      toast({ title: "Error", description: "Missing teacher, test ID, or critical parent test details (Test Name, QBExam, Subject).", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(true);
    
    const dataForTeacherQb: any = {
      teacher: teacher.id,
      LessonName: testId, 
      lesson_name: parentTestDetails.testName, 
      QuestionText: values.QuestionText || null,
      QuestionImage: isValidHttpUrl(values.QuestionImage) ? values.QuestionImage : null,
      OptionAText: values.OptionAText || null,
      OptionAImage: isValidHttpUrl(values.OptionAImage) ? values.OptionAImage : null,
      OptionBText: values.OptionBText || null,
      OptionBImage: isValidHttpUrl(values.OptionBImage) ? values.OptionBImage : null,
      OptionCText: values.OptionCText || null,
      OptionCImage: isValidHttpUrl(values.OptionCImage) ? values.OptionCImage : null,
      OptionDText: values.OptionDText || null,
      OptionDImage: isValidHttpUrl(values.OptionDImage) ? values.OptionDImage : null,
      CorrectOption: values.CorrectOption,
      explanationText: values.explanationText || null,
      explanationImage: isValidHttpUrl(values.explanationImage) ? values.explanationImage : null,
      QBExam: parentTestDetails.QBExam, 
      subject: parentTestDetails.Test_Subject, 
      marks: values.marks ? Number(values.marks) : 1,
    };

    try {
      const newQuestionRecord = await pb.collection('teacher_question_data').create(dataForTeacherQb);
      await pb.collection('teacher_tests').update(testId, { "questions_teachers+": newQuestionRecord.id });

      toast({ title: "Question Created & Added", description: `New question added to your QB and linked to "${parentTestDetails.testName}".` });
      form.reset({ 
          QuestionText: '', QuestionImage: null,
          OptionAText: '', OptionAImage: null, OptionBText: '', OptionBImage: null,
          OptionCText: '', OptionCImage: null, OptionDText: '', OptionDImage: null,
          CorrectOption: "Option A", 
          explanationText: '', explanationImage: null,
          lesson_name: parentTestDetails.testName,
          QBExam: parentTestDetails.QBExam,
          subject: parentTestDetails.Test_Subject,
          marks: 1,
      });
      setImagePreviews({ QuestionImage: null, OptionAImage: null, OptionBImage: null, OptionCImage: null, OptionDImage: null, explanationImage: null, });
    } catch (error: any) {
      console.error("Error creating/linking question:", error.data?.data || error.response || error);
      const specificErrors = error.data?.data;
      let errorMessages = "Could not save the question. ";
      if (specificErrors && typeof specificErrors === 'object') {
        errorMessages += Object.entries(specificErrors).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
      } else {
        errorMessages += error.data?.message || error.message || "Unknown error.";
      }
      toast({ title: "Save Failed", description: errorMessages, variant: "destructive", duration: 9000 });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const renderImageFieldWithModal = (fieldName: keyof TeacherQuestionDataCreateInput, label: string) => (
    <FormField
      control={form.control}
      name={fieldName}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-1 text-xs text-muted-foreground">{label}</FormLabel>
          <div className="flex items-center gap-1.5">
            <FormControl>
              <Input
                type="url"
                placeholder="Image URL or Upload"
                value={(field.value as string) || ''}
                onChange={(e) => handleUrlInputChange(fieldName, e.target.value)}
                className="h-8 text-xs flex-grow bg-background dark:bg-slate-800"
              />
            </FormControl>
            <Button type="button" variant="outline" size="icon" onClick={() => openImageModalFor(fieldName)} className="h-8 w-8 text-xs px-2 py-1 flex-shrink-0">
              <ImageIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
          {imagePreviews[fieldName] && isValidHttpUrl(imagePreviews[fieldName]) && (
            <div className="mt-1 p-1 border rounded-md bg-muted/30 w-24 h-16 relative">
              <NextImage src={imagePreviews[fieldName]!} alt={`${label} Preview`} layout="fill" objectFit="contain" className="rounded" data-ai-hint="question preview"/>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeImagePreview(fieldName)} className="absolute -top-1 -right-1 h-4 w-4 p-0 text-destructive hover:bg-destructive/10 rounded-full"><Trash2 size={10} /></Button>
            </div>
          )}
          <FormMessage className="text-xs"/>
        </FormItem>
      )}
    />
  );

  if (isLoadingTestDetails) { return (<div className="p-6 space-y-4"><Skeleton className="h-8 w-3/4 mb-2" /><Skeleton className="h-64 w-full" /></div>); }
  if (error) { return (<Card className="text-center border-destructive bg-destructive/10 p-6"><AlertCircle className="mx-auto h-10 w-10 text-destructive mb-3" /><CardTitle className="text-destructive">Error</CardTitle><CardDescription className="text-destructive/80">{error}</CardDescription></Card>); }

  return (
    <div className="p-2 sm:p-4 md:p-6">
      <CardHeader className="px-0 pb-4">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <FilePlus className="h-5 w-5 text-primary"/> Create New Question for: <span className="text-primary truncate">{parentTestDetails?.testName || 'Test'}</span>
        </CardTitle>
        <CardDescription>
          This question will be saved to your "My Teacher QB" and added to this test.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            <Card className="p-4 shadow-sm border bg-card">
              <CardHeader className="p-0 pb-3"><CardTitle className="text-base font-medium">Categorization & Marks</CardTitle></CardHeader>
              <CardContent className="p-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormItem>
                  <FormLabel className="text-sm">Test Name (Lesson Context)</FormLabel>
                  <Input value={parentTestDetails?.testName || 'Loading...'} readOnly className="h-9 text-sm bg-muted/50" />
                </FormItem>
                <FormItem>
                  <FormLabel className="text-sm">Exam Association (from Test)</FormLabel>
                  <Input value={parentTestDetails?.QBExam || 'N/A'} readOnly className="h-9 text-sm bg-muted/50" />
                </FormItem>
                <FormItem>
                  <FormLabel className="text-sm">Subject (from Test)</FormLabel>
                  <Input value={parentTestDetails?.Test_Subject || 'N/A'} readOnly className="h-9 text-sm bg-muted/50" />
                </FormItem>
                 <FormField control={form.control} name="marks" render={({ field }) => (<FormItem><FormLabel className="text-sm">Marks for this Question *</FormLabel><FormControl><Input type="number" placeholder="e.g., 1" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value,10))} className="h-9 text-sm bg-background dark:bg-slate-800"/></FormControl><FormMessage /></FormItem>)}/>
              </CardContent>
            </Card>
            
            <Card className="p-4 shadow-sm border bg-card">
              <CardHeader className="p-0 pb-3"><CardTitle className="text-base font-medium">Question Content</CardTitle></CardHeader>
              <CardContent className="p-0 space-y-3">
                <FormField control={form.control} name="QuestionText" render={({ field }) => (<FormItem><FormLabel className="text-sm">Question Text (Supports LaTeX: $...$ or $$...$$)</FormLabel><FormControl><Textarea placeholder="Type question..." {...field} value={field.value ?? ''} rows={4} className="text-sm bg-background dark:bg-slate-800"/></FormControl><FormMessage /></FormItem>)}/>
                {renderImageFieldWithModal("QuestionImage", "Question Image (Optional URL or Upload)")}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(['A', 'B', 'C', 'D'] as const).map(optChar => (
                <Card key={optChar} className="p-3 shadow-sm border bg-card">
                  <CardHeader className="p-0 pb-2"><CardTitle className="text-sm font-medium">Option {optChar} *</CardTitle></CardHeader>
                  <CardContent className="p-0 space-y-2">
                    <FormField control={form.control} name={`Option${optChar}Text` as keyof TeacherQuestionDataCreateInput} render={({ field }) => (<FormItem><FormLabel className="text-xs">Text (LaTeX)</FormLabel><FormControl><Textarea placeholder={`Option ${optChar} text`} {...field} value={field.value ?? ''} rows={2} className="text-xs min-h-[38px] bg-background dark:bg-slate-800"/></FormControl><FormMessage className="text-xs"/></FormItem>)}/>
                    {renderImageFieldWithModal(`Option${optChar}Image` as keyof TeacherQuestionDataCreateInput, "Image (Optional URL or Upload)")}
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <Card className="p-4 shadow-sm border bg-card">
              <CardHeader className="p-0 pb-3"><CardTitle className="text-base font-medium">Answer & Explanation</CardTitle></CardHeader>
              <CardContent className="p-0 space-y-3">
                <FormField control={form.control} name="CorrectOption" render={({ field }) => (<FormItem><FormLabel className="text-sm">Correct Option *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-9 text-sm bg-background dark:bg-slate-800"><SelectValue placeholder="Select correct answer" /></SelectTrigger></FormControl><SelectContent>{correctOptionSelect.map(val => (<SelectItem key={val} value={val}>{val}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>
                <FormField control={form.control} name="explanationText" render={({ field }) => (<FormItem><FormLabel className="text-sm">Explanation Text (Optional, LaTeX)</FormLabel><FormControl><Textarea placeholder="Detailed explanation..." {...field} value={field.value ?? ''} rows={3} className="text-sm bg-background dark:bg-slate-800"/></FormControl><FormMessage /></FormItem>)}/>
                {renderImageFieldWithModal("explanationImage", "Explanation Image (Optional URL or Upload)")}
              </CardContent>
            </Card>
            
            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Saving Question...' : 'Save Question & Add to This Test'}
            </Button>
          </form>
        </Form>
      </CardContent>
       <ImageImportModal
        isOpen={isImageImportModalOpen}
        onOpenChange={setIsImageImportModalOpen}
        onImageAssign={handleImageAssignFromModal}
        currentImageTargetField={imageTargetField as string}
      />
    </div>
  );
}
