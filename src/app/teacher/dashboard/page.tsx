
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, BookOpenCheck, Users, BarChart3, Settings as SettingsIcon, ClipboardSignature, ShieldCheck, DollarSign, Megaphone, Wallet } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Routes, AppConfig } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';

interface QuickLink {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

export default function TeacherDashboardPage() {
  const { teacher, isLoadingTeacher } = useAuth();

  const quickLinks: QuickLink[] = [
    {
      href: Routes.teacherMyContent,
      title: 'My Content',
      description: 'Manage your created tests, questions, and educational materials.',
      icon: <BookOpenCheck className="h-7 w-7 text-primary" />,
    },
    {
      href: Routes.teacherManagePlans,
      title: 'Manage Subscription Plans',
      description: 'Create, edit, and manage your custom subscription plans for students.',
      icon: <DollarSign className="h-7 w-7 text-primary" />,
    },
    {
      href: Routes.teacherMyStudents,
      title: 'My Students',
      description: 'View and manage your enrolled students and their progress.',
      icon: <Users className="h-7 w-7 text-primary" />,
    },
    {
      href: Routes.teacherStudentPerformance,
      title: 'Student Performance',
      description: 'Analyze student results and identify areas for improvement.',
      icon: <BarChart3 className="h-7 w-7 text-primary" />,
    },
    {
      href: Routes.teacherCreateAds,
      title: 'Create Advertisements',
      description: 'Promote your courses and content to students on ' + AppConfig.appName + '.',
      icon: <Megaphone className="h-7 w-7 text-primary" />,
    },
     {
      href: Routes.teacherWallet,
      title: 'My Wallet',
      description: 'Track your earnings from student subscriptions.',
      icon: <Wallet className="h-7 w-7 text-primary" />,
    },
    {
      href: Routes.teacherSettings,
      title: 'Settings',
      description: 'Manage your teacher profile, account, and notification preferences.',
      icon: <SettingsIcon className="h-7 w-7 text-primary" />,
    },
  ];


  if (isLoadingTeacher) {
    return (
      <div className="space-y-8">
        <Card className="shadow-lg">
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/2 mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-1/3" />
          </CardContent>
        </Card>
        <div className="grid md:grid-cols-2 gap-6">
          {[...Array(6)].map((_, i) => ( 
            <Card key={i} className="shadow-md">
              <CardHeader><Skeleton className="h-6 w-2/3" /></CardHeader>
              <CardContent><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6 mt-1" /></CardContent>
              <CardFooter><Skeleton className="h-8 w-24" /></CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-lg bg-gradient-to-r from-primary to-accent text-primary-foreground">
        <CardHeader>
          <CardTitle className="text-3xl">Welcome, {teacher?.name || 'Educator'}!</CardTitle>
          <CardDescription className="text-lg text-primary-foreground/80">
            Manage your teaching activities and engage with your students.
          </CardDescription>
        </CardHeader>
        {teacher && (
            <CardContent className="space-y-2">
                 <div className="flex items-center gap-2 p-2.5 px-3.5 rounded-lg bg-primary-foreground/20 text-primary-foreground shadow-md hover:shadow-lg transition-shadow duration-300 cursor-default w-fit">
                  <ShieldCheck className="h-5 w-5 text-green-300" />
                  <span className="text-sm">
                    <span className="font-medium opacity-90">Account Type: </span>
                    <span className="font-semibold">Teacher</span>
                  </span>
                </div>
                {teacher.teacherSubscriptionTier && (
                  <div className="flex items-center gap-2 p-2.5 px-3.5 rounded-lg bg-primary-foreground/20 text-primary-foreground shadow-md hover:shadow-lg transition-shadow duration-300 cursor-default w-fit">
                    <ShieldCheck className="h-5 w-5 text-yellow-300" />
                    <span className="text-sm">
                      <span className="font-medium opacity-90">Subscription Tier: </span>
                      <span className="font-semibold">{teacher.teacherSubscriptionTier}</span>
                    </span>
                  </div>
                )}
            </CardContent>
        )}
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {quickLinks
          .filter(link => typeof link.href === 'string' && link.href.trim() !== '') 
          .map((link) => (
          <Card key={link.title} className="shadow-md hover:shadow-lg transition-shadow flex flex-col">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                {link.icon}
                <CardTitle className="text-xl">{link.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex-grow">
              <CardDescription>{link.description}</CardDescription>
            </CardContent>
            <CardFooter>
              <Button variant="outline" asChild className="w-full sm:w-auto">
                <Link href={link.href} className="flex items-center justify-between w-full">
                  Go to {link.title} <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
