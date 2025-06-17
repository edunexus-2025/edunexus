
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { ChangePasswordSchema, type ChangePasswordInput } from '@/lib/schemas';
import { Routes } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Mail, Eye, EyeOff } from 'lucide-react';
import pb from '@/lib/pocketbase';
import { Skeleton } from '@/components/ui/skeleton';

export default function ChangePasswordPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(ChangePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  if (authLoading) {
    return (
      <div className="p-4 md:p-8 space-y-6">
        <Skeleton className="h-8 w-1/3 mb-4" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-1/2" />
      </div>
    );
  }

  if (!user && !authLoading) {
    router.replace(Routes.login);
    return null;
  }

  const onSubmit = async (values: ChangePasswordInput) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      await pb.collection('users').update(user.id, {
        oldPassword: values.currentPassword,
        password: values.newPassword,
        passwordConfirm: values.confirmNewPassword,
      });
      toast({
        title: 'Password Changed Successfully',
        description: 'Your password has been updated.',
      });
      form.reset();
      // Optionally, re-authenticate or redirect
      // For now, just clear the form
    } catch (error: any) {
      console.error('Change password error:', error);
      toast({
        title: 'Failed to Change Password',
        description: error.message || 'An unexpected error occurred. Please check your current password.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between p-4 sticky top-0 bg-background/80 backdrop-blur-sm z-10 md:hidden border-b">
        <Button variant="ghost" size="icon" onClick={() => router.push(Routes.settings)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Change Password</h1>
        <div className="w-8 h-8"></div> {/* Spacer */}
      </header>

      <main className="p-4 md:p-8">
        <div className="hidden md:flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => router.push(Routes.settings)} className="flex items-center gap-2 text-sm">
            <ArrowLeft className="h-4 w-4" /> Back to Settings
          </Button>
          <h1 className="text-3xl font-bold text-center flex-1">Change Password</h1>
           <div className="w-auto invisible md:visible">
            <Button variant="ghost" className="opacity-0 pointer-events-none">Back to Settings</Button>
          </div>
        </div>

        <Card className="max-w-2xl mx-auto shadow-lg">
          <CardHeader>
            <CardTitle>Update Your Password</CardTitle>
            <CardDescription>
              Enter your current password and a new password.
              Ensure your new password is at least 8 characters long.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input
                            type={showCurrentPassword ? 'text' : 'password'}
                            placeholder="Enter your current password"
                            {...field}
                            className="pr-10"
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                        >
                          {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input
                            type={showNewPassword ? 'text' : 'password'}
                            placeholder="Enter your new password"
                            {...field}
                            className="pr-10"
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                        >
                          {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmNewPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input
                            type={showConfirmNewPassword ? 'text' : 'password'}
                            placeholder="Confirm your new password"
                            {...field}
                            className="pr-10"
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                          aria-label={showConfirmNewPassword ? "Hide confirm new password" : "Show confirm new password"}
                        >
                          {showConfirmNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting || authLoading}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSubmitting ? 'Saving...' : 'Save New Password'}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="pt-6">
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-4 w-4" /> If you have forgot your password, please email us at
                <a href="mailto:edunexustestplatform@gmail.com" className="text-primary hover:underline">
                    edunexustestplatform@gmail.com
                </a>.
            </p>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
