
'use client';

import { useParams, usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useState, useCallback } from 'react';
import pb from '@/lib/pocketbase';
import type { RecordModel } from 'pocketbase';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Settings, ListChecks, PlusCircle, BarChart3, Send, Edit } from 'lucide-react';
import Link from 'next/link';
import { Routes } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext'; 

interface TestDetailsLayout extends RecordModel {
  testName?: string;
  teacherId?: string;
}

const TABS = [
  { value: 'settings', label: 'Settings & Details', icon: Settings, hrefSuffix: '/settings' },
  { value: 'view-questions', label: 'View/Manage Questions', icon: ListChecks, hrefSuffix: '/view-questions' },
  { value: 'add-question', label: 'Add Questions', icon: PlusCircle, hrefSuffix: '/add-question' },
  { value: 'results', label: 'Student Results', icon: BarChart3, hrefSuffix: '/results' },
  { value: 'status', label: 'Status & Share', icon: Send, hrefSuffix: '/status' },
];

export default function TeacherTestPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const { teacher, isLoadingTeacher } = useAuth();
  const testId = typeof params.testId === 'string' ? params.testId : '';

  const [testName, setTestName] = useState<string | null>(null);
  const [isLoadingTestName, setIsLoadingTestName] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTestName = useCallback(async (currentTestId: string, currentTeacherId: string) => {
    setIsLoadingTestName(true);
    setError(null);
    try {
      const record = await pb.collection('teacher_tests').getOne<TestDetailsLayout>(currentTestId, {
        fields: 'testName,teacherId', 
      });
      if (record.teacherId !== currentTeacherId) {
        setError("You are not authorized to manage this test.");
        setTestName("Access Denied");
      } else {
        setTestName(record.testName || 'Untitled Test');
      }
    } catch (err) {
      console.error("Error fetching test name for layout:", err);
      setError("Could not load test details for layout.");
      setTestName("Error Loading Test");
    } finally {
      setIsLoadingTestName(false);
    }
  }, []);

  useEffect(() => {
    if (testId && teacher && !isLoadingTeacher) {
      fetchTestName(testId, teacher.id);
    } else if (!isLoadingTeacher && !teacher) {
        setError("Teacher not authenticated.");
        setIsLoadingTestName(false);
    }
  }, [testId, teacher, isLoadingTeacher, fetchTestName]);

  const currentTabValue = TABS.find(tab => pathname === `/teacher/dashboard/my-content/${testId}${tab.hrefSuffix}`)?.value;
  const activeTab = currentTabValue || (pathname === `/teacher/dashboard/my-content/${testId}` ? 'settings' : 'settings');


  const handleTabChange = (value: string) => {
    const tabInfo = TABS.find(tab => tab.value === value);
    if (tabInfo) {
      router.push(`/teacher/dashboard/my-content/${testId}${tabInfo.hrefSuffix}`);
    }
  };
  
  if (isLoadingTeacher || (!teacher && !error)) { 
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[calc(100vh-200px)] w-full" />
      </div>
    );
  }

  if (error) {
     return (
        <div className="p-4 md:p-6 space-y-4">
            <Button variant="outline" size="sm" onClick={() => router.push(Routes.teacherMyContent)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to My Content
            </Button>
            <Card className="text-center">
                <CardHeader><CardTitle className="text-destructive">Error</CardTitle></CardHeader>
                <CardContent><p>{error}</p></CardContent>
            </Card>
        </div>
    );
  }

  return (
    <div className="p-2 sm:p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={() => router.push(Routes.teacherMyContent)} className="flex-shrink-0">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to My Content
        </Button>
        {isLoadingTestName ? (
          <Skeleton className="h-7 w-1/2 sm:w-1/3" />
        ) : (
          <h1 className="text-lg sm:text-xl font-semibold text-primary truncate text-center flex-grow" title={testName || ''}>
            <Edit className="inline-block h-5 w-5 mr-2 text-muted-foreground" />
            {testName || 'Loading Test...'}
          </h1>
        )}
         <div className="w-auto min-w-[calc(theme(space.20)+theme(space.2))] flex-shrink-0"></div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <ScrollArea className="pb-2">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1 h-auto p-1">
            {TABS.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs sm:text-sm px-2 py-1.5 sm:px-3 sm:py-2 h-auto flex-wrap justify-center">
                <tab.icon className="h-4 w-4 mr-1.5 hidden xs:inline-block" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </ScrollArea>
        <div className="mt-4 rounded-lg border bg-card text-card-foreground shadow-sm">
          {isLoadingTestName ? <div className="p-6"><Skeleton className="h-[calc(100vh-250px)] w-full" /></div> : children}
        </div>
      </Tabs>
    </div>
  );
}
    