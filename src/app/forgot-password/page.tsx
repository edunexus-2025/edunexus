
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ForgotPasswordSchema, type ForgotPasswordInput } from '@/lib/schemas';
import { useToast } from '@/hooks/use-toast';
import pb from '@/lib/pocketbase';
import { Navbar } from '@/components/layout/Navbar';
import Link from 'next/link';
import { Routes } from '@/lib/constants';
import { Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [messageSent, setMessageSent] = useState(false);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(ForgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (values: ForgotPasswordInput) => {
    setIsSubmitting(true);
    setMessageSent(false);
    try {
      await pb.collection('users').requestPasswordReset(values.email);
      toast({
        title: 'Password Reset Email Sent',
        description: 'If an account exists for this email, a password reset link has been sent. Please check your inbox (and spam folder).',
      });
      setMessageSent(true);
      form.reset();
    } catch (error: any) {
      console.error('Forgot password error:', error);
      toast({
        title: 'Error Sending Reset Email',
        description: error.message || 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex flex-1 items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-background">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">Forgot Your Password?</CardTitle>
            <CardDescription>
              Enter your email address below and we&apos;ll send you a link to reset your password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {messageSent ? (
              <div className="space-y-4 text-center">
                <Mail className="mx-auto h-12 w-12 text-green-500" />
                <p className="text-lg font-medium">Password Reset Email Sent!</p>
                <p className="text-sm text-muted-foreground">
                  Please check your email inbox (and spam folder) for instructions on how to reset your password.
                </p>
                <Button asChild className="w-full">
                  <Link href={Routes.login}>Back to Login</Link>
                </Button>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="you@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? 'Sending...' : 'Send Reset Link'}
                  </Button>
                </form>
              </Form>
            )}
            {!messageSent && (
                <p className="mt-6 text-center text-sm text-muted-foreground">
                    Remembered your password?{' '}
                    <Link href={Routes.login} className="font-medium text-primary hover:underline">
                        Login
                    </Link>
                </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
