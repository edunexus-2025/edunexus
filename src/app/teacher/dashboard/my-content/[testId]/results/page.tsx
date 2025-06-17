
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { Routes } from '@/lib/constants';

export default function TestResultsPage() {
  const params = useParams();
  const router = useRouter();
  const testId = typeof params.testId === 'string' ? params.testId : '';

  return (
    <div className="space-y-6">
       <Button variant="outline" onClick={() => router.push(Routes.teacherTestPanel(testId))}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Test Panel
      </Button>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl md:text-2xl">Results for Test (ID: {testId.substring(0,7)}...)</CardTitle>
          <CardDescription>
            View student performance and results for this test.
            Feature coming soon!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            A summary of results, individual student scores, and answer statistics will appear here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
