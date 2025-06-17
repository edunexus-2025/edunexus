
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { Routes } from '@/lib/constants';
import { ArrowLeft, BookHeart, AlertCircle, ChevronRight, Eye as EyeIcon, Info, NotebookText } from 'lucide-react'; // Added NotebookText
import { Badge } from '@/components/ui/badge';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import Image from 'next/image'; // For question images if any

interface NotebookDetails {
  id: string;
  notebook_name: string;
  category?: string[];
  questions: QuestionDetails[];
  updated: string;
}

interface QuestionDetails extends RecordModel {
  id: string;
  questionText?: string;
  questionImage?: string; // filename
  displayQuestionImageUrl?: string; // full URL
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  subject?: string;
  lessonName?: string; // Added lessonName
  // Add other fields as needed from question_bank
}

const CANCELLATION_OR_NETWORK_ERROR_MESSAGE = 'Request to load notebook was cancelled or a network issue occurred. Please try refreshing.';

const renderLatexSnippet = (text: string | undefined | null, maxLength: number = 100): React.ReactNode => {
  if (!text) return <span className="italic text-muted-foreground">No text preview.</span>;
  const snippet = text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  const parts = snippet.split(/(\$\$[\s\S]*?\$\$|\$.*?\$)/g); // Basic split for $$...$$ and $...$
  return parts.map((part, index) => {
    try {
      if (part.startsWith('$$') && part.endsWith('$$')) {
        return <BlockMath key={index} math={part.substring(2, part.length - 2)} />;
      }
      if (part.startsWith('$') && part.endsWith('$')) {
        return <InlineMath key={index} math={part.substring(1, part.length - 1)} />;
      }
    } catch (e) {
      return <span key={index} className="text-destructive" title="LaTeX Error">{part}</span>;
    }
    return <span key={index}>{part}</span>;
  });
};

const getPbFileUrl = (record: RecordModel | null | undefined, fieldName: string): string | null => {
    if (record && record[fieldName] && record.collectionId && record.collectionName) {
      try { return pb.files.getUrl(record, record[fieldName] as string); }
      catch (e) { console.warn(`Error getting URL for ${fieldName} in record ${record.id}:`, e); return null; }
    }
    return null;
};


export default function ViewNotebookPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const notebookId = typeof params.notebookId === 'string' ? params.notebookId : '';

  const [notebook, setNotebook] = useState<NotebookDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotebookDetails = useCallback(async (isMountedGetter: () => boolean = () => true) => {
    if (!notebookId || !user?.id) {
      if (isMountedGetter()) {
        setIsLoading(false);
        setError(notebookId ? "User not authenticated." : "Notebook ID missing.");
      }
      return;
    }
    if (isMountedGetter()) {
      setIsLoading(true);
      setError(null);
    }
    try {
      if (!isMountedGetter()) return;
      const notebookRecord = await pb.collection('student_bookmarks').getOne<RecordModel>(notebookId, {
        expand: 'questions', 
      });

      if (!isMountedGetter()) return;
      if (notebookRecord.user !== user.id) {
        if (isMountedGetter()) {
          setError("You are not authorized to view this notebook.");
          setIsLoading(false);
          toast({ title: "Access Denied", description: "You do not have permission to view this notebook.", variant: "destructive" });
        }
        return;
      }
      
      const questionIds = Array.isArray(notebookRecord.questions) ? notebookRecord.questions : [];
      let fetchedQuestions: QuestionDetails[] = [];

      if (questionIds.length > 0) {
        const questionPromises = questionIds.map(id =>
            pb.collection('question_bank').getOne<QuestionDetails>(id, {
                fields: 'id,questionText,questionImage,difficulty,subject,lessonName,collectionId,collectionName' // Added lessonName
            }).catch(qErr => {
                console.warn(`Failed to fetch question ${id}:`, qErr);
                return null; 
            })
        );
        const results = await Promise.all(questionPromises);
        fetchedQuestions = results.filter(q => q !== null).map(q => {
            if (!q) return null; 
            return {
                ...q,
                displayQuestionImageUrl: getPbFileUrl(q, 'questionImage')
            }
        }).filter(Boolean) as QuestionDetails[];
      }

      if (isMountedGetter()) {
        setNotebook({
          id: notebookRecord.id,
          notebook_name: notebookRecord.notebook_name,
          category: notebookRecord.category,
          questions: fetchedQuestions,
          updated: notebookRecord.updated,
        });
      }

    } catch (err: any) {
      if (!isMountedGetter()) return;
      const clientError = err as ClientResponseError;
      let detailedMessage = 'Could not load notebook details.';

      if (clientError.isAbort || (clientError.name === 'ClientResponseError' && clientError.status === 0)) {
        console.warn('ViewNotebookPage: Fetch notebook details request was cancelled or failed due to a client-side/network issue.');
        detailedMessage = CANCELLATION_OR_NETWORK_ERROR_MESSAGE;
      } else {
        if (clientError.status === 404) {
          detailedMessage = "The notebook you're looking for could not be found. It may have been deleted or the ID is incorrect.";
        } else if (clientError.status === 403) {
          detailedMessage = "You are not authorized to view this notebook. Please ensure you are logged in with the correct account and that the notebook belongs to you.";
        } else if (clientError.data && clientError.data.message) {
          detailedMessage = `Error: ${clientError.data.message}`;
        } else if (clientError.message) {
          detailedMessage = `Error: ${clientError.message}`;
        }
        
        console.error("ViewNotebookPage: Failed to fetch notebook details. Status:", clientError.status, "Response Data:", clientError.data, "Original Error Obj:", clientError);
        toast({ title: "Error Loading Notebook", description: detailedMessage, variant: "destructive", duration: 7000 });
      }
      if (isMountedGetter()) setError(detailedMessage);
    } finally {
      if (isMountedGetter()) setIsLoading(false);
    }
  }, [notebookId, user?.id, toast]);

  useEffect(() => {
    let isMounted = true;
    const isMountedGetter = () => isMounted;

    if (!authLoading) { 
        fetchNotebookDetails(isMountedGetter);
    }
    
    return () => {
      isMounted = false;
    };
  }, [notebookId, authLoading, fetchNotebookDetails]);

  if (isLoading || authLoading) {
    return (
      <div className="space-y-6 p-4 md:p-8">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-8 w-32" />
        </div>
        <Card className="shadow-lg">
          <CardHeader><Skeleton className="h-10 w-3/4" /></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    const isCancellationError = error === CANCELLATION_OR_NETWORK_ERROR_MESSAGE;
    return (
      <div className="space-y-6 p-4 md:p-8 text-center">
        <Button variant="outline" size="sm" onClick={() => router.push(Routes.notebooks)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Notebooks
        </Button>
        <Card className={`shadow-lg max-w-md mx-auto ${isCancellationError ? 'border-blue-500 bg-blue-500/10' : 'border-destructive bg-destructive/10'}`}>
          <CardHeader className="items-center">
            {isCancellationError ? (
              <Info className="h-12 w-12 text-blue-500 mb-3" />
            ) : (
              <AlertCircle className="h-12 w-12 text-destructive mb-3" />
            )}
            <CardTitle className={isCancellationError ? 'text-blue-700 dark:text-blue-400' : 'text-destructive'}>
              {isCancellationError ? "Request Interrupted" : "Error Loading Notebook"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`whitespace-pre-wrap ${isCancellationError ? 'text-blue-600/80 dark:text-blue-300/80' : 'text-destructive/80'}`}>
              {error}
            </p>
          </CardContent>
          {isCancellationError && (
            <CardFooter className="justify-center">
              <Button onClick={() => fetchNotebookDetails(() => true)}>
                Retry
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    );
  }

  if (!notebook) {
    return (
      <div className="space-y-6 p-4 md:p-8 text-center">
         <Button variant="outline" size="sm" onClick={() => router.push(Routes.notebooks)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Notebooks
        </Button>
        <Card className="p-10 shadow-md">
          <CardTitle>Notebook Not Found</CardTitle>
          <CardDescription>The requested notebook could not be found.</CardDescription>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <Button variant="outline" size="sm" onClick={() => router.push(Routes.notebooks)} className="mb-2">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Notebooks
      </Button>
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="flex-grow">
              <CardTitle className="text-2xl md:text-3xl font-bold text-primary flex items-center gap-2">
                <BookHeart className="h-7 w-7"/> {notebook.notebook_name}
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground mt-1">
                Last updated: {new Date(notebook.updated).toLocaleDateString()}
              </CardDescription>
            </div>
            {notebook.category && notebook.category.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 sm:mt-0">
                    {notebook.category.map(cat => <Badge key={cat} variant="secondary">{cat}</Badge>)}
                </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {notebook.questions.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground mb-2">Bookmarked Questions ({notebook.questions.length}):</h3>
              {notebook.questions.map((q, index) => (
                <Link key={q.id} href={Routes.qbankView(q.id)} passHref>
                    <Card className="p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-border hover:border-primary/30 group">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-start gap-3 flex-grow min-w-0">
                            <span className="text-sm font-medium text-muted-foreground pt-0.5">{index + 1}.</span>
                            <div className="min-w-0">
                                <div className="text-sm text-foreground group-hover:text-primary line-clamp-2 prose prose-sm dark:prose-invert max-w-none">
                                    {renderLatexSnippet(q.questionText || q.QuestionText, 150)}
                                </div>
                                {q.displayQuestionImageUrl && (
                                     <div className="mt-1.5 w-20 h-12 relative">
                                        <Image src={q.displayQuestionImageUrl} alt="Question thumbnail" layout="fill" objectFit="contain" className="rounded border bg-muted" data-ai-hint="diagram illustration"/>
                                     </div>
                                )}
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    {q.subject && <Badge variant="outline" className="text-xs">{q.subject}</Badge>}
                                    {q.lessonName && <Badge variant="outline" className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-600">{q.lessonName}</Badge>}
                                    {q.difficulty && <Badge variant={q.difficulty === 'Easy' ? 'secondary' : q.difficulty === 'Medium' ? 'default' : 'destructive'} className="text-xs">{q.difficulty}</Badge>}
                                </div>
                            </div>
                        </div>
                        <EyeIcon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0"/>
                    </div>
                    </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <BookHeart className="mx-auto h-12 w-12 mb-3" />
              <p className="font-semibold">This notebook is empty.</p>
              <p className="text-sm">Start adding questions from the question bank or test reviews.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
