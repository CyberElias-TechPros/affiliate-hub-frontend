import * as React from "react";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
  /** Optional label so logs say which subtree failed. */
  name?: string;
}

interface State {
  error: Error | null;
}

/**
 * Route-level error boundary.
 *
 * There was none. Any throw during render — a malformed API field reaching
 * `Intl.NumberFormat`, an undefined nested property — propagated to React's root
 * and unmounted the entire tree, leaving a completely blank page with no way
 * back except a manual reload. A white screen is the worst possible failure mode
 * for a money app: the user cannot even see that something went wrong.
 *
 * This catches the throw, keeps the navigation shell usable, and offers a retry
 * that remounts the subtree (which refetches) plus a way home.
 *
 * Deliberately does NOT swallow the error: it is re-logged so it still reaches
 * whatever error reporting is wired up in production.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Surface it rather than hiding it. A caught-and-forgotten error is how a
    // broken page ships unnoticed.
    console.error(`[ErrorBoundary${this.props.name ? `:${this.props.name}` : ""}]`, error, info.componentStack);
  }

  private retry = (): void => {
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive" aria-hidden="true" />
        <h1 className="font-display mt-4 text-xl font-bold text-foreground">
          Something went wrong on this page
        </h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Your account and balance are unaffected. Try reloading the page — if it keeps
          happening, contact support and mention what you were doing.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button onClick={this.retry} className="gradient-primary h-11 rounded-xl px-6 font-semibold text-primary-foreground">
            <RotateCcw className="mr-2 h-4 w-4" />
            Try again
          </Button>
          <a href="/">
            <Button variant="outline" className="h-11 rounded-xl px-6">
              <Home className="mr-2 h-4 w-4" />
              Back home
            </Button>
          </a>
        </div>
      </div>
    );
  }
}
