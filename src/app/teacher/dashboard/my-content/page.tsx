
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Filter, ListChecks, PlusCircle, ChevronRight, Info } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateTestModal } from '@/components/teacher/CreateTestModal';
import pb from '@/lib/pocketbase';
import type { RecordModel } from 'pocketbase';
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { Routes } from "@/lib/constants";


interface TeacherTestItem {
  id: string;
  testName: string;
  model: "Chapterwise" | "Full Length";
  type: "Free" | "Premium";
  status: "Draft" | "Published" | "Archived";
  created: string;
}

export default function TeacherMyContentPage() {
  const { teacher, isLoading: isLoadingTeacher } = useAuth();
  const [tests, setTests] = useState<TeacherTestItem[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [isLoadingTests, setIsLoadingTests] = useState(true);
  const { toast } = useToast();

  const fetchTeacherTests = useCallback(async () => {
    let isMounted = true;
    if (!teacher?.id) {
      if (isMounted) {
        setIsLoadingTests(false);
        setTests([]);
      }
      return;
    }

    if (isMounted) setIsLoadingTests(true);

    try {
      const records = await pb.collection('teacher_tests').getFullList<RecordModel>({
        filter: `teacherId = "${teacher.id}"`,
        sort: '-created',
      });

      if (isMounted) {
        const mappedTests: TeacherTestItem[] = records.map(record => ({
          id: record.id,
          testName: record.testName,
          model: record.model as TeacherTestItem['model'],
          type: record.type as TeacherTestItem['type'],
          status: record.status as TeacherTestItem['status'],
          created: record.created,
        }));
        setTests(mappedTests);
      }
    } catch (error: any) {
      if (isMounted) {
        if (error?.isAbort || (error?.name === 'ClientResponseError' && error?.status === 0)) {
          console.warn('Fetch teacher tests request was cancelled.');
        } else {
          console.error("Failed to fetch teacher tests:", error);
          toast({ title: "Error Fetching Tests", description: error.message || "Could not load your tests.", variant: "destructive" });
        }
      }
    } finally {
      if (isMounted) {
        setIsLoadingTests(false);
      }
    }
  }, [teacher?.id, toast]); 

  useEffect(() => {
    if (!isLoadingTeacher) {
      fetchTeacherTests();
    }
  }, [isLoadingTeacher, fetchTeacherTests]);


  const handleDeleteTest = async (testId: string) => {
    const originalTests = [...tests];
    setTests(prevTests => prevTests.filter(test => test.id !== testId));
    
    try {
      await pb.collection('teacher_tests').delete(testId);
      toast({ title: "Test Deleted", description: "The test has been successfully removed." });
    } catch (error: any) {
      console.error("Failed to delete test:", error);
      setTests(originalTests);
      toast({ title: "Error Deleting Test", description: error.message || "Could not delete the test.", variant: "destructive" });
    }
  };

  const filteredTests = tests.filter(test => {
    if (filter === "all") return true;
    if (filter === "drafts") return test.status === "Draft";
    if (filter === "published") return test.status === "Published";
    if (filter === "archived") return test.status === "Archived";
    return true; 
  });


  if (isLoadingTeacher && isLoadingTests) { 
    return (
        <div className="space-y-6 p-4 md:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="space-y-1">
                    <Skeleton className="h-9 w-64" />
                    <Skeleton className="h-4 w-80" />
                </div>
                <Skeleton className="h-10 w-40 rounded-md" />
            </div>
            <div className="flex justify-start mb-6">
                <Skeleton className="h-10 w-52 rounded-md" />
            </div>
            <div className="space-y-4">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
        </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <Card className="shadow-lg border-none">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-2xl md:text-3xl font-bold text-foreground">
                My Content & Tests
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Manage your created tests and educational materials here.
              </CardDescription>
              <CardDescription className="text-xs text-muted-foreground mt-2 italic flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-primary/70" />
                <span>For creating a test on a single chapter, select "Chapterwise" as the model. For tests covering multiple lessons or a full syllabus, use the "Full Length" model.</span>
              </CardDescription>
            </div>
             <CreateTestModal onTestCreated={fetchTeacherTests} />
          </div>
        </CardHeader>
      </Card>

      <div className="flex justify-start mb-6">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-full sm:w-[200px] bg-card border-border text-foreground shadow-sm">
            <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="Filter tests..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tests</SelectItem>
            <SelectItem value="drafts">Drafts</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="archived">Archived</SelectItem> 
          </SelectContent>
        </Select>
      </div>

      {isLoadingTests && tests.length === 0 ? ( 
         <div className="space-y-4">
            {[...Array(3)].map((_, i) => <Skeleton key={`load-test-${i}`} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : filteredTests.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {filteredTests.map((test, index) => (
            <Link key={test.id} href={Routes.teacherTestPanel(test.id)} passHref>
              <Card className="rounded-lg shadow-md bg-card text-foreground overflow-hidden transition-all duration-300 hover:shadow-xl border hover:border-primary/30 group cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 sm:gap-4 flex-grow min-w-0">
                    <span className="text-lg font-semibold text-primary/70 group-hover:text-primary">{String(index + 1).padStart(2, '0')}</span>
                    {/* ThumbsUp icon removed from here */}
                    <div className="min-w-0">
                      <p className="text-sm sm:text-base font-medium truncate text-foreground group-hover:text-primary" title={test.testName}>{test.testName}</p>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2 gap-y-1 items-center mt-1">
                          <span>{test.model}</span>
                          <span className="text-muted-foreground/50">&bull;</span>
                          <span>{test.type}</span>
                          <span className="text-muted-foreground/50">&bull;</span>
                          <span className={`font-medium ${test.status === 'Draft' ? 'text-orange-500' : test.status === 'Published' ? 'text-green-500' : 'text-gray-500'}`}>{test.status}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.preventDefault(); 
                        handleDeleteTest(test.id);
                      }}
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-full"
                      aria-label={`Delete ${test.testName}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-transform duration-200 group-hover:translate-x-0.5"/>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 bg-card rounded-lg shadow-md border">
          <ListChecks className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold text-foreground">No tests found.</h3>
          <p className="text-muted-foreground">
            {filter === 'all' ? "You haven't created any tests yet." : `No tests match the filter "${filter}".`}
          </p>
        </div>
      )}
    </div>
  );
}
