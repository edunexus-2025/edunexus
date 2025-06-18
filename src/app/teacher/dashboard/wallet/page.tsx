
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
import type { StudentSubscribedPlan } from '@/lib/types'; // Import StudentSubscribedPlan

export default function TeacherWalletPage() {
  const { teacher, isLoadingTeacher, authRefresh } = useAuth(); // Added authRefresh
  const { toast } = useToast();

  const [transactions, setTransactions] = useState<StudentSubscribedPlan[]>([]);
  const [currentWalletBalance, setCurrentWalletBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWalletData = useCallback(async (isMountedGetter: () => boolean = () => true) => {
    if (!teacher?.id) {
      if (isMountedGetter()) { setIsLoading(false); setTransactions([]); setCurrentWalletBalance(0); }
      return;
    }
    if (isMountedGetter()) setIsLoading(true);
    setError(null);

    try {
      // Fetch current wallet_money from teacher_data
      const teacherRecord = await pb.collection('teacher_data').getOne(teacher.id, { fields: 'wallet_money', '$autoCancel': false });
      if (isMountedGetter()) {
        setCurrentWalletBalance(Number(teacherRecord.wallet_money) || 0);
      } else {
        return;
      }

      // Fetch transaction history from students_teachers_upgrade_plan
      const transactionRecords = await pb.collection('students_teachers_upgrade_plan').getFullList<StudentSubscribedPlan>({
        filter: `teacher = "${teacher.id}" && payment_status = "successful"`,
        sort: '-created', 
        expand: 'student(id,name),teachers_plan_id(Plan_name)', 
        '$autoCancel': false,
      });
      
      if (isMountedGetter()) {
        setTransactions(transactionRecords);
      }

    } catch (err: any) {
      if (isMountedGetter()) {
        const clientError = err as ClientResponseError;
        let errorMsg = `Could not load wallet data. Error: ${clientError.data?.message || clientError.message || 'Unknown error'}.`;
        if (clientError.status === 404) {
          errorMsg = "No wallet data or transaction history found.";
          setTransactions([]);
          // setCurrentWalletBalance will keep its value from teacher_data fetch if that succeeded
          setError(null); 
        } else if (clientError.isAbort || (clientError.name === 'ClientResponseError' && clientError.status === 0)) {
            errorMsg = "Request cancelled. Please try refreshing.";
            console.warn("TeacherWalletPage: Fetch wallet data request was cancelled.");
        } else {
          setError(errorMsg);
          toast({ title: "Error", description: errorMsg, variant: "destructive" });
        }
        console.error("TeacherWalletPage: Failed to fetch wallet data. Status:", clientError.status, "Response Data:", clientError.data, "Full Error Object:", clientError);
      }
    } finally {
      if (isMountedGetter()) setIsLoading(false);
    }
  }, [teacher?.id, toast]);

  useEffect(() => {
    let isMounted = true;
    if (!isLoadingTeacher && teacher) {
      // Initial fetch and also ensures wallet_money from AuthContext is up-to-date for initial display
      setCurrentWalletBalance(Number(teacher.wallet_money) || 0);
      fetchWalletData(() => isMounted);
    } else if (!isLoadingTeacher && !teacher) {
      setIsLoading(false);
      setError("Teacher not authenticated.");
    }
    return () => { isMounted = false; };
  }, [isLoadingTeacher, teacher, fetchWalletData]);
  
  // Refetch wallet_money specifically if auth context refreshes (e.g. after a payment)
  useEffect(() => {
      if (teacher && teacher.wallet_money !== undefined) {
          setCurrentWalletBalance(Number(teacher.wallet_money) || 0);
      }
  }, [teacher?.wallet_money]);


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
            Track your earnings from student subscriptions to your content plans, after EduNexus commissions.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <IndianRupee className="h-6 w-6 text-green-500" /> Current Available Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-green-600">
            ₹{currentWalletBalance.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            This is your net earning available for payout after EduNexus platform fees.
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
              Detailed list of payments received.
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
                    <TableHead>Student</TableHead>
                    <TableHead>Plan Subscribed</TableHead>
                    <TableHead className="text-right">Amount (Net)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => {
                    const studentName = tx.expand?.student?.name || 'Unknown Student';
                    const planName = tx.expand?.teachers_plan_id?.Plan_name || tx.teachers_plan_name_cache || 'Unknown Plan';
                    const amountNet = tx.amount_recieved_to_teacher; // This is the net amount for the teacher
                    const originalPaymentAmount = tx.amount_paid_to_edunexus + tx.amount_recieved_to_teacher; // Recalculate total

                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="text-xs">
                          {format(new Date(tx.created), "dd MMM yy, HH:mm")}
                        </TableCell>
                        <TableCell className="text-sm font-medium text-foreground">
                          {studentName}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {planName}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-green-600">
                          ₹{amountNet?.toFixed(2) || '0.00'}
                           {originalPaymentAmount > 0 && amountNet !== undefined && originalPaymentAmount !== amountNet && (
                            <p className="text-xs font-normal text-muted-foreground">(Original: ₹{originalPaymentAmount.toFixed(2)})</p>
                           )}
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
