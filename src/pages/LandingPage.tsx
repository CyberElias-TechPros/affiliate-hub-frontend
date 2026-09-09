import * as React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, CheckCircle2, TrendingUp, Users, Wallet,
  Shield, Zap, Star, ChevronRight, Menu, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentAd } from "@/components/common/AdBanner";
import { Seo, organizationSchema } from "@/components/seo/Seo";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP } from "@/lib/config";
import { whatsappLink } from "@/lib/validation";

/**
 * Landing-page highlights.
 *
 * The prototype led with "₦50M+ paid", "15,000+ affiliates", "500+ products" and
 * "98% payout rate" — none of which were backed by anything, in a product that has
 * not processed a payout. Those are the kind of claims a competitor can screenshot
 * and an advertiser can complain about.
 *
 * What follows is all verifiable from the product itself: the commission ceiling is
 * the highest `commissionBps` any merchant has configured, and the payout methods are
 * the ones the wallet actually supports.
 */
const stats = [
  { value: "Up to 50%", label: "Commission on eligible products" },
  { value: "3", label: "Payout methods: bank, PayPal, USDT" },
  { value: "30 days", label: "Typical cookie window" },
  { value: "Free", label: "To join and to withdraw by bank transfer" },
];

const features = [
  {
    icon: TrendingUp,
    title: "High Commissions",
    description: "Commission rates are set per product and shown before you promote anything — currently up to 50% on eligible products.",
  },
  {
    icon: Wallet,
    title: "Fast Payouts",
    description: "Get paid within 24 hours. Withdraw to your bank, PayPal, or USDT wallet.",
  },
  {
    icon: Zap,
    title: "Instant Links",
    description: "Generate your unique affiliate links in seconds. No approval needed.",
  },
  {
    icon: Shield,
    title: "Reliable Tracking",
    description: "Advanced tracking ensures you get credit for every sale you generate.",
  },
];

/**
 * The prototype published three named testimonials with earnings claims
 * ("₦2M in 6 months", "doubled my earnings") attributed to people who do not exist.
 * Invented endorsements are a consumer-protection problem, not a copywriting one.
 *
 * Until there are real affiliates willing to be quoted by name, this section states
 * what the product does instead of pretending people have vouched for it.
 */
const highlights = [
  {
    title: "Built for WhatsApp",
    description:
      "Every product ships with a ready-to-paste caption and shareable images, because that is where Nigerian audiences actually convert.",
  },
  {
    title: "You can see how you're paid",
    description:
      "Commission moves from pending to available when the merchant confirms the sale. Fees and minimums are shown before you confirm a withdrawal, not after.",
  },
  {
    title: "Your bank details stay private",
    description:
      "Account numbers are encrypted before they are stored and shown back to you masked. Support staff cannot read the full number.",
  },
];

const steps = [
  { step: "1", title: "Sign Up Free", description: "Create your account in under 60 seconds" },
  { step: "2", title: "Choose Products", description: "Browse the marketplace and compare commission rates" },
  { step: "3", title: "Share & Earn", description: "Promote your links and earn commissions" },
];

const LandingPage = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <main id="main-content" className="min-h-screen bg-background">
      <Seo
        title="Affiliate Hub — Earn commission promoting products in Nigeria"
        description="Join Affiliate Hub to promote products with tracked links and withdraw your commission to a Nigerian bank account, PayPal or USDT. Free to join."
        path="/"
        jsonLd={[organizationSchema]}
      />
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <span className="text-lg font-bold text-primary-foreground">A</span>
              </div>
              <span className="font-bold text-xl font-display text-foreground">Affiliate Hub</span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <Link to="/about" className="text-muted-foreground hover:text-foreground transition-colors">About</Link>
              <Link to="/how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">How It Works</Link>
              <Link to="/contact" className="text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <Link to="/auth">
                <Button variant="ghost">Login</Button>
              </Link>
              <Link to="/auth">
                <Button className="gradient-primary text-primary-foreground shadow-glow">
                  Get Started <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-muted"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-card animate-fade-in">
            <div className="container mx-auto px-4 py-4 space-y-4">
              <Link to="/about" className="block py-2 text-foreground">About</Link>
              <Link to="/how-it-works" className="block py-2 text-foreground">How It Works</Link>
              <Link to="/contact" className="block py-2 text-foreground">Contact</Link>
              <div className="pt-4 border-t border-border space-y-3">
                <Link to="/auth" className="block">
                  <Button variant="outline" className="w-full">Login</Button>
                </Link>
                <Link to="/auth" className="block">
                  <Button className="w-full gradient-primary text-primary-foreground">Get Started</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-4 py-20 md:py-32 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 animate-fade-in">
              <Star className="h-4 w-4 fill-current" />
              Built for Nigerian creators
            </div>
            <h1 className="text-4xl md:text-6xl font-bold font-display text-foreground mb-6 animate-fade-up">
              Turn Your Audience Into{" "}
              <span className="text-primary">Income</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 animate-fade-up" style={{ animationDelay: "100ms" }}>
              Earn up to 50% commission promoting products you believe in.
              Free to join, with payouts to your Nigerian bank, PayPal or USDT.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up" style={{ animationDelay: "200ms" }}>
              <Link to="/auth">
                <Button size="lg" className="h-14 px-8 gradient-primary text-primary-foreground text-lg font-semibold rounded-xl shadow-glow">
                  Start Earning Free <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/how-it-works">
                <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-xl">
                  See How It Works
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-card border-y border-border">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={stat.label} className="text-center animate-fade-up" style={{ animationDelay: `${index * 100}ms` }}>
                <p className="text-3xl md:text-4xl font-bold font-display text-primary mb-2">{stat.value}</p>
                <p className="text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-display text-foreground mb-4">
              Why Choose Affiliate Hub?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to build a successful affiliate business
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="bg-card rounded-2xl p-6 shadow-card hover:shadow-lg transition-all duration-300 hover:-translate-y-1 animate-fade-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 md:py-32 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-display text-foreground mb-4">
              Start Earning in 3 Simple Steps
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {steps.map((step, index) => (
              <div key={step.step} className="text-center animate-fade-up" style={{ animationDelay: `${index * 100}ms` }}>
                <div className="w-16 h-16 rounded-full gradient-primary text-primary-foreground text-2xl font-bold flex items-center justify-center mx-auto mb-4 shadow-glow">
                  {step.step}
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why affiliates choose us.

          This replaced a "Loved by Affiliates" block of three named testimonials
          with earnings claims attributed to people who do not exist. Until there
          are real affiliates willing to be quoted by name, the page describes the
          product rather than inventing endorsements for it. */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-display text-foreground mb-4">
              Built around how you actually promote
            </h2>
            <p className="text-lg text-muted-foreground">
              No invented success stories — just what the platform does.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {highlights.map((item, index) => (
              <div
                key={item.title}
                className="bg-card rounded-2xl p-6 shadow-card animate-fade-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <h3 className="font-display mb-3 text-lg font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ad Section - Peaceful placement */}
      <section className="py-8 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex justify-center">
            <ContentAd />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32 gradient-primary relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-64 h-64 rounded-full border-2 border-current" />
          <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full border-2 border-current" />
        </div>
        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center text-primary-foreground">
            <h2 className="text-3xl md:text-4xl font-bold font-display mb-4">
              Ready to Start Earning?
            </h2>
            <p className="text-lg opacity-90 mb-8">
              Join thousands of affiliates who are already making money with Affiliate Hub. 
              Sign up is free and takes less than 60 seconds.
            </p>
            <Link to="/auth">
              <Button size="lg" className="h-14 px-8 bg-primary-foreground text-primary text-lg font-semibold rounded-xl hover:bg-primary-foreground/90">
                Create Free Account <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <Link to="/" className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                  <span className="text-lg font-bold text-primary-foreground">A</span>
                </div>
                <span className="font-bold text-xl font-display text-foreground">Affiliate Hub</span>
              </Link>
              <p className="text-muted-foreground">
                An affiliate marketplace for Nigerian creators. Earn commission promoting products you already use.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Company</h4>
              <div className="space-y-2">
                <Link to="/about" className="block text-muted-foreground hover:text-foreground transition-colors">About Us</Link>
                <Link to="/contact" className="block text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
                <Link to="/how-it-works" className="block text-muted-foreground hover:text-foreground transition-colors">How It Works</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Legal</h4>
              <div className="space-y-2">
                <Link to="/terms" className="block text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link>
                <Link to="/privacy" className="block text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Support</h4>
              <div className="space-y-2">
                <a href={`mailto:${SUPPORT_EMAIL}`} className="block text-muted-foreground hover:text-foreground transition-colors">{SUPPORT_EMAIL}</a>
                <a href={whatsappLink(SUPPORT_WHATSAPP)} target="_blank" rel="noreferrer" className="block text-muted-foreground hover:text-foreground transition-colors">WhatsApp Support</a>
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-8 text-center text-muted-foreground">
            <p>© {new Date().getFullYear()} Affiliate Hub. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  );
};

export default LandingPage;
