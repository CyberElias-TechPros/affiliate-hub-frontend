import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/seo/Seo";

/**
 * 404.
 *
 * The prototype logged the miss with `console.error`, which writes a stack trace
 * to the console of every visitor who follows a stale link. That is noise in
 * their devtools, not a signal to anyone who can act on it, so it is gone.
 *
 * Marked `noindex` — a 404 shell in the index is thin content, and the canonical
 * would point at a path that does not exist.
 */
const NotFound = () => {
  const location = useLocation();

  return (
    <main id="main-content" className="flex min-h-screen flex-col items-center justify-center bg-muted px-6 text-center">
      <Seo
        title="Page not found"
        description="That page does not exist. Return to Affiliate Hub to browse products and start earning."
        path={location.pathname}
        robots="noindex, nofollow"
      />

      <p className="font-display text-7xl font-bold text-primary" aria-hidden="true">
        404
      </p>
      <h1 className="font-display mt-4 text-2xl font-bold text-foreground">We can't find that page</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        The link may be broken, or the page may have moved.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link to="/">
          <Button className="gradient-primary h-12 rounded-xl px-6 font-semibold text-primary-foreground shadow-glow">
            <Home className="mr-2 h-4 w-4" />
            Back home
          </Button>
        </Link>
        <Link to="/marketplace">
          <Button variant="outline" className="h-12 rounded-xl px-6">
            <Search className="mr-2 h-4 w-4" />
            Browse marketplace
          </Button>
        </Link>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Looking for something specific?{" "}
        <Link to="/help" className="font-medium text-primary hover:underline">
          Visit the help centre
        </Link>
        .
      </p>
    </main>
  );
};

export default NotFound;
