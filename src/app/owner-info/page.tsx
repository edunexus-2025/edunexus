
'use client';

import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AppConfig, Routes, studentPlansData } from '@/lib/constants';
import { Building, UserCircle, IndianRupee, Tags, Star } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { Plan } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

const OwnerInfoPage = () => {
  const ownerName = "SOHAM SUHAS ASODEKAR";
  const ownerAddress = "CO Suhas Asodekar, Plot No 82, Ranjanvan Ho Society, Cidco Colony, N-9 Cidco, Aurangabad, Aurangabad, Aurangabad, Maharashtra, India, 431003";
  const ownerCity = "Aurangabad";

  // Use the imported plan data
  const plans: Plan[] = studentPlansData;

  return (
    <div className="flex min-h-screen flex-col bg-muted/30 dark:bg-slate-900">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8">
        <Card className="shadow-xl border-t-4 border-primary rounded-lg">
          <CardHeader className="border-b">
            <div className="flex items-center gap-3">
              <UserCircle className="h-8 w-8 text-primary" />
              <div>
                <CardTitle className="text-2xl md:text-3xl">Owner Information</CardTitle>
                <CardDescription>Details about the owner and pricing of {AppConfig.appName}.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <ScrollArea className="max-h-[calc(100vh-280px)]">
            <CardContent className="p-6 space-y-8">
              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Building className="h-5 w-5 text-primary" />
                  Owner Details
                </h2>
                <div className="space-y-1 text-sm text-muted-foreground bg-card p-4 rounded-md shadow-sm">
                  <p><strong className="text-foreground">Name:</strong> {ownerName}</p>
                  <p><strong className="text-foreground">Address:</strong> {ownerAddress}</p>
                  <p><strong className="text-foreground">City:</strong> {ownerCity}</p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Tags className="h-5 w-5 text-primary" />
                  Subscription Plan Pricing
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {plans.map((plan) => (
                    <Card key={plan.id} className="shadow-md hover:shadow-lg transition-shadow bg-card">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-center">
                           <CardTitle className="text-lg font-semibold text-primary">{plan.name.toUpperCase()} PLAN</CardTitle>
                           {plan.isRecommended && <Badge variant="default" className="bg-yellow-500 text-white"><Star className="h-3 w-3 mr-1"/>Recommended</Badge>}
                        </div>
                         <CardDescription className="text-xs h-10 overflow-hidden">{plan.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-foreground">
                          {plan.priceValue === 0 ? 'Free' : `₹${plan.priceValue}/-`}
                          {plan.priceValue !== 0 && <span className="text-sm text-muted-foreground ml-1">{plan.priceSuffix}</span>}
                        </p>
                      </CardContent>
                       <CardFooter className="pt-3">
                        <Button variant="outline" size="sm" asChild>
                            <Link href={Routes.upgrade}>View Details & Upgrade</Link>
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </section>
            </CardContent>
          </ScrollArea>
        </Card>
      </main>
      <footer className="py-6 text-center text-xs text-muted-foreground border-t bg-background">
        © {new Date().getFullYear()} {AppConfig.appName}
      </footer>
    </div>
  );
};

export default OwnerInfoPage;
