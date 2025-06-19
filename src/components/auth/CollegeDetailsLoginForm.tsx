
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CollegeDetailsLoginSchema, type CollegeDetailsLoginInput } from '@/lib/schemas';
import Link from 'next/link';
import { Routes, AppConfig } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, EyeOff, Loader2, GraduationCap } from 'lucide-react';

export function CollegeDetailsLoginForm() {
  const { collegeLogin, collegeUser, isLoadingCollegeUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<CollegeDetailsLoginInput>({
    resolver: zodResolver(CollegeDetailsLoginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    if (collegeUser && !isLoadingCollegeUser) {
      router.replace(Routes.collegeDetailsDashboard);
    }
  }, [collegeUser, isLoadingCollegeUser, router]);

  async function onSubmit(values: CollegeDetailsLoginInput) {
    setIsSubmitting(true);
    try {
      const success = await collegeLogin(values.email, values.password);
      if (success) {
        toast({
          title: 'Login Successful',
          description: 'Welcome to the College Details Portal!',
        });
        // Navigation is handled by AuthContext's useEffect for collegeUser
      } else {
        toast({
          title: 'Login Failed',
          description: 'Invalid email or password for College Details Portal.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Login Error',
        description: (error as Error).message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
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
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader className="text-center">
        <GraduationCap className="mx-auto h-12 w-12 text-primary mb-3" />
        <CardTitle className="text-2xl">College Details Portal Login</CardTitle>
        <CardDescription>Access exclusive college information.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="you@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input type={showPassword ? 'text' : 'password'} placeholder="••••••••" {...field} className="pr-10" />
                    </FormControl>
                    <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* Add Forgot Password link if needed for this portal */}
            <Button type="submit" className="w-full" disabled={isSubmitting || isLoadingCollegeUser}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? 'Logging in...' : 'Login to College Portal'}
            </Button>
          </form>
        </Form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          New here?{' '}
          <Link href={Routes.collegeDetailsSignup} className="font-medium text-primary hover:underline">
            Create a College Portal Account
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Back to main site?{' '}
          <Link href={Routes.home} className="font-medium text-primary hover:underline">
            {AppConfig.appName} Home
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
