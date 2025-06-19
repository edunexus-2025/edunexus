
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Routes } from "@/lib/constants";
import { CollegeDetailsProtectedRoute } from "@/components/auth/CollegeDetailsProtectedRoute";
import { GraduationCap, ListChecks, BarChart3, Settings, LogOut } from "lucide-react";

export default function CollegeDetailsDashboardPage() {
  const { collegeUser, logout } = useAuth(); // Using collegeUser from context
  const router = useRouter();

  const handleLogout = async () => {
    await logout(); // This should clear collegeUser as well due to AuthContext changes
    router.push(Routes.collegeDetailsLogin); 
  };

  return (
    <CollegeDetailsProtectedRoute>
      {/* 
        This page is wrapped by CollegeDetailsLayout, which now uses CollegeDetailsNavbar.
        No engineering student sidebar will be present here.
      */}
      <div className="space-y-8">
        <Card className="shadow-xl bg-gradient-to-r from-primary to-accent text-primary-foreground">
          <CardHeader>
            <CardTitle className="text-3xl">Welcome to the College Portal, {collegeUser?.name || 'User'}!</CardTitle>
            <CardDescription className="text-lg text-primary-foreground/80">
              Access detailed college information, cutoffs, and insights.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="shadow-md">
            <CardHeader><GraduationCap className="h-8 w-8 text-primary mb-2" /><CardTitle>College Search</CardTitle></CardHeader>
            <CardContent><CardDescription>Find colleges based on criteria.</CardDescription></CardContent>
            <CardFooter><Button variant="outline" disabled>Coming Soon</Button></CardFooter>
          </Card>
          <Card className="shadow-md">
            <CardHeader><ListChecks className="h-8 w-8 text-primary mb-2" /><CardTitle>Cutoff Analysis</CardTitle></CardHeader>
            <CardContent><CardDescription>Analyze cutoff trends over years.</CardDescription></CardContent>
            <CardFooter><Button variant="outline" disabled>Coming Soon</Button></CardFooter>
          </Card>
          <Card className="shadow-md">
            <CardHeader><BarChart3 className="h-8 w-8 text-primary mb-2" /><CardTitle>My Preferences</CardTitle></CardHeader>
            <CardContent><CardDescription>Save your preferred colleges and branches.</CardDescription></CardContent>
            <CardFooter><Button variant="outline" disabled>Coming Soon</Button></CardFooter>
          </Card>
        </div>

        <Card className="shadow-md">
            <CardHeader><Settings className="h-6 w-6 text-muted-foreground mb-2" /><CardTitle>Account</CardTitle></CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">Manage your college portal account settings or log out.</p>
            </CardContent>
            <CardFooter>
                <Button variant="destructive" onClick={handleLogout} className="w-full md:w-auto">
                    <LogOut className="mr-2 h-4 w-4" /> Logout
                </Button>
            </CardFooter>
        </Card>
      </div>
    </CollegeDetailsProtectedRoute>
  );
}
