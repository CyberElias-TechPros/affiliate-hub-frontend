import * as React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/seo/Seo";

const PrivacyPage = () => {
  return (
    <main id="main-content" className="min-h-screen bg-background">
      <Seo
        title="Privacy policy"
        description="What Affiliate Hub collects, why, and how it is stored and protected."
        path="/privacy"
      />
      {/* Header */}
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <span className="text-lg font-bold text-primary-foreground">A</span>
              </div>
              <span className="font-bold text-xl font-display text-foreground">Affiliate Hub</span>
            </Link>
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold font-display text-foreground mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">Last updated: December 27, 2024</p>

          <div className="prose prose-lg max-w-none">
            <div className="space-y-8 text-muted-foreground">
              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">1. Introduction</h2>
                <p>
                  Affiliate Hub ("we," "our," or "us") respects your privacy and is committed to protecting your 
                  personal data. This privacy policy explains how we collect, use, and safeguard your information 
                  when you use our platform.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">2. Information We Collect</h2>
                <p className="mb-2">We collect the following types of information:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Account Information:</strong> Name, email address, phone number, and password when you register</li>
                  <li><strong>Payment Information:</strong> Bank account details, PayPal, or cryptocurrency wallet addresses for payouts</li>
                  <li><strong>Usage Data:</strong> Clicks, conversions, and other activity on the platform</li>
                  <li><strong>Device Information:</strong> IP address, browser type, and device identifiers</li>
                  <li><strong>Communications:</strong> Messages you send to our support team</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">3. How We Use Your Information</h2>
                <ul className="list-disc pl-5 space-y-2">
                  <li>To provide and maintain our services</li>
                  <li>To process your commissions and payments</li>
                  <li>To track affiliate performance and prevent fraud</li>
                  <li>To communicate with you about your account and platform updates</li>
                  <li>To improve our platform and user experience</li>
                  <li>To comply with legal obligations</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">4. Information Sharing</h2>
                <p className="mb-2">We may share your information with:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Product Merchants:</strong> To track and attribute sales to your affiliate links</li>
                  <li><strong>Payment Processors:</strong> To process your withdrawal requests</li>
                  <li><strong>Service Providers:</strong> Third parties who help us operate the platform</li>
                  <li><strong>Legal Authorities:</strong> When required by law or to protect our rights</li>
                </ul>
                <p className="mt-3">We do not sell your personal information to third parties.</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">5. Data Security</h2>
                <p>
                  We implement appropriate technical and organizational measures to protect your personal data 
                  against unauthorized access, alteration, disclosure, or destruction. This includes encryption, 
                  secure servers, and regular security audits.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">6. Cookies and Tracking</h2>
                <p>
                  We use cookies and similar technologies to track affiliate referrals, maintain user sessions, 
                  and improve our platform. You can manage cookie preferences in your browser settings, but 
                  disabling cookies may affect platform functionality.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">7. Your Rights</h2>
                <p className="mb-2">You have the right to:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Access your personal data</li>
                  <li>Correct inaccurate information</li>
                  <li>Request deletion of your data</li>
                  <li>Object to certain processing activities</li>
                  <li>Withdraw consent where applicable</li>
                </ul>
                <p className="mt-3">To exercise these rights, contact us at privacy@affiliatehub.ng</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">8. Data Retention</h2>
                <p>
                  We retain your personal data for as long as your account is active or as needed to provide 
                  services. After account closure, we may retain certain information for legal, accounting, 
                  or fraud prevention purposes.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">9. International Transfers</h2>
                <p>
                  Your data may be processed in countries outside Nigeria. We ensure appropriate safeguards 
                  are in place to protect your data in accordance with this privacy policy.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">10. Children's Privacy</h2>
                <p>
                  Our services are not intended for individuals under 18 years of age. We do not knowingly 
                  collect personal information from children.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">11. Changes to This Policy</h2>
                <p>
                  We may update this privacy policy periodically. We will notify you of significant changes 
                  via email or through the platform. Your continued use constitutes acceptance of the updated policy.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">12. Contact Us</h2>
                <p>
                  For questions about this privacy policy or your personal data, contact us at:
                  <br />
                  Email: privacy@affiliatehub.ng
                  <br />
                  Address: Victoria Island, Lagos, Nigeria
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© {new Date().getFullYear()} Affiliate Hub. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
};

export default PrivacyPage;
