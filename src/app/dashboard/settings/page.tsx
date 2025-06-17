
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggleButton } from "@/components/layout/ThemeToggleButton";
import { useAuth } from "@/contexts/AuthContext";
import { Routes, AppConfig } from "@/lib/constants";
import pb from '@/lib/pocketbase';
import type { User, UserSubscriptionTierStudent, UserSubscriptionTierTeacher } from '@/lib/types';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { 
  ArrowLeft, 
  UserCog, 
  Lock, 
  Mail, 
  Palette, 
  Bell, 
  Globe, 
  HelpCircle, 
  MessageSquare, 
  FileText, 
  Shield, 
  LogOut,
  ChevronRight,
  Copy,
  Users,
  TrendingUp,
  Loader2,
  LifeBuoy 
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface SettingItemProps {
  icon: ReactNode;
  label: string;
  href?: string;
  action?: ReactNode; 
  onClick?: () => void;
}

const SettingItem: React.FC<SettingItemProps> = ({ icon, label, href, action, onClick }) => {
  const content = (
    <div 
      className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors rounded-md cursor-pointer"
      onClick={onClick}
      role={onClick || href ? "button" : undefined}
      tabIndex={onClick || href ? 0 : undefined}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onClick) {
          onClick();
        }
      }}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      {action ? action : (href && <ChevronRight className="h-5 w-5 text-muted-foreground" />)}
    </div>
  );

  if (href && !onClick) {
    return <Link href={href} passHref>{content}</Link>;
  }
  return content;
};

const studentReferralTierKeys: UserSubscriptionTierStudent[] = ['Free', 'Chapterwise', 'Full_length', 'Dpp', 'Combo'];

const createDisplayReferralStats = (stats?: Record<string, number | undefined> | null | undefined): Record<UserSubscriptionTierStudent, number> => {
  const appStats = {} as Record<UserSubscriptionTierStudent, number>;
  const validPbStats = stats && typeof stats === 'object' ? stats : {};

  for (const tier of studentReferralTierKeys) {
    const pbKey = `referred_${tier.toLowerCase().replace(/\s+/g, '_')}`;
    appStats[tier] = validPbStats[pbKey] !== undefined ? Number(validPbStats[pbKey]) : 0;
  }
  return appStats;
};


export default function SettingsPage() {
  const { user, logout, isLoading: authLoading, authRefresh } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [referralStats, setReferralStats] = useState<Record<UserSubscriptionTierStudent, number>>(
    createDisplayReferralStats(user?.referralStats)
  );
  const [isLoadingReferralStats, setIsLoadingReferralStats] = useState(true);

  useEffect(() => {
    if (authLoading) {
      setIsLoadingReferralStats(true);
      return;
    }

    if (user && user.referralStats) {
      setReferralStats(createDisplayReferralStats(user.referralStats));
    } else {
      setReferralStats(createDisplayReferralStats());
    }
    setIsLoadingReferralStats(false); 

  }, [user, user?.referralStats, authLoading]);


  useEffect(() => {
    const currentUserId = user?.id;
    if (!currentUserId || authLoading || isLoadingReferralStats) {
      return;
    }

    let isMounted = true;
    let unsubFunc: (() => void) | null = null;

    const setupSubscription = async () => {
      if (!isMounted) return;
      try {
        unsubFunc = await pb.collection('users').subscribe(currentUserId, (e) => {
          if (!isMounted) return;
          if (e.action === 'update' && e.record && e.record.id === currentUserId) {
            console.log("SettingsPage: Current user record updated via subscription (ID:", e.record.id,"). Triggering authRefresh.");
            authRefresh(); 
          }
        });
      } catch (err) {
        if(isMounted) {
          console.error("Error subscribing to user updates for referral stats:", err);
        }
      }
    };
    
    setupSubscription();

    return () => {
      isMounted = false;
      if (unsubFunc) {
        unsubFunc();
      }
    };
  }, [user?.id, authLoading, isLoadingReferralStats, authRefresh]); 


  const accountSettings: SettingItemProps[] = [
    { icon: <UserCog className="h-5 w-5 text-primary" />, label: "Edit Profile", href: Routes.editProfile }, 
    { icon: <Lock className="h-5 w-5 text-primary" />, label: "Change Password", href: Routes.changePassword }, 
  ];

  const appSettings: SettingItemProps[] = [
    { 
      icon: <Palette className="h-5 w-5 text-primary" />, 
      label: "Theme", 
      action: <ThemeToggleButton />
    },
  ];

  const supportSettings: SettingItemProps[] = [
    { icon: <LifeBuoy className="h-5 w-5 text-primary" />, label: "Help Center", href: Routes.helpCenter },
    { icon: <MessageSquare className="h-5 w-5 text-primary" />, label: "Feedback", href: Routes.feedback }, 
    { icon: <FileText className="h-5 w-5 text-primary" />, label: "Terms of Service", href: Routes.termsOfService },
    { icon: <Shield className="h-5 w-5 text-primary" />, label: "Privacy Policy", href: Routes.privacyPolicy },
    { icon: <FileText className="h-5 w-5 text-primary" />, label: "Cancellation Policy", href: Routes.cancellationPolicy },
    { icon: <FileText className="h-5 w-5 text-primary" />, label: "Refund Policy", href: Routes.refundPolicy },
    { icon: <Mail className="h-5 w-5 text-primary" />, label: "Contact Us", href: Routes.contactUs },
  ];

  const handleCopyReferralCode = () => {
    if (user?.referralCode) {
      navigator.clipboard.writeText(user.referralCode)
        .then(() => {
          toast({ title: "Referral code copied!" });
        })
        .catch(err => {
          toast({ title: "Failed to copy code", description: err.message, variant: "destructive" });
        });
    }
  };


  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between p-4 sticky top-0 bg-background/80 backdrop-blur-sm z-10 md:hidden border-b">
        <Button variant="ghost" size="icon" onClick={() => router.push(Routes.profile)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Settings</h1>
        <div className="w-8 h-8"></div> 
      </header>

      <main className="p-4 md:p-8 space-y-6">
        <div className="hidden md:flex items-center justify-between mb-6">
            <Button variant="ghost" onClick={() => router.push(Routes.profile)} className="flex items-center gap-2 text-sm">
                <ArrowLeft className="h-4 w-4" /> Back to Profile
            </Button>
            <h1 className="text-3xl font-bold text-center flex-1">Settings</h1>
            <div className="w-auto invisible md:visible">
                 <Button variant="ghost" className="opacity-0 pointer-events-none">Back to Profile</Button>
            </div>
        </div>
        
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Account Settings</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {accountSettings.map(item => <SettingItem key={item.label} {...item} />)}
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">App Settings</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {appSettings.map(item => <SettingItem key={item.label} {...item} />)}
          </CardContent>
        </Card>

        {user && user.role === 'User' && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2"><Users className="h-5 w-5 text-primary"/>Referral Program</CardTitle>
              <CardDescription>Share your code and earn rewards when friends join!</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="referralCode" className="text-sm font-medium">Your Referral Code:</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input id="referralCode" value={user.referralCode || (authLoading || isLoadingReferralStats ? 'Loading...' : 'N/A')} readOnly className="bg-muted/50" />
                  <Button variant="outline" size="icon" onClick={handleCopyReferralCode} disabled={!user.referralCode || authLoading || isLoadingReferralStats}>
                    <Copy className="h-4 w-4" />
                    <span className="sr-only">Copy referral code</span>
                  </Button>
                </div>
              </div>
              <div>
                <h4 className="text-md font-medium mb-2 flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary"/>Referred Users by Plan:</h4>
                {authLoading || isLoadingReferralStats ? (
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ) : (
                <ul className="space-y-1 text-sm text-muted-foreground list-none pl-1">
                  {studentReferralTierKeys.map(tierKey => ( 
                    <li key={tierKey} className="flex justify-between items-center py-0.5">
                      <span className="font-medium text-foreground capitalize">{tierKey.replace(/_/g, ' ')}:</span> 
                      <span className="font-semibold text-primary">{referralStats?.[tierKey] || 0}</span>
                    </li>
                  ))}
                </ul>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Support & Legal</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {supportSettings.map(item => <SettingItem key={item.label} {...item} />)}
          </CardContent>
        </Card>
        
        <Button 
          variant="outline" 
          className="w-full flex items-center justify-center gap-2 text-base py-6 border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={logout}
          disabled={authLoading}
        >
          {authLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />} 
          {authLoading ? 'Logging out...' : 'Logout'}
        </Button>
      </main>
    </div>
  );
}
