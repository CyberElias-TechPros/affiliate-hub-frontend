import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomInput } from "@/components/ui/CustomInput";
import { CountryDropdown } from "@/components/ui/CountryDropdown";

const niches = [
  { id: "tech", label: "Technology", emoji: "💻" },
  { id: "health", label: "Health & Fitness", emoji: "💪" },
  { id: "finance", label: "Finance", emoji: "💰" },
  { id: "beauty", label: "Beauty", emoji: "✨" },
  { id: "education", label: "Education", emoji: "📚" },
  { id: "lifestyle", label: "Lifestyle", emoji: "🏠" },
];

const OnboardingPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = React.useState(1);
  const [country, setCountry] = React.useState("NG");
  const [selectedNiches, setSelectedNiches] = React.useState<string[]>([]);
  const [whatsapp, setWhatsapp] = React.useState("");

  const toggleNiche = (id: string) => {
    setSelectedNiches((prev) =>
      prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]
    );
  };

  const handleComplete = () => {
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex flex-col gradient-hero">
      {/* Progress Bar */}
      <div className="px-6 pt-6">
        <div className="flex gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                s <= step ? "gradient-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <p className="text-sm text-muted-foreground mt-3">Step {step} of 3</p>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-8">
        {step === 1 && (
          <div className="animate-fade-in">
            <h1 className="text-2xl font-bold font-display text-foreground mb-2">
              Where are you based?
            </h1>
            <p className="text-muted-foreground mb-8">
              We'll show you products and payouts relevant to your region.
            </p>
            <CountryDropdown
              value={country}
              onChange={setCountry}
              label="Select your country"
            />
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in">
            <h1 className="text-2xl font-bold font-display text-foreground mb-2">
              Pick your niches
            </h1>
            <p className="text-muted-foreground mb-8">
              Select the categories you want to promote. You can change this later.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {niches.map((niche) => {
                const isSelected = selectedNiches.includes(niche.id);
                return (
                  <button
                    key={niche.id}
                    onClick={() => toggleNiche(niche.id)}
                    className={`relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/30"
                    }`}
                  >
                    <span className="text-2xl">{niche.emoji}</span>
                    <span className="font-medium text-sm text-left">{niche.label}</span>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full gradient-primary flex items-center justify-center">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade-in">
            <h1 className="text-2xl font-bold font-display text-foreground mb-2">
              Connect WhatsApp
            </h1>
            <p className="text-muted-foreground mb-8">
              We'll send important notifications about your sales to WhatsApp.
            </p>
            <CustomInput
              label="WhatsApp Number"
              placeholder="+234 801 234 5678"
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
            />
            <div className="mt-6 p-4 rounded-xl bg-success/5 border border-success/20">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-success" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.489l4.614-1.467A11.946 11.946 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.32 0-4.47-.73-6.24-1.97l-.36-.22-2.74.87.92-2.67-.24-.38A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">Get instant notifications</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Know immediately when you make a sale!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 pb-8">
        <div className="flex gap-3">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              className="flex-1 h-12 rounded-xl"
            >
              Back
            </Button>
          )}
          <Button
            onClick={() => (step < 3 ? setStep(step + 1) : handleComplete())}
            disabled={step === 2 && selectedNiches.length === 0}
            className="flex-1 h-12 gradient-primary text-primary-foreground font-semibold rounded-xl shadow-glow hover:opacity-90 transition-all duration-200"
          >
            <span>{step === 3 ? "Get Started" : "Continue"}</span>
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        </div>
        {step === 3 && (
          <button
            onClick={handleComplete}
            className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
};

export default OnboardingPage;
