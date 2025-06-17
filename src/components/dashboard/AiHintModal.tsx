'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { generateDppHints, GenerateDppHintsInput, GenerateDppHintsOutput } from '@/ai/flows/generate-dpp-hints';
import type { DppQuestion } from '@/lib/types';
import { Lightbulb } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '../ui/skeleton';

interface AiHintModalProps {
  question: DppQuestion;
  // Mock student performance data for now
  studentPerformance?: string; 
}

export function AiHintModal({ question, studentPerformance = "Student struggles with algebraic manipulation and applying formulas under pressure." }: AiHintModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hintData, setHintData] = useState<GenerateDppHintsOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHint = async () => {
    if (!question) return;
    setIsLoading(true);
    setError(null);
    setHintData(null);

    try {
      const input: GenerateDppHintsInput = {
        question: question.problemStatement,
        studentPerformance: studentPerformance,
      };
      const result = await generateDppHints(input);
      setHintData(result);
    } catch (err) {
      console.error('Error fetching AI hint:', err);
      setError('Failed to generate hint. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && !hintData && !isLoading) { // Fetch hint when modal opens, if not already fetched or loading
        fetchHint();
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Lightbulb className="mr-2 h-4 w-4" /> AI Hint
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg md:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-6 w-6 text-primary" /> AI Powered Hint & Solution
          </DialogTitle>
          <DialogDescription>
            For question: <span className="font-semibold">{question.title}</span>
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] p-1 pr-4">
          {isLoading && (
            <div className="space-y-4 my-4">
              <div>
                <Skeleton className="h-6 w-1/4 mb-2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4 mt-1" />
              </div>
              <div>
                <Skeleton className="h-6 w-1/3 mb-2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full mt-1" />
                <Skeleton className="h-4 w-5/6 mt-1" />
              </div>
            </div>
          )}
          {error && <p className="text-destructive my-4">{error}</p>}
          {hintData && (
            <div className="space-y-6 my-4 text-sm">
              <div>
                <h3 className="font-semibold text-lg text-primary mb-2">Hint:</h3>
                <p className="text-foreground/90 whitespace-pre-wrap">{hintData.hint}</p>
              </div>
              <div>
                <h3 className="font-semibold text-lg text-primary mb-2">Step-by-step Solution:</h3>
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  {hintData.stepByStepSolution}
                </div>
              </div>
            </div>
          )}
        </ScrollArea>
        
        <DialogFooter className="sm:justify-between gap-2">
           <Button variant="outline" onClick={fetchHint} disabled={isLoading}>
            {isLoading ? 'Regenerating...' : 'Regenerate Hint'}
          </Button>
          <DialogClose asChild>
            <Button type="button">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
