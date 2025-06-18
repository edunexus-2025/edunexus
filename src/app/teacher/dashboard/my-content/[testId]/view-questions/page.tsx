
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
  displayQuestionText?: string; // Normalized
  displayQuestionImageUrl?: string | null; // Normalized
  displayOptions: { label: string; text?: string; imageUrl?: string | null }[];
  displayCorrectOptionLabel: string; // e.g., "A", "B"
  displayExplanationText?: string;
  displayExplanationImageUrl?: string | null;
  difficulty?: 'Easy' | 'Medium' | 'Hard'; // From EduNexus QB
  subject?: string; // From EduNexus QB
  lessonName?: string; // From EduNexus QB (question's own lesson) or Teacher Test Name
  marks?: number;
  source: 'edunexus' | 'teacher';
  // Original collection details if needed for specific operations (like image URL construction)
  originalCollectionId?: string;
  originalCollectionName?: string;
  originalQuestionImageFile?: string | null; // filename for pb.files.getUrl
  originalOptionAImageFile?: string | null;
  originalOptionBImageFile?: string | null;
  originalOptionCImageFile?: string | null;
  originalOptionDImageFile?: string | null;
  originalExplanationImageFile?: string | null;
}

interface ParentTest extends RecordModel {
  testName: string;
  questions_edunexus?: string[];
  questions_teachers?: string[];
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

const getPbFileUrlUtil = (record: {collectionId?: string, collectionName?: string, id: string, [key:string]: any} | null | undefined, fieldName: string): string | null => {
    if (record && record[fieldName] && typeof record[fieldName] === 'string' && record.collectionId && record.collectionName) {
      try { return pb.files.getUrl(record as RecordModel, record[fieldName] as string); }
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
          expand: 'questions_edunexus(id,questionText,questionImage,optionAText,optionAImage,optionBText,optionBImage,optionCText,optionCImage,optionDText,optionDImage,correctOption,explanationText,explanationImage,difficulty,subject,lessonName,marks,collectionId,collectionName),questions_teachers(id,QuestionText,QuestionImage,OptionAText,OptionAImage,OptionBText,OptionBImage,OptionCText,OptionCImage,OptionDText,OptionDImage,CorrectOption,explanationText,explanationImage,subject,LessonName,marks,QBExam,collectionId,collectionName)',
        });
        if (isMounted) {
          setParentTest(fetchedTest);
          let combinedQuestions: DisplayableQuestion[] = [];

          // Process EduNexus QB Questions
          const eduNexusQs = fetchedTest.expand?.questions_edunexus || [];
          eduNexusQs.forEach((q: RecordModel) => {
            combinedQuestions.push({
              ...q,
              id: q.id,
              displayQuestionText: q.questionText,
              displayQuestionImageUrl: getPbFileUrlUtil(q, 'questionImage'),
              displayOptions: [
                { label: 'A', text: q.optionAText, imageUrl: getPbFileUrlUtil(q, 'optionAImage') },
                { label: 'B', text: q.optionBText, imageUrl: getPbFileUrlUtil(q, 'optionBImage') },
                { label: 'C', text: q.optionCText, imageUrl: getPbFileUrlUtil(q, 'optionCImage') },
                { label: 'D', text: q.optionDText, imageUrl: getPbFileUrlUtil(q, 'optionDImage') },
              ],
              displayCorrectOptionLabel: q.correctOption, // e.g., "A"
              displayExplanationText: q.explanationText,
              displayExplanationImageUrl: getPbFileUrlUtil(q, 'explanationImage'),
              source: 'edunexus',
              originalCollectionId: q.collectionId,
              originalCollectionName: q.collectionName,
              originalQuestionImageFile: q.questionImage,
              originalOptionAImageFile: q.optionAImage,
              originalOptionBImageFile: q.optionBImage,
              originalOptionCImageFile: q.optionCImage,
              originalOptionDImageFile: q.optionDImage,
              originalExplanationImageFile: q.explanationImage,
            });
          });

          // Process Teacher's Own QB Questions
          const teacherQs = fetchedTest.expand?.questions_teachers || [];
          teacherQs.forEach((q: RecordModel) => {
            // Note: Teacher question images are URLs already
            combinedQuestions.push({
              ...q,
              id: q.id,
              displayQuestionText: q.QuestionText,
              displayQuestionImageUrl: q.QuestionImage || null, // Direct URL
              displayOptions: [
                { label: 'A', text: q.OptionAText, imageUrl: q.OptionAImage || null },
                { label: 'B', text: q.OptionBText, imageUrl: q.OptionBImage || null },
                { label: 'C', text: q.OptionCText, imageUrl: q.OptionCImage || null },
                { label: 'D', text: q.OptionDText, imageUrl: q.OptionDImage || null },
              ],
              displayCorrectOptionLabel: q.CorrectOption?.replace("Option ", "") || "", // "Option A" -> "A"
              displayExplanationText: q.explanationText, // Using correct field name
              displayExplanationImageUrl: q.explanationImage || null, // Direct URL
              source: 'teacher',
              difficulty: undefined, // Teacher questions don't have difficulty in their schema
              subject: q.subject, // Teacher questions have subject (from QBExam association)
              lessonName: fetchedTest.testName, // Associate with the parent test name
              marks: q.marks,
            });
          });
          
          setQuestions(combinedQuestions);
          if (combinedQuestions.length === 0) {
            setError(`No questions (from EduNexus QB or your QB) are currently linked to "${fetchedTest.testName}". Please use "Add Question" in the test panel.`);
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
    return ( <div className="space-y-6 p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen"><Button variant="outline" size="sm" onClick={() => router.push(Routes.teacherTestPanel(testId))} className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Test Panel</Button><Card className="shadow-lg border-destructive bg-destructive/10 max-w-3xl mx-auto"><CardHeader><CardTitle className="text-destructive flex items-center gap-2"><AlertCircle />Error Loading Questions</CardTitle></CardHeader><CardContent><p>{error}</p></CardContent></Card></div> );
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
                <Badge variant={currentQuestion.source === 'edunexus' ? 'secondary' : 'outline'} className={cn("text-xs", currentQuestion.source === 'teacher' && "border-blue-500 text-blue-600 bg-blue-50")}>
                  {currentQuestion.source === 'edunexus' ? 'EduNexus QB' : 'My QB'}
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
            {currentQuestion.displayQuestionImageUrl && (<div className="my-3 text-center"><NextImage src={currentQuestion.displayQuestionImageUrl} alt="Question Image" width={400} height={300} className="rounded object-contain inline-block border" data-ai-hint="question diagram"/></div>)}
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
                    {opt.imageUrl && (<div className="mt-1.5"><NextImage src={opt.imageUrl} alt={`Option ${opt.label}`} width={150} height={80} className="rounded object-contain border" data-ai-hint="option illustration"/></div>)}
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

