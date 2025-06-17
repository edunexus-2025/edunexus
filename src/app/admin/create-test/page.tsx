
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { ClipboardPlus, Loader2, Save, RotateCcw, BookOpen, ListChecks, Filter, Check, Brain, Eye } from 'lucide-react';
import { CreateTestSchema, type CreateTestInput } from '@/lib/schemas';
import pb from '@/lib/pocketbase';
import type { RecordModel } from 'pocketbase';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';
import { Badge } from '@/components/ui/badge';
import { QuestionPreviewModal } from '@/components/admin/QuestionPreviewModal';

// Interface for questions fetched from question_bank
interface QuestionFromBank extends RecordModel {
  id: string;
  subject: 'Physics' | 'Chemistry' | 'Mathematics' | 'Biology';
  lessonName: string;
  lessonTopic?: string;
  questionText: string;
  marks?: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  questionType?: 'text' | 'image' | 'text_image';
  optionsFormat?: 'text_options' | 'image_options';
  optionAText?: string;
  optionBText?: string;
  optionCText?: string;
  optionDText?: string;
  questionImage?: string; // Filename from PocketBase
  // Explicitly include RecordModel required fields:
  collectionId: string; // Non-optional
  collectionName: string; // Non-optional
  created: string; // Non-optional
  updated: string; // Non-optional
}


const testSubjectOptions: Array<CreateTestInput['testSubject']> = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
const formTestTypes: Array<{value: CreateTestInput['Type'], label: string}> = [
    { value: "Free", label: "Free" },
    { value: "Premium", label: "Premium" },
    { value: "Free_Premium", label: "Free & Premium" },
];
const testExams: Array<NonNullable<CreateTestInput['Exam']>> = ["MHT CET", "JEE MAIN", "NEET"];

const MARKS_PER_QUESTION_CONFIG = {
  "MHT CET": { Physics: 1, Chemistry: 1, Mathematics: 2, Biology: 1 },
  "JEE MAIN": { Physics: 4, Chemistry: 4, Mathematics: 4, Biology: 0 }, 
  "NEET": { Physics: 4, Chemistry: 4, Mathematics: 0, Biology: 4 },    
} as const;

const NEGATIVE_MARKS_PER_QUESTION_CONFIG = {
  "MHT CET": { Physics: 0, Chemistry: 0, Mathematics: 0, Biology: 0 }, 
  "JEE MAIN": { Physics: -1, Chemistry: -1, Mathematics: -1, Biology: 0 },
  "NEET": { Physics: -1, Chemistry: -1, Mathematics: 0, Biology: -1 },
} as const;

const defaultFormValues: CreateTestInput = {
  TestName: '',
  TotalTime: 0, // Initialized as 0, schema coerces and min(1) validates
  Type: "Free",
  Model: 'Chapterwise',
  Exam: "JEE MAIN", // Default valid enum value
  TestTags: '',
  testSubject: undefined, 
  PhysicsQuestion: [],
  ChemistryQuestion: [],
  MathsQuestion: [],
  BiologyQuestion: [],
  TotalQuestion: 0,
  PhysicsTotalScore: 0,
  ChemistryTotalScore: 0,
  MathsTotalScore: 0,
  BiologyTotalScore: 0,
  OverallTotalScore: 0,
  overallNegativeScore: 0,
};


export default function AdminCreateTestPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [allQuestionsFromBank, setAllQuestionsFromBank] = useState<QuestionFromBank[]>([]);

  const [currentTestSubject, setCurrentTestSubject] = useState<CreateTestInput['testSubject']>();
  const [availableLessons, setAvailableLessons] = useState<string[]>([]);
  const [selectedLessonFilters, setSelectedLessonFilters] = useState<string[]>([]);
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [selectedTopicFilters, setSelectedTopicFilters] = useState<string[]>([]);
  
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);

  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [currentPreviewQuestionIndex, setCurrentPreviewQuestionIndex] = useState<number | null>(null);

  const form = useForm<CreateTestInput>({
    resolver: zodResolver(CreateTestSchema),
    defaultValues: defaultFormValues,
  });

  const watchedExam = form.watch('Exam');

  useEffect(() => {
    let isMounted = true;
    const fetchAllQuestions = async () => {
      if (!isMounted) return;
      setIsLoadingQuestions(true);
      try {
        const records = await pb.collection('question_bank').getFullList<QuestionFromBank>({
          fields: 'id,subject,lessonName,lessonTopic,questionText,marks,difficulty,questionType,optionsFormat,optionAText,optionBText,optionCText,optionDText,questionImage,collectionId,collectionName,created,updated', 
        });
        if (isMounted) {
          setAllQuestionsFromBank(records);
        }
      } catch (error: any) {
        if (isMounted) {
          if (error.name === 'AbortError' || (error.isAbort || (error.name === 'ClientResponseError' && error.status === 0))) {
            console.warn('Fetch questions aborted in AdminCreateTestPage');
          } else {
            console.error("Failed to fetch questions from bank:", error);
            toast({ title: "Error fetching questions", description: "Could not load questions from the bank.", variant: "destructive" });
          }
        }
      } finally {
        if (isMounted) setIsLoadingQuestions(false);
      }
    };
    fetchAllQuestions();
    return () => { isMounted = false; };
  }, [toast]);

  useEffect(() => {
    if (currentTestSubject) {
      const lessons = Array.from(new Set(
        allQuestionsFromBank
          .filter(q => q.subject === currentTestSubject)
          .map(q => q.lessonName)
      )).sort();
      setAvailableLessons(lessons);
      setSelectedLessonFilters([]); 
      setAvailableTopics([]); 
      setSelectedTopicFilters([]); 
      setSelectedQuestionIds([]); 
    } else {
      setAvailableLessons([]);
      setAvailableTopics([]);
    }
  }, [currentTestSubject, allQuestionsFromBank]);

  useEffect(() => {
    if (currentTestSubject && selectedLessonFilters.length > 0) {
      const topics = Array.from(new Set(
        allQuestionsFromBank
          .filter(q => q.subject === currentTestSubject && selectedLessonFilters.includes(q.lessonName) && q.lessonTopic)
          .map(q => q.lessonTopic!)
      )).sort();
      setAvailableTopics(topics);
      setSelectedTopicFilters([]);
      setSelectedQuestionIds([]); 
    } else {
      setAvailableTopics([]);
    }
  }, [currentTestSubject, selectedLessonFilters, allQuestionsFromBank]);
  
  useEffect(() => {
    testSubjectOptions.forEach(sbj => {
      form.setValue(`${sbj}Question` as keyof CreateTestInput, 
        currentTestSubject === sbj ? selectedQuestionIds : []
      );
    });
    form.setValue('TotalQuestion', selectedQuestionIds.length);

    if (watchedExam && currentTestSubject) {
      const examMarkConfig = MARKS_PER_QUESTION_CONFIG[watchedExam];
      const examNegativeMarkConfig = NEGATIVE_MARKS_PER_QUESTION_CONFIG[watchedExam];
      const subjectKey = currentTestSubject as keyof typeof examMarkConfig;
      
      let currentSubjectPositiveScore = 0;
      let currentSubjectNegativeScore = 0;

      if (examMarkConfig && subjectKey in examMarkConfig) {
        const marksPerQuestion = examMarkConfig[subjectKey];
        currentSubjectPositiveScore = selectedQuestionIds.length * marksPerQuestion;
      }
      
      if (examNegativeMarkConfig && subjectKey in examNegativeMarkConfig) {
        const negativeMarksPerQuestion = examNegativeMarkConfig[subjectKey];
        currentSubjectNegativeScore = selectedQuestionIds.length * negativeMarksPerQuestion;
      }

      testSubjectOptions.forEach(sbj => {
        const scoreField = `${sbj}TotalScore` as keyof CreateTestInput;
        if (sbj !== currentTestSubject) {
          form.setValue(scoreField, 0);
        }
      });
      
      if (currentTestSubject === 'Physics') form.setValue('PhysicsTotalScore', currentSubjectPositiveScore);
      else if (currentTestSubject === 'Chemistry') form.setValue('ChemistryTotalScore', currentSubjectPositiveScore);
      else if (currentTestSubject === 'Mathematics') form.setValue('MathsTotalScore', currentSubjectPositiveScore);
      else if (currentTestSubject === 'Biology') form.setValue('BiologyTotalScore', currentSubjectPositiveScore);
      
      form.setValue('overallNegativeScore', currentSubjectNegativeScore);

    } else {
      testSubjectOptions.forEach(sbj => {
        form.setValue(`${sbj}TotalScore` as keyof CreateTestInput, 0);
      });
      form.setValue('overallNegativeScore', 0);
    }
  }, [selectedQuestionIds, currentTestSubject, form, watchedExam]);

  useEffect(() => {
    const physicsScore = form.getValues('PhysicsTotalScore') || 0;
    const chemistryScore = form.getValues('ChemistryTotalScore') || 0;
    const mathsScore = form.getValues('MathsTotalScore') || 0;
    const biologyScore = form.getValues('BiologyTotalScore') || 0;
    form.setValue('OverallTotalScore', physicsScore + chemistryScore + mathsScore + biologyScore);
  }, [
    form.watch('PhysicsTotalScore'), 
    form.watch('ChemistryTotalScore'), 
    form.watch('MathsTotalScore'), 
    form.watch('BiologyTotalScore'), 
    form
  ]);


  const handleLessonFilterChange = (lessonName: string, checked: boolean) => {
    setSelectedLessonFilters(prev => 
      checked ? [...prev, lessonName] : prev.filter(l => l !== lessonName)
    );
  };

  const handleTopicFilterChange = (topicName: string, checked: boolean) => {
    setSelectedTopicFilters(prev =>
      checked ? [...prev, topicName] : prev.filter(t => t !== topicName)
    );
  };

  const handleQuestionSelectionChange = (questionId: string, checked: boolean) => {
    setSelectedQuestionIds(prev =>
      checked ? [...prev, questionId] : prev.filter(id => id !== questionId)
    );
  };

  const questionsForDisplay = useMemo(() => {
    if (!currentTestSubject) return [];
    return allQuestionsFromBank.filter(q => {
      const subjectMatch = q.subject === currentTestSubject;
      const lessonMatch = selectedLessonFilters.length === 0 || selectedLessonFilters.includes(q.lessonName);
      const topicMatch = selectedTopicFilters.length === 0 || (q.lessonTopic && selectedTopicFilters.includes(q.lessonTopic));
      return subjectMatch && lessonMatch && topicMatch;
    });
  }, [allQuestionsFromBank, currentTestSubject, selectedLessonFilters, selectedTopicFilters]);

  const renderLatexSnippet = (text: string | undefined | null): React.ReactNode => {
    if (!text) return null;
    const snippet = text.length > 70 ? text.substring(0, 70) + "..." : text;
    const parts = snippet.split(/(\$.*?\$)/g);
    return parts.map((part, index) => {
      if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
        try {
          return <InlineMath key={index} math={part.substring(1, part.length - 1)} />;
        } catch (e) { return <span key={index} className="text-red-500" title="LaTeX Error">{part}</span>; }
      }
      return <span key={index}>{part}</span>;
    });
  };

  const openPreviewModal = (index: number) => {
    setCurrentPreviewQuestionIndex(index);
    setIsPreviewModalOpen(true);
  };

  const handleModalClose = () => {
    setIsPreviewModalOpen(false);
    setCurrentPreviewQuestionIndex(null);
  };

  const handleModalApproveAndNext = () => {
    if (currentPreviewQuestionIndex !== null) {
      const questionId = questionsForDisplay[currentPreviewQuestionIndex].id;
      if (!selectedQuestionIds.includes(questionId)) {
        setSelectedQuestionIds(prev => [...prev, questionId]);
      }
      handleModalNext();
    }
  };
  
  const handleModalApproveAndClose = () => {
    if (currentPreviewQuestionIndex !== null) {
      const questionId = questionsForDisplay[currentPreviewQuestionIndex].id;
      if (!selectedQuestionIds.includes(questionId)) {
        setSelectedQuestionIds(prev => [...prev, questionId]);
      }
      handleModalClose();
    }
  };

  const handleModalNext = () => {
    if (currentPreviewQuestionIndex !== null && currentPreviewQuestionIndex < questionsForDisplay.length - 1) {
      setCurrentPreviewQuestionIndex(currentPreviewQuestionIndex + 1);
    } else {
      handleModalClose(); 
    }
  };

  const handleModalPrevious = () => {
    if (currentPreviewQuestionIndex !== null && currentPreviewQuestionIndex > 0) {
      setCurrentPreviewQuestionIndex(currentPreviewQuestionIndex - 1);
    }
  };

  async function onSubmit(data: CreateTestInput) {
    setIsSubmitting(true);

    let pocketBaseType: string[] = [];
    if (data.Type === "Free_Premium") {
      pocketBaseType = ["Free", "Premium"];
    } else if (data.Type === "Free") {
      pocketBaseType = ["Free"];
    } else if (data.Type === "Premium") {
      pocketBaseType = ["Premium"];
    }
    
    const physicsTotalScore = form.getValues('PhysicsTotalScore');
    const chemistryTotalScore = form.getValues('ChemistryTotalScore');
    const mathsTotalScore = form.getValues('MathsTotalScore');
    const biologyTotalScore = form.getValues('BiologyTotalScore');
    const overallTotalScore = form.getValues('OverallTotalScore');
    const overallNegativeScoreValue = form.getValues('overallNegativeScore');


    const dataToSave = {
      ...data,
      TotalTime: data.TotalTime ? String(data.TotalTime) : "0", 
      Type: pocketBaseType, 
      Model: 'Chapterwise', 
      testSubject: currentTestSubject,
      PhysicsQuestion: currentTestSubject === 'Physics' ? selectedQuestionIds : [],
      ChemistryQuestion: currentTestSubject === 'Chemistry' ? selectedQuestionIds : [],
      MathsQuestion: currentTestSubject === 'Mathematics' ? selectedQuestionIds : [],
      BiologyQuestion: currentTestSubject === 'Biology' ? selectedQuestionIds : [],
      TotalQuestion: selectedQuestionIds.length,
      PhysicsTotalScore: String(physicsTotalScore),
      ChemistryTotalScore: String(chemistryTotalScore),
      MathsTotalScore: String(mathsTotalScore),
      BiologyTotalScore: String(biologyTotalScore),
      OverallTotalScore: String(overallTotalScore),
      overallNegativeScore: String(overallNegativeScoreValue),
    };

    console.log("Submitting Test Data:", dataToSave);

    try {
      await pb.collection('test_pages').create(dataToSave);
      toast({ title: 'Test Created!', description: `Chapterwise test "${data.TestName}" has been successfully created.` });
      handleResetForm(); 
    } catch (error: any) {
      console.error('PocketBase Error - Failed to create test:', error.data || error.originalError || error);
      let detailedErrorMessage = 'An unexpected error occurred.';
      if (error.data && error.data.data) {
        detailedErrorMessage = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
      } else if (error.message) { detailedErrorMessage = error.message; }
      toast({ title: 'Error Creating Test', description: detailedErrorMessage, variant: 'destructive', duration: 7000 });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleResetForm = () => {
    form.reset(defaultFormValues); 
    setCurrentTestSubject(undefined);
    setSelectedLessonFilters([]);
    setSelectedTopicFilters([]);
    setSelectedQuestionIds([]);
    toast({title: "Form Cleared", description: "You can start creating a new test."});
  };

  const currentPreviewQuestion = currentPreviewQuestionIndex !== null ? questionsForDisplay[currentPreviewQuestionIndex] : null;


  return (
    <div className="space-y-6 p-4 md:p-6">
      <Card className="shadow-xl border-none">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardPlus className="h-7 w-7 text-primary" /> Create New Chapterwise Test
          </CardTitle>
          <CardDescription>
            Fill in the details to create a new chapterwise test.
            <Button variant="outline" size="sm" className="ml-4" onClick={() => alert("Full Length Test creation UI coming soon!")}>Switch to Full Length Test</Button>
          </CardDescription>
        </CardHeader>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card className="shadow-lg border-t-4 border-primary rounded-t-none">
            <CardHeader><CardTitle className="text-lg font-semibold">Basic Test Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FormField control={form.control} name="TestName" render={({ field }) => ( <FormItem> <FormLabel>Test Name *</FormLabel> <FormControl><Input placeholder="e.g., Physics - Kinematics Test 1" {...field} /></FormControl> <FormMessage /> </FormItem> )}/>
              <FormField
                control={form.control}
                name="TotalTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Time (in minutes) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g., 90"
                        {...field}
                        onChange={e => {
                            const val = e.target.value;
                            // Zod's coerce will handle the string to number. Pass undefined if empty.
                            field.onChange(val === '' ? undefined : parseInt(val, 10));
                          }}
                        // The value prop for type="number" should be a number or empty string.
                        // Handle undefined/null from react-hook-form state.
                        value={field.value === undefined || field.value === null ? '' : String(field.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="Type" render={({ field }) => ( <FormItem> <FormLabel>Type *</FormLabel> <Select onValueChange={field.onChange} value={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Select Test Type" /></SelectTrigger></FormControl> <SelectContent>{formTestTypes.map(type => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )}/>
              <FormField control={form.control} name="Exam" render={({ field }) => ( <FormItem> <FormLabel>Target Exam *</FormLabel> <Select onValueChange={field.onChange} value={field.value}> <FormControl><SelectTrigger><SelectValue placeholder="Select Target Exam" /></SelectTrigger></FormControl> <SelectContent>{testExams.map(exam => <SelectItem key={exam} value={exam}>{exam}</SelectItem>)}</SelectContent> </Select> <FormMessage /> </FormItem> )}/>
              <FormField control={form.control} name="TestTags" render={({ field }) => ( <FormItem className="md:col-span-2 lg:col-span-1"> <FormLabel>Test Tags (comma-separated)</FormLabel> <FormControl><Input placeholder="e.g., easy, conceptual, jee main" {...field} value={field.value || ''} /></FormControl> <FormMessage /> </FormItem> )}/>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-t-4 border-primary rounded-t-none">
            <CardHeader><CardTitle className="text-lg font-semibold">Scores & Question Count (Auto-Calculated)</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <FormField control={form.control} name="TotalQuestion" render={({ field }) => ( <FormItem> <FormLabel>Total Questions</FormLabel> <FormControl><Input type="number" {...field} readOnly className="bg-muted/50" /></FormControl> <FormMessage /> </FormItem> )}/>
                <FormField control={form.control} name="PhysicsTotalScore" render={({ field }) => ( <FormItem> <FormLabel>Physics Score</FormLabel> <FormControl><Input type="number" {...field} readOnly className="bg-muted/50" /></FormControl> <FormMessage /> </FormItem> )}/>
                <FormField control={form.control} name="ChemistryTotalScore" render={({ field }) => ( <FormItem> <FormLabel>Chemistry Score</FormLabel> <FormControl><Input type="number" {...field} readOnly className="bg-muted/50" /></FormControl> <FormMessage /> </FormItem> )}/>
                <FormField control={form.control} name="MathsTotalScore" render={({ field }) => ( <FormItem> <FormLabel>Maths Score</FormLabel> <FormControl><Input type="number" {...field} readOnly className="bg-muted/50" /></FormControl> <FormMessage /> </FormItem> )}/>
                <FormField control={form.control} name="BiologyTotalScore" render={({ field }) => ( <FormItem> <FormLabel>Biology Score</FormLabel> <FormControl><Input type="number" {...field} readOnly className="bg-muted/50" /></FormControl> <FormMessage /> </FormItem> )}/>
                <FormField control={form.control} name="OverallTotalScore" render={({ field }) => ( <FormItem> <FormLabel>Overall Score</FormLabel> <FormControl><Input type="number" {...field} readOnly className="bg-muted/50" /></FormControl> <FormMessage /> </FormItem> )}/>
                <FormField control={form.control} name="overallNegativeScore" render={({ field }) => ( <FormItem> <FormLabel>Overall Negative Score (Auto-Calculated)</FormLabel> <FormControl><Input type="number" {...field} readOnly className="bg-muted/50" /></FormControl> <FormMessage /> </FormItem> )}/>
            </CardContent>
          </Card>
          
          <Card className="shadow-lg border-t-4 border-primary rounded-t-none">
            <CardHeader><CardTitle className="text-lg font-semibold flex items-center gap-2"><ListChecks className="text-primary"/>Select Questions for Chapterwise Test</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="testSubject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>1. Select Subject for this Test *</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        setCurrentTestSubject(value as CreateTestInput['testSubject']);
                      }} 
                      value={field.value}
                    >
                      <FormControl><SelectTrigger><SelectValue placeholder="Choose a subject" /></SelectTrigger></FormControl>
                      <SelectContent>{testSubjectOptions.map(subject => <SelectItem key={subject} value={subject!}>{subject}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {currentTestSubject && (
                <Card className="p-4 bg-muted/30">
                  <FormLabel className="text-md font-medium flex items-center gap-2 mb-3"><BookOpen className="h-5 w-5 text-primary"/>2. Filter by Lessons (for {currentTestSubject})</FormLabel>
                  {isLoadingQuestions ? <Skeleton className="h-20 w-full"/> : availableLessons.length > 0 ? (
                    <ScrollArea className="h-[150px] border rounded-md p-2">
                      <div className="space-y-1">
                        {availableLessons.map(lesson => (
                          <div key={lesson} className="flex items-center space-x-2 p-1.5 rounded hover:bg-background">
                            <Checkbox
                              id={`lesson-${lesson}`}
                              checked={selectedLessonFilters.includes(lesson)}
                              onCheckedChange={(checked) => handleLessonFilterChange(lesson, !!checked)}
                            />
                            <label htmlFor={`lesson-${lesson}`} className="text-sm cursor-pointer flex-grow">{lesson}</label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : <p className="text-sm text-muted-foreground">No lessons found for {currentTestSubject}. Add questions to this subject first.</p>}
                </Card>
              )}

              {currentTestSubject && selectedLessonFilters.length > 0 && availableTopics.length > 0 && (
                <Card className="p-4 bg-muted/30">
                  <FormLabel className="text-md font-medium flex items-center gap-2 mb-3"><Filter className="h-5 w-5 text-primary"/>3. Filter by Topics (Optional)</FormLabel>
                  {isLoadingQuestions ? <Skeleton className="h-20 w-full"/> : (
                    <ScrollArea className="h-[150px] border rounded-md p-2">
                      <div className="space-y-1">
                        {availableTopics.map(topic => (
                          <div key={topic} className="flex items-center space-x-2 p-1.5 rounded hover:bg-background">
                            <Checkbox
                              id={`topic-${topic}`}
                              checked={selectedTopicFilters.includes(topic)}
                              onCheckedChange={(checked) => handleTopicFilterChange(topic, !!checked)}
                            />
                            <label htmlFor={`topic-${topic}`} className="text-sm cursor-pointer flex-grow">{topic}</label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </Card>
              )}
              
              {currentTestSubject && (
                <Card className="p-4 bg-muted/30">
                  <FormLabel className="text-md font-medium flex items-center gap-2 mb-3"><Check className="h-5 w-5 text-primary"/>4. Select Questions ({selectedQuestionIds.length} selected)</FormLabel>
                  {isLoadingQuestions ? <Skeleton className="h-40 w-full"/> : questionsForDisplay.length > 0 ? (
                    <ScrollArea className="h-[300px] w-full rounded-md border p-3 space-y-2">
                      {questionsForDisplay.map((q, index) => (
                        <div key={q.id} className="flex items-start space-x-3 p-2.5 rounded-md hover:bg-background border bg-card">
                          <Checkbox
                            id={`q-${q.id}`}
                            checked={selectedQuestionIds.includes(q.id)}
                            onCheckedChange={(checked) => handleQuestionSelectionChange(q.id, !!checked)}
                            className="mt-1"
                          />
                          <div className="flex-grow cursor-pointer space-y-1" onClick={() => openPreviewModal(index)}>
                            <div className="prose prose-sm max-w-none line-clamp-2">{renderLatexSnippet(q.questionText)}</div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant={q.difficulty === 'Easy' ? 'secondary' : q.difficulty === 'Medium' ? 'default' : 'destructive'} className="px-1.5 py-0 text-[10px]">{q.difficulty}</Badge>
                                <span>Marks: {q.marks ?? 'N/A'}</span>
                                <span className="truncate" title={q.id}>ID: ...{q.id.slice(-5)}</span>
                            </div>
                          </div>
                           <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openPreviewModal(index)}
                            className="ml-auto flex-shrink-0 px-2 sm:px-3 flex items-center" 
                            aria-label="View question details"
                          >
                            <Eye className="h-5 w-5" /> 
                            <span className="hidden sm:inline sm:ml-1.5">View</span> 
                          </Button>
                        </div>
                      ))}
                    </ScrollArea>
                  ) : <p className="text-sm text-muted-foreground text-center py-4">No questions found matching your current filters for {currentTestSubject}. Adjust lesson/topic filters or add more questions.</p>}
                </Card>
              )}
            </CardContent>
          </Card>


          <CardFooter className="flex flex-col sm:flex-row justify-between items-center pt-6 gap-3 bg-background rounded-b-lg shadow-md">
            <Button type="button" variant="outline" onClick={handleResetForm} disabled={isSubmitting}>
              <RotateCcw className="mr-2 h-4 w-4" /> Clear Form &amp; Selections
            </Button>
            <Button type="submit" size="lg" disabled={isSubmitting || isLoadingQuestions}>
              {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
              {isSubmitting ? 'Creating Test...' : (isLoadingQuestions ? 'Loading Questions...' : 'Create Chapterwise Test')}
            </Button>
          </CardFooter>
        </form>
      </Form>
      {currentPreviewQuestion && (
        <QuestionPreviewModal
          isOpen={isPreviewModalOpen}
          onClose={handleModalClose}
          question={currentPreviewQuestion}
          onApproveAndNext={handleModalApproveAndNext}
          onApproveAndClose={handleModalApproveAndClose}
          onSkipAndNext={handleModalNext}
          onPrevious={handleModalPrevious}
          hasNext={currentPreviewQuestionIndex !== null && currentPreviewQuestionIndex < questionsForDisplay.length - 1}
          hasPrevious={currentPreviewQuestionIndex !== null && currentPreviewQuestionIndex > 0}
          isApproved={selectedQuestionIds.includes(currentPreviewQuestion.id)}
        />
      )}
    </div>
  );
}

    