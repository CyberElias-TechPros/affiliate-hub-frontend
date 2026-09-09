/// <reference types="vite/client" />

/**
 * Globals injected by third-party scripts.
 *
 * Declared here rather than inside a component, so the augmentation happens
 * exactly once. The previous AdBanner declared `window.adsbygoogle` and
 * `window.gtag` in a module-scope `declare global`, which only type-checked by
 * accident of import order.
 */
interface Window {
  /** AdSense push queue. Present only when the loader script has run. */
  adsbygoogle?: unknown[];
}
