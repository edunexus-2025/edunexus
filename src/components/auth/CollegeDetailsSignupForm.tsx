
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CollegeDetailsSignupSchema, type CollegeDetailsSignupInput } from '@/lib/schemas';
import Link from 'next/link';
import { Routes, AppConfig } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, GraduationCap, CalendarDays } from 'lucide-react';

export function CollegeDetailsSignupForm() {
  const { collegeSignup, collegeUser, isLoadingCollegeUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<CollegeDetailsSignupInput>({
    resolver: zodResolver(CollegeDetailsSignupSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      date_of_last_mht_cet_exam: '',
    },
  });

  useEffect(() => {
    if (collegeUser && !isLoadingCollegeUser) {
      router.replace(Routes.collegeDetailsDashboard);
    }
  }, [collegeUser, isLoadingCollegeUser, router]);

  async function onSubmit(values: CollegeDetailsSignupInput) {
    setIsSubmitting(true);
    try {
      const success = await collegeSignup(values);
      if (success) {
        toast({
          title: 'Account Created!',
          description: 'Welcome to the College Details Portal.',
        });
        // Navigation to dashboard is handled by AuthContext useEffect
      } else {
        // This branch might not be hit if context throws errors
        toast({ title: 'Signup Failed', description: 'Could not create your account.', variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Signup Failed', description: error.message || 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }

   if (isLoadingCollegeUser || (collegeUser && !isSubmitting)) {
     return (
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader><CardTitle className="text-2xl">Loading...</CardTitle></CardHeader>
        <CardContent><p>Checking authentication status...</p></CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-xl my-8">
      <CardHeader className="text-center">
        <GraduationCap className="mx-auto h-12 w-12 text-primary mb-3" />
        <CardTitle className="text-2xl">Create College Portal Account</CardTitle>
        <CardDescription>Sign up to access exclusive college details and insights.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Full Name *</FormLabel><FormControl><Input placeholder="Your Name" {...field} /></FormControl><FormMessage /></FormItem> )}/>
            <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email *</FormLabel><FormControl><Input placeholder="you@example.com" {...field} /></FormControl><FormMessage /></FormItem> )}/>
            <FormField control={form.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Password *</FormLabel><div className="relative"><FormControl><Input type={showPassword ? 'text' : 'password'} placeholder="••••••••" {...field} className="pr-10" /></FormControl><Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</Button></div><FormMessage /></FormItem> )}/>
            <FormField control={form.control} name="confirmPassword" render={({ field }) => ( <FormItem><FormLabel>Confirm Password *</FormLabel><div className="relative"><FormControl><Input type={showConfirmPassword ? 'text' : 'password'} placeholder="••••••••" {...field} className="pr-10" /></FormControl><Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</Button></div><FormMessage /></FormItem> )}/>
            <FormField control={form.control} name="date_of_last_mht_cet_exam" render={({ field }) => ( <FormItem><FormLabel className="flex items-center gap-1"><CalendarDays className="h-4 w-4"/>Date of Last MHT-CET Exam (Optional)</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )}/>
            <Button type="submit" className="w-full" disabled={isSubmitting || isLoadingCollegeUser}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>
        </Form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href={Routes.collegeDetailsLogin} className="font-medium text-primary hover:underline">
            Login
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
