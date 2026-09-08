import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CustomInput } from "@/components/ui/CustomInput";
import { CountryDropdown } from "@/components/ui/CountryDropdown";
import { Seo } from "@/components/seo/Seo";
import { useAuth } from "@/contexts/AuthContext";
import { ApiClientError, AuthAPI } from "@/lib/api";

const NICHES = [
  { id: "tech", label: "Technology", emoji: "💻" },
  { id: "health", label: "Health & Fitness", emoji: "💪" },
  { id: "finance", label: "Finance", emoji: "💰" },
  { id: "beauty", label: "Beauty", emoji: "✨" },
  { id: "education", label: "Education", emoji: "📚" },
  { id: "lifestyle", label: "Lifestyle", emoji: "🏠" },
] as const;

/**
 * Onboarding wizard.
 *
 * The prototype collected a country, niches and a WhatsApp number and then
 * threw all three away — `handleComplete` was just `navigate("/dashboard")`.
 * Nothing was persisted, so the very next page load showed none of it.
 */
const OnboardingPage = () => {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();

  const [step, setStep] = React.useState(1);
  const [country, setCountry] = React.useState(user?.country ?? "NG");
  const [selectedNiches, setSelectedNiches] = React.useState<string[]>(user?.niches ?? []);
  const [whatsapp, setWhatsapp] = React.useState(user?.whatsapp ?? "");
  const [whatsappError, setWhatsappError] = React.useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      AuthAPI.completeOnboarding({
        country,
        niches: selectedNiches,
        whatsapp: whatsapp.trim() || null,
      }),
    onSuccess: ({ user: updated }) => {
      setUser(updated);
      toast.success("You're all set");
      navigate("/dashboard", { replace: true });
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.fields.whatsapp) {
        setWhatsappError(error.fields.whatsapp);
        setStep(3);
      }
      toast.error(error instanceof ApiClientError ? error.message : "We could not save that. Please try again.");
    },
  });

  const toggleNiche = (id: string) => {
    setSelectedNiches((prev) => (prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]));
  };

  const validateWhatsapp = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return null; // optional
    return /^\+[1-9]\d{7,14}$/.test(trimmed) ? null : "Enter a full international number, e.g. +2348012345678";
  };

  const advance = () => {
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    const issue = validateWhatsapp(whatsapp);
    if (issue) {
      setWhatsappError(issue);
      return;
    }
    save.mutate();
  };

  return (
    <div className="gradient-hero flex min-h-screen flex-col">
      <Seo
        title="Set up your account"
        description="Tell us about your audience so we can show you relevant products."
        path="/onboarding"
        robots="noindex, nofollow"
      />

      <div className="px-6 pt-6">
        <div className="flex gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step} aria-label={`Step ${step} of 3`}>
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${s <= step ? "gradient-primary" : "bg-muted"}`} />
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Step {step} of 3</p>
      </div>

      <main id="main-content" className="flex-1 px-6 py-8">
        {step === 1 && (
          <div className="animate-fade-in">
            <h1 className="font-display text-2xl font-bold text-foreground">Where are you based?</h1>
            <p className="mb-8 mt-1 text-muted-foreground">We use this to show you relevant payouts and currencies.</p>
            <CountryDropdown value={country} onChange={setCountry} label="Select your country" />
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in">
            <h1 className="font-display text-2xl font-bold text-foreground">Pick your niches</h1>
            <p className="mb-8 mt-1 text-muted-foreground">
              Choose what your audience cares about. You can change this later in settings.
            </p>
            <div className="grid grid-cols-2 gap-3" role="group" aria-label="Choose your niches">
              {NICHES.map((niche) => {
                const isSelected = selectedNiches.includes(niche.id);
                return (
                  <button
                    key={niche.id}
                    type="button"
                    onClick={() => toggleNiche(niche.id)}
                    aria-pressed={isSelected}
                    className={`relative flex items-center gap-3 rounded-xl border-2 p-4 transition-all duration-200 ${
                      isSelected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"
                    }`}
                  >
                    <span className="text-2xl" aria-hidden="true">
                      {niche.emoji}
                    </span>
                    <span className="text-left text-sm font-medium">{niche.label}</span>
                    {isSelected && (
                      <span className="gradient-primary absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full">
                        <Check className="h-3 w-3 text-primary-foreground" aria-hidden="true" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {selectedNiches.length === 0 && (
              <p className="mt-4 text-sm text-muted-foreground">Select at least one to continue.</p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade-in">
            <h1 className="font-display text-2xl font-bold text-foreground">Connect WhatsApp</h1>
            <p className="mb-8 mt-1 text-muted-foreground">
              Optional. We will let you know here when you make a sale.
            </p>
            <CustomInput
              id="onboarding-whatsapp"
              label="WhatsApp number"
              placeholder="+234 801 234 5678"
              type="tel"
              value={whatsapp}
              onChange={(e) => {
                setWhatsapp(e.target.value);
                setWhatsappError(null);
              }}
              error={whatsappError ?? undefined}
              hint="Include your country code, e.g. +234."
            />
          </div>
        )}
      </main>

      <footer className="px-6 pb-8">
        <div className="flex gap-3">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="h-12 flex-1 rounded-xl" disabled={save.isPending}>
              Back
            </Button>
          )}
          <Button
            onClick={advance}
            disabled={(step === 2 && selectedNiches.length === 0) || save.isPending}
            className="gradient-primary h-12 flex-1 rounded-xl font-semibold text-primary-foreground shadow-glow"
          >
            {save.isPending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <span>{step === 3 ? "Get started" : "Continue"}</span>
                <ArrowRight className="ml-2 h-5 w-5" />
              </>
            )}
          </Button>
        </div>
        {step === 3 && !save.isPending && (
          <button
            type="button"
            onClick={() => save.mutate()}
            className="mt-4 w-full text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Skip for now
          </button>
        )}
      </footer>
    </div>
  );
};

export default OnboardingPage;
