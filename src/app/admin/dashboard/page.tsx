
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ShieldCheck, Users, GraduationCap, FileText, ListChecks, AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import pb from '@/lib/pocketbase';
import type { RecordModel } from 'pocketbase';
import { Skeleton } from "@/components/ui/skeleton";

interface Stats {
  totalUsers: number | null;
  totalTeachers: number | null;
  totalQuestions: number | null;
  totalDppSolved: number | null;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: null,
    totalTeachers: null,
    totalQuestions: null,
    totalDppSolved: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      if (!isMounted) return;
      setIsLoading(true);
      setError(null);
      try {
        // Fetch DPP solved count separately and first
        let dppSolvedCountData: { totalItems: number };
        try {
          console.log("[AdminDashboard] INFO: Attempting to fetch daily_dpp_question_logs count.");
          dppSolvedCountData = await pb.collection('daily_dpp_question_logs').getList(1, 1, { filter: 'isCorrect = true', count: true, '$autoCancel': false });
          console.log("[AdminDashboard] INFO: Successfully fetched daily_dpp_question_logs count:", dppSolvedCountData.totalItems);
        } catch (dppError: any) {
          console.error("[AdminDashboard] ERROR: Failed to fetch DPP solved data:", dppError?.data || dppError?.message || dppError);
          dppSolvedCountData = { totalItems: 0 }; // Default to 0 on error for this specific fetch
          if(isMounted) setError(prevError => prevError ? `${prevError}\nFailed to fetch DPP solved count.` : 'Failed to fetch DPP solved count.');
        }

        if (!isMounted) return;

        const usersPromise = pb.collection('users').getList(1, 1, { count: true, '$autoCancel': false });
        const teachersPromise = pb.collection('teacher_data').getList(1, 1, { count: true, '$autoCancel': false });
        const questionsPromise = pb.collection('question_bank').getList(1, 1, { count: true, '$autoCancel': false });
        
        console.log("[AdminDashboard] INFO: Attempting to fetch users, teachers, and questions counts via Promise.all.");
        const otherStatsResults = await Promise.all([
          usersPromise,
          teachersPromise,
          questionsPromise,
        ]);
        console.log("[AdminDashboard] INFO: Successfully fetched users, teachers, and questions counts.");

        if (!isMounted) return;

        const usersResult = otherStatsResults[0];
        const teachersResult = otherStatsResults[1];
        const questionsResult = otherStatsResults[2];
        
        setStats({
          totalUsers: usersResult.totalItems,
          totalTeachers: teachersResult.totalItems,
          totalQuestions: questionsResult.totalItems,
          totalDppSolved: dppSolvedCountData.totalItems, // Use the separately fetched count
        });
        
      } catch (err: any) {
        if (isMounted) {
          console.error("[AdminDashboard] ERROR: Failed to fetch some dashboard stats:", err?.data || err?.message || err);
          setError(prevError => prevError ? `${prevError}\nCould not load some platform statistics.` : "Could not load some platform statistics.");
          // Set to 0 or keep previous if partial success for DPP
          setStats(prev => ({
            totalUsers: prev?.totalUsers ?? 0,
            totalTeachers: prev?.totalTeachers ?? 0,
            totalQuestions: prev?.totalQuestions ?? 0,
            totalDppSolved: prev?.totalDppSolved ?? 0, 
          }));
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchStats();
    return () => { isMounted = false; };
  }, []);

  const statItems = [
    { title: 'Total Users', value: stats.totalUsers, icon: <Users className="h-6 w-6 text-blue-500" />, color: "text-blue-600 dark:text-blue-400" },
    { title: 'Total Teachers', value: stats.totalTeachers, icon: <GraduationCap className="h-6 w-6 text-green-500" />, color: "text-green-600 dark:text-green-400" },
    { title: 'Total Questions', value: stats.totalQuestions, icon: <FileText className="h-6 w-6 text-purple-500" />, color: "text-purple-600 dark:text-purple-400" },
    { title: 'DPP Questions Solved', value: stats.totalDppSolved, icon: <ListChecks className="h-6 w-6 text-orange-500" />, color: "text-orange-600 dark:text-orange-400" },
  ];

  return (
    <div className="space-y-8 p-4 md:p-6">
      <Card className="shadow-xl border-l-4 border-primary">
        <CardHeader>
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-10 w-10 text-primary" />
            <div>
              <CardTitle className="text-3xl font-bold text-foreground">Admin Dashboard</CardTitle>
              <CardDescription className="text-md text-muted-foreground">
                Platform overview and management tools.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {isLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-6 w-3/4" /> 
                <Skeleton className="h-6 w-6 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-1/2 mb-1" /> 
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {error && (
        <Card className="text-center p-6 border border-destructive bg-destructive/10 rounded-md">
            <AlertTriangle className="mx-auto h-8 w-8 text-destructive mb-2" />
            <p className="text-destructive font-semibold">Error Loading Statistics</p>
            <p className="text-sm text-destructive/80 whitespace-pre-wrap">{error}</p>
        </Card>
      )}
      {!isLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statItems.map(item => (
            <Card key={item.title} className="shadow-lg hover:shadow-xl transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{item.title}</CardTitle>
                {item.icon}
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${item.color}`}>
                  {item.value === null ? <Loader2 className="h-8 w-8 animate-spin" /> : item.value}
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  {item.title === "DPP Questions Solved" ? "Total correct answers in DPP logs" : `Current count in database`}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {!isLoading && (
          <div className="mt-8 text-center">
            <p className="text-muted-foreground">
            Use the sidebar to navigate to different admin functions.
            </p>
        </div>
      )}
    </div>
  );
}
