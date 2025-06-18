
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from "react"; // Import React for useState and useEffect
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  useSidebar, 
} from '@/components/ui/sidebar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AppLogo } from './AppLogo';
import { useAuth } from '@/contexts/AuthContext';
import { Routes, AppConfig } from '@/lib/constants';
import {
  LayoutDashboard,
  BookOpenCheck,
  Users,
  Settings,
  LogOut,
  User,
  BarChart3,
  Bell,
  XIcon, 
  Users2, 
  Megaphone,
  DollarSign, 
  MessagesSquare, 
  Trophy, 
  Zap,
  Wallet,
  TicketPercent // Added TicketPercent for referrals
} from 'lucide-react';
import { ThemeToggleButton } from './ThemeToggleButton';
import { NotificationPopover } from './NotificationPopover';
import type { NotificationMessage } from '@/lib/types';
import { buttonVariants } from '../ui/button';
import { Checkbox } from '@/components/ui/checkbox'; 
import { Label } from '@/components/ui/label'; 
import { Button } from '@/components/ui/button';


// Mock notifications for teachers for now
const teacherNotificationsData: NotificationMessage[] = [
    {
        id: 'teacher_1',
        title: 'New Student Enrolled!',
        message: `John Doe has enrolled in your Physics for JEE course.`,
        timestamp: new Date(Date.now() - 1000 * 60 * 45),
    },
    {
        id: 'teacher_2',
        title: 'Content Update Reminder',
        message: "Don't forget to upload new DPPs for Thermodynamics.",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), 
    },
];

const teacherNavItems = [
  { href: Routes.teacherDashboard, label: 'Dashboard', icon: <LayoutDashboard /> },
  { href: Routes.teacherMyContent, label: 'My Content', icon: <BookOpenCheck /> },
  { href: Routes.teacherManagePlans, label: 'Manage Plans', icon: <DollarSign /> },
  { href: Routes.teacherManageReferrals, label: 'Manage Referrals', icon: <TicketPercent /> }, // New Item
  { href: Routes.teacherMyStudents, label: 'My Students', icon: <Users /> },
  { href: Routes.teacherManageDiscussion, label: 'Manage Discussion', icon: <MessagesSquare /> }, 
  { href: Routes.teacherStudentPerformance, label: 'Student Performance', icon: <BarChart3 /> },
  { href: Routes.teacherWallet, label: 'My Wallet', icon: <Wallet /> },
  { href: Routes.teacherCreateAds, label: 'Create Ads', icon: <Megaphone /> },
  { href: Routes.teacherUpgradePlatformPlan, label: 'Upgrade Plan', icon: <Zap /> }, 
  { href: Routes.teacherSettings, label: 'Settings', icon: <Settings /> },
];

const HIDE_TEACHER_PROFILE_HINT_PERMANENTLY_KEY = `${AppConfig.appName.toLowerCase()}_hideTeacherProfileHintPermanently`;

export function TeacherSidebar() {
  const pathname = usePathname();
  const { teacher, logout, isLoadingTeacher } = useAuth();
  const { state: sidebarState, isMobile, setOpenMobile } = useSidebar();

  const [notifications, setNotifications] = React.useState<NotificationMessage[]>(teacherNotificationsData);
  const [showProfileHint, setShowProfileHint] = React.useState(false);

  const deleteNotification = (id: string) => setNotifications((prev) => prev.filter((n) => n.id !== id));
  const clearAllNotifications = () => setNotifications([]);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const shouldHidePermanently = localStorage.getItem(HIDE_TEACHER_PROFILE_HINT_PERMANENTLY_KEY);
      if (shouldHidePermanently === 'true') {
        setShowProfileHint(false);
      } else {
        setShowProfileHint(true);
      }
    }
  }, []);

  const handleCloseHintTemporarily = () => {
    setShowProfileHint(false);
  };

  const handleDismissHintPermanently = () => {
    setShowProfileHint(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem(HIDE_TEACHER_PROFILE_HINT_PERMANENTLY_KEY, 'true');
    }
  };

  const isActive = (href?: string) => { 
    if (!href) return false;
    if (href === Routes.teacherDashboard) return pathname === href;
    // For nested routes like /teacher/dashboard/my-content/[testId], check if pathname starts with the base
    if (href === Routes.teacherMyContent && pathname.startsWith(Routes.teacherMyContent)) return true;
    if (href === Routes.teacherManagePlans && pathname.startsWith(Routes.teacherManagePlans)) return true;
    return pathname.startsWith(href);
  };

  const handleMobileNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar side="left" variant="sidebar" collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center justify-between">
          <AppLogo mainTextSize="text-xl" taglineTextSize="text-[10px]" iconSize={36} />
          <div className="hidden md:flex items-center gap-1">
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
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="flex-1 p-0">
        <SidebarGroup className="p-2">
          <SidebarGroupLabel>Teacher Tools</SidebarGroupLabel>
          <SidebarMenu>
            {teacherNavItems.map((item) => (
              item.href ? ( 
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
              ) : null 
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2 border-t border-sidebar-border bg-card">
        {teacher && !isLoadingTeacher && (
          <div className="relative">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-3 p-2 rounded-md hover:bg-sidebar-accent group cursor-pointer">
                  <Avatar className="h-8 w-8">
                    {teacher.avatarUrl && <AvatarImage src={teacher.avatarUrl} alt={teacher.name} />}
                    <AvatarFallback>{teacher.name?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="overflow-hidden group-data-[collapsible=icon]:hidden">
                      <p className="text-sm font-medium text-sidebar-foreground group-hover:text-sidebar-accent-foreground truncate">{teacher.name}</p>
                      <p className="text-xs text-muted-foreground group-hover:text-sidebar-accent-foreground truncate">{teacher.email}</p>
                  </div>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56 mb-1 ml-1 bg-sidebar border-sidebar-border text-sidebar-foreground">
                <DropdownMenuItem asChild>
                  <Link href={Routes.teacherSettings} className="flex items-center gap-2 cursor-pointer hover:!bg-sidebar-accent hover:!text-sidebar-accent-foreground" onClick={handleMobileNavClick}>
                    <User className="h-4 w-4" />
                    <span>My Profile & Settings</span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {showProfileHint && sidebarState === 'expanded' && (
              <div
                role="tooltip"
                className="absolute bottom-[calc(100%+8px)] left-1/2 z-50 w-max max-w-[250px] -translate-x-1/2 transform rounded-md bg-primary p-3 text-primary-foreground shadow-lg animate-in fade-in-50 slide-in-from-bottom-2"
              >
                <button
                  onClick={handleCloseHintTemporarily}
                  className="absolute -top-2 -right-2 rounded-full bg-primary-foreground p-0.5 text-primary transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Close hint for this session"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
                <p className="text-xs text-center mb-2">Click your name above to access Profile & Settings!</p>
                <div className="flex items-center space-x-2 justify-center">
                  <Checkbox
                    id="dismiss-teacher-hint-permanently"
                    onCheckedChange={(checked) => {
                      if (checked) {
                        handleDismissHintPermanently();
                      }
                    }}
                    className="border-primary-foreground/50 data-[state=checked]:bg-primary-foreground data-[state=checked]:text-primary"
                  />
                  <Label htmlFor="dismiss-teacher-hint-permanently" className="text-xs cursor-pointer">Don't show again</Label>
                </div>
                <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 transform border-x-[6px] border-t-[6px] border-x-transparent border-t-primary"></div>
              </div>
            )}
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                 <SidebarMenuButton tooltip="Logout" aria-label="Logout" disabled={isLoadingTeacher} className="w-full">
                  <LogOut />
                  <span>Logout</span>
                </SidebarMenuButton>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Confirm Logout</AlertDialogTitle><AlertDialogDescription>
                    Do you really want to logout from {AppConfig.appName} (Teacher Portal)?
                </AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => { logout(); handleMobileNavClick(); }} className={buttonVariants({ variant: "destructive" })}>Logout</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
