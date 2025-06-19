
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
import { AlertCircle, Eye as EyeIcon, Info, ListChecks, PlusCircle, Trash2, Edit2, Loader2, MessageSquare } from 'lucide-react';
import NextImage from 'next/image';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { Routes } from '@/lib/constants';
import { QuestionPreviewModal } from '@/components/admin/QuestionPreviewModal'; 

interface DisplayableQuestion {
  id: string;
  text?: string | null;
  imageUrl?: string | null;
  options: Array<{ label: string; text?: string | null; imageUrl?: string | null; }>;
  correctOptionLabel: string;
  explanationText?: string | null;
  explanationImageUrl?: string | null;
  difficulty?: 'Easy' | 'Medium' | 'Hard' | null;
  subject?: string | null;
  lessonName?: string | null;
  source: 'EduNexus QB' | 'My QB';
  marks?: number;
  rawRecord: RecordModel;
  collectionId?: string;
  collectionName?: string;
  questionImage_filename?: string | null; 
  // Fields for teacher_question_data specifically if needed for display or operations
  QuestionText?: string; QuestionImage?: string | null; // direct URL
  OptionAText?: string; OptionAImage?: string | null;
  OptionBText?: string; OptionBImage?: string | null;
  OptionCText?: string; OptionCImage?: string | null;
  OptionDText?: string; OptionDImage?: string | null;
  CorrectOption?: "Option A" | "Option B" | "Option C" | "Option D";
  explanationImage_direct?: string | null;
}

const isValidHttpUrl = (string: string | null | undefined): string is string => {
  if (!string || typeof string !== 'string') return false;
  try { const url = new URL(string); return url.protocol === "http:" || url.protocol === "https:"; }
  catch (_) { return false; }
};

const getPbFileUrlOrDirectUrl = (record: RecordModel | null | undefined, fieldName: string, isDirectUrlField: boolean = false): string | null => {
    if (!record) return null;
    if (!record[fieldName] || typeof record[fieldName] !== 'string') return null;
    const fieldValue = (record[fieldName] as string).trim();
    if (!fieldValue) return null;

    if (isDirectUrlField) {
      if (isValidHttpUrl(fieldValue)) return fieldValue;
      return null;
    } else {
      if (typeof record.id === 'string' && record.id.trim() !== '' &&
          typeof record.collectionId === 'string' && record.collectionId.trim() !== '' &&
          typeof record.collectionName === 'string' && record.collectionName.trim() !== '') {
        try {
          const minimalRecordForPb = { id: record.id, collectionId: record.collectionId, collectionName: record.collectionName, [fieldName]: fieldValue };
          return pb.files.getUrl(minimalRecordForPb as RecordModel, fieldValue);
        } catch (e) { console.warn(`ViewTestQuestionsPage: Error getting PB file URL for ${fieldName} in record ${record.id}:`, e); return null; }
      }
      console.error(`ViewTestQuestionsPage: CRITICAL - Missing collectionId/collectionName for PB file field '${fieldName}' in record ID '${record.id}'.`);
      return null;
    }
};

const renderLatexSnippet = (text: string | undefined | null, maxLength: number = 70): React.ReactNode => {
  if (!text) return <span className="italic text-xs text-muted-foreground">No text.</span>;
  const snippet = text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  const parts = snippet.split(/(\$\$[\s\S]*?\$\$|\$.*?\$|\\\(.*?\\\)|\\\[.*?\\\])/g); // Added escaped parenthesis for LaTeX
  return parts.map((part, index) => {
    try {
      if (part.startsWith('$$') && part.endsWith('$$')) return <BlockMath key={index} math={part.substring(2, part.length - 2)} />;
      if (part.startsWith('$') && part.endsWith('$')) return <InlineMath key={index} math={part.substring(1, part.length - 1)} />;
      if (part.startsWith('\\(') && part.endsWith('\\)')) return <InlineMath key={index} math={part.substring(2, part.length - 2)} />;
      if (part.startsWith('\\[') && part.endsWith('\\]')) return <BlockMath key={index} math={part.substring(2, part.length - 2)} />;
    } catch (e) { return <span key={index} className="text-destructive text-xs" title="LaTeX Error">{part}</span>; }
    return <span key={index} className="text-xs">{part}</span>;
  });
};


export default function ViewTestQuestionsPage() {
  const params = useParams();
  const { teacher } = useAuth();
  const { toast } = useToast();
  const testId = typeof params.testId === 'string' ? params.testId : '';

  const [testName, setTestName] = useState<string | null>(null);
  const [questions, setQuestions] = useState<DisplayableQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [currentPreviewQuestion, setCurrentPreviewQuestion] = useState<DisplayableQuestion | null>(null);


  const fetchTestAndQuestions = useCallback(async (isMountedGetter: () => boolean) => {
    if (!testId || !teacher?.id) { if (isMountedGetter()) { setIsLoading(false); setError(testId ? "Auth error." : "Test ID missing."); } return; }
    if (isMountedGetter()) setIsLoading(true);

    try {
      const fetchedTest = await pb.collection('teacher_tests').getOne(testId, {
        expand: 'questions_edunexus(id,questionText,questionImage,optionAText,optionAImage,optionBText,optionBImage,optionCText,optionCImage,optionDText,optionDImage,correctOption,explanationText,explanationImage,difficulty,subject,lessonName,marks,collectionId,collectionName),questions_teachers(id,QuestionText,QuestionImage,OptionAText,OptionAImage,OptionBText,OptionBImage,OptionCText,OptionCImage,OptionDText,OptionDImage,CorrectOption,explanationText,explanationImage,subject,LessonName,marks,difficulty,QBExam)',
      });

      if (!isMountedGetter()) return;
      if (fetchedTest.teacherId !== teacher.id) { if (isMountedGetter()) setError("Unauthorized."); return; }
      setTestName(fetchedTest.testName || 'Untitled Test');

      const combinedQuestions: DisplayableQuestion[] = [];

      (fetchedTest.expand?.questions_edunexus || []).forEach((q: RecordModel) => {
        combinedQuestions.push({
          id: q.id, text: q.questionText, imageUrl: getPbFileUrlOrDirectUrl(q, 'questionImage', false),
          options: [
            { label: 'A', text: q.optionAText, imageUrl: getPbFileUrlOrDirectUrl(q, 'optionAImage', false) },
            { label: 'B', text: q.optionBText, imageUrl: getPbFileUrlOrDirectUrl(q, 'optionBImage', false) },
            { label: 'C', text: q.optionCText, imageUrl: getPbFileUrlOrDirectUrl(q, 'optionCImage', false) },
            { label: 'D', text: q.optionDText, imageUrl: getPbFileUrlOrDirectUrl(q, 'optionDImage', false) },
          ],
          correctOptionLabel: q.correctOption, explanationText: q.explanationText, explanationImageUrl: getPbFileUrlOrDirectUrl(q, 'explanationImage', false),
          difficulty: q.difficulty, subject: q.subject, lessonName: q.lessonName, source: 'EduNexus QB', marks: q.marks, rawRecord: q,
          collectionId: q.collectionId, collectionName: q.collectionName, questionImage_filename: q.questionImage,
        });
      });

      (fetchedTest.expand?.questions_teachers || []).forEach((q: RecordModel) => {
        combinedQuestions.push({
          id: q.id, text: q.QuestionText, imageUrl: getPbFileUrlOrDirectUrl(q, 'QuestionImage', true),
          options: [
            { label: 'A', text: q.OptionAText, imageUrl: getPbFileUrlOrDirectUrl(q, 'OptionAImage', true) },
            { label: 'B', text: q.OptionBText, imageUrl: getPbFileUrlOrDirectUrl(q, 'OptionBImage', true) },
            { label: 'C', text: q.OptionCText, imageUrl: getPbFileUrlOrDirectUrl(q, 'OptionCImage', true) },
            { label: 'D', text: q.OptionDText, imageUrl: getPbFileUrlOrDirectUrl(q, 'OptionDImage', true) },
          ],
          correctOptionLabel: q.CorrectOption?.replace("Option ", "") as DisplayableQuestion['correctOptionLabel'],
          explanationText: q.explanationText, explanationImageUrl: getPbFileUrlOrDirectUrl(q, 'explanationImage', true),
          difficulty: q.difficulty, subject: q.subject || fetchedTest.QBExam, lessonName: fetchedTest.testName,
          source: 'My QB', marks: q.marks, rawRecord: q,
          QuestionText: q.QuestionText, QuestionImage: q.QuestionImage, OptionAText: q.OptionAText, OptionAImage: q.OptionAImage,
          OptionBText: q.OptionBText, OptionBImage: q.OptionBImage, OptionCText: q.OptionCText, OptionCImage: q.OptionCImage,
          OptionDText: q.OptionDText, OptionDImage: q.OptionDImage, CorrectOption: q.CorrectOption, explanationImage_direct: q.explanationImage,
        });
      });
      if (isMountedGetter()) setQuestions(combinedQuestions);

    } catch (err: any) { if (isMountedGetter()) { const clientError = err as ClientResponseError; if (clientError?.isAbort || (clientError?.name === 'ClientResponseError' && clientError?.status === 0)) { console.warn('ViewTestQuestionsPage: Fetch test questions request was cancelled.'); } else { console.error("Error fetching test questions:", clientError.data || clientError); setError(`Could not load questions. Error: ${clientError.data?.message || clientError.message}`); }}}
    finally { if (isMountedGetter()) setIsLoading(false); }
  }, [testId, teacher?.id]);

  useEffect(() => { let isMounted = true; fetchTestAndQuestions(() => isMounted); return () => { isMounted = false; }; }, [fetchTestAndQuestions]);

  const handleRemoveQuestion = async (questionId: string, source: 'EduNexus QB' | 'My QB') => {
    if (!testId) return;
    setIsUpdating(true);
    const fieldToUpdate = source === 'EduNexus QB' ? 'questions_edunexus' : 'questions_teachers';
    try {
      await pb.collection('teacher_tests').update(testId, { [`${fieldToUpdate}-`]: questionId });
      toast({ title: "Question Removed", description: "Question removed from this test." });
      fetchTestAndQuestions(() => true);
    } catch (error: any) { toast({ title: "Error Removing Question", description: error.message, variant: "destructive" });
    } finally { setIsUpdating(false); }
  };
  
  const openPreview = (question: DisplayableQuestion) => {
    const modalQuestionData = {
      id: question.id,
      questionText: question.text,
      questionImage: question.source === 'EduNexus QB' ? question.questionImage_filename : question.imageUrl,
      optionAText: question.options.find(o => o.label === 'A')?.text,
      optionBText: question.options.find(o => o.label === 'B')?.text,
      optionCText: question.options.find(o => o.label === 'C')?.text,
      optionDText: question.options.find(o => o.label === 'D')?.text,
      difficulty: question.difficulty,
      marks: question.marks,
      collectionId: question.source === 'EduNexus QB' ? question.collectionId : undefined,
      collectionName: question.source === 'EduNexus QB' ? question.collectionName : undefined,
    };
    setCurrentPreviewQuestion(modalQuestionData as any); 
    setIsPreviewModalOpen(true);
  };


  if (isLoading) { return (<div className="p-6 space-y-4"><Skeleton className="h-8 w-3/4 mb-2" /><Skeleton className="h-64 w-full" /></div>); }
  if (error) { return (<Card className="text-center border-destructive bg-destructive/10 p-6"><AlertCircle className="mx-auto h-10 w-10 text-destructive mb-3" /><CardTitle className="text-destructive">Error</CardTitle><CardDescription className="text-destructive/80">{error}</CardDescription></Card>); }

  return (
    <div className="p-4 md:p-6">
      <CardHeader className="px-0 pb-4">
        <CardTitle className="text-xl font-semibold flex items-center gap-2"><ListChecks className="h-5 w-5 text-primary"/>Questions for: {testName}</CardTitle>
        <CardDescription>
          Review and manage questions in this test. Total: {questions.length} question(s).
           <Link href={Routes.teacherTestPanelAddQuestion(testId)} className="ml-2 text-sm text-primary hover:underline font-medium inline-flex items-center gap-1">
            <PlusCircle size={14}/> Add More Questions
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-0">
        {questions.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed rounded-lg">
            <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No questions added yet. Go to "Add Questions" tab.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[calc(100vh-350px)] pr-2">
            <div className="space-y-2">
              {questions.map((q, index) => (
                <Card key={q.id} className="p-2.5 flex items-start justify-between gap-2 bg-card hover:shadow-sm">
                  <div className="flex items-start gap-2 flex-grow min-w-0">
                    <span className="text-xs font-medium text-muted-foreground pt-0.5">{index + 1}.</span>
                    <div className="min-w-0">
                      {q.imageUrl && <div className="mb-1 w-16 h-10 relative cursor-pointer" onClick={() => openPreview(q)}><NextImage src={q.imageUrl} alt="Q thumb" layout="fill" objectFit="contain" className="rounded border bg-muted" data-ai-hint="illustration diagram"/></div>}
                      <div className="text-xs text-foreground line-clamp-2 prose prose-xs dark:prose-invert max-w-none cursor-pointer hover:text-primary" onClick={() => openPreview(q)} title={q.text || 'View Question'}>
                          {renderLatexSnippet(q.text, 120)}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        <Badge variant="outline" className="px-1 py-0 text-[9px]">{q.source}</Badge>
                        {q.difficulty && <Badge variant="outline" className="px-1 py-0 text-[9px]">{q.difficulty}</Badge>}
                        {q.subject && <Badge variant="outline" className="px-1 py-0 text-[9px]">{q.subject}</Badge>}
                        {q.lessonName && <Badge variant="outline" className="px-1 py-0 text-[9px] line-clamp-1" title={q.lessonName}>{q.lessonName}</Badge>}
                        {q.marks !== undefined && <Badge variant="outline" className="px-1 py-0 text-[9px]">Marks: {q.marks}</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-1 flex-shrink-0 self-center">
                    <Button variant="ghost" size="icon" onClick={() => openPreview(q)} className="text-blue-600 hover:bg-blue-100/50 h-7 w-7"><EyeIcon size={14}/></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveQuestion(q.id, q.source)} disabled={isUpdating} className="text-destructive hover:bg-destructive/10 h-7 w-7">
                      {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Trash2 size={14} />}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
      {currentPreviewQuestion && (
        <QuestionPreviewModal
            isOpen={isPreviewModalOpen}
            onClose={() => setIsPreviewModalOpen(false)}
            question={currentPreviewQuestion as any} 
            onApproveAndNext={() => setIsPreviewModalOpen(false)} 
            onApproveAndClose={() => setIsPreviewModalOpen(false)}
            onSkipAndNext={() => setIsPreviewModalOpen(false)}
            onPrevious={() => {}} 
            hasNext={false} 
            hasPrevious={false}
            isApproved={true} 
        />
      )}
    </div>
  );
}

    