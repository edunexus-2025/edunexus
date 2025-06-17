
'use client'; 

import { AdminSidebar } from '@/components/layout/AdminSidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminProtectedRoute } from '@/components/auth/AdminProtectedRoute';
import { AppLogo } from '@/components/layout/AppLogo';
import { ThemeToggleButton } from '@/components/layout/ThemeToggleButton';
// import { NotificationPopover } from '@/components/layout/NotificationPopover'; // Admin might not need general notifications here
// import type { NotificationMessage } from '@/lib/types'; // If notifications are used
// import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button'; // Added Button import
import Link from 'next/link'; // Added Link import
import { Routes } from '@/lib/constants'; // Added Routes import
import { Trophy } from 'lucide-react'; // Added Trophy import

// const adminNotificationsData: NotificationMessage[] = []; // Placeholder

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // const [notifications, setNotifications] = useState<NotificationMessage[]>(adminNotificationsData);
  // const deleteNotification = (id: string) => setNotifications((prev) => prev.filter((n) => n.id !== id));
  // const clearAllNotifications = () => setNotifications([]);

  return (
    <AdminProtectedRoute>
      <SidebarProvider defaultOpen={true}>
        <AdminSidebar />
        
        <div className="flex flex-col flex-1">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 md:hidden">
            <AppLogo mainTextSize="text-xl" />
            <div className="flex items-center gap-1">
              <ThemeToggleButton />
              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                <Link href={Routes.leaderboard} aria-label="Leaderboard">
                  <Trophy className="h-[1.2rem] w-[1.2rem]" />
                </Link>
              </Button>
              {/* <NotificationPopover
                notifications={notifications}
                deleteNotification={deleteNotification}
                clearAllNotifications={clearAllNotifications}
              /> */}
              <SidebarTrigger />
            </div>
          </header>

          <SidebarInset> 
            {children}
          </SidebarInset>
        </div>
      </SidebarProvider>
    </AdminProtectedRoute>
  );
}
