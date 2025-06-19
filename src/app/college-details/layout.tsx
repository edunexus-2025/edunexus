
'use client';

import { CollegeDetailsNavbar } from "@/components/layout/CollegeDetailsNavbar";
import { CollegeDetailsSidebar } from "@/components/layout/CollegeDetailsSidebar"; // Import new sidebar
import { AppConfig } from "@/lib/constants";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"; // Import SidebarProvider and SidebarInset
import { CollegeDetailsProtectedRoute } from "@/components/auth/CollegeDetailsProtectedRoute"; // Import protection route

export default function CollegeDetailsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CollegeDetailsProtectedRoute>
      <SidebarProvider defaultOpen={true}> {/* Wrap with SidebarProvider */}
        <CollegeDetailsSidebar /> {/* Add the CollegeDetailsSidebar */}
        <div className="flex flex-col flex-1">
          <CollegeDetailsNavbar /> {/* This will be the mobile header now */}
          <SidebarInset> {/* Wrap main content with SidebarInset */}
            <main className="flex-1 container mx-auto px-4 py-8 bg-gradient-to-br from-accent/10 via-background to-secondary/5">
              {children}
            </main>
            <footer className="py-6 text-center text-xs text-muted-foreground border-t bg-background/80">
              © {new Date().getFullYear()} {AppConfig.appName} - College Portal
            </footer>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </CollegeDetailsProtectedRoute>
  );
}
