import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// site-config.mjs is side-effect free, so importing it cannot rewrite public/.
import { DEFAULT_SITE_URL, DISALLOWED, ROUTES } from "../scripts/site-config.mjs";
import { config } from "@/lib/config";

/**
 * Sitemap and robots.txt integrity.
 *
 * `src/components/seo/Seo.tsx` derives every canonical from `config.siteUrl`,
 * but the static artefacts hardcoded a different origin. Setting `VITE_SITE_URL`
 * would have left the sitemap advertising a host that is not the site — worse
 * than no sitemap, because it actively sends crawlers somewhere else.
 *
 * While fixing that I dropped `Disallow: /products/` from robots.txt: the route
 * sits behind `ProtectedRoute`, so a crawler would have indexed empty shells.
 * Nothing caught it. These assertions parse the real route declarations so the
 * two lists cannot drift from the app again.
 */

const root = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");

interface DeclaredRoute {
  path: string;
  guarded: boolean;
}

/**
 * Parse <Route> declarations out of App.tsx.
 *
 * A route is "guarded" when its element is wrapped in ProtectedRoute or
 * GuestRoute. Reading the source rather than the router keeps this honest about
 * what is actually declared.
 */
const declaredRoutes = (): DeclaredRoute[] => {
  // App.tsx uses two shapes: a one-line `<Route path="/" element={<X />} />` for
  // public pages and a multi-line form for guarded ones. A regex anchored to one
  // shape silently matched nothing, which made every assertion below pass
  // vacuously — so split on `<Route` boundaries and inspect each chunk instead.
  return appSource
    .split(/<Route(?=\s|$)/)
    .slice(1)
    .map((chunk) => {
      const pathMatch = chunk.match(/path="([^"]+)"/);
      if (!pathMatch) return null;
      // Only the element of *this* route matters, so stop before any nested
      // <Route> (the catch-all and any future nesting).
      const scope = chunk.split(/<Route(?=\s|$)/)[0];
      return {
        path: pathMatch[1],
        guarded: /<(Protected|Guest)Route>/.test(scope),
      };
    })
    .filter((r): r is DeclaredRoute => r !== null);
};

/** Collapse a route pattern like "/products/:slug" to its robots.txt prefix. */
const toRobotsPrefix = (routePath: string): string => {
  const base = routePath.replace(/\/:[^/]+.*$/, "");
  // A dynamic segment means the prefix alone must carry a trailing slash, or the
  // rule matches the collection route rather than its children.
  return base !== routePath ? `${base}/` : base;
};

describe("sitemap and robots.txt match the real route tree", () => {
  it("the route parser finds every declared route", () => {
    const routes = declaredRoutes();
    // 7 public + 2 guest + 10 protected = 19 pages. If the parser's regex stops
    // matching after an edit to App.tsx, every assertion below passes vacuously,
    // so this one has to fail first.
    expect(routes.length).toBeGreaterThanOrEqual(19);
    expect(routes.map((r) => r.path)).toContain("/");
    expect(routes.map((r) => r.path)).toContain("/products/:slug");
  });

  it("every guarded route is disallowed from crawling", () => {
    const guarded = declaredRoutes()
      .filter((r) => r.guarded)
      .map((r) => toRobotsPrefix(r.path));

    const missing = guarded.filter((prefix) => !DISALLOWED.includes(prefix));
    expect(
      missing,
      `these guarded routes are indexable: ${missing.join(", ")} — a crawler would fetch an empty shell`,
    ).toEqual([]);
  });

  it("every public, static route is in the sitemap", () => {
    const publicStatic = declaredRoutes()
      // Exclude the "*" catch-all: it renders NotFound with noindex, and a
      // wildcard is not a URL anyone can be sent to.
      .filter((r) => !r.guarded && !r.path.includes(":") && r.path !== "*")
      .map((r) => r.path);

    const inSitemap = ROUTES.map((r) => r.path);
    const missing = publicStatic.filter((p) => !inSitemap.includes(p));
    expect(missing, `indexable pages missing from the sitemap: ${missing.join(", ")}`).toEqual([]);
  });

  it("the sitemap lists nothing that is not a real public route", () => {
    const publicPaths = new Set(
      declaredRoutes()
        .filter((r) => !r.guarded)
        .map((r) => r.path),
    );
    const bogus = ROUTES.map((r) => r.path).filter((p) => !publicPaths.has(p));
    expect(bogus, `the sitemap advertises routes that are not public: ${bogus.join(", ")}`).toEqual(
      [],
    );
  });

  it("the wildcard route is not listed", () => {
    // The 404 catch-all renders NotFound with noindex; listing it would put a
    // dead URL in the sitemap.
    expect(ROUTES.map((r) => r.path)).not.toContain("*");
  });
});

describe("the sitemap origin matches the app's configured origin", () => {
  it("the generator default equals the config default", () => {
    // Two hardcoded origins is what caused the drift. If either changes without
    // the other, canonicals and sitemap disagree about what the site is.
    expect(DEFAULT_SITE_URL).toBe(config.siteUrl);
  });

  it("the default is an absolute https URL with no trailing slash", () => {
    expect(new URL(DEFAULT_SITE_URL).protocol).toBe("https:");
    expect(DEFAULT_SITE_URL.endsWith("/")).toBe(false);
  });
});

describe("the committed artefacts are the generator's output", () => {
  it("public/sitemap.xml lists exactly the generated routes", () => {
    const xml = fs.readFileSync(path.join(root, "public/sitemap.xml"), "utf8");
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const expected = ROUTES.map((r) => `${DEFAULT_SITE_URL}${r.path}`);

    expect(locs).toEqual(expected);
  });

  it("public/robots.txt disallows exactly the generated rules", () => {
    const txt = fs.readFileSync(path.join(root, "public/robots.txt"), "utf8");
    const disallowed = [...txt.matchAll(/^Disallow: (.+)$/gm)].map((m) => m[1]);

    expect(disallowed).toEqual([...DISALLOWED, "/api/"]);
  });

  it("public/robots.txt points at the sitemap on the same origin", () => {
    const txt = fs.readFileSync(path.join(root, "public/robots.txt"), "utf8");
    expect(txt).toContain(`Sitemap: ${DEFAULT_SITE_URL}/sitemap.xml`);
  });

  it("no page hardcodes the origin any more", () => {
    const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
    // index.html must use Vite's %VITE_SITE_URL% substitution, or it pins a host
    // the deployment cannot change.
    expect(html).not.toContain(DEFAULT_SITE_URL);
    expect(html).toContain("%VITE_SITE_URL%");
  });
});
