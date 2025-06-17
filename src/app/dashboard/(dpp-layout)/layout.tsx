
'use client';

import { AppConfig, Routes } from '@/lib/constants';
import { usePathname, useRouter } from 'next/navigation'; // useRouter is needed for back functionality
import { AppLogo } from '@/components/layout/AppLogo';
import { DppNavigationProvider } from '@/contexts/DppNavigationContext';
import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
// Button, ArrowLeft and LayoutDashboard are removed as the header is removed.
// If a consistent back button or dashboard link is needed *within* the content area,
// it should be added to individual pages or a new shared component for DPP pages.

// Google Ad Placeholder Component - Kept as it's in the main content area
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

// DppLayoutInner is simplified as the header and footer are removed
function DppLayoutInner({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const showAds = user?.studentSubscriptionTier === 'Free';

  return (
    <div className="flex flex-col flex-1 bg-background"> {/* Main div now has flex-1 to take available space */}
      {/* Header removed */}
      <main className="flex-1 py-6 px-4 md:px-6"> {/* Main content area */}
        <div className="container mx-auto">
          {showAds && <GoogleAdPlaceholder />}
          {children}
        </div>
      </main>
      {/* Footer removed */}
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
