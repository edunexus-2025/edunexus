
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
import { LoginSchema, type LoginInput } from '@/lib/schemas';
import Link from 'next/link';
import { Routes, AppConfig } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, EyeOff, Loader2 } from 'lucide-react'; 
import { Separator } from '@/components/ui/separator';
import pb from '@/lib/pocketbase';
import Image from 'next/image'; // Import Next.js Image component

export function LoginForm() {
  const { login, user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    if (user && !authLoading && !user.needsProfileCompletion) { // Check for needsProfileCompletion
      router.replace(Routes.dashboard);
    } else if (user && !authLoading && user.needsProfileCompletion) {
      router.replace(Routes.completeProfile);
    }
  }, [user, authLoading, router]);

  async function onSubmit(values: LoginInput) {
    setIsSubmitting(true);
    try {
      const success = await login(values.email, values.password);
      if (success) {
        // Navigation is handled by AuthContext's useEffect or redirect in login function
        toast({
          title: 'Login Successful',
          description: 'Welcome back!',
        });
      } else {
        toast({
          title: 'Login Failed',
          description: 'Invalid email or password.',
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

  const handleGoogleLogin = async () => {
    setIsGoogleSubmitting(true);
    try {
      await pb.collection('users').authWithOAuth2({ provider: 'google' });
      // After successful OAuth, PocketBase redirects back.
      // The AuthContext's onChange listener will pick up the new auth state.
      // No explicit router.push needed here if AuthContext handles post-OAuth checks.
    } catch (error) {
      console.error("Google login error:", error);
      toast({
        title: 'Google Login Failed',
        description: 'Could not sign in with Google. Please try again.',
        variant: 'destructive',
      });
      setIsGoogleSubmitting(false);
    }
    // No finally setIsGoogleSubmitting(false) here, as page will redirect on success.
  };


  if (authLoading || (user && !isSubmitting && !isGoogleSubmitting)) {
     return (
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl">Loading...</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl">Login to {AppConfig.appName}</CardTitle>
        <CardDescription>Enter your credentials to access your dashboard.</CardDescription>
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
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        {...field}
                        className="pr-10"
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="text-right text-sm">
                <Link href={Routes.forgotPassword} className="font-medium text-primary hover:underline">
                    Forgot your password?
                </Link>
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting || authLoading || isGoogleSubmitting}>
              {isSubmitting ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </Form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>

        <Button variant="outline" className="w-full" onClick={handleGoogleLogin} disabled={isGoogleSubmitting || authLoading || isSubmitting}>
          {isGoogleSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Image 
              src="https://www.citypng.com/public/uploads/preview/google-logo-icon-gsuite-hd-701751694791470gzbayltphh.png" 
              alt="Google logo" 
              width={16} 
              height={16} 
              className="mr-2"
              data-ai-hint="google logo"
            />
          )}
          Google
        </Button>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href={Routes.signup} className="font-medium text-primary hover:underline">
            Sign up
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Are you a teacher?{' '}
          <Link href={Routes.teacherLogin} className="font-medium text-primary hover:underline">
            Teacher Login
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
