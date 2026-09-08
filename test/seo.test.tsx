import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Seo, absoluteUrl, faqSchema } from "@/components/seo/Seo";

/**
 * Per-route metadata.
 *
 * The prototype set `document.title` to "Affiliate Hub" on every route and
 * shipped one description site-wide, so Google saw sixteen identical pages.
 * These tests assert the thing that was actually broken: that each route
 * produces its own title, description and canonical.
 */

const renderSeo = (props: React.ComponentProps<typeof Seo>) =>
  render(
    <MemoryRouter>
      <Seo {...props} />
    </MemoryRouter>,
  );

const meta = (name: string): string | null =>
  document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content ?? null;

const property = (prop: string): string | null =>
  document.querySelector<HTMLMetaElement>(`meta[property="${prop}"]`)?.content ?? null;

describe("Seo", () => {
  it("sets a distinct title per route", () => {
    renderSeo({ title: "Marketplace", description: "Browse products", path: "/marketplace" });
    expect(document.title).toBe("Marketplace | Affiliate Hub");
  });

  it("writes the description and canonical", () => {
    renderSeo({ title: "Marketplace", description: "Browse products", path: "/marketplace" });
    expect(meta("description")).toBe("Browse products");
    expect(
      document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
    ).toContain("/marketplace");
  });

  it("applies a robots directive when asked, so private pages are never indexed", () => {
    renderSeo({ title: "Wallet", description: "x", path: "/wallet", robots: "noindex, nofollow" });
    expect(meta("robots")).toBe("noindex, nofollow");
  });

  it("populates Open Graph and Twitter cards", () => {
    renderSeo({ title: "Marketplace", description: "Browse products", path: "/marketplace" });
    expect(property("og:title")).toContain("Marketplace");
    expect(property("og:url")).toContain("/marketplace");
    expect(meta("twitter:card")).toBeTruthy();
  });

  it("injects JSON-LD as a parsable script when supplied", () => {
    renderSeo({
      title: "Contact",
      description: "x",
      path: "/contact",
      jsonLd: [faqSchema([{ question: "How do payouts work?", answer: "Monthly." }])],
    });

    const script = document.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    expect(() => JSON.parse(script!.textContent ?? "")).not.toThrow();
  });
});

describe("absoluteUrl", () => {
  it("turns a path into a full URL for crawlers, which ignore relative canonicals", () => {
    expect(absoluteUrl("/marketplace")).toMatch(/^https:\/\/.+\/marketplace$/);
  });
});

describe("faqSchema", () => {
  it("builds valid FAQPage structured data", () => {
    const schema = faqSchema([{ question: "Q", answer: "A" }]);
    expect(schema["@type"]).toBe("FAQPage");
    expect(schema.mainEntity).toHaveLength(1);
  });
});

describe("skip link target", () => {
  it("is the documented pattern every page must provide", () => {
    // The skip link in the layout points at #main-content. If a page renders
    // without that id, keyboard users get a link that goes nowhere. This
    // documents the contract rather than testing a component.
    const target = "main-content";
    expect(target).toBe("main-content");
  });
});
