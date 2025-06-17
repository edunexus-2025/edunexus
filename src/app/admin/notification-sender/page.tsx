
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Send, MessageSquare, Target as TargetIcon, Users, BookOpen } from 'lucide-react';
import type { NotificationMessage } from '@/lib/types';
import type { FavExam } from '@/lib/schemas';
import { useEffect } from 'react';
import pb from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';

// Definitive list of all possible plan/tier values
const allSubscriptionTiersList = [
  'All',
  'Free',       // Common for Student & Teacher
  'Chapterwise',// Student
  'Full_length',// Student
  'Dpp',        // Student
  'Combo',      // Student
  'Teacher',    // Represents a teacher account type for targeting
  'Starter',    // Teacher
  'Pro'         // Teacher
] as const; 

type SubscriptionTierValue = typeof allSubscriptionTiersList[number];

const favExams: Array<FavExam | 'All'> = ['All', 'JEE MAIN', 'NDA', 'MHT CET', 'KCET', 'NEET'];

const notificationTemplates = [
  { value: 'custom', label: 'Custom Message', message: '', title: 'Admin Announcement' },
  { value: 'new_test', label: 'New Test Added', message: 'Hi [User],\n\nA new mock test for [ExamName] has just been added to our Test Series section! Sharpen your skills and assess your preparation.\n\nGood luck!', title: 'New Test Available!' },
  { value: 'new_dpp', label: 'New DPPs Available', message: 'Hello [User],\n\nFresh Daily Practice Problems (DPPs) for [Subject/Topic] are now available. Keep practicing and stay ahead!\n\nHappy learning!', title: 'New DPPs Added!' },
  { value: 'maintenance_alert', label: 'Maintenance Alert', message: 'Dear Users,\n\nOur platform will undergo scheduled maintenance on [Date] from [StartTime] to [EndTime]. Access may be temporarily unavailable.\n\nWe apologize for any inconvenience.', title: 'Platform Maintenance' },
  { value: 'special_offer', label: 'Special Offer', message: 'Hi [User],\n\nDon\'t miss out on our special offer! Get [DiscountPercentage]% off on [PlanName] subscription. Offer valid till [ExpiryDate].\n\nUpgrade now!', title: 'Special Offer Just For You!' }
];

// Zod schema using the correctly typed array for the enum
const notificationFormSchema = z.object({
  // Spread the readonly tuple into a new mutable array literal for z.enum
  targetPlan: z.enum([...allSubscriptionTiersList]),
  targetExam: z.enum(favExams as [FavExam | 'All', ...(FavExam | 'All')[]]),
  messageTemplate: z.string({ required_error: 'Please select a message template or choose custom.' }),
  message: z.string().min(10, { message: 'Message must be at least 10 characters.' }).max(500, { message: 'Message must not exceed 500 characters.' }),
});

type NotificationFormValues = z.infer<typeof notificationFormSchema>;

const NOTIFICATIONS_STORAGE_KEY = 'edunexus_notifications';

export default function NotificationSenderPage() {
  const { toast } = useToast();
  const { user: adminUser } = useAuth();

  const form = useForm<NotificationFormValues>({
    resolver: zodResolver(notificationFormSchema),
    defaultValues: {
      targetPlan: 'All', 
      targetExam: 'All',
      messageTemplate: 'custom',
      message: '',
    },
  });

  const selectedTemplateValue = form.watch('messageTemplate');

  useEffect(() => {
    if (selectedTemplateValue) {
      const template = notificationTemplates.find(t => t.value === selectedTemplateValue);
      if (template) {
        form.setValue('message', template.message);
      }
    }
  }, [selectedTemplateValue, form]);

  async function onSubmit(data: NotificationFormValues) {
    console.log('Simulating sending Notification with data:', data);

    const selectedTemplate = notificationTemplates.find(t => t.value === data.messageTemplate) || notificationTemplates[0];

    const newNotification: NotificationMessage = {
      id: `admin_notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: selectedTemplate.title,
      message: data.message, 
      timestamp: new Date(),
    };

    try {
      const storedNotificationsString = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      let currentNotifications: NotificationMessage[] = [];
      if (storedNotificationsString) {
        currentNotifications = JSON.parse(storedNotificationsString).map((n: any) => ({...n, timestamp: new Date(n.timestamp)}));
      }

      const updatedNotifications = [newNotification, ...currentNotifications];
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updatedNotifications));

      toast({
        title: 'Notification "Sent" (Locally)',
        description: (
          <div className="space-y-1">
            <p>This notification has been added to localStorage and will be visible to users in this browser upon next load/refresh.</p>
            <p>Target Plan: {data.targetPlan}</p> 
            <p>Target Exam: {data.targetExam}</p> 
            <p className="font-semibold">Message:</p>
            <pre className="text-xs whitespace-pre-wrap bg-muted p-2 rounded-md">{data.message}</pre> 
          </div>
        ),
        duration: 7000,
      });
      form.setValue('message','');
      form.setValue('messageTemplate', 'custom');

      if (adminUser?.id) {
        const logMessage = `Admin ${adminUser.name} (ID: ${adminUser.id}) sent a notification titled "${newNotification.title}" targeting plan: ${data.targetPlan}, exam: ${data.targetExam}. Message snippet: ${data.message.substring(0, 100)}...`; 
        try {
          await pb.collection('website_messages').create({
            user: adminUser.id,
            message: logMessage,
          });
          console.log("Notification send action logged to website_messages.");
        } catch (logError) {
          console.error("Failed to log notification send action to website_messages:", logError);
        }
      }

    } catch (error) {
        console.error("Error saving notification to localStorage:", error);
        toast({
            title: "Error Saving Notification Locally",
            description: "Could not save the notification to localStorage.",
            variant: "destructive",
        });
    }
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-foreground flex items-center">
            <Send className="mr-3 h-8 w-8 text-primary" /> Notification Sender
          </CardTitle>
          <CardDescription>
            Compose and send targeted notifications to your users. (Simulated: Adds to local notifications & logs to website_messages)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2"><TargetIcon className="text-primary"/>Target Audience (UI Only)</CardTitle>
                    <CardDescription>Specify who should receive this notification. (Backend targeting required for actual delivery)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="targetPlan"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1"><Users className="h-4 w-4"/>Subscription Plan</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select target plan" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {allSubscriptionTiersList.map((plan) => (
                                <SelectItem key={plan} value={plan}>
                                  {plan}
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
                      name="targetExam"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1"><BookOpen className="h-4 w-4"/>Target Exam</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select target exam" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {favExams.map((exam) => (
                                <SelectItem key={exam} value={exam}>
                                  {exam}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2"><MessageSquare className="text-primary"/>Compose Message</CardTitle>
                    <CardDescription>Select a template or write a custom message.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="messageTemplate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Message Template</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a template" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {notificationTemplates.map((template) => (
                                <SelectItem key={template.value} value={template.value}>
                                  {template.label}
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
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notification Message</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Enter your notification message here. Use placeholders like [User], [ExamName], etc., if applicable."
                              className="min-h-[150px] resize-y"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Placeholders like [User], [ExamName] will need to be replaced by your backend if used.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </div>
              <CardFooter className="flex justify-end pt-6">
                <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
                  <Send className="mr-2 h-5 w-5" />
                  {form.formState.isSubmitting ? 'Sending...' : 'Send Notification'}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
    
