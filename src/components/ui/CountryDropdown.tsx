import * as React from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const countries = [
  { code: "NG", name: "Nigeria", flag: "🇳🇬" },
  { code: "GH", name: "Ghana", flag: "🇬🇭" },
  { code: "KE", name: "Kenya", flag: "🇰🇪" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦" },
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
];

interface CountryDropdownProps {
  value?: string;
  onChange?: (code: string) => void;
  label?: string;
  error?: string;
  className?: string;
}

const CountryDropdown = React.forwardRef<HTMLDivElement, CountryDropdownProps>(
  ({ value = "NG", onChange, label, error, className }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    const selectedCountry = countries.find((c) => c.code === value) || countries[0];

    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
      <div ref={ref} className={cn("w-full space-y-1.5", className)}>
        {label && (
          <label className="text-sm font-medium text-foreground">{label}</label>
        )}
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className={cn(
              "flex items-center justify-between w-full h-12 px-4 rounded-lg border border-input bg-card",
              "text-left transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
              error && "border-destructive focus:ring-destructive/20",
              isOpen && "ring-2 ring-primary/20 border-primary"
            )}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{selectedCountry.flag}</span>
              <span className="font-medium">{selectedCountry.name}</span>
            </div>
            <ChevronDown className={cn(
              "h-5 w-5 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180"
            )} />
          </button>

          {isOpen && (
            <div className="absolute z-50 w-full mt-2 py-2 bg-popover border border-border rounded-xl shadow-lg animate-fade-in">
              {countries.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => {
                    onChange?.(country.code);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex items-center justify-between w-full px-4 py-2.5 text-left transition-colors",
                    "hover:bg-muted",
                    country.code === value && "bg-primary/5"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{country.flag}</span>
                    <span className="font-medium">{country.name}</span>
                  </div>
                  {country.code === value && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        {error && (
          <p className="text-sm text-destructive animate-fade-in">{error}</p>
        )}
      </div>
    );
  }
);

CountryDropdown.displayName = "CountryDropdown";

export { CountryDropdown };
