
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HelpCenterTicketSchema, type HelpCenterTicketInput } from '@/lib/schemas';
import { useToast } from '@/hooks/use-toast';
import pb from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';
import { AppConfig, Routes } from '@/lib/constants';
import { LifeBuoy, Info, MessageSquare, Send, SendHorizonal, MessageCircleQuestion, NotebookText, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

const aboutEduNexusText = `EduNexus is your premier online test platform dedicated to helping students excel in competitive exams like MHT CET, JEE, and NEET. Our mission is to provide high-quality, accessible, and effective preparation tools. We offer comprehensive test series, daily practice problems (DPPs) curated by subject matter experts, and innovative AI-powered hints and solutions to guide you through challenging concepts. With detailed performance analytics, personalized feedback, and a supportive community, EduNexus is committed to empowering you on your journey to academic success. Join us and boost your preparation to reach your full potential!`;

const telegramUsername = "EduNexus_Test";
// const whatsappNumber = "+918999775843"; // WhatsApp number removed

export default function HelpCenterPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<HelpCenterTicketInput>({
    resolver: zodResolver(HelpCenterTicketSchema),
    defaultValues: {
      subject: '',
      description: '',
      edunexus_rating: undefined,
    },
  });

  const onSubmit = async (values: HelpCenterTicketInput) => {
    setIsSubmitting(true);
    const dataToSave: any = {
      ...values,
      edunexus_rating: values.edunexus_rating ? Number(values.edunexus_rating) : null,
    };
    if (user?.id) {
      dataToSave.student = user.id;
    }

    try {
      await pb.collection('students_help_center_ticket').create(dataToSave);
      toast({
        title: 'Support Ticket Submitted',
        description: 'Thank you for reaching out! We will get back to you as soon as possible.',
      });
      form.reset();
    } catch (error: any) {
      toast({
        title: 'Submission Failed',
        description: error.message || 'Could not submit your ticket. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 p-4 md:p-6 lg:p-8 bg-muted/30 dark:bg-background">
      <Card className="shadow-xl border-t-4 border-primary bg-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <LifeBuoy className="h-10 w-10 text-primary" />
            <div>
              <CardTitle className="text-3xl font-bold text-foreground">{AppConfig.appName} Help Center</CardTitle>
              <CardDescription className="text-md text-muted-foreground">
                Find information, get support, or share your feedback.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        <Card className="md:col-span-2 shadow-lg bg-card">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2"><Info className="text-primary"/> About {AppConfig.appName}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{aboutEduNexusText}</p>
          </CardContent>
        </Card>

        <Card className="shadow-lg bg-card">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2"><MessageCircleQuestion className="text-primary"/>Quick Support</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full justify-start gap-2 py-6 text-base bg-sky-500/10 text-sky-700 hover:bg-sky-500/20 dark:bg-sky-700/20 dark:text-sky-300 dark:hover:bg-sky-700/30 border-sky-500/30" variant="outline">
              <a href={`https://t.me/${telegramUsername}`} target="_blank" rel="noopener noreferrer">
                <SendHorizonal className="h-5 w-5" /> Telegram: @{telegramUsername}
              </a>
            </Button>
            {/* WhatsApp Button Removed */}
            <p className="text-xs text-muted-foreground pt-2 text-center">For urgent issues, please use Telegram.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-xl bg-card">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2"><NotebookText className="text-primary"/>Submit a Support Ticket</CardTitle>
          <CardDescription>Fill out the form below if you need further assistance or want to share feedback.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Issue with Test Series" {...field} className="bg-background/50 dark:bg-slate-800/50"/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description *</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Please describe your issue or query in detail..." {...field} rows={6} className="bg-background/50 dark:bg-slate-800/50"/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="edunexus_rating"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate Your Experience with {AppConfig.appName} (Optional)</FormLabel>
                    <Select onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)} value={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger className="bg-background/50 dark:bg-slate-800/50">
                          <SelectValue placeholder="Select a rating (1-5 Stars)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map(num => (
                          <SelectItem key={num} value={num.toString()}>
                            {Array(num).fill('⭐').join('')} ({num} Star{num > 1 ? 's' : ''})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isSubmitting} className="w-full md:w-auto py-6 text-base bg-primary hover:bg-primary/90 text-primary-foreground">
                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Send className="mr-2 h-5 w-5"/>}
                {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
    
    
