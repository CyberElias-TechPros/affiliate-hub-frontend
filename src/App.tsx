import * as React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute, GuestRoute } from "@/components/routing/ProtectedRoute";
import { ScrollToTop } from "@/components/routing/ScrollToTop";
import { SkipLink } from "@/components/layout/SkipLink";
import { AdProvider } from "@/contexts/AdContext";

/**
 * Route-level code splitting.
 *
 * The prototype shipped a single 520 kB (157 kB gzipped) bundle: every page,
 * plus recharts, react-hook-form, zod, embla and the entire shadcn kit, was
 * downloaded before the landing page could render. For a product aimed at
 * users on metered mobile data that is the single most expensive mistake in
 * the frontend.
 *
 * Public marketing pages stay eager — they are what a first-time visitor and
 * every crawler lands on, so they must not wait on a second round trip. The
 * authenticated app is lazy: none of it is needed until someone signs in.
 */
const LandingPage = React.lazy(() => import("./pages/LandingPage"));
const AboutPage = React.lazy(() => import("./pages/AboutPage"));
const HowItWorksPage = React.lazy(() => import("./pages/HowItWorksPage"));
const ContactPage = React.lazy(() => import("./pages/ContactPage"));
const TermsPage = React.lazy(() => import("./pages/TermsPage"));
const PrivacyPage = React.lazy(() => import("./pages/PrivacyPage"));
const HelpPage = React.lazy(() => import("./pages/HelpPage"));
const AuthPage = React.lazy(() => import("./pages/AuthPage"));
const OnboardingPage = React.lazy(() => import("./pages/OnboardingPage"));
const DashboardPage = React.lazy(() => import("./pages/DashboardPage"));
const MarketplacePage = React.lazy(() => import("./pages/MarketplacePage"));
const ProductDetailPage = React.lazy(() => import("./pages/ProductDetailPage"));
const LinksPage = React.lazy(() => import("./pages/LinksPage"));
const WalletPage = React.lazy(() => import("./pages/WalletPage"));
const WithdrawPage = React.lazy(() => import("./pages/WithdrawPage"));
const StatsPage = React.lazy(() => import("./pages/StatsPage"));
const ProfilePage = React.lazy(() => import("./pages/ProfilePage"));
const SettingsPage = React.lazy(() => import("./pages/SettingsPage"));
const NotFound = React.lazy(() => import("./pages/NotFound"));

const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  </div>
);

/**
 * Query defaults.
 *
 * `retry: 1` rather than the default 3: on a metered connection three
 * automatic retries of a failing request is a poor trade. A 4xx is never
 * retried at all — retrying a validation error cannot succeed.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        const status = (error as { status?: number })?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});

const AppContent = () => (
  <TooltipProvider>
    <ScrollToTop />
    <SkipLink />
    <Toaster />
    <Sonner />
    <React.Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Public, indexable marketing pages */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />

        {/* Auth. GuestRoute bounces anyone already signed in. */}
        <Route
          path="/auth"
          element={
            <GuestRoute>
              <AuthPage />
            </GuestRoute>
          }
        />
        <Route
          path="/onboarding"
          element={
            <GuestRoute>
              <OnboardingPage />
            </GuestRoute>
          }
        />

        {/* Authenticated app. Each of these calls an endpoint that rejects an
            anonymous caller, so the guard is UX rather than the control. */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/marketplace"
          element={
            <ProtectedRoute>
              <MarketplacePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/:slug"
          element={
            <ProtectedRoute>
              <ProductDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/links"
          element={
            <ProtectedRoute>
              <LinksPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/wallet"
          element={
            <ProtectedRoute>
              <WalletPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/withdraw"
          element={
            <ProtectedRoute>
              <WithdrawPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/stats"
          element={
            <ProtectedRoute>
              <StatsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </React.Suspense>
  </TooltipProvider>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <AdProvider>
          <AppContent />
        </AdProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
