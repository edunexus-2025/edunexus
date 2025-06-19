'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StudentFeedbackSchema, type StudentFeedbackInput } from '@/lib/schemas';
import { useToast } from '@/hooks/use-toast';
import pb from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { Routes, AppConfig } from '@/lib/constants';
import { ArrowLeft, Send, Star, MessageSquareHeart, Sparkles, Loader2 } from 'lucide-react';

export default function FeedbackPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<StudentFeedbackInput>({
    resolver: zodResolver(StudentFeedbackSchema),
    defaultValues: {
      your_name: '',
      experience: '',
      rating: undefined, // Changed to undefined to match number coercion
      want_any_more_additional_in_edunexus: '',
    },
  });

  useEffect(() => {
    if (user && !authLoading) {
      form.setValue('your_name', user.name);
    }
  }, [user, authLoading, form]);

  const onSubmit = async (values: StudentFeedbackInput) => {
    setIsSubmitting(true);
    const dataToSave: any = {
      ...values,
      rating: values.rating ? Number(values.rating) : null, // Ensure rating is a number or null
    };

    if (user?.id) {
      dataToSave.student = user.id;
    } else {
      // If user is not logged in but we still want to collect name
      dataToSave.your_name = values.your_name || 'Anonymous';
    }


    try {
      await pb.collection('student_feedback').create(dataToSave);
      toast({
        title: 'Feedback Submitted!',
        description: 'Thank you for your valuable feedback. We appreciate you helping us improve!',
        className: 'bg-green-500 dark:bg-green-700 text-white',
      });
      form.reset({
        your_name: user?.name || '',
        experience: '',
        rating: undefined,
        want_any_more_additional_in_edunexus: '',
      });
    } catch (error: any) {
      toast({
        title: 'Submission Failed',
        description: error.message || 'Could not submit your feedback. Please try again.',
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
        <h1 className="text-xl font-bold">Share Your Feedback</h1>
        <div className="w-8 h-8"></div> {/* Spacer */}
      </header>

      <main className="p-4 md:p-8">
         <div className="hidden md:flex items-center justify-between mb-6">
            <Button variant="ghost" onClick={() => router.push(Routes.settings)} className="flex items-center gap-2 text-sm">
                <ArrowLeft className="h-4 w-4" /> Back to Settings
            </Button>
            <h1 className="text-3xl font-bold text-center flex-1">Share Your Feedback</h1>
            <div className="w-auto invisible md:visible"> {/* Maintain balance */}
                 <Button variant="ghost" className="opacity-0 pointer-events-none">Back to Settings</Button>
            </div>
        </div>

        <Card className="max-w-2xl mx-auto shadow-xl border-t-4 border-primary">
          <CardHeader className="text-center">
            <MessageSquareHeart className="mx-auto h-12 w-12 text-primary mb-3" />
            <CardTitle className="text-2xl">We Value Your Opinion!</CardTitle>
            <CardDescription>
              Help us make {AppConfig.appName} - The Online Test Platform better by sharing your thoughts, experiences, and suggestions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="your_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your name (optional if logged in)" {...field} value={field.value ?? ''} disabled={!!user} className="bg-muted/30" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="rating"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>How would you rate your overall experience with {AppConfig.appName} - The Online Test Platform? *</FormLabel>
                      <Select onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select a rating (1-5 Stars)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {[5, 4, 3, 2, 1].map(num => (
                            <SelectItem key={num} value={num.toString()}>
                              <div className="flex items-center">
                                {Array(num).fill(0).map((_, i) => <Star key={i} className="h-4 w-4 text-yellow-400 fill-yellow-400 mr-1" />)}
                                {Array(5 - num).fill(0).map((_, i) => <Star key={`empty-${i}`} className="h-4 w-4 text-muted-foreground/50 mr-1" />)}
                                <span className="ml-2 text-sm">({num} Star{num > 1 ? 's' : ''})</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="experience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Share your experience with us *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What did you like or dislike? What can we improve?"
                          {...field}
                          rows={5}
                          className="bg-background"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="want_any_more_additional_in_edunexus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Any additional features or suggestions? (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What new features or improvements would you like to see?"
                          {...field}
                          value={field.value ?? ''}
                          rows={4}
                          className="bg-background"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full md:w-auto py-3 text-base bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting || authLoading}>
                  {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Send className="mr-2 h-5 w-5"/>}
                  {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="pt-6 text-center">
            <p className="text-xs text-muted-foreground">
                <Sparkles className="inline h-3.5 w-3.5 mr-1 text-yellow-500" />
                Your feedback helps us grow and serve you better. Thank you!
            </p>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
