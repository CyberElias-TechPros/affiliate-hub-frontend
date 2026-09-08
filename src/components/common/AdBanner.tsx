import * as React from 'react';
import { cn } from '@/lib/utils';
import { useAds } from '@/contexts/AdContext';

/**
 * AdSense unit.
 *
 * Renders nothing at all unless a publisher id and slot are configured, so
 * development, tests and any fork without AdSense credentials stay clean.
 *
 * Two deliberate omissions from the previous implementation:
 *  - No `InterstitialAd`. A full-screen ad on app launch is an AdSense policy
 *    problem and destroys the first-run experience.
 *  - No periodic refresh timer. Pushing new ad requests on an interval burns
 *    impressions and is a documented route to account limits.
 */

interface AdBannerProps {
  className?: string;
  format?: 'horizontal' | 'rectangle' | 'vertical' | 'auto';
  minHeight?: number;
}

/** Loads the AdSense script once, on first use, rather than on every page. */
let scriptPromise: Promise<void> | null = null;

function loadAdSense(client: string): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  if (document.querySelector('script[data-adsense-loader]')) {
    scriptPromise ??= Promise.resolve();
    return scriptPromise;
  }

  scriptPromise = new Promise<void>((resolve) => {
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.setAttribute('data-adsense-loader', 'true');
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    script.onload = () => resolve();
    // A blocked or failed script must never break the page.
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export const AdBanner: React.FC<AdBannerProps> = ({
  className,
  format = 'auto',
  minHeight = 90,
}) => {
  const { enabled, client, slot } = useAds();
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    void loadAdSense(client).then(() => {
      if (cancelled || !containerRef.current) return;
      const ins = containerRef.current.querySelector('ins.adsbygoogle');
      // Never push twice for the same element: AdSense throws, and the error
      // would surface as an unhandled rejection on every render.
      if (ins && !ins.hasAttribute('data-adsbygoogle-status')) {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (error) {
          console.warn('AdSense push failed', error);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, client]);

  if (!enabled) return null;

  return (
    <div
      ref={containerRef}
      className={cn('ad-container flex w-full justify-center', className)}
      style={{ minHeight }}
      aria-hidden="true"
    >
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', minHeight: 'inherit' }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
};

export const ContentAd: React.FC<{ className?: string }> = ({ className }) => (
  <AdBanner format="rectangle" minHeight={250} className={cn('max-w-sm', className)} />
);

export const StickyFooterAd: React.FC = () => {
  const { enabled } = useAds();
  // Render no wrapper either — an empty fixed bar would cover the bottom nav.
  if (!enabled) return null;

  return (
    <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl">
      <div className="flex justify-center py-2">
        <AdBanner format="horizontal" minHeight={60} className="max-w-md" />
      </div>
    </div>
  );
};
