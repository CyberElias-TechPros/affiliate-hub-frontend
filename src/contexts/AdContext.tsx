import * as React from 'react';
import { adsEnabled, config } from '@/lib/config';

/**
 * Ad visibility.
 *
 * What this replaces
 * ------------------
 * The previous `AdManagerContext` had several problems:
 *
 *  - It referenced ad slots for pages named `transactions`, `send`, `bills`
 *    and `invest`. None of those routes exist in this app — the code was copied
 *    from an unrelated fintech wallet, and every entry returned the same slot
 *    anyway, so the whole "contextual targeting" layer was inert.
 *  - It fired a full-screen interstitial on `app_open` for a random half of
 *    users. Blocking the app behind a full-screen ad on launch is an AdSense
 *    policy problem, not just a bad experience.
 *  - It ran a 30-second `setInterval` pushing new ad requests forever, which
 *    burns impressions and is the kind of behaviour that gets a publisher
 *    account limited.
 *  - It tracked impressions and CTR in component state that was reset on every
 *    navigation, so the numbers were never real.
 *
 * What it does now: one decision — are ads configured? — exposed to the
 * components that render units. No timer, no interstitial, no fake metrics.
 */

interface AdContextValue {
  /** True when a publisher id and slot are configured. */
  enabled: boolean;
  client: string;
  slot: string;
}

const AdContext = React.createContext<AdContextValue>({ enabled: false, client: '', slot: '' });

export const AdProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = React.useMemo<AdContextValue>(
    () => ({
      enabled: adsEnabled(),
      client: config.adSenseClient,
      slot: config.adSenseSlot,
    }),
    [],
  );
  return <AdContext.Provider value={value}>{children}</AdContext.Provider>;
};

export function useAds(): AdContextValue {
  return React.useContext(AdContext);
}
