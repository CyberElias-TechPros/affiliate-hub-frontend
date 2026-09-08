import * as React from 'react';
import { config } from '@/lib/config';

/**
 * Head management for a client-rendered SPA.
 *
 * Why a hand-rolled hook rather than a dependency: it is ~80 lines, needs no
 * runtime beyond the DOM, and — critically — it removes stale tags on unmount.
 * The alternative (appending tags without cleanup) is how an SPA ends up with
 * the previous page's `og:title` still in the document.
 *
 * Everything here is also pre-rendered statically for crawlers by
 * `scripts/prerender.ts`, because Google renders JavaScript but many social
 * crawlers (WhatsApp, Twitter, iMessage) do not. A link shared to WhatsApp
 * must still produce a preview card.
 */

export interface SeoProps {
  title: string;
  description: string;
  /** Absolute path, e.g. "/how-it-works". */
  path: string;
  /** 'noindex, nofollow' for app/auth screens that must not be indexed. */
  robots?: string;
  image?: string;
  /** JSON-LD structured data. Only use types that genuinely apply. */
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
  type?: 'website' | 'article';
}

function absolute(path: string): string {
  const base = config.siteUrl.replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function setTitle(value: string) {
  document.title = value;
}

/** Set — or remove when empty — a `<meta name=...>` tag. */
function setMeta(selector: string, create: () => HTMLMetaElement, content: string | undefined) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!content) {
    element?.remove();
    return;
  }
  if (!element) {
    element = create();
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function setLink(rel: string, href: string | undefined) {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!href) {
    element?.remove();
    return;
  }
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

/** Remove any JSON-LD left behind by the previous route. */
function clearJsonLd() {
  document.head.querySelectorAll('script[type="application/ld+json"][data-seo]').forEach((n) => n.remove());
}

export const Seo: React.FC<SeoProps> = ({
  title,
  description,
  path,
  robots,
  image,
  jsonLd,
  type = 'website',
}) => {
  const fullTitle = title === config.siteName ? title : `${title} | ${config.siteName}`;
  const canonical = absolute(path);
  const socialImage = image ? absolute(image) : absolute('/og-image.png');

  React.useEffect(() => {
    setTitle(fullTitle);

    setMeta('meta[name="description"]', () => {
      const el = document.createElement('meta');
      el.setAttribute('name', 'description');
      return el;
    }, description);

    setMeta('meta[name="robots"]', () => {
      const el = document.createElement('meta');
      el.setAttribute('name', 'robots');
      return el;
    }, robots);

    setLink('canonical', canonical);

    const og: Array<[string, string | undefined]> = [
      ['og:title', fullTitle],
      ['og:description', description],
      ['og:url', canonical],
      ['og:type', type],
      ['og:image', socialImage],
      ['og:site_name', config.siteName],
      ['og:locale', 'en_NG'],
    ];
    for (const [property, content] of og) {
      setMeta(`meta[property="${property}"]`, () => {
        const el = document.createElement('meta');
        el.setAttribute('property', property);
        return el;
      }, content);
    }

    const twitter: Array<[string, string | undefined]> = [
      ['twitter:card', 'summary_large_image'],
      ['twitter:title', fullTitle],
      ['twitter:description', description],
      ['twitter:image', socialImage],
    ];
    if (config.twitterHandle) twitter.push(['twitter:site', config.twitterHandle]);
    for (const [name, content] of twitter) {
      setMeta(`meta[name="${name}"]`, () => {
        const el = document.createElement('meta');
        el.setAttribute('name', name);
        return el;
      }, content);
    }

    clearJsonLd();
    if (jsonLd) {
      const blocks = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      for (const block of blocks) {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.setAttribute('data-seo', 'true');
        script.textContent = JSON.stringify(block);
        document.head.appendChild(script);
      }
    }

    return () => {
      clearJsonLd();
    };
  }, [fullTitle, description, canonical, socialImage, robots, type, jsonLd]);

  return null;
};

/* ------------------------- reusable structured data ------------------------ */

export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Affiliate Hub',
  url: config.siteUrl,
  description:
    'Affiliate Hub is a Nigeria-first affiliate marketing platform where creators earn commission promoting products and withdraw to a Nigerian bank, PayPal or USDT.',
  areaServed: { '@type': 'Country', name: 'Nigeria' },
  logo: absolute('/icon-512.png'),
};

export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Affiliate Hub',
  url: config.siteUrl,
  inLanguage: 'en-NG',
  publisher: { '@type': 'Organization', name: 'Affiliate Hub' },
};

/**
 * Breadcrumb trail for sub-pages.
 *
 * Kept in sync with the visible breadcrumb on the page — structured data that
 * describes navigation the user cannot see is a guideline violation.
 */
export function breadcrumbSchema(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absolute(item.path),
    })),
  };
}

/**
 * FAQ markup for the help page.
 *
 * Built from the same FAQ records the page renders, so the markup can never
 * claim content that is not on the page.
 */
export function faqSchema(items: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export { absolute as absoluteUrl };
