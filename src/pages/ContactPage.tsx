import * as React from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Loader2, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CustomInput } from "@/components/ui/CustomInput";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ContentAd } from "@/components/common/AdBanner";
import { Seo, breadcrumbSchema, faqSchema } from "@/components/seo/Seo";
import { COMPANY_NAME, SUPPORT_EMAIL, SUPPORT_WHATSAPP } from "@/lib/config";
import { ApiClientError, ContentAPI } from "@/lib/api";
import { whatsappLink } from "@/lib/validation";

/**
 * Contact + FAQ.
 *
 * The prototype's form was `onSubmit={undefined}` — the submit button rendered
 * but did nothing, with no handler and no API endpoint. It now posts a support
 * ticket that creates a row the backend can actually see.
 */

const TOPICS = [
  { value: "general", label: "General question" },
  { value: "payout", label: "Payouts and withdrawals" },
  { value: "product", label: "A product or merchant" },
  { value: "technical", label: "Something isn't working" },
] as const;

const ContactPage = () => {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [topic, setTopic] = React.useState<(typeof TOPICS)[number]["value"]>("general");
  const [message, setMessage] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const faqs = useQuery({ queryKey: ["content", "faqs"], queryFn: () => ContentAPI.faqs() });
  const faqItems = faqs.data?.items ?? [];

  const submit = useMutation({
    mutationFn: () =>
      ContentAPI.createTicket({
        subject: TOPICS.find((t) => t.value === topic)?.label ?? "General question",
        message: `From ${name} (${topic})\n\n${message}`,
        contactEmail: email,
        category: topic,
      }),
    onSuccess: () => {
      setName("");
      setEmail("");
      setMessage("");
      setErrors({});
      toast.success("Message sent. We reply within one business day.");
    },
    onError: (error) => {
      if (error instanceof ApiClientError) {
        setErrors(error.fields);
        toast.error(error.message);
        return;
      }
      toast.error("We could not send that message. Please try again.");
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Enter your name";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) next.email = "Enter a valid email address";
    if (message.trim().length < 10) next.message = "Please add a little more detail";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    submit.mutate();
  };

  const grouped = React.useMemo(() => {
    const groups: Record<string, { question: string; answer: string }[]> = {};
    for (const faq of faqItems) {
      (groups[faq.category] ??= []).push({ question: faq.question, answer: faq.answer });
    }
    return groups;
  }, [faqItems]);

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Contact us"
        description={`Questions about Affiliate Hub? Email ${SUPPORT_EMAIL} or message us on WhatsApp. Answers about payouts, withdrawals and how commissions are tracked.`}
        path="/contact"
        jsonLd={[
          breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Contact", path: "/contact" }]),
          ...(faqItems.length > 0
            ? [
                faqSchema(faqItems.map((f) => ({ question: f.question, answer: f.answer }))),
              ]
            : []),
        ]}
      />

      <header className="gradient-hero">
        <div className="px-4 pb-8 pt-6">
          <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back home
          </Link>
          <h1 className="font-display text-3xl font-bold text-foreground">Contact us</h1>
          <p className="mt-2 text-muted-foreground">
            Questions about payouts, products or your account? We usually reply within one business day.
          </p>
        </div>
      </header>

      <main id="main-content" className="px-4 py-8">
        <section aria-labelledby="form-heading" className="bg-card shadow-card mb-10 rounded-xl p-6">
          <h2 id="form-heading" className="font-display mb-6 text-lg font-semibold text-foreground">
            Send us a message
          </h2>

          {submit.isSuccess ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center" role="status">
              <CheckCircle2 className="h-12 w-12 text-success" aria-hidden="true" />
              <p className="font-medium text-foreground">Message sent</p>
              <p className="text-sm text-muted-foreground">We will reply to your email shortly.</p>
              <Button variant="outline" size="sm" onClick={() => submit.reset()}>
                Send another
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <CustomInput
                id="contact-name"
                label="Your name"
                placeholder="Amara Okafor"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={errors.name}
                autoComplete="name"
                required
              />
              <CustomInput
                id="contact-email"
                label="Email address"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                autoComplete="email"
                required
              />

              <div>
                <label htmlFor="contact-topic" className="mb-1.5 block text-sm font-medium text-foreground">
                  What is it about?
                </label>
                <select
                  id="contact-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value as (typeof TOPICS)[number]["value"])}
                  className="h-12 w-full rounded-lg border border-input bg-background px-3 text-foreground"
                >
                  {TOPICS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="contact-message" className="mb-1.5 block text-sm font-medium text-foreground">
                  Message
                </label>
                <Textarea
                  id="contact-message"
                  placeholder="Tell us what you need…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  aria-invalid={Boolean(errors.message)}
                  aria-describedby={errors.message ? "contact-message-error" : undefined}
                />
                {errors.message && (
                  <p id="contact-message-error" className="mt-1 text-sm text-destructive" role="alert">
                    {errors.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={submit.isPending}
                className="gradient-primary h-12 w-full rounded-xl font-semibold text-primary-foreground shadow-glow"
              >
                {submit.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  "Send message"
                )}
              </Button>
            </form>
          )}
        </section>

        <section aria-labelledby="other-ways-heading" className="mb-10">
          <h2 id="other-ways-heading" className="font-display mb-4 text-lg font-semibold text-foreground">
            Other ways to reach us
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <a href={`mailto:${SUPPORT_EMAIL}`} className="bg-card shadow-card flex items-center gap-4 rounded-xl p-4 transition-shadow hover:shadow-lg">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-6 w-6 text-primary" aria-hidden="true" />
              </span>
              <span>
                <span className="block font-medium text-foreground">Email</span>
                <span className="block text-sm text-muted-foreground">{SUPPORT_EMAIL}</span>
              </span>
            </a>
            <a href={whatsappLink(SUPPORT_WHATSAPP)} target="_blank" rel="noopener noreferrer" className="bg-card shadow-card flex items-center gap-4 rounded-xl p-4 transition-shadow hover:shadow-lg">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                <MessageCircle className="h-6 w-6 text-success" aria-hidden="true" />
              </span>
              <span>
                <span className="block font-medium text-foreground">WhatsApp</span>
                <span className="block text-sm text-muted-foreground">Fastest for urgent payout issues</span>
              </span>
            </a>
          </div>
        </section>

        <section aria-labelledby="faq-heading" className="mb-10">
          <h2 id="faq-heading" className="font-display mb-4 text-lg font-semibold text-foreground">
            Frequently asked questions
          </h2>

          {faqs.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : faqs.isError ? (
            <p className="text-sm text-muted-foreground">
              We could not load the FAQs right now.{" "}
              <button type="button" className="text-primary hover:underline" onClick={() => void faqs.refetch()}>
                Try again
              </button>
            </p>
          ) : (
            Object.entries(grouped).map(([category, entries]) => (
              <details key={category} className="bg-card shadow-card mb-2 rounded-xl">
                <summary className="cursor-pointer px-4 py-3 font-medium capitalize text-foreground">
                  {category.replace(/-/g, " ")}
                </summary>
                <ul className="divide-y divide-border">
                  {entries.map((entry) => (
                    <li key={entry.question} className="px-4 py-3">
                      <p className="font-medium text-foreground">{entry.question}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{entry.answer}</p>
                    </li>
                  ))}
                </ul>
              </details>
            ))
          )}
        </section>

        <ContentAd />
      </main>
    </div>
  );
};

export default ContactPage;
