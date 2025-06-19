'use client';

import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AppConfig } from '@/lib/constants';
import { Shield } from 'lucide-react';
import { useState, useEffect } from 'react'; // Import useState and useEffect

export default function PrivacyPolicyPage() {
  const [lastUpdatedDate, setLastUpdatedDate] = useState<string | null>(null);

  useEffect(() => {
    // This effect runs only on the client after hydration
    setLastUpdatedDate(new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }));
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8">
        <Card className="shadow-lg">
          <CardHeader className="border-b">
            <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 text-primary" />
                <div>
                    <CardTitle className="text-2xl md:text-3xl">Privacy Policy</CardTitle>
                    <CardDescription>
                      for {AppConfig.appName} - The Online Test Platform
                      <br/>
                      {lastUpdatedDate ? `Last updated: ${lastUpdatedDate}` : 'Loading update date...'}
                    </CardDescription>
                </div>
            </div>
          </CardHeader>
          <ScrollArea className="h-[calc(100vh-250px)]">
            <CardContent className="p-6 space-y-6 prose prose-sm sm:prose-base dark:prose-invert max-w-none">
              <p>Welcome to {AppConfig.appName} ("us", "we", or "our"). We operate the {AppConfig.appName} website (accessible via your current application URL) and the {AppConfig.appName} mobile application (hereinafter referred to as the "Service").</p>
              <p>This page informs you of our policies regarding the collection, use, and disclosure of personal data when you use our Service and the choices you have associated with that data.</p>
              <p>We use your data to provide and improve the Service. By using the Service, you agree to the collection and use of information in accordance with this policy. Unless otherwise defined in this Privacy Policy, terms used in this PrivacyPolicy have the same meanings as in our Terms and Conditions.</p>

              <h2 className="text-xl font-semibold mt-6 mb-2">1. Information Collection and Use</h2>
              <p>We collect several different types of information for various purposes to provide and improve our Service to you.</p>
              
              <h3 className="text-lg font-medium mt-4 mb-1">Types of Data Collected</h3>
              <h4>Personal Data</h4>
              <p>While using our Service, we may ask you to provide us with certain personally identifiable information that can be used to contact or identify you ("Personal Data"). Personally identifiable information may include, but is not limited to:</p>
              <ul>
                <li>Email address</li>
                <li>First name and last name</li>
                <li>Phone number</li>
                <li>Address, State, Province, ZIP/Postal code, City (if applicable)</li>
                <li>Cookies and Usage Data</li>
                <li>Performance data in tests and practice problems</li>
              </ul>

              <h4>Usage Data</h4>
              <p>We may also collect information that your browser sends whenever you visit our Service or when you access the Service by or through a mobile device ("Usage Data"). This Usage Data may include information such as your computer's Internet Protocol address (e.g. IP address), browser type, browser version, the pages of our Service that you visit, the time and date of your visit, the time spent on those pages, unique device identifiers and other diagnostic data.</p>

              <h2 className="text-xl font-semibold mt-6 mb-2">2. How We Use Your Information</h2>
              <p>{AppConfig.appName} uses the collected data for various purposes:</p>
              <ul>
                <li>To provide and maintain our Service</li>
                <li>To notify you about changes to our Service</li>
                <li>To allow you to participate in interactive features of our Service when you choose to do so</li>
                <li>To provide customer support</li>
                <li>To gather analysis or valuable information so that we can improve our Service</li>
                <li>To monitor the usage of our Service</li>
                <li>To detect, prevent and address technical issues</li>
                <li>To provide you with personalized feedback and AI-powered hints</li>
                <li>To track your performance and provide progress reports</li>
              </ul>

              <h2 className="text-xl font-semibold mt-6 mb-2">3. How We Share Your Information</h2>
              <p>We may share your personal information in the following situations:</p>
              <ul>
                <li><strong>With Service Providers:</strong> We may share your personal information with Service Providers to monitor and analyze the use of our Service, to contact you.</li>
                <li><strong>For Business Transfers:</strong> We may share or transfer your personal information in connection with, or during negotiations of, any merger, sale of Company assets, financing, or acquisition of all or a portion of our business to another company.</li>
                <li><strong>With Affiliates:</strong> We may share your information with our affiliates, in which case we will require those affiliates to honor this Privacy Policy.</li>
                <li><strong>With Business Partners:</strong> We may share your information with our business partners to offer you certain products, services or promotions.</li>
                <li><strong>With other users:</strong> When you share personal information or otherwise interact in the public areas (e.g., leaderboards, public forums) with other users, such information may be viewed by all users and may be publicly distributed outside.</li>
                <li><strong>With Your Consent:</strong> We may disclose your personal information for any other purpose with your consent.</li>
                <li><strong>Legal Requirements:</strong> {AppConfig.appName} may disclose your Personal Data in the good faith belief that such action is necessary to:
                  <ul>
                    <li>To comply with a legal obligation</li>
                    <li>To protect and defend the rights or property of {AppConfig.appName}</li>
                    <li>To prevent or investigate possible wrongdoing in connection with the Service</li>
                    <li>To protect the personal safety of users of the Service or the public</li>
                    <li>To protect against legal liability</li>
                  </ul>
                </li>
              </ul>

              <h2 className="text-xl font-semibold mt-6 mb-2">4. Data Security</h2>
              <p>The security of your data is important to us, but remember that no method of transmission over the Internet, or method of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your Personal Data, we cannot guarantee its absolute security.</p>

              <h2 className="text-xl font-semibold mt-6 mb-2">5. Your Data Protection Rights</h2>
              <p>Depending on your location, you may have the following rights regarding your personal data:</p>
              <ul>
                <li>The right to access, update or delete the information we have on you.</li>
                <li>The right of rectification.</li>
                <li>The right to object.</li>
                <li>The right of restriction.</li>
                <li>The right to data portability.</li>
                <li>The right to withdraw consent.</li>
              </ul>
              <p>If you wish to exercise any of these rights, please contact us.</p>

              <h2 className="text-xl font-semibold mt-6 mb-2">6. Children's Privacy</h2>
              <p>Our Service does not address anyone under the age of 13 ("Children"). We do not knowingly collect personally identifiable information from anyone under the age of 13. If you are a parent or guardian and you are aware that your Children has provided us with Personal Data, please contact us. If we become aware that we have collected Personal Data from children without verification of parental consent, we take steps to remove that information from our servers.</p>

              <h2 className="text-xl font-semibold mt-6 mb-2">7. Changes to This Privacy Policy</h2>
              <p>We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.</p>
              <p>We will let you know via email and/or a prominent notice on our Service, prior to the change becoming effective and update the "last updated" date at the top of this Privacy Policy.</p>
              <p>You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.</p>

              <h2 className="text-xl font-semibold mt-6 mb-2">8. Contact Us</h2>
              <p>If you have any questions about this Privacy Policy, please contact us:</p>
              <ul>
                <li>By email: edunexustestplatform@gmail.com</li>
              </ul>
              
              <div className="mt-8 p-4 bg-muted/50 rounded-md">
                <p className="text-xs text-muted-foreground">
                  <strong>Disclaimer:</strong> This is a template Privacy Policy document. It is not legal advice. You should consult with a legal professional to ensure this policy is appropriate for your specific application, data practices, and complies with all applicable laws and regulations (e.g., GDPR, CCPA, etc.).
                </p>
              </div>
            </CardContent>
          </ScrollArea>
        </Card>
      </main>
    </div>
  );
}
