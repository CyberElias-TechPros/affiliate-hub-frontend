import * as React from "react";
import { Link } from "react-router-dom";
import { 
  ArrowRight, CheckCircle2, TrendingUp, Users, Wallet, 
  Shield, Zap, Star, ChevronRight, Menu, X 
} from "lucide-react";
import { Button } from "@/components/ui/button";

const stats = [
  { value: "₦50M+", label: "Paid to Affiliates" },
  { value: "15,000+", label: "Active Affiliates" },
  { value: "500+", label: "Products" },
  { value: "98%", label: "Payout Rate" },
];

const features = [
  {
    icon: TrendingUp,
    title: "High Commissions",
    description: "Earn up to 50% commission on every sale. Our rates are among the highest in Nigeria.",
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

const testimonials = [
  {
    name: "Emeka Okafor",
    role: "Tech Blogger",
    image: "EO",
    text: "I've made over ₦2M in 6 months promoting digital products. The platform is incredibly easy to use.",
  },
  {
    name: "Amaka Udo",
    role: "Social Media Influencer",
    image: "AU",
    text: "Fast payouts and great support. I recommend Affiliate Hub to everyone who wants to monetize their audience.",
  },
  {
    name: "John Dada",
    role: "Content Creator",
    image: "JD",
    text: "The commission rates are unbeatable. I switched from other platforms and doubled my earnings.",
  },
];

const steps = [
  { step: "1", title: "Sign Up Free", description: "Create your account in under 60 seconds" },
  { step: "2", title: "Choose Products", description: "Browse our marketplace of 500+ products" },
  { step: "3", title: "Share & Earn", description: "Promote your links and earn commissions" },
];

const LandingPage = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-background">
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
              Nigeria's #1 Affiliate Platform
            </div>
            <h1 className="text-4xl md:text-6xl font-bold font-display text-foreground mb-6 animate-fade-up">
              Turn Your Audience Into{" "}
              <span className="text-primary">Income</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 animate-fade-up" style={{ animationDelay: "100ms" }}>
              Earn up to 50% commission promoting products you believe in. 
              Join 15,000+ affiliates making money with Affiliate Hub.
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

      {/* Testimonials Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-display text-foreground mb-4">
              Loved by Affiliates
            </h2>
            <p className="text-lg text-muted-foreground">See what our top earners have to say</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <div
                key={testimonial.name}
                className="bg-card rounded-2xl p-6 shadow-card animate-fade-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-center gap-1 text-accent mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="text-foreground mb-6">"{testimonial.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
                    {testimonial.image}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
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
                Nigeria's leading affiliate marketing platform. Earn money promoting products you love.
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
                <a href="mailto:support@affiliatehub.ng" className="block text-muted-foreground hover:text-foreground transition-colors">support@affiliatehub.ng</a>
                <a href="https://wa.me/2348012345678" target="_blank" rel="noreferrer" className="block text-muted-foreground hover:text-foreground transition-colors">WhatsApp Support</a>
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-8 text-center text-muted-foreground">
            <p>© {new Date().getFullYear()} Affiliate Hub. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
