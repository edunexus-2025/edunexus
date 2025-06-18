
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Routes, AppConfig } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';

// This unslugify is a simple placeholder, adjust if your slugification is more complex
const unslugifyPlan = (slug: string): string => {
    if (!slug) return "Selected Plan";
    if (slug === 'full-length') return 'Full_length'; // Handle specific case
    return slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};


export default function ActivatePlanPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading, authRefresh } = useAuth();
  const { toast } = useToast();

  const token = typeof params.token === 'string' ? params.token : '';
  const planSlug = typeof params.planSlug === 'string' ? params.planSlug : ''; // Keep original slug for display

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'redirecting' | 'info'>('loading');
  const [message, setMessage] = useState<string>('Verifying your activation link...');

  const activatePlanWithToken = useCallback(async () => {
    if (!token) {
        setMessage('Activation token is missing. This link might be invalid or expired.');
        setStatus('error');
        return;
    }
    
    setStatus('loading');
    setMessage(`Activating your ${unslugifyPlan(planSlug)} plan... Please wait.`);

    try {
      const response = await fetch('/api/activate-plan-from-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      let data;
      const responseText = await response.text();
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Failed to parse JSON response from /api/activate-plan-from-token:", responseText, parseError);
        setMessage(`Activation processing error: Could not understand server response. Please contact support. (RAW: ${responseText.substring(0,100)})`);
        setStatus('error');
        toast({
          title: 'Activation Error',
          description: 'Server returned an unreadable response. Please contact support.',
          variant: 'destructive',
        });
        // No automatic redirect on critical parse error, user needs to see message.
        return;
      }
      

      if (response.ok && data.success) {
        setMessage(data.message || `Successfully activated the ${unslugifyPlan(planSlug)} plan! Redirecting to your dashboard...`);
        setStatus('success');
        await authRefresh(); // Refresh auth state immediately
        toast({
          title: 'Plan Activated!',
          description: data.message || `Your subscription to ${unslugifyPlan(planSlug)} is now active.`,
          className: 'bg-green-500 dark:bg-green-700 text-white',
        });
        // Redirect to payment status page for consistency, which will then redirect to dashboard
        router.replace(Routes.paymentStatusPage(token, 'success', planSlug, data.message || `Plan ${unslugifyPlan(planSlug)} activated!`));
      } else {
        setMessage(data.message || 'Could not activate the plan using this link. It may be invalid, expired, or already used.');
        setStatus('error');
        toast({
          title: 'Plan Activation Failed',
          description: data.message || 'Please try again or contact support if the issue persists.',
          variant: 'destructive',
        });
         // Redirect to payment status page for consistency on error too
        router.replace(Routes.paymentStatusPage(token, 'error', planSlug, data.message || 'Plan activation failed.'));
      }
    } catch (error: any) {
      console.error('Failed to activate plan via token:', error);
      const errorMessage = error.message || 'An unexpected network error occurred. Please try again.';
      setMessage(`An unexpected error occurred: ${errorMessage}`);
      setStatus('error');
      toast({
        title: 'Activation Error',
        description: `An unexpected error occurred during activation: ${errorMessage}`,
        variant: 'destructive',
      });
      router.replace(Routes.paymentStatusPage(token, 'error', planSlug, `Activation error: ${errorMessage}`));
    }
  }, [token, planSlug, router, toast, authRefresh]); // Added planSlug

  useEffect(() => {
    // No user check here, token activation can happen for logged-out users if desired,
    // but the API performing the update will require its own auth (admin).
    // The authRefresh() after success will update the current user's state if they are logged in.
    activatePlanWithToken();
  }, [activatePlanWithToken]); 

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl mb-2">
            {status === 'loading' && <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />}
            {status === 'success' && <CheckCircle className="mx-auto h-8 w-8 text-green-500" />}
            {status === 'error' && <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />}
            {status === 'info' && <ShieldCheck className="mx-auto h-8 w-8 text-blue-500" />}
            <span className="block mt-2">
              {status === 'loading' && 'Processing Plan Activation'}
              {status === 'success' && 'Plan Activated!'}
              {status === 'error' && 'Activation Failed'}
              {status === 'info' && 'Activation Link'}
            </span>
          </CardTitle>
          <CardDescription>Token: <span className="font-mono text-xs bg-muted p-1 rounded">{token.substring(0,10) || "N/A"}...</span></CardDescription>
          <CardDescription>Requested Plan: <span className="font-semibold">{unslugifyPlan(planSlug) || "N/A"}</span></CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">{message}</p>
          {(status === 'error' || status === 'info') && ( 
            <Button onClick={() => router.push(user ? Routes.dashboard : Routes.home)} variant="outline" className="w-full mt-6">
              {user ? 'Go to Dashboard' : 'Go to Homepage'}
            </Button>
          )}
          {/* Success state now auto-redirects via useEffect, button might not be seen much */}
        </CardContent>
      </Card>
      <p className="mt-6 text-xs text-muted-foreground">
        If you encounter any issues, please contact <a href={`mailto:support@${AppConfig.appName.toLowerCase().replace(/\s+/g, '')}.com`} className="underline hover:text-primary">support</a>.
      </p>
    </div>
  );
}
    
    