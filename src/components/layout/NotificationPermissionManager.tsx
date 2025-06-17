
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
// Card components are not used in the final banner design
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { BellRing, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AppConfig } from '@/lib/constants';
import pb from '@/lib/pocketbase';
import { useAuth } from '@/contexts/AuthContext';

const NOTIFICATION_PERMISSION_DISMISSED_KEY = `${AppConfig.appName.toLowerCase()}_notification_permission_dismissed_v1`;

export function NotificationPermissionManager() {
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'loading' | 'unsupported'>('loading');
  const [showPermissionRequestBanner, setShowPermissionRequestBanner] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth(); // Get the current user

  const checkAndSetInitialState = useCallback(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermissionStatus('unsupported');
      setShowPermissionRequestBanner(false);
      return;
    }

    const currentPermission = Notification.permission;
    setPermissionStatus(currentPermission);

    const dismissed = localStorage.getItem(NOTIFICATION_PERMISSION_DISMISSED_KEY);

    if (currentPermission === 'default' && !dismissed) {
      setShowPermissionRequestBanner(true);
    } else {
      setShowPermissionRequestBanner(false);
    }
  }, []);

  useEffect(() => {
    checkAndSetInitialState();
  }, [checkAndSetInitialState]);

  const updatePocketBaseNotificationPreference = async (userId: string, wantsNotifications: boolean) => {
    try {
      let existingPreferenceRecord;
      try {
        existingPreferenceRecord = await pb.collection('permission_required').getFirstListItem(`user = "${userId}"`);
      } catch (error: any) {
        if (error.status === 404) {
          existingPreferenceRecord = null; 
        } else {
          throw error; 
        }
      }

      if (existingPreferenceRecord) {
        await pb.collection('permission_required').update(existingPreferenceRecord.id, {
          notification: wantsNotifications,
        });
        console.log(`Updated notification preference for user ${userId} to ${wantsNotifications}`);
      } else {
        await pb.collection('permission_required').create({
          user: userId,
          notification: wantsNotifications,
          camera: false, 
          microphone: false,
        });
        console.log(`Created notification preference for user ${userId}, set to ${wantsNotifications}`);
      }
    } catch (error) {
      console.error('Failed to update PocketBase notification preference:', error);
      toast({
        title: 'Preference Sync Error',
        description: 'Could not sync notification preference with the server.',
        variant: 'destructive',
      });
    }
  };


  const handleRequestPermission = async () => {
    if (typeof window === 'undefined' ||!('Notification' in window) || Notification.permission === 'denied') {
      toast({
        title: 'Notifications Blocked',
        description: 'Please enable notifications in your browser settings if you wish to receive them.',
        variant: 'default',
      });
      setShowPermissionRequestBanner(false);
      localStorage.setItem(NOTIFICATION_PERMISSION_DISMISSED_KEY, 'true');
      if (user?.id) {
        await updatePocketBaseNotificationPreference(user.id, false);
      }
      return;
    }

    if (Notification.permission === 'granted') {
       toast({ title: 'Notifications Already Enabled', description: 'You are all set to receive updates!' });
       setShowPermissionRequestBanner(false);
       if (user?.id) {
         await updatePocketBaseNotificationPreference(user.id, true);
       }
       return;
    }

    try {
      const permissionResult = await Notification.requestPermission();
      setPermissionStatus(permissionResult);
      setShowPermissionRequestBanner(false);
      localStorage.setItem(NOTIFICATION_PERMISSION_DISMISSED_KEY, 'true'); 

      if (permissionResult === 'granted') {
        toast({
          title: 'Notifications Enabled!',
          description: 'You will now receive updates from ' + AppConfig.appName,
        });
        if (user?.id) {
          await updatePocketBaseNotificationPreference(user.id, true);
        }
        // Optional: Send a welcome notification
        // new Notification(`${AppConfig.appName} Notifications`, { body: 'You are now subscribed to notifications!' });
      } else if (permissionResult === 'denied') {
        toast({
          title: 'Notifications Blocked',
          description: 'You have blocked notifications. You can enable them in browser settings.',
          variant: 'default',
        });
         if (user?.id) {
          await updatePocketBaseNotificationPreference(user.id, false);
        }
      } else { 
        toast({
          title: 'Notification Preference',
          description: 'You can enable notifications later from settings if you change your mind.',
          variant: 'default',
        });
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
      toast({
        title: 'Permission Error',
        description: 'Could not request notification permission.',
        variant: 'destructive',
      });
    }
  };

  const handleDismissBanner = () => {
    setShowPermissionRequestBanner(false);
    localStorage.setItem(NOTIFICATION_PERMISSION_DISMISSED_KEY, 'true');
    toast({
        title: 'Notifications Later',
        description: 'You can manage notification settings later.',
        variant: 'default',
    });
  };


  if (permissionStatus === 'loading' || permissionStatus === 'unsupported' || permissionStatus === 'granted' || permissionStatus === 'denied' || !showPermissionRequestBanner) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[200] w-full max-w-sm print:hidden">
      <Alert variant="default" className="bg-card shadow-xl border-primary/30">
        <BellRing className="h-5 w-5 text-primary" />
        <AlertTitle className="font-semibold text-foreground">Enable Notifications?</AlertTitle>
        <AlertDescription className="text-sm text-muted-foreground">
          Stay updated with important announcements and progress reports from {AppConfig.appName}.
        </AlertDescription>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={handleDismissBanner} className="text-muted-foreground">
            Later
          </Button>
          <Button size="sm" onClick={handleRequestPermission} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            Enable
          </Button>
        </div>
      </Alert>
    </div>
  );
}
