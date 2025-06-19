'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { CheckCircle, XCircle, AlertTriangle, Loader2, Info } from 'lucide-react';
import { Routes, AppConfig } from '@/lib/constants';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

function PaymentStatusContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { authRefresh } = useAuth();

  const [status, setStatus] = useState<'loading' | 'success' | 'failure' | 'error' | 'info'>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [planName, setPlanName] = useState<string | null>(null);

  useEffect(() => {
    const paymentStatus = searchParams.get('status') as typeof status | null;
    const paymentMessage = searchParams.get('message');
    const paymentOrderId = searchParams.get('order_id');
    const paymentPlanName = searchParams.get('planName');

    if (paymentStatus) setStatus(paymentStatus);
    else setStatus('info');

    setMessage(paymentMessage || null);
    setOrderId(paymentOrderId || null);
    setPlanName(paymentPlanName || null);

    // Refresh auth state to get the latest user plan details
    if (paymentStatus === 'success') {
        authRefresh();
    }
  }, [searchParams, authRefresh]);

  const renderIcon = () => {
    switch (status) {
      case 'success': return <CheckCircle className="h-16 w-16 text-green-500" />;
      case 'failure': return <XCircle className="h-16 w-16 text-red-500" />;
      case 'error': return <AlertTriangle className="h-16 w-16 text-destructive" />;
      case 'info': return <Info className="h-16 w-16 text-blue-500" />;
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
    if (message) return message;
    switch (status) {
      case 'success': return `Your subscription to the ${planName || 'selected'} plan on ${AppConfig.appName} - The Online Test Platform is now active. Welcome aboard!`;
      case 'failure': return "Your payment could not be processed. Please try again or contact support if the issue persists.";
      case 'error': return "An unexpected error occurred while processing your payment. Please contact support with your Order ID if available.";
      case 'info': return "Details regarding your payment process.";
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
            {AppConfig.appName} - The Online Test Platform - Subscription Status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-foreground/90 whitespace-pre-wrap">{renderDescription()}</p>
          {orderId && orderId !== 'N/A' && orderId !== 'N/A_FAIL' && orderId !== 'N/A_FREE' && orderId !== 'N/A_FREE_FAIL' && (
            <p className="text-xs text-muted-foreground">
              Order ID: {orderId}
            </p>
          )}
          {(status === 'error' || status === 'failure') && (
            <p className="mt-2 text-xs text-muted-foreground">
              If you believe this is an error or need assistance, please contact our support team.
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={() => router.push(Routes.dashboard)} variant="default">
            Go to Dashboard
          </Button>
          {(status === 'failure' || status === 'error') && (
            <Button onClick={() => router.push(Routes.upgrade)} variant="outline">
              Try Another Plan or Retry
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

export default function PaymentStatusPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin"/></div>}>
      <PaymentStatusContent />
    </Suspense>
  )
}
