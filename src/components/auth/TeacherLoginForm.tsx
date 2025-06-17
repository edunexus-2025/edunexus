
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
import { TeacherLoginSchema, type TeacherLoginInput } from '@/lib/schemas';
import Link from 'next/link';
import { Routes, AppConfig } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, EyeOff } from 'lucide-react';

export function TeacherLoginForm() {
  const { teacherLogin, teacher, isLoadingTeacher } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<TeacherLoginInput>({
    resolver: zodResolver(TeacherLoginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    if (teacher && !isLoadingTeacher) {
      router.replace(Routes.teacherDashboard);
    }
  }, [teacher, isLoadingTeacher, router]);

  async function onSubmit(values: TeacherLoginInput) {
    setIsSubmitting(true);
    try {
      const success = await teacherLogin(values.email, values.password);
      if (success) {
        toast({
          title: 'Teacher Login Successful',
          description: 'Welcome back, Educator!',
        });
        // router.push(Routes.teacherDashboard); // AuthContext handles this now
      } else {
        toast({
          title: 'Teacher Login Failed',
          description: 'Invalid email or password for teacher account.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Teacher Login Error',
        description: (error as Error).message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoadingTeacher || (teacher && !isSubmitting)) {
     return (
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader><CardTitle className="text-2xl">Loading...</CardTitle></CardHeader>
        <CardContent><p>Checking teacher authentication status...</p></CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl">Teacher Login</CardTitle>
        <CardDescription>Access your {AppConfig.appName} educator dashboard.</CardDescription>
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
                    <Input placeholder="teacher@example.com" {...field} />
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
            {/* Add Forgot Password link specific to teachers if needed */}
            <Button type="submit" className="w-full" disabled={isSubmitting || isLoadingTeacher}>
              {isSubmitting ? 'Logging in...' : 'Login as Teacher'}
            </Button>
          </form>
        </Form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have a teacher account?{' '}
          <Link href={Routes.teacherSignup} className="font-medium text-primary hover:underline">
            Register as Teacher
          </Link>
        </p>
         <p className="mt-2 text-center text-sm text-muted-foreground">
          Are you a student?{' '}
          <Link href={Routes.login} className="font-medium text-primary hover:underline">
            Student Login
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
