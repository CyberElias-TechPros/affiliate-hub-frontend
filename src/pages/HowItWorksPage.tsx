import * as React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowLeft, UserPlus, Search, Link2, Share2, Wallet, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const steps = [
  {
    icon: UserPlus,
    title: "Create Your Account",
    description: "Sign up for free in under 60 seconds. No credit card required, no hidden fees.",
    details: [
      "Enter your email and create a password",
      "Complete your profile with basic information",
      "Choose your preferred niches (tech, health, finance, etc.)",
      "Link your WhatsApp for instant sale notifications",
    ],
  },
  {
    icon: Search,
    title: "Browse Products",
    description: "Explore our marketplace of 500+ high-converting products across multiple categories.",
    details: [
      "Filter by commission rate, category, or popularity",
      "See detailed product information and conversion rates",
      "Check cookie duration and payment terms",
      "Save products to your favorites for quick access",
    ],
  },
  {
    icon: Link2,
    title: "Generate Your Link",
    description: "Get your unique affiliate link instantly. No approval process needed.",
    details: [
      "One-click link generation for any product",
      "Links are automatically tracked to your account",
      "Access promotional materials and banners",
      "Download product images for social media",
    ],
  },
  {
    icon: Share2,
    title: "Promote & Share",
    description: "Share your links on WhatsApp, Instagram, Twitter, or anywhere your audience is.",
    details: [
      "Share directly to WhatsApp with pre-written copy",
      "Post on Instagram, Facebook, or TikTok",
      "Add links to your blog or website",
      "Use our marketing templates for better conversions",
    ],
  },
  {
    icon: TrendingUp,
    title: "Track Performance",
    description: "Monitor clicks, conversions, and earnings in real-time from your dashboard.",
    details: [
      "See live click and conversion data",
      "Analyze which products perform best",
      "Track your weekly and monthly growth",
      "Compare your performance to other affiliates",
    ],
  },
  {
    icon: Wallet,
    title: "Get Paid",
    description: "Withdraw your earnings to your bank account, PayPal, or USDT wallet.",
    details: [
      "Minimum withdrawal of just ₦5,000",
      "Bank transfers processed within 1-2 hours",
      "PayPal and USDT for international payments",
      "No hidden fees on withdrawals",
    ],
  },
];

const faqs = [
  {
    question: "How much can I earn?",
    answer: "Your earnings depend on your audience size and engagement. Our top affiliates earn ₦500,000+ monthly, while beginners typically start with ₦20,000-₦50,000 in their first month.",
  },
  {
    question: "Do I need a website?",
    answer: "No! Most of our successful affiliates promote on WhatsApp, Instagram, and Twitter. A website helps but isn't required.",
  },
  {
    question: "How long do cookies last?",
    answer: "Cookie duration varies by product, typically 30-90 days. This means if someone clicks your link but buys later, you still get credit.",
  },
  {
    question: "When do I get paid?",
    answer: "You can withdraw anytime your balance reaches ₦5,000. Bank transfers are processed within 1-2 business hours.",
  },
];

const HowItWorksPage = () => {
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

      {/* Hero */}
      <section className="py-20 gradient-hero">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold font-display text-foreground mb-6">
              How Affiliate Hub Works
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              Start earning commissions in 6 simple steps. No experience required.
            </p>
            <Link to="/auth">
              <Button size="lg" className="gradient-primary text-primary-foreground shadow-glow">
                Start Earning Now <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Steps Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-12">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="flex gap-6 animate-fade-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground flex-shrink-0">
                    <step.icon className="h-7 w-7" />
                  </div>
                  {index < steps.length - 1 && (
                    <div className="w-0.5 h-full bg-border mt-4" />
                  )}
                </div>
                <div className="pb-12">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-medium text-primary">Step {index + 1}</span>
                  </div>
                  <h3 className="text-2xl font-bold font-display text-foreground mb-3">{step.title}</h3>
                  <p className="text-muted-foreground mb-4">{step.description}</p>
                  <ul className="space-y-2">
                    {step.details.map((detail, i) => (
                      <li key={i} className="flex items-start gap-2 text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                        {detail}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold font-display text-foreground mb-4">
              Frequently Asked Questions
            </h2>
          </div>
          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={faq.question}
                className="bg-card rounded-xl p-6 shadow-card animate-fade-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <h3 className="font-semibold text-foreground mb-2">{faq.question}</h3>
                <p className="text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 gradient-primary">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold font-display text-primary-foreground mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            Start promoting products you already use. Signing up is free, and bank withdrawals cost nothing.
          </p>
          <Link to="/auth">
            <Button size="lg" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90">
              Create Free Account <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© {new Date().getFullYear()} Affiliate Hub. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default HowItWorksPage;
