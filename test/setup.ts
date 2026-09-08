import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

/**
 * Test setup.
 *
 * jsdom implements neither `matchMedia` nor `IntersectionObserver`, both of
 * which the app touches at render time. They are stubbed rather than
 * polyfilled because no test asserts on their behaviour — they only need to
 * not throw.
 */
afterEach(() => {
  cleanup();
});

if (typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

if (typeof globalThis.IntersectionObserver !== "function") {
  class IntersectionObserverStub implements IntersectionObserver {
    root = null;
    rootMargin = "";
    thresholds: ReadonlyArray<number> = [];
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  Object.defineProperty(globalThis, "IntersectionObserver", {
    writable: true,
    value: IntersectionObserverStub,
  });
}

if (typeof window.scrollTo !== "function") {
  Object.defineProperty(window, "scrollTo", { writable: true, value: () => {} });
}
