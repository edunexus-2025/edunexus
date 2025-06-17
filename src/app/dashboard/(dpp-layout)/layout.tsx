
'use client';

import { Button } from '@/components/ui/button';
import { AppConfig, Routes } from '@/lib/constants';
import { ArrowLeft, LayoutDashboard } from 'lucide-react'; 
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { AppLogo } from '@/components/layout/AppLogo';
import { DppNavigationProvider, useDppNavigation } from '@/contexts/DppNavigationContext';
import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

// Google Ad Placeholder Component
function GoogleAdPlaceholder() {
  useEffect(() => {
    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch (e) {
      console.error("Google Ad Placeholder: Error pushing to adsbygoogle:", e);
    }
  }, []);

  return (
    <div className="my-4 p-4 bg-muted/50 dark:bg-slate-800/30 border border-dashed border-border text-center text-sm text-muted-foreground rounded-lg">
      <p className="font-semibold">Advertisement</p>
      <p className="mt-2 text-xs">(This is a placeholder for a Google Ad unit. Ensure your AdSense client ID and ad slot ID are correctly configured.)</p>
    </div>
  );
}

function DppLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { backToLessonUrl } = useDppNavigation();

  const handleBackClick = () => {
    const onQuestionPage = pathname.startsWith('/dashboard/qbank/');
    const onLessonListPage = pathname.match(/^\/dashboard\/dpp\/[^/]+\/[^/]+\/[^/]+$/);

    if ((onQuestionPage || onLessonListPage) && backToLessonUrl) {
      router.push(backToLessonUrl);
    } else {
      router.back();
    }
  };
  
  const showLogoInHeader = !pathname.startsWith('/dashboard/qbank/') && !pathname.startsWith('/dashboard/test-results/compete'); // Hide logo on qbank and compete results
  const showAds = user?.studentSubscriptionTier === 'Free';

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-4 md:px-6 py-3 flex h-16 items-center justify-between">
          <Button variant="ghost" onClick={handleBackClick} className="flex items-center gap-2 text-sm hover:bg-muted/50">
            <ArrowLeft className="h-5 w-5" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          {showLogoInHeader && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <AppLogo mainTextSize="text-xl" taglineTextSize="text-[0px]" iconSize={28} />
            </div>
          )}
          <div className="w-auto h-10">
             <Link href={Routes.dashboard} passHref>
              <Button variant="ghost" size="icon" aria-label="Go to main dashboard" className="hover:bg-muted/50">
                <LayoutDashboard className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1 bg-background py-6 px-4 md:px-6">
        <div className="container mx-auto">
          {showAds && <GoogleAdPlaceholder />}
          {children}
        </div>
      </main>
      <footer className="py-6 border-t bg-card text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {AppConfig.appName}. All rights reserved.
      </footer>
    </div>
  );
}

export default function DppGroupLayout({ children }: { children: React.ReactNode; }) {
  return (
    <DppNavigationProvider>
      <DppLayoutInner>{children}</DppLayoutInner>
    </DppNavigationProvider>
  );
}
