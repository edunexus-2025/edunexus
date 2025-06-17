
'use client';

import { Button } from '@/components/ui/button';
import { AppConfig, Routes } from '@/lib/constants';
import { ArrowLeft, LayoutDashboard } from 'lucide-react'; 
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { AppLogo } from '@/components/layout/AppLogo';
import { DppNavigationProvider, useDppNavigation } from '@/contexts/DppNavigationContext';
import React, { useEffect } from 'react'; // Ensure React is imported for JSX
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth

// Google Ad Placeholder Component
function GoogleAdPlaceholder() {
  useEffect(() => {
    // This effect attempts to push ads after the component mounts.
    // It's a common pattern, but Google's AdSense script handles this automatically if the script is loaded.
    // Ensure your AdSense script in layout.tsx is correctly configured.
    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      console.log("Google Ad Placeholder: Pushed to adsbygoogle.");
    } catch (e) {
      console.error("Google Ad Placeholder: Error pushing to adsbygoogle:", e);
    }
  }, []);

  return (
    <div className="my-4 p-4 bg-gray-100 dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-700 text-center text-sm text-muted-foreground">
      <p className="font-semibold">Advertisement</p>
      {/* Replace this with your actual Google AdSense ad unit code */}
      {/* For example:
      <ins className="adsbygoogle"
           style={{ display: 'block' }}
           data-ad-client="ca-pub-YOUR_CLIENT_ID"
           data-ad-slot="YOUR_AD_SLOT_ID"
           data-ad-format="auto"
           data-full-width-responsive="true"></ins>
      */}
      <p className="mt-2 text-xs">(This is a placeholder for a Google Ad unit. Ensure your AdSense client ID and ad slot ID are correctly configured.)</p>
    </div>
  );
}


// This inner component will consume the context
function DppLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth(); // Get user from AuthContext

  console.log("DppLayoutInner: Rendering. Pathname:", pathname);
  let backUrlFromContext: string | null = null;
  let contextAvailable = false;
  try {
    const dppNav = useDppNavigation(); 
    backUrlFromContext = dppNav.backToLessonUrl;
    contextAvailable = dppNav.providerMounted;
    console.log("DppLayoutInner: Context available:", contextAvailable, "backToLessonUrl:", backUrlFromContext);
  } catch (e) {
    console.error("DppLayoutInner: Error calling useDppNavigation. Provider might not be wrapping this component yet.", e);
  }


  const handleBackClick = () => {
    const onQuestionPage = pathname.startsWith('/dashboard/qbank/');
    const onLessonListPage = pathname.match(/^\/dashboard\/dpp\/[^/]+\/[^/]+\/[^/]+$/); // Matches /dpp/exam/subject/lesson

    if ((onQuestionPage || onLessonListPage) && backUrlFromContext) {
      console.log(`DppLayoutInner: Navigating to context URL: ${backUrlFromContext}`);
      router.push(backUrlFromContext);
    } else {
      console.log("DppLayoutInner: Using router.back()");
      router.back();
    }
  };
  
  const showLogoInHeader = !pathname.includes('/qbank/');
  const showAds = user?.studentSubscriptionTier === 'Free';

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 md:px-6 py-3 flex h-14 items-center justify-between">
          <Button variant="ghost" onClick={handleBackClick} className="flex items-center gap-2 text-sm">
            <ArrowLeft className="h-5 w-5" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            {showLogoInHeader && (
                <AppLogo mainTextSize="text-lg" taglineTextSize="text-[0px]" iconSize={22} />
            )}
          </div>
          <div className="w-auto h-10"> 
             {/* <Link href={Routes.dashboard} passHref>
              <Button variant="ghost" size="icon" aria-label="Go to main dashboard">
                <LayoutDashboard className="h-5 w-5" />
              </Button>
            </Link> */}
          </div>
        </div>
      </header>
      <main className="flex-1 bg-muted/30 dark:bg-slate-950 py-6 px-4 md:px-6">
        {showAds && <GoogleAdPlaceholder />}
        {children}
      </main>
      <footer className="py-4 border-t bg-background text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {AppConfig.appName}. All rights reserved.
      </footer>
    </div>
  );
}

export default function DppGroupLayout({ children }: { children: React.ReactNode; }) {
  console.log("DppGroupLayout: Rendering and providing DppNavigationContext.");
  return (
    <DppNavigationProvider>
      <DppLayoutInner>{children}</DppLayoutInner>
    </DppNavigationProvider>
  );
}
