
'use client';

import { useParams } from 'next/navigation';
import React, { useEffect, useState, useCallback } from 'react';
import pb from '@/lib/pocketbase';
import type { RecordModel } from 'pocketbase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Send, CheckCircle, EyeOff, Archive, Copy, Loader2, Info, Link as LinkIcon, KeyRound } from 'lucide-react'; // Added KeyRound
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AppConfig, Routes } from '@/lib/constants';

interface TeacherTestStatusRecord extends RecordModel {
  testName?: string;
  status?: "Draft" | "Published" | "Archived";
  teacherId?: string;
  Admin_Password?: number | null;
  Would_you_like_to_get_admin_access_through_link?: boolean;
}

const statusOptions: Array<NonNullable<TeacherTestStatusRecord['status']>> = ["Draft", "Published", "Archived"];

export default function TestStatusPage() {
  const params = useParams();
  const { teacher } = useAuth();
  const { toast } = useToast();
  const testId = typeof params.testId === 'string' ? params.testId : '';

  const [testDetails, setTestDetails] = useState<TeacherTestStatusRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const studentTestLink = testDetails?.status === "Published" ? `${AppConfig.APP_BASE_URL}${Routes.studentTeacherTest(testId)}/live` : null; // Corrected route
  const adminTestLink = testDetails?.status === "Published" && testDetails?.Would_you_like_to_get_admin_access_through_link && testDetails?.Admin_Password
    ? `${AppConfig.APP_BASE_URL}${Routes.studentTeacherTest(testId)}/live?pin=${testDetails.Admin_Password}` // Simple PIN in query for now
    : null;


  const fetchTestStatus = useCallback(async (isMountedGetter: () => boolean) => {
    if (!testId || !teacher?.id) { if (isMountedGetter()) setIsLoading(false); return; }
    if (isMountedGetter()) setIsLoading(true);
    try {
      const record = await pb.collection('teacher_tests').getOne<TeacherTestStatusRecord>(testId, {
        fields: 'id,testName,status,teacherId,Admin_Password,Would_you_like_to_get_admin_access_through_link',
      });
      if (!isMountedGetter()) return;
      if (record.teacherId !== teacher.id) { if (isMountedGetter()) setError("Unauthorized."); return; }
      setTestDetails(record);
    } catch (err: any) { if (isMountedGetter()) { console.error("Error fetching test status:", err); setError("Could not load test status."); }
    } finally { if (isMountedGetter()) setIsLoading(false); }
  }, [testId, teacher?.id]);

  useEffect(() => { let isMounted = true; fetchTestStatus(() => isMounted); return () => { isMounted = false; }; }, [fetchTestStatus]);

  const handleStatusChange = async (newStatus: TeacherTestStatusRecord['status']) => {
    if (!testId || !newStatus || !testDetails) return;
    setIsUpdating(true);
    try {
      await pb.collection('teacher_tests').update(testId, { status: newStatus });
      setTestDetails(prev => prev ? { ...prev, status: newStatus } : null);
      toast({ title: "Status Updated", description: `Test status changed to ${newStatus}.` });
    } catch (error: any) { toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    } finally { setIsUpdating(false); }
  };

  const handleCopyLink = (linkToCopy: string | null) => {
    if (linkToCopy) {
      navigator.clipboard.writeText(linkToCopy)
        .then(() => toast({ title: "Link Copied!", description: "Test link copied to clipboard." }))
        .catch(() => toast({ title: "Copy Failed", variant: "destructive" }));
    }
  };

  if (isLoading) { return (<div className="p-6 space-y-4"> <Skeleton className="h-8 w-3/4 mb-2" /> <Skeleton className="h-4 w-full" /> <Skeleton className="h-10 w-1/3 mt-4" /> <Skeleton className="h-10 w-full mt-2" /> </div>); }
  if (error) { return (<Card className="text-center border-destructive bg-destructive/10 p-6"><AlertCircle className="mx-auto h-10 w-10 text-destructive mb-3" /><CardTitle className="text-destructive">Error</CardTitle><CardDescription className="text-destructive/80">{error}</CardDescription></Card>); }
  if (!testDetails) { return <Card className="p-6 text-center"><p>Test details not found.</p></Card>; }

  return (
    <div className="p-4 md:p-6">
      <CardHeader className="px-0 pb-4">
        <CardTitle className="text-xl font-semibold flex items-center gap-2"><Send className="h-5 w-5 text-primary"/> Test Status & Sharing Options</CardTitle>
        <CardDescription>Control test visibility and access for "{testDetails.testName}".</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 px-0">
        <div>
          <Label htmlFor="testStatusSelect" className="text-sm font-medium">Test Status</Label>
          <Select value={testDetails.status} onValueChange={(value) => handleStatusChange(value as TeacherTestStatusRecord['status'])} disabled={isUpdating}>
            <SelectTrigger id="testStatusSelect" className="mt-1 bg-card"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {statusOptions.map(opt => (
                <SelectItem key={opt} value={opt}>
                  {opt === 'Draft' && <EyeOff className="inline-block h-4 w-4 mr-2 text-orange-500" />}
                  {opt === 'Published' && <CheckCircle className="inline-block h-4 w-4 mr-2 text-green-500" />}
                  {opt === 'Archived' && <Archive className="inline-block h-4 w-4 mr-2 text-gray-500" />}
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isUpdating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-2 ml-2 inline-block" />}
        </div>

        {testDetails.status === 'Published' && (
          <div className="space-y-4 p-4 border rounded-md bg-muted/30">
            <div>
                <Label className="text-sm font-medium flex items-center gap-1.5"><LinkIcon className="h-4 w-4 text-blue-500"/> Shareable Student Link</Label>
                <div className="flex items-center gap-2 mt-1">
                <Input value={studentTestLink || 'Generating link...'} readOnly className="bg-background text-xs" />
                <Button variant="outline" size="icon" onClick={() => handleCopyLink(studentTestLink)} disabled={!studentTestLink}><Copy className="h-4 w-4" /></Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Share this link with students you want to invite.
                {testDetails.Admin_Password && <span className="font-semibold text-destructive"> PIN required: {testDetails.Admin_Password}.</span>}
                {!testDetails.Admin_Password && <span className="font-semibold text-green-600"> No PIN required for students.</span>}
                </p>
            </div>
            {testDetails.Would_you_like_to_get_admin_access_through_link && adminTestLink && (
                 <div>
                    <Label className="text-sm font-medium flex items-center gap-1.5 text-purple-600"><KeyRound className="h-4 w-4"/> Admin Access Link (includes PIN)</Label>
                    <div className="flex items-center gap-2 mt-1">
                        <Input value={adminTestLink} readOnly className="bg-background text-xs border-purple-300 focus-visible:ring-purple-500" />
                        <Button variant="outline" size="icon" onClick={() => handleCopyLink(adminTestLink)} className="border-purple-400 hover:bg-purple-100"><Copy className="h-4 w-4 text-purple-600" /></Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Use this link for quick admin access to the test (e.g., for proctoring or live review). Keep it secure.</p>
                </div>
            )}
          </div>
        )}
         {testDetails.status !== 'Published' && (
            <Card className="p-4 border-dashed bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700">
                <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0"/>
                    <div>
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                            Test is currently {testDetails.status === "Draft" ? "a Draft" : "Archived"}.
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400/80">
                            {testDetails.status === "Draft" ? "Students cannot access it yet. Publish it to make it live." : "Archived tests are not accessible to new students and won't appear in listings."}
                        </p>
                    </div>
                </div>
            </Card>
        )}
      </CardContent>
    </div>
  );
}
    