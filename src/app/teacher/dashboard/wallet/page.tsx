
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from '@/contexts/AuthContext';
import pb from '@/lib/pocketbase';
import type { RecordModel, ClientResponseError } from 'pocketbase';
import { useToast } from '@/hooks/use-toast';
import { Wallet as WalletIcon, RefreshCw, AlertCircle, TrendingUp, IndianRupee, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import { Routes } from '@/lib/constants';

interface TeacherWalletTransaction extends RecordModel {
  id: string;
  teacher: string;
  student_histroy?: string; // ID of students_teachers_upgrade_plan record
  total_amount_recieved: number;
  by_which_plan_recieved?: string; // ID of teachers_upgrade_plan record
  transaction_date: string;
  transaction_details?: string;
  created: string;
  expand?: {
    student_histroy?: {
      student: string;
      teachers_plan_id: string;
      amount_recieved_to_teacher: number; // Use this for display
      created: string;
      expand?: {
        student?: { name: string };
        teachers_plan_id?: { Plan_name: string };
      }
    };
    by_which_plan_recieved?: {
      Plan_name: string;
    }
  }
}

export default function TeacherWalletPage() {
  const { teacher, isLoadingTeacher } = useAuth();
  const { toast } = useToast();

  const [transactions, setTransactions] = useState<TeacherWalletTransaction[]>([]);
  const [totalEarnings, setTotalEarnings] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWalletData = useCallback(async (isMountedGetter: () => boolean = () => true) => {
    if (!teacher?.id) {
      if (isMountedGetter()) { setIsLoading(false); setTransactions([]); setTotalEarnings(0); }
      return;
    }
    if (isMountedGetter()) setIsLoading(true);
    setError(null);

    try {
      const records = await pb.collection('teacher_wallet').getFullList<TeacherWalletTransaction>({
        filter: `teacher = "${teacher.id}"`,
        sort: '-transaction_date', // Show newest first
        expand: 'student_histroy.student,student_histroy.teachers_plan_id,by_which_plan_recieved',
      });
      
      if (isMountedGetter()) {
        setTransactions(records);
        const sum = records.reduce((acc, curr) => acc + (curr.total_amount_recieved || 0), 0);
        setTotalEarnings(sum);
      }

    } catch (err: any) {
      if (isMountedGetter()) {
        const clientError = err as ClientResponseError;
        let errorMsg = `Could not load wallet data. Error: ${clientError.data?.message || clientError.message || 'Unknown error'}.`;
        if (clientError.status === 404) {
          errorMsg = "No wallet data found. It seems you haven't received any payments yet.";
          // Set to empty state rather than error if 404
          setTransactions([]);
          setTotalEarnings(0);
          setError(null); // Clear previous errors if any
        } else {
          setError(errorMsg);
          toast({ title: "Error", description: errorMsg, variant: "destructive" });
        }
        console.error("TeacherWalletPage: Failed to fetch wallet data:", clientError.data || clientError);
      }
    } finally {
      if (isMountedGetter()) setIsLoading(false);
    }
  }, [teacher?.id, toast]);

  useEffect(() => {
    let isMounted = true;
    if (!isLoadingTeacher && teacher) {
      fetchWalletData(() => isMounted);
    } else if (!isLoadingTeacher && !teacher) {
      setIsLoading(false);
      setError("Teacher not authenticated.");
    }
    return () => { isMounted = false; };
  }, [isLoadingTeacher, teacher, fetchWalletData]);

  if (isLoadingTeacher || isLoading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Card className="shadow-lg"><CardHeader><Skeleton className="h-10 w-3/4" /><Skeleton className="h-6 w-1/2 mt-2" /></CardHeader></Card>
        <Card className="shadow-lg"><CardHeader><Skeleton className="h-8 w-1/4 mb-2" /><Skeleton className="h-6 w-1/2" /></CardHeader>
          <CardContent><Skeleton className="h-10 w-full" /><div className="mt-4 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Card className="shadow-lg bg-gradient-to-r from-primary to-accent text-primary-foreground">
        <CardHeader>
          <CardTitle className="text-3xl flex items-center gap-2">
            <WalletIcon className="h-8 w-8" /> My Wallet
          </CardTitle>
          <CardDescription className="text-primary-foreground/80">
            Track your earnings from student subscriptions to your content plans.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <IndianRupee className="h-6 w-6 text-green-500" /> Total Earnings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-green-600">
            ₹{totalEarnings.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            This is the sum of all 'Amount Received to Teacher' from student plan purchases.
          </p>
        </CardContent>
        <CardFooter>
          <Button variant="outline" size="sm" onClick={() => alert("Withdrawal functionality coming soon!")}>
            Request Payout (Coming Soon)
          </Button>
        </CardFooter>
      </Card>

      <Card className="shadow-md">
        <CardHeader className="flex flex-row justify-between items-center">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" /> Transaction History
            </CardTitle>
            <CardDescription>
              Detailed list of payments received from student subscriptions.
            </CardDescription>
          </div>
           <Button variant="ghost" size="icon" onClick={() => fetchWalletData(() => true)} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent>
          {error && !isLoading && (
            <Card className="text-center p-6 bg-destructive/10 border-destructive">
              <AlertCircle className="mx-auto h-10 w-10 text-destructive mb-3" />
              <CardTitle className="text-destructive">Error Loading Transactions</CardTitle>
              <CardDescription className="text-destructive/80 whitespace-pre-wrap">{error}</CardDescription>
            </Card>
          )}
          {!error && !isLoading && transactions.length === 0 && (
            <div className="text-center p-6 border-dashed rounded-md">
              <IndianRupee className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No transactions found yet.</p>
              <p className="text-xs text-muted-foreground mt-1">When students subscribe to your plans, earnings will appear here.</p>
            </div>
          )}
          {!error && !isLoading && transactions.length > 0 && (
            <ScrollArea className="max-h-[500px] pr-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => {
                    const studentName = tx.expand?.student_histroy?.expand?.student?.name || 'Unknown Student';
                    const planNameFromWallet = tx.expand?.by_which_plan_recieved?.Plan_name;
                    const planNameFromStudentHistory = tx.expand?.student_histroy?.expand?.teachers_plan_id?.Plan_name;
                    const planName = planNameFromWallet || planNameFromStudentHistory || 'Unknown Plan';
                    const amount = tx.total_amount_recieved;

                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="text-xs">
                          {format(new Date(tx.transaction_date || tx.created), "dd MMM yyyy, HH:mm")}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-medium text-foreground">
                            {tx.transaction_details || `Payment from ${studentName} for "${planName}"`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Ref: {tx.expand?.student_histroy?.id ? (
                               <Link href={Routes.teacherStudentPerformance + `?studentId=${tx.expand.student_histroy.expand?.student?.id || ''}&transactionId=${tx.expand.student_histroy.id}`} 
                                     className="hover:underline text-blue-500"
                                     title="View transaction details (Coming Soon)">
                                 {tx.expand.student_histroy.id.substring(0, 8)}... <ExternalLink className="inline h-3 w-3 opacity-70"/>
                               </Link>
                            ) : tx.id.substring(0,8)}...
                          </p>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-green-600">
                          ₹{amount?.toFixed(2) || '0.00'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
