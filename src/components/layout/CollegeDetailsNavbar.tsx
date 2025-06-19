
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AppLogo } from './AppLogo'; // Using a simplified version or a specific college portal logo
import { Routes, AppConfig } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { GraduationCap, LogOut, UserCircle } from 'lucide-react'; // UserCircle instead of LayoutDashboard

export function CollegeDetailsNavbar() {
  const { collegeUser, logout, isLoadingCollegeUser } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout(); // Assuming logout clears collegeUser as well
    router.push(Routes.collegeDetailsLogin);
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href={Routes.collegeDetailsLogin} className="flex items-center gap-2">
          <GraduationCap className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold text-primary">{AppConfig.appName} College Portal</span>
        </Link>
        
        <div className="flex items-center gap-2">
          {isLoadingCollegeUser ? (
            <div className="h-9 w-20 animate-pulse rounded-md bg-muted"></div>
          ) : collegeUser ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href={Routes.collegeDetailsDashboard}>
                  <UserCircle className="mr-2 h-4 w-4" /> Dashboard
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" /> Logout
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href={Routes.collegeDetailsLogin}>Login</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href={Routes.collegeDetailsSignup}>Sign Up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
