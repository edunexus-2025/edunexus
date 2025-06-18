
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, AlertCircle, Edit3, ChevronLeft, ChevronRight, Save, Loader2 } from 'lucide-react';
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
}

interface QuestionRecord extends RecordModel {
  id: string;
  QuestionText?: string;
  QuestionImage?: string | null;
  OptionAText?: string;
  OptionAImage?: string | null;
  OptionBText?: string;
  OptionBImage?: string | null;
  OptionCText?: string;
  OptionCImage?: string | null;
  OptionDText?: string;
  OptionDImage?: string | null;
  CorrectOption?: "Option A" | "Option B" | "Option C" | "Option D";
  LessonName?: string;
  teacher?: string;
  explanationText?: string;
  explanationImage?: string | null;
}

type DisplayableQuestion = QuestionRecord;

const OLD_HOSTNAME = "f3605bbf-1d05-4292-9f0b-d3cd0ac21935-00-2eeov1wweb7qq.sisko.replit.dev";
const NEW_POCKETBASE_HOSTNAME = "ae8425c5-5ede-4664-bdaa-b238298ae1be-00-4oi013hd9264.sisko.replit.dev";

const correctImageUrlHostname = (url: string | null | undefined): string | null => {
  if (!url || typeof url !== 'string') return null;
  if (url.includes(OLD_HOSTNAME)) {
    return url.replace(OLD_HOSTNAME, NEW_POCKETBASE_HOSTNAME);
  }
  return url;
};

const renderLatex = (text: string | undefined | null): React.ReactNode => {
  if (!text) return null;
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$.*?\$|\\\(.*?\\\)|\\\[.*?\\\]|\\begin\{.*?\}[\s\S]*?\\end\{.*?\})/g);
  return parts.map((part, index) => {
    try {
      if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
        return <BlockMath key={index} math={part.substring(2, part.length - 2)} />;
      }
      if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
        return <InlineMath key={index} math={part.substring(1, part.length - 1)} />;
      }
      if (part.startsWith('\\(') && part.endsWith('\\)') && part.length > 4) {
        return <InlineMath key={index} math={part.substring(2, part.length - 2)} />;
      }
      if (part.startsWith('\\[') && part.endsWith('\\]') && part.length > 4) {
        return <BlockMath key={index} math={part.substring(2, part.length - 2)} />;
      }
      if (part.startsWith('\\begin{') && part.includes('\\end{')) {
        return <BlockMath key={index} math={part} />
      }
    } catch (e) {
      return <span key={index} className="text-destructive" title="LaTeX Error">{part}</span>;
    }
    return <span key={index}>{part}</span>;
  });
};

const isValidHttpUrl = (string: string | null | undefined): string is string => {
  if (!string || typeof string !== 'string') return false;
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
};

export default function ViewTestQuestionsPage() {
  const params = useParams();
  const router = useRouter();
  const { teacher, isLoadingTeacher } = useAuth();
  const { toast } = useToast();
  const testId = typeof params.testId === 'string' ? params.testId : '';

  const [parentTest, setParentTest] = useState<ParentTest | null>(null);
  const [questions, setQuestions] = useState<DisplayableQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const [isLoadingParentTest, setIsLoadingParentTest] = useState(true);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditingCorrectOption, setIsEditingCorrectOption] = useState(false);
  const [editableCorrectOption, setEditableCorrectOption] = useState<QuestionRecord['CorrectOption'] | undefined>(undefined);
  const [isSavingCorrectOption, setIsSavingCorrectOption] = useState(false);

  const optionLabels: Array<"Option A" | "Option B" | "Option C" | "Option D"> = ["Option A", "Option B", "Option C", "Option D"];

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (!testId || isLoadingTeacher) {
        if (isMounted) {
          setIsLoadingParentTest(false);
          setIsLoadingQuestions(false);
        }
        return;
      }
      if (!teacher?.id) {
        if (isMounted) setError("Teacher not authenticated.");
        if (isMounted) {
          setIsLoadingParentTest(false);
          setIsLoadingQuestions(false);
        }
        return;
      }

      if (isMounted) {
        setIsLoadingParentTest(true);
        setIsLoadingQuestions(true);
        setError(null);
        setQuestions([]);
        setCurrentQuestionIndex(0);
      }

      let fetchedParentTestName: string | null = null;

      try {
        if (!isMounted) return;
        const fetchedTest = await pb.collection('teacher_tests').getOne<ParentTest>(testId, { fields: 'testName, id' });
        if (isMounted) {
          setParentTest(fetchedTest);
          fetchedParentTestName = fetchedTest.testName;
        } else {
          return;
        }
      } catch (err: any) {
        if (isMounted) {
           if (err?.name === 'ClientResponseError' && err?.status === 0) {
            console.warn('ViewTestQuestionsPage: Fetch parent test details request was cancelled.');
          } else {
            console.error("ViewTestQuestionsPage: Failed to fetch parent test details:", err.data || err);
            setError(`Could not load parent test details. Error: ${err.data?.message || err.message}`);
            setIsLoadingParentTest(false);
            setIsLoadingQuestions(false);
          }
        }
        return;
      }
      if (isMounted) setIsLoadingParentTest(false);

      if (fetchedParentTestName && teacher.id) {
        const questionFilter = `LessonName = "${fetchedParentTestName.replace(/"/g, '""')}" && teacher = "${teacher.id}"`;
        console.log("ViewTestQuestionsPage: Fetching questions from 'teacher_question_data' with filter:", questionFilter);
        
        try {
          if (!isMounted) return;
          const fetchedQuestions = await pb.collection('teacher_question_data').getFullList<DisplayableQuestion>({
            filter: questionFilter,
            sort: 'created',
          });

          if (!isMounted) return;
          
          setQuestions(fetchedQuestions);
          if (fetchedQuestions.length > 0) {
              setEditableCorrectOption(fetchedQuestions[0].CorrectOption);
          }

        } catch (err: any) {
          if (isMounted) {
            if (err?.name === 'ClientResponseError' && err?.status === 0) {
              console.warn('ViewTestQuestionsPage: Fetch questions request was cancelled. Filter:', questionFilter);
            } else {
              console.error("ViewTestQuestionsPage: Failed to fetch questions from 'teacher_question_data':", err.data || err, "Filter:", questionFilter);
              setError(`Could not load questions for the test. Error: ${err.data?.message || err.message}`);
            }
          }
        }
      } else if (isMounted) {
        setQuestions([]);
      }
      if (isMounted) setIsLoadingQuestions(false);
    };

    if (testId && teacher?.id) {
      loadData();
    } else if (isMounted && !isLoadingTeacher && !teacher?.id) {
      setError("Teacher not authenticated.");
      setIsLoadingParentTest(false);
      setIsLoadingQuestions(false);
    }

    return () => {
      isMounted = false;
    };
  }, [testId, teacher?.id, isLoadingTeacher]);

  useEffect(() => {
    if (questions[currentQuestionIndex]) {
        setEditableCorrectOption(questions[currentQuestionIndex].CorrectOption);
    }
  }, [currentQuestionIndex, questions]);


  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setIsEditingCorrectOption(false);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      setIsEditingCorrectOption(false);
    }
  };

  const currentQuestion = questions[currentQuestionIndex];

  const handleEditCorrectOptionToggle = () => {
    if (currentQuestion) {
      setEditableCorrectOption(currentQuestion.CorrectOption);
      setIsEditingCorrectOption(!isEditingCorrectOption);
    }
  };

  const handleSaveCorrectOption = async () => {
    if (!currentQuestion || editableCorrectOption === undefined) {
      toast({ title: "Error", description: "No option selected or question not found.", variant: "destructive" });
      return;
    }
    setIsSavingCorrectOption(true);
    try {
      await pb.collection('teacher_question_data').update(currentQuestion.id, { CorrectOption: editableCorrectOption });
      toast({ title: "Success", description: "Correct option updated." });
      const updatedQuestions = questions.map((q, index) =>
        index === currentQuestionIndex ? { ...q, CorrectOption: editableCorrectOption } : q
      );
      setQuestions(updatedQuestions);
      setIsEditingCorrectOption(false);
    } catch (error: any) {
      console.error("Failed to update correct option:", error.data || error);
      toast({ title: "Error", description: `Could not update correct option: ${error.data?.message || error.message}`, variant: "destructive" });
    } finally {
      setIsSavingCorrectOption(false);
    }
  };


  if (isLoadingParentTest || isLoadingQuestions) {
    return (
      <div className="space-y-6 p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
        <div className="flex items-center justify-between mb-4 max-w-3xl mx-auto">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-1/2" />
          <div className="w-8"></div>
        </div>
        <Card className="shadow-lg max-w-3xl mx-auto">
          <CardHeader className="p-4 border-b flex justify-between items-center">
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </CardHeader>
          <CardContent className="p-4 md:p-6 space-y-4">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-20 w-full" />
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </CardContent>
          <CardFooter className="flex justify-between p-4 border-t">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
        <Button variant="outline" size="sm" onClick={() => router.push(Routes.teacherTestPanel(testId))}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Test Panel
        </Button>
        <Card className="shadow-lg border-destructive bg-destructive/10 max-w-3xl mx-auto">
          <CardHeader><CardTitle className="text-destructive flex items-center gap-2"><AlertCircle />Error Loading Questions</CardTitle></CardHeader>
          <CardContent><p>{error}</p></CardContent>
        </Card>
      </div>
    );
  }

  if (!currentQuestion && !isLoadingParentTest && !isLoadingQuestions) {
    return (
      <div className="space-y-6 p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
        <Button variant="outline" size="sm" onClick={() => router.push(Routes.teacherTestPanel(testId))}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Test Panel
        </Button>
        <Card className="text-center p-10 shadow-md max-w-3xl mx-auto">
          <CardHeader>
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <CardTitle>No Questions Found</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>
              No questions found for "{parentTest?.testName || 'this test'}" lesson created by you.
              Please add questions via the "Add Question" tab in the test panel.
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Correct image URLs before rendering
  const correctedQuestionImage = correctImageUrlHostname(currentQuestion.QuestionImage);
  const correctedOptionAImage = correctImageUrlHostname(currentQuestion.OptionAImage);
  const correctedOptionBImage = correctImageUrlHostname(currentQuestion.OptionBImage);
  const correctedOptionCImage = correctImageUrlHostname(currentQuestion.OptionCImage);
  const correctedOptionDImage = correctImageUrlHostname(currentQuestion.OptionDImage);
  const correctedExplanationImage = correctImageUrlHostname(currentQuestion.explanationImage);


  return (
    <div className="space-y-6 p-2 sm:p-4 md:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="flex items-center justify-between mb-4 max-w-3xl mx-auto">
        <Button variant="outline" size="sm" onClick={() => router.push(Routes.teacherTestPanel(testId))}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Test Panel
        </Button>
        <h1 className="text-lg md:text-xl font-semibold text-center text-foreground flex-grow truncate px-2">
          Viewing Questions for: <span className="text-primary">{parentTest?.testName || "Test"}</span>
        </h1>
        <div className="w-24 sm:w-32"> {/* Spacer */} </div>
      </div>

      {currentQuestion ? (
        <Card className="max-w-3xl mx-auto shadow-xl border border-border rounded-lg overflow-hidden">
          <CardHeader className="p-4 bg-card border-b border-border">
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium text-muted-foreground">
                Question {currentQuestionIndex + 1} of {questions.length}
              </p>
              <Button variant="ghost" size="icon" onClick={handleEditCorrectOptionToggle} title="Edit Correct Option">
                <Edit3 className="h-5 w-5 text-primary" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-4 md:p-6 space-y-6">
            <div className="p-3 border-b border-border rounded-md bg-background">
              {currentQuestion.QuestionText && (
                <div className="prose prose-sm dark:prose-invert max-w-none mb-4 text-foreground leading-relaxed">
                  {renderLatex(currentQuestion.QuestionText)}
                </div>
              )}
              {correctedQuestionImage && isValidHttpUrl(correctedQuestionImage) && (
                <div className="my-3 text-center">
                  <NextImage src={correctedQuestionImage} alt="Question Image" width={400} height={300} className="rounded object-contain inline-block border" data-ai-hint="question diagram"/>
                </div>
              )}
               {!(currentQuestion.QuestionText || (correctedQuestionImage && isValidHttpUrl(correctedQuestionImage))) && (
                <p className="text-sm text-muted-foreground italic">No question text or image provided.</p>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-md font-semibold text-muted-foreground">Options:</h4>
              {optionLabels.map((optLabel, index) => {
                const textKey = `Option${String.fromCharCode(65 + index)}Text` as keyof DisplayableQuestion;
                const imageUrlKey = `Option${String.fromCharCode(65 + index)}Image` as keyof DisplayableQuestion;
                
                // Use the corrected URLs
                const correctedOptionImageUrl = correctImageUrlHostname(currentQuestion[imageUrlKey] as string | null | undefined);
                const isThisOptionCorrect = currentQuestion.CorrectOption === optLabel;

                return (
                  <div
                    key={optLabel}
                    className={cn(
                      "flex items-start gap-3 p-3 border rounded-md",
                      isThisOptionCorrect ? "border-green-500 bg-green-500/10" : "border-border bg-card"
                    )}
                  >
                    <span className={cn("font-semibold", isThisOptionCorrect ? "text-green-700 dark:text-green-300" : "text-primary")}>{String.fromCharCode(65 + index)}.</span>
                    <div className="flex-1 text-sm">
                      {currentQuestion[textKey] && (
                        <div className={cn("prose prose-sm dark:prose-invert max-w-none", isThisOptionCorrect && "font-semibold")}>
                          {renderLatex(currentQuestion[textKey] as string)}
                        </div>
                      )}
                      {correctedOptionImageUrl && isValidHttpUrl(correctedOptionImageUrl) && (
                         <div className="mt-1.5">
                           <NextImage src={correctedOptionImageUrl} alt={`Option ${String.fromCharCode(65 + index)} Image`} width={150} height={80} className="rounded object-contain border" data-ai-hint="option illustration"/>
                         </div>
                      )}
                       {!(currentQuestion[textKey] || (correctedOptionImageUrl && isValidHttpUrl(correctedOptionImageUrl))) && <p className="text-muted-foreground italic">Option {String.fromCharCode(65 + index)} content not available.</p>}
                    </div>
                  </div>
                );
              })}
            </div>

            {isEditingCorrectOption && (
              <Card className="mt-4 p-4 bg-muted/50 border-dashed">
                <CardTitle className="text-md mb-3">Edit Correct Option</CardTitle>
                <Select
                  value={editableCorrectOption}
                  onValueChange={(value) => setEditableCorrectOption(value as QuestionRecord['CorrectOption'])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select correct option" />
                  </SelectTrigger>
                  <SelectContent>
                    {optionLabels.map(label => (
                      <SelectItem key={label} value={label}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="ghost" size="sm" onClick={() => setIsEditingCorrectOption(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleSaveCorrectOption} disabled={isSavingCorrectOption || !editableCorrectOption}>
                    {isSavingCorrectOption && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Correct Option
                  </Button>
                </div>
              </Card>
            )}
            
            { (currentQuestion.explanationText || (correctedExplanationImage && isValidHttpUrl(correctedExplanationImage))) && !isEditingCorrectOption &&
              <div className="mt-6 pt-4 border-t border-border">
                <h4 className="text-md font-semibold text-muted-foreground mb-2">Explanation:</h4>
                {currentQuestion.explanationText && (
                   <div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed">
                     {renderLatex(currentQuestion.explanationText)}
                   </div>
                )}
                {correctedExplanationImage && isValidHttpUrl(correctedExplanationImage) && (
                  <div className="my-3 text-center">
                    <NextImage src={correctedExplanationImage} alt="Explanation Image" width={300} height={200} className="rounded object-contain inline-block border" data-ai-hint="explanation diagram"/>
                  </div>
                )}
              </div>
            }
             { !(currentQuestion.explanationText || (correctedExplanationImage && isValidHttpUrl(correctedExplanationImage))) && !isEditingCorrectOption &&
                <p className="text-sm text-muted-foreground mt-4 text-center">No explanation available for this question.</p>
             }
          </CardContent>

          <CardFooter className="p-4 flex justify-between items-center border-t border-border">
            <Button variant="outline" onClick={handlePreviousQuestion} disabled={currentQuestionIndex === 0}>
              <ChevronLeft className="mr-2 h-4 w-4" /> Previous
            </Button>
            <Button variant="outline" onClick={handleNextQuestion} disabled={currentQuestionIndex === questions.length - 1 || questions.length === 0}>
              Next <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      ) : (
        !isLoadingParentTest && !isLoadingQuestions && <p className="text-center text-muted-foreground mt-10">No question currently selected or available to display.</p>
      )}
    </div>
  );
}

