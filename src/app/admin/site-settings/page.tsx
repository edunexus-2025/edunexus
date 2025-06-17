
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription, // Added FormDescription here
} from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Settings, ToggleRight, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppConfig } from '@/lib/constants'; 

const SITE_SETTINGS_STORAGE_KEY = `${AppConfig.appName.toLowerCase()}_site_settings`;

const siteSettingsSchema = z.object({
  featureNewRegistration: z.boolean().default(true),
  featureAiHints: z.boolean().default(true),
  // Add more feature flags here
});

type SiteSettingsFormValues = z.infer<typeof siteSettingsSchema>;

// Default values
const defaultSettings: SiteSettingsFormValues = {
  featureNewRegistration: true,
  featureAiHints: true,
};

export default function SiteSettingsPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  const form = useForm<SiteSettingsFormValues>({
    resolver: zodResolver(siteSettingsSchema),
    defaultValues: defaultSettings,
  });

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const storedSettingsString = localStorage.getItem(SITE_SETTINGS_STORAGE_KEY);
      if (storedSettingsString) {
        const storedSettings = JSON.parse(storedSettingsString);
        form.reset({ ...defaultSettings, ...storedSettings }); 
      } else {
        form.reset(defaultSettings); 
      }
    } catch (error) {
      console.error("Error loading site settings from localStorage:", error);
      form.reset(defaultSettings); 
    }
    setIsLoading(false);
  }, [form]);

  function onSubmit(data: SiteSettingsFormValues) {
    try {
      localStorage.setItem(SITE_SETTINGS_STORAGE_KEY, JSON.stringify(data));
      toast({
        title: 'Settings Saved (Locally)',
        description: (
          <div className="space-y-1">
            <p>Your feature flag settings have been saved in this browser&apos;s localStorage.</p>
            <p className="text-xs text-muted-foreground">
              (Note: These settings are for demonstration and do not affect the live site for other users.)
            </p>
          </div>
        ),
        duration: 7000,
      });
    } catch (error) {
        console.error("Error saving site settings to localStorage:", error);
        toast({
            title: "Error Saving Settings Locally",
            description: "Could not save settings to localStorage.",
            variant: "destructive",
        });
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-foreground flex items-center">
              <Settings className="mr-3 h-8 w-8 text-primary" /> Site Settings
            </CardTitle>
            <CardDescription>
              Loading settings...
            </CardDescription>
          </CardHeader>
          <CardContent>
             <div className="animate-pulse space-y-4">
                <div className="h-8 bg-muted rounded w-1/3"></div>
                <div className="h-10 bg-muted rounded w-full"></div>
                <div className="h-20 bg-muted rounded w-full"></div>
                <div className="h-10 bg-muted rounded w-1/2 self-end"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-foreground flex items-center">
            <Settings className="mr-3 h-8 w-8 text-primary" /> Site Settings
          </CardTitle>
          <CardDescription>
            Configure application feature flags. (Simulated: Saves to local storage)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
              
              {/* Feature Flags Section */}
              <Card className="border-primary/30">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2"><ToggleRight className="text-primary"/>Feature Flags</CardTitle>
                  <CardDescription>Enable or disable specific application features.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="featureNewRegistration"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Enable New User Registration</FormLabel>
                          <FormDescription>
                            Allow or disallow new users to sign up.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="featureAiHints"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Enable AI Hint System</FormLabel>
                          <FormDescription>
                            Turn the AI-powered hint feature on or off for DPPs.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {/* Add more feature flag FormFields here */}
                </CardContent>
              </Card>
              
              <CardFooter className="flex justify-end pt-6">
                <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
                  <Save className="mr-2 h-5 w-5" />
                  {form.formState.isSubmitting ? 'Saving...' : 'Save All Settings'}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

