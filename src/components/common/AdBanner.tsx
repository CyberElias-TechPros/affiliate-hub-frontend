import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface AdBannerProps {
  className?: string;
  style?: 'banner' | 'rectangle' | 'mobile';
  position?: 'top' | 'middle' | 'bottom';
  adSlot?: string;
}

declare global {
  interface Window {
    adsbygoogle: any[];
    gtag: (...args: any[]) => void;
  }
}

export const AdBanner: React.FC<AdBannerProps> = ({
  className,
  style = 'banner',
  position = 'middle',
  adSlot = '7966964742'
}) => {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initializeAd = () => {
      try {
        if (window.adsbygoogle && adRef.current && !adRef.current.hasAttribute('data-adsbygoogle-status')) {
          console.log('Initializing AdSense ad for slot:', adSlot);
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        }
      } catch (err) {
        console.error('AdSense error:', err);
      }
    };

    const timer = setTimeout(initializeAd, 100);
    return () => clearTimeout(timer);
  }, [adSlot]);

  const getAdClasses = () => {
    switch (style) {
      case 'banner': return 'min-h-[90px] w-full max-w-md';
      case 'rectangle': return 'min-h-[250px] w-full max-w-sm';
      case 'mobile': return 'min-h-[100px] w-full max-w-sm';
      default: return 'min-h-[90px] w-full max-w-md';
    }
  };

  const getAdFormat = () => {
    switch (style) {
      case 'banner': return 'horizontal';
      case 'rectangle': return 'rectangle';
      case 'mobile': return 'vertical';
      default: return 'auto';
    }
  };

  const getPositionClasses = () => {
    switch (position) {
      case 'top': return 'mb-4';
      case 'middle': return 'my-4';
      case 'bottom': return 'mt-4';
      default: return 'my-4';
    }
  };

  return (
    <div
      ref={adRef}
      className={cn("ad-container", getAdClasses(), getPositionClasses(), className)}
    >
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', minHeight: 'inherit' }}
        data-ad-client="ca-pub-9117572925263537"
        data-ad-slot={adSlot}
        data-ad-format={getAdFormat()}
        data-full-width-responsive="true"
      />
    </div>
  );
};

// Specialized ad components for different placements with unique ad slots
export const HeaderAd: React.FC<{ className?: string }> = ({ className }) => (
  <AdBanner
    style="banner"
    position="top"
    adSlot="7966964742"
    className={cn("mb-2", className)}
  />
);

export const ContentAd: React.FC<{ className?: string }> = ({ className }) => (
  <AdBanner
    style="rectangle"
    position="middle"
    adSlot="7966964742"
    className={cn("max-w-sm", className)}
  />
);

export const FooterAd: React.FC<{ className?: string }> = ({ className }) => (
  <AdBanner
    style="banner"
    position="bottom"
    adSlot="7966964742"
    className={cn("max-w-md", className)}
  />
);

export const MobileAd: React.FC<{ className?: string }> = ({ className }) => (
  <AdBanner
    style="mobile"
    position="middle"
    adSlot="7966964742"
    className={cn("my-4", className)}
  />
);

export const StickyFooterAd: React.FC = () => (
  <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border safe-bottom">
    <div className="flex justify-center py-2">
      <AdBanner style="banner" position="bottom" adSlot="7966964742" className="max-w-md" />
    </div>
  </div>
);

export const InterstitialAd: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl p-6 max-w-sm w-full relative">
        <button onClick={onClose} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          ✕
        </button>
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold mb-2">Quick Ad</h3>
          <p className="text-sm text-muted-foreground">Support us by viewing this ad</p>
        </div>
        <AdBanner style="rectangle" position="middle" adSlot="7966964742" className="min-h-[250px]" />
        <button onClick={onClose} className="w-full mt-4 bg-primary text-primary-foreground py-2 rounded-lg font-medium">
          Continue
        </button>
      </div>
    </div>
  );
};

export const NativeAd: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn("bg-gradient-to-r from-primary/5 to-accent/5 rounded-2xl border-2 border-primary/10 p-4", className)}>
    <div className="flex items-center gap-3 mb-3">
      <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
        <span className="text-primary font-bold text-sm">AD</span>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Sponsored</p>
        <p className="text-sm font-medium">Recommended for you</p>
      </div>
    </div>
    <AdBanner style="rectangle" position="middle" adSlot="7966964742" className="min-h-[200px]" />
  </div>
);