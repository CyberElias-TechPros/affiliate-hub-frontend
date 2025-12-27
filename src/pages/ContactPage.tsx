import * as React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, MapPin, Phone, Send, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomInput } from "@/components/ui/CustomInput";
import { toast } from "sonner";

const contactInfo = [
  {
    icon: Mail,
    title: "Email Us",
    value: "support@affiliatehub.ng",
    description: "We respond within 24 hours",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp",
    value: "+234 801 234 5678",
    description: "Available Mon-Sat, 9am-6pm",
  },
  {
    icon: MapPin,
    title: "Office",
    value: "Lagos, Nigeria",
    description: "Victoria Island",
  },
];

const ContactPage = () => {
  const [formData, setFormData] = React.useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsSubmitting(false);
    toast.success("Message sent! We'll get back to you soon.");
    setFormData({ name: "", email: "", subject: "", message: "" });
  };

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
              Get in Touch
            </h1>
            <p className="text-lg text-muted-foreground">
              Have questions? We're here to help. Reach out to our team and we'll get back to you within 24 hours.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12">
            {/* Contact Info */}
            <div>
              <h2 className="text-2xl font-bold font-display text-foreground mb-6">Contact Information</h2>
              <div className="space-y-6 mb-8">
                {contactInfo.map((info) => (
                  <div key={info.title} className="flex gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <info.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{info.title}</h3>
                      <p className="text-foreground">{info.value}</p>
                      <p className="text-sm text-muted-foreground">{info.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick WhatsApp */}
              <div className="bg-success/5 border border-success/20 rounded-xl p-6">
                <h3 className="font-semibold text-foreground mb-2">Need Quick Help?</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Chat with our support team on WhatsApp for immediate assistance.
                </p>
                <Button
                  onClick={() => window.open("https://wa.me/2348012345678", "_blank")}
                  className="bg-success hover:bg-success/90 text-success-foreground"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Chat on WhatsApp
                </Button>
              </div>
            </div>

            {/* Contact Form */}
            <div className="bg-card rounded-2xl p-6 md:p-8 shadow-card">
              <h2 className="text-2xl font-bold font-display text-foreground mb-6">Send us a Message</h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                <CustomInput
                  label="Full Name"
                  placeholder="Enter your name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
                <CustomInput
                  label="Email Address"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
                <CustomInput
                  label="Subject"
                  placeholder="What's this about?"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  required
                />
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Message</label>
                  <textarea
                    placeholder="Tell us how we can help..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                    className="w-full h-32 px-4 py-3 rounded-lg border border-input bg-card text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 gradient-primary text-primary-foreground font-semibold rounded-xl shadow-glow"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Sending...
                    </div>
                  ) : (
                    <>
                      <Send className="mr-2 h-5 w-5" />
                      Send Message
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>
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

export default ContactPage;
