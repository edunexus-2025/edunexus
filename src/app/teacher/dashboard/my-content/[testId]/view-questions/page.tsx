
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ArrowLeft, AlertCircle, ChevronLeft, ChevronRight, Loader2, Eye, Image as ImageIconLucide } from 'lucide-react';
import { Routes } from '@/lib/constants';
import { useEffect, useState, useCallback } from 'react';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import NextImage from 'next/image';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Combined interface for displaying questions from either source
interface DisplayableQuestion extends RecordModel {
  id: string;
  displayQuestionText?: string;
  displayQuestionImageUrl?: string | null;
  displayOptions: { label: string; text?: string; imageUrl?: string | null }[];
  displayCorrectOptionLabel: string; // e.g., "A", "B"
  displayExplanationText?: string;
  displayExplanationImageUrl?: string | null;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  subject?: string;
  lessonName?: string;
  marks?: number;
  source: 'EduNexus QB' | 'My QB'; // To distinguish origin
}

interface ParentTest extends RecordModel {
  testName: string;
  questions_edunexus?: string[];
  questions_teachers?: string[];
  QBExam?: string; // To be used as a fallback for subject
  expand?: {
    questions_edunexus?: RecordModel[];
    questions_teachers?: RecordModel[];
  };
}

const renderLatex = (text: string | undefined | null): React.ReactNode => {
  if (!text) return null;
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$.*?\$|\\\(.*?\\\)|\\\[.*?\\\]|\\begin\{.*?\}[\s\S]*?\\end\{.*?\})/g);
  return parts.map((part, index) => {
    try {
      if (part.startsWith('$$') && part.endsWith('$$')) return <BlockMath key={index} math={part.substring(2, part.length - 2)} />;
      if (part.startsWith('$') && part.endsWith('$')) return <InlineMath key={index} math={part.substring(1, part.length - 1)} />;
      if (part.startsWith('\\(') && part.endsWith('\\)')) return <InlineMath key={index} math={part.substring(2, part.length - 2)} />;
      if (part.startsWith('\\[') && part.endsWith('\\]')) return <BlockMath key={index} math={part.substring(2, part.length - 2)} />;
      if (part.startsWith('\\begin{') && part.includes('\\end{')) return <BlockMath key={index} math={part} />;
    } catch (e) { return <span key={index} className="text-destructive" title="LaTeX Error">{part}</span>; }
    return <span key={index}>{part}</span>;
  });
};

const isValidHttpUrl = (string: string | null | undefined): string is string => {
  if (!string || typeof string !== 'string') return false;
  try { const url = new URL(string); return url.protocol === "http:" || url.protocol === "https:"; }
  catch (_) { return false; }
};

const getPbFileUrlOrDirectUrl = (record: RecordModel | null | undefined, fieldName: string, isDirectUrlField: boolean = false): string | null => {
    if (!record) {
      // console.warn(`ViewTestQuestionsPage: getPbFileUrlOrDirectUrl called with null/undefined record for field '${fieldName}'.`);
      return null;
    }
    if (!record[fieldName] || typeof record[fieldName] !== 'string') {
      // console.warn(`ViewTestQuestionsPage: Field '${fieldName}' is missing or not a string on record '${record.id}'. Value:`, record[fieldName]);
      return null;
    }
    const fieldValue = (record[fieldName] as string).trim();
    if (!fieldValue) {
        // console.warn(`ViewTestQuestionsPage: Field '${fieldName}' has an empty trimmed value on record '${record.id}'.`);
        return null;
    }

    if (isDirectUrlField) {
      // This path is for teacher_question_data where fields like QuestionImage store full URLs
      if (isValidHttpUrl(fieldValue)) {
        return fieldValue;
      }
      // console.warn(`ViewTestQuestionsPage: Invalid direct URL for field '${fieldName}' in record ${record.id}: '${fieldValue}'`);
      return null;
    } else {
      // This path is for question_bank where fields like questionImage store filenames
      // Here, collectionId and collectionName are absolutely required for pb.files.getUrl
      if (typeof record.id === 'string' && record.id.trim() !== '' &&
          typeof record.collectionId === 'string' && record.collectionId.trim() !== '' &&
          typeof record.collectionName === 'string' && record.collectionName.trim() !== '') {
        try {
          // console.log(`ViewTestQuestionsPage: Attempting pb.files.getUrl for record: ${record.id}, field: ${fieldName}, collection: ${record.collectionName}, filename: ${fieldValue}`);
          // Ensure the record passed to pb.files.getUrl is minimal but complete for this purpose
          const minimalRecordForPb = {
              id: record.id,
              collectionId: record.collectionId,
              collectionName: record.collectionName,
              // This dynamic field assignment is crucial.
              // It ensures that the `fieldValue` (the filename) is actually present on the object
              // that pb.files.getUrl uses internally, under the key `fieldName`.
              [fieldName]: fieldValue 
          };
          return pb.files.getUrl(minimalRecordForPb as RecordModel, fieldValue);
        } catch (e) {
          console.warn(`ViewTestQuestionsPage: Catch block - Error getting PB file URL for ${fieldName} in record ${record.id} (collection: ${record.collectionName}, filename: ${fieldValue}). Error:`, e);
          return null;
        }
      }
      // If collectionId or collectionName is missing/falsy, log it and return null
      console.error(`ViewTestQuestionsPage: CRITICAL - Missing or invalid collectionId/collectionName for PB file field '${fieldName}' in record ID '${record.id}'. Cannot call pb.files.getUrl. Record details: collectionId='${record.collectionId}', collectionName='${record.collectionName}'. This leads to 'Missing collection context' error.`);
      return null;
    }
};


export default function ViewTestQuestionsPage() {
  const params = useParams();
  const router = useRouter();
  const { teacher, isLoadingTeacher } = useAuth();
  const testId = typeof params.testId === 'string' ? params.testId : '';

  const [parentTest, setParentTest] = useState<ParentTest | null>(null);
  const [questions, setQuestions] = useState<DisplayableQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      if (!testId || isLoadingTeacher || !teacher?.id) {
        if (isMounted) {
          setIsLoadingData(false);
          if (!isLoadingTeacher && !teacher?.id) setError("Teacher not authenticated.");
        }
        return;
      }
      if (isMounted) setIsLoadingData(true);

      try {
        if (!isMounted) return;
        const fetchedTest = await pb.collection('teacher_tests').getOne<ParentTest>(testId, {
          expand: `
            questions_edunexus(id,questionText,questionImage,optionAText,optionAImage,optionBText,optionBImage,optionCText,optionCImage,optionDText,optionDImage,correctOption,explanationText,explanationImage,difficulty,subject,lessonName,marks,collectionId,collectionName),
            questions_teachers(id,QuestionText,QuestionImage,OptionAText,OptionAImage,OptionBText,OptionBImage,OptionCText,OptionCImage,OptionDText,OptionDImage,CorrectOption,explanationText,explanationImage,subject,LessonName,marks,QBExam,collectionId,collectionName)
          `,
        });
        if (isMounted) {
          setParentTest(fetchedTest);
          let combinedQuestions: DisplayableQuestion[] = [];

          const eduNexusQs = fetchedTest.expand?.questions_edunexus || [];
          eduNexusQs.forEach((q: RecordModel) => {
            combinedQuestions.push({
              ...q,
              id: q.id,
              displayQuestionText: q.questionText,
              displayQuestionImageUrl: getPbFileUrlOrDirectUrl(q, 'questionImage', false),
              displayOptions: [
                { label: 'A', text: q.optionAText, imageUrl: getPbFileUrlOrDirectUrl(q, 'optionAImage', false) },
                { label: 'B', text: q.optionBText, imageUrl: getPbFileUrlOrDirectUrl(q, 'optionBImage', false) },
                { label: 'C', text: q.optionCText, imageUrl: getPbFileUrlOrDirectUrl(q, 'optionCImage', false) },
                { label: 'D', text: q.optionDText, imageUrl: getPbFileUrlOrDirectUrl(q, 'optionDImage', false) },
              ],
              displayCorrectOptionLabel: q.correctOption || "",
              displayExplanationText: q.explanationText,
              displayExplanationImageUrl: getPbFileUrlOrDirectUrl(q, 'explanationImage', false),
              source: 'EduNexus QB',
              difficulty: q.difficulty,
              subject: q.subject,
              lessonName: q.lessonName, // Directly from question_bank
              marks: q.marks
            });
          });

          const teacherQs = fetchedTest.expand?.questions_teachers || [];
          teacherQs.forEach((q: RecordModel) => {
            combinedQuestions.push({
              ...q,
              id: q.id,
              displayQuestionText: q.QuestionText,
              displayQuestionImageUrl: getPbFileUrlOrDirectUrl(q, 'QuestionImage', true),
              displayOptions: [
                { label: 'A', text: q.OptionAText, imageUrl: getPbFileUrlOrDirectUrl(q, 'OptionAImage', true) },
                { label: 'B', text: q.OptionBText, imageUrl: getPbFileUrlOrDirectUrl(q, 'OptionBImage', true) },
                { label: 'C', text: q.OptionCText, imageUrl: getPbFileUrlOrDirectUrl(q, 'OptionCImage', true) },
                { label: 'D', text: q.OptionDText, imageUrl: getPbFileUrlOrDirectUrl(q, 'OptionDImage', true) },
              ],
              displayCorrectOptionLabel: q.CorrectOption?.replace("Option ", "") || "",
              displayExplanationText: q.explanationText,
              displayExplanationImageUrl: getPbFileUrlOrDirectUrl(q, 'explanationImage', true),
              source: 'My QB',
              marks: q.marks,
              subject: q.subject || fetchedTest.QBExam, // Fallback to test's QBExam if question subject is missing
              lessonName: fetchedTest.testName, // For "My QB" questions, the lesson context is the test itself
              difficulty: q.difficulty as DisplayableQuestion['difficulty'], // Ensure type compatibility
            });
          });
          
          setQuestions(combinedQuestions);
           if (combinedQuestions.length === 0) {
            setError(`No questions found for "${fetchedTest.testName}". This could be because:\n1. No questions are linked to this test in its 'questions_edunexus' or 'questions_teachers' fields in the database.\n2. API Rules for the 'question_bank' or 'teacher_question_data' collections might be too restrictive (e.g., admin-only view access or incorrect filter rules).\nPlease check the test data and collection permissions in your PocketBase admin panel.`);
          }
        } else { return; }
      } catch (err: any) {
        if (isMounted) {
          console.error("ViewTestQuestionsPage: Failed to fetch data:", err.data || err);
          setError(`Could not load test details. Error: ${err.data?.message || err.message}`);
        }
      } finally {
        if (isMounted) setIsLoadingData(false);
      }
    };

    if (testId && teacher?.id && !isLoadingTeacher) { loadData(); }
    else if (isMounted && !isLoadingTeacher && !teacher?.id) { setError("Teacher not authenticated."); setIsLoadingData(false); }
    
    return () => { isMounted = false; };
  }, [testId, teacher?.id, isLoadingTeacher]);

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const currentQuestion = questions[currentQuestionIndex];
  
  if (isLoadingData) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between mb-4"><Skeleton className="h-8 w-32" /><Skeleton className="h-8 w-1/2" /><div className="w-8"></div></div>
        <Card className="shadow-lg"><CardHeader className="p-4 border-b flex justify-between items-center"><Skeleton className="h-6 w-1/4" /><Skeleton className="h-8 w-8 rounded-full" /></CardHeader><CardContent className="p-4 md:p-6 space-y-4"><Skeleton className="h-5 w-1/3" /><Skeleton className="h-20 w-full" />{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</CardContent><CardFooter className="flex justify-between p-4 border-t"><Skeleton className="h-10 w-32" /><Skeleton className="h-10 w-32" /></CardFooter></Card>
      </div>
    );
  }

  if (error) {
    return ( <div className="space-y-6 p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen"><Button variant="outline" size="sm" onClick={() => router.push(Routes.teacherTestPanel(testId))} className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Test Panel</Button><Card className="shadow-lg border-destructive bg-destructive/10 max-w-3xl mx-auto"><CardHeader><CardTitle className="text-destructive flex items-center gap-2"><AlertCircle />Error Loading Questions</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap">{error}</p></CardContent></Card></div> );
  }

  if (questions.length === 0 && !isLoadingData) {
    return ( <div className="space-y-6 p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen"><Button variant="outline" size="sm" onClick={() => router.push(Routes.teacherTestPanel(testId))} className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Test Panel</Button><Card className="text-center p-10 shadow-md max-w-3xl mx-auto"><CardHeader><AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-3" /><CardTitle>No Questions Found</CardTitle></CardHeader><CardContent><CardDescription>No questions are currently linked to "{parentTest?.testName || 'this test'}". You can add them from the "Add Question" section in the test panel.</CardDescription></CardContent></Card></div> );
  }
  if (!currentQuestion) {
    return ( <div className="space-y-6 p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen"><Button variant="outline" size="sm" onClick={() => router.push(Routes.teacherTestPanel(testId))} className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Test Panel</Button><Card className="text-center p-10 shadow-md max-w-3xl mx-auto"><CardContent><p>Current question not available or index out of bounds.</p></CardContent></Card></div>);
  }

  return (
    <div className="space-y-6 p-2 sm:p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="flex items-center justify-between mb-4 max-w-3xl mx-auto">
        <Button variant="outline" size="sm" onClick={() => router.push(Routes.teacherTestPanel(testId))}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Test Panel</Button>
        <h1 className="text-lg md:text-xl font-semibold text-center text-foreground flex-grow truncate px-2">Viewing Questions for: <span className="text-primary">{parentTest?.testName || "Test"}</span></h1>
        <div className="w-24 sm:w-32"> {/* Spacer */} </div>
      </div>
      <Card className="max-w-3xl mx-auto shadow-xl border border-border rounded-lg overflow-hidden">
        <CardHeader className="p-4 bg-card border-b border-border">
            <div className="flex justify-between items-center">
                <p className="text-sm font-medium text-muted-foreground">Question {currentQuestionIndex + 1} of {questions.length}</p>
                <Badge variant={currentQuestion.source === 'EduNexus QB' ? 'secondary' : 'outline'} className={cn("text-xs", currentQuestion.source === 'My QB' && "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700")}>
                  {currentQuestion.source}
                </Badge>
            </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 space-y-6">
          <div className="flex items-center gap-2 flex-wrap">
            {currentQuestion.difficulty && <Badge variant={currentQuestion.difficulty === 'Easy' ? 'secondary' : currentQuestion.difficulty === 'Medium' ? 'default' : 'destructive'} className="text-xs">{currentQuestion.difficulty}</Badge>}
            {currentQuestion.subject && <Badge variant="outline" className="text-xs">{currentQuestion.subject}</Badge>}
            {currentQuestion.lessonName && <Badge variant="outline" className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-600">{currentQuestion.lessonName}</Badge>}
            {currentQuestion.marks !== undefined && <Badge variant="outline" className="text-xs">Marks: {currentQuestion.marks}</Badge>}
          </div>
          <div className="p-3 border-b border-border rounded-md bg-background">
            {currentQuestion.displayQuestionText && (<div className="prose prose-sm dark:prose-invert max-w-none mb-4 text-foreground leading-relaxed">{renderLatex(currentQuestion.displayQuestionText)}</div>)}
            {currentQuestion.displayQuestionImageUrl && (<div className="my-3 text-center"><NextImage src={currentQuestion.displayQuestionImageUrl} alt="Question Image" width={400} height={300} className="rounded object-contain inline-block border" data-ai-hint="diagram illustration"/></div>)}
            {!(currentQuestion.displayQuestionText || currentQuestion.displayQuestionImageUrl) && (<p className="text-sm text-muted-foreground italic">No question text or image provided.</p>)}
          </div>
          <div className="space-y-3">
            <h4 className="text-md font-semibold text-muted-foreground">Options:</h4>
            {currentQuestion.displayOptions.map((opt) => {
              const isThisCorrect = currentQuestion.displayCorrectOptionLabel === opt.label;
              return (
                <div key={opt.label} className={cn("flex items-start gap-3 p-3 border rounded-md", isThisCorrect ? "border-green-500 bg-green-500/10" : "border-border bg-card")}>
                  <span className={cn("font-semibold", isThisCorrect ? "text-green-700 dark:text-green-300" : "text-primary")}>{opt.label}.</span>
                  <div className="flex-1 text-sm">
                    {opt.text && (<div className={cn("prose prose-sm dark:prose-invert max-w-none", isThisCorrect && "font-semibold")}>{renderLatex(opt.text)}</div>)}
                    {opt.imageUrl && (<div className="mt-1.5"><NextImage src={opt.imageUrl} alt={`Option ${opt.label}`} width={150} height={80} className="rounded object-contain border" data-ai-hint="option diagram"/></div>)}
                    {!(opt.text || opt.imageUrl) && <p className="text-muted-foreground italic">Option {opt.label} content not available.</p>}
                  </div>
                  {isThisCorrect && <Badge className="ml-auto text-xs bg-green-600 text-white px-2 py-0.5">Correct</Badge>}
                </div>
              );
            })}
          </div>
          {(currentQuestion.displayExplanationText || currentQuestion.displayExplanationImageUrl) && (
            <div className="mt-6 pt-4 border-t border-border">
              <h4 className="text-md font-semibold text-muted-foreground mb-2">Explanation:</h4>
              {currentQuestion.displayExplanationText && (<div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed">{renderLatex(currentQuestion.displayExplanationText)}</div>)}
              {currentQuestion.displayExplanationImageUrl && (<div className="my-3 text-center"><NextImage src={currentQuestion.displayExplanationImageUrl} alt="Explanation Image" width={300} height={200} className="rounded object-contain inline-block border" data-ai-hint="explanation diagram"/></div>)}
            </div>
          )}
          {!(currentQuestion.displayExplanationText || currentQuestion.displayExplanationImageUrl) && (<p className="text-sm text-muted-foreground mt-4 text-center">No explanation available for this question.</p>)}
        </CardContent>
        <CardFooter className="p-4 flex justify-between items-center border-t border-border">
          <Button variant="outline" onClick={handlePreviousQuestion} disabled={currentQuestionIndex === 0}><ChevronLeft className="mr-2 h-4 w-4" /> Previous</Button>
          <Button variant="outline" onClick={handleNextQuestion} disabled={currentQuestionIndex === questions.length - 1 || questions.length === 0}>Next <ChevronRight className="ml-2 h-4 w-4" /></Button>
        </CardFooter>
      </Card>
    </div>
  );
}
