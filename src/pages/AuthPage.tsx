import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CustomInput } from "@/components/ui/CustomInput";
import { useAuth } from "@/contexts/AuthContext";
import { ApiClientError } from "@/lib/api";
import { Seo, websiteSchema, organizationSchema } from "@/components/seo/Seo";
import { PASSWORD_MIN } from "@/lib/validation";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80, "That name is too long"),
  email: z.string().trim().email("Enter a valid email address"),
  password: z
    .string()
    .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
    .max(200, "That password is too long")
    .refine((p) => /[a-zA-Z]/.test(p) && /\d/.test(p), "Include at least one letter and one number"),
});

type LoginForm = z.infer<typeof loginSchema>;
type SignupForm = z.infer<typeof signupSchema>;

type Mode = "login" | "signup";

/**
 * Sign in / create account.
 *
 * Replaces a screen whose buttons did nothing. Both modes validate on the
 * client for immediate feedback and rely on the API as the authority — the
 * server re-validates and is the only place a password policy is enforced.
 */
const AuthPage = () => {
  const [mode, setMode] = React.useState<Mode>("login");
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { login, signup } = useAuth();

  // Where a ProtectedRoute bounced the user from, so we can send them back.
  const from = (location.state as { from?: string } | null)?.from;

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const signupForm = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const switchMode = (next: Mode) => {
    setMode(next);
    setSubmitError(null);
    loginForm.clearErrors();
    signupForm.clearErrors();
  };

  const describeError = (error: unknown): string => {
    if (error instanceof ApiClientError) {
      if (error.code === "rate_limited") return error.message;
      if (error.code === "conflict") return error.message;
      if (error.code === "network_error") return error.message;
      return error.message;
    }
    return "Something went wrong. Please try again.";
  };

  const onLogin = loginForm.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const user = await login(values);
      toast.success(`Welcome back, ${user.name.split(" ")[0]}`);
      navigate(user.onboardingCompleted ? (from ?? "/dashboard") : "/onboarding", { replace: true });
    } catch (error) {
      const message = describeError(error);
      setSubmitError(message);
      toast.error(message);
    }
  });

  const onSignup = signupForm.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await signup(values);
      toast.success("Account created");
      navigate("/onboarding", { replace: true });
    } catch (error) {
      const message = describeError(error);
      setSubmitError(message);
      // A 409 means the email is taken; surfacing it on the field is more
      // useful than a generic banner.
      if (error instanceof ApiClientError && error.code === "conflict") {
        signupForm.setError("email", { message });
      }
      toast.error(message);
    }
  });

  const submitting = loginForm.formState.isSubmitting || signupForm.formState.isSubmitting;

  return (
    <div className="gradient-hero flex min-h-screen flex-col">
      <Seo
        title={mode === "login" ? "Sign in" : "Create your free account"}
        description="Sign in to Affiliate Hub, or create a free account to start earning commission promoting products to your audience."
        path="/auth"
        robots="noindex, nofollow"
        jsonLd={[organizationSchema, websiteSchema]}
      />

      <header className="px-6 pt-8">
        <Link to="/" className="inline-flex items-center gap-2" aria-label="Affiliate Hub home">
          <span className="gradient-primary flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold text-primary-foreground">
            A
          </span>
          <span className="font-display text-xl font-bold text-foreground">Affiliate Hub</span>
        </Link>
      </header>

      <main id="main-content" className="flex flex-1 flex-col justify-center px-6 py-8">
        <div className="mx-auto w-full max-w-sm">
          <h1 className="font-display text-3xl font-bold text-foreground">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {mode === "login"
              ? "Sign in to manage your links and earnings."
              : "Free to join. Start promoting in under a minute."}
          </p>

          {/* Mode switch. Implemented as a tablist so screen readers announce
              the two states instead of two unlabelled buttons. */}
          <div
            role="tablist"
            aria-label="Sign in or create an account"
            className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1"
          >
            {(["login", "signup"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                onClick={() => switchMode(value)}
                className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                  mode === value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {value === "login" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>

          {submitError && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {submitError}
            </div>
          )}

          {mode === "login" ? (
            <form className="mt-6 space-y-4" onSubmit={onLogin} noValidate>
              <CustomInput
                id="login-email"
                label="Email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                error={loginForm.formState.errors.email?.message}
                {...loginForm.register("email")}
              />
              <CustomInput
                id="login-password"
                label="Password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Your password"
                error={loginForm.formState.errors.password?.message}
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="p-1 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
                {...loginForm.register("password")}
              />

              <Button
                type="submit"
                disabled={submitting}
                className="gradient-primary h-12 w-full rounded-xl font-semibold text-primary-foreground shadow-glow"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={onSignup} noValidate>
              <CustomInput
                id="signup-name"
                label="Full name"
                autoComplete="name"
                placeholder="Chinedu Nwankwo"
                error={signupForm.formState.errors.name?.message}
                {...signupForm.register("name")}
              />
              <CustomInput
                id="signup-email"
                label="Email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                error={signupForm.formState.errors.email?.message}
                {...signupForm.register("email")}
              />
              <CustomInput
                id="signup-password"
                label="Password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder={`At least ${PASSWORD_MIN} characters`}
                hint="Include at least one letter and one number."
                error={signupForm.formState.errors.password?.message}
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="p-1 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
                {...signupForm.register("password")}
              />

              <Button
                type="submit"
                disabled={submitting}
                className="gradient-primary h-12 w-full rounded-xl font-semibold text-primary-foreground shadow-glow"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account…
                  </>
                ) : (
                  <>
                    Create account <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          )}
        </div>
      </main>

      <footer className="px-6 pb-8 text-center">
        <p className="text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <Link to="/terms" className="text-primary hover:underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </footer>
    </div>
  );
};

export default AuthPage;
