
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Construction } from 'lucide-react';
import { Routes } from '@/lib/constants';

export default function FullLengthTestResultPage() {
  const params = useParams();
  const router = useRouter();
  const resultId = typeof params.resultId === 'string' ? params.resultId : '';

  return (
    <div className="min-h-screen bg-muted/30 dark:bg-slate-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg text-center shadow-xl">
        <CardHeader>
          <Construction className="mx-auto h-16 w-16 text-primary mb-4" />
          <CardTitle className="text-2xl">Full Length Test Results - Coming Soon!</CardTitle>
          <CardDescription>
            The detailed results page for full-length tests is currently under construction.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-2">
            You'll soon be able to see your comprehensive analysis for full-length mock tests here.
          </p>
          {resultId && <p className="text-sm text-muted-foreground">Result ID: {resultId}</p>}
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button onClick={() => router.push(Routes.myProgress)} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to My Progress
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
