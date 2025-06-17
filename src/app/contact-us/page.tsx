
'use client';

import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AppConfig, Routes } from '@/lib/constants';
import { Mail, SendHorizonal, Phone } from 'lucide-react';
import Link from 'next/link';

const contactEmail = "edunexustestplatform@gmail.com"; 
const telegramUsername = "EduNexus_Test"; 

export default function ContactUsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-12">
        <Card className="max-w-2xl mx-auto shadow-xl border-t-4 border-primary">
          <CardHeader className="text-center">
            <Mail className="mx-auto h-12 w-12 text-primary mb-4" />
            <CardTitle className="text-3xl font-bold">Contact Us</CardTitle>
            <CardDescription className="text-lg text-muted-foreground">
              We're here to help! Reach out to us with any questions or inquiries.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 pt-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-foreground mb-2">General Inquiries & Support</h3>
              <p className="text-muted-foreground mb-3">
                For most questions, feedback, or support requests, please email us:
              </p>
              <a
                href={`mailto:${contactEmail}`}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-md transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <Mail className="h-4 w-4" /> Email: {contactEmail}
              </a>
            </div>

            <div className="text-center border-t pt-6">
              <h3 className="text-xl font-semibold text-foreground mb-2">Telegram Support</h3>
              <p className="text-muted-foreground mb-3">
                Join our Telegram channel or message us directly for quick support:
              </p>
              <a
                href={`https://t.me/${telegramUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-sky-500 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-700 shadow-sm transition-colors hover:bg-sky-500/20 dark:text-sky-300 dark:border-sky-700 dark:bg-sky-700/20 dark:hover:bg-sky-700/30"
              >
                <SendHorizonal className="h-4 w-4" /> Telegram: @{telegramUsername}
              </a>
            </div>
            
            <div className="text-center text-muted-foreground text-sm pt-6 border-t">
              <p>We typically respond within 24-48 business hours.</p>
              <p>
                Thank you for choosing {AppConfig.appName}!{' '}
                <Link href={Routes.ownerInfo} className="text-primary hover:underline font-medium">
                  [Owner]
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
      <footer className="py-6 text-center text-xs text-muted-foreground border-t">
        © {new Date().getFullYear()} {AppConfig.appName}
      </footer>
    </div>
  );
}
