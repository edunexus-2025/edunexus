
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation'; // Added useRouter
import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
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
  GraduationCap,
  ListChecks,
  Heart,
  Settings,
  LogOut,
  UserCircle,
  Search as SearchIcon,
} from 'lucide-react';
import { ThemeToggleButton } from './ThemeToggleButton';
import { buttonVariants } from '../ui/button';

const collegePortalNavItems = [
  { href: Routes.collegeDetailsDashboard, label: 'Dashboard', icon: <LayoutDashboard /> },
  { href: Routes.collegeDetailsSearch, label: 'College Search', icon: <SearchIcon /> },
  // { href: Routes.collegeDetailsCutoffs, label: 'Cutoff Analysis', icon: <ListChecks /> }, // Removed as per previous instruction
  { href: Routes.collegeDetailsPreferences, label: 'My Preferences', icon: <Heart /> },
];

export function CollegeDetailsSidebar() {
  const pathname = usePathname();
  const router = useRouter(); // Initialize useRouter
  const { collegeUser, logout, isLoadingCollegeUser } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();

  const isActive = (href?: string) => {
    if (!href) return false;
    if (href === Routes.collegeDetailsDashboard) return pathname === href;
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
          <Link href={Routes.collegeDetailsLogin} className="flex items-center gap-2" onClick={handleMobileNavClick}>
            <GraduationCap className="h-7 w-7 text-primary" />
            <div className="group-data-[collapsible=icon]:hidden">
              <span className="text-xl font-bold text-primary">{AppConfig.appName}</span>
              <p className="text-[10px] text-muted-foreground -mt-1">College Portal</p>
            </div>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            <ThemeToggleButton />
            {/* NotificationPopover could be added here if needed for college portal */}
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="flex-1 p-0">
        <SidebarMenu className="p-2">
          {collegePortalNavItems.map((item) => (
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
      </SidebarContent>

      <SidebarFooter className="p-2 border-t border-sidebar-border bg-card">
        {collegeUser && !isLoadingCollegeUser && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center gap-3 p-2 rounded-md hover:bg-sidebar-accent group cursor-pointer">
                <Avatar className="h-8 w-8">
                  {collegeUser.avatarUrl && <AvatarImage src={collegeUser.avatarUrl} alt={collegeUser.name} />}
                  <AvatarFallback className="bg-primary/20 text-primary">
                    {collegeUser.name?.charAt(0).toUpperCase() || 'C'}
                  </AvatarFallback>
                </Avatar>
                <div className="overflow-hidden group-data-[collapsible=icon]:hidden">
                  <p className="text-sm font-medium text-sidebar-foreground group-hover:text-sidebar-accent-foreground truncate">{collegeUser.name}</p>
                  <p className="text-xs text-muted-foreground group-hover:text-sidebar-accent-foreground truncate">{collegeUser.email}</p>
                </div>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56 mb-1 ml-1 bg-sidebar border-sidebar-border text-sidebar-foreground">
              <DropdownMenuItem asChild>
                <Link href={Routes.collegeDetailsDashboard} className="flex items-center gap-2 cursor-pointer hover:!bg-sidebar-accent hover:!text-sidebar-accent-foreground" onClick={handleMobileNavClick}>
                  <UserCircle className="h-4 w-4" />
                  <span>My Dashboard</span>
                </Link>
              </DropdownMenuItem>
              {/* Add link to College Details Settings if it exists */}
              {/* <DropdownMenuItem asChild><Link href={Routes.collegeDetailsSettings || '#'} className="flex items-center gap-2 cursor-pointer hover:!bg-sidebar-accent hover:!text-sidebar-accent-foreground" onClick={handleMobileNavClick}><Settings className="h-4 w-4" /><span>Settings</span></Link></DropdownMenuItem> */}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <SidebarMenuButton tooltip="Logout" aria-label="Logout" disabled={isLoadingCollegeUser} className="w-full">
                  <LogOut />
                  <span>Logout</span>
                </SidebarMenuButton>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
                  <AlertDialogDescription>
                    Do you really want to logout from the College Portal?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={async () => { await logout(); handleMobileNavClick(); router.push(Routes.collegeDetailsLogin); }} className={buttonVariants({ variant: "destructive" })}>
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

