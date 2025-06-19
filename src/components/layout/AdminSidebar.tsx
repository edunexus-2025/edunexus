
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
  ShieldCheck,
  Users,
  Send,
  Settings,
  LogOut,
  User,
  LayoutDashboard,
  ListPlus,
  FileEdit,
  FileJson2,
  FilePlus,
  Megaphone,
  TicketPercent,
  BookOpen,
  Layers,
  BookCopy,
  GraduationCap,
  Database,
  ClipboardList,
  FileSpreadsheet
} from 'lucide-react';
import { ThemeToggleButton } from './ThemeToggleButton';
import { buttonVariants } from '../ui/button';

const adminNavGroups = [
  {
    label: 'Core Admin',
    icon: <ShieldCheck />,
    items: [
      { href: Routes.adminDashboard, label: 'Admin Dashboard', icon: <LayoutDashboard /> },
      { href: Routes.adminUserManagement, label: 'User Management', icon: <Users /> },
      { href: Routes.adminNotificationSender, label: 'Send Notifications', icon: <Send /> },
      { href: Routes.adminSiteSettings, label: 'Site Settings', icon: <Settings /> },
    ]
  },
  {
    label: 'Content Creation',
    icon: <ClipboardList />,
    items: [
      { href: Routes.adminQuestionBank, label: 'Add Question', icon: <ListPlus /> },
      { href: Routes.adminEditQuestion, label: 'Edit Questions', icon: <FileEdit /> },
      { href: Routes.adminAddQuestionJson, label: 'Add Questions (JSON)', icon: <FileJson2 /> },
      { href: Routes.adminCreateTest, label: 'Create Test', icon: <FilePlus /> },
    ]
  },
  {
    label: 'Syllabus & Structure',
    icon: <BookOpen />,
    items: [
      { href: Routes.adminSyllabusOverview, label: 'Syllabus Overview', icon: <BookOpen /> },
      { href: Routes.adminContentStructure, label: 'Content Structure', icon: <Layers /> },
      { href: Routes.adminContentSyllabusManager, label: 'Syllabus Manager', icon: <BookCopy /> },
    ]
  },
  {
    label: 'Data & Marketing',
    icon: <Database />,
    items: [
      // { href: Routes.adminManageCollegeCutoffs, label: 'Manage College Cutoffs', icon: <GraduationCap /> }, // This route might be obsolete if only upload is needed
      { href: Routes.adminUploadCollegeCutoffs, label: 'Upload Cutoffs (PDF Text)', icon: <FileSpreadsheet /> },
      { href: Routes.adminCreateAds, label: 'Create Ads', icon: <Megaphone /> },
      { href: Routes.adminManageReferrals, label: 'Manage Referrals', icon: <TicketPercent /> },
    ]
  }
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout, isLoading } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();

  const isActive = (href: string) => {
    if (!href) return false;
    if (href === Routes.adminDashboard) return pathname === href;
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
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="flex-1 p-0">
        {adminNavGroups.map(group => (
          <SidebarGroup key={group.label} className="p-2">
            <SidebarGroupLabel className="flex items-center gap-2">
              {group.icon}
              <span className="group-data-[collapsible=icon]:sr-only">{group.label}</span>
            </SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => (
                item.href ? (
                  <SidebarMenuItem key={item.label}>
                    <Link href={item.href} passHref legacyBehavior>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.href)}
                        tooltip={item.label}
                        aria-label={item.label}
                        onClick={handleMobileNavClick}
                      >
                        <a>
                          {item.icon}
                          <span>{item.label}</span>
                        </a>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                ) : null
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-2 border-t border-sidebar-border bg-card">
        {user && !isLoading && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center gap-3 p-2 rounded-md hover:bg-sidebar-accent group cursor-pointer">
                <Avatar className="h-8 w-8">
                  {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                  <AvatarFallback>{user.name?.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="overflow-hidden group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium text-sidebar-foreground group-hover:text-sidebar-accent-foreground truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground group-hover:text-sidebar-accent-foreground truncate">{user.email}</p>
                </div>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56 mb-1 ml-1 bg-sidebar border-sidebar-border text-sidebar-foreground">
              <DropdownMenuItem asChild>
                <Link href={Routes.profile} className="flex items-center gap-2 cursor-pointer hover:!bg-sidebar-accent hover:!text-sidebar-accent-foreground" onClick={handleMobileNavClick}>
                  <User className="h-4 w-4" />
                  <span>My Profile</span>
                </Link>
              </DropdownMenuItem>
               <DropdownMenuItem asChild>
                <Link href={Routes.dashboard} className="flex items-center gap-2 cursor-pointer hover:!bg-sidebar-accent hover:!text-sidebar-accent-foreground" onClick={handleMobileNavClick}>
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Student Dashboard</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={Routes.settings} className="flex items-center gap-2 cursor-pointer hover:!bg-sidebar-accent hover:!text-sidebar-accent-foreground" onClick={handleMobileNavClick}>
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <SidebarMenuButton tooltip="Logout" aria-label="Logout" disabled={isLoading} className="w-full">
                  <LogOut />
                  <span>Logout</span>
                </SidebarMenuButton>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
                  <AlertDialogDescription>
                    Do you really want to logout from {AppConfig.appName} - The Online Test Platform?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => { logout(); handleMobileNavClick(); }} className={buttonVariants({ variant: "destructive" })}>
                    Logout
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

