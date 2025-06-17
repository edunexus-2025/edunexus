
'use client';

import { Search, Filter, Loader2, Atom, FlaskConical, Sigma, Dna, ChevronRight, BookOpen } from 'lucide-react'; // Added BookOpen
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardDescription, CardTitle, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import pb from '@/lib/pocketbase';
import type { RecordModel } from 'pocketbase';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Routes, DPP_EXAM_OPTIONS, slugify } from '@/lib/constants';
import Image from 'next/image';


export default function DppPage() {
  // This page now shows exam selection cards.
  // It links to /dashboard/dpp/[examSlug] which will handle subject selection.

  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
            <CardTitle className="text-3xl font-bold text-foreground">Daily Practice Problems (DPPs)</CardTitle>
            <CardDescription>Select an exam to view subject-wise Daily Practice Problems for non-PYQ questions.</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {DPP_EXAM_OPTIONS.map((exam) => (
          <Link key={exam.id} href={Routes.dppExamSubjects(exam.slug)} passHref>
            <Card className="bg-card rounded-xl shadow-md hover:shadow-xl hover:bg-primary/5 transition-all duration-300 ease-in-out transform hover:-translate-y-1 cursor-pointer group h-full flex flex-col">
              <CardHeader className="flex-shrink-0 pt-6 px-6 pb-4"> {/* Adjusted padding */}
                <div className="flex items-center gap-4 mb-2"> {/* Added margin-bottom */}
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0">
                      {exam.isIconComponent ? (
                        <div className="w-full h-full flex items-center justify-center bg-primary/10 rounded-lg p-2 group-hover:bg-primary/20 transition-colors">
                           <BookOpen className="w-10 h-10 sm:w-12 sm:h-12 text-primary group-hover:text-primary-dark transition-colors" />
                        </div>
                      ) : (
                        <Image
                          src={exam.iconUrl}
                          alt={`${exam.name} logo`}
                          fill
                          className="rounded-lg object-contain"
                          data-ai-hint={exam.dataAiHint}
                        />
                      )}
                    </div>
                    <CardTitle className="text-xl lg:text-2xl text-foreground group-hover:text-primary transition-colors duration-300">{exam.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-grow px-6 pb-4"> {/* Adjusted padding */}
                <p className="text-sm text-muted-foreground">{exam.description}</p>
              </CardContent>
              <CardFooter className="mt-auto pt-4 pb-6 px-6 border-t border-border"> {/* Adjusted padding */}
                  <div className="flex items-center justify-between w-full text-primary group-hover:font-semibold group-hover:text-primary transition-all duration-300">
                    <span>View Subjects</span>
                    <ChevronRight className="h-5 w-5 transform transition-transform duration-300 group-hover:translate-x-1 group-hover:text-primary" />
                  </div>
              </CardFooter>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

