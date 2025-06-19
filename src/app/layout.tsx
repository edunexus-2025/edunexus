
import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppConfig } from '@/lib/constants';
import { ThemeProvider } from 'next-themes';
import { NotificationPermissionManager } from '@/components/layout/NotificationPermissionManager';
import { ClientScriptLoader } from '@/components/layout/ClientScriptLoader'; // Import the new component

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

// Set metadata for the application
export const metadata: Metadata = {
  title: `${AppConfig.appName} - The Online Test Platform`,
  description: `${AppConfig.appName}: The Online Test Platform for MHT CET, JEE, and NEET preparation. Access test series, DPPs, and AI-powered guidance.`,
  icons: {
    icon: '/edunexus-applogo.png',
    apple: '/edunexus-applogo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* AdSense script can remain here as it's less likely to cause hydration issues by direct DOM manipulation at body level */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9210790199921207"
          crossOrigin="anonymous"
        ></script>
      </head>
      <body className={`${geist.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
            <NotificationPermissionManager />
            <Toaster />
            <ClientScriptLoader /> {/* Use the imported client component */}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
