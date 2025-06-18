
'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import * as React from "react"; // Import React for useState and useEffect
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar, 
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AppLogo } from '@/components/layout/AppLogo';
import { useAuth } from '@/contexts/AuthContext';
import { Routes, AppConfig } from '@/lib/constants';
import {
  LayoutDashboard,
  PlusCircle,
  Eye,
  Settings as SettingsIcon,
  BarChart2,
  LogOut,
  ChevronLeft,
  UserCircle,
  Bell,
  ClipboardCheck, 
} from 'lucide-react';
import { TeacherProtectedRoute } from '@/components/auth/TeacherProtectedRoute';
import { ThemeToggleButton } from '@/components/layout/ThemeToggleButton';
import { NotificationPopover } from '@/components/layout/NotificationPopover';
import type { NotificationMessage } from '@/lib/types';
import { useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';

// Mock notifications for this specific panel
const initialTestPanelNotifications: NotificationMessage[] = [
  {
    id: 'tp_notif_1',
    title: 'Test "Physics Mock 1" Published',
    message: 'Your test is now live for students.',
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
  },
];


interface TestManagementSidebarProps {
  testId: string;
  notifications: NotificationMessage[];
  deleteNotification: (id: string) => void;
  clearAllNotifications: () => void;
}

function TestManagementSidebar({ testId, notifications, deleteNotification, clearAllNotifications }: TestManagementSidebarProps) {
  const pathname = usePathname();
  const { teacher, logout } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar(); 

  const navItems = [
    { href: Routes.teacherTestPanel(testId), label: 'Dashboard', icon: <LayoutDashboard /> },
    { href: Routes.teacherTestPanelAddQuestion(testId), label: 'Add Question', icon: <PlusCircle /> },
    { href: Routes.teacherTestPanelViewQuestions(testId), label: 'View Questions', icon: <Eye /> },
    { href: Routes.teacherTestPanelStatus(testId), label: 'Test Status', icon: <ClipboardCheck /> }, 
    { href: Routes.teacherTestPanelSettings(testId), label: 'Settings', icon: <SettingsIcon /> },
    { href: Routes.teacherTestPanelResults(testId), label: 'View Results', icon: <BarChart2 /> },
  ];

  const isActive = (href: string) => {
    if (!href) return false;
    if (href === Routes.teacherTestPanel(testId)) return pathname === href;
    return pathname.startsWith(href);
  };

  const handleMobileNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar side="left" variant="sidebar" collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <AppLogo mainTextSize="text-xl" taglineTextSize="text-[10px]" iconSize={36} />
           <div className="hidden md:flex items-center gap-1">
            <ThemeToggleButton />
            <NotificationPopover
              notifications={notifications}
              deleteNotification={deleteNotification}
              clearAllNotifications={clearAllNotifications}
            />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="flex-1 p-0">
        <SidebarMenu className="p-2">
          {navItems.map((item) => (
            <SidebarMenuItem key={item.label}>
              <Link href={item.href} passHref legacyBehavior>
                <SidebarMenuButton
                  isActive={isActive(item.href)}
                  tooltip={item.label}
                  aria-label={item.label}
                  onClick={handleMobileNavClick}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-2 border-t border-sidebar-border">
        <SidebarMenu>
           <SidebarMenuItem>
              <Link href={Routes.teacherMyContent} passHref legacyBehavior>
                <SidebarMenuButton
                  tooltip="Back to My Content"
                  aria-label="Back to My Content"
                  onClick={handleMobileNavClick}
                >
                  <ChevronLeft />
                  <span>Back to My Content</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
        </SidebarMenu>
        {teacher && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center gap-3 p-2 rounded-md hover:bg-sidebar-accent group cursor-pointer">
                <Avatar className="h-8 w-8 border-2 border-primary">
                  {teacher.avatarUrl && <AvatarImage src={teacher.avatarUrl} alt={teacher.name} />}
                  <AvatarFallback className="bg-primary/20 text-primary">
                    {teacher.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="overflow-hidden group-data-[collapsible=icon]:hidden">
                  <p className="text-sm font-medium text-sidebar-foreground group-hover:text-sidebar-accent-foreground truncate">{teacher.name}</p>
                  <p className="text-xs text-muted-foreground group-hover:text-sidebar-accent-foreground truncate">{teacher.email}</p>
                </div>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              side="top" 
              align="start" 
              className="w-56 mb-1 ml-1 bg-sidebar border-sidebar-border text-sidebar-foreground"
            >
              <DropdownMenuItem asChild>
                <Link href={Routes.teacherSettings} className="flex items-center gap-2 cursor-pointer hover:!bg-sidebar-accent hover:!text-sidebar-accent-foreground" onClick={handleMobileNavClick}>
                  <UserCircle className="h-4 w-4" />
                  <span>Profile & Settings</span>
                </Link>
              </DropdownMenuItem>
               <DropdownMenuItem asChild>
                <Link href={Routes.teacherDashboard} className="flex items-center gap-2 cursor-pointer hover:!bg-sidebar-accent hover:!text-sidebar-accent-foreground" onClick={handleMobileNavClick}>
                   <LayoutDashboard className="h-4 w-4" />
                   <span>Main Dashboard</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-sidebar-border" />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="flex items-center gap-2 cursor-pointer !text-destructive hover:!bg-destructive/10 hover:!text-destructive focus:!bg-destructive/10 focus:!text-destructive">
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Confirm Logout</AlertDialogTitle><AlertDialogDescription>
                      Do you really want to logout from {AppConfig.appName}?
                  </AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => { logout(); handleMobileNavClick(); }} className={buttonVariants({ variant: "destructive" })}>Logout</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}


export default function TeacherTestPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Scoped extraction of testId
  const testId = (() => {
    const params = useParams(); // Hook is fine inside a client component
    const idFromParams = params?.testId;
    return typeof idFromParams === 'string' ? idFromParams : Array.isArray(idFromParams) ? idFromParams[0] : '';
  })();
  
  const [notifications, setNotifications] = useState<NotificationMessage[]>(initialTestPanelNotifications);

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  return (
    <TeacherProtectedRoute>
      <SidebarProvider defaultOpen={true}>
        <TestManagementSidebar 
            testId={testId} 
            notifications={notifications} 
            deleteNotification={deleteNotification}
            clearAllNotifications={clearAllNotifications}
        />
        <div className="flex flex-col flex-1">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4">
            <div className="md:hidden"> 
               <SidebarTrigger />
            </div>
            <h1 className="text-xl font-semibold ml-2 md:ml-0 text-foreground md:hidden">Test Management</h1>
            <div className="flex items-center gap-2 md:hidden">
              <ThemeToggleButton />
              <NotificationPopover
                notifications={notifications}
                deleteNotification={deleteNotification}
                clearAllNotifications={clearAllNotifications}
              />
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
