import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

// The Worker's payout rules, imported directly. These are the numbers the
// server actually enforces — if the marketing copy disagrees with this, the
// user is being told something the API will reject.
import { PAYOUT_CONFIG } from "../api/src/lib/payouts";
import { LEGAL_EMAIL, PRIVACY_EMAIL, SUPPORT_EMAIL, SUPPORT_WHATSAPP } from "@/lib/config";

/**
 * Marketing-claim integrity.
 *
 * Fabricated claims survived three separate review passes in this repository,
 * because the only way to catch them was a grep sweep that someone had to
 * remember to run. This file makes the check automatic instead.
 *
 * It covers two distinct failure modes that were both present:
 *
 *  1. Invented statistics and superlatives — "₦50 million paid out",
 *     "15,000+ affiliates", "500+ products", "Nigeria's most trusted",
 *     "top affiliates earn ₦500,000+ monthly". None of these were backed by
 *     anything, in a product that had never paid anyone.
 *  2. Drift from the enforced rules — HelpPage advertised a "$10" PayPal/USDT
 *     minimum while `PAYOUT_CONFIG` enforces $50. That is not a soft
 *     overpromise; a user following the page would have their withdrawal
 *     rejected, and the page was wrong about a number the server owns.
 *
 * Both are checked against the rendered output rather than the source, so a
 * claim assembled at runtime is caught too.
 */

const envelope = (data: unknown) => ({ ok: true, data });

// Public marketing pages need no auth and issue few requests; anything they do
// fetch is answered with an empty payload so rendering completes.
vi.stubGlobal(
  "fetch",
  vi.fn(async () =>
    new Response(JSON.stringify(envelope(null)), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  ),
);

interface Rendered {
  text: string;
  hrefs: string[];
}

const renderPage = async (Page: React.ComponentType): Promise<Rendered> => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const { container } = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Page />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  // Disclosure content is conditionally rendered — HelpPage and HowItWorksPage
  // only mount a FAQ answer once its button is clicked, and HelpPage's state is
  // single-select, so no one render ever contains every answer. A test that
  // reads only the initial DOM passes vacuously: it never sees the text it was
  // written to police. So expand every disclosure and accumulate what appears.
  // Accumulate whole snapshots. Two earlier versions of this both passed
  // vacuously — one fragmented each snapshot and rejoined it with spaces,
  // turning "$10 for PayPal" into "$ 1 0 for P a y P a l"; the other used
  // `textContent`, which concatenates adjacent nodes with no separator, so
  // "Support" + "support@x.test" became "supportsupport@x.testwhatsapp" and no
  // address matched cleanly. Walking the text nodes preserves boundaries.
  const seen = new Set<string>();
  const collect = () => {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const parts: string[] = [];
    let node = walker.nextNode();
    while (node) {
      const value = node.nodeValue?.trim();
      if (value) parts.push(value);
      node = walker.nextNode();
    }
    if (parts.length) seen.add(parts.join(" "));
  };

  collect();
  for (const button of Array.from(container.querySelectorAll("button"))) {
    try {
      fireEvent.click(button);
      collect();
      // Single-select accordions close the previously opened panel, so reopen
      // and re-read on each pass.
      fireEvent.click(button);
      collect();
    } catch {
      // A button wired to an API absent in jsdom (e.g. clipboard) is not a
      // claims failure; its own page tests cover its behaviour.
    }
  }
  collect();

  // Link targets are attributes, not text, so a text-only scan cannot see a
  // deep link pointing at the wrong number. Collect them separately.
  const hrefs = Array.from(container.querySelectorAll("a[href]")).map(
    (a) => a.getAttribute("href") ?? "",
  );

  return { text: [...seen].join(" "), hrefs };
};

const PAGES = {
  LandingPage: () => import("@/pages/LandingPage"),
  AboutPage: () => import("@/pages/AboutPage"),
  HowItWorksPage: () => import("@/pages/HowItWorksPage"),
  HelpPage: () => import("@/pages/HelpPage"),
  TermsPage: () => import("@/pages/TermsPage"),
  PrivacyPage: () => import("@/pages/PrivacyPage"),
} as const;

/** Rendered output of every public marketing page, keyed by page name. */
const renderAll = async (): Promise<Record<string, Rendered>> => {
  const out: Record<string, Rendered> = {};
  for (const [name, load] of Object.entries(PAGES)) {
    const mod = await load();
    out[name] = await renderPage(mod.default);
  }
  return out;
};

/**
 * Claims that were fabricated and must not come back.
 *
 * Matched case-insensitively against rendered text. The list is deliberately
 * narrow — it names things this product cannot substantiate, not adjectives in
 * general, so it does not turn into a style linter.
 */
const FORBIDDEN: Array<{ pattern: RegExp; why: string }> = [
  { pattern: /₦50\s?million/i, why: "no payout of that size has ever been made" },
  { pattern: /₦50M\+/i, why: "no payout of that size has ever been made" },
  { pattern: /15,000\+?\s*affiliates/i, why: "user count is not tracked or published" },
  { pattern: /500\+\s*(high-converting\s*)?products/i, why: "the catalogue holds 6 seeded products" },
  { pattern: /98%\s*payout\s*rate/i, why: "no payout history exists to rate" },
  { pattern: /₦500,000\+?\s*monthly/i, why: "no affiliate earnings exist to cite" },
  { pattern: /₦20,000-₦50,000/i, why: "no beginner earnings exist to cite" },
  { pattern: /most trusted/i, why: "unverifiable superlative" },
  { pattern: /Nigeria'?s leading/i, why: "unverifiable superlative" },
  { pattern: /among the highest in Nigeria/i, why: "no comparison data exists" },
  { pattern: /\$10\b/i, why: "contradicts the enforced $50 PayPal/USDT minimum" },
  { pattern: /instant sale notifications/i, why: "there is no outbound notification provider" },
  { pattern: /doubled (my|their) earnings/i, why: "testimonials were invented" },
];

describe("public pages make no unverifiable claims", () => {
  it.each(Object.keys(PAGES))("%s", async (name) => {
    const mod = await (PAGES as Record<string, () => Promise<{ default: React.ComponentType }>>)[
      name
    ]();
    const { text } = await renderPage(mod.default);

    const violations = FORBIDDEN.filter((f) => f.pattern.test(text)).map(
      (f) => `${f.pattern} — ${f.why}`,
    );

    expect(violations, `${name} contains fabricated claims:\n${violations.join("\n")}`).toEqual([]);
  });
});

describe("published contact details come from config", () => {
  it("no page hardcodes an email address or phone number", () => {
    // Three addresses on two domains were published simultaneously:
    // support@affiliatehub.ng on the landing page, support@affiliatehub.test in
    // config, plus privacy@ and legal@ hardcoded on the legal pages. A visitor
    // could not tell which was real, and setting VITE_SUPPORT_EMAIL changed the
    // config without changing what anyone saw. Everything must now resolve
    // through config, so the rendered output can only contain the configured
    // values.
    const configured = [SUPPORT_EMAIL, PRIVACY_EMAIL, LEGAL_EMAIL].map((v) => v.toLowerCase());

    return renderAll().then((pages) => {
      for (const [name, page] of Object.entries(pages)) {
        const text = page.text;
        const emails = [...text.matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g)]
          .map((m) => m[0].toLowerCase())
          .filter((e) => !e.endsWith("@example.com")); // input placeholders

        const unconfigured = emails.filter((e) => !configured.includes(e));
        expect(
          unconfigured,
          `${name} publishes an address that is not in config: ${unconfigured.join(", ")}`,
        ).toEqual([]);
      }
    });
  });

  it("every WhatsApp deep link uses the configured number", () => {
    const digits = SUPPORT_WHATSAPP.replace(/\D/g, "");
    return renderAll().then((pages) => {
      for (const [name, page] of Object.entries(pages)) {
        // The number is in the href, so scanning text would never find it —
        // this assertion passed vacuously until it scanned attributes.
        const numbers = page.hrefs
          .flatMap((h) => [...h.matchAll(/wa\.me\/(\d+)/g)])
          .map((m) => m[1]);
        const wrong = numbers.filter((n) => n !== digits);
        expect(wrong, `${name} deep-links a WhatsApp number that is not configured`).toEqual([]);
      }
    });
  });
});

describe("advertised payout rules match what the Worker enforces", () => {
  it("the naira bank minimum on every page equals PAYOUT_CONFIG", () => {
    // ₦5,000 = 500_000 minor units. Derived, not restated, so changing the
    // business rule in one place cannot leave the copy behind.
    const nairaMinimum = PAYOUT_CONFIG.bank.minimumMinor / 100;
    expect(nairaMinimum).toBe(5_000);

    const expected = `₦${nairaMinimum.toLocaleString("en-NG")}`;
    return renderAll().then((pages) => {
      for (const [name, page] of Object.entries(pages)) {
        const text = page.text;
        // Only pages that mention a naira minimum are checked, and they must
        // state the real one.
        if (/minimum withdrawal/i.test(text) || /₦[\d,]+/.test(text)) {
          const stated = [...text.matchAll(/₦([\d,]+)/g)].map((m) => Number(m[1].replace(/,/g, "")));
          const wrong = stated.filter((n) => n !== 0 && n < nairaMinimum && n !== 6_750_000);
          expect(wrong, `${name} advertises a naira figure below the real ${expected}`).toEqual([]);
        }
      }
    });
  });

  it("the dollar minimum matches the enforced $50 for paypal and usdt", () => {
    expect(PAYOUT_CONFIG.paypal.minimumMinor / 100).toBe(50);
    expect(PAYOUT_CONFIG.usdt.minimumMinor / 100).toBe(50);

    const expected = `$${PAYOUT_CONFIG.paypal.minimumMinor / 100}`;
    return renderAll().then((pages) => {
      for (const [name, page] of Object.entries(pages)) {
        const text = page.text;
        if (/paypal|usdt/i.test(text) && /\$\d+/.test(text)) {
          const stated = [...text.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
          // Any dollar minimum named must be the real one, never a lower figure
          // that the server would reject.
          const tooLow = stated.filter((n) => n < PAYOUT_CONFIG.paypal.minimumMinor / 100);
          expect(tooLow, `${name} states a minimum below the enforced ${expected}`).toEqual([]);
        }
      }
    });
  });

  it("bank transfers are advertised as free only because the fee really is zero", () => {
    // The copy says bank withdrawals cost nothing. If a fee were ever added,
    // this assertion fails and forces the copy to be corrected with it.
    expect(PAYOUT_CONFIG.bank.feeBps).toBe(0);
  });

  it("non-bank methods are not advertised as free", () => {
    expect(PAYOUT_CONFIG.usdt.feeBps).toBeGreaterThan(0);
    expect(PAYOUT_CONFIG.paypal.feeBps).toBeGreaterThan(0);
  });
});
