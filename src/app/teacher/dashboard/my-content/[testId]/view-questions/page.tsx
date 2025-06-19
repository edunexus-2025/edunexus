
'use client';

import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState, useCallback } from 'react';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Eye as EyeIcon, Info, ListChecks, PlusCircle, Trash2, Edit2, Loader2, MessageSquare, NotebookText, ListOrdered, ChevronLeft, ChevronRight } from 'lucide-react';
import NextImage from 'next/image';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { QuestionPreviewModal } from '@/components/admin/QuestionPreviewModal'; // Assuming this can be reused or adapted

// More detailed interface for displaying full question details
interface DisplayableQuestionDetailed {
  id: string;
  source: 'EduNexus QB' | 'My QB';
  questionText?: string | null;
  questionImageUrl?: string | null; // Resolved URL
  options: Array<{
    label: 'A' | 'B' | 'C' | 'D';
    text?: string | null;
    imageUrl?: string | null; // Resolved URL
  }>;
  correctOptionLabel: 'A' | 'B' | 'C' | 'D' | string; // Can be 'Option A' from My QB
  explanationText?: string | null;
  explanationImageUrl?: string | null; // Resolved URL
  difficulty?: 'Easy' | 'Medium' | 'Hard' | null;
  subject?: string | null;
  lessonName?: string | null;
  marks?: number;
  rawRecord: RecordModel;
  // Fields needed for pb.files.getUrl for question_bank source
  collectionId?: string;
  collectionName?: string;
  questionImage_filename?: string; // For question_bank image
  optionAImage_filename?: string;
  optionBImage_filename?: string;
  optionCImage_filename?: string;
  optionDImage_filename?: string;
  explanationImage_filename?: string;
  // Direct URL fields from teacher_question_data
  QuestionImage_direct?: string | null;
  OptionAImage_direct?: string | null;
  OptionBImage_direct?: string | null;
  OptionCImage_direct?: string | null;
  OptionDImage_direct?: string | null;
  explanationImage_direct?: string | null;
}


const isValidHttpUrl = (string: string | null | undefined): string is string => {
  if (!string || typeof string !== 'string') return false;
  try { const url = new URL(string); return url.protocol === "http:" || url.protocol === "https:"; }
  catch (_) { return false; }
};

const getPbFileUrlOrDirectUrl = (record: RecordModel | null | undefined, fieldName: string, isDirectUrlField: boolean = false): string | null => {
    if (!record) return null;
    const fieldValue = record[fieldName] as string | undefined | null;
    if (!fieldValue || typeof fieldValue !== 'string' || !fieldValue.trim()) return null;

    if (isDirectUrlField) {
      if (isValidHttpUrl(fieldValue)) return fieldValue;
      return null;
    } else {
      if (record.id && record.collectionId && record.collectionName) {
        try {
          const minimalRecordForPb = { id: record.id, collectionId: record.collectionId, collectionName: record.collectionName, [fieldName]: fieldValue };
          return pb.files.getUrl(minimalRecordForPb as RecordModel, fieldValue);
        } catch (e) { console.warn(`ViewQuestionsDetailed: Error getting PB file URL for ${fieldName} in record ${record.id}:`, e); return null; }
      }
      console.error(`ViewQuestionsDetailed: Missing collectionId/Name for PB file field '${fieldName}' in record '${record.id}'.`);
      return null;
    }
};

const renderLatexDetailed = (text: string | undefined | null): React.ReactNode => {
  if (!text) return null;
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$.*?\$|\\\(.*?\\\)|\\\[.*?\\\]|\\begin\{.*?\}[\s\S]*?\\end\{.*?\})/g);
  return parts.map((part, index) => {
    try {
      if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) { return <BlockMath key={index} math={part.substring(2, part.length - 2)} />; }
      if (part.startsWith('$') && part.endsWith('$') && part.length > 2) { return <InlineMath key={index} math={part.substring(1, part.length - 1)} />; }
      if (part.startsWith('\\(') && part.endsWith('\\)')) { return <InlineMath key={index} math={part.substring(2, part.length - 2)} />; }
      if (part.startsWith('\\[') && part.endsWith('\\]')) { return <BlockMath key={index} math={part.substring(2, part.length - 2)} />; }
      if (part.startsWith('\\begin{') && part.includes('\\end{')) { const envMatch = part.match(/^\\begin\{(.*?)\}/); if (envMatch && ['equation', 'align', 'gather', 'matrix', 'pmatrix', 'bmatrix', 'vmatrix', 'Vmatrix', 'cases', 'array', 'subequations'].includes(envMatch[1])) { return <BlockMath key={index} math={part} /> }}
    } catch (e) { return <span key={index} className="text-destructive" title="LaTeX Error">{part}</span>; }
    return <span key={index}>{part}</span>;
  });
};


export default function ViewTestQuestionsDetailedPage() {
  const params = useParams();
  const { teacher } = useAuth();
  const testId = typeof params.testId === 'string' ? params.testId : '';

  const [testName, setTestName] = useState<string | null>(null);
  const [questions, setQuestions] = useState<DisplayableQuestionDetailed[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  const currentQuestionForDisplay = questions[currentQuestionIndex];

  const fetchTestAndQuestionsDetailed = useCallback(async (isMountedGetter: () => boolean) => {
    if (!testId || !teacher?.id) { if (isMountedGetter()) { setIsLoading(false); setError(testId ? "Auth error." : "Test ID missing."); } return; }
    if (isMountedGetter()) setIsLoading(true);

    try {
      const fetchedTest = await pb.collection('teacher_tests').getOne(testId, {
        expand: 'questions_edunexus(id,questionText,questionImage,optionAText,optionAImage,optionBText,optionBImage,optionCText,optionCImage,optionDText,optionDImage,correctOption,explanationText,explanationImage,difficulty,subject,lessonName,marks,collectionId,collectionName),questions_teachers(id,QuestionText,QuestionImage,OptionAText,OptionAImage,OptionBText,OptionBImage,OptionCText,OptionCImage,OptionDText,OptionDImage,CorrectOption,explanationText,explanationImage,subject,LessonName,marks,difficulty,QBExam)',
      });

      if (!isMountedGetter()) return;
      if (fetchedTest.teacherId !== teacher.id) { if (isMountedGetter()) { setError("Unauthorized to view this test."); setIsLoading(false); } return; }
      setTestName(fetchedTest.testName || 'Untitled Test');

      const combinedQuestions: DisplayableQuestionDetailed[] = [];

      (fetchedTest.expand?.questions_edunexus || []).forEach((q: RecordModel) => {
        combinedQuestions.push({
          id: q.id, source: 'EduNexus QB',
          questionText: q.questionText,
          questionImageUrl: getPbFileUrlOrDirectUrl(q, 'questionImage', false),
          options: [
            { label: 'A', text: q.optionAText, imageUrl: getPbFileUrlOrDirectUrl(q, 'optionAImage', false) },
            { label: 'B', text: q.optionBText, imageUrl: getPbFileUrlOrDirectUrl(q, 'optionBImage', false) },
            { label: 'C', text: q.optionCText, imageUrl: getPbFileUrlOrDirectUrl(q, 'optionCImage', false) },
            { label: 'D', text: q.optionDText, imageUrl: getPbFileUrlOrDirectUrl(q, 'optionDImage', false) },
          ],
          correctOptionLabel: q.correctOption,
          explanationText: q.explanationText,
          explanationImageUrl: getPbFileUrlOrDirectUrl(q, 'explanationImage', false),
          difficulty: q.difficulty, subject: q.subject, lessonName: q.lessonName, marks: q.marks, rawRecord: q,
          collectionId: q.collectionId, collectionName: q.collectionName,
          questionImage_filename: q.questionImage,
          optionAImage_filename: q.optionAImage, optionBImage_filename: q.optionBImage, optionCImage_filename: q.optionCImage, optionDImage_filename: q.optionDImage,
          explanationImage_filename: q.explanationImage,
        });
      });

      (fetchedTest.expand?.questions_teachers || []).forEach((q: RecordModel) => {
        combinedQuestions.push({
          id: q.id, source: 'My QB',
          questionText: q.QuestionText,
          questionImageUrl: getPbFileUrlOrDirectUrl(q, 'QuestionImage', true),
          options: [
            { label: 'A', text: q.OptionAText, imageUrl: getPbFileUrlOrDirectUrl(q, 'OptionAImage', true) },
            { label: 'B', text: q.OptionBText, imageUrl: getPbFileUrlOrDirectUrl(q, 'OptionBImage', true) },
            { label: 'C', text: q.OptionCText, imageUrl: getPbFileUrlOrDirectUrl(q, 'OptionCImage', true) },
            { label: 'D', text: q.OptionDText, imageUrl: getPbFileUrlOrDirectUrl(q, 'OptionDImage', true) },
          ],
          correctOptionLabel: q.CorrectOption?.replace("Option ", "") || "N/A",
          explanationText: q.explanationText,
          explanationImageUrl: getPbFileUrlOrDirectUrl(q, 'explanationImage', true),
          difficulty: q.difficulty, subject: q.subject || fetchedTest.QBExam, lessonName: fetchedTest.testName, marks: q.marks, rawRecord: q,
          QuestionText: q.QuestionText, QuestionImage_direct: q.QuestionImage,
          OptionAText: q.OptionAText, OptionAImage_direct: q.OptionAImage,
          OptionBText: q.OptionBText, OptionBImage_direct: q.OptionBImage,
          OptionCText: q.OptionCText, OptionCImage_direct: q.OptionCImage,
          OptionDText: q.OptionDText, OptionDImage_direct: q.OptionDImage,
          CorrectOption: q.CorrectOption, explanationImage_direct: q.explanationImage,
        });
      });
      if (isMountedGetter()) {
        if (combinedQuestions.length === 0) { setError(`No questions are linked to "${fetchedTest.testName}". Please add questions via the "Add Questions" tab.`); }
        setQuestions(combinedQuestions);
      }
    } catch (err: any) { if (isMountedGetter()) { const clientError = err as ClientResponseError; if (clientError?.isAbort || (clientError?.name === 'ClientResponseError' && clientError?.status === 0)) { console.warn('ViewTestQuestionsDetailed: Fetch test questions request was cancelled.'); } else { console.error("Error fetching test questions for detailed view:", clientError.data || clientError); setError(`Could not load questions. Error: ${clientError.data?.message || clientError.message}`); }}}
    finally { if (isMountedGetter()) setIsLoading(false); }
  }, [testId, teacher?.id]);

  useEffect(() => { let isMounted = true; fetchTestAndQuestionsDetailed(() => isMounted); return () => { isMounted = false; }; }, [fetchTestAndQuestionsDetailed]);

  const navigateQuestion = (newIndex: number) => { setCurrentQuestionIndex(Math.max(0, Math.min(questions.length - 1, newIndex))); };
  const questionPaletteButtonClass = (isActive: boolean) => isActive ? "bg-primary text-primary-foreground border-primary ring-2 ring-offset-1 ring-primary" : "bg-card hover:bg-muted/80 text-muted-foreground border-border";

  const QuestionPaletteContent = () => (
    <Card className="border-primary/30 bg-primary/5 flex-1 flex flex-col min-h-0 shadow-md rounded-lg md:mt-0">
      <CardHeader className="p-2 text-center border-b border-primary/20"><CardTitle className="text-sm text-primary">QUESTIONS ({questions.length})</CardTitle></CardHeader>
      <CardContent className="p-2 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="grid grid-cols-5 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 gap-1.5 p-1">
            {questions.map((q, index) => (
              <Button key={q.id} variant="outline" size="icon" className={cn("h-8 w-full text-xs rounded-md aspect-square", questionPaletteButtonClass(currentQuestionIndex === index))} onClick={() => { navigateQuestion(index); if (isMobileSheetOpen) setIsMobileSheetOpen(false); }} aria-label={`Go to question ${index + 1}`}>
                {index + 1}
              </Button>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );

  if (isLoading) { return (<div className="p-6 space-y-4"><Skeleton className="h-8 w-3/4 mb-2" /><Skeleton className="h-64 w-full" /></div>); }
  if (error) { return (<Card className="text-center border-destructive bg-destructive/10 p-6"><AlertCircle className="mx-auto h-10 w-10 text-destructive mb-3" /><CardTitle className="text-destructive">Error</CardTitle><CardDescription className="text-destructive/80 whitespace-pre-wrap">{error}</CardDescription></Card>); }

  return (
    <div className="p-2 sm:p-4 md:p-6 h-[calc(100vh-var(--header-height,0px)-var(--tabs-height,0px)-theme(space.12))] flex flex-col">
      <CardHeader className="px-0 pb-3 flex-shrink-0">
        <CardTitle className="text-xl font-semibold flex items-center gap-2"><EyeIcon className="h-5 w-5 text-primary"/> View Questions for: {testName}</CardTitle>
        <CardDescription>Review full question details, options, and explanations. Total: {questions.length} question(s).</CardDescription>
      </CardHeader>

      {questions.length === 0 ? (
          <div className="flex-grow flex flex-col items-center justify-center text-center py-10 border-2 border-dashed rounded-lg bg-card">
            <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No questions currently in this test.</p>
            <Button asChild variant="link" className="mt-2"><Link href={Routes.teacherTestPanelAddQuestion(testId)}>Add Questions Now</Link></Button>
          </div>
        ) : (
        <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden min-h-0">
          <Card className="flex-1 flex flex-col bg-card shadow-md rounded-lg border border-border overflow-hidden">
            <CardHeader className="p-3 sm:p-4 border-b border-border bg-muted/30 flex-shrink-0">
              <div className="flex justify-between items-center">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Question {currentQuestionIndex + 1} of {questions.length}</p>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-xs px-1.5 py-0.5">{currentQuestionForDisplay.source}</Badge>
                  {currentQuestionForDisplay.difficulty && <Badge variant={currentQuestionForDisplay.difficulty === 'Easy' ? 'secondary' : currentQuestionForDisplay.difficulty === 'Medium' ? 'default' : 'destructive'} className="text-xs px-1.5 py-0.5">{currentQuestionForDisplay.difficulty}</Badge>}
                  {currentQuestionForDisplay.marks !== undefined && <Badge variant="outline" className="text-xs px-1.5 py-0.5">Marks: {currentQuestionForDisplay.marks}</Badge>}
                </div>
              </div>
            </CardHeader>
            <ScrollArea className="flex-1 min-h-0">
              <CardContent className="p-3 sm:p-4 md:p-6 space-y-4">
                <div className="p-2 border-b border-border/50 rounded-md bg-background min-h-[60px]">
                  {currentQuestionForDisplay.questionText && (<div className="prose prose-sm dark:prose-invert max-w-none mb-3 text-foreground leading-relaxed">{renderLatexDetailed(currentQuestionForDisplay.questionText)}</div>)}
                  {currentQuestionForDisplay.questionImageUrl && (<div className="my-2 text-center"><NextImage src={currentQuestionForDisplay.questionImageUrl} alt="Question Image" width={400} height={300} className="rounded object-contain inline-block border max-h-80" data-ai-hint="question diagram"/></div>)}
                  {!(currentQuestionForDisplay.questionText || currentQuestionForDisplay.questionImageUrl) && (<p className="text-xs sm:text-sm text-muted-foreground italic py-3">Question content not provided.</p>)}
                </div>
                <div className="space-y-2.5">
                  {currentQuestionForDisplay.options.map(opt => {
                    const isCorrect = opt.label === currentQuestionForDisplay.correctOptionLabel || `Option ${opt.label}` === currentQuestionForDisplay.correctOptionLabel;
                    return (
                      <div key={opt.label} className={cn("p-3 border rounded-md flex items-start gap-3", isCorrect ? "bg-green-500/10 border-green-500/50 text-green-700 dark:text-green-300" : "bg-card border-border")}>
                        <span className={cn("font-semibold", isCorrect ? "text-green-700 dark:text-green-300" : "text-primary")}>{opt.label}.</span>
                        <div className={cn("flex-1 text-sm", isCorrect ? "text-green-700 dark:text-green-300" : "text-foreground")}>
                          {(opt.text || opt.imageUrl) ? (<>{opt.text && <div className="prose prose-sm dark:prose-invert max-w-none">{renderLatexDetailed(opt.text)}</div>}{opt.imageUrl && <div className="mt-1.5"><NextImage src={opt.imageUrl} alt={`Option ${opt.label}`} width={150} height={80} className="rounded object-contain border" data-ai-hint="option illustration"/></div>}</>) : (<p className="italic">Option {opt.label} content not available.</p>)}
                        </div>
                        {isCorrect && <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />}
                      </div>
                    );
                  })}
                </div>
                {(currentQuestionForDisplay.explanationText || currentQuestionForDisplay.explanationImageUrl) && (
                  <div className="mt-6 pt-4 border-t">
                    <h4 className="text-md font-semibold text-muted-foreground mb-2">Explanation:</h4>
                    {currentQuestionForDisplay.explanationText && <div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed">{renderLatexDetailed(currentQuestionForDisplay.explanationText)}</div>}
                    {currentQuestionForDisplay.explanationImageUrl && <div className="my-3 text-center"><NextImage src={currentQuestionForDisplay.explanationImageUrl} alt="Explanation Image" width={300} height={200} className="rounded object-contain inline-block border max-h-72" data-ai-hint="explanation diagram"/></div>}
                  </div>
                )}
                {!(currentQuestionForDisplay.explanationText || currentQuestionForDisplay.explanationImageUrl) && <p className="text-sm text-muted-foreground mt-4 text-center italic">No explanation available for this question.</p>}
              </CardContent>
            </ScrollArea>
            <CardFooter className="p-3 sm:p-4 border-t border-border bg-muted/30 flex-wrap justify-between items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigateQuestion(currentQuestionIndex - 1)} disabled={currentQuestionIndex === 0}><ChevronLeft className="mr-1.5 h-4 w-4" /> Previous</Button>
              <Button variant="outline" size="sm" onClick={() => navigateQuestion(currentQuestionIndex + 1)} disabled={currentQuestionIndex === questions.length - 1}>Next <ChevronRight className="ml-1.5 h-4 w-4" /></Button>
            </CardFooter>
          </Card>

          {isRightSidebarOpen && ( <div className="hidden md:flex w-64 lg:w-72 flex-shrink-0 flex-col space-y-0"> <QuestionPaletteContent /> </div> )}
        </div>
      )}
    </div>
  );
}

    
    