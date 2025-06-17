
'use client';

import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AppConfig } from '@/lib/constants';
import { FileText } from 'lucide-react';

export default function CancellationPolicyPage() {
  const lastUpdatedDate = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8">
        <Card className="shadow-lg">
          <CardHeader className="border-b">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <CardTitle className="text-2xl md:text-3xl">Cancellation Policy</CardTitle>
                <CardDescription>Last updated on {lastUpdatedDate}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <ScrollArea className="h-[calc(100vh-280px)]">
            <CardContent className="p-6 space-y-4 prose prose-sm sm:prose-base dark:prose-invert max-w-none">
              <p>{AppConfig.appName} believes in helping its customers as far as possible, and has therefore a liberal cancellation policy. Under this policy:</p>
              
              <ul className="list-disc space-y-2 pl-5">
                <li>Cancellations will be considered only if the request is made within 6-8 days of placing the order. However, the cancellation request may not be entertained if the orders have been communicated to the vendors/merchants and they have initiated the process of shipping them.</li>
                <li>{AppConfig.appName} does not accept cancellation requests for perishable items like flowers, eatables etc. However, refund/replacement can be made if the customer establishes that the quality of product delivered is not good.</li>
              </ul>

              <div className="mt-6 pt-4 border-t">
                <p className="text-sm font-semibold">Disclaimer:</p>
                <p className="text-xs text-muted-foreground">
                  The above content is created at SOHAM ASODEKAR [ OWNER ]'s sole discretion. Razorpay shall not be liable for any content provided here and shall not be responsible for any claims and liability that may arise due to merchant's non-adherence to it.
                </p>
              </div>
            </CardContent>
          </ScrollArea>
        </Card>
      </main>
    </div>
  );
}
