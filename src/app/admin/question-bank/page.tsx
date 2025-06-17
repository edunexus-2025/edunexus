
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
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
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Upload, ClipboardPaste, BookMarked, CalendarDays as CalendarIconLucide, Info, Loader2, Trash2, ListPlus, Tag, FileText as FileTextIcon, ImageIcon as ImageIconLucide, CheckSquare, Combine } from 'lucide-react';
import type { QuestionBankInput } from '@/lib/schemas';
import { QuestionBankSchema, ExamDppEnum, PyqExamNameEnum, PyqShiftEnum } from '@/lib/schemas';
import pb from '@/lib/pocketbase';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Combobox } from '@/components/ui/combobox';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ImageImportModal } from '@/components/teacher/ImageImportModal';
import { QbModal } from '@/components/teacher/QbModal'; 
import NextImage from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation'; // Import useRouter
import { Routes } from '@/lib/constants'; // Import Routes

const subjects = ['Physics', 'Chemistry', 'Mathematics', 'Biology'] as const;
const difficulties = ['Easy', 'Medium', 'Hard'] as const;
const correctOptions = ['A', 'B', 'C', 'D'] as const;

const questionStructureTypeOptions = [
  { value: "text_only" as const, label: "Text Question & Text Options", icon: <FileTextIcon className="mr-2 h-4 w-4" /> },
  { value: "image_only" as const, label: "Image Question (A,B,C,D implied)", icon: <ImageIconLucide className="mr-2 h-4 w-4" /> },
  { value: "text_with_diagram" as const, label: "Text + Diagram & Separate Options", icon: <Combine className="mr-2 h-4 w-4" /> },
] as const;


const pyqExamNameOptions = PyqExamNameEnum.options;
const pyqShiftOptions = PyqShiftEnum.options;
const examDppOptions = ExamDppEnum.options;


const LOCAL_STORAGE_KEYS = {
  LAST_SUBJECT: 'qb_lastSubject',
  LAST_LESSON_NAME: 'qb_lastLessonName',
  LAST_LESSON_TOPIC: 'qb_lastLessonTopic',
  LAST_DIFFICULTY: 'qb_lastDifficulty',
  LAST_QUESTION_STRUCTURE_TYPE: 'qb_lastQuestionStructureType',
  LAST_IS_PYQ: 'qb_lastIsPyq',
  LAST_EXAM_DPP: 'qb_lastExamDpp',
  LAST_PYQ_EXAM_NAME: 'qb_lastPyqExamName',
};

const INITIAL_DEFAULT_VALUES: QuestionBankInput = {
  subject: 'Physics',
  lessonName: '',
  lessonTopic: '',
  difficulty: 'Medium',
  marks: 1,
  tags: '',
  pyq: false,
  ExamDpp: undefined,
  pyqExamName: undefined,
  pyqYear: undefined,
  pyqDate: '',
  pyqShift: undefined,
  questionStructureType: 'text_only',
  questionText: '',
  questionImage: null,
  optionsFormatForDiagramQuestion: undefined,
  optionAText: '',
  optionBText: '',
  optionCText: '',
  optionDText: '',
  optionAImage: null,
  optionBImage: null,
  optionCImage: null,
  optionDImage: null,
  correctOption: 'A',
  explanationText: '',
  explanationImage: null,
};

const isValidHttpUrl = (string: string | null | undefined): string is string => {
  if (!string) return false;
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
};


export default function AdminQuestionBankPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams(); 
  const router = useRouter(); // Initialize router
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [lessonNameOptions, setLessonNameOptions] = useState<{ value: string; label: string }[]>([]);
  const [lessonTopicOptions, setLessonTopicOptions] = useState<{ value: string; label: string }[]>([]);

  const [isImageImportModalOpen, setIsImageImportModalOpen] = useState(false);
  const [isQbModalOpen, setIsQbModalOpen] = useState(false);
  const [imageTargetField, setImageTargetField] = useState<keyof QuestionBankInput | null>(null);
  const [imagePreviews, setImagePreviews] = useState<Partial<Record<keyof QuestionBankInput, string | null>>>({});


  const form = useForm<QuestionBankInput>({
    resolver: zodResolver(QuestionBankSchema),
    defaultValues: INITIAL_DEFAULT_VALUES,
  });

  useEffect(() => {
    const queryExamDpp = searchParams.get('examDpp') as QuestionBankInput['ExamDpp'] | null;
    const querySubject = searchParams.get('subject') as QuestionBankInput['subject'] | null;
    const queryLessonName = searchParams.get('lessonName');
    const queryLessonTopic = searchParams.get('lessonTopic');

    const lastSubject = localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_SUBJECT) as QuestionBankInput['subject'];
    const lastLessonName = localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_LESSON_NAME);
    const lastLessonTopic = localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_LESSON_TOPIC);
    const lastDifficulty = localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_DIFFICULTY) as QuestionBankInput['difficulty'];
    const lastQStructureType = localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_QUESTION_STRUCTURE_TYPE) as QuestionBankInput['questionStructureType'];
    const lastIsPyq = localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_IS_PYQ);
    const lastExamDpp = localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_EXAM_DPP) as QuestionBankInput['ExamDpp'];
    const lastPyqExamName = localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_PYQ_EXAM_NAME) as QuestionBankInput['pyqExamName'];

    const initialValuesToSet = { ...INITIAL_DEFAULT_VALUES };

    if (queryExamDpp) initialValuesToSet.ExamDpp = queryExamDpp;
    else if (lastExamDpp && examDppOptions.includes(lastExamDpp)) initialValuesToSet.ExamDpp = lastExamDpp;
    
    if (querySubject) initialValuesToSet.subject = querySubject;
    else if (lastSubject && subjects.includes(lastSubject)) initialValuesToSet.subject = lastSubject;

    if (queryLessonName) initialValuesToSet.lessonName = queryLessonName;
    else if (lastLessonName) initialValuesToSet.lessonName = lastLessonName;

    if (queryLessonTopic) initialValuesToSet.lessonTopic = queryLessonTopic;
    else if (lastLessonTopic) initialValuesToSet.lessonTopic = lastLessonTopic;

    if (lastDifficulty && difficulties.includes(lastDifficulty)) initialValuesToSet.difficulty = lastDifficulty;
    if (lastQStructureType && questionStructureTypeOptions.some(qdt => qdt.value === lastQStructureType)) initialValuesToSet.questionStructureType = lastQStructureType;
    if (lastIsPyq) initialValuesToSet.pyq = lastIsPyq === 'true';
    if (lastPyqExamName && pyqExamNameOptions.includes(lastPyqExamName) && initialValuesToSet.pyq) initialValuesToSet.pyqExamName = lastPyqExamName;
    
    form.reset(initialValuesToSet);

  }, [form, searchParams]);

  const watchedQuestionStructureType = form.watch('questionStructureType');
  const watchedPyq = form.watch('pyq');
  const watchedOptionsFormatForDiagram = form.watch('optionsFormatForDiagramQuestion');


  useEffect(() => {
    let isMounted = true;
    async function fetchData() {
      if (!isMounted) return;
      setIsLoadingData(true);
      try {
        const records = await pb.collection('question_bank').getFullList({
          fields: 'lessonName,lessonTopic',
        });
        
        if (isMounted) {
          const distinctLessonNames = Array.from(new Set(records.map(r => r.lessonName).filter(Boolean)))
            .map(name => ({ value: name, label: name }));
          const distinctLessonTopics = Array.from(new Set(records.map(r => r.lessonTopic).filter(Boolean)))
            .map(topic => ({ value: topic, label: topic }));
            
          setLessonNameOptions(distinctLessonNames);
          setLessonTopicOptions(distinctLessonTopics);
        }
      } catch (error: any) {
        if (isMounted) {
          if ((error instanceof Error && error.name === 'AbortError') || (error.data && error.data.message && error.data.message.includes("request was autocancelled")) || error.status === 0 ) {
              console.warn('Fetch distinct lessons/topics aborted or cancelled (likely due to component unmount or StrictMode).');
          } else {
            console.error("Failed to fetch existing lessons/topics:", error);
            toast({ title: "Error fetching data", description: "Could not load existing lesson names and topics.", variant: "destructive" });
          }
        }
      } finally {
        if (isMounted) setIsLoadingData(false);
      }
    }
    fetchData();
    return () => { isMounted = false; };
  }, [toast]); 

  useEffect(() => {
    if (watchedQuestionStructureType === 'image_only') {
      if (!form.getValues('optionAText')) form.setValue('optionAText', 'Option A');
      if (!form.getValues('optionBText')) form.setValue('optionBText', 'Option B');
      if (!form.getValues('optionCText')) form.setValue('optionCText', 'Option C');
      if (!form.getValues('optionDText')) form.setValue('optionDText', 'Option D');
      form.setValue('questionText', ''); 
      form.setValue('optionAImage', null); form.setValue('optionBImage', null); form.setValue('optionCImage', null); form.setValue('optionDImage', null);
      form.setValue('optionsFormatForDiagramQuestion', undefined); 
    } else if (watchedQuestionStructureType === 'text_only') {
      form.setValue('questionImage', null); 
      form.setValue('optionAImage', null); form.setValue('optionBImage', null); form.setValue('optionCImage', null); form.setValue('optionDImage', null);
      form.setValue('optionsFormatForDiagramQuestion', undefined); 
    }
  }, [watchedQuestionStructureType, form]);

  useEffect(() => {
    if (watchedQuestionStructureType === 'text_with_diagram') {
        if (watchedOptionsFormatForDiagram === 'text_options') {
            form.setValue('optionAImage', null); form.setValue('optionBImage', null); form.setValue('optionCImage', null); form.setValue('optionDImage', null);
        } else if (watchedOptionsFormatForDiagram === 'image_options') {
            form.setValue('optionAText', ''); form.setValue('optionBText', ''); form.setValue('optionCText', ''); form.setValue('optionDText', '');
        }
    }
  }, [watchedQuestionStructureType, watchedOptionsFormatForDiagram, form]);


  useEffect(() => {
    if (!watchedPyq) {
      form.setValue('pyqExamName', undefined);
      form.setValue('pyqYear', undefined);
      form.setValue('pyqDate', '');
      form.setValue('pyqShift', undefined);
    } else {
      form.setValue('ExamDpp', undefined); 
    }
  }, [watchedPyq, form]);


  async function onSubmit(data: QuestionBankInput) {
    setIsSubmitting(true);
    const formData = new FormData();
    
    const appendSmart = (key: string, value: any, isFile = false) => {
        if (isFile) {
            if (value instanceof File) {
                formData.append(key, value);
            }
        } else { 
            if (value !== undefined && value !== null && (typeof value !== 'string' || value.trim() !== '')) {
                formData.append(key, String(value));
            }
        }
    };
    
    appendSmart('subject', data.subject);
    appendSmart('lessonName', data.lessonName);
    appendSmart('lessonTopic', data.lessonTopic);
    appendSmart('difficulty', data.difficulty);
    appendSmart('marks', data.marks);
    appendSmart('tags', data.tags);
    
    formData.append('pyq', data.pyq ? 'true' : 'false'); 
    if (data.pyq) {
        appendSmart('pyqExamName', data.pyqExamName);
        appendSmart('pyqYear', data.pyqYear);
        appendSmart('pyqDate', data.pyqDate);
        appendSmart('pyqShift', data.pyqShift);
    } else {
        appendSmart('ExamDpp', data.ExamDpp); 
    }

    if (data.questionStructureType === 'text_only') {
      appendSmart('questionType', 'text');
      appendSmart('optionsFormat', 'text_options');
      appendSmart('questionText', data.questionText);
    } else if (data.questionStructureType === 'image_only') {
      appendSmart('questionType', 'image');
      appendSmart('optionsFormat', 'text_options'); 
      appendSmart('questionImage', data.questionImage, true);
    } else if (data.questionStructureType === 'text_with_diagram') {
      appendSmart('questionType', 'text_image');
      appendSmart('questionText', data.questionText);
      appendSmart('questionImage', data.questionImage, true);
      appendSmart('optionsFormat', data.optionsFormatForDiagramQuestion);
    }
    
    if (data.questionStructureType === 'text_only' || (data.questionStructureType === 'text_with_diagram' && data.optionsFormatForDiagramQuestion === 'text_options')) {
        appendSmart('optionAText', data.optionAText);
        appendSmart('optionBText', data.optionBText);
        appendSmart('optionCText', data.optionCText);
        appendSmart('optionDText', data.optionDText);
    } else if (data.questionStructureType === 'image_only') { 
        appendSmart('optionAText', data.optionAText || 'Option A');
        appendSmart('optionBText', data.optionBText || 'Option B');
        appendSmart('optionCText', data.optionCText || 'Option C');
        appendSmart('optionDText', data.optionDText || 'Option D');
    }

    if (data.questionStructureType === 'text_with_diagram' && data.optionsFormatForDiagramQuestion === 'image_options') {
        appendSmart('optionAImage', data.optionAImage, true);
        appendSmart('optionBImage', data.optionBImage, true);
        appendSmart('optionCImage', data.optionCImage, true);
        appendSmart('optionDImage', data.optionDImage, true);
    }
    
    appendSmart('correctOption', data.correctOption);
    appendSmart('explanationText', data.explanationText);
    appendSmart('explanationImage', data.explanationImage, true);
    
    try {
      await pb.collection('question_bank').create(formData);
      toast({ title: 'Question Added!', description: 'The new question has been successfully added to the bank.' });
      
      if (data.subject) localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_SUBJECT, data.subject);
      if (data.lessonName) localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_LESSON_NAME, data.lessonName);
      if (data.lessonTopic) localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_LESSON_TOPIC, data.lessonTopic);
      if (data.difficulty) localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_DIFFICULTY, data.difficulty);
      if (data.questionStructureType) localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_QUESTION_STRUCTURE_TYPE, data.questionStructureType);
      localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_IS_PYQ, String(data.pyq));
      if (data.ExamDpp && !data.pyq) localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_EXAM_DPP, data.ExamDpp); else localStorage.removeItem(LOCAL_STORAGE_KEYS.LAST_EXAM_DPP);
      if (data.pyqExamName && data.pyq) localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_PYQ_EXAM_NAME, data.pyqExamName); else localStorage.removeItem(LOCAL_STORAGE_KEYS.LAST_PYQ_EXAM_NAME);

      router.push(Routes.adminEditQuestion); // Redirect after successful submission

    } catch (error: any) {
      console.error('PocketBase Error - Failed to add question:', error.data || error.originalError || error);
      let detailedErrorMessage = 'An unexpected error occurred. Check console for details.';
      if (error.data && error.data.data) {
        detailedErrorMessage = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
      } else if (error.message) { detailedErrorMessage = error.message; }
      toast({ title: 'Error Adding Question', description: detailedErrorMessage, variant: 'destructive', duration: 9000 });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleClearForm = () => {
    form.reset(INITIAL_DEFAULT_VALUES);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.LAST_SUBJECT);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.LAST_LESSON_NAME);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.LAST_LESSON_TOPIC);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.LAST_DIFFICULTY);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.LAST_QUESTION_STRUCTURE_TYPE);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.LAST_IS_PYQ);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.LAST_EXAM_DPP);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.LAST_PYQ_EXAM_NAME);
    setImagePreviews({});
    toast({ title: "Form Cleared", description: "You can start fresh." });
  };

  const handlePasteImage = useCallback(async (
    formFieldName: keyof QuestionBankInput,
    onChange: (file: File | null | string) => void // Allow string for URL
  ) => {
    if (!navigator.clipboard || !navigator.clipboard.read) {
      toast({ title: "Clipboard API Not Supported", description: "Please use 'Choose File' or 'Image Library'.", variant: "destructive" });
      return;
    }
    toast({ title: "Attempting to paste image...", duration: 2000 });
    try {
      if (navigator.permissions && typeof navigator.permissions.query === 'function') {
        const permission = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName });
        if (permission.state === 'denied') {
          toast({ title: "Clipboard Permission Denied", description: "Please allow clipboard access.", variant: "destructive" });
          return;
        }
      }
      const clipboardItems = await navigator.clipboard.read();
      let imageFile: File | null = null;
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            const blob = await item.getType(type);
            const extension = type.split('/')[1] || 'png';
            const fileName = `pasted_image_${Date.now()}.${extension}`;
            imageFile = new File([blob], fileName, { type });
            break;
          }
        }
        if (imageFile) break;
      }
      if (imageFile) {
        onChange(imageFile); 
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreviews(prev => ({ ...prev, [formFieldName as string]: reader.result as string }));
        };
        reader.readAsDataURL(imageFile);
        toast({ title: "Image Pasted Successfully!", description: `Pasted ${imageFile.name}.` });
      } else {
        toast({ title: "No Image Found on Clipboard", description: "Please copy an image first.", variant: "default" });
      }
    } catch (err: any) {
      console.error("Error pasting image:", err);
      toast({ title: "Paste Failed", description: err.message || "Could not paste image.", variant: "destructive" });
    }
  }, [toast]);

  const openImageModalFor = (target: keyof QuestionBankInput) => {
    setImageTargetField(target); 
    setIsImageImportModalOpen(true);
  };

  const handleImageAssignFromModal = (imageUrl: string | null) => { 
    if (imageTargetField && imageUrl) {
      form.setValue(imageTargetField, imageUrl as any); 
      setImagePreviews(prev => ({ ...prev, [imageTargetField as string]: imageUrl }));
    } else if (imageTargetField && imageUrl === null) { 
      form.setValue(imageTargetField, null);
      setImagePreviews(prev => ({ ...prev, [imageTargetField as string]: null }));
    }
    setIsImageImportModalOpen(false);
    setImageTargetField(null);
  };
  
  const removeImagePreview = (fieldKey: keyof QuestionBankInput) => {
    form.setValue(fieldKey, null); 
    setImagePreviews(prev => ({...prev, [fieldKey as string]: null}));
  };

  const renderFileInput = (formFieldName: keyof QuestionBankInput, label: string) => (
    <FormField
      control={form.control}
      name={formFieldName}
      render={({ field: { onChange, value: formValue, ...restField } }) => ( 
        <FormItem>
          <FormLabel className="flex items-center gap-1 text-sm"><ImageIconLucide className="h-4 w-4 text-muted-foreground" />{label}</FormLabel>
          <div className="flex items-center gap-2">
            <FormControl>
              <span>
                <Input
                  type="file"
                  accept="image/png, image/jpeg, image/webp, image/gif"
                  onChange={(e) => {
                      const file = e.target.files ? e.target.files[0] : null;
                      onChange(file); 
                      if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                              setImagePreviews(prev => ({ ...prev, [formFieldName as string]: reader.result as string }));
                          };
                          reader.readAsDataURL(file);
                      } else {
                          setImagePreviews(prev => ({ ...prev, [formFieldName as string]: null }));
                      }
                  }}
                  ref={restField.ref} 
                  name={restField.name}
                  onBlur={restField.onBlur}
                  className="block w-full text-xs text-foreground file:mr-2 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                />
              </span>
            </FormControl>
            <Button type="button" variant="outline" size="sm" onClick={() => openImageModalFor(formFieldName)} aria-label={`Import image for ${label}`}>
              <ImageIconLucide className="mr-1.5 h-3.5 w-3.5" /> Lib
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => handlePasteImage(formFieldName, onChange)} aria-label={`Paste image for ${label}`}>
              <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" /> Paste
            </Button>
          </div>
          {imagePreviews[formFieldName as string] && isValidHttpUrl(imagePreviews[formFieldName as string]) && ( 
            <div className="mt-2 p-1 border rounded-md bg-white dark:bg-slate-700/50 relative w-fit text-xs">
                <p className="text-slate-600 dark:text-slate-300 mb-0.5">Preview:</p>
                <NextImage src={imagePreviews[formFieldName as string]!} alt={`${label} Preview`} width={100} height={60} className="rounded object-contain border" data-ai-hint="question image"/>
                <Button type="button" variant="destructive" size="icon" onClick={() => removeImagePreview(formFieldName)} className="absolute -top-2 -right-2 h-5 w-5">
                    <Trash2 size={10} /> <span className="sr-only">Remove</span>
                </Button>
            </div>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );


  return (
    <div className="space-y-6 p-4 md:p-6 bg-muted/30 min-h-screen">
      <ImageImportModal
        isOpen={isImageImportModalOpen}
        onOpenChange={setIsImageImportModalOpen}
        onImageAssign={handleImageAssignFromModal}
        currentImageTargetField={imageTargetField as string}
      />
      <QbModal
        isOpen={isQbModalOpen}
        onOpenChange={setIsQbModalOpen}
      />
      <Card className="shadow-xl border-none">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ListPlus className="h-7 w-7 text-primary" /> Add New Question
          </CardTitle>
          <CardDescription>
            Fill in the details to add a new question to the bank. Fields marked with * are required.
          </CardDescription>
        </CardHeader>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          <Card className="shadow-lg border-t-4 border-primary rounded-t-none">
            <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2"><Info className="text-primary"/>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
              <FormField control={form.control} name="subject" render={({ field }) => ( <FormItem> <FormLabel>Subject *</FormLabel> <Select onValueChange={field.onChange} value={field.value}> <FormControl><span><SelectTrigger><SelectValue placeholder="Select Subject" /></SelectTrigger></span></FormControl> <SelectContent>{subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )}/>
              <FormField control={form.control} name="difficulty" render={({ field }) => ( <FormItem> <FormLabel>Difficulty *</FormLabel> <Select onValueChange={field.onChange} value={field.value}> <FormControl><span><SelectTrigger><SelectValue placeholder="Select Difficulty" /></SelectTrigger></span></FormControl> <SelectContent>{difficulties.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )}/>
              {isLoadingData ? <Skeleton className="h-10 w-full" /> : (<FormField control={form.control} name="lessonName" render={({ field }) => ( <FormItem> <FormLabel>Lesson Name *</FormLabel> <FormControl><span><Combobox options={lessonNameOptions} value={field.value ?? ''} onChange={field.onChange} placeholder="Select or type Lesson" inputPlaceholder="Search/Create lesson..." /></span></FormControl> <FormMessage /> </FormItem> )}/> )}
              {isLoadingData ? <Skeleton className="h-10 w-full" /> : (<FormField control={form.control} name="lessonTopic" render={({ field }) => ( <FormItem className="lg:col-span-1 md:col-span-2"> <FormLabel>Lesson Topic (Optional)</FormLabel> <FormControl><span><Combobox options={lessonTopicOptions} value={field.value ?? ''} onChange={field.onChange} placeholder="Select or type Topic" inputPlaceholder="Search/Create topic..." /></span></FormControl> <FormMessage /> </FormItem> )}/> )}
              <FormField
                control={form.control}
                name="marks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marks *</FormLabel>
                    <FormControl>
                      <span>
                        <Input
                          type="number"
                          placeholder="e.g., 1 or 4"
                          {...field}
                          onChange={e => {
                            const val = e.target.value;
                            if (val === '') {
                              field.onChange(undefined); 
                            } else {
                              const num = parseInt(val, 10);
                              field.onChange(isNaN(num) ? undefined : num);
                            }
                          }}
                          value={field.value === undefined || field.value === null ? '' : String(field.value)}
                        />
                      </span>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="tags" render={({ field }) => (<FormItem className="lg:col-span-1 md:col-span-2"> <FormLabel className="flex items-center gap-1"><Tag className="h-3.5 w-3.5 text-muted-foreground"/>Tags (comma-separated)</FormLabel> <FormControl><span><Input placeholder="e.g. algebra, pyq, important" {...field} value={field.value ?? ''}/></span></FormControl> <FormMessage /> </FormItem> )}/>
            </CardContent>
          </Card>
          
          <Card className="shadow-lg border-t-4 border-primary rounded-t-none">
            <CardHeader>
              <FormField control={form.control} name="pyq" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0"> <FormControl><span><Checkbox checked={field.value} onCheckedChange={field.onChange}/></span></FormControl> <FormLabel className="text-lg font-medium cursor-pointer flex items-center gap-2"><BookMarked className="text-primary"/>Is this a Previous Year Question (PYQ)?</FormLabel> </FormItem> )}/>
            </CardHeader>
            {watchedPyq ? (
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 pt-4 border-t mt-4">
                    <FormField control={form.control} name="pyqExamName" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><BookMarked className="h-4 w-4"/>PYQ Exam Name *</FormLabel> <Select onValueChange={field.onChange} value={field.value}> <FormControl><span><SelectTrigger><SelectValue placeholder="Select PYQ Exam" /></SelectTrigger></span></FormControl> <SelectContent>{pyqExamNameOptions.map(exam => <SelectItem key={exam} value={exam}>{exam}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )}/>
                    <FormField
                      control={form.control}
                      name="pyqYear"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1"><CalendarIconLucide className="h-4 w-4"/>PYQ Year *</FormLabel>
                          <FormControl>
                            <span>
                              <Input
                                type="number"
                                placeholder="e.g., 2023"
                                {...field}
                                onChange={(e) => {
                                  const valStr = e.target.value;
                                  if (valStr === '') {
                                    field.onChange(undefined);
                                  } else {
                                    const num = parseInt(valStr, 10);
                                    field.onChange(isNaN(num) ? undefined : num);
                                  }
                                }}
                                value={field.value === undefined || field.value === null ? '' : String(field.value)}
                              />
                            </span>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="pyqDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1"><CalendarIconLucide className="h-4 w-4"/>PYQ Date (Optional)</FormLabel>
                          <FormControl>
                            <span>
                              <Input
                                type="date"
                                {...field}
                                value={field.value ?? ''}
                              />
                            </span>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField control={form.control} name="pyqShift" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><CalendarIconLucide className="h-4 w-4"/>PYQ Shift (Optional)</FormLabel> <Select onValueChange={field.onChange} value={field.value}> <FormControl><span><SelectTrigger><SelectValue placeholder="Select Shift" /></SelectTrigger></span></FormControl> <SelectContent>{pyqShiftOptions.map(shift => <SelectItem key={shift} value={shift}>{shift}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )}/>
                </CardContent>
            ) : (
                 <CardContent className="pt-4 border-t mt-4">
                    <FormField control={form.control} name="ExamDpp" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><BookMarked className="h-4 w-4"/>DPP Exam Association *</FormLabel> <Select onValueChange={field.onChange} value={field.value}> <FormControl><span><SelectTrigger><SelectValue placeholder="Select Exam for this DPP" /></SelectTrigger></span></FormControl> <SelectContent>{examDppOptions.map(exam => <SelectItem key={exam} value={exam}>{exam}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )}/>
                 </CardContent>
            )}
          </Card>

          <Card className="shadow-lg border-t-4 border-primary rounded-t-none">
            <CardHeader>
                <FormLabel className="text-lg font-semibold">Select Question Structure Type *</FormLabel>
            </CardHeader>
            <CardContent>
                <FormField
                    control={form.control}
                    name="questionStructureType" 
                    render={({ field }) => (
                        <FormItem className="space-y-3">
                        <FormControl>
                            <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex flex-col sm:flex-row gap-4"
                            >
                            {questionStructureTypeOptions.map(qType => (
                                <FormItem key={qType.value} className="flex-1">
                                <FormControl>
                                    <RadioGroupItem value={qType.value} id={qType.value} className="sr-only peer" />
                                </FormControl>
                                <FormLabel
                                    htmlFor={qType.value}
                                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-colors"
                                >
                                    {qType.icon}
                                    {qType.label}
                                </FormLabel>
                                </FormItem>
                            ))}
                            </RadioGroup>
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </CardContent>
          </Card>
          
          <Card className="shadow-lg border-t-4 border-primary rounded-t-none">
            <CardHeader><CardTitle className="text-lg font-semibold flex items-center gap-2"><FileTextIcon className="text-primary"/>Question Content</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {(watchedQuestionStructureType === 'text_only' || watchedQuestionStructureType === 'text_with_diagram') && (
                <FormField control={form.control} name="questionText" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><FileTextIcon className="h-4 w-4 text-muted-foreground"/>Question Text {(watchedQuestionStructureType === 'text_only' || watchedQuestionStructureType === 'text_with_diagram') && '*'}</FormLabel> <FormControl><span><Textarea placeholder="Type the question here. Use $..$ or $$..$$ for MathJax." {...field} rows={5} value={field.value ?? ''}/></span></FormControl> <FormMessage /></FormItem> )}/>
              )}
              {(watchedQuestionStructureType === 'image_only' || watchedQuestionStructureType === 'text_with_diagram') && (
                renderFileInput('questionImage', `Question ${watchedQuestionStructureType === 'text_with_diagram' ? 'Diagram/Image' : 'Image'} ${(watchedQuestionStructureType === 'image_only' || watchedQuestionStructureType === 'text_with_diagram') && '*'}`)
              )}
              
              {watchedQuestionStructureType === 'text_with_diagram' && (
                 <Card className="p-4 bg-muted/30 border-dashed">
                    <FormField control={form.control} name="optionsFormatForDiagramQuestion" render={({ field }) => ( <FormItem> <FormLabel>Options Format (for Diagram Question) *</FormLabel> <Select onValueChange={field.onChange} value={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Select option format" /></SelectTrigger></FormControl> <SelectContent>{[{value: "text_options" as const, label: "Text Options"}, {value: "image_options" as const, label: "Image Options"}].map(of => <SelectItem key={of.value} value={of.value}>{of.label}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )}/>
                 </Card>
              )}
              
              { (watchedQuestionStructureType === 'text_only' || (watchedQuestionStructureType === 'text_with_diagram' && watchedOptionsFormatForDiagram === 'text_options')) && (
                <Card className="p-4 border-dashed bg-card">
                  <CardTitle className="text-md mb-3 text-foreground/80">Text Options</CardTitle>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    <FormField control={form.control} name="optionAText" render={({ field }) => ( <FormItem> <FormLabel>Option A *</FormLabel> <FormControl><span><Input placeholder="Text for Option A" {...field} value={field.value ?? ''}/></span></FormControl> <FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="optionBText" render={({ field }) => ( <FormItem> <FormLabel>Option B *</FormLabel> <FormControl><span><Input placeholder="Text for Option B" {...field} value={field.value ?? ''}/></span></FormControl> <FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="optionCText" render={({ field }) => ( <FormItem> <FormLabel>Option C *</FormLabel> <FormControl><span><Input placeholder="Text for Option C" {...field} value={field.value ?? ''}/></span></FormControl> <FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="optionDText" render={({ field }) => ( <FormItem> <FormLabel>Option D *</FormLabel> <FormControl><span><Input placeholder="Text for Option D" {...field} value={field.value ?? ''}/></span></FormControl> <FormMessage /></FormItem> )} />
                  </div>
                </Card>
              )}

              { watchedQuestionStructureType === 'image_only' && (
                  <Card className="p-4 border-dashed bg-card">
                      <CardTitle className="text-md mb-3 text-foreground/80">Option Labels (A,B,C,D implied in image)</CardTitle>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                           <FormField control={form.control} name="optionAText" render={({ field }) => ( <FormItem> <FormLabel>Label for Option A *</FormLabel> <FormControl><span><Input placeholder="e.g., Option A" {...field} value={field.value ?? 'Option A'}/></span></FormControl> <FormMessage /></FormItem> )} />
                           <FormField control={form.control} name="optionBText" render={({ field }) => ( <FormItem> <FormLabel>Label for Option B *</FormLabel> <FormControl><span><Input placeholder="e.g., Option B" {...field} value={field.value ?? 'Option B'}/></span></FormControl> <FormMessage /></FormItem> )} />
                           <FormField control={form.control} name="optionCText" render={({ field }) => ( <FormItem> <FormLabel>Label for Option C *</FormLabel> <FormControl><span><Input placeholder="e.g., Option C" {...field} value={field.value ?? 'Option C'}/></span></FormControl> <FormMessage /></FormItem> )} />
                           <FormField control={form.control} name="optionDText" render={({ field }) => ( <FormItem> <FormLabel>Label for Option D *</FormLabel> <FormControl><span><Input placeholder="e.g., Option D" {...field} value={field.value ?? 'Option D'}/></span></FormControl> <FormMessage /></FormItem> )} />
                      </div>
                  </Card>
              )}

              { watchedQuestionStructureType === 'text_with_diagram' && watchedOptionsFormatForDiagram === 'image_options' && (
                 <Card className="p-4 border-dashed bg-card">
                    <CardTitle className="text-md mb-3 text-foreground/80">Image Options</CardTitle>
                    <div className="grid md:grid-cols-2 gap-6">
                        {renderFileInput('optionAImage', 'Option A Image *')}
                        {renderFileInput('optionBImage', 'Option B Image *')}
                        {renderFileInput('optionCImage', 'Option C Image *')}
                        {renderFileInput('optionDImage', 'Option D Image *')}
                    </div>
                 </Card>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-lg border-t-4 border-primary rounded-t-none">
            <CardHeader><CardTitle className="text-lg font-semibold flex items-center gap-2"><CheckSquare className="text-primary"/>Answer & Explanation</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="correctOption" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><CheckSquare className="h-4 w-4 text-muted-foreground"/>Correct Answer *</FormLabel> <Select onValueChange={field.onChange} value={field.value}> <FormControl><span><SelectTrigger><SelectValue placeholder="Select Correct Option" /></SelectTrigger></span></FormControl> <SelectContent>{correctOptions.map(co => <SelectItem key={co} value={co}>Option {co}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )}/>
              <FormField control={form.control} name="explanationText" render={({ field }) => ( <FormItem> <FormLabel>Explanation Text (Optional)</FormLabel> <FormControl><span><Textarea placeholder="Provide a detailed explanation. Use $..$ or $$..$$ for MathJax." {...field} rows={4} value={field.value ?? ''}/></span></FormControl> <FormMessage /> </FormItem> )}/>
              {renderFileInput('explanationImage', 'Explanation Image (Optional)')}
            </CardContent>
          </Card>
              
          <CardFooter className="flex flex-col sm:flex-row justify-between items-center pt-6 gap-3 bg-background rounded-b-lg shadow-md">
            <Button type="button" variant="outline" onClick={handleClearForm} disabled={isSubmitting || isLoadingData} className="w-full sm:w-auto flex items-center gap-2">
              <Trash2 className="h-4 w-4" /> Clear Form
            </Button>
            <Button type="submit" size="lg" disabled={isSubmitting || isLoadingData} className="w-full sm:w-auto min-w-[200px] flex items-center gap-2">
              {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
              {isSubmitting ? 'Adding...' : (isLoadingData ? 'Loading Data...' : 'Add Question to Bank')}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </div>
  );
}
    

    

    