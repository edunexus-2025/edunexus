
'use client';

import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AppConfig } from '@/lib/constants';
import { FileText, RotateCcw } from 'lucide-react'; // Using RotateCcw as a symbol for refund

export default function RefundPolicyPage() {
  const lastUpdatedDate = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8">
        <Card className="shadow-lg">
          <CardHeader className="border-b">
            <div className="flex items-center gap-3">
              <RotateCcw className="h-8 w-8 text-primary" />
              <div>
                <CardTitle className="text-2xl md:text-3xl">Refund Policy</CardTitle>
                <CardDescription>Last updated on {lastUpdatedDate}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <ScrollArea className="h-[calc(100vh-280px)]">
            <CardContent className="p-6 space-y-4 prose prose-sm:prose-base dark:prose-invert max-w-none">
              <p>{AppConfig.appName} is committed to customer satisfaction. Our refund policy is as follows:</p>
              
              <ul className="list-disc space-y-2 pl-5">
                <li>In case of receipt of damaged or defective items please report the same to our Customer Service team. The request will, however, be entertained once the merchant has checked and determined the same at his own end. This should be reported within 6-8 days of receipt of the products.</li>
                <li>In case you feel that the product received is not as shown on the site or as per your expectations, you must bring it to the notice of our customer service within 6-8 days of receiving the product. The Customer Service Team after looking into your complaint will take an appropriate decision.</li>
                <li>In case of complaints regarding products that come with a warranty from manufacturers, please refer the issue to them.</li>
                <li>In case of any Refunds approved by {AppConfig.appName}, it'll take 6-8 days for the refund to be processed to the end customer.</li>
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
