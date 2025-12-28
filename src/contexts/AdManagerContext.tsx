import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface AdConfig {
  refreshInterval: number;
  maxRefreshes: number;
  contextualTargeting: boolean;
  abTesting: boolean;
  interstitialTriggers: string[];
}

interface AdPerformance {
  impressions: number;
  clicks: number;
  ctr: number;
  revenue: number;
  fillRate: number;
}

interface AdManagerContextType {
  config: AdConfig;
  interstitialOpen: boolean;
  currentVariant: 'A' | 'B';
  performance: AdPerformance;
  showInterstitial: (trigger: string) => void;
  closeInterstitial: () => void;
  trackAdImpression: () => void;
  trackAdClick: () => void;
  refreshAds: () => void;
  getContextualAdSlot: (page: string) => string;
}

const AdManagerContext = createContext<AdManagerContextType | undefined>(undefined);

const defaultConfig: AdConfig = {
  refreshInterval: 30000,
  maxRefreshes: 5,
  contextualTargeting: true,
  abTesting: true,
  interstitialTriggers: ['transaction_success', 'profile_update', 'app_open']
};

export const AdManagerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config] = useState<AdConfig>(defaultConfig);
  const [interstitialOpen, setInterstitialOpen] = useState(false);
  const [currentVariant, setCurrentVariant] = useState<'A' | 'B'>(Math.random() < 0.5 ? 'A' : 'B');
  const [performance, setPerformance] = useState<AdPerformance>({
    impressions: 0,
    clicks: 0,
    ctr: 0,
    revenue: 0,
    fillRate: 0
  });

  const refreshAds = useCallback(() => {
    if (window.adsbygoogle && Array.isArray(window.adsbygoogle)) {
      try {
        window.adsbygoogle.push({});
        console.log('Ads refreshed at', new Date().toISOString());
      } catch (error) {
        console.error('Ad refresh error:', error);
      }
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshAds();
    }, config.refreshInterval);

    return () => clearInterval(interval);
  }, [config.refreshInterval, refreshAds]);

  const showInterstitial = useCallback((trigger: string) => {
    if (config.interstitialTriggers.includes(trigger)) {
      setTimeout(() => {
        setInterstitialOpen(true);
      }, 2000);
    }
  }, [config.interstitialTriggers]);

  const closeInterstitial = useCallback(() => {
    setInterstitialOpen(false);
  }, []);

  const trackAdImpression = useCallback(() => {
    setPerformance(prev => ({
      ...prev,
      impressions: prev.impressions + 1,
      ctr: prev.clicks / (prev.impressions + 1)
    }));

    if (window.gtag) {
      window.gtag('event', 'ad_impression', {
        ad_slot: '7966964742',
        timestamp: Date.now()
      });
    }
  }, []);

  const trackAdClick = useCallback(() => {
    setPerformance(prev => ({
      ...prev,
      clicks: prev.clicks + 1,
      ctr: (prev.clicks + 1) / prev.impressions
    }));

    if (window.gtag) {
      window.gtag('event', 'ad_click', {
        ad_slot: '7966964742',
        timestamp: Date.now()
      });
    }
  }, []);

  const getContextualAdSlot = useCallback((page: string): string => {
    if (!config.contextualTargeting) return '7966964742';

    const contextualSlots: Record<string, string> = {
      'dashboard': '7966964742',
      'transactions': '7966964742',
      'send': '7966964742',
      'bills': '7966964742',
      'wallet': '7966964742',
      'invest': '7966964742',
      'profile': '7966964742',
    };

    return contextualSlots[page] || '7966964742';
  }, [config.contextualTargeting]);

  return (
    <AdManagerContext.Provider value={{
      config,
      interstitialOpen,
      currentVariant,
      performance,
      showInterstitial,
      closeInterstitial,
      trackAdImpression,
      trackAdClick,
      refreshAds,
      getContextualAdSlot
    }}>
      {children}
    </AdManagerContext.Provider>
  );
};

export const useAdManager = () => {
  const context = useContext(AdManagerContext);
  if (context === undefined) {
    throw new Error('useAdManager must be used within an AdManagerProvider');
  }
  return context;
};