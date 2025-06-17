
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { EditProfileSchema, type EditProfileInput, type FavExam } from '@/lib/schemas';
import { Routes } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const favExams: FavExam[] = ['JEE MAIN', 'NDA', 'MHT CET', 'KCET', 'NEET'];
const currentYear = new Date().getFullYear();
const targetYearOptions = Array.from({ length: 5 }, (_, i) => (currentYear + i).toString());

export default function EditProfilePage() {
  const { user, isLoading: authLoading, updateUserProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EditProfileInput>({
    resolver: zodResolver(EditProfileSchema),
    defaultValues: {
      favExam: undefined, // Will be set by form.reset
      targetYear: undefined, // Will be set by form.reset
    },
  });

  useEffect(() => {
    if (!authLoading && user) {
      form.reset({
        favExam: user.favExam, // user.favExam is string | undefined
        targetYear: user.targetYear?.toString(), // user.targetYear is number | undefined
      });
    }
  }, [user, authLoading, form]);

  if (authLoading || !user) { // Show skeleton if auth is loading OR if user is not yet available
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

  // This check is technically redundant due to ProtectedRoute, but good for safety
  if (!user && !authLoading) {
    router.replace(Routes.login);
    return null;
  }

  const onSubmit = async (values: EditProfileInput) => {
    if (!user) return; // Should not happen if authLoading is false and user is required

    setIsSubmitting(true);
    const success = await updateUserProfile(user.id, values);
    if (success) {
      toast({
        title: 'Profile Updated',
        description: 'Your changes have been saved successfully.',
      });
      // The AuthContext's authRefresh should update the user state,
      // which will re-trigger the useEffect and form.reset if needed.
      router.push(Routes.profile);
    } else {
      toast({
        title: 'Update Failed',
        description: 'Could not save your changes. Please try again.',
        variant: 'destructive',
      });
    }
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between p-4 sticky top-0 bg-background/80 backdrop-blur-sm z-10 md:hidden border-b">
        <Button variant="ghost" size="icon" onClick={() => router.push(Routes.settings)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Edit Profile</h1>
        <div className="w-8 h-8"></div> {/* Spacer */}
      </header>

      <main className="p-4 md:p-8">
        <div className="hidden md:flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => router.push(Routes.settings)} className="flex items-center gap-2 text-sm">
            <ArrowLeft className="h-4 w-4" /> Back to Settings
          </Button>
          <h1 className="text-3xl font-bold text-center flex-1">Edit Profile</h1>
          <div className="w-auto invisible md:visible">
            <Button variant="ghost" className="opacity-0 pointer-events-none">Back to Settings</Button>
          </div>
        </div>

        <Card className="max-w-2xl mx-auto shadow-lg">
          <CardHeader>
            <CardTitle>Your Information</CardTitle>
            <CardDescription>Update your favorite exam and target year. Other fields are non-editable here.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <Input value={user.name} disabled className="bg-muted/50" />
                </FormItem>

                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <Input value={user.email} disabled className="bg-muted/50" />
                </FormItem>

                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <Input value={user.phoneNumber} disabled className="bg-muted/50" />
                </FormItem>

                <FormField
                  control={form.control}
                  name="favExam"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Favorite Exam</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
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
                      <Select onValueChange={field.onChange} value={field.value || ''}>
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

                <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting || authLoading}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
