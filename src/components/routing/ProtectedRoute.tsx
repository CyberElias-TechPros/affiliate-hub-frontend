import * as React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

/**
 * Gate for authenticated routes.
 *
 * Server-side enforcement is the real protection — every one of these screens
 * calls an endpoint that rejects an anonymous caller with 401. This guard
 * exists so the UI does not flash an empty dashboard before bouncing.
 */
export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Checking your session…</p>
        </div>
      </div>
    );
  }

  if (status !== 'authenticated') {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
};

/** Bounce an already-signed-in user away from /auth and /onboarding. */
export const GuestRoute: React.FC<{ children: React.ReactNode; to?: string }> = ({
  children,
  to = '/dashboard',
}) => {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (status === 'authenticated') return <Navigate to={to} replace />;
  return <>{children}</>;
};

/**
 * Shown when a protected data query fails.
 *
 * Every authenticated screen renders one of these instead of a blank area, so
 * a network failure is always explained and always recoverable.
 */
export const DataErrorState: React.FC<{
  title?: string;
  message: string;
  onRetry?: () => void;
  requestId?: string;
}> = ({ title = 'We could not load this', message, onRetry, requestId }) => (
  <div
    role="alert"
    className="rounded-xl border border-destructive/20 bg-destructive/5 p-5 text-center"
  >
    <h2 className="font-display text-base font-semibold text-foreground">{title}</h2>
    <p className="mt-1 text-sm text-muted-foreground">{message}</p>
    {requestId && (
      <p className="mt-2 text-xs text-muted-foreground/70">
        Reference: <span className="font-mono">{requestId}</span>
      </p>
    )}
    {onRetry && (
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    )}
  </div>
);

/** Neutral empty state for lists that legitimately have nothing in them yet. */
export const EmptyState: React.FC<{
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ title, description, action }) => (
  <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
    <h2 className="font-display text-base font-semibold text-foreground">{title}</h2>
    {description && <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
