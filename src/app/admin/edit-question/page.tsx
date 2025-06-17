
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
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
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { FileEdit, Search, Filter, BookMarked, CalendarDays, Loader2, Upload, CheckSquare, FileText as FileTextIcon, ImageIcon as LucideImageIcon, Info, Trash2 } from 'lucide-react';
import pb from '@/lib/pocketbase';
import { useEffect, useState, useCallback } from 'react';
import { Combobox } from '@/components/ui/combobox';
import { Skeleton } from '@/components/ui/skeleton';
import type { RecordModel } from 'pocketbase';
import { QuestionBankSchema, type QuestionBankInput, ExamDppEnum, PyqExamNameEnum, PyqShiftEnum } from '@/lib/schemas';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import Image from 'next/image';

const subjects = ['Physics', 'Chemistry', 'Mathematics', 'Biology'] as const;
const difficulties = ['Easy', 'Medium', 'Hard'] as const;
const pyqExamNameOptions = PyqExamNameEnum.options;
const pyqShiftOptions = PyqShiftEnum.options;
const questionStructureTypes = [
  { value: "text_only", label: "Text Question & Text Options" },
  { value: "image_only", label: "Image-based Question (options A,B,C,D are implied in image)" },
  { value: "text_with_diagram", label: "Text Question with Diagram & Separately Defined Options" },
] as const;
const optionsFormats = [
  { value: "text_options", label: "Text Options" },
  { value: "image_options", label: "Image Options" },
] as const;
const correctOptions = ['A', 'B', 'C', 'D'] as const;


const FilterSchema = z.object({
  subject: z.enum(subjects).optional(),
  lessonName: z.string().optional(),
  lessonTopic: z.string().optional(),
  isPyq: z.boolean().optional(),
  pyqExamName: PyqExamNameEnum.optional(),
  pyqYear: z.coerce.number().int().positive().optional(),
});

type FilterFormValues = z.infer<typeof FilterSchema>;

function buildPocketBaseFilter(filters: FilterFormValues): string {
  const filterParts: string[] = [];
  if (filters.subject) filterParts.push(`subject = "${filters.subject}"`);
  if (filters.lessonName) filterParts.push(`lessonName = "${filters.lessonName.replace(/"/g, '""')}"`);
  if (filters.lessonTopic) filterParts.push(`lessonTopic = "${filters.lessonTopic.replace(/"/g, '""')}"`);
  
  if (filters.isPyq === true) {
    filterParts.push(`pyq = true`); 
    if (filters.pyqExamName) {
        filterParts.push(`pyqExamName = "${filters.pyqExamName.replace(/"/g, '""')}"`);
    }
    if (filters.pyqYear) {
        filterParts.push(`pyqYear = ${filters.pyqYear}`);
    }
  } else if (filters.isPyq === false) {
    filterParts.push(`pyq = false`); 
  }
  return filterParts.join(' && ');
}


const mapPbToFormStructure = (pbQuestion: RecordModel | null): QuestionBankInput['questionStructureType'] => {
    if (!pbQuestion) return 'text_only'; // Default if no record
    if (pbQuestion.questionType === 'text' && pbQuestion.optionsFormat === 'text_options') {
        return 'text_only';
    }
    if (pbQuestion.questionType === 'image' && pbQuestion.optionsFormat === 'text_options') { // Assuming "image" question type with text options means image_only structure
        return 'image_only';
    }
    if (pbQuestion.questionType === 'text_image') { // Assuming this is text + diagram with separate options
        return 'text_with_diagram';
    }
    return 'text_only'; // Fallback default
};

const initialEditFormValues: QuestionBankInput = {
  subject: 'Physics', // Valid default
  lessonName: '',
  lessonTopic: '',
  difficulty: 'Medium',
  marks: 1,
  tags: '',
  pyq: false,
  ExamDpp: undefined, // Optional based on pyq status
  pyqExamName: undefined, // Optional based on pyq status
  pyqYear: undefined,
  pyqDate: '',
  pyqShift: undefined,
  questionStructureType: 'text_only', // Valid default
  questionText: '',
  questionImage: null,
  optionsFormatForDiagramQuestion: undefined, // Optional
  optionAText: '',
  optionBText: '',
  optionCText: '',
  optionDText: '',
  optionAImage: null, 
  optionBImage: null,
  optionCImage: null,
  optionDImage: null,
  correctOption: 'A', // Valid default
  explanationText: '',
  explanationImage: null,
};


export default function EditQuestionPage() {
  const { toast } = useToast();
  const [isLoadingData, setIsLoadingData] = useState(true); 
  const [isSearching, setIsSearching] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [lessonNameOptions, setLessonNameOptions] = useState<{ value: string; label: string }[]>([]);
  const [lessonTopicOptions, setLessonTopicOptions] = useState<{ value: string; label: string }[]>([]);
  
  const [filteredQuestions, setFilteredQuestions] = useState<RecordModel[]>([]); 
  const [selectedQuestionForEdit, setSelectedQuestionForEdit] = useState<RecordModel | null>(null); 

  const filterForm = useForm<FilterFormValues>({
    resolver: zodResolver(FilterSchema),
    defaultValues: { isPyq: undefined },
  });
  const watchedIsPyqFilter = filterForm.watch('isPyq');

  const editForm = useForm<QuestionBankInput>({
    resolver: zodResolver(QuestionBankSchema),
    defaultValues: initialEditFormValues, // Use the defined initial values
  });
  const watchedQuestionStructureTypeEdit = editForm.watch('questionStructureType');
  const watchedOptionsFormatEdit = editForm.watch('optionsFormatForDiagramQuestion');
  const watchedIsPyqEditForm = editForm.watch('pyq');


  useEffect(() => {
    let isMounted = true;
    async function fetchDistinctData() {
      if (!isMounted) return;
      setIsLoadingData(true);
      try {
        const records = await pb.collection('question_bank').getFullList({ fields: 'lessonName,lessonTopic' });
        if (isMounted) {
          const distinctLessonNames = Array.from(new Set(records.map(r => r.lessonName).filter(Boolean))).map(name => ({ value: name, label: name }));
          const distinctLessonTopics = Array.from(new Set(records.map(r => r.lessonTopic).filter(Boolean))).map(topic => ({ value: topic, label: topic }));
          setLessonNameOptions(distinctLessonNames);
          setLessonTopicOptions(distinctLessonTopics);
        }
      } catch (error: any) {
        if (error.name !== 'AbortError' && !error.isAbort && isMounted) {
          console.error("Failed to fetch existing lessons/topics for filters:", error);
          toast({ title: "Error fetching filter data", description: "Could not load existing lesson names and topics.", variant: "destructive" });
        }
      } finally {
        if (isMounted) setIsLoadingData(false);
      }
    }
    fetchDistinctData();
    return () => { isMounted = false; };
  }, [toast]);

  const stableMapPbToFormStructure = useCallback(mapPbToFormStructure, []);

  useEffect(() => {
    if (selectedQuestionForEdit) {
      const pbQuestion = selectedQuestionForEdit;
      const formStructureType = stableMapPbToFormStructure(pbQuestion);
      
      let formOptionsFormatForDiagramQuestion: QuestionBankInput['optionsFormatForDiagramQuestion'] = undefined;
        if (formStructureType === 'text_with_diagram') {
            if (pbQuestion.optionsFormat === 'text_options') {
                formOptionsFormatForDiagramQuestion = 'text_options';
            } else if (pbQuestion.optionsFormat === 'image_options') {
                formOptionsFormatForDiagramQuestion = 'image_options';
            }
        }

      editForm.reset({
        subject: pbQuestion.subject as QuestionBankInput['subject'] || initialEditFormValues.subject, // Ensure a valid default
        lessonName: pbQuestion.lessonName || '',
        lessonTopic: pbQuestion.lessonTopic || '',
        difficulty: pbQuestion.difficulty as QuestionBankInput['difficulty'] || initialEditFormValues.difficulty,
        pyq: !!pbQuestion.pyq,
        ExamDpp: pbQuestion.ExamDpp as QuestionBankInput['ExamDpp'] || undefined,
        pyqExamName: pbQuestion.pyqExamName as QuestionBankInput['pyqExamName'] || undefined,
        pyqYear: pbQuestion.pyqYear || undefined,
        pyqDate: pbQuestion.pyqDate ? new Date(pbQuestion.pyqDate).toISOString().split('T')[0] : '',
        pyqShift: pbQuestion.pyqShift as QuestionBankInput['pyqShift'] || undefined,
        
        questionStructureType: formStructureType, // This is now guaranteed to be valid
        questionText: pbQuestion.questionText || '',
        questionImage: null, // File uploads are handled separately, don't reset with existing file path

        optionsFormatForDiagramQuestion: formOptionsFormatForDiagramQuestion,
        
        optionAText: pbQuestion.optionAText || '',
        optionBText: pbQuestion.optionBText || '',
        optionCText: pbQuestion.optionCText || '',
        optionDText: pbQuestion.optionDText || '',
        optionAImage: null, 
        optionBImage: null,
        optionCImage: null,
        optionDImage: null,

        correctOption: pbQuestion.correctOption as QuestionBankInput['correctOption'] || initialEditFormValues.correctOption, // Ensure valid default
        explanationText: pbQuestion.explanationText || '',
        explanationImage: null,
        marks: typeof pbQuestion.marks === 'number' ? pbQuestion.marks : initialEditFormValues.marks,
        tags: pbQuestion.tags || '',
      });
    } else {
        editForm.reset(initialEditFormValues);
    }
  }, [selectedQuestionForEdit, editForm, stableMapPbToFormStructure]);

  useEffect(() => {
    if (watchedQuestionStructureTypeEdit === 'image_only') {
      if (!editForm.getValues('optionAText')) editForm.setValue('optionAText', 'Option A');
      if (!editForm.getValues('optionBText')) editForm.setValue('optionBText', 'Option B');
      if (!editForm.getValues('optionCText')) editForm.setValue('optionCText', 'Option C');
      if (!editForm.getValues('optionDText')) editForm.setValue('optionDText', 'Option D');
      
      editForm.setValue('optionAImage', null); editForm.setValue('optionBImage', null); editForm.setValue('optionCImage', null); editForm.setValue('optionDImage', null);
      editForm.setValue('optionsFormatForDiagramQuestion', undefined);
      editForm.setValue('questionText', ''); 
    } else if (watchedQuestionStructureTypeEdit === 'text_only') {
      editForm.setValue('optionAImage', null); editForm.setValue('optionBImage', null); editForm.setValue('optionCImage', null); editForm.setValue('optionDImage', null);
      editForm.setValue('optionsFormatForDiagramQuestion', undefined);
      editForm.setValue('questionImage', null); 
    } else if (watchedQuestionStructureTypeEdit === 'text_with_diagram') {
        // Schema makes optionsFormatForDiagramQuestion required if type is text_with_diagram.
        // If it's not set after reset, Zod will catch it on submit.
    }
  }, [watchedQuestionStructureTypeEdit, editForm]);

  useEffect(() => {
    if (!watchedIsPyqEditForm) {
      editForm.setValue('pyqExamName', undefined); 
      editForm.setValue('pyqYear', undefined);
      editForm.setValue('pyqDate', ''); 
      editForm.setValue('pyqShift', undefined);
    } else {
      editForm.setValue('ExamDpp', undefined);
    }
  }, [watchedIsPyqEditForm, editForm]);


  const handleSearchQuestions = async (filters: FilterFormValues) => {
    setIsSearching(true); setFilteredQuestions([]); setSelectedQuestionForEdit(null);
    const filterString = buildPocketBaseFilter(filters);
    const queryOptions: { filter?: string; sort?: string } = { sort: '-created' }; // Sort by creation date
    if (filterString.trim() !== '') queryOptions.filter = filterString;
    
    console.log("Searching with filter string:", filterString);

    try {
      const questions = await pb.collection('question_bank').getFullList(queryOptions);
      setFilteredQuestions(questions);
      toast({ title: questions.length > 0 ? 'Questions Loaded' : 'No Questions Found', description: questions.length > 0 ? `Found ${questions.length} question(s).` : 'Your filter criteria did not match any questions.' });
    } catch (error: any) {
      console.error("Error searching questions:", error);
      toast({ title: "Error Searching Questions", description: error.data?.message || error.message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const handleUpdateQuestion = async (data: QuestionBankInput) => {
    if (!selectedQuestionForEdit) return;
    setIsUpdating(true);
    const formData = new FormData();
    
    const appendSmart = (key: string, value: any, isFile = false) => {
        if (isFile) {
            if (value instanceof File) { 
                formData.append(key, value);
            } else if (value === null || value === '') { 
                // For files, PocketBase usually expects an empty string to clear the field
                // or not sending the field at all if it's optional and not being changed.
                // To clear an existing file, you send an empty string.
                formData.append(key, ''); 
            }
            // If 'value' is undefined or already a string (URL from DB), do nothing for File fields during update.
            // This presumes if 'value' is a string, it's the existing URL and shouldn't be sent as a File.
        } else { // For non-file fields
            if (value !== undefined && value !== null && value !== '') { 
                formData.append(key, String(value));
            } else if (value === null || value === '') { // If explicitly null or empty string (for text fields)
                formData.append(key, ''); // Send empty string to clear or set as empty
            }
            // If 'value' is undefined for a non-file field, it's usually omitted to let PB keep existing or use default.
        }
    };
    
    appendSmart('subject', data.subject);
    appendSmart('lessonName', data.lessonName);
    appendSmart('lessonTopic', data.lessonTopic);
    appendSmart('difficulty', data.difficulty);
    appendSmart('correctOption', data.correctOption);
    appendSmart('explanationText', data.explanationText);
    appendSmart('explanationImage', data.explanationImage, true);

    formData.append('pyq', data.pyq ? 'true' : 'false');
    if (data.pyq) {
        appendSmart('pyqExamName', data.pyqExamName);
        if (data.pyqYear !== undefined && data.pyqYear !== null) appendSmart('pyqYear', data.pyqYear.toString()); else appendSmart('pyqYear', '');
        appendSmart('pyqDate', data.pyqDate);
        appendSmart('pyqShift', data.pyqShift);
        appendSmart('ExamDpp', ''); // Ensure ExamDpp is cleared if pyq is true
    } else { 
        appendSmart('ExamDpp', data.ExamDpp);
        appendSmart('pyqExamName', ''); 
        appendSmart('pyqYear', '');
        appendSmart('pyqDate', ''); 
        appendSmart('pyqShift', '');
    }

    if (data.questionStructureType === 'text_only') {
      appendSmart('questionType', 'text'); appendSmart('optionsFormat', 'text_options');
      appendSmart('questionText', data.questionText);
      appendSmart('questionImage', data.questionImage, true); // Send file or empty string to clear
      appendSmart('optionAText', data.optionAText); appendSmart('optionBText', data.optionBText);
      appendSmart('optionCText', data.optionCText); appendSmart('optionDText', data.optionDText);
      appendSmart('optionAImage', data.optionAImage, true); appendSmart('optionBImage', data.optionBImage, true); 
      appendSmart('optionCImage', data.optionCImage, true); appendSmart('optionDImage', data.optionDImage, true);
    } else if (data.questionStructureType === 'image_only') {
      appendSmart('questionType', 'image'); appendSmart('optionsFormat', 'text_options');
      appendSmart('questionImage', data.questionImage, true);
      appendSmart('questionText', ''); // Clear question text
      appendSmart('optionAText', data.optionAText); appendSmart('optionBText', data.optionBText);
      appendSmart('optionCText', data.optionCText); appendSmart('optionDText', data.optionDText);
      appendSmart('optionAImage', data.optionAImage, true); appendSmart('optionBImage', data.optionBImage, true);
      appendSmart('optionCImage', data.optionCImage, true); appendSmart('optionDImage', data.optionDImage, true);
    } else if (data.questionStructureType === 'text_with_diagram') {
      appendSmart('questionType', 'text_image');
      appendSmart('questionText', data.questionText);
      appendSmart('questionImage', data.questionImage, true);
      if (data.optionsFormatForDiagramQuestion) {
        appendSmart('optionsFormat', data.optionsFormatForDiagramQuestion);
        if (data.optionsFormatForDiagramQuestion === 'text_options') {
          appendSmart('optionAText', data.optionAText); appendSmart('optionBText', data.optionBText);
          appendSmart('optionCText', data.optionCText); appendSmart('optionDText', data.optionDText);
          appendSmart('optionAImage', data.optionAImage, true); appendSmart('optionBImage', data.optionBImage, true);
          appendSmart('optionCImage', data.optionCImage, true); appendSmart('optionDImage', data.optionDImage, true);
        } else if (data.optionsFormatForDiagramQuestion === 'image_options') {
          appendSmart('optionAImage', data.optionAImage, true); appendSmart('optionBImage', data.optionBImage, true);
          appendSmart('optionCImage', data.optionCImage, true); appendSmart('optionDImage', data.optionDImage, true);
          appendSmart('optionAText', ''); appendSmart('optionBText', '');
          appendSmart('optionCText', ''); appendSmart('optionDText', '');
        }
      } else { 
         appendSmart('optionsFormat', ''); 
      }
    }
    
    try {
      await pb.collection('question_bank').update(selectedQuestionForEdit.id, formData);
      toast({ title: 'Question Updated!', description: 'The question has been successfully updated.' });
      const currentFilters = filterForm.getValues();
      setSelectedQuestionForEdit(null); 
      handleSearchQuestions(currentFilters); // Refresh the list
    } catch (error: any) {
      console.error('PocketBase Error - Failed to update question:', error.data || error.originalError || error);
      let detailedErrorMessage = 'An unexpected error occurred.';
      if (error.data && error.data.data) {
        detailedErrorMessage = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
      } else if (error.message) { detailedErrorMessage = error.message; }
      toast({ title: 'Error Updating Question', description: detailedErrorMessage, variant: 'destructive', duration: 7000 });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteQuestion = async () => {
    if (!selectedQuestionForEdit) return;
    setIsDeleting(true);
    try {
      await pb.collection('question_bank').delete(selectedQuestionForEdit.id);
      toast({ title: 'Question Deleted', description: 'The question has been removed from the bank.' });
      const deletedId = selectedQuestionForEdit.id;
      setSelectedQuestionForEdit(null);
      setFilteredQuestions(prev => prev.filter(q => q.id !== deletedId)); // Update UI
    } catch (error: any) {
      toast({ title: 'Error Deleting Question', description: error.message || 'Could not delete the question.', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const renderFileInput = (name: keyof QuestionBankInput, label: string, existingImageUrl?: string) => (
    <FormField
      control={editForm.control}
      name={name}
      render={({ field: { onChange, value, ...restField } }) => ( // value here is the File object or null from RHF
        <FormItem>
          <FormLabel className="flex items-center gap-1">
            <LucideImageIcon className="h-4 w-4 text-muted-foreground" /> {label}
          </FormLabel>
          {existingImageUrl && !(value instanceof File) && ( 
            <div className="my-2">
              <p className="text-xs text-muted-foreground mb-1">Current image:</p>
              <Image src={existingImageUrl} alt={`Current ${label}`} width={100} height={100} className="rounded border object-contain" data-ai-hint="diagram illustration"/>
            </div>
          )}
           {value instanceof File && ( 
            <p className="text-xs text-green-600 my-1">New image selected: {value.name}</p>
           )}
          <FormControl>
            <Input
              type="file"
              accept="image/png, image/jpeg, image/webp"
              onChange={(e) => onChange(e.target.files ? e.target.files[0] : null)}
              {...restField} // Spread other RHF props like ref, name, onBlur, but not value
              className="block w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  const getImageUrl = (record: RecordModel | null | undefined, fieldName: string) => {
    if (record && record[fieldName] && record.collectionId && record.collectionName) {
      try {
        return pb.files.getUrl(record, record[fieldName] as string);
      } catch (e) {
        console.warn(`Error getting URL for ${fieldName} in record ${record.id}:`, e);
        return undefined;
      }
    }
    return undefined;
  };

  const renderEditFormForSelectedQuestion = () => {
    if (!selectedQuestionForEdit) return null;
    const examDppOptions = ExamDppEnum.options;

    return (
      <Card className="mt-6 shadow-lg">
        <CardHeader>
          <CardTitle>Editing Question ID: {selectedQuestionForEdit.id.substring(0,8)}...</CardTitle>
          <CardDescription>Modify the question details below.</CardDescription>
        </CardHeader>
        <Form {...editForm}>
          <form onSubmit={editForm.handleSubmit(handleUpdateQuestion)}>
            <CardContent className="space-y-6">
               <Card className="border-primary/20 shadow-sm">
                <CardHeader><CardTitle className="text-xl flex items-center gap-2"><Info className="text-primary"/>Basic Information</CardTitle></CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-6">
                  <FormField control={editForm.control} name="subject" render={({ field }) => ( <FormItem> <FormLabel>Subject</FormLabel> <Select onValueChange={field.onChange} value={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger></FormControl> <SelectContent>{subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )}/>
                  <FormField control={editForm.control} name="difficulty" render={({ field }) => ( <FormItem> <FormLabel>Difficulty</FormLabel> <Select onValueChange={field.onChange} value={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Select difficulty" /></SelectTrigger></FormControl> <SelectContent>{difficulties.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )}/>
                  {isLoadingData ? <Skeleton className="h-10 w-full" /> : (<FormField control={editForm.control} name="lessonName" render={({ field }) => ( <FormItem className="md:col-span-1"> <FormLabel>Lesson Name</FormLabel> <FormControl><Combobox options={lessonNameOptions} value={field.value || ''} onChange={field.onChange} placeholder="Select or type lesson name" inputPlaceholder="Search/Create lesson..." /></FormControl> <FormMessage /> </FormItem> )}/> )}
                  {isLoadingData ? <Skeleton className="h-10 w-full" /> : (<FormField control={editForm.control} name="lessonTopic" render={({ field }) => ( <FormItem className="md:col-span-1"> <FormLabel>Lesson Topic (Optional)</FormLabel> <FormControl><Combobox options={lessonTopicOptions} value={field.value || ''} onChange={field.onChange} placeholder="Select or type lesson topic" inputPlaceholder="Search/Create topic..." /></FormControl> <FormMessage /> </FormItem> )}/> )}
                  
                  {!watchedIsPyqEditForm && (
                    <FormField control={editForm.control} name="ExamDpp" render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>DPP Exam Association (for non-PYQs)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select exam for this DPP" /></SelectTrigger></FormControl>
                          <SelectContent>{examDppOptions.map(exam => <SelectItem key={exam} value={exam}>{exam}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                </CardContent>
              </Card>

              <Card className="border-primary/20 shadow-sm">
                <CardHeader><FormField control={editForm.control} name="pyq" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0"> <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange}/></FormControl> <FormLabel className="text-xl font-medium cursor-pointer flex items-center gap-2"><BookMarked className="text-primary"/>Is this a Previous Year Question (PYQ)?</FormLabel> </FormItem> )}/></CardHeader>
                {watchedIsPyqEditForm && (
                  <CardContent className="grid md:grid-cols-2 gap-6 pt-4 border-t mt-4">
                    <FormField control={editForm.control} name="pyqExamName" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><BookMarked className="h-4 w-4"/>PYQ Exam Name</FormLabel> <Select onValueChange={field.onChange} value={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Select PYQ exam" /></SelectTrigger></FormControl> <SelectContent>{pyqExamNameOptions.map(exam => <SelectItem key={exam} value={exam}>{exam}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )}/>
                    <FormField control={editForm.control} name="pyqYear" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><CalendarDays className="h-4 w-4"/>PYQ Year</FormLabel> <FormControl><Input type="number" placeholder="e.g., 2023" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value,10))} value={field.value ?? ''} /></FormControl> <FormMessage /> </FormItem> )}/>
                    <FormField control={editForm.control} name="pyqDate" render={({ field }) => ( <FormItem> <FormLabel>PYQ Date (Optional)</FormLabel> <FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl> <FormMessage /> </FormItem> )}/>
                    <FormField control={editForm.control} name="pyqShift" render={({ field }) => ( <FormItem> <FormLabel>PYQ Shift (Optional)</FormLabel> <Select onValueChange={field.onChange} value={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Select shift" /></SelectTrigger></FormControl> <SelectContent>{pyqShiftOptions.map(shift => <SelectItem key={shift} value={shift}>{shift}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )}/>
                  </CardContent>
                )}
              </Card>

              <Card className="border-primary/20 shadow-sm">
                <CardHeader><CardTitle className="text-xl flex items-center gap-2"><FileTextIcon className="text-primary"/>Question & Options</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <FormField control={editForm.control} name="questionStructureType" render={({ field }) => ( <FormItem> <FormLabel>Question Structure Type</FormLabel> <Select onValueChange={field.onChange} value={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Select question structure" /></SelectTrigger></FormControl> <SelectContent>{questionStructureTypes.map(qs => <SelectItem key={qs.value} value={qs.value}>{qs.label}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )}/>
                  {(watchedQuestionStructureTypeEdit === 'text_only' || watchedQuestionStructureTypeEdit === 'text_with_diagram') && ( <FormField control={editForm.control} name="questionText" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><FileTextIcon className="h-4 w-4 text-muted-foreground"/>Question Text</FormLabel> <FormControl><Textarea placeholder="Enter question text" {...field} value={field.value ?? ''} rows={5} /></FormControl> <FormMessage /> </FormItem> )}/> )}
                  {(watchedQuestionStructureTypeEdit === 'image_only' || watchedQuestionStructureTypeEdit === 'text_with_diagram') && ( renderFileInput('questionImage', watchedQuestionStructureTypeEdit === 'image_only' ? 'Question Image (with embedded options)' : 'Question Diagram/Image (Replace existing)', getImageUrl(selectedQuestionForEdit, 'questionImage')) )}
                  {watchedQuestionStructureTypeEdit === 'text_with_diagram' && ( <Card className="p-4 bg-muted/30 border-dashed"> <FormField control={editForm.control} name="optionsFormatForDiagramQuestion" render={({ field }) => ( <FormItem> <FormLabel>Options Format (for Diagram Question)</FormLabel> <Select onValueChange={field.onChange} value={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Select option format" /></SelectTrigger></FormControl> <SelectContent>{optionsFormats.map(of => <SelectItem key={of.value} value={of.value}>{of.label}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )}/> </Card> )}
                  {(watchedQuestionStructureTypeEdit === 'text_only' || (watchedQuestionStructureTypeEdit === 'text_with_diagram' && watchedOptionsFormatEdit === 'text_options') || watchedQuestionStructureTypeEdit === 'image_only' ) && (
                    <Card className="p-4 border-dashed bg-card"> <CardTitle className="text-lg mb-4 text-foreground/80">Text Options</CardTitle> <div className="grid md:grid-cols-2 gap-x-6 gap-y-4">
                      <FormField control={editForm.control} name="optionAText" render={({ field }) => ( <FormItem> <FormLabel>Option A</FormLabel> <FormControl><Textarea placeholder={watchedQuestionStructureTypeEdit === 'image_only' && !field.value ? 'Option A' : "Text for Option A"} {...field} value={field.value ?? ''} rows={2} /></FormControl> <FormMessage /> </FormItem> )}/>
                      <FormField control={editForm.control} name="optionBText" render={({ field }) => ( <FormItem> <FormLabel>Option B</FormLabel> <FormControl><Textarea placeholder={watchedQuestionStructureTypeEdit === 'image_only' && !field.value ? 'Option B' : "Text for Option B"} {...field} value={field.value ?? ''} rows={2} /></FormControl> <FormMessage /> </FormItem> )}/>
                      <FormField control={editForm.control} name="optionCText" render={({ field }) => ( <FormItem> <FormLabel>Option C</FormLabel> <FormControl><Textarea placeholder={watchedQuestionStructureTypeEdit === 'image_only' && !field.value ? 'Option C' : "Text for Option C"} {...field} value={field.value ?? ''} rows={2} /></FormControl> <FormMessage /> </FormItem> )}/>
                      <FormField control={editForm.control} name="optionDText" render={({ field }) => ( <FormItem> <FormLabel>Option D</FormLabel> <FormControl><Textarea placeholder={watchedQuestionStructureTypeEdit === 'image_only' && !field.value ? 'Option D' : "Text for Option D"} {...field} value={field.value ?? ''} rows={2} /></FormControl> <FormMessage /> </FormItem> )}/>
                    </div> </Card>
                  )}
                  {watchedQuestionStructureTypeEdit === 'text_with_diagram' && watchedOptionsFormatEdit === 'image_options' && (
                     <Card className="p-4 border-dashed bg-card"> <CardTitle className="text-lg mb-4 text-foreground/80">Image Options (Replace existing)</CardTitle> <div className="grid md:grid-cols-2 gap-6">
                        {renderFileInput('optionAImage', 'Option A (Image)', getImageUrl(selectedQuestionForEdit, 'optionAImage'))}
                        {renderFileInput('optionBImage', 'Option B (Image)', getImageUrl(selectedQuestionForEdit, 'optionBImage'))}
                        {renderFileInput('optionCImage', 'Option C (Image)', getImageUrl(selectedQuestionForEdit, 'optionCImage'))}
                        {renderFileInput('optionDImage', 'Option D (Image)', getImageUrl(selectedQuestionForEdit, 'optionDImage'))}
                     </div></Card>
                  )}
                </CardContent>
              </Card>

              <Card className="border-primary/20 shadow-sm">
                <CardHeader><CardTitle className="text-xl flex items-center gap-2"><CheckSquare className="text-primary"/>Answer & Explanation</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <FormField control={editForm.control} name="correctOption" render={({ field }) => ( <FormItem> <FormLabel className="flex items-center gap-1"><CheckSquare className="h-4 w-4 text-muted-foreground"/>Correct Option</FormLabel> <Select onValueChange={field.onChange} value={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Select correct option" /></SelectTrigger></FormControl> <SelectContent>{correctOptions.map(co => <SelectItem key={co} value={co}>Option {co}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )}/>
                  <FormField control={editForm.control} name="explanationText" render={({ field }) => ( <FormItem> <FormLabel>Explanation (Text - Optional)</FormLabel> <FormControl><Textarea placeholder="Enter explanation" {...field} value={field.value ?? ''} rows={4} /></FormControl> <FormMessage /> </FormItem> )}/>
                  {renderFileInput('explanationImage', 'Explanation (Image - Replace existing)', getImageUrl(selectedQuestionForEdit, 'explanationImage'))}
                </CardContent>
              </Card>
            </CardContent>
            <CardFooter className="flex justify-between items-center pt-6 border-t">
              <Button type="button" variant="outline" onClick={() => setSelectedQuestionForEdit(null)} disabled={isUpdating || isDeleting}>Cancel</Button>
              <div className="flex gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive" disabled={isUpdating || isDeleting}>
                      {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                      {isDeleting ? 'Deleting...' : 'Delete Question'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the question.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteQuestion}>Delete</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button type="submit" disabled={isUpdating || isDeleting || !editForm.formState.isDirty}>
                  {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardFooter>
          </form>
        </Form>
      </Card>
    );
  };


  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-foreground flex items-center">
            <FileEdit className="mr-3 h-8 w-8 text-primary" /> Edit Questions
          </CardTitle>
          <CardDescription>Find and modify existing questions in the question bank.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...filterForm}>
            <form onSubmit={filterForm.handleSubmit(handleSearchQuestions)} className="space-y-6">
              <Card className="border-primary/20 shadow-sm">
                <CardHeader><CardTitle className="text-xl flex items-center gap-2"><Filter className="text-primary"/>Filter Criteria</CardTitle></CardHeader>
                <CardContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <FormField control={filterForm.control} name="subject" render={({ field }) => (<FormItem><FormLabel>Subject</FormLabel><Select onValueChange={field.onChange} value={field.value || ''}><FormControl><SelectTrigger><SelectValue placeholder="Any Subject" /></SelectTrigger></FormControl><SelectContent>{subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )}/>
                  {isLoadingData ? <Skeleton className="h-10 w-full mt-6" /> : (<FormField control={filterForm.control} name="lessonName" render={({ field }) => (<FormItem><FormLabel>Lesson Name</FormLabel><FormControl><Combobox options={lessonNameOptions} value={field.value || ''} onChange={field.onChange} placeholder="Any Lesson Name" inputPlaceholder="Search/Type lesson..."/></FormControl><FormMessage /></FormItem> )}/> )}
                  {isLoadingData ? <Skeleton className="h-10 w-full mt-6" /> : (<FormField control={filterForm.control} name="lessonTopic" render={({ field }) => (<FormItem><FormLabel>Lesson Topic</FormLabel><FormControl><Combobox options={lessonTopicOptions} value={field.value || ''} onChange={field.onChange} placeholder="Any Lesson Topic" inputPlaceholder="Search/Type topic..."/></FormControl><FormMessage /></FormItem> )}/> )}
                  <FormField control={filterForm.control} name="isPyq" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-8 md:col-span-1 lg:col-span-3"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange}/></FormControl><FormLabel className="font-medium cursor-pointer flex items-center gap-2"><BookMarked className="text-primary h-5 w-5"/>Filter by PYQ?</FormLabel></FormItem> )}/>
                  {watchedIsPyqFilter === true && ( 
                    <>
                      <FormField control={filterForm.control} name="pyqExamName" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-1"><BookMarked className="h-4 w-4"/>PYQ Exam Name</FormLabel><Select onValueChange={field.onChange} value={field.value || ''}><FormControl><SelectTrigger><SelectValue placeholder="Any PYQ Exam" /></SelectTrigger></FormControl><SelectContent>{pyqExamNameOptions.map(exam => <SelectItem key={exam} value={exam}>{exam}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )}/>
                      <FormField control={filterForm.control} name="pyqYear" render={({ field }) => (<FormItem><FormLabel className="flex items-center gap-1"><CalendarDays className="h-4 w-4"/>PYQ Year</FormLabel><FormControl><Input type="number" placeholder="e.g., 2023" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value,10))} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )}/>
                    </>
                  )}
                </CardContent>
                <CardFooter className="pt-6">
                  <Button type="submit" size="lg" disabled={isSearching || isLoadingData}>
                    {isSearching ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Search className="mr-2 h-5 w-5" />}
                    {isLoadingData ? 'Loading Filters...' : (isSearching ? 'Searching...' : 'Load Questions')}
                  </Button>
                </CardFooter>
              </Card>
            </form>
          </Form>
        </CardContent>
      </Card>

      {!isSearching && filteredQuestions.length > 0 && !selectedQuestionForEdit && (
        <Card className="shadow-lg">
          <CardHeader><CardTitle>Search Results ({filteredQuestions.length})</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {filteredQuestions.map(q => (
                <li key={q.id} className="p-3 border rounded-lg hover:shadow-md transition-shadow flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex-grow">
                    <p className="font-semibold text-foreground">
                      {q.questionText ? (q.questionText.substring(0, 100) + (q.questionText.length > 100 ? '...' : '')) : (q.questionImage ? 'Image-based question' : 'Question (No text/image preview)')}
                    </p>
                    <p className="text-xs text-muted-foreground">ID: {q.id.substring(0,8)}... | Subject: {q.subject} | Lesson: {q.lessonName} {q.pyq ? `| PYQ: ${q.pyqExamName || ''} ${q.pyqYear || ''}` : (q.ExamDpp ? `| DPP Exam: ${q.ExamDpp}`: '')}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSelectedQuestionForEdit(q)} className="mt-2 sm:mt-0 flex-shrink-0">Edit Question</Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {isSearching && (
          <div className="text-center py-10 flex flex-col items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-3"/> 
            <p className="text-lg font-semibold text-muted-foreground">Searching questions...</p>
            <p className="text-sm text-muted-foreground">Please wait while we fetch the data.</p>
          </div>
      )}

      {!isSearching && filterForm.formState.isSubmitted && filteredQuestions.length === 0 && !selectedQuestionForEdit && (
          <Card className="text-center p-10 shadow-md">
            <CardTitle className="text-xl text-muted-foreground">No Questions Found</CardTitle>
            <CardDescription className="mt-2">Your filter criteria did not match any questions in the bank. Try adjusting your filters.</CardDescription>
          </Card>
      )}

      {selectedQuestionForEdit && renderEditFormForSelectedQuestion()}
    </div>
  );
}
