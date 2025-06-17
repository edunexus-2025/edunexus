
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SignupSchema, type SignupInput } from '@/lib/schemas';
import Link from 'next/link';
import { Routes, AppConfig } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

const favExams = ['JEE MAIN', 'NDA', 'MHT CET', 'KCET', 'NEET'] as const;

const currentYear = new Date().getFullYear();
const targetYearOptions = Array.from({ length: 5 }, (_, i) => (currentYear + i).toString());


export function SignupForm() {
  const { signup, user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  

  const form = useForm<SignupInput>({
    resolver: zodResolver(SignupSchema),
    defaultValues: {
      name: '',
      email: '',
      grade: undefined,
      phoneNumber: '',
      favExam: undefined,
      targetYear: undefined,
      password: '',
      confirmPassword: '',
      referredByCode: '',
    },
  });

  useEffect(() => {
    if (user && !authLoading) {
      router.replace(Routes.dashboard);
    }
  }, [user, authLoading, router]);

  async function onSubmit(values: SignupInput) {
    setIsSubmitting(true);
    
    try {
      const success = await signup(values); 
      if (success) {
        toast({
          title: 'Signup Successful',
          description: `Welcome to ${AppConfig.appName}! Your account has been created.`,
        });
        // Navigation is handled by AuthContext's useEffect
      } else {
        // This branch might not be hit if AuthContext throws errors for known issues.
        toast({
          title: 'Signup Failed',
          description: 'An unknown error occurred during signup. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Signup Failed',
        description: error.message || 'An unexpected error occurred during account creation.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (authLoading || (user && !isSubmitting)) {
     return (
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl">Loading...</CardTitle>
        </CardHeader>
        <CardContent>
            <p>Checking authentication status...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-xl my-8">
      <CardHeader>
        <CardTitle className="text-2xl">Create your ${AppConfig.appName} Account</CardTitle>
        <CardDescription>Join us to start boosting your exam preparation today.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Your Name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
              name="grade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grade</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your current grade" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Grade 11">Grade 11</SelectItem>
                      <SelectItem value="Grade 12">Grade 12</SelectItem>
                      <SelectItem value="Dropper">Dropper (Repeat Year)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number (10 digits, e.g., 9876543210)</FormLabel>
                  <FormControl>
                    <Input 
                      type="tel" 
                      placeholder="e.g. 9876543210" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="favExam"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Favorite Exam</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your target exam" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {favExams.map((exam) => (
                        <SelectItem key={exam} value={exam}>{exam}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="targetYear"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Year</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your target year" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {targetYearOptions.map((year) => (
                        <SelectItem key={year} value={year}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        type={showConfirmPassword ? 'text' : 'password'}
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
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="referredByCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Referral Code (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter referral code" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting || authLoading}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>
        </Form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href={Routes.login} className="font-medium text-primary hover:underline">
            Login
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
