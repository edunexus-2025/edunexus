
'use client';

import { Navbar } from "@/components/layout/Navbar";
import { AppConfig } from "@/lib/constants";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react"; // Import useState and useEffect

// Simple layout for teacher-specific pages
export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  let showNavbar;

  if (!isMounted) {
    // On the server, and on the client's first render pass,
    // we assume the server *would* render the Navbar based on the error's diff.
    // This ensures the client's initial HTML matches the server's.
    showNavbar = true; 
  } else {
    // After hydration/mounting, on the client, use the actual pathname
    // to determine if the Navbar should be shown.
    showNavbar = !pathname.startsWith('/teacher/dashboard') && !pathname.startsWith('/teacher/institution-panel');
  }

  return (
    <div className="flex min-h-screen flex-col bg-background"> 
      {showNavbar && <Navbar />}
      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>
      <footer className="py-6 text-center text-xs text-muted-foreground border-t">
        © {new Date().getFullYear()} {AppConfig.appName} - Teacher Portal
      </footer>
    </div>
  );
}
