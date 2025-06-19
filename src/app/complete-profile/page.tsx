'use client'; // Moved to the top of the file

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { CompleteProfileSchema, type CompleteProfileInput, FavExamEnum } from '@/lib/schemas';
import { Routes, AppConfig } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, EyeOff, UserCheck, Info, Loader2 } from 'lucide-react';

const favExams = FavExamEnum.options;
const currentYear = new Date().getFullYear();
const targetYearOptions = Array.from({ length: 5 }, (_, i) => (currentYear + i).toString());
const gradeOptions = ['Grade 11', 'Grade 12', 'Dropper'] as const;

function ProfileCompletionLoadingSkeleton() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <Card className="w-full max-w-lg shadow-xl my-8">
        <CardHeader className="text-center">
          <Skeleton className="mx-auto h-12 w-12 rounded-full mb-3" />
          <Skeleton className="h-7 w-3/4 mx-auto mb-2" />
          <Skeleton className="h-4 w-full mx-auto" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          <Skeleton className="h-10 w-full mt-2" />
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground pt-4">
           <Skeleton className="h-4 w-full" />
        </CardFooter>
      </Card>
    </div>
  );
}

// This component contains the actual form logic and uses client hooks.
// Since the whole file is now 'use client', this component will also be client-side.
function ProfileCompletionFormComponent() {
  const { user, isLoading: authLoading, updateUserProfile, authRefresh } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<CompleteProfileInput>({
    resolver: zodResolver(CompleteProfileSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
      grade: undefined,
      favExam: undefined,
      targetYear: undefined,
      referredByCode: '',
    },
  });

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace(Routes.login);
      } else if (user && !user.needsProfileCompletion) {
        const redirect = searchParams.get('redirect') || Routes.dashboard;
        router.replace(redirect);
      }
    }
  }, [user, authLoading, router, searchParams]);

  const onSubmit = async (values: CompleteProfileInput) => {
    if (!user) return;
    setIsSubmitting(true);

    const dataToUpdate = {
      password: values.password,
      passwordConfirm: values.confirmPassword,
      class: values.grade,
      favExam: values.favExam,
      targetYear: parseInt(values.targetYear, 10),
      referredByCode: values.referredByCode || null,
      model: user.studentSubscriptionTier || 'Free',
      role: user.role || 'User',
      emailVisibility: user.emailVisibility === undefined ? true : user.emailVisibility,
      verified: true,
    };

    try {
      const success = await updateUserProfile(user.id, dataToUpdate);
      if (success) {
        toast({
          title: 'Profile Completed!',
          description: `Welcome to ${AppConfig.appName} - The Online Test Platform, ${user.name}! Your profile is set up.`,
        });
        await authRefresh();
        const redirect = searchParams.get('redirect') || Routes.dashboard;
        router.replace(redirect);
      } else {
        toast({
          title: 'Update Failed',
          description: 'Could not save your profile details. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error Completing Profile',
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-secondary/10">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader><CardTitle>Loading Profile Data...</CardTitle></CardHeader>
          <CardContent><Skeleton className="h-40 w-full" /></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <Card className="w-full max-w-lg shadow-xl my-8">
        <CardHeader className="text-center">
          <UserCheck className="mx-auto h-12 w-12 text-primary mb-3" />
          <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
          <CardDescription>
            Welcome, {user.name}! Please fill in a few more details to get started with {AppConfig.appName} - The Online Test Platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Create Password*</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input type={showPassword ? 'text' : 'password'} placeholder="Minimum 8 characters" {...field} />
                      </FormControl>
                      <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password*</FormLabel>
                     <div className="relative">
                        <FormControl>
                            <Input type={showConfirmPassword ? 'text' : 'password'} placeholder="Re-enter your password" {...field} />
                        </FormControl>
                        <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="grade" render={({ field }) => (
                    <FormItem> <FormLabel>Grade*</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger></FormControl>
                        <SelectContent>{gradeOptions.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                    </Select><FormMessage /> </FormItem> )}
                />
                <FormField control={form.control} name="favExam" render={({ field }) => (
                    <FormItem> <FormLabel>Target Exam*</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger></FormControl>
                        <SelectContent>{favExams.map(exam => <SelectItem key={exam} value={exam}>{exam}</SelectItem>)}</SelectContent>
                    </Select><FormMessage /> </FormItem> )}
                />
              </div>
              <FormField control={form.control} name="targetYear" render={({ field }) => (
                  <FormItem> <FormLabel>Target Year*</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select target year" /></SelectTrigger></FormControl>
                      <SelectContent>{targetYearOptions.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}</SelectContent>
                  </Select><FormMessage /> </FormItem> )}
              />
              <FormField control={form.control} name="referredByCode" render={({ field }) => (
                  <FormItem> <FormLabel>Referral Code (Optional)</FormLabel>
                  <FormControl><Input placeholder="Enter referral code if you have one" {...field} value={field.value || ''} /></FormControl>
                  <FormMessage /> </FormItem> )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Saving...' : 'Complete Profile & Continue'}
              </Button>
            </form>
          </Form>
        </CardContent>
         <CardFooter className="text-xs text-muted-foreground pt-4">
            <Info size={14} className="mr-1.5 flex-shrink-0"/> Your name ({user.name}) and email ({user.email}) have been imported. You can manage other details in settings later.
        </CardFooter>
      </Card>
    </div>
  );
}

// This default export now wraps the client component in Suspense
// And the whole file is marked 'use client'
export default function CompleteProfilePage() {
  return (
    <Suspense fallback={<ProfileCompletionLoadingSkeleton />}>
      <ProfileCompletionFormComponent />
    </Suspense>
  );
}
