import * as React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const TermsPage = () => {
  return (
    <div className="min-h-screen bg-background">
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
          <h1 className="text-4xl font-bold font-display text-foreground mb-2">Terms of Service</h1>
          <p className="text-muted-foreground mb-8">Last updated: December 27, 2024</p>

          <div className="prose prose-lg max-w-none">
            <div className="space-y-8 text-muted-foreground">
              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
                <p>
                  By accessing and using Affiliate Hub ("the Platform"), you accept and agree to be bound by the terms 
                  and provisions of this agreement. If you do not agree to these terms, please do not use our services.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">2. Eligibility</h2>
                <p>
                  To use Affiliate Hub, you must be at least 18 years old and capable of entering into legally binding 
                  contracts. By registering, you represent that you meet these requirements.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">3. Affiliate Account</h2>
                <ul className="list-disc pl-5 space-y-2">
                  <li>You are responsible for maintaining the confidentiality of your account credentials</li>
                  <li>You must provide accurate and complete registration information</li>
                  <li>You may not transfer your account to another person</li>
                  <li>We reserve the right to suspend or terminate accounts that violate our terms</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">4. Commission Structure</h2>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Commission rates vary by product and are displayed on each product listing</li>
                  <li>Commissions are earned when a referred customer completes a qualifying purchase</li>
                  <li>Commissions are subject to a review period to account for refunds and chargebacks</li>
                  <li>We reserve the right to adjust commission rates with prior notice</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">5. Payment Terms</h2>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Minimum withdrawal amount is ₦5,000 for bank transfers</li>
                  <li>Payments are processed within 1-2 business hours for bank transfers</li>
                  <li>You must provide valid bank account or payment wallet information</li>
                  <li>We are not responsible for delays caused by your bank or payment provider</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">6. Prohibited Activities</h2>
                <p className="mb-2">You agree NOT to:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Use spam, unsolicited messages, or deceptive marketing practices</li>
                  <li>Create fake accounts or generate fraudulent clicks/purchases</li>
                  <li>Misrepresent products or make false claims</li>
                  <li>Bid on trademarked terms in paid advertising without permission</li>
                  <li>Violate any applicable laws or regulations</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">7. Intellectual Property</h2>
                <p>
                  All content on the Platform, including logos, text, and graphics, is owned by Affiliate Hub or its 
                  licensors. You may use promotional materials provided for the sole purpose of promoting products 
                  through the Platform.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">8. Limitation of Liability</h2>
                <p>
                  Affiliate Hub is provided "as is" without warranties of any kind. We shall not be liable for any 
                  indirect, incidental, or consequential damages arising from your use of the Platform.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">9. Termination</h2>
                <p>
                  We may terminate or suspend your account at any time for violations of these terms. Upon termination, 
                  you will receive any unpaid commissions that were validly earned, minus any amounts owed to us.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">10. Changes to Terms</h2>
                <p>
                  We reserve the right to modify these terms at any time. We will notify you of material changes via 
                  email or through the Platform. Continued use after changes constitutes acceptance of the new terms.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">11. Contact Information</h2>
                <p>
                  For questions about these terms, please contact us at:
                  <br />
                  Email: legal@affiliatehub.ng
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
    </div>
  );
};

export default TermsPage;
