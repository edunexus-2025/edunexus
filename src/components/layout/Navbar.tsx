
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AppLogo } from './AppLogo';
import { Routes, AppConfig } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { ArrowLeft, GraduationCap, Lightbulb, Search } from 'lucide-react'; // Added Search

interface NavbarProps {}

export function Navbar({}: NavbarProps) {
  const { user, isLoading, teacher, isLoadingTeacher } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const effectiveUser = user || teacher;
  const effectiveLoading = isLoading || isLoadingTeacher;

  const showBackButton = pathname !== Routes.home &&
                         pathname !== Routes.login &&
                         pathname !== Routes.signup &&
                         pathname !== Routes.teacherLogin &&
                         pathname !== Routes.teacherSignup;

  const getDashboardButtonText = () => {
    if (!effectiveUser) return 'Dashboard'; // Should not happen if button is shown
    if (effectiveUser.collectionName === 'teacher_data') {
      return 'Teacher Dashboard';
    }
    return 'Student Dashboard';
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between"> {/* Reduced height */}
        <div className="flex items-center gap-2">
          {showBackButton && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              aria-label="Go back"
              className="mr-1 h-8 w-8" // Compact size
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <AppLogo mainTextSize="text-xl" taglineTextSize="text-[10px]" iconSize={24} /> {/* Adjusted logo sizes */}
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
           {/* College Predictor button removed */}
           {/* College Details Login button removed */}
          {effectiveLoading ? (
            <div className="h-9 w-20 animate-pulse rounded-md bg-muted"></div>
          ) : effectiveUser ? (
            <Button
              size="sm" // Smaller dashboard button
              onClick={() => router.push(effectiveUser.collectionName === 'teacher_data' ? Routes.teacherDashboard : Routes.dashboard)}
              aria-label="Go to dashboard"
            >
              {getDashboardButtonText()}
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href={Routes.login}>Login</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href={Routes.signup}>Sign Up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
