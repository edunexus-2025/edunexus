
'use client';

import { Navbar } from "@/components/layout/Navbar"; // Using main Navbar for now
import { AppConfig } from "@/lib/constants";

// Simple layout for college-details specific pages
export default function CollegeDetailsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-accent/10 via-background to-secondary/5"> 
      <Navbar /> {/* Or a specific CollegeDetailsNavbar if created */}
      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>
      <footer className="py-6 text-center text-xs text-muted-foreground border-t bg-background/80">
        © {new Date().getFullYear()} {AppConfig.appName} - College Portal
      </footer>
    </div>
  );
}
