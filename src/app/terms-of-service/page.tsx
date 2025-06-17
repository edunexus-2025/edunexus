
'use client';

import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AppConfig } from '@/lib/constants';
import { FileText } from 'lucide-react';

export default function TermsOfServicePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8">
        <Card className="shadow-lg">
          <CardHeader className="border-b">
            <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                    <CardTitle className="text-2xl md:text-3xl">Terms of Service</CardTitle>
                    <CardDescription>Last updated: {new Date().toLocaleDateString()}</CardDescription>
                </div>
            </div>
          </CardHeader>
          <ScrollArea className="h-[calc(100vh-250px)]">
            <CardContent className="p-6 space-y-6 prose prose-sm sm:prose-base dark:prose-invert max-w-none">
              <p>Welcome to {AppConfig.appName}! These terms and conditions outline the rules and regulations for the use of {AppConfig.appName}'s Website, located at [Your Website URL].</p>

              <p>By accessing this website we assume you accept these terms and conditions. Do not continue to use {AppConfig.appName} if you do not agree to take all of the terms and conditions stated on this page.</p>

              <h2 className="text-xl font-semibold mt-6 mb-2">1. Definitions</h2>
              <p>The following terminology applies to these Terms and Conditions, Privacy Statement and Disclaimer Notice and all Agreements: "Client", "You" and "Your" refers to you, the person log on this website and compliant to the Company’s terms and conditions. "The Company", "Ourselves", "We", "Our" and "Us", refers to our Company. "Party", "Parties", or "Us", refers to both the Client and ourselves. All terms refer to the offer, acceptance and consideration of payment necessary to undertake the process of our assistance to the Client in the most appropriate manner for the express purpose of meeting the Client’s needs in respect of provision of the Company’s stated services, in accordance with and subject to, prevailing law of Netherlands. Any use of the above terminology or other words in the singular, plural, capitalization and/or he/she or they, are taken as interchangeable and therefore as referring to same.</p>

              <h2 className="text-xl font-semibold mt-6 mb-2">2. Cookies</h2>
              <p>We employ the use of cookies. By accessing {AppConfig.appName}, you agreed to use cookies in agreement with the {AppConfig.appName}'s Privacy Policy.</p>
              <p>Most interactive websites use cookies to let us retrieve the user’s details for each visit. Cookies are used by our website to enable the functionality of certain areas to make it easier for people visiting our website. Some of our affiliate/advertising partners may also use cookies.</p>

              <h2 className="text-xl font-semibold mt-6 mb-2">3. License</h2>
              <p>Unless otherwise stated, {AppConfig.appName} and/or its licensors own the intellectual property rights for all material on {AppConfig.appName}. All intellectual property rights are reserved. You may access this from {AppConfig.appName} for your own personal use subjected to restrictions set in these terms and conditions.</p>
              <p>You must not:</p>
              <ul>
                <li>Republish material from {AppConfig.appName}</li>
                <li>Sell, rent or sub-license material from {AppConfig.appName}</li>
                <li>Reproduce, duplicate or copy material from {AppConfig.appName}</li>
                <li>Redistribute content from {AppConfig.appName}</li>
              </ul>
              <p>This Agreement shall begin on the date hereof.</p>

              <h2 className="text-xl font-semibold mt-6 mb-2">4. User Accounts</h2>
              <p>You may be required to create an account to access certain features of the Service. You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete. We reserve the right to suspend or terminate your account if any information provided during the registration process or thereafter proves to be inaccurate, not current, or incomplete.</p>
              <p>You are responsible for safeguarding your password. You agree that you will not disclose your password to any third party and that you will take sole responsibility for any activities or actions under your account, whether or not you have authorized such activities or actions.</p>

              <h2 className="text-xl font-semibold mt-6 mb-2">5. Use of Service</h2>
              <p>You agree not to misuse the Service. For example, you must not, and must not attempt to, use the Service to:</p>
              <ul>
                <li>Probe, scan, or test the vulnerability of any system or network.</li>
                <li>Breach or otherwise circumvent any security or authentication measures.</li>
                <li>Access, tamper with, or use non-public areas of the Service.</li>
                <li>Interfere with or disrupt any user, host, or network.</li>
                <li>Engage in any activity that is illegal, fraudulent, or harmful.</li>
              </ul>

              <h2 className="text-xl font-semibold mt-6 mb-2">6. Intellectual Property</h2>
              <p>The Service and its original content (excluding Content provided by users), features and functionality are and will remain the exclusive property of {AppConfig.appName} and its licensors. The Service is protected by copyright, trademark, and other laws of both your country and foreign countries. Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of {AppConfig.appName}.</p>

              <h2 className="text-xl font-semibold mt-6 mb-2">7. Disclaimers</h2>
              <p>The Service is provided on an "AS IS" and "AS AVAILABLE" basis. The Service is provided without warranties of any kind, whether express or implied, including, but not limited to, implied warranties of merchantability, fitness for a particular purpose, non-infringement or course of performance.</p>
              <p>{AppConfig.appName} its subsidiaries, affiliates, and its licensors do not warrant that a) the Service will function uninterrupted, secure or available at any particular time or location; b) any errors or defects will be corrected; c) the Service is free of viruses or other harmful components; or d) the results of using the Service will meet your requirements.</p>

              <h2 className="text-xl font-semibold mt-6 mb-2">8. Limitation of Liability</h2>
              <p>In no event shall {AppConfig.appName}, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from (i) your access to or use of or inability to access or use the Service; (ii) any conduct or content of any third party on the Service; (iii) any content obtained from the Service; and (iv) unauthorized access, use or alteration of your transmissions or content, whether based on warranty, contract, tort (including negligence) or any other legal theory, whether or not we have been informed of the possibility of such damage, and even if a remedy set forth herein is found to have failed of its essential purpose.</p>

              <h2 className="text-xl font-semibold mt-6 mb-2">9. Governing Law</h2>
              <p>These Terms shall be governed and construed in accordance with the laws of [Your Jurisdiction, e.g., India], without regard to its conflict of law provisions.</p>
              <p>Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights. If any provision of these Terms is held to be invalid or unenforceable by a court, the remaining provisions of these Terms will remain in effect. These Terms constitute the entire agreement between us regarding our Service, and supersede and replace any prior agreements we might have had between us regarding the Service.</p>

              <h2 className="text-xl font-semibold mt-6 mb-2">10. Changes to Terms</h2>
              <p>We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material we will provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.</p>
              <p>By continuing to access or use our Service after any revisions become effective, you agree to be bound by the revised terms. If you do not agree to the new terms, you are no longer authorized to use the Service.</p>

              <h2 className="text-xl font-semibold mt-6 mb-2">11. Contact Us</h2>
              <p>If you have any questions about these Terms, please contact us at [Your Contact Email, e.g., support@{AppConfig.appName.toLowerCase().replace(/\s+/g, '')}.com].</p>

              <div className="mt-8 p-4 bg-muted/50 rounded-md">
                <p className="text-xs text-muted-foreground">
                  <strong>Disclaimer:</strong> This is a template Terms of Service document. It is not legal advice. You should consult with a legal professional to ensure these terms are appropriate for your specific application and comply with all applicable laws and regulations.
                </p>
              </div>
            </CardContent>
          </ScrollArea>
        </Card>
      </main>
    </div>
  );
}
