
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import pb from '@/lib/pocketbase'; // Keep for authRefresh potential, but not direct plan update
import { Routes, AppConfig, teacherPlatformPlansData } from '@/lib/constants';
import { Loader2, Star, CheckCircle, ArrowLeft, Zap, ShieldCheck, Crown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { Plan, UserSubscriptionTierTeacher } from '@/lib/types'; 
import { cn } from '@/lib/utils';

// Razorpay window augmentation
declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function TeacherUpgradePlatformPlanPage() {
  const { teacher, isLoadingTeacher, authRefresh } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isProcessingPayment, setIsProcessingPayment] = useState<string | null>(null);

  const currentTeacherTier = teacher?.teacherSubscriptionTier || 'Free';
  const currentAdsSubscription = teacher?.ads_subscription || 'Free';


  const handleUpgrade = async (plan: Plan) => {
    if (plan.customActivationLink) {
      router.push(plan.customActivationLink);
      return;
    }

    if (!teacher || !teacher.id || !teacher.email || !teacher.name || !teacher.phoneNumber) {
      toast({ 
        title: "Profile Incomplete", 
        description: "Your teacher profile (name, email, or phone) is incomplete. Please update it in settings before upgrading.", 
        variant: "destructive",
        duration: 7000 
      });
      setIsProcessingPayment(null);
      return;
    }

    if (plan.id === currentTeacherTier) {
      toast({ title: "No Change", description: "This is already your current plan.", variant: "default" });
      return;
    }
    if (plan.id === 'Free') {
        toast({title: "Free Plan", description: "No payment needed for the free plan. If you wish to downgrade, contact support.", variant: "default"});
        return;
    }

    setIsProcessingPayment(plan.id);

    const razorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    if (!razorpayKeyId) {
      console.error("[TeacherUpgradePage] CRITICAL ERROR: Razorpay Key ID is not configured.");
      toast({ title: "Payment Error", description: "Payment gateway client key is not configured. Contact support.", variant: "destructive" });
      setIsProcessingPayment(null);
      return;
    }

    const amountForApi = parseFloat(plan.priceValue.toFixed(2));
    if (isNaN(amountForApi) || amountForApi <= 0) {
        toast({ title: "Payment Error", description: `Invalid amount for payment: ${plan.priceValue}.`, variant: "destructive" });
        setIsProcessingPayment(null);
        return;
    }

    try {
      const orderResponse = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount: amountForApi, 
          currency: 'INR', 
          planId: plan.id, 
          userId: teacher.id,
          userType: 'teacher_platform_plan', // Differentiates from student platform plan
          productDescription: `${AppConfig.appName} Teacher Plan - ${plan.name}`
        }),
      });

      const responseText = await orderResponse.text();
      if (!orderResponse.ok) {
        let errorData = { error: `Server error (${orderResponse.status}): ${responseText || 'Failed to create Razorpay order.'}` };
        try { errorData = JSON.parse(responseText); } catch (e) { /* Keep errorData as is */ }
        throw new Error(errorData.error || `Failed to create Razorpay order (status: ${orderResponse.status})`);
      }

      const order = JSON.parse(responseText);

      const options = {
        key: razorpayKeyId,
        amount: order.amount, // Amount from Razorpay order (in paisa)
        currency: order.currency,
        name: AppConfig.appName,
        description: `Upgrade to ${plan.name} Teacher Plan`,
        order_id: order.id,
        handler: async (response: any) => {
          toast({ title: "Payment Initiated", description: "Verifying your payment..." });
          try {
            const verificationResponse = await fetch('/api/razorpay/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: order.id, // Use order.id obtained from create-order
                razorpay_signature: response.razorpay_signature,
                // Pass notes back to verification
                planId: plan.id,
                userId: teacher.id,
                userType: 'teacher_platform_plan',
                productDescription: `${AppConfig.appName} Teacher Plan - ${plan.name}`
              }),
            });
            // The verify-payment route now redirects to /activate-plan which handles the DB update & authRefresh
            // So, we don't expect JSON here directly for plan update status, but for the redirect.
            if (verificationResponse.ok && verificationResponse.redirected) {
                // If redirection happened, it means verify-payment likely created an activation token.
                // The new page /activate-plan will handle the final DB update and user feedback.
                // No specific client-side update needed here, as the redirected page will manage it.
                // If not redirected but ok, it might be an old flow, log it.
                 console.log("Payment verified, server redirected to activation page.");
            } else if (verificationResponse.ok && !verificationResponse.redirected) {
                 console.warn("Payment verified, but server did not redirect. This might be an old verification flow. User might need to refresh manually or visit dashboard.");
                 toast({ title: "Payment Verified", description: "Your payment was verified. Please check your dashboard for plan updates."});
                 await authRefresh();
                 router.push(Routes.teacherDashboard);

            } else {
                 const verificationData = await verificationResponse.json().catch(() => ({ error: "Could not parse verification error response."}));
                 toast({ title: "Payment Verification Failed", description: verificationData.error || "Please contact support.", variant: "destructive" });
            }
          } catch (verifyError: any) {
            toast({ title: "Verification Error", description: verifyError.message || "An error occurred.", variant: "destructive" });
          }
          setIsProcessingPayment(null);
        },
        prefill: {
          name: teacher.name || "",
          email: teacher.email || "",
          contact: teacher.phoneNumber || "",
        },
        notes: {
          plan_id: plan.id,
          user_id: teacher.id,
          user_type: 'teacher_platform_plan',
          app_name: AppConfig.appName,
        },
        theme: { color: "#3F51B5" },
        modal: { ondismiss: () => { toast({ title: "Payment Cancelled", variant: "default" }); setIsProcessingPayment(null); } }
      };
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response: any) => {
        toast({ title: "Payment Failed", description: `Error: ${response.error.description} (Code: ${response.error.code})`, variant: "destructive" });
        setIsProcessingPayment(null);
      });
      rzp.open();
    } catch (error: any) {
      toast({ title: "Payment Setup Error", description: error.message || "Could not initiate payment.", variant: "destructive" });
      setIsProcessingPayment(null);
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
          <CardTitle className="text-3xl font-bold text-primary">Teacher Platform Plans</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Choose a plan that best suits your teaching needs on {AppConfig.appName}.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
        {teacherPlatformPlansData.map((plan) => {
          const isCurrentPlatformTier = currentTeacherTier === plan.id && plan.id !== 'Ads Model';
          const isCurrentAdsModel = plan.id === 'Ads Model' && currentAdsSubscription === 'Ads Model';
          const isCurrent = isCurrentPlatformTier || isCurrentAdsModel;
          
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
                   {plan.commissionRate !== undefined && plan.id !== 'Ads Model' && (
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
                  {plan.id !== 'Ads Model' && plan.maxContentPlans !== undefined && <li><ShieldCheck className="inline h-5 w-5 mr-1.5 text-primary/70" /> Max {plan.maxContentPlans} Content Plans</li>}
                  {plan.id !== 'Ads Model' && plan.qbAccess !== undefined && <li><Zap className="inline h-5 w-5 mr-1.5 text-primary/70" /> QB Access: {plan.qbAccess ? 'Full EduNexus QB' : 'Limited/Own QB'}</li>}
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
                    disabled={isProcessingPayment === plan.id || isLoadingTeacher}
                  >
                    {isProcessingPayment === plan.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isProcessingPayment === plan.id ? 'Processing...' : plan.ctaText || 'Upgrade Plan'}
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
