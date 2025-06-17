
'use client';

import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Routes } from '@/lib/constants';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export default function DeprecatedCancellationRefundPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center">
        <Card className="w-full max-w-lg text-center shadow-xl border-amber-500 bg-amber-50 dark:bg-amber-900/20">
          <CardHeader>
            <AlertTriangle className="mx-auto h-12 w-12 text-amber-600 dark:text-amber-400 mb-3" />
            <CardTitle className="text-xl text-amber-700 dark:text-amber-300">Page Deprecated</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This combined "Cancellation & Refund Policy" page is no longer in use.
              The content has been split into two separate pages:
            </p>
            <div className="mt-4 space-y-2">
              <Button asChild variant="link">
                <Link href={Routes.cancellationPolicy}>View Cancellation Policy</Link>
              </Button>
              <Button asChild variant="link">
                <Link href={Routes.refundPolicy}>View Refund Policy</Link>
              </Button>
            </div>
          </CardContent>
           <CardFooter>
            <p className="text-xs text-muted-foreground mx-auto">
              Please update any links pointing to this page.
            </p>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
