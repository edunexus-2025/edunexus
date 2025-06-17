
'use client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, BookOpen, Zap, ShieldCheck } from 'lucide-react';
import { Routes, DPP_EXAM_OPTIONS, AppConfig } from '@/lib/constants';
import type { DppExamOption } from '@/lib/constants';

// Icon component for DPP exams
const DppExamIcon = ({ iconUrl, isIconComponent, dataAiHint, altText }: { iconUrl: string; isIconComponent?: boolean; dataAiHint: string; altText: string; }) => {
  const IconComponent = isIconComponent ? BookOpen : null; // Example: use BookOpen if isIconComponent
  // In a real scenario, you might map `iconUrl` to specific Lucide icons if `isIconComponent` is true.
  // For `/assets/icons/book-open-icon.svg`, it's better to use an <img> tag unless it's an actual React component.

  if (IconComponent) { // If we decide to map some slugs to Lucide icons
    return <IconComponent className="h-10 w-10 text-primary mb-3 group-hover:scale-110 transition-transform duration-300" />;
  }
  
  return (
    <div className="relative h-14 w-14 sm:h-16 sm:w-16 mb-3 mx-auto transition-transform duration-300 group-hover:scale-110">
      <Image
        src={iconUrl}
        alt={altText}
        fill
        sizes="(max-width: 640px) 56px, 64px"
        className="object-contain rounded-md"
        data-ai-hint={dataAiHint}
        priority // For LCP on this page
      />
    </div>
  );
};

export default function DppExamSelectionPage() {
  return (
    <div className="space-y-10">
      <Card className="shadow-xl border-none bg-transparent">
        <CardHeader className="p-0 text-center items-center">
          <Zap className="h-12 w-12 text-primary mb-4 animate-pulse" />
          <CardTitle className="text-3xl md:text-4xl font-bold text-foreground">Daily Practice Problems</CardTitle>
          <CardDescription className="text-md md:text-lg text-muted-foreground max-w-xl mx-auto mt-2">
            Select your target exam to access focused Daily Practice Problems and sharpen your skills.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {DPP_EXAM_OPTIONS.map((exam: DppExamOption) => (
          <Link key={exam.id} href={Routes.dppExamSubjects(exam.slug)} passHref>
            <Card className="flex flex-col text-center rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out transform hover:-translate-y-1.5 group cursor-pointer h-full border border-border bg-card hover:border-primary/40">
              <CardHeader className="items-center flex-shrink-0 pt-6 pb-3">
                <DppExamIcon iconUrl={exam.iconUrl} isIconComponent={exam.isIconComponent} dataAiHint={exam.dataAiHint} altText={`${exam.name} DPP`} />
                <CardTitle className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">{exam.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow px-5 py-2">
                <p className="text-xs text-muted-foreground line-clamp-3">{exam.description}</p>
              </CardContent>
              <CardFooter className="p-5 border-t mt-auto bg-muted/20 group-hover:bg-primary/5 transition-colors">
                <span className="text-sm font-medium text-primary group-hover:underline flex items-center justify-center w-full">
                  View Subjects <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </CardFooter>
            </Card>
          </Link>
        ))}
      </div>
       <Card className="mt-10 shadow-lg border-none bg-gradient-to-r from-accent/10 to-primary/10 rounded-lg p-6 text-center">
        <ShieldCheck className="h-10 w-10 text-primary mx-auto mb-3" />
        <CardTitle className="text-xl font-semibold">Consistent Practice is Key!</CardTitle>
        <CardDescription className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
          Make DPPs a part of your daily routine to build a strong foundation and improve problem-solving speed for your target exams.
        </CardDescription>
      </Card>
    </div>
  );
}
