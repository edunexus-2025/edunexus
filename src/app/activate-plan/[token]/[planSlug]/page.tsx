
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import pb from '@/lib/pocketbase';
import { Routes, AppConfig } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { UserSubscriptionTierStudent } from '@/lib/types';

// Define valid plan slugs and their corresponding PocketBase model values
const planSlugToModelMap: Record<string, UserSubscriptionTierStudent> = {
  'free': 'Free',
  'dpp': 'Dpp',
  'chapterwise': 'Chapterwise',
  'full-length': 'Full_length',
  'combo': 'Combo',
};

const validPlanSlugs = Object.keys(planSlugToModelMap);

export default function ActivatePlanPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading, authRefresh } = useAuth();
  const { toast } = useToast();

  const token = typeof params.token === 'string' ? params.token : '';
  const planSlug = typeof params.planSlug === 'string' ? params.planSlug.toLowerCase() : '';

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'redirecting'>('loading');
  const [message, setMessage] = useState<string>('Processing your plan activation...');

  const activatePlan = useCallback(async () => {
    if (authLoading) {
      return; // Wait for auth state to resolve
    }

    if (!user) {
      setMessage('You need to be logged in to activate a plan. Redirecting to login...');
      setStatus('redirecting');
      router.replace(`${Routes.login}?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    if (!token) {
        setMessage('Activation token is missing. This link might be invalid.');
        setStatus('error');
        return;
    }
    
    if (!planSlug || !validPlanSlugs.includes(planSlug)) {
      setMessage(`Invalid plan specified in the URL: "${planSlug}". Please check the link.`);
      setStatus('error');
      return;
    }

    const targetPlanModelValue = planSlugToModelMap[planSlug];

    if (user.studentSubscriptionTier === targetPlanModelValue) {
        setMessage(`You are already on the ${targetPlanModelValue} plan.`);
        setStatus('success'); // Or maybe 'info' if you have such a state
        toast({ title: "Plan Unchanged", description: `You are already subscribed to the ${targetPlanModelValue} plan.`});
        router.replace(Routes.dashboard);
        return;
    }

    setStatus('loading');
    setMessage(`Activating ${targetPlanModelValue} plan...`);

    try {
      // In a real system, the 'token' would be validated on the backend first.
      // Here, we are directly updating the user's plan based on the URL.
      await pb.collection('users').update(user.id, {
        model: targetPlanModelValue,
        // Optionally: Update expiry_date if your plans have expiry
        // expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // Example: 1 year
      });

      await authRefresh(); // Refresh user context to get updated plan

      setMessage(`Successfully upgraded to the ${targetPlanModelValue} plan! Redirecting to your dashboard...`);
      setStatus('success');
      toast({
        title: 'Plan Activated!',
        description: `Your subscription has been updated to ${targetPlanModelValue}.`,
        className: 'bg-green-500 dark:bg-green-700 text-white',
      });
      router.replace(Routes.dashboard);
    } catch (error: any) {
      console.error('Failed to activate plan:', error);
      let errorMessage = 'Could not activate the plan.';
      if (error.data?.message) {
        errorMessage += ` Details: ${error.data.message}`;
      } else if (error.message) {
        errorMessage += ` Details: ${error.message}`;
      }
      setMessage(errorMessage);
      setStatus('error');
      toast({
        title: 'Plan Activation Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  }, [authLoading, user, token, planSlug, router, toast, authRefresh]);

  useEffect(() => {
    if (!authLoading) { // Only run activatePlan once auth state is resolved
      activatePlan();
    }
  }, [authLoading, activatePlan]); // Rerun if authLoading changes

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl mb-2">
            {status === 'loading' && <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />}
            {status === 'success' && <CheckCircle className="mx-auto h-8 w-8 text-green-500" />}
            {status === 'error' && <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />}
            {status === 'redirecting' && <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />}
            <span className="block mt-2">
              {status === 'loading' && 'Processing Plan Activation'}
              {status === 'success' && 'Plan Activated!'}
              {status === 'error' && 'Activation Failed'}
              {status === 'redirecting' && 'Redirecting...'}
            </span>
          </CardTitle>
          <CardDescription>Token: <span className="font-mono text-xs bg-muted p-1 rounded">{token || "N/A"}</span></CardDescription>
          <CardDescription>Requested Plan: <span className="font-semibold">{planSlugToModelMap[planSlug] || planSlug || "N/A"}</span></CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">{message}</p>
          {(status === 'error' || status === 'redirecting') && (
            <Button onClick={() => router.push(Routes.home)} variant="outline" className="w-full mt-6">
              Go to Homepage
            </Button>
          )}
          {status === 'success' && (
            <Button onClick={() => router.push(Routes.dashboard)} className="w-full mt-6">
              Go to Dashboard
            </Button>
          )}
        </CardContent>
      </Card>
      <p className="mt-6 text-xs text-muted-foreground">
        If you encounter any issues, please contact <a href={`mailto:support@${AppConfig.appName.toLowerCase()}.com`} className="underline hover:text-primary">support</a>.
      </p>
    </div>
  );
}
