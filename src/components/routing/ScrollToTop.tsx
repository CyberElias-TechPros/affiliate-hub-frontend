import * as React from "react";
import { useLocation } from "react-router-dom";

/**
 * Reset scroll position on navigation.
 *
 * Without this, navigating from the bottom of a long marketplace list to a
 * product page leaves the new page scrolled partway down — a jarring bug that
 * is easy to miss because it only shows up after scrolling.
 */
export const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();

  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
};
