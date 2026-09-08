import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal, X, Check } from "lucide-react";
import { ProductCard } from "@/components/ui/ProductCard";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { BottomNav } from "@/components/layout/BottomNav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DataErrorState, EmptyState } from "@/components/routing/ProtectedRoute";
import { Seo } from "@/components/seo/Seo";
import { ProductAPI } from "@/lib/api";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { Product, ProductSort } from "@shared/api-contract";

/**
 * Marketplace.
 *
 * Fixes over the prototype:
 *  - Search actually searches. The old page kept a `searchQuery` in state and
 *    never used it — the input was decorative.
 *  - Filtering and sorting happen server-side. The old page sent the chip id
 *    ("digital") to an API whose categories were title-cased ("Digital"), so
 *    the query matched nothing and the client-side filter silently papered
 *    over it.
 *  - Saved products persist. They were component state, lost on every refresh.
 *  - Search input is debounced, so typing does not fire a request per
 *    keystroke.
 */

const CATEGORIES = [
  { id: "all", label: "All products" },
  { id: "high", label: "🔥 High commission" },
  { id: "digital", label: "Digital" },
  { id: "physical", label: "Physical" },
  { id: "services", label: "Services" },
  { id: "finance", label: "Finance" },
  { id: "health", label: "Health" },
  { id: "beauty", label: "Beauty" },
  { id: "education", label: "Education" },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

/** UI sort ids. They are not the API's vocabulary: "price-low" maps to
 *  `price-asc`, which is why `toApiParams` translates rather than passing
 *  these through. The prototype passed the UI id straight to the API, where it
 *  matched no case and silently fell back to the default order. */
const SORT_OPTIONS = [
  { id: "default", label: "Recommended" },
  { id: "commission-desc", label: "Commission: high to low" },
  { id: "price-low", label: "Price: low to high" },
  { id: "price-high", label: "Price: high to low" },
  { id: "newest", label: "Newest first" },
] as const;

type SortId = (typeof SORT_OPTIONS)[number]["id"];

/** Chip id -> API query. "high" is a commission filter, not a category. */
function toApiParams(category: CategoryId, sort: SortId) {
  const params: {
    category?: string;
    sort?: ProductSort;
    minCommissionBps?: number;
  } = {};

  if (category === "high") params.minCommissionBps = 4000;
  else if (category !== "all") params.category = category;

  switch (sort) {
    case "commission-desc":
      params.sort = "commission-desc";
      break;
    case "price-low":
      params.sort = "price-asc";
      break;
    case "price-high":
      params.sort = "price-desc";
      break;
    case "newest":
      params.sort = "newest";
      break;
    default:
      break;
  }
  return params;
}

const PAGE_SIZE = 20;

const MarketplacePage = () => {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [activeCategory, setActiveCategory] = React.useState<CategoryId>("all");
  const [sortBy, setSortBy] = React.useState<SortId>("default");
  const [isSortOpen, setIsSortOpen] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [saved, setSaved] = useLocalStorage<string[]>("affiliatehub.savedProducts", []);

  // Debounce so a 10-character search is one request, not ten.
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const apiParams = React.useMemo(() => toApiParams(activeCategory, sortBy), [activeCategory, sortBy]);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["products", apiParams, debouncedQuery, page],
    queryFn: () =>
      ProductAPI.list({
        category: (apiParams.category ?? "all") as never,
        sort: apiParams.sort,
        minCommissionBps: apiParams.minCommissionBps,
        q: debouncedQuery || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: (previous) => previous,
  });

  const toggleSaved = (id: string) => {
    setSaved((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const products: Product[] = data?.items ?? [];
  const isSearching = debouncedQuery.length > 0;

  return (
    <div className="min-h-screen bg-background pb-28">
      <Seo
        title="Marketplace"
        description="Browse products available to promote."
        path="/marketplace"
        robots="noindex, nofollow"
      />

      <div className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="px-4 py-4">
          <h1 className="font-display mb-4 text-2xl font-bold text-foreground">Discover products</h1>

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <label htmlFor="product-search" className="sr-only">
              Search products
            </label>
            <input
              id="product-search"
              type="search"
              placeholder="Search products, brands…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-12 w-full rounded-xl border border-input bg-card pl-10 pr-24 text-foreground transition-all placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="absolute right-12 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-muted"
                aria-label="Clear search"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}

            <Sheet open={isSortOpen} onOpenChange={setIsSortOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-primary/10 p-1.5 text-primary transition-colors hover:bg-primary/20"
                  aria-label="Sort products"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-xl">
                <SheetHeader>
                  <SheetTitle>Sort products</SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-2">
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setSortBy(option.id);
                        setIsSortOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg p-3 text-left transition-colors ${
                        sortBy === option.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                      }`}
                    >
                      <span className="font-medium">{option.label}</span>
                      {sortBy === option.id && <Check className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="scrollbar-hide overflow-x-auto px-4 pb-4">
          <div className="flex gap-2" role="group" aria-label="Filter by category">
            {CATEGORIES.map((category) => (
              <CategoryChip
                key={category.id}
                label={category.label}
                isActive={activeCategory === category.id}
                onClick={() => {
                  setActiveCategory(category.id);
                  setPage(1);
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <main id="main-content" className="px-4 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <DataErrorState
            title="We could not load products"
            message={
              error && "message" in error
                ? String((error as Error).message)
                : "Please check your connection and try again."
            }
            onRetry={() => void refetch()}
          />
        ) : products.length === 0 ? (
          <EmptyState
            title={isSearching ? `No products match “${debouncedQuery}”` : "Nothing here yet"}
            description={
              isSearching
                ? "Try a shorter search, or clear the filters."
                : "New products are added regularly. Check back soon."
            }
            action={
              isSearching ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchInput("");
                    setActiveCategory("all");
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Announced politely so a screen-reader user knows results changed. */}
            <p className="sr-only" role="status" aria-live="polite">
              {data?.totalItems ?? 0} products found
              {isSearching ? ` for ${debouncedQuery}` : ""}.
            </p>

            <div className="space-y-3">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  isSaved={saved.includes(product.id)}
                  onToggleSave={() => toggleSaved(product.id)}
                  onClick={() => navigate(`/products/${product.slug}`)}
                />
              ))}
            </div>

            {isFetching && (
              <p className="py-3 text-center text-sm text-muted-foreground" role="status">
                Updating…
              </p>
            )}

            {/* Pagination. A list without it grows without bound. */}
            {data && data.totalPages > 1 && (
              <nav className="flex items-center justify-center gap-3 py-6" aria-label="Pagination">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {data.page} of {data.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.totalPages}
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

export default MarketplacePage;
