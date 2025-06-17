'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { NotebookText, CalendarDays } from "lucide-react";

export default function StudyPlanPage() {
  const { user, isLoading } = useAuth();

  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-foreground flex items-center">
            <CalendarDays className="mr-3 h-8 w-8 text-primary" /> My Study Plan
          </CardTitle>
          <CardDescription>
            Here's your personalized study schedule and learning goals. Stay organized and track your progress!
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-4">
              <Skeleton className="h-6 w-1/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          )}
          {!isLoading && user && user.studyPlan && (
            <div className="p-6 bg-secondary/30 rounded-lg border border-border">
              <h3 className="text-xl font-semibold text-primary mb-3 flex items-center">
                <NotebookText className="mr-2 h-6 w-6"/> Current Plan Details:
              </h3>
              <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {user.studyPlan}
              </p>
            </div>
          )}
          {!isLoading && user && !user.studyPlan && (
            <div className="flex flex-col items-center justify-center text-center p-10 border-2 border-dashed rounded-lg bg-card">
              <CalendarDays className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-xl font-semibold text-muted-foreground">No Study Plan Found</p>
              <p className="text-sm text-muted-foreground">
                You haven&apos;t created a study plan yet. Contact support or check back later for AI-powered plan generation features!
              </p>
            </div>
          )}
           {!isLoading && !user && (
             <div className="flex flex-col items-center justify-center text-center p-10 border-2 border-dashed rounded-lg">
                <p className="text-xl font-semibold text-muted-foreground">Could not load user data.</p>
             </div>
           )}
        </CardContent>
      </Card>
    </div>
  );
}
