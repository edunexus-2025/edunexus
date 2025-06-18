
'use client';

import { useParams, useRouter }
from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, UploadCloud, Link as LinkIconDb, Database, ListChecks, TextCursorInput, FilePlus, Save, AlertTriangle, TextIcon as RichTextIcon, ImagePlus, Trash2, XCircle, Book, Tag as TagIcon, Type, Image as ImageIconLucide, CheckSquare } from 'lucide-react';
import { Routes } from '@/lib/constants';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label }
from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { TeacherAddQuestionInput } from '@/lib/schemas';
import { TeacherAddQuestionSchema } from '@/lib/schemas';
import { Form, FormField, FormItem, FormLabel, FormMessage, FormControl } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ImageImportModal } from '@/components/teacher/ImageImportModal';
import { QbModal } from '@/components/teacher/QbModal'; // Import QB Modal
import NextImage from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import pb from '@/lib/pocketbase';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { RecordModel } from 'pocketbase';
import { Skeleton } from '@/components/ui/skeleton';


const isValidHttpUrl = (string: string | null | undefined): string is string => {
  if (!string || typeof string !== 'string') return false;
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
};

interface ParentTestData {
  id: string;
  testName: string;
  QBExam: string;
  model: "Chapterwise" | "Full Length"; // Added model field
}


export default function TeacherAddQuestionToTestPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { teacher, isLoadingTeacher } = useAuth();
  const testId = typeof params.testId === 'string' ? params.testId : '';
  
  const [activeQuestionType, setActiveQuestionType] = useState<'multipleChoice' | 'fillInBlank' | 'addSection'>('multipleChoice');
  const [isImageImportModalOpen, setIsImageImportModalOpen] = useState(false);
  const [isQbModalOpen, setIsQbModalOpen] = useState(false); 
  const [imageTargetField, setImageTargetField] = useState<keyof TeacherAddQuestionInput | null>(null);
  
  const [imagePreviews, setImagePreviews] = useState<Partial<Record<keyof TeacherAddQuestionInput, string | null>>>({});

  const [parentTestData, setParentTestData] = useState<ParentTestData | null>(null);
  const [isLoadingParentTest, setIsLoadingParentTest] = useState(true);


  const form = useForm<TeacherAddQuestionInput>({
    resolver: zodResolver(TeacherAddQuestionSchema),
    defaultValues: {
      questionType: 'multipleChoice',
      LessonName: '', 
      QBExam: '',     
      QuestionText: '',
      QuestionImage: null, 
      options: [ 
        { text: '', isCorrect: false }, { text: '', isCorrect: false },
        { text: '', isCorrect: false }, { text: '', isCorrect: false },
      ],
      OptionAImage: null, OptionBImage: null, OptionCImage: null, OptionDImage: null, 
      CorrectOption: undefined, 
      explanationText: '',
      explanationImage: null, 
    },
  });
  
  useEffect(() => {
    let isMounted = true;
    if (testId && !isLoadingTeacher && teacher?.id) {
      setIsLoadingParentTest(true);
      pb.collection('teacher_tests').getOne<RecordModel>(testId, {fields: 'id,testName,QBExam,model'}) // Fetch specific fields
        .then(record => {
          if (isMounted) {
            if (!record.testName || !record.QBExam || !record.model) {
                console.warn("Parent test data is missing required fields (testName, QBExam, or model). Test ID:", testId, "Fetched Record:", record);
                toast({ title: "Error", description: "Parent test is missing a name, exam association, or model type. Form submission may fail. Please check parent test settings.", variant: "destructive", duration: 7000});
                setParentTestData(null); 
                return;
            }
            const data: ParentTestData = {
              id: record.id,
              testName: record.testName,
              QBExam: record.QBExam, 
              model: record.model as ParentTestData['model'],
            };
            setParentTestData(data);
            form.setValue('LessonName', data.testName, { shouldValidate: true });
            form.setValue('QBExam', data.QBExam, { shouldValidate: true });
          }
        })
        .catch(err => {
          if (isMounted) {
            console.error("Failed to fetch parent test details:", err);
            toast({ title: "Error", description: "Could not load parent test details.", variant: "destructive" });
          }
        })
        .finally(() => {
          if (isMounted) setIsLoadingParentTest(false);
        });
    } else if (!testId && isMounted) {
        setIsLoadingParentTest(false);
        toast({title: "Error", description: "Test ID is missing. Cannot add questions.", variant: "destructive"})
    } else if (!isLoadingTeacher && !teacher?.id && isMounted){
        setIsLoadingParentTest(false);
        toast({title: "Authentication Error", description: "Teacher not authenticated.", variant: "destructive"})
    }
    return () => { isMounted = false; };
  }, [testId, form, toast, teacher?.id, isLoadingTeacher, router]);


  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'options',
  });

  const onSubmit = async (data: TeacherAddQuestionInput) => {
    if (!teacher) {
      toast({ title: "Authentication Error", description: "Teacher not logged in.", variant: "destructive" });
      return;
    }
     if (!parentTestData || !parentTestData.testName || !parentTestData.QBExam) {
      toast({ title: "Error", description: "Parent test data (name or exam) is missing. Cannot save question. Ensure parent test has a valid name and QBExam set.", variant: "destructive" });
      return;
    }
    
    const dataForTeacherQuestionData: Record<string, any> = {
      teacher: teacher.id,
      LessonName: data.LessonName,
      QBExam: data.QBExam,
      QuestionText: data.QuestionText?.trim() || null,
      QuestionImage: data.QuestionImage || null, 
      OptionAText: data.options[0]?.text?.trim() || null,
      OptionAImage: data.OptionAImage || null,
      OptionBText: data.options[1]?.text?.trim() || null,
      OptionBImage: data.OptionBImage || null,
      OptionCText: data.options[2]?.text?.trim() || null,
      OptionCImage: data.OptionCImage || null,
      OptionDText: data.options[3]?.text?.trim() || null,
      OptionDImage: data.OptionDImage || null,
      CorrectOption: data.CorrectOption || null,
      explanationText: data.explanationText?.trim() || null,
      explanationImage: data.explanationImage || null,
    };
    
    Object.keys(dataForTeacherQuestionData).forEach(key => {
      if (dataForTeacherQuestionData[key] === undefined) { 
        dataForTeacherQuestionData[key] = null; 
      }
    });

    console.log("Final data payload for teacher_question_data (with image URLs):", dataForTeacherQuestionData);

    try {
      const createdQuestionRecord = await pb.collection('teacher_question_data').create(dataForTeacherQuestionData);
      toast({
        title: 'Question Added!',
        description: `Question (ID: ${createdQuestionRecord.id.substring(0,8)}...) added to ${parentTestData.testName}.`,
      });
      
      form.reset({
        questionType: 'multipleChoice',
        LessonName: parentTestData.testName, 
        QBExam: parentTestData.QBExam,    
        QuestionText: '', QuestionImage: null,
        options: [
          { text: '', isCorrect: false }, { text: '', isCorrect: false },
          { text: '', isCorrect: false }, { text: '', isCorrect: false },
        ],
        OptionAImage: null, OptionBImage: null, OptionCImage: null, OptionDImage: null,
        CorrectOption: undefined,
        explanationText: '',
        explanationImage: null,
      });
      setImagePreviews({});
    } catch (error: any) {
      console.error("Failed to save question to teacher_question_data:", error.data?.data || error.message, "Full error:", error);
      let errorMsg = "Could not save question. Please ensure all required fields are filled and image URLs are valid if provided.";
      if (error.data?.data) {
        errorMsg = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
      } else if (error.message) {
        errorMsg = error.message;
      }
      toast({
        title: 'Error Saving Question',
        description: errorMsg,
        variant: 'destructive',
        duration: 9000,
      });
    }
  };

  const allTopBarButtons = [
    { label: 'Import CSV', icon: <UploadCloud size={16} />, action: () => console.log('Import CSV clicked (Placeholder)') },
    { label: 'Import Image', icon: <ImageIconLucide size={16} />, action: () => setIsImageImportModalOpen(true) },
    { label: 'Link', icon: <LinkIconDb size={16} />, action: () => console.log('Link clicked (Placeholder)') },
    { label: 'QB', icon: <Database size={16} />, action: () => setIsQbModalOpen(true) },
  ];
  
  const visibleTopBarButtons = allTopBarButtons.filter(btn => {
    if (btn.label === 'QB') {
      return parentTestData?.model === 'Full Length';
    }
    return true;
  });

  const allQuestionTypeButtons = [
    { label: 'Multiple Choice', type: 'multipleChoice' as const, icon: <ListChecks size={16} /> },
    { label: 'Fill in the Blank', type: 'fillInBlank' as const, icon: <TextCursorInput size={16} /> },
    { label: 'Add Section', type: 'addSection' as const, icon: <Type size={16} /> },
  ];
  
  const visibleQuestionTypeButtons = allQuestionTypeButtons.filter(btn => {
    if (btn.type === 'addSection') {
      return parentTestData?.model === 'Full Length';
    }
    return true;
  });

  const handleOptionCheckboxChange = (selectedIndex: number) => {
    const currentOptions = form.getValues('options');
    let newCorrectOptionValue: TeacherAddQuestionInput['CorrectOption'] | undefined = undefined;
    
    currentOptions.forEach((opt, index) => {
      const isCurrentlyChecked = form.getValues(`options.${index}.isCorrect`);
      const shouldBeChecked = index === selectedIndex && !isCurrentlyChecked;

      form.setValue(`options.${index}.isCorrect`, shouldBeChecked);
      if (shouldBeChecked) {
        newCorrectOptionValue = `Option ${String.fromCharCode(65 + index)}` as TeacherAddQuestionInput['CorrectOption'];
      }
    });
    
    if (!newCorrectOptionValue) {
       const stillCheckedIndex = form.getValues('options').findIndex(opt => opt?.isCorrect);
       if (stillCheckedIndex === -1) {
           newCorrectOptionValue = undefined;
       } else {
           newCorrectOptionValue = `Option ${String.fromCharCode(65 + stillCheckedIndex)}` as TeacherAddQuestionInput['CorrectOption'];
       }
    }
    form.setValue('CorrectOption', newCorrectOptionValue, { shouldValidate: true });
  };
  

  const openImageModalFor = (target: keyof TeacherAddQuestionInput) => {
    setImageTargetField(target); 
    setIsImageImportModalOpen(true);
  };

  const handleImageAssignFromModal = (imageUrl: string | null) => { 
    if (imageTargetField && imageUrl) {
      form.setValue(imageTargetField, imageUrl); 
      setImagePreviews(prev => ({ ...prev, [imageTargetField as string]: imageUrl }));
    } else if (imageTargetField && imageUrl === null) { 
      form.setValue(imageTargetField, null);
      setImagePreviews(prev => ({ ...prev, [imageTargetField as string]: null }));
    }
    setIsImageImportModalOpen(false);
    setImageTargetField(null);
  };
  
  const removeImagePreview = (fieldKey: keyof TeacherAddQuestionInput) => {
    form.setValue(fieldKey, null); 
    setImagePreviews(prev => ({...prev, [fieldKey as string]: null}));
  };


  return (
    <div className="space-y-6 bg-[#f0f4ff] dark:bg-slate-900 p-4 md:p-6 rounded-lg shadow-md">
      <ImageImportModal
        isOpen={isImageImportModalOpen}
        onOpenChange={setIsImageImportModalOpen}
        onImageAssign={handleImageAssignFromModal}
        currentImageTargetField={imageTargetField as string}
      />
      <QbModal
        isOpen={isQbModalOpen}
        onOpenChange={setIsQbModalOpen}
        // onQuestionSelect will be implemented later
      />
      <div className="flex items-center justify-between mb-6">
        <Button variant="outline" onClick={() => router.push(Routes.teacherTestPanel(testId))} className="border-gray-400 text-gray-700 dark:border-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Test Panel
        </Button>
      </div>

      <Card className="shadow-lg border-none bg-white dark:bg-slate-800">
        <CardHeader className="p-4 md:p-6 border-b border-slate-200 dark:border-slate-700">
          <CardTitle className="text-xl md:text-2xl font-semibold text-slate-800 dark:text-slate-100">
            Add Question to: <span className="text-primary">{isLoadingParentTest ? "Loading test name..." : (parentTestData?.testName || "Test")}</span>
             {parentTestData?.model && <span className="text-xs ml-2 px-2 py-0.5 bg-muted text-muted-foreground rounded-full">{parentTestData.model}</span>}
          </CardTitle>
          <CardDescription className="text-sm text-slate-500 dark:text-slate-400">
            Fill in the details for your new question below.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-wrap gap-2 mb-6 justify-center">
            {visibleTopBarButtons.map((btn) => (
              <Button
                key={btn.label}
                variant="outline"
                size="sm"
                onClick={btn.action}
                className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 border-slate-300 dark:border-slate-600"
              >
                {btn.icon}
                <span className="ml-2">{btn.label}</span>
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 mb-8 justify-center">
            {visibleQuestionTypeButtons.map((btn) => (
              <Button
                key={btn.type}
                variant={activeQuestionType === btn.type ? 'default' : 'outline'}
                onClick={() => {
                  setActiveQuestionType(btn.type);
                  form.setValue('questionType', btn.type);
                }}
                className={cn(
                  "min-w-[150px] h-12 text-sm font-medium",
                  activeQuestionType === btn.type
                    ? 'bg-green-500 hover:bg-green-600 text-white border-green-500'
                    : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'
                )}
              >
                {btn.icon}
                <span className="ml-2">{btn.label}</span>
              </Button>
            ))}
          </div>
          
          {isLoadingParentTest ? (
            <div className="space-y-4 p-6 max-w-2xl mx-auto">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !parentTestData ? (
            <div className="text-center p-6 max-w-2xl mx-auto border border-destructive bg-destructive/10 rounded-md">
              <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-2" />
              <p className="text-destructive font-semibold">Parent test data could not be loaded or is invalid.</p>
              <p className="text-destructive/80 text-sm">Please ensure the test has a valid name and exam association before adding questions.</p>
            </div>
          ) : (
            <>
              {activeQuestionType === 'multipleChoice' && (
                <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 max-w-2xl mx-auto">
                  <FormField
                    control={form.control}
                    name="LessonName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1"><Book className="h-4 w-4 text-muted-foreground"/>Lesson Name (from Test) *</FormLabel>
                        <FormControl><span><Input {...field} value={field.value ?? ''} disabled className="bg-slate-200 dark:bg-slate-700 opacity-75" /></span></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="QBExam"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1"><TagIcon className="h-4 w-4 text-muted-foreground"/>Exam Association (QBExam) *</FormLabel>
                        <FormControl><span><Input {...field} value={field.value ?? ''} disabled className="bg-slate-200 dark:bg-slate-700 opacity-75" /></span></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div>
                    <Label htmlFor="QuestionText" className="mb-1 block">Question</Label>
                    <div className="relative">
                      <FormField
                        control={form.control}
                        name="QuestionText"
                        render={({ field }) => (
                         <Textarea
                            id="QuestionText"
                            {...field}
                            value={field.value ?? ''}
                            placeholder="Enter the question text here. Use $...$ for inline math and $$...$$ for block math."
                            className="min-h-[120px] p-3 border-slate-400 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-slate-700/30 rounded-md"
                          />
                        )}
                      />
                      <div className="absolute top-2 right-2 flex items-center gap-1">
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700" onClick={() => console.log('Rich Text clicked (Placeholder)')}>
                              <RichTextIcon size={14} />
                              <span className="sr-only">Rich Text</span>
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700" onClick={() => openImageModalFor('QuestionImage')}>
                              <ImagePlus size={14}/>
                              <span className="sr-only">Link Question Image from Library</span>
                          </Button>
                      </div>
                    </div>
                    <FormMessage>{form.formState.errors.QuestionText?.message || form.formState.errors.QuestionImage?.message}</FormMessage>
                    {imagePreviews.QuestionImage && isValidHttpUrl(imagePreviews.QuestionImage) && (
                        <div className="mt-2 p-2 border rounded-md bg-slate-50 dark:bg-slate-700/50 relative w-fit">
                          <p className="text-xs text-slate-600 dark:text-slate-300 mb-1">Question Image:</p>
                          <NextImage src={imagePreviews.QuestionImage} alt="Question Preview" width={200} height={120} className="rounded object-contain border" data-ai-hint="question diagram"/>
                           <Button type="button" variant="destructive" size="icon" onClick={() => removeImagePreview('QuestionImage')} className="absolute -top-2 -right-2 h-6 w-6">
                            <Trash2 size={12} /> <span className="sr-only">Remove question image</span>
                          </Button>
                        </div>
                    )}
                  </div>

                  {fields.map((item, index) => (
                    <div key={item.id} className="space-y-1 p-3 border border-slate-200 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-700/20">
                      <Label htmlFor={`options.${index}.text`} className="text-sm">Option {String.fromCharCode(65 + index)} *</Label>
                      <div className="relative flex items-start gap-2">
                        <Controller
                          name={`options.${index}.text`}
                          control={form.control}
                          render={({ field }) => (
                            <Textarea
                              id={`options.${index}.text`}
                              {...field}
                              value={field.value ?? ''}
                              placeholder={`Text for Option ${String.fromCharCode(65 + index)}`}
                              className="min-h-[60px] p-3 border-slate-400 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-slate-700/30 rounded-md flex-grow"
                            />
                          )}
                        />
                         <div className="flex flex-col items-center gap-1 pt-1">
                            <Controller
                                name={`options.${index}.isCorrect`}
                                control={form.control}
                                render={({ field: checkboxField }) => (
                                    <Checkbox
                                    id={`options.${index}.isCorrect`}
                                    checked={checkboxField.value}
                                    onCheckedChange={() => handleOptionCheckboxChange(index)}
                                    className="h-5 w-5 border-slate-400 data-[state=checked]:bg-green-500 data-[state=checked]:text-white"
                                    aria-label={`Mark Option ${String.fromCharCode(65 + index)} as correct`}
                                    />
                                )}
                            />
                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700" onClick={() => openImageModalFor(`Option${String.fromCharCode(65 + index)}Image` as keyof TeacherAddQuestionInput)}>
                                <ImagePlus size={14}/> <span className="sr-only">Link Image to Option ${String.fromCharCode(65 + index)}</span>
                            </Button>
                        </div>
                      </div>
                      <FormMessage>{form.formState.errors.options?.[index]?.text?.message}</FormMessage>
                       {imagePreviews[`Option${String.fromCharCode(65 + index)}Image` as keyof TeacherAddQuestionInput] && isValidHttpUrl(imagePreviews[`Option${String.fromCharCode(65 + index)}Image` as keyof TeacherAddQuestionInput]) && (
                           <div className="mt-2 p-1 border rounded-md bg-white dark:bg-slate-700/50 relative w-fit text-xs">
                              <p className="text-slate-600 dark:text-slate-300 mb-0.5">Option {String.fromCharCode(65 + index)} Image:</p>
                              <NextImage src={imagePreviews[`Option${String.fromCharCode(65 + index)}Image` as keyof TeacherAddQuestionInput]!} alt={`Option ${String.fromCharCode(65 + index)} Preview`} width={100} height={60} className="rounded object-contain border" data-ai-hint="option illustration"/>
                              <Button type="button" variant="destructive" size="icon" onClick={() => removeImagePreview(`Option${String.fromCharCode(65 + index)}Image` as keyof TeacherAddQuestionInput)} className="absolute -top-2 -right-2 h-5 w-5">
                                  <Trash2 size={10} /> <span className="sr-only">Remove image for option ${String.fromCharCode(65 + index)}</span>
                              </Button>
                           </div>
                      )}
                    </div>
                  ))}
                  <FormMessage>{(form.formState.errors.options && !Array.isArray(form.formState.errors.options)) ? form.formState.errors.options.message : null}</FormMessage>
                  
                <FormField
                    control={form.control}
                    name="CorrectOption"
                    render={({ field }) => (
                         <input type="hidden" {...field} value={field.value || ''} /> 
                    )}
                />
                <FormMessage>{form.formState.errors.CorrectOption?.message}</FormMessage>

                <div className="space-y-1">
                    <Label className="mb-1 block">Explanation (Optional)</Label>
                    <div className="relative">
                      <FormField
                        control={form.control}
                        name="explanationText"
                        render={({ field }) => (
                         <Textarea
                            {...field}
                            value={field.value ?? ''}
                            placeholder="Explanation text..."
                            className="min-h-[80px] p-3 border-slate-400 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-slate-700/30 rounded-md"
                          />
                        )}
                      />
                      <div className="absolute top-2 right-2 flex items-center gap-1">
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700" onClick={() => console.log('Rich Text clicked (Placeholder)')}>
                              <RichTextIcon size={14} />
                              <span className="sr-only">Rich Text</span>
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700" onClick={() => openImageModalFor('explanationImage')}>
                              <ImagePlus size={14}/>
                              <span className="sr-only">Link Explanation Image from Library</span>
                          </Button>
                      </div>
                    </div>
                    <FormMessage>{form.formState.errors.explanationText?.message || form.formState.errors.explanationImage?.message}</FormMessage>
                    {imagePreviews.explanationImage && isValidHttpUrl(imagePreviews.explanationImage) && (
                        <div className="mt-2 p-2 border rounded-md bg-slate-50 dark:bg-slate-700/50 relative w-fit">
                          <p className="text-xs text-slate-600 dark:text-slate-300 mb-1">Explanation Image:</p>
                          <NextImage src={imagePreviews.explanationImage} alt="Explanation Preview" width={200} height={120} className="rounded object-contain border" data-ai-hint="explanation diagram"/>
                           <Button type="button" variant="destructive" size="icon" onClick={() => removeImagePreview('explanationImage')} className="absolute -top-2 -right-2 h-6 w-6">
                            <Trash2 size={12} /> <span className="sr-only">Remove explanation image</span>
                          </Button>
                        </div>
                    )}
                  </div>
                  
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-teal-400 to-cyan-500 hover:from-teal-500 hover:to-cyan-600 text-white font-semibold py-3 text-base shadow-md hover:shadow-lg transition-all duration-300"
                    disabled={form.formState.isSubmitting || isLoadingParentTest || !parentTestData}
                  >
                    <Save className="mr-2 h-5 w-5" />
                    {form.formState.isSubmitting ? 'Saving...' : (isLoadingParentTest ? 'Loading Test Info...' : (!parentTestData ? 'Parent Test Info Missing' : 'Save Question'))}
                  </Button>
                </form>
                </Form>
              )}
            </>
          )}

          {activeQuestionType === 'fillInBlank' && (
            <div className="text-center p-10 border-2 border-dashed rounded-lg border-slate-300 dark:border-slate-700">
                <TextCursorInput className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-500 mb-3" />
                <p className="text-slate-500 dark:text-slate-400">"Fill in the Blank" question type UI coming soon!</p>
            </div>
          )}
          {activeQuestionType === 'addSection' && (
             <div className="text-center p-10 border-2 border-dashed rounded-lg border-slate-300 dark:border-slate-700">
                <Type className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-500 mb-3" />
                <p className="text-slate-500 dark:text-slate-400">"Add Section" functionality coming soon!</p>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}

