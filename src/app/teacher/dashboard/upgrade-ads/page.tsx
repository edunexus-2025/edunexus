
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import pb from '@/lib/pocketbase';
import { Routes } from '@/lib/constants';
import { Loader2, Star, CheckCircle, Briefcase, Users, TrendingUp, ExternalLink, ArrowLeft, ShieldCheck } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function UpgradeAdsPage() {
  const { teacher, isLoadingTeacher, authRefresh } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isProcessingUpgrade, setIsProcessingUpgrade] = useState(false);

  const handleUpgradeAndPay = async () => {
    if (!teacher?.id) {
      toast({ title: "Error", description: "Teacher not found. Please log in again.", variant: "destructive" });
      return;
    }

    setIsProcessingUpgrade(true);
    try {
      // Step 1: Update PocketBase record
      await pb.collection('teacher_data').update(teacher.id, {
        ads_subscription: "Ads Model",
        can_create_ads: true,
      });
      toast({ title: "Subscription Activated!", description: "Your Ads Model subscription is now active." });

      // Step 2: Refresh AuthContext to reflect changes immediately
      await authRefresh();

      // Step 3: Open Telegram link in a new tab
      window.open('https://t.me/CRACK_MHT_CET_01', '_blank');
      
      // Step 4: Redirect back to Create Ads page (which should now show the ad creation UI)
      router.push(Routes.teacherCreateAds);

    } catch (error: any) {
      console.error("Failed to upgrade to Ads Model:", error);
      toast({ title: "Upgrade Failed", description: error.data?.message || error.message, variant: "destructive" });
    } finally {
      setIsProcessingUpgrade(false);
    }
  };

  const features = [
    { icon: <Briefcase className="h-5 w-5 text-primary" />, text: "Create and manage promotional advertisements." },
    { icon: <Users className="h-5 w-5 text-primary" />, text: "Increased visibility for your profile to EduNexus students." },
    { icon: <TrendingUp className="h-5 w-5 text-primary" />, text: "Reach a wider audience and attract more students." },
    { icon: <Star className="h-5 w-5 text-primary" />, text: "Priority placement in teacher listings (coming soon)." },
    { icon: <CheckCircle className="h-5 w-5 text-primary" />, text: "Dedicated support for ad campaigns." },
  ];

  if (isLoadingTeacher) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-8 w-1/3 mb-4" />
        <Card className="shadow-lg">
          <CardHeader>
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-6 w-1/2 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
            <Skeleton className="h-12 w-1/2 mx-auto mt-6" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!teacher) {
    // This case should ideally be handled by TeacherProtectedRoute if this page is within the teacher dashboard layout
    return <p className="p-4 text-center">Please log in as a teacher to view this page.</p>;
  }
  
  if (teacher.ads_subscription === 'Ads Model') {
    return (
        <div className="p-4 md:p-6 space-y-6">
            <Button variant="outline" onClick={() => router.push(Routes.teacherCreateAds)} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Create Ads
            </Button>
            <Card className="shadow-lg text-center">
                <CardHeader>
                    <ShieldCheck className="mx-auto h-12 w-12 text-green-500 mb-3" />
                    <CardTitle className="text-2xl text-green-600">Ads Model Activated!</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">You already have the Ads Model subscription. You can now create advertisements.</p>
                </CardContent>
                <CardFooter className="justify-center">
                     <Button onClick={() => router.push(Routes.teacherCreateAds)}>Go to Ad Creation</Button>
                </CardFooter>
            </Card>
        </div>
    );
  }


  return (
    <div className="p-4 md:p-6 space-y-6">
      <Button variant="outline" onClick={() => router.push(Routes.teacherCreateAds)} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Create Ads
      </Button>
      <Card className="shadow-lg max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <Star className="mx-auto h-12 w-12 text-yellow-400 mb-3" />
          <CardTitle className="text-3xl font-bold text-primary">Upgrade to Ads Model</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Supercharge your reach and attract more students!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold mb-3 text-foreground">Features Unlocked:</h3>
            <ul className="space-y-3">
              {features.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  {feature.icon}
                  <span className="text-sm text-foreground/90">{feature.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="text-center mt-6 pt-6 border-t">
            <p className="text-4xl font-extrabold text-foreground">
              ₹10<span className="text-xl font-normal text-muted-foreground">/month</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">Billed annually or as per terms.</p>
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-3 items-center">
          <Button 
            size="lg" 
            className="w-full bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white shadow-lg"
            onClick={handleUpgradeAndPay}
            disabled={isProcessingUpgrade}
          >
            {isProcessingUpgrade ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <ExternalLink className="mr-2 h-5 w-5" />
            )}
            {isProcessingUpgrade ? 'Processing...' : 'Pay Now & Activate (via Telegram)'}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            By clicking "Pay Now", your plan will be upgraded. You will be redirected to Telegram for payment and further instructions.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
