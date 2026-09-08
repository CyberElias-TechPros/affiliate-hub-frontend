import * as React from "react";

/**
 * Keyboard "skip to content" link.
 *
 * The app has a fixed bottom nav and a sticky header; without this, a keyboard
 * user must tab through every navigation item on every page before reaching
 * the content. It is the first focusable element on the page and invisible
 * until focused.
 */
export const SkipLink: React.FC = () => (
  <a href="#main-content" className="skip-link">
    Skip to main content
  </a>
);
