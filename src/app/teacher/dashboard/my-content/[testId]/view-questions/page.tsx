
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

interface ParentTest extends RecordModel {
  testName: string;
  questions_edunexus?: string[]; // Array of EduNexus question_bank IDs
  // No longer expecting questions_teachers for this specific view
}

// Represents a question from the main EduNexus Question Bank
interface EduNexusQuestionRecord extends RecordModel {
  id: string;
  questionText?: string;
  questionImage?: string | null; // Filename
  optionAText?: string;
  optionAImage?: string | null; // Filename
  optionBText?: string;
  optionBImage?: string | null; // Filename
  optionCText?: string;
  optionCImage?: string | null; // Filename
  optionDText?: string;
  optionDImage?: string | null; // Filename
  correctOption: "A" | "B" | "C" | "D";
  explanationText?: string;
  explanationImage?: string | null; // Filename
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  subject?: string;
  lessonName?: string;
  marks?: number;
  collectionId?: string;
  collectionName?: string;
  displayQuestionImageUrl?: string | null;
  displayOptionAImageUrl?: string | null;
  displayOptionBImageUrl?: string | null;
  displayOptionCImageUrl?: string | null;
  displayOptionDImageUrl?: string | null;
  displayExplanationImageUrl?: string | null;
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
      if (part.startsWith('\\begin{') && part.includes('\\end{')) return <BlockMath key={index} math={part} />
    } catch (e) { return <span key={index} className="text-destructive" title="LaTeX Error">{part}</span>; }
    return <span key={index}>{part}</span>;
  });
};

const getPbFileUrl = (record: RecordModel | null | undefined, fieldName: string): string | null => {
    if (record && record[fieldName] && typeof record[fieldName] === 'string' && record.collectionId && record.collectionName) {
      try { return pb.files.getUrl(record, record[fieldName] as string); }
      catch (e) { console.warn(`Error getting URL for ${fieldName} in record ${record.id}:`, e); return null; }
    }
    return null;
};


export default function ViewTestQuestionsPage() {
  const params = useParams();
  const router = useRouter();
  const { teacher, isLoadingTeacher } = useAuth();
  const testId = typeof params.testId === 'string' ? params.testId : '';

  const [parentTest, setParentTest] = useState<ParentTest | null>(null);
  const [questions, setQuestions] = useState<EduNexusQuestionRecord[]>([]); // Only EduNexus questions
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const [isLoadingParentTest, setIsLoadingParentTest] = useState(true);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      if (!testId || isLoadingTeacher) {
        if (isMounted) { setIsLoadingParentTest(false); setIsLoadingQuestions(false); }
        return;
      }
      if (!teacher?.id) {
        if (isMounted) { setError("Teacher not authenticated."); setIsLoadingParentTest(false); setIsLoadingQuestions(false); }
        return;
      }

      if (isMounted) { setIsLoadingParentTest(true); setIsLoadingQuestions(true); setError(null); setQuestions([]); setCurrentQuestionIndex(0); }

      try {
        if (!isMounted) return;
        // Fetch only the questions_edunexus field for IDs, and expand them.
        const fetchedTest = await pb.collection('teacher_tests').getOne<ParentTest>(testId, {
          fields: 'id,testName,questions_edunexus', 
          expand: 'questions_edunexus' 
        });
        if (isMounted) {
          setParentTest(fetchedTest);

          // Only process questions_edunexus
          const eduNexusQuestionRecords = fetchedTest.expand?.questions_edunexus || [];
          const mappedQuestions: EduNexusQuestionRecord[] = eduNexusQuestionRecords.map((q: RecordModel) => ({
            ...q,
            displayQuestionImageUrl: getPbFileUrl(q, 'questionImage'),
            displayOptionAImageUrl: getPbFileUrl(q, 'optionAImage'),
            displayOptionBImageUrl: getPbFileUrl(q, 'optionBImage'),
            displayOptionCImageUrl: getPbFileUrl(q, 'optionCImage'),
            displayOptionDImageUrl: getPbFileUrl(q, 'optionDImage'),
            displayExplanationImageUrl: getPbFileUrl(q, 'explanationImage'),
          }));
          setQuestions(mappedQuestions);
          if (mappedQuestions.length === 0) {
            console.log("ViewTestQuestionsPage: No questions found from 'questions_edunexus' for this test.");
          }
          setIsLoadingQuestions(false);
        } else { return; }
      } catch (err: any) {
        if (isMounted) {
          if (err?.name === 'ClientResponseError' && err?.status === 0) { console.warn('ViewTestQuestionsPage: Fetch parent test details request was cancelled.');
          } else {
            console.error("ViewTestQuestionsPage: Failed to fetch parent test details or EduNexus questions:", err.data || err);
            setError(`Could not load test/question details. Error: ${err.data?.message || err.message}`);
          }
          setIsLoadingQuestions(false);
        }
      } finally {
        if (isMounted) setIsLoadingParentTest(false); 
      }
    };
    if (testId && teacher?.id) { loadData(); } 
    else if (isMounted && !isLoadingTeacher && !teacher?.id) { setError("Teacher not authenticated."); setIsLoadingParentTest(false); setIsLoadingQuestions(false); }
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
  const optionLabels: Array<"A" | "B" | "C" | "D"> = ["A", "B", "C", "D"];


  if (isLoadingParentTest || isLoadingQuestions) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between mb-4"><Skeleton className="h-8 w-32" /><Skeleton className="h-8 w-1/2" /><div className="w-8"></div></div>
        <Card className="shadow-lg"><CardHeader className="p-4 border-b flex justify-between items-center"><Skeleton className="h-6 w-1/4" /><Skeleton className="h-8 w-8 rounded-full" /></CardHeader><CardContent className="p-4 md:p-6 space-y-4"><Skeleton className="h-5 w-1/3" /><Skeleton className="h-20 w-full" />{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</CardContent><CardFooter className="flex justify-between p-4 border-t"><Skeleton className="h-10 w-32" /><Skeleton className="h-10 w-32" /></CardFooter></Card>
      </div>
    );
  }

  if (error) {
    return ( <div className="space-y-6 p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen"><Button variant="outline" size="sm" onClick={() => router.push(Routes.teacherTestPanel(testId))} className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Test Panel</Button><Card className="shadow-lg border-destructive bg-destructive/10 max-w-3xl mx-auto"><CardHeader><CardTitle className="text-destructive flex items-center gap-2"><AlertCircle />Error Loading Questions</CardTitle></CardHeader><CardContent><p>{error}</p></CardContent></Card></div> );
  }

  if (!currentQuestion && !isLoadingParentTest && !isLoadingQuestions && questions.length === 0) {
    return ( <div className="space-y-6 p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen"><Button variant="outline" size="sm" onClick={() => router.push(Routes.teacherTestPanel(testId))} className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Test Panel</Button><Card className="text-center p-10 shadow-md max-w-3xl mx-auto"><CardHeader><AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-3" /><CardTitle>No Questions Found</CardTitle></CardHeader><CardContent><CardDescription>No questions from the EduNexus Question Bank are currently linked to "{parentTest?.testName || 'this test'}". You can add them from the "Add Question" section in the test panel.</CardDescription></CardContent></Card></div> );
  }
  if (!currentQuestion) {
    return ( <div className="space-y-6 p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen"><Button variant="outline" size="sm" onClick={() => router.push(Routes.teacherTestPanel(testId))} className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Test Panel</Button><Card className="text-center p-10 shadow-md max-w-3xl mx-auto"><CardContent><p>Question not available or index out of bounds.</p></CardContent></Card></div>);
  }
  
  return (
    <div className="space-y-6 p-2 sm:p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="flex items-center justify-between mb-4 max-w-3xl mx-auto">
        <Button variant="outline" size="sm" onClick={() => router.push(Routes.teacherTestPanel(testId))}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Test Panel</Button>
        <h1 className="text-lg md:text-xl font-semibold text-center text-foreground flex-grow truncate px-2">Viewing EduNexus QB Questions for: <span className="text-primary">{parentTest?.testName || "Test"}</span></h1>
        <div className="w-24 sm:w-32"> {/* Spacer */} </div>
      </div>
      <Card className="max-w-3xl mx-auto shadow-xl border border-border rounded-lg overflow-hidden">
        <CardHeader className="p-4 bg-card border-b border-border"><div className="flex justify-between items-center"><p className="text-sm font-medium text-muted-foreground">Question {currentQuestionIndex + 1} of {questions.length}</p></div></CardHeader>
        <CardContent className="p-4 md:p-6 space-y-6">
          <div className="p-3 border-b border-border rounded-md bg-background">
            {currentQuestion.questionText && (<div className="prose prose-sm dark:prose-invert max-w-none mb-4 text-foreground leading-relaxed">{renderLatex(currentQuestion.questionText)}</div>)}
            {currentQuestion.displayQuestionImageUrl && (<div className="my-3 text-center"><NextImage src={currentQuestion.displayQuestionImageUrl} alt="Question Image" width={400} height={300} className="rounded object-contain inline-block border" data-ai-hint="question diagram"/></div>)}
            {!(currentQuestion.questionText || currentQuestion.displayQuestionImageUrl) && (<p className="text-sm text-muted-foreground italic">No question text or image provided.</p>)}
          </div>
          <div className="space-y-3">
            <h4 className="text-md font-semibold text-muted-foreground">Options:</h4>
            {optionLabels.map((optChar) => {
              const textKey = `option${optChar}Text` as keyof EduNexusQuestionRecord;
              const imageKey = `displayOption${optChar}ImageUrl` as keyof EduNexusQuestionRecord;
              const isThisCorrect = currentQuestion.correctOption === optChar;
              return (
                <div key={optChar} className={cn("flex items-start gap-3 p-3 border rounded-md", isThisCorrect ? "border-green-500 bg-green-500/10" : "border-border bg-card")}>
                  <span className={cn("font-semibold", isThisCorrect ? "text-green-700 dark:text-green-300" : "text-primary")}>{optChar}.</span>
                  <div className="flex-1 text-sm">
                    {currentQuestion[textKey] && (<div className={cn("prose prose-sm dark:prose-invert max-w-none", isThisCorrect && "font-semibold")}>{renderLatex(currentQuestion[textKey] as string)}</div>)}
                    {currentQuestion[imageKey] && (<div className="mt-1.5"><NextImage src={currentQuestion[imageKey] as string} alt={`Option ${optChar}`} width={150} height={80} className="rounded object-contain border" data-ai-hint="option illustration"/></div>)}
                    {!(currentQuestion[textKey] || currentQuestion[imageKey]) && <p className="text-muted-foreground italic">Option {optChar} content not available.</p>}
                  </div>
                  {isThisCorrect && <Badge className="ml-auto text-xs bg-green-600 text-white px-2 py-0.5">Correct</Badge>}
                </div>
              );
            })}
          </div>
          {(currentQuestion.explanationText || currentQuestion.displayExplanationImageUrl) && (
            <div className="mt-6 pt-4 border-t border-border">
              <h4 className="text-md font-semibold text-muted-foreground mb-2">Explanation:</h4>
              {currentQuestion.explanationText && (<div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed">{renderLatex(currentQuestion.explanationText)}</div>)}
              {currentQuestion.displayExplanationImageUrl && (<div className="my-3 text-center"><NextImage src={currentQuestion.displayExplanationImageUrl} alt="Explanation Image" width={300} height={200} className="rounded object-contain inline-block border" data-ai-hint="explanation diagram"/></div>)}
            </div>
          )}
          {!(currentQuestion.explanationText || currentQuestion.displayExplanationImageUrl) && (<p className="text-sm text-muted-foreground mt-4 text-center">No explanation available for this question.</p>)}
        </CardContent>
        <CardFooter className="p-4 flex justify-between items-center border-t border-border">
          <Button variant="outline" onClick={handlePreviousQuestion} disabled={currentQuestionIndex === 0}><ChevronLeft className="mr-2 h-4 w-4" /> Previous</Button>
          <Button variant="outline" onClick={handleNextQuestion} disabled={currentQuestionIndex === questions.length - 1 || questions.length === 0}>Next <ChevronRight className="ml-2 h-4 w-4" /></Button>
        </CardFooter>
      </Card>
    </div>
  );
}
