'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Routes, AppConfig } from '@/lib/constants';
import Link from 'next/link';

function PaymentStatusContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'failure' | 'error' | 'info'>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  // Removed PayU specific params like payuId, planName, amount, productInfo as Razorpay flow doesn't use this page directly for success/failure.
  // This page can now act as a generic status display if redirected to after client-side verification.

  useEffect(() => {
    const paymentStatus = searchParams.get('status') as typeof status | null;
    const paymentMessage = searchParams.get('message');
    const txnid = searchParams.get('txnid'); // Could be Razorpay order ID or payment ID if passed

    if (paymentStatus) {
      setStatus(paymentStatus);
    } else {
      setStatus('info'); 
    }
    setMessage(paymentMessage || null);
    setTransactionId(txnid || null);

  }, [searchParams]);

  const renderIcon = () => {
    switch (status) {
      case 'success': return <CheckCircle className="h-16 w-16 text-green-500" />;
      case 'failure': return <XCircle className="h-16 w-16 text-red-500" />;
      case 'error': return <AlertTriangle className="h-16 w-16 text-destructive" />;
      case 'info': return <AlertTriangle className="h-16 w-16 text-blue-500" />;
      default: return <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />;
    }
  };

  const renderTitle = () => {
    switch (status) {
      case 'success': return "Payment Processed Successfully!";
      case 'failure': return "Payment Failed";
      case 'error': return "Payment Processing Error";
      case 'info': return "Payment Information";
      default: return "Processing...";
    }
  };

  const renderDescription = () => {
    switch (status) {
      case 'success': return message || `Your payment was successful. Your plan should be updated shortly.`;
      case 'failure': return message || "Your payment could not be processed. Please try again or contact support.";
      case 'error': return message || "An error occurred while processing your payment. Please contact support.";
      case 'info': return message || "Payment process information.";
      default: return "Please wait.";
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 dark:bg-slate-950 p-4">
      <Card className="w-full max-w-lg text-center shadow-xl">
        <CardHeader>
          <div className="mx-auto mb-4">{renderIcon()}</div>
          <CardTitle className="text-2xl">{renderTitle()}</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            {AppConfig.appName} - Payment Status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-foreground/90 whitespace-pre-wrap">{renderDescription()}</p>
          {transactionId && transactionId !== 'N/A' && (
            <p className="text-xs text-muted-foreground">
              Reference ID: {transactionId}
            </p>
          )}
          {status === 'error' && (
            <p className="mt-2 text-xs text-muted-foreground">
              If you believe this is an error, please contact support.
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={() => router.push(Routes.teacherDashboard)} variant="default">
            Go to Teacher Dashboard
          </Button>
          {(status === 'failure' || status === 'error') && (
            <Button onClick={() => router.push(Routes.teacherUpgradePlatformPlan)} variant="outline">
              Try Another Plan
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}


export default function TeacherPaymentStatusPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin"/></div>}>
      <PaymentStatusContent />
    </Suspense>
  )
}