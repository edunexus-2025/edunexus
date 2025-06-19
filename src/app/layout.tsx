import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppConfig } from '@/lib/constants';
import { ThemeProvider } from 'next-themes';
import { NotificationPermissionManager } from '@/components/layout/NotificationPermissionManager';


const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

// Set metadata for the application
export const metadata: Metadata = {
  title: `${AppConfig.appName} - The Online Test Platform`, // Updated title
  description: `${AppConfig.appName}: The Online Test Platform for MHT CET, JEE, and NEET preparation. Access test series, DPPs, and AI-powered guidance.`, // Updated description
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
      <head>{/* Ensure no leading whitespace */}
        {/* Favicon and Apple touch icon links are now handled by Next.js metadata.icons */}

        {/* Razorpay Checkout Script */}
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>

        {/*
        Standard HTML script tag for AdSense - Retained as it's unrelated to payment gateway */}
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
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
