/**
 * Frontend runtime configuration.
 *
 * Every value is read from `import.meta.env` with a safe default, so a missing
 * variable degrades gracefully instead of rendering `undefined` into a URL.
 *
 * `VITE_API_BASE_URL` defaults to the relative path `/api/v1`:
 *  - in `npm run dev`, Vite proxies `/api` to the local Worker (see
 *    vite.config.ts), so the browser never talks to a hardcoded localhost;
 *  - in production, the API is reached on the same origin via a rewrite, which
 *    avoids a cross-origin CORS dependency entirely.
 *
 * Only set this to an absolute URL when the API genuinely lives on a different
 * domain, and add that origin to the Worker's `ALLOWED_ORIGINS`.
 */

function env(key: string, fallback: string): string {
  const value = (import.meta.env as Record<string, string | undefined>)[key];
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

export const config = {
  apiBaseUrl: env('VITE_API_BASE_URL', '/api/v1'),

  /** Absolute origin used to build canonical URLs, sitemap entries and OG tags. */
  siteUrl: env('VITE_SITE_URL', 'https://affiliate-hub.vercel.app'),

  siteName: 'Affiliate Hub',
  /** Twitter/X handle for the `twitter:site` meta tag. */
  twitterHandle: env('VITE_TWITTER_HANDLE', ''),

  /**
   * Google AdSense publisher id.
   *
   * Deliberately empty by default: the prototype hardcoded a publisher id in
   * index.html, which meant every fork and preview deployment served someone
   * else's ads. Ads render only when this is configured, which also keeps
   * development and test runs free of third-party scripts.
   */
  adSenseClient: env('VITE_ADSENSE_CLIENT', ''),

  /** AdSense slot. One slot is correct unless distinct units are created. */
  adSenseSlot: env('VITE_ADSENSE_SLOT', ''),

  /** Support contact for the WhatsApp deep link. E.164, no '+'. */
  supportWhatsapp: env('VITE_SUPPORT_WHATSAPP', '2348012345678'),
  supportEmail: env('VITE_SUPPORT_EMAIL', 'support@affiliatehub.test'),

  /**
   * Legal and privacy contacts.
   *
   * These exist because the pages previously hardcoded three different
   * addresses on two different domains — `support@affiliatehub.ng` on the
   * landing page while config defaulted to `support@affiliatehub.test`. A
   * visitor could not tell which address was real, and setting
   * `VITE_SUPPORT_EMAIL` changed the config without changing what the pages
   * displayed. Every published address now comes from here.
   */
  privacyEmail: env('VITE_PRIVACY_EMAIL', 'privacy@affiliatehub.test'),
  legalEmail: env('VITE_LEGAL_EMAIL', 'legal@affiliatehub.test'),

  /** Milliseconds a request may take before the client gives up. */
  requestTimeoutMs: Number(env('VITE_API_TIMEOUT_MS', '15000')),
} as const;

export type AppConfig = typeof config;

/** True when ads are configured and should render. */
export const adsEnabled = (): boolean =>
  config.adSenseClient.length > 0 && config.adSenseSlot.length > 0;

/* ── Convenience aliases ────────────────────────────────────────────────────
   Pages read these directly rather than reaching through the config object.
   They are derived from the same env-driven values, so there is still exactly
   one place that decides them. */

/** Company name used in the footer, structured data and OG tags. */
export const COMPANY_NAME: string = config.siteName;

/** Support email, shown on the contact and help pages. */
export const SUPPORT_EMAIL: string = config.supportEmail;

/** Support WhatsApp in E.164 form with a leading '+', ready for a deep link. */
export const SUPPORT_WHATSAPP: string = `+${config.supportWhatsapp}`;

/** Privacy contact, shown on the privacy policy. */
export const PRIVACY_EMAIL: string = config.privacyEmail;

/** Legal contact, shown in the terms of service. */
export const LEGAL_EMAIL: string = config.legalEmail;
