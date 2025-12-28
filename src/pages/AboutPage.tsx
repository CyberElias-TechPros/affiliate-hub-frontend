import * as React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Users, Target, Heart, Award, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentAd } from "@/components/common/AdBanner";

const values = [
  {
    icon: Heart,
    title: "Affiliate First",
    description: "We build everything with our affiliates in mind. Your success is our success.",
  },
  {
    icon: Target,
    title: "Transparency",
    description: "Clear commission structures, real-time tracking, and honest communication.",
  },
  {
    icon: Award,
    title: "Excellence",
    description: "We continuously improve our platform to give you the best experience.",
  },
  {
    icon: Users,
    title: "Community",
    description: "Join a thriving community of like-minded affiliates supporting each other.",
  },
];

const team = [
  { name: "Chioma Adeyemi", role: "CEO & Founder", avatar: "CA" },
  { name: "Oluwaseun Bakare", role: "CTO", avatar: "OB" },
  { name: "Ngozi Eze", role: "Head of Affiliates", avatar: "NE" },
  { name: "Emeka Obi", role: "Head of Products", avatar: "EO" },
];

const AboutPage = () => {
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
              About Affiliate Hub
            </h1>
            <p className="text-lg text-muted-foreground">
              We're on a mission to empower Nigerians to earn passive income through affiliate marketing. 
              Founded in 2022, we've grown to become Nigeria's most trusted affiliate platform.
            </p>
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold font-display text-foreground mb-6">Our Story</h2>
                <div className="space-y-4 text-muted-foreground">
                  <p>
                    Affiliate Hub was born from a simple observation: Nigerians have massive influence 
                    on social media, but limited ways to monetize it fairly.
                  </p>
                  <p>
                    Our founder, Chioma Adeyemi, experienced this firsthand while trying to earn from 
                    international affiliate programs that didn't pay to Nigerian banks or had 
                    unreasonably high payout thresholds.
                  </p>
                  <p>
                    Today, we've paid out over ₦50 million to affiliates across Nigeria, proving that 
                    local solutions can compete with global platforms—and win.
                  </p>
                </div>
              </div>
              <div className="bg-card rounded-2xl p-8 shadow-card">
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="text-3xl font-bold text-primary">2022</div>
                    <div className="text-muted-foreground">Founded in Lagos</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-3xl font-bold text-primary">15K+</div>
                    <div className="text-muted-foreground">Active affiliates</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-3xl font-bold text-primary">₦50M+</div>
                    <div className="text-muted-foreground">Paid to affiliates</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-3xl font-bold text-primary">500+</div>
                    <div className="text-muted-foreground">Products listed</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold font-display text-foreground mb-4">Our Values</h2>
            <p className="text-muted-foreground">The principles that guide everything we do</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {values.map((value, index) => (
              <div
                key={value.title}
                className="bg-card rounded-2xl p-6 shadow-card text-center animate-fade-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mx-auto mb-4">
                  <value.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{value.title}</h3>
                <p className="text-muted-foreground text-sm">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ad Section */}
      <section className="py-8 bg-background">
        <div className="container mx-auto px-4">
          <div className="flex justify-center">
            <ContentAd />
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold font-display text-foreground mb-4">Meet the Team</h2>
            <p className="text-muted-foreground">The people making it all happen</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {team.map((member, index) => (
              <div
                key={member.name}
                className="text-center animate-fade-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center mx-auto mb-4 text-primary-foreground text-xl font-bold">
                  {member.avatar}
                </div>
                <h3 className="font-semibold text-foreground">{member.name}</h3>
                <p className="text-sm text-muted-foreground">{member.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 gradient-primary">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold font-display text-primary-foreground mb-4">
            Join Our Growing Community
          </h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            Become part of Nigeria's most supportive affiliate network and start earning today.
          </p>
          <Link to="/auth">
            <Button size="lg" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90">
              Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© {new Date().getFullYear()} Affiliate Hub. All rights reserved.</p>
          <div className="flex justify-center gap-4 mt-4">
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AboutPage;
