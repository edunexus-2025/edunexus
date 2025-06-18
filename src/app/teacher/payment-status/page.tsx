
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
  const [payuId, setPayuId] = useState<string | null>(null);
  const [planName, setPlanName] = useState<string | null>(null);
  const [amount, setAmount] = useState<string | null>(null);
  const [productInfo, setProductInfo] = useState<string | null>(null);


  useEffect(() => {
    const paymentStatus = searchParams.get('status') as typeof status | null;
    const paymentMessage = searchParams.get('message');
    const txnid = searchParams.get('txnid');
    const puid = searchParams.get('payuId');
    const plan = searchParams.get('planName');
    const amt = searchParams.get('amount');
    const pInfo = searchParams.get('productInfo');


    if (paymentStatus) {
      setStatus(paymentStatus);
    } else {
      setStatus('info'); 
    }
    setMessage(paymentMessage || null);
    setTransactionId(txnid || null);
    setPayuId(puid || null);
    setPlanName(plan || null);
    setAmount(amt || null);
    setProductInfo(pInfo || null);

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
      case 'success': return "Payment Successful!";
      case 'failure': return "Payment Failed";
      case 'error': return "Payment Processing Error";
      case 'info': return "Payment Information";
      default: return "Processing Payment...";
    }
  };

  const renderDescription = () => {
    switch (status) {
      case 'success': return `Your upgrade to the ${planName || 'selected'} plan was successful. Your account has been updated.`;
      case 'failure': return message || "Your payment could not be processed. Please try again or contact support if the issue persists.";
      case 'error': return message || "An error occurred while processing your payment. Please contact support with your transaction ID if available.";
      case 'info': return message || "There was an issue with the payment process or some information is missing.";
      default: return "Please wait while we confirm your payment status.";
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 dark:bg-slate-950 p-4">
      <Card className="w-full max-w-lg text-center shadow-xl">
        <CardHeader>
          <div className="mx-auto mb-4">{renderIcon()}</div>
          <CardTitle className="text-2xl">{renderTitle()}</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            {AppConfig.appName} - Teacher Plan Upgrade
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-foreground/90 whitespace-pre-wrap">{renderDescription()}</p>
          {transactionId && transactionId !== 'N/A' && (
            <p className="text-xs text-muted-foreground">
              Your Transaction ID: {transactionId}
            </p>
          )}
           {payuId && payuId !== 'N/A' && (
            <p className="text-xs text-muted-foreground">
              PayU Transaction ID: {payuId}
            </p>
          )}
          {status === 'success' && planName && amount && parseFloat(amount) > 0 && productInfo && (
            <div className="mt-3 text-xs text-muted-foreground border-t pt-3">
                <p><strong>Plan:</strong> {planName}</p>
                <p><strong>Amount Paid:</strong> ₹{parseFloat(amount).toFixed(2)}</p>
                <p><strong>Details:</strong> {productInfo}</p>
            </div>
          )}
          {status === 'error' && (
            <p className="mt-2 text-xs text-muted-foreground">
              If you believe this is an error, please contact support with your transaction ID.
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
