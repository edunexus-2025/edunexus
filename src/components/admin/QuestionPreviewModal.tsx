
'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { ArrowLeft, ArrowRight, Check, ThumbsUp, X } from 'lucide-react';
import Image from 'next/image';
import pb from '@/lib/pocketbase';
import type { RecordModel } from 'pocketbase'; // For getImageUrl

interface QuestionFromBank {
  id: string;
  questionText?: string;
  questionImage?: string; // Filename from PocketBase
  optionAText?: string;
  optionBText?: string;
  optionCText?: string;
  optionDText?: string;
  // For simplicity, image options are not displayed in this preview
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  marks?: number;
  // For constructing image URLs if question is a RecordModel
  collectionId?: string;
  collectionName?: string;
}

interface QuestionPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: QuestionFromBank | null;
  onApproveAndNext: () => void;
  onApproveAndClose: () => void;
  onSkipAndNext: () => void;
  onPrevious: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
  isApproved: boolean;
}

const renderLatex = (text: string | undefined | null): React.ReactNode => {
  if (!text) return null;
  // Basic split for $$...$$ (block) and $...$ (inline)
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$.*?\$)/g);
  return parts.map((part, index) => {
    try {
      if (part.startsWith('$$') && part.endsWith('$$')) {
        return <BlockMath key={index} math={part.substring(2, part.length - 2)} />;
      }
      if (part.startsWith('$') && part.endsWith('$')) {
        return <InlineMath key={index} math={part.substring(1, part.length - 1)} />;
      }
    } catch (e) {
      console.warn("Katex parsing error for part:", part, e);
      return <span key={index} className="text-red-500" title="LaTeX Error">{part}</span>;
    }
    return <span key={index}>{part}</span>;
  });
};

export function QuestionPreviewModal({
  isOpen,
  onClose,
  question,
  onApproveAndNext,
  onApproveAndClose,
  onSkipAndNext,
  onPrevious,
  hasNext,
  hasPrevious,
  isApproved,
}: QuestionPreviewModalProps) {
  if (!question) return null;

  const getImageUrl = (record: QuestionFromBank, fieldName: 'questionImage') => {
    // Ensure record has collectionId and collectionName for PocketBase file URL construction
    if (record && record[fieldName] && record.collectionId && record.collectionName) {
      // Type assertion needed if QuestionFromBank isn't directly a RecordModel
      return pb.files.getUrl(record as RecordModel, record[fieldName] as string);
    }
    return undefined;
  };
  
  const questionImageUrl = getImageUrl(question, 'questionImage');

  const options = [
    { label: 'A', text: question.optionAText },
    { label: 'B', text: question.optionBText },
    { label: 'C', text: question.optionCText },
    { label: 'D', text: question.optionDText },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[90vh] flex flex-col p-4 md:p-6">
        <DialogHeader className="pb-4 border-b flex-shrink-0">
          <DialogTitle className="text-xl md:text-2xl text-primary">Question Preview & Approve</DialogTitle>
          <DialogDescription>
            Review the full question details below.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-grow my-4 -mx-4 md:-mx-6 px-4 md:px-6 min-h-0"> {/* ScrollArea now takes up flexible space and has min-h-0 */}
          <div className="space-y-6 py-4">
            {question.difficulty && (
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={question.difficulty === 'Easy' ? 'secondary' : question.difficulty === 'Medium' ? 'default' : 'destructive'}>
                  {question.difficulty}
                </Badge>
                {question.marks !== undefined && <Badge variant="outline">Marks: {question.marks}</Badge>}
                <Badge variant="outline" className="font-mono text-xs">ID: ...{question.id.slice(-6)}</Badge>
              </div>
            )}

            {question.questionText && (
              <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none p-3 border rounded-md bg-background">
                {renderLatex(question.questionText)}
              </div>
            )}

            {questionImageUrl && (
              <div className="my-4 text-center border rounded-md p-2 bg-muted/30">
                <Image
                  src={questionImageUrl}
                  alt="Question Image"
                  width={500}
                  height={300}
                  className="rounded object-contain inline-block max-w-full max-h-[300px] sm:max-h-[400px]"
                  data-ai-hint="question diagram illustration"
                />
              </div>
            )}

            <div className="space-y-3 mt-6">
              <h4 className="text-md font-semibold text-muted-foreground">Options:</h4>
              {options.map((opt) => (
                opt.text && (
                  <div key={opt.label} className="flex items-start gap-2 p-3 border rounded-md bg-card">
                    <span className="font-semibold text-primary">{opt.label}.</span>
                    <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none">{renderLatex(opt.text)}</div>
                  </div>
                )
              ))}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-auto pt-4 border-t gap-2 flex-col sm:flex-row sm:justify-between flex-shrink-0">
            <div className="flex gap-2 justify-start flex-wrap order-2 sm:order-1">
                <Button variant="outline" onClick={onPrevious} disabled={!hasPrevious} className="w-full sm:w-auto" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" /> Previous
                </Button>
                <Button variant="outline" onClick={onSkipAndNext} disabled={!hasNext} className="w-full sm:w-auto" size="sm">
                Skip & Next <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </div>
            <div className="flex gap-2 justify-end flex-wrap order-1 sm:order-2">
                <DialogClose asChild>
                    <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto" size="sm">Close</Button>
                </DialogClose>
                {isApproved ? (
                    <Button variant="secondary" onClick={onApproveAndNext} disabled={!hasNext} className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto" size="sm">
                        <Check className="mr-2 h-4 w-4" /> Approved (Next)
                    </Button>
                ) : (
                    <Button onClick={onApproveAndNext} disabled={!hasNext} className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto" size="sm">
                        <ThumbsUp className="mr-2 h-4 w-4" /> Approve & Next
                    </Button>
                )}
                <Button onClick={onApproveAndClose} className="bg-green-500 hover:bg-green-600 text-white w-full sm:w-auto" size="sm">
                    <Check className="mr-2 h-4 w-4" /> Approve & Close
                </Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
