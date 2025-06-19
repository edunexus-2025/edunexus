
'use client';

import { useParams } from 'next/navigation';
import React, { useEffect, useState, useCallback } from 'react';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, BookOpen, PlusCircle, Trash2, Eye as EyeIcon, Loader2, Info } from 'lucide-react';
import { QbModal } from '@/components/teacher/QbModal';
import Link from 'next/link';
import { Routes, escapeForPbFilter } from '@/lib/constants';
import NextImage from 'next/image';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DisplayableQuestion {
  id: string;
  textSnippet?: string | null;
  imageUrl?: string | null;
  source: 'EduNexus QB' | 'My QB';
  difficulty?: string | null;
  rawRecord: RecordModel;
  collectionId?: string;
  collectionName?: string;
  questionImage_filename?: string | null; 
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
        } catch (e) { console.warn(`AddQuestionPage: Error getting PB file URL for ${fieldName} in record ${record.id}:`, e); return null; }
      }
      console.error(`AddQuestionPage: CRITICAL - Missing collectionId/collectionName for PB file field '${fieldName}' in record ID '${record.id}'.`);
      return null;
    }
};

const renderLatexSnippet = (text: string | undefined | null, maxLength: number = 70): React.ReactNode => {
  if (!text) return <span className="italic text-xs text-muted-foreground">No text.</span>;
  const snippet = text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  const parts = snippet.split(/(\$\$[\s\S]*?\$\$|\$.*?\$)/g);
  return parts.map((part, index) => {
    try {
      if (part.startsWith('$$') && part.endsWith('$$')) return <BlockMath key={index} math={part.substring(2, part.length - 2)} />;
      if (part.startsWith('$') && part.endsWith('$')) return <InlineMath key={index} math={part.substring(1, part.length - 1)} />;
    } catch (e) { return <span key={index} className="text-destructive text-xs" title="LaTeX Error">{part}</span>; }
    return <span key={index} className="text-xs">{part}</span>;
  });
};

export default function TeacherAddQuestionToTestPage() {
  const params = useParams();
  const { teacher } = useAuth();
  const { toast } = useToast();
  const testId = typeof params.testId === 'string' ? params.testId : '';

  const [testName, setTestName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isQbModalOpen, setIsQbModalOpen] = useState(false);
  const [currentDisplayableQuestions, setCurrentDisplayableQuestions] = useState<DisplayableQuestion[]>([]);


  const fetchTestAndQuestionDetails = useCallback(async (isMountedGetter: () => boolean) => {
    if (!testId || !teacher?.id) { if (isMountedGetter()) { setIsLoading(false); setError(testId ? "Teacher not found." : "Test ID missing."); } return; }
    if (isMountedGetter()) setIsLoading(true);

    try {
      const fetchedTest = await pb.collection('teacher_tests').getOne(testId, {
        fields: 'id,testName,teacherId,questions_edunexus,questions_teachers,QBExam,expand.questions_edunexus.id,expand.questions_edunexus.questionText,expand.questions_edunexus.questionImage,expand.questions_edunexus.difficulty,expand.questions_edunexus.collectionId,expand.questions_edunexus.collectionName,expand.questions_teachers.id,expand.questions_teachers.QuestionText,expand.questions_teachers.QuestionImage,expand.questions_teachers.CorrectOption',
        expand: 'questions_edunexus,questions_teachers',
      });

      if (!isMountedGetter()) return;
      if (fetchedTest.teacherId !== teacher.id) { if (isMountedGetter()) setError("Unauthorized."); return; }
      setTestName(fetchedTest.testName || 'Untitled Test');

      const combined: DisplayableQuestion[] = [];
      (fetchedTest.expand?.questions_edunexus || []).forEach((q: RecordModel) => {
        combined.push({
          id: q.id, textSnippet: q.questionText, imageUrl: getPbFileUrlOrDirectUrl(q, 'questionImage', false),
          source: 'EduNexus QB', difficulty: q.difficulty, rawRecord: q,
          collectionId: q.collectionId, collectionName: q.collectionName, questionImage_filename: q.questionImage,
        });
      });
      (fetchedTest.expand?.questions_teachers || []).forEach((q: RecordModel) => {
        combined.push({
          id: q.id, textSnippet: q.QuestionText, imageUrl: getPbFileUrlOrDirectUrl(q, 'QuestionImage', true),
          source: 'My QB', difficulty: q.CorrectOption?.replace("Option ","") || 'N/A', rawRecord: q,
        });
      });
      if (isMountedGetter()) setCurrentDisplayableQuestions(combined);

    } catch (err: any) { if (isMountedGetter()) { const clientError = err as ClientResponseError; if (clientError?.isAbort || (clientError?.name === 'ClientResponseError' && clientError?.status === 0)) { console.warn('AddQuestionPage: Fetch test/question details request was cancelled.'); } else { console.error("Error fetching test/question details:", clientError.data || clientError); setError("Could not load test or question details."); }}}
    finally { if (isMountedGetter()) setIsLoading(false); }
  }, [testId, teacher?.id]);

  useEffect(() => { let isMounted = true; fetchTestAndQuestionDetails(() => isMounted); return () => { isMounted = false; }; }, [fetchTestAndQuestionDetails]);

  const handleQuestionSelectFromModal = async (questionId: string) => {
    if (!testId || !teacher?.id) return;
    setIsUpdating(true);

    let sourceCollectionName: 'question_bank' | 'teacher_question_data' | null = null;
    try { await pb.collection('question_bank').getOne(questionId, {fields: 'id'}); sourceCollectionName = 'question_bank';
    } catch (qbError) { try { await pb.collection('teacher_question_data').getOne(questionId, {fields: 'id'}); sourceCollectionName = 'teacher_question_data';
      } catch (tqdError) { toast({title: "Error", description: "Selected question not found in any bank.", variant: "destructive"}); setIsUpdating(false); return;}}
    if (!sourceCollectionName) { toast({title: "Error", description: "Could not determine question source.", variant: "destructive"}); setIsUpdating(false); return; }

    const fieldToUpdate = sourceCollectionName === 'question_bank' ? 'questions_edunexus' : 'questions_teachers';
    const alreadyAdded = currentDisplayableQuestions.some(q => q.id === questionId);
    if (alreadyAdded) { toast({ title: "Already Added", variant: "default" }); setIsUpdating(false); return; }

    try {
      await pb.collection('teacher_tests').update(testId, { [`${fieldToUpdate}+`]: questionId });
      toast({ title: "Question Added", description: `Question added to "${testName}".` });
      fetchTestAndQuestionDetails(() => true); 
    } catch (error: any) { toast({ title: "Error Adding Question", description: error.message, variant: "destructive" }); }
    finally { setIsUpdating(false); }
  };
  
  const handleRemoveQuestionFromTest = async (questionId: string, source: 'EduNexus QB' | 'My QB') => {
    if (!testId || !questionId) return;
    setIsUpdating(true);
    const fieldToUpdate = source === 'EduNexus QB' ? 'questions_edunexus' : 'questions_teachers';
    try {
        await pb.collection('teacher_tests').update(testId, { [`${fieldToUpdate}-`]: questionId });
        toast({ title: "Question Removed" });
        fetchTestAndQuestionDetails(() => true);
    } catch (error: any) { toast({ title: "Error Removing", description: error.message, variant: "destructive" }); }
    finally { setIsUpdating(false); }
  };

  if (isLoading) { return ( <div className="p-6 space-y-4"> <Skeleton className="h-8 w-3/4 mb-2" /> <Skeleton className="h-10 w-40 mb-4" /> <Skeleton className="h-64 w-full" /> </div> ); }
  if (error) { return ( <Card className="text-center border-destructive bg-destructive/10 p-6"> <AlertCircle className="mx-auto h-10 w-10 text-destructive mb-3" /> <CardTitle className="text-destructive">Error</CardTitle> <CardDescription className="text-destructive/80">{error}</CardDescription> </Card> ); }

  return (
    <div className="p-4 md:p-6">
      <CardHeader className="px-0 pb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <CardTitle className="text-xl font-semibold flex items-center gap-2"><PlusCircle className="h-5 w-5 text-primary"/> Add Questions to Test</CardTitle>
          <Button onClick={() => setIsQbModalOpen(true)} disabled={isUpdating} size="sm">
            <BookOpen className="mr-2 h-4 w-4" /> Browse Question Banks
          </Button>
        </div>
        <CardDescription>
          Test: <span className="font-medium text-foreground">{testName}</span>. 
          Added: <span className="font-medium text-foreground">{currentDisplayableQuestions.length}</span> question(s).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-0">
        <Card className="p-3 border-dashed bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700">
            <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0"/>
                <div>
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-300">How to Add Questions:</p>
                    <ol className="list-decimal list-inside text-xs text-blue-600/90 dark:text-blue-300/90 space-y-0.5 mt-1">
                        <li>Click "Browse Question Banks".</li>
                        <li>Select "My Teacher QB" (your questions) or "EduNexus QB" (if Pro plan).</li>
                        <li>Filter by Exam and Lesson (Test Name for your QB).</li>
                        <li>Click "Select" on desired questions. They will be added here.</li>
                    </ol>
                </div>
            </div>
        </Card>
        {currentDisplayableQuestions.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed rounded-lg mt-4">
            <p className="text-muted-foreground">No questions added yet.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[calc(100vh-450px)] pr-2 mt-4">
            <div className="space-y-2">
              {currentDisplayableQuestions.map((q, index) => (
                <Card key={q.id} className="p-2.5 flex items-center justify-between gap-2 bg-card hover:shadow-sm">
                  <div className="flex items-start gap-2 flex-grow min-w-0">
                    <span className="text-xs font-medium text-muted-foreground pt-0.5">{index + 1}.</span>
                    <div className="min-w-0">
                      {q.imageUrl && <div className="mb-1 w-16 h-10 relative"><NextImage src={q.imageUrl} alt="Q thumb" layout="fill" objectFit="contain" className="rounded border bg-muted" data-ai-hint="preview"/></div>}
                      <div className="text-xs text-foreground line-clamp-2 prose prose-xs dark:prose-invert max-w-none">{renderLatexSnippet(q.textSnippet, 120)}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                        <span><Badge variant="outline" className="px-1 py-0 text-[9px]">{q.source}</Badge></span>
                        {q.difficulty && <Badge variant="outline" className="px-1 py-0 text-[9px]">{q.difficulty}</Badge>}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleRemoveQuestionFromTest(q.id, q.source)} disabled={isUpdating} className="text-destructive hover:bg-destructive/10 h-7 w-7 flex-shrink-0">
                    {isUpdating ? <Loader2 className="h-3 w-3 animate-spin"/> : <Trash2 size={13} />}
                  </Button>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
      <QbModal
        isOpen={isQbModalOpen}
        onOpenChange={setIsQbModalOpen}
        onQuestionSelect={(questionId) => {
          // The source detection logic needs to be more robust if modal doesn't pass it
          // For now, assuming a way to determine source or default to one.
          // This might require QbModal to return source or fetch it here.
          // Simplified: Assume it's from EduNexus if not determinable otherwise.
          handleQuestionSelectFromModal(questionId);
        }}
      />
    </div>
  );
}

    