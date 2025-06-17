'use client';

import type { DppQuestion } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AiHintModal } from './AiHintModal';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle } from 'lucide-react';

interface DppItemProps {
  question: DppQuestion;
}

export function DppItem({ question }: DppItemProps) {
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim()) {
      toast({ title: "Please enter an answer.", variant: "destructive" });
      return;
    }
    // Mock submission and correctness check
    setSubmitted(true);
    const correct = Math.random() > 0.5; // Randomly mark as correct/incorrect
    setIsCorrect(correct);
    toast({
      title: `Answer Submitted: ${correct ? 'Correct!' : 'Incorrect'}`,
      description: correct ? "Great job!" : "Keep trying or check the hint!",
      variant: correct ? "default" : "destructive",
      className: correct ? "bg-green-500 dark:bg-green-700 text-white" : "bg-red-500 dark:bg-red-700 text-white"
    });
  };

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{question.title}</CardTitle>
          <Badge variant={question.difficulty === 'Easy' ? 'secondary' : question.difficulty === 'Medium' ? 'default' : 'destructive'}>
            {question.difficulty}
          </Badge>
        </div>
        <CardDescription>Topic: {question.topic}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-foreground/90 mb-4 whitespace-pre-wrap">{question.problemStatement}</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor={`dpp-answer-${question.id}`} className="mb-1 block text-sm font-medium">Your Answer:</Label>
            <Input
              id={`dpp-answer-${question.id}`}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer here"
              disabled={submitted}
            />
          </div>
          {submitted && isCorrect !== null && (
             <div className={`flex items-center p-2 rounded-md text-sm ${isCorrect ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'}`}>
              {isCorrect ? <CheckCircle className="h-5 w-5 mr-2" /> : <XCircle className="h-5 w-5 mr-2" />}
              {isCorrect ? 'Your answer is correct!' : 'Your answer is incorrect.'}
            </div>
          )}
          <Button type="submit" size="sm" disabled={submitted}>
            {submitted ? (isCorrect ? 'Correct!' : 'Submitted') : 'Submit Answer'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-end">
        <AiHintModal question={question} />
      </CardFooter>
    </Card>
  );
}
