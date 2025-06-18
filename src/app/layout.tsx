import type { Metadata } from 'next'; 
import { Geist } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppConfig } from '@/lib/constants';
import { ThemeProvider } from 'next-themes';
// useEffect is no longer needed for document.title
import { NotificationPermissionManager } from '@/components/layout/NotificationPermissionManager';


const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

// Set metadata for the application
export const metadata: Metadata = {
  title: AppConfig.appName,
  description: `Prepare for MHT CET, JEE, NEET with ${AppConfig.appName} - Your ultimate test series and DPP companion.`,
  icons: {
    icon: '/edunexus-applogo.png', // Standard favicon
    apple: '/edunexus-applogo.png', // Apple touch icon
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  
  // useEffect for document.title has been removed. 
  // The title is now set via the metadata export above.

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