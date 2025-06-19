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
  SidebarMenuBadge,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarSeparator,
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
  ListChecks,
  FileText,
  Target,
  ClipboardList,
  NotebookPen,
  TrendingUp,
  Swords,
  Link2,
  LogOut,
  Settings,
  User,
  ShieldCheck,
  Bell,
  XIcon,
  UserPlus,
  Award,
  ClipboardSignature,
  DollarSign,
  BookHeart,
  LifeBuoy,
  Grid,
  Trophy,
  ChevronDown
} from 'lucide-react';
import { ThemeToggleButton } from './ThemeToggleButton';
import { NotificationPopover } from './NotificationPopover';
import type { NotificationMessage } from '@/lib/types';
import { buttonVariants } from '../ui/button';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';


const mainNavItems = [
  { href: Routes.dashboard, label: 'Dashboard', icon: <LayoutDashboard /> },
  { href: Routes.testSeries, label: 'Test Series', icon: <ListChecks />, badge: 'New' },
  { href: Routes.dpp, label: 'DPP', icon: <FileText /> },
  { href: Routes.pyqPractice, label: 'PYQ Practice', icon: <Grid /> },
  { href: Routes.notebooks, label: 'Notebooks', icon: <BookHeart /> },
  { href: Routes.myProgress, label: 'My Progress', icon: <TrendingUp /> },
];

const teacherPanelItems = [
  { href: Routes.studentTeacherRanking, label: 'Teacher Ranking', icon: <Award /> },
  { href: Routes.myTeacherPortal, label: 'My Teacher Portal', icon: <ClipboardSignature /> }, // Updated href
];

const connectNavItems = [
  { href: Routes.createChallenge, label: 'Create Challenge', icon: <Swords /> },
  { href: Routes.challengeInvites, label: 'Challenge Invites', icon: <ListChecks /> },
  { href: Routes.findFriends, label: 'Find Friends', icon: <UserPlus /> },
  { href: Routes.connections, label: 'Connections', icon: <Link2 /> },
];

const supportNavItems = [
  { href: Routes.helpCenter, label: 'Help Center', icon: <LifeBuoy /> },
];


interface DashboardSidebarProps {
  notifications: NotificationMessage[];
  deleteNotification: (id: string) => void;
  clearAllNotifications: () => void;
}

const HIDE_PROFILE_HINT_PERMANENTLY_KEY = `${AppConfig.appName.toLowerCase()}_hideProfileHintPermanently`;

export function DashboardSidebar({
  notifications,
  deleteNotification,
  clearAllNotifications
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const { user, logout, isLoading } = useAuth();
  const { state: sidebarState, isMobile, setOpenMobile } = useSidebar();
  const { toast } = useToast();

  const [showProfileHint, setShowProfileHint] = React.useState(false);
  const [isSupportOpen, setIsSupportOpen] = React.useState(false); // State for Support dropdown

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const shouldHidePermanently = localStorage.getItem(HIDE_PROFILE_HINT_PERMANENTLY_KEY);
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
      localStorage.setItem(HIDE_PROFILE_HINT_PERMANENTLY_KEY, 'true');
    }
  };


  const isActive = (href: string) => {
    if (!href) return false;
    if (href === Routes.dashboard) return pathname === href;
    if (href === Routes.adminDashboard) return pathname.startsWith('/admin');
    if (href === Routes.teacherDashboard && pathname.startsWith('/teacher/dashboard')) return true;
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
          <SidebarGroupLabel>Main Navigation</SidebarGroupLabel>
          <SidebarMenu>
            {mainNavItems.map((item) => (
              item.href && typeof item.href === 'string' ? (
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
                        {item.badge && <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>}
                      </a>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              ) : null
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarSeparator />

        {user?.role === 'User' && (
          <>
            <SidebarGroup className="p-2">
              <SidebarGroupLabel>Teacher Panel</SidebarGroupLabel>
              <SidebarMenu>
                {teacherPanelItems.map((item) => (
                  item.href && typeof item.href === 'string' ? (
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
            <SidebarSeparator />
          </>
        )}

        <SidebarGroup className="p-2">
          <SidebarGroupLabel
            asChild
            className="cursor-pointer hover:bg-sidebar-accent/50 rounded-md data-[collapsible=icon]:cursor-default data-[collapsible=icon]:hover:bg-transparent"
            onClick={() => {
              if (sidebarState === 'expanded') { // Only allow toggle if sidebar is expanded
                 toast({ title: "Coming Soon!", description: "Connect & Compete features are under development." });
              }
            }}
            aria-controls="connect-compete-menu"
            aria-expanded={false} // Always false as it's locked
          >
            <button className="flex items-center justify-between w-full text-left group-data-[collapsible=icon]:justify-center">
              <span className="group-data-[collapsible=icon]:sr-only">Connect & Compete</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200 group-data-[collapsible=icon]:hidden",
                  // No rotation class here as it's locked
                )}
              />
            </button>
          </SidebarGroupLabel>
          {/* Connect & Compete menu remains hidden (not rendered) */}
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup className="p-2">
          <SidebarGroupLabel
            asChild
            className="cursor-pointer hover:bg-sidebar-accent/50 rounded-md data-[collapsible=icon]:cursor-default data-[collapsible=icon]:hover:bg-transparent"
            onClick={() => {
              if (sidebarState === 'expanded') { // Only allow toggle if sidebar is expanded
                setIsSupportOpen(prev => !prev);
              }
            }}
            aria-controls="support-menu"
            aria-expanded={isSupportOpen}
          >
            <button className="flex items-center justify-between w-full text-left group-data-[collapsible=icon]:justify-center">
              <span className="group-data-[collapsible=icon]:sr-only">Support</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200 group-data-[collapsible=icon]:hidden",
                  isSupportOpen && "rotate-180"
                )}
              />
            </button>
          </SidebarGroupLabel>
          {isSupportOpen && (
            <SidebarMenu id="support-menu" className="mt-1">
              {supportNavItems.map((item) => (
                item.href && typeof item.href === 'string' ? (
                  <SidebarMenuItem key={item.label}>
                    <Link href={item.href} passHref legacyBehavior>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.href)}
                        tooltip={item.label}
                        aria-label={item.label}
                        onClick={handleMobileNavClick}
                        className="h-8 text-sm" // Slightly smaller for sub-items
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
          )}
        </SidebarGroup>

        {user?.role === 'Admin' && (
          <>
            <SidebarSeparator />
            <SidebarGroup className="p-2">
              <SidebarGroupLabel>Administration</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <Link href={Routes.adminDashboard} passHref legacyBehavior>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(Routes.adminDashboard)}
                      tooltip="Admin Area"
                      aria-label="Admin Area"
                      onClick={handleMobileNavClick}
                    >
                      <a>
                        <ShieldCheck />
                        <span>Admin Area</span>
                      </a>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="p-2 border-t border-sidebar-border bg-card">
        {user && !isLoading && (
          <div className="relative">
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
                  <Link href={Routes.settings} className="flex items-center gap-2 cursor-pointer hover:!bg-sidebar-accent hover:!text-sidebar-accent-foreground" onClick={handleMobileNavClick}>
                    <Settings className="h-4 w-4" />
                    <span>My Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={Routes.myProgress} className="flex items-center gap-2 cursor-pointer hover:!bg-sidebar-accent hover:!text-sidebar-accent-foreground" onClick={handleMobileNavClick}>
                    <TrendingUp className="h-4 w-4" />
                    <span>My Progress</span>
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
                <p className="text-xs text-center mb-2">Click your name above to access Profile, Settings &amp; Progress!</p>
                <div className="flex items-center space-x-2 justify-center">
                  <Checkbox
                    id="dismiss-hint-permanently"
                    onCheckedChange={(checked) => {
                      if (checked) {
                        handleDismissHintPermanently();
                      }
                    }}
                    className="border-primary-foreground/50 data-[state=checked]:bg-primary-foreground data-[state=checked]:text-primary"
                  />
                  <Label htmlFor="dismiss-hint-permanently" className="text-xs cursor-pointer">Don't show again</Label>
                </div>
                {/* Triangle pointer */}
                <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 transform border-x-[6px] border-t-[6px] border-x-transparent border-t-primary"></div>
              </div>
            )}
          </div>
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
