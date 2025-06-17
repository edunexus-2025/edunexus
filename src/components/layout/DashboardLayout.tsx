
'use client';

import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { TeacherSidebar } from '@/components/layout/TeacherSidebar'; // Import TeacherSidebar
import { AdminSidebar } from '@/components/layout/AdminSidebar';   // Import AdminSidebar
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppLogo } from '@/components/layout/AppLogo';
import { ThemeToggleButton } from '@/components/layout/ThemeToggleButton';
import { NotificationPopover } from '@/components/layout/NotificationPopover';
import type { NotificationMessage } from '@/lib/types';
import { useState, useEffect, useCallback } from 'react';
import { AppConfig, Routes, escapeForPbFilter } from '@/lib/constants'; // Added escapeForPbFilter
import { usePathname } from 'next/navigation';
import pb from '@/lib/pocketbase';
import type { RecordModel } from 'pocketbase';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth
import { Button } from '@/components/ui/button'; // Added Button import
import Link from 'next/link'; // Added Link import
import { Trophy } from 'lucide-react'; // Added Trophy import

const mapRecordToNotificationMessage = (record: RecordModel): NotificationMessage => {
  let title = record.message?.substring(0, 30) + (record.message?.length > 30 ? '...' : '');
  let type: NotificationMessage['type'] = 'general';

  if (record.message?.toLowerCase().includes("invited you to join")) {
    title = "New Group Invitation";
    type = 'invitation';
  } else if (record.type) { // Use explicit type from DB if available
    type = record.type as NotificationMessage['type'];
  }


  return {
    id: record.id,
    title: title,
    message: record.message,
    timestamp: new Date(record.created),
    read: record.seen,
    bywho: record.bywho, // Assuming bywho is a single ID string
    bywho_if_student: record.bywho_if_student,
    bywho_if_teacher: record.bywho_if_teacher,
    towho: Array.isArray(record.towho) ? record.towho : (record.towho ? [record.towho] : []),
    type: type,
    approved: record.approved,
    related_challenge_id: record.related_challenge_id,
    related_invite_id: record.related_invite_id,
  };
};


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, teacher, isLoading, isLoadingTeacher } = useAuth(); // Get student, teacher, and their loading states
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
  const [isNotificationsLoaded, setIsNotificationsLoaded] = useState(false);
  const pathname = usePathname();

  const activeUser = user || teacher; // Determine the currently active user (student or teacher)

  const fetchNotifications = useCallback(async (currentActiveUser: typeof activeUser) => {
    if (!currentActiveUser || !currentActiveUser.id) {
      setNotifications([]);
      setIsNotificationsLoaded(true);
      return;
    }
    setIsNotificationsLoaded(false);
    let isMounted = true;

    try {
      const escapedUserId = escapeForPbFilter(currentActiveUser.id);
      const filter = `(towho ~ "${escapedUserId}" || towho = "${escapedUserId}") && deleted = false`;
      if (!isMounted) return;
      const records = await pb.collection('notification').getFullList<RecordModel>({
        sort: '-created',
        filter: filter,
        '$autoCancel': false,
      });

      if (isMounted) {
        const fetchedMessages = records.map(mapRecordToNotificationMessage);
        setNotifications(fetchedMessages);
      }
    } catch (error: any) {
      if (isMounted) {
        if (error.isAbort || (error.name === 'ClientResponseError' && error.status === 0)) {
            console.warn('DashboardLayout: Fetch notifications request was cancelled.');
        } else {
            console.error("DashboardLayout: Error fetching notifications:", error.data || error);
            setNotifications([]);
        }
      }
    } finally {
      if (isMounted) {
        setIsNotificationsLoaded(true);
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    const initialFetch = async () => {
      if (activeUser && activeUser.id && isMounted) {
        await fetchNotifications(activeUser);
      } else if (!activeUser && isMounted) {
        setNotifications([]);
        setIsNotificationsLoaded(true);
      }
    };

    initialFetch();

    if (activeUser && activeUser.id && isMounted) {
      const subscribeToNotifications = async () => {
        try {
          unsubscribe = await pb.collection('notification').subscribe('*', (e) => {
            if (!isMounted) return;
            let isRecipient = false;
            if (e.record.towho && activeUser.id) {
              const towhoArray = Array.isArray(e.record.towho) ? e.record.towho : [e.record.towho];
              isRecipient = towhoArray.includes(activeUser.id);
            }
            if (isRecipient) {
              fetchNotifications(activeUser);
            }
          }, { '$autoCancel': false });
        } catch (subError) {
          console.error("DashboardLayout: Error subscribing to notifications:", subError);
        }
      };
      subscribeToNotifications();
    }

    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [activeUser, fetchNotifications]);


  const deleteNotification = async (id: string) => {
    try {
      await pb.collection('notification').update(id, { deleted: true, seen: true });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      console.error("DashboardLayout: Failed to mark notification as deleted:", error);
    }
  };

  const clearAllNotifications = async () => {
    if (!activeUser || !activeUser.id || notifications.length === 0) return;
    try {
      const promises = notifications.map(n => pb.collection('notification').update(n.id, { deleted: true, seen: true }));
      await Promise.all(promises);
      setNotifications([]);
    } catch (error) {
      console.error("DashboardLayout: Failed to clear all notifications:", error);
    }
  };

  const isLayoutWithoutSidebar =
    (pathname.startsWith(Routes.dpp + '/') && pathname !== Routes.dpp) ||
    pathname.startsWith('/dashboard/qbank/') ||
    pathname.startsWith('/dashboard/test-results/') ||
    pathname.startsWith('/student/test/'); // Added test taking page


  if (isLayoutWithoutSidebar) {
    return (
      <ProtectedRoute>
        {children}
      </ProtectedRoute>
    );
  }
  
  let SidebarComponent;
  if (teacher) {
    SidebarComponent = <TeacherSidebar />;
  } else if (user?.role === 'Admin') {
    SidebarComponent = <AdminSidebar />;
  } else {
    SidebarComponent = <DashboardSidebar
        notifications={notifications}
        deleteNotification={deleteNotification}
        clearAllNotifications={clearAllNotifications}
      />;
  }


  return (
    <ProtectedRoute>
      <SidebarProvider defaultOpen={true}>
        {SidebarComponent}
        
        <div className="flex flex-col flex-1">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 md:hidden">
            <AppLogo mainTextSize="text-xl" taglineTextSize="text-[10px]" />
            <div className="flex items-center gap-1">
              <ThemeToggleButton />
              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                <Link href={Routes.leaderboard} aria-label="Leaderboard">
                  <Trophy className="h-[1.2rem] w-[1.2rem]" />
                </Link>
              </Button>
              <NotificationPopover
                notifications={notifications}
                deleteNotification={deleteNotification}
                clearAllNotifications={clearAllNotifications}
                isLoading={!isNotificationsLoaded}
              />
              <SidebarTrigger />
            </div>
          </header>

          <SidebarInset>
            {children}
          </SidebarInset>
        </div>
      </SidebarProvider>
    </ProtectedRoute>
  );
}
