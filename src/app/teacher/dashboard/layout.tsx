
'use client'; 

import { TeacherSidebar } from '@/components/layout/TeacherSidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { TeacherProtectedRoute } from '@/components/auth/TeacherProtectedRoute';
import { AppLogo } from '@/components/layout/AppLogo';
import { ThemeToggleButton } from '@/components/layout/ThemeToggleButton';
import { NotificationPopover } from '@/components/layout/NotificationPopover';
import type { NotificationMessage } from '@/lib/types';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation'; // Import usePathname
import { Button } from '@/components/ui/button'; // Added Button import
import Link from 'next/link'; // Added Link import
import { Routes } from '@/lib/constants'; // Added Routes import
import { Trophy } from 'lucide-react'; // Added Trophy import

// Mock initial notifications for teacher dashboard
const initialTeacherNotifications: NotificationMessage[] = [
  {
    id: 't_notif_1',
    title: 'New Student Joined!',
    message: 'Suresh Sharma has joined your JEE Physics batch.',
    timestamp: new Date(Date.now() - 1000 * 60 * 30), 
  },
  {
    id: 't_notif_2',
    title: 'Content Update Reminder',
    message: "Don't forget to upload new DPPs for Thermodynamics.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), 
  },
];

export default function TeacherDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] = useState<NotificationMessage[]>(initialTeacherNotifications);
  const pathname = usePathname(); // Get the current path

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  // Check if the current path is for a specific test's management panel
  // e.g., /teacher/dashboard/my-content/some-test-id or its sub-pages
  const isSpecificTestPanelPage = pathname.startsWith('/teacher/dashboard/my-content/') && pathname.split('/').length > 4;


  if (isSpecificTestPanelPage) {
    // For specific test panel pages, the layout within my-content/[testId]/layout.tsx takes over.
    // This layout (TeacherDashboardLayout) should just render the children.
    return (
      <TeacherProtectedRoute>
        {children}
      </TeacherProtectedRoute>
    );
  }

  // For other teacher dashboard pages, render the full layout with TeacherSidebar
  return (
    <TeacherProtectedRoute>
      <SidebarProvider defaultOpen={true}>
        <TeacherSidebar /> 
        
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
              />
              <SidebarTrigger />
            </div>
          </header>

          <SidebarInset> 
            {children}
          </SidebarInset>
        </div>
      </SidebarProvider>
    </TeacherProtectedRoute>
  );
}
