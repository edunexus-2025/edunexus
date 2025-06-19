'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle, Star, ShoppingBag, Loader2, Tag, TimerIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import type { UserSubscriptionTierStudent, UserSubscriptionTierTeacher, User, Plan } from '@/lib/types';
import pb from '@/lib/pocketbase';
import type { RecordModel } from 'pocketbase';
import { AppConfig, Routes, studentPlansData, escapeForPbFilter } from '@/lib/constants';
import { format, isPast } from 'date-fns'; // Import isPast

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface PromoCodeRecord extends RecordModel {
  refferal_name: string;
  discount: number;
  plan_for: UserSubscriptionTierStudent[];
  plan_by?: UserSubscriptionTierStudent[];
  expiry_date?: string;
}


export default function UpgradePage() {
  const { user, authRefresh } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoCodeRecord | null>(null);
  const [isVerifyingPromo, setIsVerifyingPromo] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoExpiryCountdown, setPromoExpiryCountdown] = useState<string | null>(null);
  const [processingPaymentForPlan, setProcessingPaymentForPlan] = useState<string | null>(null);

  const currentUserTier = user?.studentSubscriptionTier;

  const handleApplyPromoCode = async () => {
    if (!promoCodeInput.trim()) {
      setPromoError("Please enter a promo code.");
      return;
    }
    setIsVerifyingPromo(true);
    setPromoError(null);
    setAppliedPromo(null);
    setPromoExpiryCountdown(null);

    try {
      const promoRecord = await pb.collection('students_refferals_edunexus_plan')
        .getFirstListItem<PromoCodeRecord>(`refferal_name = "${escapeForPbFilter(promoCodeInput.trim().toUpperCase())}"`);

      if (promoRecord.expiry_date && isPast(new Date(promoRecord.expiry_date))) {
        setPromoError("This promo code has expired.");
        toast({ title: "Promo Expired", description: "This promo code is no longer valid.", variant: "destructive" });
        setIsVerifyingPromo(false);
        return;
      }

      let isEligibleByPlan = true;
      if (promoRecord.plan_by && Array.isArray(promoRecord.plan_by) && promoRecord.plan_by.length > 0 && currentUserTier) {
        const planByRequiredForPromo = promoRecord.plan_by as UserSubscriptionTierStudent[];
        const validStudentTiersForCheck: UserSubscriptionTierStudent[] = ['Free', 'Dpp', 'Chapterwise', 'Full_length', 'Combo'];
        if (validStudentTiersForCheck.includes(currentUserTier)) {
          if (!planByRequiredForPromo.includes(currentUserTier)) {
            isEligibleByPlan = false;
          }
        } else {
          isEligibleByPlan = false;
        }
      }

      if (!isEligibleByPlan) {
        setPromoError(`This promo code is not applicable with your current plan (${currentUserTier || 'N/A'}).`);
        setAppliedPromo(promoRecord);
        toast({ title: "Promo Not Applicable", description: `This code isn't valid for your current subscription tier.`, variant: "default" });
        setIsVerifyingPromo(false);
        return;
      }

      setAppliedPromo(promoRecord);
      const validDiscountAmount = (promoRecord.discount !== null && promoRecord.discount !== undefined && !isNaN(Number(promoRecord.discount)))
                                  ? Number(promoRecord.discount)
                                  : 0;
      if (validDiscountAmount > 0) {
        toast({ title: "Promo Code Applied!", description: `You've got a ${validDiscountAmount}% discount on eligible plans!` });
      } else {
        toast({ title: "Promo Code Applied!", description: `Code "${promoRecord.refferal_name}" valid, but may not offer a percentage discount or apply to all plans shown.`, variant: "default", duration: 7000 });
      }
    } catch (error: any) {
      if (error.status === 404) {
        setPromoError("Invalid promo code.");
        toast({ title: "Invalid Promo Code", description: "The entered code was not found.", variant: "destructive" });
      } else {
        setPromoError("Could not verify promo code. Please try again.");
        toast({ title: "Verification Error", description: "Something went wrong.", variant: "destructive" });
      }
    } finally {
      setIsVerifyingPromo(false);
    }
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (appliedPromo?.expiry_date) {
      const calculateTimeLeft = () => {
        const difference = +new Date(appliedPromo.expiry_date!) - +new Date();
        if (difference <= 0) { setPromoExpiryCountdown("Expired"); if (intervalId) clearInterval(intervalId); return; }
        const d = Math.floor(difference / (1000*60*60*24)); const h = Math.floor((difference / (1000*60*60)) % 24);
        const m = Math.floor((difference / 1000 / 60) % 60); const s = Math.floor((difference / 1000) % 60);
        const parts = []; if (d > 0) parts.push(`${d}d`); if (h > 0 || (d>0&&(m>0||s>0))) parts.push(`${h}h`);
        if (m > 0 || ((d>0||h>0)&&s>0)) parts.push(`${m}m`); if (d===0&&h===0&&m===0) parts.push(`${s}s`); else if (d===0&&h===0&&m>0&&s>0) parts.push(`${s}s`);
        setPromoExpiryCountdown(parts.length > 0 ? `Expires in: ${parts.join(' ')}` : "Expiring soon!");
      };
      calculateTimeLeft(); intervalId = setInterval(calculateTimeLeft, 1000);
    } else { setPromoExpiryCountdown(null); }
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [appliedPromo]);

  const clientSideUpdateUserPlan = async (userId: string, newPlanId: UserSubscriptionTierStudent) => {
    console.log(`[UpgradePage CLIENT] Attempting to update user ${userId} to plan ${newPlanId}`);
    try {
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1); // 1 year validity
      const updateData = {
        model: newPlanId,
        expiry_date: expiryDate.toISOString(),
      };
      await pb.collection('users').update(userId, updateData);
      console.log(`[UpgradePage CLIENT] Successfully updated user ${userId} plan to ${newPlanId} in PocketBase.`);
      await authRefresh(); // Refresh auth state to reflect new plan
      return true;
    } catch (error: any) {
      console.error(`[UpgradePage CLIENT] Error updating user ${userId} plan to ${newPlanId} in PocketBase:`, error.data || error);
      toast({
        title: "Plan Update Failed (Client)",
        description: `Could not update your plan in the database: ${error.data?.message || error.message}. Please contact support.`,
        variant: "destructive",
        duration: 10000,
      });
      return false;
    }
  };

  const handleInitiatePayment = async (plan: Plan, finalPrice: number) => {
    if (!user || !user.id) {
      toast({ title: "Login Required", description: "Please log in to upgrade your plan.", variant: "destructive" });
      router.push(Routes.login);
      return;
    }
    setProcessingPaymentForPlan(plan.id);

    if (finalPrice <= 0 && plan.id !== 'Free') {
      toast({ title: "Free Plan Enrollment", description: "This plan is free or became free with promo. Processing enrollment...", variant: "default" });
      const updateSuccess = await clientSideUpdateUserPlan(user.id, plan.id as UserSubscriptionTierStudent);
      if (updateSuccess) {
        router.push(Routes.paymentStatusPage('N/A_FREE_ENROLL', 'success', plan.name, `Successfully enrolled in ${plan.name} plan!`));
      } else {
        router.push(Routes.paymentStatusPage('N/A_FREE_ENROLL_FAIL', 'error', plan.name, `Failed to enroll in ${plan.name} plan. Please contact support.`));
      }
      setProcessingPaymentForPlan(null);
      return;
    }
    if (plan.id === 'Free') {
      toast({ title: "Already on Free Plan", description: "No upgrade needed for the free plan.", variant: "default" });
      setProcessingPaymentForPlan(null);
      return;
    }

    const razorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    if (!razorpayKeyId) {
      console.error("[UpgradePage] CRITICAL ERROR: Razorpay Key ID not configured.");
      toast({ title: "Payment Error", description: "Payment gateway client key missing.", variant: "destructive" });
      setProcessingPaymentForPlan(null);
      return;
    }

    const amountForApi = parseFloat(finalPrice.toFixed(2));
    if (isNaN(amountForApi) || amountForApi <= 0) {
        toast({ title: "Payment Error", description: `Invalid amount: ${finalPrice}.`, variant: "destructive" });
        setProcessingPaymentForPlan(null); return;
    }

    try {
      const orderResponse = await fetch('/api/razorpay/create-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountForApi, currency: 'INR', planId: plan.id, userId: user.id, userType: 'student_platform_plan', productDescription: `${AppConfig.appName} - The Online Test Platform Plan - ${plan.name}` }),
      });
      const responseText = await orderResponse.text();
      if (!orderResponse.ok) {
        let errorData = { error: `Server error (${orderResponse.status}): ${responseText || 'Failed to create order.'}` };
        try { errorData = JSON.parse(responseText); } catch (e) {} throw new Error(errorData.error);
      }
      const order = JSON.parse(responseText);

      const options = {
        key: razorpayKeyId, amount: order.amount, currency: order.currency, name: `${AppConfig.appName} - The Online Test Platform`, description: `Upgrade to ${plan.name} Plan`, order_id: order.id,
        handler: async (response: any) => {
          toast({ title: "Payment Initiated", description: "Verifying your payment..." });
          try {
            const verificationResponse = await fetch('/api/razorpay/verify-payment', { method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature,
                                      planId: order.notes.planId, userId: order.notes.userId, userType: order.notes.userType }),
            });
            const verificationData = await verificationResponse.json();
            if (verificationResponse.ok && verificationData.verified && verificationData.status === 'success') {
              console.log("[UpgradePage CLIENT] Payment verified by server. Verified Data:", verificationData);
              toast({ title: "Payment Verified", description: "Updating your plan..." });
              // Use verified user ID and plan ID from server response
              const planUpdateSuccess = await clientSideUpdateUserPlan(verificationData.userId, verificationData.planId as UserSubscriptionTierStudent);
              if (planUpdateSuccess) {
                router.push(Routes.paymentStatusPage(verificationData.order_id, 'success', verificationData.planId, verificationData.message || 'Plan activated!'));
              } else {
                router.push(Routes.paymentStatusPage(verificationData.order_id, 'error', verificationData.planId, "Payment successful, but plan update failed. Contact support."));
              }
            } else {
              router.push(Routes.paymentStatusPage(response.razorpay_order_id, 'failure', plan.name, verificationData.error || "Payment verification failed."));
            }
          } catch (verifyError: any) { router.push(Routes.paymentStatusPage(response.razorpay_order_id, 'error', plan.name, verifyError.message || "Verification error.")); }
          setProcessingPaymentForPlan(null);
        },
        prefill: { name: user.name || "", email: user.email || "", contact: user.phoneNumber || "" },
        notes: { plan_id: plan.id, user_id: user.id, user_type: 'student_platform_plan', app_name: `${AppConfig.appName} - The Online Test Platform` },
        theme: { color: "#3F51B5" }, modal: { ondismiss: () => { toast({ title: "Payment Cancelled" }); setProcessingPaymentForPlan(null); } }
      };
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response: any) => { toast({ title: "Payment Failed", description: `Error: ${response.error.description}`, variant: "destructive" }); setProcessingPaymentForPlan(null); });
      rzp.open();
    } catch (error: any) {
      if (error.name === 'TypeError' && error.message.toLowerCase().includes('failed to fetch')) {
        toast({ title: "Network Error", description: "Could not connect to payment server.", variant: "destructive", duration: 7000 });
      } else {
        toast({ title: "Payment Setup Error", description: error.message || "Could not initiate.", variant: "destructive" });
      }
      setProcessingPaymentForPlan(null);
    }
  };

  return (
    <div className="space-y-8 p-4 md:p-8">
      <Card className="shadow-lg border-none bg-transparent">
        <CardHeader className="text-center items-center">
          <ShoppingBag className="h-12 w-12 text-primary mb-3" />
          <CardTitle className="text-3xl md:text-4xl font-bold text-foreground">{AppConfig.appName} Subscription Plans</CardTitle>
          <CardDescription className="text-md md:text-lg text-muted-foreground max-w-xl">
            Choose the perfect plan from The Online Test Platform to supercharge your exam preparation.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="max-w-md mx-auto shadow-md">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Tag className="h-5 w-5 text-primary"/>Have a Promo Code?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2 items-start">
            <Input
              placeholder="Enter Code (e.g., GODWIN50)" value={promoCodeInput}
              onChange={(e) => { setPromoCodeInput(e.target.value.toUpperCase()); setPromoError(null); if(appliedPromo && e.target.value.toUpperCase() !== appliedPromo.refferal_name){ setAppliedPromo(null); setPromoExpiryCountdown(null);}}}
              className="flex-grow"
            />
            <Button onClick={handleApplyPromoCode} disabled={isVerifyingPromo || !promoCodeInput.trim()} className="w-full sm:w-auto">
              {isVerifyingPromo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Apply
            </Button>
          </div>
          {promoError && <p className="text-sm text-destructive mt-2">{promoError}</p>}
          {appliedPromo && !promoError && (
            <div className="text-sm text-green-600 mt-2 space-y-1">
              <p className="flex items-center gap-1">
                <CheckCircle className="inline h-4 w-4" /> Promo "{appliedPromo.refferal_name}" applied!
                {(appliedPromo.discount > 0) ? ` You get ${appliedPromo.discount}% off eligible plans.` : ` Code valid.`}
              </p>
              {promoExpiryCountdown && (<p className={cn("flex items-center gap-1 text-xs", promoExpiryCountdown === "Expired" ? "text-red-600 font-semibold" : "text-orange-600")}><TimerIcon className="inline h-3.5 w-3.5" /> {promoExpiryCountdown}</p>)}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch">
        {studentPlansData.map((plan) => {
          let finalPriceValue = Number(plan.priceValue);
          let discountAppliedInfoBadge = null; let actualDiscountPercentageApplied = 0;
          const isPlanEligibleForPromo = appliedPromo && finalPriceValue > 0 && appliedPromo.plan_for.includes(plan.id as UserSubscriptionTierStudent) && (!appliedPromo.expiry_date || !isPast(new Date(appliedPromo.expiry_date)));
          if (isPlanEligibleForPromo) {
            actualDiscountPercentageApplied = Number(appliedPromo!.discount);
            if (actualDiscountPercentageApplied > 0) {
              finalPriceValue -= (finalPriceValue * actualDiscountPercentageApplied) / 100;
              discountAppliedInfoBadge = (<Badge variant="secondary" className="bg-green-100 text-green-700 text-xs px-2 py-0.5 absolute -top-2 -left-2 transform -rotate-6 shadow-sm z-10">{actualDiscountPercentageApplied}% OFF!</Badge>);
            }
          }
          const hasActiveDiscountApplied = actualDiscountPercentageApplied > 0 && Number(plan.priceValue) > 0 && isPlanEligibleForPromo;
          const originalPriceString = `₹${Number(plan.priceValue).toFixed(0)}`; const effectivePriceString = `₹${Math.max(0, finalPriceValue).toFixed(0)}`; // Ensure price isn't negative
          const isCurrentActivePlan = currentUserTier === plan.id;

          return (
            <Card key={plan.id} className={cn("flex flex-col rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out relative overflow-hidden", plan.isRecommended && !hasActiveDiscountApplied && "border-2 border-primary ring-2 ring-primary/50", isCurrentActivePlan && "bg-primary/5", hasActiveDiscountApplied && "border-2 border-green-500 ring-2 ring-green-500/50")}>
              {plan.isRecommended && !discountAppliedInfoBadge && (<Badge variant="default" className="absolute top-4 right-4 bg-primary text-primary-foreground text-xs px-3 py-1 shadow-md z-10"><Star className="h-3 w-3 mr-1 fill-current" /> Recommended</Badge>)}
              {discountAppliedInfoBadge}
              <CardHeader className="p-6 bg-card"><CardTitle className={cn("text-xl font-semibold mb-1", isCurrentActivePlan && !hasActiveDiscountApplied && "text-primary", hasActiveDiscountApplied && "text-green-600")}>{plan.name}</CardTitle><CardDescription className={cn("text-sm min-h-[3rem]", isCurrentActivePlan ? "text-primary opacity-90" : "text-card-foreground opacity-80")}>{plan.description}</CardDescription>
                 <div className="mt-4">{hasActiveDiscountApplied ? (<div className="flex flex-col items-start"><div className="flex items-baseline gap-2"><span className="text-3xl font-bold text-green-600">{effectivePriceString}</span><span className={cn("text-lg line-through", isCurrentActivePlan ? "text-primary/60" : "text-muted-foreground")}>{originalPriceString}</span></div><span className={cn("text-sm ml-1", isCurrentActivePlan ? "text-primary opacity-80" : "text-card-foreground opacity-70")}>{plan.priceSuffix}</span></div>)
                    : (<div><span className={cn("text-3xl font-bold", isCurrentActivePlan ? "text-primary" : "text-foreground")}>{originalPriceString}</span><span className={cn("text-sm ml-1", isCurrentActivePlan ? "text-primary opacity-80" : "text-card-foreground opacity-70")}>{plan.priceSuffix}</span></div>)}
                  </div>
              </CardHeader>
              <CardContent className="flex-grow p-6 space-y-3 bg-card"><p className="text-xs font-semibold text-card-foreground opacity-60 uppercase tracking-wider">FEATURES</p><ul className="space-y-2">{plan.features.map((feature, index) => (<li key={index} className="flex items-start gap-2"><CheckCircle className={cn("h-5 w-5 mt-0.5 flex-shrink-0", isCurrentActivePlan && !hasActiveDiscountApplied ? "text-primary": (hasActiveDiscountApplied ? "text-green-500" : "text-green-500") )} /><span className={cn("text-sm", isCurrentActivePlan ? "text-primary opacity-90" : "text-card-foreground opacity-90")}>{feature}</span></li>))}</ul></CardContent>
              <CardFooter className="p-6 mt-auto bg-card border-t">
                {isCurrentActivePlan ? (<Button className="w-full" disabled variant="outline">Current Plan ({plan.name})</Button>)
                : (<Button className={cn("w-full text-base py-3", plan.isRecommended && !hasActiveDiscountApplied && "bg-primary hover:bg-primary/90 text-primary-foreground", hasActiveDiscountApplied && "bg-green-600 hover:bg-green-700 text-white")} onClick={() => handleInitiatePayment(plan, Math.max(0, finalPriceValue))} variant={(plan.isRecommended && !hasActiveDiscountApplied) || hasActiveDiscountApplied ? "default" : "secondary"} disabled={processingPaymentForPlan === plan.id || (plan.id === 'Free' && currentUserTier === 'Free')}>
                    {processingPaymentForPlan === plan.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {processingPaymentForPlan === plan.id ? 'Processing...' : (plan.id === 'Free' ? 'Current Plan' : plan.ctaText)}</Button>)}
              </CardFooter>
            </Card>
          );
        })}
      </div>
      <p className="text-center text-xs text-muted-foreground pt-4">All prices are inclusive of applicable taxes. Subscriptions are typically for a one-year period. For support, contact <a href={`mailto:support@${AppConfig.appName.toLowerCase().replace(/\s+/g, '')}.com`} className="text-primary hover:underline">support@{AppConfig.appName.toLowerCase().replace(/\s+/g, '')}.com</a>.</p>
    </div>
  );
}
