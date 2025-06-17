
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { Layers, AlertCircle, ListChecks, PlusCircle } from 'lucide-react';
import pb from '@/lib/pocketbase';
import type { RecordModel } from 'pocketbase';
import { escapeForPbFilter, Routes } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';

interface QuestionBankRecordForContent extends RecordModel {
  lessonName: string;
  lessonTopic?: string | null;
}

interface TopicInfo {
  name: string;
  questionCount: number;
}

interface LessonStructure {
  lessonName: string;
  topics: TopicInfo[];
  totalQuestionCount: number;
}

export default function ContentStructurePage() {
  const [structuredContent, setStructuredContent] = useState<LessonStructure[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      if (!isMounted) return;
      setIsLoading(true);
      setError(null);

      try {
        const records = await pb.collection('question_bank').getFullList<QuestionBankRecordForContent>({
          fields: 'lessonName,lessonTopic', 
        });

        if (!isMounted) return;

        const lessonMap = new Map<string, Map<string, number>>(); // LessonName -> (TopicName -> QuestionCount)

        records.forEach(record => {
          if (!record.lessonName) return; // Skip if lessonName is missing

          const lessonKey = record.lessonName;
          const topicKey = record.lessonTopic || 'General (No Topic)';

          if (!lessonMap.has(lessonKey)) {
            lessonMap.set(lessonKey, new Map<string, number>());
          }
          const topicsForLesson = lessonMap.get(lessonKey)!;
          topicsForLesson.set(topicKey, (topicsForLesson.get(topicKey) || 0) + 1);
        });

        const processedStructure: LessonStructure[] = [];
        lessonMap.forEach((topicsMap, lessonName) => {
          const topicsArray: TopicInfo[] = [];
          let lessonTotalQuestions = 0;
          topicsMap.forEach((count, topicName) => {
            topicsArray.push({ name: topicName, questionCount: count });
            lessonTotalQuestions += count;
          });
          topicsArray.sort((a, b) => a.name.localeCompare(b.name));
          processedStructure.push({
            lessonName,
            topics: topicsArray,
            totalQuestionCount: lessonTotalQuestions,
          });
        });

        processedStructure.sort((a, b) => a.lessonName.localeCompare(b.lessonName));
        
        if (isMounted) setStructuredContent(processedStructure);

      } catch (err: any) {
        if (isMounted) {
          console.error("ContentStructurePage: Failed to fetch content data:", err);
          setError(`Could not load content structure. Error: ${err.data?.message || err.message}`);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, []);

  const filteredContent = useMemo(() => {
    if (!searchTerm.trim()) {
      return structuredContent;
    }
    const lowerSearchTerm = searchTerm.toLowerCase();
    return structuredContent.filter(lesson => 
      lesson.lessonName.toLowerCase().includes(lowerSearchTerm) ||
      lesson.topics.some(topic => topic.name.toLowerCase().includes(lowerSearchTerm))
    ).map(lesson => ({
        ...lesson,
        topics: lesson.topics.filter(topic => topic.name.toLowerCase().includes(lowerSearchTerm) || lesson.lessonName.toLowerCase().includes(lowerSearchTerm))
    }));
  }, [structuredContent, searchTerm]);


  if (isLoading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center gap-3 mb-4">
          <Layers className="h-8 w-8 text-primary" />
          <Skeleton className="h-8 w-72" />
        </div>
        <Skeleton className="h-10 w-full mb-4" /> 
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="shadow-md">
              <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6 text-center">
        <Card className="max-w-lg mx-auto shadow-lg border-destructive bg-destructive/10">
          <CardHeader>
            <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-3" />
            <CardTitle className="text-destructive">Error Loading Content Structure</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 md:p-6">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Layers className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl md:text-3xl font-bold text-foreground">
                Content Structure Overview
              </CardTitle>
              <CardDescription className="text-md text-muted-foreground">
                Browse all lessons and their topics from the question bank. Question counts are shown.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="mb-6">
        <Input 
            type="search"
            placeholder="Search lessons or topics..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-1/2 lg:w-1/3 bg-card border-border"
        />
      </div>

      {filteredContent.length === 0 ? (
        <Card className="text-center p-10 border-dashed">
            <ListChecks className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="text-xl">No Content Found</CardTitle>
            <CardDescription>
                {searchTerm ? "No lessons or topics match your search." : "No content available in the question bank."}
            </CardDescription>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-300px)]">
          <Accordion type="multiple" className="w-full space-y-2 pr-3">
            {filteredContent.map(lesson => (
              <AccordionItem key={lesson.lessonName} value={lesson.lessonName} className="bg-card border rounded-md shadow-sm data-[state=open]:shadow-lg">
                <AccordionTrigger className="px-4 py-3 text-lg font-medium hover:bg-muted/50 rounded-t-md">
                  <div className="flex justify-between items-center w-full">
                    <span className="truncate text-left" title={lesson.lessonName}>{lesson.lessonName}</span>
                    <Badge variant="secondary" className="ml-2 flex-shrink-0">{lesson.totalQuestionCount} Qs</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 py-3 border-t bg-background/30">
                  {lesson.topics.length > 0 ? (
                    <ul className="space-y-2">
                      {lesson.topics.map(topic => (
                        <li key={topic.name} className="text-sm p-2.5 hover:bg-secondary/40 rounded-md border border-transparent hover:border-primary/20 flex justify-between items-center">
                          <div>
                            <span className="text-foreground truncate" title={topic.name}>{topic.name}</span>
                            <Badge variant="outline" className="ml-2 font-normal text-xs">{topic.questionCount} Qs</Badge>
                          </div>
                          <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary/80 text-xs">
                            <Link href={Routes.adminQuestionBank + `?lesson=${encodeURIComponent(lesson.lessonName)}&topic=${encodeURIComponent(topic.name)}`}>
                               <PlusCircle className="h-3.5 w-3.5 mr-1"/> Add Qs
                            </Link>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No specific topics found for this lesson, or questions are not tagged with topics.</p>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollArea>
      )}
    </div>
  );
}
