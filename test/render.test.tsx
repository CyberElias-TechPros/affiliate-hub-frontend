import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { Toaster } from "sonner";

/**
 * Render smoke tests.
 *
 * Every other frontend test renders a component in isolation. None of them prove
 * the app *mounts*: `npm run build` succeeding only means the module graph
 * resolves and the types line up, not that a component tree without a crash.
 * A missing provider, a hook called outside its context, or an undefined import
 * all compile and build cleanly, then throw on first paint in front of a user.
 *
 * So these render real pages inside the real provider stack and assert they
 * reach a known piece of text. Queries are stubbed at the fetch boundary rather
 * than mocked at the component boundary, so the data-loading paths run too.
 */

const envelope = (data: unknown) => ({ ok: true, data });

const stubFetchFor = (routes: Record<string, unknown>) => {
  // Longest fragment first, so "/profile/goal" is not shadowed by "/profile".
  // Without this the goal query silently received the user payload, which is
  // what produced the crash this file was written to catch.
  const ordered = Object.entries(routes).sort((a, b) => b[0].length - a[0].length);

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      for (const [fragment, payload] of ordered) {
        if (url.includes(fragment)) {
          return new Response(JSON.stringify(envelope(payload)), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
      }
      return new Response(JSON.stringify({ ok: true, data: null }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
};

const DEMO_USER = {
  id: "u1",
  name: "Chinedu Nwankwo",
  email: "demo@affiliatehub.test",
  whatsapp: null,
  country: "NG",
  referralCode: "DEMO1",
  tier: "pro",
  onboardingCompleted: true,
  niches: ["tech"],
  createdAt: "2026-01-01T00:00:00.000Z",
};

const WALLET_SUMMARY = {
  available: { amountMinor: 6_750_000, currency: "NGN" },
  pending: { amountMinor: 0, currency: "NGN" },
  availableSecondary: { amountMinor: 4500, currency: "USD" },
  lifetimeEarnings: { amountMinor: 6_750_000, currency: "NGN" },
  fxRate: { rateScaled: 667, base: "NGN", quote: "USD", source: "bootstrap", asOf: "2026-01-01" },
};

const STATS = {
  clicks: 427,
  conversions: 1,
  conversionRateBps: 23,
  earnings: { amountMinor: 6_750_000, currency: "NGN" },
  activeLinks: 1,
  series: [{ date: "2026-01-01", clicks: 40, conversions: 0, earningsMinor: 0 }],
  topProducts: [],
  goal: { targetMinor: 50_000_000, progressMinor: 6_750_000, currency: "NGN" },
};

/** Render a page inside the same providers App.tsx uses. */
const renderPage = async (path: string, Page: React.ComponentType, initialEntries = [path]) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const { AuthProvider } = await import("@/contexts/AuthContext");
  const { AdProvider } = await import("@/contexts/AdContext");

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <AuthProvider>
          <AdProvider>
            <Page />
            <Toaster />
          </AdProvider>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("app mounts", () => {
  it("renders the landing page with its real headline", async () => {
    stubFetchFor({ "/faqs": { items: [] } });
    const { default: LandingPage } = await import("@/pages/LandingPage");
    await renderPage("/", LandingPage);
    // The fabricated "Nigeria's #1 Affiliate Platform" badge was replaced.
    expect(await screen.findByText(/Turn Your Audience Into/i)).toBeInTheDocument();
    expect(screen.queryByText(/Nigeria's #1/i)).not.toBeInTheDocument();
  });

  it("renders the wallet from API data rather than a hardcoded balance", async () => {
    stubFetchFor({
      "/wallet/summary": WALLET_SUMMARY,
      "/wallet/transactions": { items: [], totalItems: 0, page: 1, pageSize: 10, totalPages: 0 },
      "/auth/me": { user: DEMO_USER },
    });
    const { default: WalletPage } = await import("@/pages/WalletPage");
    await renderPage("/wallet", WalletPage);

    // ₦67,500.00 is the seeded balance, and it appears twice by design: the
    // available card and the lifetime-earnings line. The prototype hardcoded
    // ₦472,500 in both places.
    const balances = await screen.findAllByText("₦67,500.00");
    expect(balances.length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/472,500/)).not.toBeInTheDocument();
  });

  it("renders the stats page from the API series", async () => {
    stubFetchFor({
      "/stats/dashboard": STATS,
      "/stats/leaderboard": { entries: [] },
      "/auth/me": { user: DEMO_USER },
    });
    const { default: StatsPage } = await import("@/pages/StatsPage");
    await renderPage("/stats", StatsPage);

    expect(await screen.findByText("427")).toBeInTheDocument();
    expect(screen.getByText("Conversions")).toBeInTheDocument();
  });

  it("renders the profile with the session name, not a hardcoded one", async () => {
    // AuthProvider only calls /auth/me when a token is present — correctly, since
    // an anonymous visitor has no session to load. Seed one so the user resolves.
    const { tokenStore } = await import("@/lib/api");
    tokenStore.set({ accessToken: "test-access", refreshToken: "test-refresh" });

    stubFetchFor({
      "/auth/me": { user: DEMO_USER },
      "/profile": { user: DEMO_USER, bank: null },
      "/profile/goal": null,
      "/notifications": { items: [], totalItems: 0, page: 1, pageSize: 20, totalPages: 0, unreadCount: 0 },
    });
    const { default: ProfilePage } = await import("@/pages/ProfilePage");
    await renderPage("/profile", ProfilePage);

    expect(await screen.findByText("Chinedu Nwankwo")).toBeInTheDocument();
    tokenStore.clear();
  });

  it("renders the marketplace and shows a product from the API", async () => {
    stubFetchFor({
      "/products/categories": [{ category: "education", count: 1 }],
      "/products": {
        items: [
          {
            id: "p1",
            slug: "forex-mastery-course",
            title: "Forex Mastery",
            summary: "A course",
            category: "education",
            price: { amountMinor: 15_000_000, currency: "NGN" },
            commissionBps: 4500,
            commissionAmount: { amountMinor: 6_750_000, currency: "NGN" },
            merchant: "Naira Traders Academy",
            imageUrl: null,
            rating: 0,
            totalPromotions: 0,
          },
        ],
        totalItems: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      },
      "/auth/me": { user: DEMO_USER },
    });
    const { default: MarketplacePage } = await import("@/pages/MarketplacePage");
    await renderPage("/marketplace", MarketplacePage);

    expect(await screen.findByText("Forex Mastery")).toBeInTheDocument();
  });

  it("renders the 404 without logging to the console", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { default: NotFound } = await import("@/pages/NotFound");
    await renderPage("/no-such-route", NotFound);

    expect(await screen.findByText(/We can't find that page/i)).toBeInTheDocument();
    // The prototype console.error'd a stack trace into every visitor's devtools.
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("error boundary", () => {
  /**
   * A blank page is the worst failure mode for a money app, and before this
   * existed any throw during render unmounted the entire tree. This proves the
   * boundary catches, keeps something actionable on screen, and does not
   * swallow the error from reporters.
   */
  const Boom = () => {
    throw new Error("malformed API field");
  };

  it("renders a recovery UI instead of a blank screen", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { ErrorBoundary } = await import("@/components/routing/ErrorBoundary");

    render(
      <ErrorBoundary name="test">
        <Boom />
      </ErrorBoundary>,
    );

    expect(await screen.findByText(/Something went wrong on this page/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    // Caught, not hidden — it must still reach error reporting.
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("renders its children when nothing throws", async () => {
    const { ErrorBoundary } = await import("@/components/routing/ErrorBoundary");
    render(
      <ErrorBoundary name="test">
        <p>page content</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("page content")).toBeInTheDocument();
  });
});
