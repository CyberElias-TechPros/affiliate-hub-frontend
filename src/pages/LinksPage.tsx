import * as React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BottomNav } from "@/components/layout/BottomNav";
import { DataErrorState, EmptyState } from "@/components/routing/ProtectedRoute";
import { Seo } from "@/components/seo/Seo";
import { AffiliateAPI, ApiClientError } from "@/lib/api";
import { formatMoney } from "@shared/api-contract";

/**
 * Every link this affiliate has generated, with its performance.
 *
 * There was no such screen before: links were created inside the product page
 * and then unreachable, so an affiliate who generated a link last week had no
 * way to find it again.
 */
const LinksPage = () => {
  const [page, setPage] = React.useState(1);

  const links = useQuery({
    queryKey: ["affiliate-links", page],
    queryFn: () => AffiliateAPI.links(page, 20),
  });

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Link copied");
    } catch {
      window.prompt("Copy your link:", value);
    }
  };

  const items = links.data?.items ?? [];

  return (
    <div className="min-h-screen bg-background pb-28">
      <Seo title="Your links" description="Every affiliate link you have generated." path="/links" robots="noindex, nofollow" />

      <header className="gradient-hero px-4 pb-4 pt-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Your links</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {links.data ? `${links.data.totalItems} generated` : "Loading…"}
        </p>
      </header>

      <main id="main-content" className="px-4 py-4">
        {links.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : links.isError ? (
          <DataErrorState
            message={
              links.error instanceof ApiClientError
                ? links.error.message
                : "We could not load your links."
            }
            onRetry={() => void links.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="No links yet"
            description="Open any product in the marketplace and generate a link to start tracking clicks."
            action={
              <Link to="/marketplace">
                <Button size="sm">Browse marketplace</Button>
              </Link>
            }
          />
        ) : (
          <>
            <ul className="space-y-3">
              {items.map((link) => (
                <li key={link.id} className="bg-card shadow-card rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={`/products/${link.productSlug}`}
                        className="block truncate font-medium text-foreground hover:text-primary"
                      >
                        {link.productTitle}
                      </Link>
                      <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{link.url}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-shrink-0"
                      onClick={() => void copy(link.url)}
                      aria-label={`Copy link for ${link.productTitle}`}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>

                  <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3">
                    <Metric label="Clicks" value={String(link.clicks)} />
                    <Metric label="Sales" value={String(link.conversions)} />
                    <Metric label="Earned" value={formatMoney(link.earnings)} tone="success" />
                  </dl>
                </li>
              ))}
            </ul>

            {links.data && links.data.totalPages > 1 && (
              <nav className="flex items-center justify-center gap-3 py-6" aria-label="Link pages">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {links.data.page} of {links.data.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= links.data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </nav>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; tone?: "success" }> = ({ label, value, tone }) => (
  <div>
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className={`font-semibold ${tone === "success" ? "text-success" : "text-foreground"}`}>{value}</dd>
  </div>
);

export default LinksPage;
