import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Phone, Lock, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomInput } from "@/components/ui/CustomInput";

type AuthMode = "login" | "signup";

const AuthPage = () => {
  const navigate = useNavigate();
  const [mode, setMode] = React.useState<AuthMode>("login");
  const [isLoading, setIsLoading] = React.useState(false);
  const [showSuccess, setShowSuccess] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    setIsLoading(false);
    if (mode === "signup") {
      setShowSuccess(true);
      setTimeout(() => {
        navigate("/onboarding");
      }, 2000);
    } else {
      navigate("/dashboard");
    }
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-hero p-4">
        <div className="text-center animate-scale-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full gradient-primary mb-6">
            <CheckCircle2 className="h-10 w-10 text-primary-foreground animate-check-bounce" />
          </div>
          <h1 className="text-2xl font-bold font-display text-foreground mb-2">
            Welcome to Affiliate Hub!
          </h1>
          <p className="text-muted-foreground">Setting up your account...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col gradient-hero">
      {/* Header */}
      <div className="pt-12 pb-8 px-6 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary shadow-glow mb-6">
          <span className="text-2xl font-bold text-primary-foreground">A</span>
        </div>
        <h1 className="text-3xl font-bold font-display text-foreground mb-2">
          {mode === "login" ? "Welcome back" : "Create account"}
        </h1>
        <p className="text-muted-foreground">
          {mode === "login"
            ? "Sign in to access your affiliate dashboard"
            : "Start earning with top affiliate products"}
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="px-6 mb-6">
        <div className="flex p-1.5 bg-muted rounded-xl">
          <button
            onClick={() => setMode("login")}
            className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
              mode === "login"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            Login
          </button>
          <button
            onClick={() => setMode("signup")}
            className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
              mode === "signup"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            Sign Up
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 px-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <CustomInput
              label="Full Name"
              placeholder="Enter your full name"
              type="text"
            />
          )}

          <CustomInput
            label="Email or Phone"
            placeholder="Enter your email or phone"
            type="text"
            icon={<Mail className="h-5 w-5" />}
          />

          <CustomInput
            label="Password"
            placeholder={mode === "signup" ? "Create a password" : "Enter your password"}
            type="password"
            icon={<Lock className="h-5 w-5" />}
          />

          {mode === "login" && (
            <button type="button" className="text-sm text-primary font-medium hover:underline">
              Forgot password?
            </button>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 mt-6 gradient-primary text-primary-foreground font-semibold rounded-xl shadow-glow hover:opacity-90 transition-all duration-200"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                <span>Please wait...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span>{mode === "login" ? "Sign In" : "Create Account"}</span>
                <ArrowRight className="h-5 w-5" />
              </div>
            )}
          </Button>
        </form>

        {/* Social Auth */}
        <div className="mt-8">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-3 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-xl border-border"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-xl border-border"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              Apple
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="py-6 px-6 text-center">
        <p className="text-xs text-muted-foreground">
          By continuing, you agree to our{" "}
          <button className="text-primary hover:underline">Terms</button> &{" "}
          <button className="text-primary hover:underline">Privacy Policy</button>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
