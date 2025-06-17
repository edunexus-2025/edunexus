
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
import type { UserSubscriptionTierStudent, UserSubscriptionTierTeacher, User, Plan } from '@/lib/types'; // Import Plan
import pb from '@/lib/pocketbase';
import type { RecordModel } from 'pocketbase';
import { AppConfig, escapeForPbFilter, Routes, studentPlansData } from '@/lib/constants'; // Import studentPlansData
// import { formatDistanceToNowStrict } from 'date-fns'; // Can be used for simpler countdown

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


  const currentUserTier = user?.role === 'Teacher' ? user.teacherSubscriptionTier : user?.studentSubscriptionTier;

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

      if (promoRecord.expiry_date && new Date(promoRecord.expiry_date) < new Date()) {
        setPromoError("This promo code has expired.");
        toast({ title: "Promo Expired", description: "This promo code is no longer valid.", variant: "destructive" });
        setIsVerifyingPromo(false);
        return;
      }

      let isEligibleByPlan = true;
      if (promoRecord.plan_by && Array.isArray(promoRecord.plan_by) && promoRecord.plan_by.length > 0 && currentUserTier) {
        const normalizedPlanByRequiredForPromo = promoRecord.plan_by.map(p => p === 'Full Length' ? 'Full_length' : p) as UserSubscriptionTierStudent[];
        
        const validStudentTiersForCheck: UserSubscriptionTierStudent[] = ['Free', 'Dpp', 'Chapterwise', 'Full_length', 'Combo'];
        if (validStudentTiersForCheck.includes(currentUserTier as UserSubscriptionTierStudent)) {
          if (!normalizedPlanByRequiredForPromo.includes(currentUserTier as UserSubscriptionTierStudent)) {
            isEligibleByPlan = false;
          }
        } else {
          isEligibleByPlan = false;
        }
      }


      if (!isEligibleByPlan) {
        setPromoError(`This promo code is not applicable with your current plan (${currentUserTier || 'N/A'}).`);
        setAppliedPromo(promoRecord);
        toast({ title: "Promo Not Applicable To Your Current Plan", description: `This code isn't valid for your current subscription tier.`, variant: "default" });
        setIsVerifyingPromo(false);
        return;
      }
      
      setAppliedPromo(promoRecord);
      const validDiscountAmount = (promoRecord.discount !== null && promoRecord.discount !== undefined && !isNaN(Number(promoRecord.discount)))
                                  ? Number(promoRecord.discount)
                                  : 0;

      if (validDiscountAmount > 0) {
        toast({
          title: "Promo Code Applied!",
          description: `You've got a ${validDiscountAmount}% discount on eligible plans!`
        });
      } else {
        toast({
          title: "Promo Code Applied!",
          description: `Promo code "${promoRecord.refferal_name}" is valid, but it may not offer a percentage discount or apply to all plans currently shown.`,
          variant: "default",
          duration: 7000,
        });
      }

    } catch (error: any) {
      if (error.status === 404) {
        setPromoError("Invalid promo code.");
        toast({ title: "Invalid Promo Code", description: "The entered code was not found.", variant: "destructive" });
      } else {
        setPromoError("Could not verify promo code. Please try again.");
        toast({ title: "Verification Error", description: "Something went wrong.", variant: "destructive" });
      }
      console.error("Error applying promo code:", error);
    } finally {
      setIsVerifyingPromo(false);
    }
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (appliedPromo && appliedPromo.expiry_date) {
      const calculateTimeLeft = () => {
        const difference = +new Date(appliedPromo.expiry_date!) - +new Date();
        if (difference <= 0) {
          setPromoExpiryCountdown("Expired");
          if (intervalId) clearInterval(intervalId);
          return;
        }

        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((difference / 1000 / 60) % 60);
        const seconds = Math.floor((difference / 1000) % 60);
        
        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0 || (days > 0 && (minutes > 0 || seconds > 0) ) ) parts.push(`${hours}h`);
        if (minutes > 0 || ( (days > 0 || hours > 0) && seconds > 0) ) parts.push(`${minutes}m`);
        if (days === 0 && hours === 0 && minutes === 0) parts.push(`${seconds}s`);
        else if (days === 0 && hours === 0 && minutes > 0 && seconds > 0) parts.push(`${seconds}s`);


        setPromoExpiryCountdown(parts.length > 0 ? `Expires in: ${parts.join(' ')}` : "Expiring very soon!");
      };

      calculateTimeLeft();
      intervalId = setInterval(calculateTimeLeft, 1000);
    } else {
      setPromoExpiryCountdown(null);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [appliedPromo]);

  const handleInitiatePayment = async (plan: Plan, finalPrice: number) => {
    if (!user || !user.id) {
      toast({ title: "Login Required", description: "Please log in to upgrade your plan.", variant: "destructive" });
      router.push(Routes.login);
      return;
    }

    console.log(`[UpgradePage] INFO: Initiating payment for plan "${plan.name}", finalPrice: ${finalPrice}, User ID: ${user.id}`);
    
    if (finalPrice <= 0 && plan.id !== 'Free') {
       toast({ title: "Free Plan Selected", description: "This plan is already free or became free with promo. Upgrading...", variant: "default" });
       await updatePlanInPocketBase(user, plan.id as UserSubscriptionTierStudent);
       return;
    }
    if (plan.id === 'Free') {
        toast({title: "Already on Free Plan", description: "No upgrade needed for the free plan.", variant: "default"});
        return;
    }

    setProcessingPaymentForPlan(plan.id);

    const razorpayKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    if (!razorpayKeyId) {
      console.error("[UpgradePage] CRITICAL ERROR: Razorpay Key ID (NEXT_PUBLIC_RAZORPAY_KEY_ID) is not configured in client-side environment variables.");
      toast({ title: "Payment Error", description: "Payment gateway client key is not configured. Please contact support.", variant: "destructive" });
      setProcessingPaymentForPlan(null);
      return;
    }

    const amountForApi = parseFloat(finalPrice.toFixed(2)); // Ensure it's a clean number
    if (isNaN(amountForApi) || amountForApi <= 0) {
        toast({ title: "Payment Error", description: `Invalid amount calculated for payment: ${finalPrice}. Please check plan pricing or promo codes.`, variant: "destructive" });
        setProcessingPaymentForPlan(null);
        return;
    }

    try {
      console.log(`[UpgradePage] INFO: Sending request to /api/razorpay/create-order. Payload:`, { amount: amountForApi, currency: 'INR', planId: plan.id, userId: user.id });
      const orderResponse = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountForApi, currency: 'INR', planId: plan.id, userId: user.id }),
      });

      console.log(`[UpgradePage] INFO: Raw response status from /api/razorpay/create-order: ${orderResponse.status}`);
      const responseText = await orderResponse.text(); // Get raw response text first
      console.log(`[UpgradePage] INFO: Raw response text from /api/razorpay/create-order:`, responseText);


      if (!orderResponse.ok) {
        let errorData = { error: `Server error (${orderResponse.status}): ${responseText || 'Failed to create Razorpay order.'}` };
        try {
          errorData = JSON.parse(responseText); // Try to parse as JSON
        } catch (e) {
          // Keep errorData as is if JSON parsing fails
        }
        console.error(`[UpgradePage] ERROR: API response not OK (${orderResponse.status}). Error data/text:`, errorData);
        throw new Error(errorData.error || `Failed to create Razorpay order (status: ${orderResponse.status})`);
      }

      const order = JSON.parse(responseText); // Parse the text response to JSON
      console.log('[UpgradePage] INFO: Successfully parsed order from API:', order);


      const options = {
        key: razorpayKeyId,
        amount: order.amount,
        currency: order.currency,
        name: AppConfig.appName,
        description: `Upgrade to ${plan.name} Plan`,
        order_id: order.id,
        method: { // ✅ This object explicitly enables payment methods
          upi: true,
          card: true,
          netbanking: true,
          wallet: true
        },
        handler: async (response: any) => {
          console.log("[UpgradePage] DEBUG: Razorpay payment successful client response:", response);
          toast({ title: "Payment Initiated", description: "Verifying your payment..." });

          try {
            const verificationResponse = await fetch('/api/razorpay/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verificationData = await verificationResponse.json();
            console.log("[UpgradePage] DEBUG: Payment verification response from API:", verificationData);


            if (verificationResponse.ok && verificationData.verified) {
              toast({ title: "Payment Successful & Verified!", description: "Processing your upgrade..." });
              await updatePlanInPocketBase(user, plan.id as UserSubscriptionTierStudent);
            } else {
              toast({ title: "Payment Verification Failed", description: verificationData.error || "Your payment could not be verified. Please contact support.", variant: "destructive" });
            }
          } catch (verifyError: any) {
            console.error("[UpgradePage] ERROR: Error during payment verification fetch:", verifyError);
            toast({ title: "Payment Verification Error", description: verifyError.message || "An error occurred during payment verification.", variant: "destructive" });
          }
          setProcessingPaymentForPlan(null);
        },
        prefill: {
          name: user.name || "",
          email: user.email || "",
          contact: user.phoneNumber || "",
        },
        notes: {
          plan_id: plan.id,
          user_id: user.id,
          app_name: AppConfig.appName,
        },
        theme: {
          color: "#3F51B5",
        },
        modal: {
          ondismiss: () => {
            toast({ title: "Payment Cancelled", description: "Your payment process was cancelled.", variant: "default" });
            setProcessingPaymentForPlan(null);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response: any) => {
        console.error("[UpgradePage] ERROR: Razorpay payment.failed event. Response:", response);
        toast({ title: "Payment Failed", description: `Error: ${response.error.description} (Code: ${response.error.code})`, variant: "destructive" });
        setProcessingPaymentForPlan(null);
      });
      rzp.open();

    } catch (error: any) {
      console.error("[UpgradePage] CRITICAL: Error in payment process (client-side fetch or Razorpay setup):", error);
      if (error.name === 'TypeError' && error.message.toLowerCase().includes('failed to fetch')) {
            console.error("[UpgradePage] ERROR: 'Failed to fetch'. This usually means the API endpoint (/api/razorpay/create-order) is unreachable, not deployed correctly on Netlify, or crashing instantly (e.g., due to missing ENV VARS on Netlify or critical code error at the start of the API route). CHECK NETLIFY FUNCTION LOGS FOR '/api/razorpay/create-order'.");
            toast({
                title: "Network Error or Server Issue",
                description: "Could not connect to the payment server. Please check your internet connection or try again later. If this persists, the server might be experiencing issues.",
                variant: "destructive",
                duration: 10000,
            });
        } else {
            toast({ title: "Payment Setup Error", description: error.message || "Could not initiate payment. Please try again.", variant: "destructive", duration: 7000 });
        }
      setProcessingPaymentForPlan(null);
    }
  };

  const updatePlanInPocketBase = async (currentUser: User, newPlanId: UserSubscriptionTierStudent) => {
    try {
      await pb.collection('users').update(currentUser.id, {
        model: newPlanId,
      });
      await authRefresh();
      toast({ title: "Plan Upgraded!", description: `You are now on the ${newPlanId} plan.` });
      router.push(Routes.dashboard);
    } catch (error) {
      console.error("Error updating plan in PocketBase:", error);
      toast({ title: "Upgrade Failed", description: "Could not update your plan after payment. Please contact support.", variant: "destructive" });
    }
  };


  return (
    <div className="space-y-8 p-4 md:p-8">
      <Card className="shadow-lg border-none bg-transparent">
        <CardHeader className="text-center items-center">
          <ShoppingBag className="h-12 w-12 text-primary mb-3" />
          <CardTitle className="text-3xl md:text-4xl font-bold text-foreground">{AppConfig.appName} Subscription Plans</CardTitle>
          <CardDescription className="text-md md:text-lg text-muted-foreground max-w-xl">
            Choose the perfect plan to supercharge your exam preparation.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="max-w-md mx-auto shadow-md">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Tag className="h-5 w-5 text-primary"/>Have a Promo Code?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Enter Code (e.g., GODWIN50)"
              value={promoCodeInput}
              onChange={(e) => {
                setPromoCodeInput(e.target.value.toUpperCase());
                setPromoError(null);
                if(appliedPromo && e.target.value.toUpperCase() !== appliedPromo.refferal_name){
                    setAppliedPromo(null);
                    setPromoExpiryCountdown(null);
                }
              }}
              className="flex-grow"
            />
            <Button onClick={handleApplyPromoCode} disabled={isVerifyingPromo || !promoCodeInput.trim()} className="w-full sm:w-auto">
              {isVerifyingPromo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Apply
            </Button>
          </div>
          {promoError && <p className="text-sm text-destructive mt-2">{promoError}</p>}
          {appliedPromo && !promoError && (
            <div className="text-sm text-green-600 mt-2 space-y-1">
              <p className="flex items-center gap-1">
                <CheckCircle className="inline h-4 w-4" />
                Promo code "{appliedPromo.refferal_name}" applied!
                {(appliedPromo.discount !== null && appliedPromo.discount !== undefined && Number(appliedPromo.discount) > 0)
                  ? ` You get ${Number(appliedPromo.discount)}% off eligible plans.`
                  : ` This code is valid but may not offer a percentage discount or apply to all plans currently shown.`
                }
              </p>
              {promoExpiryCountdown && (
                <p className={cn("flex items-center gap-1 text-xs", promoExpiryCountdown === "Expired" ? "text-red-600 font-semibold" : "text-orange-600")}>
                  <TimerIcon className="inline h-3.5 w-3.5" /> {promoExpiryCountdown}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch">
        {studentPlansData.map((plan) => {
          let finalPriceValue = Number(plan.priceValue);
          let discountAppliedInfoBadge = null;
          let actualDiscountPercentageApplied = 0;
          
          const studentTierValuesForPromoCheck: UserSubscriptionTierStudent[] = ['Free', 'Dpp', 'Chapterwise', 'Full_length', 'Combo'];

          const normalizedPromoPlanFor = (Array.isArray(appliedPromo?.plan_for) ? appliedPromo!.plan_for : [])
                                            .map(p => p === 'Full Length' ? 'Full_length' : p) as UserSubscriptionTierStudent[];

          const isPlanEligibleForPromo = appliedPromo &&
            finalPriceValue > 0 &&
            studentTierValuesForPromoCheck.includes(plan.id as UserSubscriptionTierStudent) &&
            appliedPromo.plan_for &&
            Array.isArray(appliedPromo.plan_for) &&
            normalizedPromoPlanFor.includes(plan.id as UserSubscriptionTierStudent) &&
            (!appliedPromo.expiry_date || new Date(appliedPromo.expiry_date) >= new Date());

          if (isPlanEligibleForPromo) {
            const discountFromPromo = (appliedPromo!.discount !== null && appliedPromo!.discount !== undefined && !isNaN(Number(appliedPromo!.discount)))
                                       ? Number(appliedPromo!.discount)
                                       : 0;
            
            if (discountFromPromo > 0) {
                actualDiscountPercentageApplied = discountFromPromo;
                const discountValue = (finalPriceValue * actualDiscountPercentageApplied) / 100;
                finalPriceValue = finalPriceValue - discountValue;
                
                discountAppliedInfoBadge = (
                <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs px-2 py-0.5 absolute -top-2 -left-2 transform -rotate-6 shadow-sm z-10">
                    {actualDiscountPercentageApplied}% OFF!
                </Badge>
                );
            }
          }
          
          const hasActiveDiscountApplied = actualDiscountPercentageApplied > 0 && Number(plan.priceValue) > 0 && isPlanEligibleForPromo;
          const originalPriceString = `₹${Number(plan.priceValue).toFixed(0)}`;
          const effectivePriceString = `₹${finalPriceValue.toFixed(0)}`;
          const isCurrentActivePlan = currentUserTier === plan.id;

          return (
            <Card
              key={plan.id}
              className={cn(
                "flex flex-col rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out relative overflow-hidden",
                plan.isRecommended && plan.id !== 'Full_length' && !hasActiveDiscountApplied && "border-2 border-primary ring-2 ring-primary/50",
                plan.isRecommended && plan.id === 'Full_length' && !hasActiveDiscountApplied && "border-2 border-primary ring-2 ring-primary/50",
                isCurrentActivePlan && "bg-primary/5 ",
                hasActiveDiscountApplied && "border-2 border-green-500 ring-2 ring-green-500/50"
              )}
            >
              {plan.isRecommended && !discountAppliedInfoBadge && (
                  <Badge variant="default" className="absolute top-4 right-4 bg-primary text-primary-foreground text-xs px-3 py-1 shadow-md z-10">
                      <Star className="h-3 w-3 mr-1 fill-current" /> Recommended
                  </Badge>
              )}
              {discountAppliedInfoBadge}
              <CardHeader className="p-6 bg-card">
                <CardTitle className={cn("text-xl font-semibold mb-1", isCurrentActivePlan && !hasActiveDiscountApplied && "text-primary", hasActiveDiscountApplied && "text-green-600")}>{plan.name}</CardTitle>
                <CardDescription className={cn("text-sm min-h-[3rem]", isCurrentActivePlan ? "text-primary opacity-90" : "text-card-foreground opacity-80")}>
                  {plan.description}
                </CardDescription>
                 <div className="mt-4">
                    {hasActiveDiscountApplied ? (
                      <div className="flex flex-col items-start">
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-green-600">
                            {effectivePriceString}
                          </span>
                          <span className={cn("text-lg line-through", isCurrentActivePlan ? "text-primary/60" : "text-muted-foreground")}>
                            {originalPriceString}
                          </span>
                        </div>
                        <span className={cn("text-sm ml-1", isCurrentActivePlan ? "text-primary opacity-80" : "text-card-foreground opacity-70")}>
                          {plan.priceSuffix}
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span className={cn("text-3xl font-bold", isCurrentActivePlan ? "text-primary" : "text-foreground")}>
                          {originalPriceString}
                        </span>
                        <span className={cn("text-sm ml-1", isCurrentActivePlan ? "text-primary opacity-80" : "text-card-foreground opacity-70")}>
                          {plan.priceSuffix}
                        </span>
                      </div>
                    )}
                  </div>
              </CardHeader>
              <CardContent className="flex-grow p-6 space-y-3 bg-card">
                <p className="text-xs font-semibold text-card-foreground opacity-60 uppercase tracking-wider">FEATURES</p>
                <ul className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className={cn("h-5 w-5 mt-0.5 flex-shrink-0", isCurrentActivePlan && !hasActiveDiscountApplied ? "text-primary": (hasActiveDiscountApplied ? "text-green-500" : "text-green-500") )} />
                      <span className={cn("text-sm", isCurrentActivePlan ? "text-primary opacity-90" : "text-card-foreground opacity-90")}>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="p-6 mt-auto bg-card border-t">
                {isCurrentActivePlan ? (
                  <Button className="w-full" disabled variant="outline">
                    Current Plan ({plan.name})
                  </Button>
                ) : (
                  <Button
                    className={cn("w-full text-base py-3", plan.isRecommended && plan.id !== 'Full_length' && !hasActiveDiscountApplied && "bg-primary hover:bg-primary/90 text-primary-foreground", plan.isRecommended && plan.id === 'Full_length' && !hasActiveDiscountApplied && "bg-primary hover:bg-primary/90 text-primary-foreground", hasActiveDiscountApplied && "bg-green-600 hover:bg-green-700 text-white")}
                    onClick={() => handleInitiatePayment(plan, finalPriceValue)}
                    variant={(plan.isRecommended && !hasActiveDiscountApplied) || hasActiveDiscountApplied ? "default" : "secondary"}
                    disabled={processingPaymentForPlan === plan.id || (plan.id === 'Free' && currentUserTier === 'Free')}
                  >
                    {processingPaymentForPlan === plan.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {processingPaymentForPlan === plan.id ? 'Processing...' : (plan.id === 'Free' ? 'Current Plan' : plan.ctaText)}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
       <p className="text-center text-xs text-muted-foreground pt-4">
        All prices are inclusive of applicable taxes. Subscriptions are typically for a one-year period. For support, contact <a href={`mailto:support@${AppConfig.appName.toLowerCase().replace(/\s+/g, '')}.com`} className="text-primary hover:underline">support@{AppConfig.appName.toLowerCase().replace(/\s+/g, '')}.com</a>.
      </p>
    </div>
  );
}
