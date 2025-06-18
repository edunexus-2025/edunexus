
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import pb from '@/lib/pocketbase';
import { Routes, AppConfig, teacherPlatformPlansData } from '@/lib/constants';
import { Loader2, Star, CheckCircle, ArrowLeft, Zap, ShieldCheck, Crown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { Plan } from '@/lib/types'; 
import { cn } from '@/lib/utils';
// crypto-js is not needed on the client for standard PayU hash generation (done backend)

// PayU requires a unique transaction ID for each attempt
const generateTransactionId = () => `EDUNEXUS_TEACHER_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

export default function TeacherUpgradePlatformPlanPage() {
  const { teacher, isLoadingTeacher, authRefresh } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isProcessingUpgrade, setIsProcessingUpgrade] = useState<string | null>(null);

  const currentTeacherTier = teacher?.teacherSubscriptionTier || 'Free';

  const handleUpgrade = async (plan: Plan) => {
    if (!teacher?.id || !teacher.email || !teacher.name || !teacher.phoneNumber) {
      toast({ title: "Error", description: "Teacher details missing (name, email, phone). Please complete your profile.", variant: "destructive" });
      return;
    }

    if (plan.id === currentTeacherTier) {
      toast({ title: "No Change", description: "This is already your current plan.", variant: "default" });
      return;
    }

    setIsProcessingUpgrade(plan.id);

    const payUKey = process.env.NEXT_PUBLIC_PAYU_KEY;
    // PAYU_PAYMENT_URL is not prefixed with NEXT_PUBLIC_ because form submission happens server-side (or should)
    // For client-side JS submission (like Razorpay SDK), it might be needed.
    // However, for a standard HTML form post, the action URL is what matters.
    // The backend API `/api/payu/initiate-teacher-plan-payment` will receive this if needed, or use its own env var.
    const payUPaymentUrlFromServer = process.env.PAYU_PAYMENT_URL || 'https://secure.payu.in/_payment'; // Fallback for server
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL || window.location.origin;

    if (!payUKey || !appBaseUrl) {
      toast({ title: "Configuration Error", description: "PayU settings are missing. Contact support.", variant: "destructive" });
      setIsProcessingUpgrade(null);
      return;
    }
    
    const amount = String(plan.priceValue.toFixed(2));
    const productinfo = `${AppConfig.appName} Teacher Plan - ${plan.name}`;
    const firstname = teacher.name.split(' ')[0] || 'Teacher';
    const email = teacher.email;
    const phone = teacher.phoneNumber.replace(/\D/g, ''); // Remove non-digits
    const txnid = generateTransactionId();
    // These URLs point to our backend API route that will handle the PayU response
    const surl = `${appBaseUrl}/api/payu/handle-teacher-plan-response`;
    const furl = `${appBaseUrl}/api/payu/handle-teacher-plan-response`;
    
    const paymentDataForBackend = {
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      phone,
      surl,
      furl,
      planId: plan.id, // To identify which plan was chosen
      teacherId: teacher.id, // To identify the teacher
    };

    try {
      const response = await fetch('/api/payu/initiate-teacher-plan-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentDataForBackend),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to parse error response from server." }));
        throw new Error(errorData.error || `Failed to initiate payment (status: ${response.status})`);
      }

      const payuFormData = await response.json(); // This should contain key, hash, and other params

      // Create a dynamic form and submit it
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = payUPaymentUrlFromServer; // Use the PayU URL

      for (const key in payuFormData) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = payuFormData[key];
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
      // The page will redirect to PayU. No need to set isProcessingUpgrade to null here.
    } catch (error: any) {
      console.error("Failed to initiate PayU payment:", error);
      toast({ title: "Payment Initiation Failed", description: error.message || "Could not start the payment process.", variant: "destructive" });
      setIsProcessingUpgrade(null);
    }
  };
  
  if (isLoadingTeacher) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-8 w-1/3 mb-4" />
        <Card className="shadow-lg">
          <CardHeader><Skeleton className="h-10 w-3/4" /><Skeleton className="h-6 w-1/2 mt-2" /></CardHeader>
          <CardContent className="space-y-4">{[...Array(3)].map((_, i) => (<Skeleton key={i} className="h-48 w-full" />))}</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <Button variant="outline" onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <Zap className="mx-auto h-12 w-12 text-primary mb-3" />
          <CardTitle className="text-3xl font-bold text-primary">Upgrade Your Teacher Platform Plan</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Unlock more features, reach more students, and grow with {AppConfig.appName}.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {teacherPlatformPlansData.map((plan) => {
          const isCurrent = currentTeacherTier === plan.id;
          return (
            <Card
              key={plan.id}
              className={cn(
                "flex flex-col rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out overflow-hidden",
                isCurrent && "border-2 border-green-500 ring-2 ring-green-500/50 bg-green-500/5",
                plan.isRecommended && !isCurrent && "border-2 border-primary"
              )}
            >
              {isCurrent && (
                <div className="bg-green-500 text-white text-xs font-semibold uppercase tracking-wider py-1 px-3 text-center">
                  Current Plan
                </div>
              )}
              {plan.isRecommended && !isCurrent && (
                  <div className="bg-primary text-primary-foreground text-xs font-semibold uppercase tracking-wider py-1 px-3 text-center flex items-center justify-center gap-1">
                     <Crown className="h-3.5 w-3.5"/> Recommended
                  </div>
              )}
              <CardHeader className="p-6">
                <CardTitle className={cn("text-2xl font-bold mb-1", isCurrent ? "text-green-600" : plan.isRecommended ? "text-primary" : "text-foreground")}>{plan.name}</CardTitle>
                <CardDescription className="text-sm min-h-[3rem]">{plan.description}</CardDescription>
                 <div className="mt-4">
                    <span className={cn("text-4xl font-extrabold", isCurrent ? "text-green-700" : plan.isRecommended ? "text-primary" : "text-foreground")}>
                      {plan.price}
                    </span>
                    <span className="text-sm ml-1 text-muted-foreground">{plan.priceSuffix}</span>
                  </div>
                   {plan.commissionRate !== undefined && (
                    <p className="text-xs text-muted-foreground mt-1">EduNexus Commission: {plan.commissionRate}%</p>
                  )}
              </CardHeader>
              <CardContent className="flex-grow p-6 space-y-3 bg-card">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">FEATURES</p>
                <ul className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className={cn("h-5 w-5 mt-0.5 flex-shrink-0", isCurrent ? "text-green-500" : plan.isRecommended ? "text-primary" : "text-green-500" )} />
                      <span className="text-sm text-foreground/90">{feature}</span>
                    </li>
                  ))}
                  {plan.maxContentPlans !== undefined && <li><ShieldCheck className="inline h-5 w-5 mr-1.5 text-primary/70" /> Max {plan.maxContentPlans} Content Plans</li>}
                  <li><Zap className="inline h-5 w-5 mr-1.5 text-primary/70" /> QB Access: {plan.qbAccess ? 'Full EduNexus QB' : 'Limited/Own QB'}</li>

                </ul>
              </CardContent>
              <CardFooter className="p-6 mt-auto border-t">
                {isCurrent ? (
                  <Button className="w-full" disabled variant="outline">
                    Your Current Plan
                  </Button>
                ) : (
                  <Button
                    className={cn("w-full text-base py-3", plan.isRecommended && "bg-primary hover:bg-primary/90 text-primary-foreground")}
                    onClick={() => handleUpgrade(plan)}
                    variant={plan.isRecommended ? "default" : "secondary"}
                    disabled={isProcessingUpgrade === plan.id || isLoadingTeacher}
                  >
                    {isProcessingUpgrade === plan.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isProcessingUpgrade === plan.id ? 'Processing...' : plan.ctaText || 'Upgrade Plan'}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
