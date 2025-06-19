
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Routes, AppConfig } from '@/lib/constants'; 
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Navbar } from '@/components/layout/Navbar';
import Link from 'next/link';
import { BarChart3, Lightbulb, ListChecks, FileText, ShieldCheck, Zap, Star, ShoppingCart, GraduationCap } from 'lucide-react';
import { AppLogo } from '@/components/layout/AppLogo';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import type { User } from '@/lib/types';


// This function contains the actual content of the landing page
function LandingPageContent() {
  const features = [
    {
      icon: <ListChecks className="h-8 w-8 text-accent" />,
      title: 'Comprehensive Test Series',
      description: `Prepare for MHT CET, JEE, & NEET with our meticulously designed test series covering the entire syllabus.`,
    },
    {
      icon: <FileText className="h-8 w-8 text-accent" />,
      title: 'Daily Practice Problems (DPPs)',
      description: 'Sharpen your skills daily with a fresh set of practice problems curated by experts.',
    },
    {
      icon: <Lightbulb className="h-8 w-8 text-accent" />,
      title: 'AI-Powered Hints & Solutions',
      description: 'Stuck on a problem? Get intelligent hints and step-by-step solutions tailored to your understanding.',
    },
    {
      icon: <BarChart3 className="h-8 w-8 text-accent" />,
      title: 'Detailed Performance Analysis',
      description: 'Track your progress with in-depth analytics, identify weaknesses, and optimize your study plan.',
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 md:py-32 bg-gradient-to-br from-primary/10 via-background to-background">
          <div className="container mx-auto px-4 text-center">
            <AppLogo mainTextSize="text-5xl md:text-6xl" taglineTextSize="text-lg md:text-xl" iconSize={48} className="justify-center mb-6 items-center" />
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              Boost Your Exam Preparation
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Your ultimate companion for MHT CET, JEE, and NEET. Access high-quality test series, daily practice problems, and AI-powered guidance to ace your exams.
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <Button size="lg" asChild className="shadow-lg hover:shadow-xl transition-shadow">
                <Link href={Routes.signup}>Get Started Free</Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="shadow-lg hover:shadow-xl transition-shadow">
                <Link href={Routes.teacherLogin}>Teacher Sign up</Link>
              </Button>
              <Button size="lg" variant="secondary" asChild className="shadow-lg hover:shadow-xl transition-shadow bg-accent text-accent-foreground hover:bg-accent/90">
                <Link href={Routes.collegeDetailsLogin} className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" /> College Details
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-16 md:py-24 bg-background">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-12">
              Why Choose {AppConfig.appName}?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature) => (
                <Card key={feature.title} className="text-center shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
                      {feature.icon}
                    </div>
                    <CardTitle className="text-xl font-semibold text-foreground">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Call to Action Section */}
        <section className="py-16 md:py-24 bg-primary text-primary-foreground">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Boost Your Preparation?</h2>
            <p className="text-lg md:text-xl opacity-90 max-w-xl mx-auto mb-10">
              Join thousands of students already on their path to success. Sign up today and take the first step!
            </p>
            <Button size="lg" variant="secondary" asChild className="shadow-lg hover:shadow-xl transition-shadow">
              <Link href={Routes.signup}>Sign Up Now</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="py-8 border-t bg-background">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <div className="flex justify-center gap-x-4 gap-y-2 flex-wrap mb-2">
            <Link href={Routes.termsOfService} className="text-xs hover:text-primary hover:underline">Terms of Service</Link>
            <Link href={Routes.privacyPolicy} className="text-xs hover:text-primary hover:underline">Privacy Policy</Link>
            <Link href={Routes.cancellationPolicy} className="text-xs hover:text-primary hover:underline">Cancellation Policy</Link>
            <Link href={Routes.refundPolicy} className="text-xs hover:text-primary hover:underline">Refund Policy</Link>
            <Link href={Routes.helpCenter} className="text-xs hover:text-primary hover:underline">Help Center</Link>
            <Link href={Routes.contactUs} className="text-xs hover:text-primary hover:underline">Contact Us</Link>
          </div>
          <p>&copy; {new Date().getFullYear()} {AppConfig.appName}. All rights reserved.</p>
          <p className="text-xs">The Online Test Platform</p>
        </div>
      </footer>
    </div>
  );
}

export default function RootPageSwitcher() {
  const { user, teacher, collegeUser, isLoading, isLoadingTeacher, isLoadingCollegeUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isLoadingTeacher && !isLoadingCollegeUser) {
      if (user && !user.needsProfileCompletion) {
        router.replace(Routes.dashboard);
      } else if (user && user.needsProfileCompletion) {
        router.replace(Routes.completeProfile);
      } else if (teacher) {
        router.replace(Routes.teacherDashboard);
      } else if (collegeUser) {
        router.replace(Routes.collegeDetailsDashboard);
      }
      // If none are logged in, it remains on the landing page.
    }
  }, [user, teacher, collegeUser, isLoading, isLoadingTeacher, isLoadingCollegeUser, router]);

  if (isLoading || isLoadingTeacher || isLoadingCollegeUser || user || teacher || collegeUser) { 
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="space-y-4 p-8 rounded-lg shadow-xl bg-card">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-10 w-full mt-4" />
        </div>
      </div>
    );
  }
  return <LandingPageContent />;
}
