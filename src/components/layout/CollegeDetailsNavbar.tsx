
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AppLogo } from './AppLogo'; 
import { Routes, AppConfig } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { GraduationCap, LogOut, UserCircle, Menu as MenuIcon } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar'; // Import SidebarTrigger
import { ThemeToggleButton } from './ThemeToggleButton';

export function CollegeDetailsNavbar() {
  const { collegeUser, logout, isLoadingCollegeUser } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push(Routes.collegeDetailsLogin);
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="h-8 w-8" /> {/* Mobile Sidebar Trigger */}
          <Link href={Routes.collegeDetailsLogin} className="flex items-center gap-1 md:hidden">
            <GraduationCap className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold text-primary">{AppConfig.appName}</span>
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggleButton />
          {isLoadingCollegeUser ? (
            <div className="h-8 w-16 animate-pulse rounded-md bg-muted"></div>
          ) : collegeUser ? (
             <Button variant="ghost" size="icon" onClick={handleLogout} className="h-8 w-8">
                <LogOut className="h-5 w-5" />
             </Button>
          ) : (
            <Button variant="outline" size="sm" asChild className="h-8 px-3 text-xs">
              <Link href={Routes.collegeDetailsLogin}>Login</Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
