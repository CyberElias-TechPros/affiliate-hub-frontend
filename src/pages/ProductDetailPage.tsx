import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Copy, Link2, Loader2, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BottomNav } from "@/components/layout/BottomNav";
import { DataErrorState } from "@/components/routing/ProtectedRoute";
import { Seo, breadcrumbSchema } from "@/components/seo/Seo";
import { AffiliateAPI, ApiClientError, ProductAPI } from "@/lib/api";
import { whatsappLink } from "@/lib/validation";
import { formatMoney } from "@shared/api-contract";

/**
 * Product detail + affiliate toolkit.
 *
 * The prototype's "Generate link" button showed a fabricated URL built from
 * `window.location.origin` and never persisted anything. This generates a real
 * tracked link through the API, and the URL it shows is the one the server
 * built from its own configured public origin — so it keeps working after the
 * affiliate copies it into WhatsApp.
 */
const ProductDetailPage = () => {
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const product = useQuery({
    queryKey: ["product", slug],
    queryFn: () => ProductAPI.detail(slug),
    enabled: slug.length > 0,
  });
  const assets = useQuery({
    queryKey: ["product-assets", slug],
    queryFn: () => ProductAPI.assets(slug),
    enabled: slug.length > 0,
  });

  const generate = useMutation({
    mutationFn: () => AffiliateAPI.generateLink(product.data?.id ?? ""),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["affiliate-links"] });
      toast.success("Your tracking link is ready");
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiClientError ? error.message : "We could not generate that link. Please try again.",
      );
    },
  });

  const link = generate.data?.link;
  const commissionPercent = product.data ? product.data.commissionBps / 100 : 0;

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      // Clipboard access can be denied (insecure context, iframe sandbox).
      // Falling back to a prompt is clunky but better than a silent failure.
      window.prompt(`Copy ${label.toLowerCase()}:`, value);
    }
  };

  const shareToWhatsapp = (text: string) => {
    const message = link ? text.replace("{link}", link.url) : text;
    window.open(whatsappLink("", message), "_blank", "noopener,noreferrer");
  };

  const shareNative = async (text: string) => {
    const message = link ? text.replace("{link}", link.url) : text;
    if (navigator.share) {
      try {
        await navigator.share({ title: product.data?.title, text: message, url: link?.url });
      } catch {
        /* The user dismissed the share sheet; not an error worth surfacing. */
      }
      return;
    }
    void copy(message, "Message");
  };

  if (product.isLoading) {
    return (
      <div className="min-h-screen bg-background pb-28">
        <div className="px-4 pt-6">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="mt-4 h-48 w-full rounded-2xl" />
          <Skeleton className="mt-4 h-6 w-2/3" />
          <Skeleton className="mt-2 h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (product.isError || !product.data) {
    return (
      <div className="min-h-screen bg-background p-4">
        <DataErrorState
          title="We could not find that product"
          message={
            product.error instanceof ApiClientError
              ? product.error.message
              : "It may have been removed from the marketplace."
          }
          onRetry={() => void product.refetch()}
        />
        <div className="mt-4 text-center">
          <Link to="/marketplace" className="text-sm font-medium text-primary hover:underline">
            Back to marketplace
          </Link>
        </div>
      </div>
    );
  }

  const p = product.data;

  return (
    <div className="min-h-screen bg-background pb-28">
      <Seo
        title={p.title}
        description={p.summary}
        path={`/products/${p.slug}`}
        robots="noindex, nofollow"
        jsonLd={[
          breadcrumbSchema([
            { name: "Marketplace", path: "/marketplace" },
            { name: p.title, path: `/products/${p.slug}` },
          ]),
        ]}
      />

      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="flex items-center gap-3 px-4 py-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-full p-2 transition-colors hover:bg-muted"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display truncate text-lg font-semibold">Product details</h1>
        </div>
      </header>

      <main id="main-content" className="px-4 py-4">
        <div className="overflow-hidden rounded-2xl bg-muted">
          {p.imageUrl ? (
            <img
              src={p.imageUrl}
              alt={p.title}
              className="aspect-square w-full object-cover"
              width={640}
              height={640}
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center text-6xl" aria-hidden="true">
              📦
            </div>
          )}
        </div>

        <div className="mt-4">
          <p className="text-sm text-muted-foreground">{p.merchant}</p>
          <h2 className="font-display text-2xl font-bold text-foreground">{p.title}</h2>
          <p className="mt-2 text-muted-foreground">{p.summary}</p>
        </div>

        <div className="bg-card shadow-card mt-4 grid grid-cols-3 gap-3 rounded-xl p-4">
          <Stat label="Price" value={formatMoney(p.price)} />
          <Stat
            label="Commission"
            value={`${commissionPercent % 1 === 0 ? commissionPercent.toFixed(0) : commissionPercent.toFixed(1)}%`}
            tone="success"
          />
          <Stat label="You earn" value={formatMoney(p.commissionAmount)} tone="success" />
        </div>

        <section className="mt-6" aria-labelledby="why-promote-heading">
          <h2 id="why-promote-heading" className="font-display mb-3 text-lg font-semibold text-foreground">
            Why promote this
          </h2>
          {p.whyPromote.length > 0 ? (
            <ul className="space-y-2">
              {p.whyPromote.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" aria-hidden="true" />
                  <span className="text-sm text-muted-foreground">{point}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No additional details from the merchant yet.</p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {p.cookieDays}-day cookie window · conversions are approved by the merchant before they become
            withdrawable.
          </p>
        </section>

        {/* Toolkit */}
        <section className="mt-8" aria-labelledby="toolkit-heading">
          <h2 id="toolkit-heading" className="font-display mb-3 text-lg font-semibold text-foreground">
            Your affiliate toolkit
          </h2>

          {!link ? (
            <Button
              className="gradient-primary h-14 w-full rounded-xl text-lg font-semibold text-primary-foreground shadow-glow"
              disabled={generate.isPending}
              onClick={() => generate.mutate()}
            >
              {generate.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Link2 className="mr-2 h-5 w-5" />
                  Generate my link
                </>
              )}
            </Button>
          ) : (
            <div className="animate-fade-in space-y-4">
              <div>
                <label htmlFor="affiliate-link" className="mb-1.5 block text-sm font-medium text-foreground">
                  Your tracking link
                </label>
                <div className="flex gap-2">
                  <input
                    id="affiliate-link"
                    readOnly
                    value={link.url}
                    onFocus={(e) => e.currentTarget.select()}
                    className="h-12 min-w-0 flex-1 rounded-lg border border-input bg-muted px-3 text-sm text-foreground"
                  />
                  <Button variant="outline" className="h-12 flex-shrink-0" onClick={() => void copy(link.url, "Link")}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {link.clicks} click{link.clicks === 1 ? "" : "s"} · {link.conversions} sale
                  {link.conversions === 1 ? "" : "s"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  className="gradient-primary h-12 rounded-xl font-semibold text-primary-foreground"
                  onClick={() => void shareNative("Check this out: {link}")}
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
                <Button
                  variant="outline"
                  className="h-12 rounded-xl"
                  onClick={() => shareToWhatsapp("🔥 Check this out 👉 {link}")}
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  WhatsApp
                </Button>
              </div>

              {assets.data && assets.data.assets.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium text-foreground">Ready-to-use captions</h3>
                  <ul className="space-y-2">
                    {assets.data.assets
                      .filter((asset) => asset.kind === "copy" && asset.text)
                      .map((asset) => (
                        <li
                          key={asset.id}
                          className="bg-card shadow-card flex items-start justify-between gap-3 rounded-xl p-3"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-muted-foreground">{asset.label}</p>
                            <p className="mt-1 whitespace-pre-line text-sm text-foreground">{asset.text}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-shrink-0"
                            onClick={() => void copy(link ? asset.text!.replace("{link}", link.url) : asset.text!, "Caption")}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              <Link to="/links" className="block text-center text-sm font-medium text-primary hover:underline">
                Manage all your links
              </Link>
            </div>
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; tone?: "success" }> = ({ label, value, tone }) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className={`font-display text-lg font-bold ${tone === "success" ? "text-success" : "text-foreground"}`}>
      {value}
    </p>
  </div>
);

export default ProductDetailPage;
