
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Routes, AppConfig, slugify } from "@/lib/constants";
import Image from "next/image";
import { MessageSquare, Users, ChevronRight, Zap, BookOpen, TrendingUp, Star, Atom, Loader2, AlertTriangle, Info } from "lucide-react"; 
import type { UserSubscriptionTierStudent, DiscussionGroup } from '@/lib/types';
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useCallback, useMemo } from "react";
import pb from '@/lib/pocketbase';
import type { RecordModel } from 'pocketbase';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Ensure Alert is imported

// Define mapping from EduNexus_plan value to icon
const appWideGroupIcons: Record<string, React.ElementType> = {
  'Free': Users,
  'Dpp': Zap,
  'Chapterwise': BookOpen,
  'Full Length': TrendingUp, 
  'Combo': Star,
  'default': MessageSquare, // Fallback icon
};

interface DiscussionGroupDataRecord extends RecordModel {
  group_name: string;
  group_description?: string;
  EduNexus_plan?: UserSubscriptionTierStudent | 'Full Length'; 
  teacher?: string; 
  students?: string[]; 
}

export default function DiscussionForumPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [appWideGroupsFromDb, setAppWideGroupsFromDb] = useState<DiscussionGroup[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [errorLoadingGroups, setErrorLoadingGroups] = useState<string | null>(null);

  const fetchAppWideGroups = useCallback(async (isMountedGetter: () => boolean = () => true) => {
    if (!isMountedGetter()) return;
    setIsLoadingGroups(true);
    setErrorLoadingGroups(null);

    try {
      const records = await pb.collection('discussion_groups_data').getFullList<DiscussionGroupDataRecord>({
        filter: 'EduNexus_plan != "" && EduNexus_plan != null', 
      });

      if (isMountedGetter()) {
        const mappedGroups: DiscussionGroup[] = records.map(record => {
          const planValue = record.EduNexus_plan || 'default';
          return {
            id: slugify(planValue), 
            db_id: record.id, 
            name: record.group_name,
            description: record.group_description || `Discussions related to the ${planValue} plan.`,
            type: 'app_plan',
            icon: appWideGroupIcons[planValue] || appWideGroupIcons['default'],
            requiredTier: planValue as UserSubscriptionTierStudent | 'Full Length', 
          };
        });
        setAppWideGroupsFromDb(mappedGroups);
      }
    } catch (err: any) {
      if (isMountedGetter()) {
        console.error("Failed to fetch app-wide discussion groups:", err);
        setErrorLoadingGroups("Could not load app-wide discussion groups. Please try again later.");
      }
    } finally {
      if (isMountedGetter()) setIsLoadingGroups(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchAppWideGroups(() => isMounted);
    return () => { isMounted = false; };
  }, [fetchAppWideGroups]);

  const visibleAppWideGroups = useMemo(() => {
    if (!user || !user.studentSubscriptionTier) return [];

    const currentUserTier = user.studentSubscriptionTier;

    return appWideGroupsFromDb.filter(group => {
      if (!group.requiredTier) return false; 

      
      const requiredTierNormalized = group.requiredTier === 'Full Length' ? 'Full_length' : group.requiredTier;

      switch (currentUserTier) {
        case 'Free':
          return requiredTierNormalized === 'Free';
        case 'Dpp':
          return ['Free', 'Dpp'].includes(requiredTierNormalized as string);
        case 'Chapterwise':
          return ['Free', 'Chapterwise'].includes(requiredTierNormalized as string);
        case 'Full_length':
          return ['Free', 'Full_length'].includes(requiredTierNormalized as string);
        case 'Combo':
          return true; 
        default:
          return false;
      }
    });
  }, [user, appWideGroupsFromDb]);


  if (authLoading || isLoadingGroups) {
    return (
      <div className="space-y-8 p-4 md:p-6">
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-3">
              <MessageSquare className="h-8 w-8 text-primary" />
              <div>
                <Skeleton className="h-8 w-64 mb-2" />
                <Skeleton className="h-4 w-80" />
              </div>
            </div>
          </CardHeader>
        </Card>
        <div className="space-y-4">
          <Skeleton className="h-6 w-48 mb-2" />
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-56" />
                </div>
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 md:p-6">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-3xl font-bold text-foreground">Discussion Forum</CardTitle>
              <CardDescription>
                Engage with peers, ask questions, and share knowledge across different groups.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Alert variant="info" className="mt-4">
            <Info className="h-5 w-5" />
            <AlertTitle className="font-semibold">Important Note</AlertTitle>
            <AlertDescription className="text-xs">
              For doubts related to specific questions from test series or those given by your teacher,
              please use the "Report" feature on the respective test result/question review page for a more targeted resolution.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <section>
        <h2 className="text-2xl font-semibold mb-4 text-primary border-b pb-2">App-Wide Plan Groups</h2>
        {errorLoadingGroups && (
          <div className="text-center p-6 border border-destructive bg-destructive/10 rounded-md">
            <AlertTriangle className="mx-auto h-8 w-8 text-destructive mb-2" />
            <p className="text-destructive font-semibold">Error loading groups:</p>
            <p className="text-sm text-destructive/80">{errorLoadingGroups}</p>
          </div>
        )}
        {!errorLoadingGroups && visibleAppWideGroups.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleAppWideGroups.map((group) => (
              <Link key={group.id} href={Routes.discussionForumGroup(group.id)} passHref>
                <Card className="bg-card rounded-xl shadow-md hover:shadow-xl hover:bg-primary/5 transition-all duration-300 ease-in-out transform hover:-translate-y-1 cursor-pointer group h-full flex flex-col">
                  <CardHeader className="flex-shrink-0 pt-6 px-6 pb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-3 bg-primary/10 rounded-lg group-hover:bg-accent/10 transition-colors">
                        {group.icon ? <group.icon className="h-8 w-8 text-primary group-hover:text-accent-foreground transition-colors" /> : <Atom className="h-8 w-8 text-primary group-hover:text-accent-foreground transition-colors" />}
                      </div>
                      <CardTitle className="text-xl text-foreground group-hover:text-primary transition-colors duration-300">{group.name}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow px-6 pb-4">
                    <p className="text-sm text-muted-foreground">{group.description}</p>
                  </CardContent>
                  <CardFooter className="mt-auto pt-4 pb-6 px-6 border-t border-border">
                    <div className="flex items-center justify-between w-full text-primary group-hover:font-semibold group-hover:text-primary transition-all duration-300">
                      <span>Enter Group</span>
                      <ChevronRight className="h-5 w-5 transform transition-transform duration-300 group-hover:translate-x-1 group-hover:text-primary" />
                    </div>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          !errorLoadingGroups && <p className="text-muted-foreground">No app-wide discussion groups available for your current plan, or none have been set up by the admin.</p>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold mb-4 text-primary border-b pb-2">Your Teacher Groups</h2>
        <div className="flex flex-col items-center justify-center text-center p-10 border-2 border-dashed rounded-lg">
          <Image 
            src="https://placehold.co/300x200.png" 
            alt="Teacher Groups Coming Soon" 
            width={300} 
            height={200} 
            className="mb-4 rounded-md"
            data-ai-hint="teacher student group"
          />
          <p className="text-xl font-semibold text-muted-foreground">Feature Coming Soon!</p>
          <p className="text-sm text-muted-foreground">
            Groups created by your teachers or that you're a part of will appear here.
          </p>
        </div>
      </section>
    </div>
  );
}
