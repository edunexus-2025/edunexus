
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import pb from '@/lib/pocketbase';
import { z } from 'zod';
import { FileJson2, UploadCloud, AlertTriangle, CheckCircle } from 'lucide-react';

// Simplified Zod schema for text-only question JSON structure
const TextOnlyQuestionJsonSchema = z.object({
  subject: z.string().min(1, "Subject is required."),
  lessonName: z.string().min(1, "Lesson name is required."),
  lessonTopic: z.string().optional().nullable(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  marks: z.number().min(0).optional().default(1),
  tags: z.string().optional().nullable(),
  pyq: z.boolean(),
  ExamDpp: z.enum(["JEE MAIN", "NEET", "MHT CET"]).optional().nullable(), // Optional and nullable
  pyqExamName: z.string().optional().nullable(),
  pyqYear: z.number().int().positive().optional().nullable(),
  pyqDate: z.string().optional().nullable(), // Expects YYYY-MM-DD string if provided
  pyqShift: z.string().optional().nullable(),
  questionText: z.string().min(1, "Question text is required."),
  optionAText: z.string().min(1, "Option A text is required."),
  optionBText: z.string().min(1, "Option B text is required."),
  optionCText: z.string().min(1, "Option C text is required."),
  optionDText: z.string().min(1, "Option D text is required."),
  correctOption: z.enum(['A', 'B', 'C', 'D']),
  explanationText: z.string().optional().nullable(),
}).refine(data => {
    if (data.pyq) return !!data.pyqExamName; // If pyq is true, pyqExamName must be present
    return !!data.ExamDpp; // If pyq is false, ExamDpp must be present
}, {
    message: "Either PYQ details (pyqExamName) or DPP Exam (ExamDpp) must be provided based on 'pyq' status.",
    path: ["pyq", "ExamDpp", "pyqExamName"], // Indicate related fields
});

type TextOnlyQuestionJson = z.infer<typeof TextOnlyQuestionJsonSchema>;

const exampleNonPyqJson = `{
  "subject": "Physics",
  "lessonName": "Kinematics",
  "lessonTopic": "Equations of Motion",
  "difficulty": "Medium",
  "marks": 1,
  "tags": "conceptual, 1D motion",
  "pyq": false,
  "ExamDpp": "JEE MAIN",
  "questionText": "A car accelerates uniformly from rest to a speed of 20 m/s in 5 seconds. What is the acceleration? Use $a = (v-u)/t$.",
  "optionAText": "2 m/s²",
  "optionBText": "4 m/s²",
  "optionCText": "5 m/s²",
  "optionDText": "10 m/s²",
  "correctOption": "B",
  "explanationText": "Using the formula $a = (v-u)/t$, where $v=20, u=0, t=5$. So, $a = (20-0)/5 = 4$ m/s²."
}`;

const examplePyqJson = `{
  "subject": "Chemistry",
  "lessonName": "Chemical Bonding",
  "difficulty": "Hard",
  "marks": 4,
  "pyq": true,
  "pyqExamName": "JEE Advanced",
  "pyqYear": 2022,
  "questionText": "What is the hybridization of the central atom in $XeF_4$?",
  "optionAText": "sp³",
  "optionBText": "sp³d",
  "optionCText": "sp³d²",
  "optionDText": "sp²",
  "correctOption": "C",
  "explanationText": "$XeF_4$ has 4 bond pairs and 2 lone pairs around Xenon. Total electron pairs = 6. Hybridization is sp³d²."
}`;


export default function AddQuestionJsonPage() {
  const [jsonInput, setJsonInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{ successCount: number; errorCount: number; errors: string[] }>({
    successCount: 0,
    errorCount: 0,
    errors: [],
  });
  const { toast } = useToast();

  const handleProcessJson = async () => {
    setIsProcessing(true);
    setResults({ successCount: 0, errorCount: 0, errors: [] });
    let parsedJson;

    try {
      parsedJson = JSON.parse(jsonInput);
    } catch (error) {
      toast({
        title: 'Invalid JSON',
        description: 'The input is not valid JSON. Please check the syntax.',
        variant: 'destructive',
      });
      setIsProcessing(false);
      return;
    }

    const questionsToProcess: any[] = Array.isArray(parsedJson) ? parsedJson : [parsedJson];
    let currentSuccessCount = 0;
    const currentErrors: string[] = [];

    for (let i = 0; i < questionsToProcess.length; i++) {
      const questionData = questionsToProcess[i];
      try {
        const validatedData = TextOnlyQuestionJsonSchema.parse(questionData);

        // Map to PocketBase schema (ensure field names match your collection)
        const dataForPocketBase: Record<string, any> = {
          ...validatedData,
          // Ensure boolean 'pyq' is sent correctly
          pyq: !!validatedData.pyq,
          // Set questionType and optionsFormat for text-only
          questionType: 'text',
          optionsFormat: 'text_options',
        };

        // Remove fields not directly in PocketBase or handle them
        // For example, if 'tags' isn't a field, you might need to process it differently or omit it.
        // For now, assuming 'tags' is a text field in PocketBase.

        await pb.collection('question_bank').create(dataForPocketBase);
        currentSuccessCount++;
      } catch (error: any) {
        const questionIdentifier = questionData.lessonName || `Question ${i + 1}`;
        let errorMessage = `Failed to add ${questionIdentifier}: `;
        if (error instanceof z.ZodError) {
          errorMessage += error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
        } else {
          errorMessage += error.message || 'Unknown error';
        }
        currentErrors.push(errorMessage);
      }
    }

    setResults({
      successCount: currentSuccessCount,
      errorCount: currentErrors.length,
      errors: currentErrors,
    });

    if (currentSuccessCount > 0) {
      toast({
        title: 'Processing Complete',
        description: `${currentSuccessCount} question(s) added successfully.`,
      });
    }
    if (currentErrors.length > 0) {
      toast({
        title: 'Some Questions Failed',
        description: `${currentErrors.length} question(s) could not be added. See details below.`,
        variant: 'destructive',
        duration: 7000,
      });
    }
    setIsProcessing(false);
  };

  return (
    <div className="space-y-8 p-4 md:p-6">
      <Card className="shadow-xl border-t-4 border-primary">
        <CardHeader>
          <div className="flex items-center gap-3">
            <FileJson2 className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl font-bold text-foreground">Add Questions via JSON</CardTitle>
              <CardDescription className="text-muted-foreground">
                Paste JSON data for one or more questions to add them in bulk.
                Currently supports **text-only** questions, options, and explanations.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Textarea
            placeholder="Paste your JSON here..."
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            rows={15}
            className="font-mono text-sm"
            disabled={isProcessing}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-muted/30">
              <CardHeader><CardTitle className="text-md">Example: Non-PYQ Text Question</CardTitle></CardHeader>
              <CardContent>
                <pre className="text-xs p-2 bg-background rounded-md overflow-x-auto">
                  <code>{exampleNonPyqJson}</code>
                </pre>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardHeader><CardTitle className="text-md">Example: PYQ Text Question</CardTitle></CardHeader>
              <CardContent>
                <pre className="text-xs p-2 bg-background rounded-md overflow-x-auto">
                  <code>{examplePyqJson}</code>
                </pre>
              </CardContent>
            </Card>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            **Note:** Ensure your JSON keys match the expected schema. Fields like `marks`, `tags`, `lessonTopic`, `pyqYear`, `pyqDate`, `pyqShift`, and `explanationText` are optional. 
            If `pyq` is `true`, `pyqExamName` is required. If `pyq` is `false`, `ExamDpp` is required.
            All image fields will be ignored in this upload method.
          </CardDescription>
        </CardContent>
        <CardFooter>
          <Button onClick={handleProcessJson} disabled={isProcessing || !jsonInput.trim()} size="lg">
            <UploadCloud className="mr-2 h-5 w-5" />
            {isProcessing ? 'Processing...' : 'Process & Add Questions'}
          </Button>
        </CardFooter>
      </Card>

      {(results.successCount > 0 || results.errorCount > 0) && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Processing Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.successCount > 0 && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <p>{results.successCount} question(s) added successfully.</p>
              </div>
            )}
            {results.errorCount > 0 && (
              <div className="text-destructive space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  <p>{results.errorCount} question(s) failed to add:</p>
                </div>
                <ul className="list-disc list-inside pl-5 text-xs space-y-1 max-h-60 overflow-y-auto">
                  {results.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
