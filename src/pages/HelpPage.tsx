import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown, MessageCircle, Upload, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Seo } from "@/components/seo/Seo";

const faqs = [
  {
    question: "How do I get paid?",
    answer: "You can withdraw your earnings to your Nigerian bank account, USDT wallet, or PayPal. Bank transfers are free and processed within 1-2 hours during business hours.",
  },
  {
    question: "What is the minimum withdrawal?",
    answer: "The minimum withdrawal amount is ₦5,000 for bank transfers and $50 for PayPal and USDT withdrawals. Fees and minimums for each method are shown on the withdrawal page before you confirm.",
  },
  {
    question: "How do commissions work?",
    answer: "Each product has a different commission rate (shown as a percentage). When someone purchases through your link, you earn that percentage of the sale price.",
  },
  {
    question: "How long are cookies valid?",
    answer: "Cookie duration varies by product, typically 30-90 days. This means if someone clicks your link but buys later, you still get the commission.",
  },
  {
    question: "Can I promote on social media?",
    answer: "Yes! You can promote on WhatsApp, Instagram, Facebook, Twitter, TikTok, and any other platform. We provide marketing materials for each product.",
  },
];

const HelpPage = () => {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = React.useState<number | null>(null);
  const [problemText, setProblemText] = React.useState("");
  const [showReportForm, setShowReportForm] = React.useState(false);

  const handleSubmitProblem = () => {
    if (problemText.trim()) {
      toast.success("Report submitted! We'll get back to you soon.");
      setProblemText("");
      setShowReportForm(false);
    }
  };

  return (
    <main id="main-content" className="min-h-screen bg-background">
      <Seo
        title="Help centre"
        description="Answers about payouts, minimum withdrawals, commission tracking and your Affiliate Hub account."
        path="/help"
      />
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="flex items-center gap-3 px-4 py-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold font-display">Help & Support</h1>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* FAQ Section */}
        <div>
          <h2 className="font-semibold text-foreground mb-4">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-card rounded-xl shadow-card overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <span className="font-medium text-foreground pr-4">{faq.question}</span>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground flex-shrink-0 transition-transform ${
                    openFaq === index ? "rotate-180" : ""
                  }`} />
                </button>
                {openFaq === index && (
                  <div className="px-4 pb-4 animate-accordion-down">
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contact Support */}
        <div className="bg-success/5 border border-success/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="h-5 w-5 text-success" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Need more help?</p>
              <p className="text-sm text-muted-foreground mt-1 mb-3">
                Chat with our support team on WhatsApp for quick assistance.
              </p>
              <Button
                onClick={() => window.open("https://wa.me/2348012345678", "_blank")}
                className="bg-success hover:bg-success/90 text-success-foreground"
              >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                </svg>
                Chat on WhatsApp
              </Button>
            </div>
          </div>
        </div>

        {/* Report Problem */}
        <div>
          <button
            onClick={() => setShowReportForm(!showReportForm)}
            className="w-full text-left font-semibold text-foreground mb-3"
          >
            Report a Problem
          </button>
          
          {showReportForm && (
            <div className="bg-card rounded-xl p-4 shadow-card space-y-4 animate-fade-in">
              <textarea
                value={problemText}
                onChange={(e) => setProblemText(e.target.value)}
                placeholder="Describe your issue in detail..."
                className="w-full h-32 p-3 bg-muted rounded-lg text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1">
                  <Upload className="h-4 w-4 mr-2" />
                  Attach Image
                </Button>
                <Button
                  onClick={handleSubmitProblem}
                  disabled={!problemText.trim()}
                  className="flex-1 gradient-primary text-primary-foreground"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Submit
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default HelpPage;
