/**
 * Site configuration shared by the app, the build and the sitemap generator.
 *
 * Why this file exists
 * --------------------
 * The origin used to be hardcoded in five places: `index.html` (canonical,
 * og:url, og:image, twitter:image, two JSON-LD urls), `public/sitemap.xml`,
 * `public/robots.txt`, `src/lib/config.ts`, and `vercel.json`. They had already
 * drifted — nothing enforced agreement.
 *
 * These constants are the single source. `vite.config.ts` imports
 * DEFAULT_SITE_URL to fill in %VITE_SITE_URL% when `.env` is absent (which it is
 * on a fresh clone, since `.env` is gitignored); `generate-sitemap.mjs` imports
 * all three to emit the static artefacts; `test/seo-artifacts.test.ts` asserts
 * `src/lib/config.ts` agrees with this file and that the route lists match the
 * real route guards in `src/App.tsx`.
 *
 * This module must stay side-effect free and free of a shebang: `vite.config.ts`
 * imports it, and esbuild will not parse `#!` in an imported file.
 */

/**
 * Origin used when VITE_SITE_URL is unset.
 *
 * Must equal the default in `src/lib/config.ts`, because `Seo.tsx` builds
 * canonical URLs from that default. The test asserts the two agree.
 */
export const DEFAULT_SITE_URL = 'https://affiliate-hub.vercel.app';

/**
 * Public, indexable routes only.
 *
 * The authenticated app routes are deliberately absent: they render behind a
 * route guard, so a crawler would see an empty shell and index thin duplicate
 * content. They are also Disallow-ed in robots.txt — keep the two consistent.
 */
export const ROUTES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/how-it-works', changefreq: 'monthly', priority: '0.8' },
  { path: '/about', changefreq: 'monthly', priority: '0.7' },
  { path: '/contact', changefreq: 'yearly', priority: '0.6' },
  { path: '/help', changefreq: 'monthly', priority: '0.6' },
  { path: '/terms', changefreq: 'yearly', priority: '0.3' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
];

/**
 * Route prefixes a crawler must never index.
 *
 * Every route behind ProtectedRoute or GuestRoute must appear here, or a crawler
 * fetches an empty shell behind the guard and indexes thin duplicate content.
 */
export const DISALLOWED = [
  '/dashboard',
  '/marketplace',
  // Trailing slash matters: this is the /products/:slug detail route, which sits
  // behind ProtectedRoute, and a bare "/products" would not match its children.
  '/products/',
  '/links',
  '/wallet',
  '/withdraw',
  '/stats',
  '/profile',
  '/settings',
  '/onboarding',
  '/auth',
];
