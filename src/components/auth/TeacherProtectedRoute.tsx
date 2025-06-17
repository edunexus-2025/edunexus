
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Routes } from '@/lib/constants';
import { useRouter } from 'next/navigation';
import React, { useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function TeacherProtectedRoute({ children }: { children: React.ReactNode }) {
  const { teacher, isLoadingTeacher } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoadingTeacher && !teacher) {
      router.replace(Routes.teacherLogin);
    }
  }, [teacher, isLoadingTeacher, router]);

  if (isLoadingTeacher || !teacher) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="space-y-4 p-8 rounded-lg shadow-xl bg-card">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-10 w-full mt-4" />
          <p className="text-center text-muted-foreground">
            {isLoadingTeacher ? 'Loading teacher data...' : 'Redirecting to teacher login...'}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
