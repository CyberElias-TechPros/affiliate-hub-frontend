/**
 * Type declarations for generate-sitemap.mjs.
 *
 * The generator is plain JavaScript so it can run under `node` without a build
 * step, but `test/seo-artifacts.test.ts` imports its route lists to assert they
 * still match the route guards in src/App.tsx. Without these declarations that
 * import is implicitly `any`, which defeats the point of the assertions — the
 * test would typecheck even if the constants changed shape.
 */

/** A public, indexable route listed in the sitemap. */
export interface SitemapRoute {
  /** Site-relative path, e.g. "/about". */
  path: string;
  changefreq: string;
  priority: string;
}

/** Routes in the sitemap. Must stay in sync with the public routes in App.tsx. */
export const ROUTES: SitemapRoute[];

/**
 * Route prefixes a crawler must never index.
 *
 * Every route behind ProtectedRoute or GuestRoute must appear here, or a crawler
 * fetches an empty shell behind the guard and indexes thin duplicate content.
 */
export const DISALLOWED: string[];

/**
 * Origin used when VITE_SITE_URL is unset.
 *
 * Must equal the default in src/lib/config.ts, because Seo.tsx builds canonical
 * URLs from that default. `test/seo-artifacts.test.ts` asserts the two agree.
 */
export const DEFAULT_SITE_URL: string;
