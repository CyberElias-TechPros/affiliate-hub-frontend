import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal, X, Check } from "lucide-react";
import { ProductCard } from "@/components/ui/ProductCard";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { BottomNav } from "@/components/layout/BottomNav";
import { ContentAd, StickyFooterAd } from "@/components/common/AdBanner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ProductAPI } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

// Special category chips are always available; real product categories are
// merged in dynamically from the API so filtering matches actual data.
const specialCategories = [
  { id: "all", label: "All Products" },
  { id: "high", label: "🔥 High Commission" },
  { id: "new", label: "✨ New" },
];

const sortOptions = [
  { id: "default", label: "Default" },
  { id: "price-low", label: "Price: Low to High" },
  { id: "price-high", label: "Price: High to Low" },
  { id: "commission", label: "Commission: High to Low" },
  { id: "newest", label: "Newest First" },
];

const MarketplacePage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeCategory, setActiveCategory] = React.useState("all");
  const [savedProducts, setSavedProducts] = React.useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("affiliate_saved") || "[]") as string[];
    } catch {
      return [];
    }
  });
  const [sortBy, setSortBy] = React.useState("default");
  const [isSortOpen, setIsSortOpen] = React.useState(false);

  // Fetch all products (filtering/search/sort handled client-side so that the
  // special "High Commission"/"New" filters work against real data).
  const { data: products = [], isLoading, error } = useQuery({
    queryKey: ['products'],
    queryFn: () => ProductAPI.getProducts(),
    select: (response) => response.data,
  });

  // Fetch real categories from the backend for accurate filtering.
  const { data: apiCategories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => ProductAPI.getCategories(),
    select: (response) => response.data,
    staleTime: Infinity,
  });

  const categories = React.useMemo(() => {
    const real = apiCategories
      .filter((c) => c && c.toLowerCase() !== 'all')
      .map((c) => ({ id: c.toLowerCase(), label: c }));
    return [...specialCategories, ...real];
  }, [apiCategories]);

  const handleSaveProduct = (id: string) => {
    setSavedProducts((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      localStorage.setItem("affiliate_saved", JSON.stringify(next));
      return next;
    });
  };

  const getFilteredProducts = () => {
    let filtered = products;

    // Text search across title/description/category
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(
        (p) =>
          p.title?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q)
      );
    }

    // Filter by category
    if (activeCategory !== "all") {
      if (activeCategory === "high") {
        filtered = filtered.filter((p) => p.commission >= 40);
      } else if (activeCategory === "new") {
        filtered = [...filtered].sort((a, b) => {
          const tA = a.created_at ? new Date(a.created_at).getTime() : a.id || 0;
          const tB = b.created_at ? new Date(b.created_at).getTime() : b.id || 0;
          return tB - tA;
        }).slice(0, 3);
      } else {
        filtered = filtered.filter(
          (p) => p.category?.toLowerCase() === activeCategory.toLowerCase()
        );
      }
    }

    // Sort
    switch (sortBy) {
      case "price-low":
        return [...filtered].sort((a, b) => a.price - b.price);
      case "price-high":
        return [...filtered].sort((a, b) => b.price - a.price);
      case "commission":
        return [...filtered].sort((a, b) => b.commission - a.commission);
      case "newest":
        return [...filtered].sort((a, b) => {
          const tA = a.created_at ? new Date(a.created_at).getTime() : a.id || 0;
          const tB = b.created_at ? new Date(b.created_at).getTime() : b.id || 0;
          return tB - tA;
        });
      default:
        return filtered;
    }
  };

  const sortedProducts = getFilteredProducts();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="px-4 pt-6 pb-2 gradient-hero">
          <h1 className="text-2xl font-bold font-display text-foreground mb-4">
            Discover Products
          </h1>
        </div>
        <div className="px-4 py-4 space-y-3">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="animate-pulse">
              <div className="flex gap-3 p-3 bg-card rounded-xl shadow-card">
                <div className="w-24 h-24 rounded-lg bg-muted animate-shimmer" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                  <div className="h-6 bg-muted rounded w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="px-4 pt-6 pb-2 gradient-hero">
          <h1 className="text-2xl font-bold font-display text-foreground mb-4">
            Discover Products
          </h1>
        </div>
        <div className="px-4 py-4">
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-center">
            <p className="text-destructive font-medium">Failed to load products</p>
            <p className="text-muted-foreground text-sm mt-1">Please try again later</p>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="mt-4"
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 py-4">
          <h1 className="text-2xl font-bold font-display text-foreground mb-4">
            Discover Products
          </h1>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 pl-10 pr-12 rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-12 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            <Sheet open={isSortOpen} onOpenChange={setIsSortOpen}>
              <SheetTrigger asChild>
                <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                  <SlidersHorizontal className="h-4 w-4" />
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-xl">
                <SheetHeader>
                  <SheetTitle>Sort Products</SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-2">
                  {sortOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => {
                        setSortBy(option.id);
                        setIsSortOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                        sortBy === option.id
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted"
                      }`}
                    >
                      <span className="font-medium">{option.label}</span>
                      {sortBy === option.id && <Check className="h-4 w-4" />}
                    </button>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Category Chips */}
        <div className="px-4 pb-4 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2">
            {categories.map((category) => (
              <CategoryChip
                key={category.id}
                label={category.label}
                isActive={activeCategory === category.id}
                onClick={() => setActiveCategory(category.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="px-4 py-4 space-y-3">
        {sortedProducts.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🔍</div>
            <p className="font-medium text-foreground">No products found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Try a different search or category.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setSearchQuery("");
                setActiveCategory("all");
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          sortedProducts.map((product, index) => (
            <div
              key={product.id}
              className="animate-fade-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <ProductCard
                id={String(product.id)}
                title={product.title}
                price={product.price}
                commission={product.commission}
                image={product.image_url}
                category={product.category}
                isSaved={savedProducts.includes(String(product.id))}
                onSave={handleSaveProduct}
                onClick={() => navigate(`/product/${product.id}`)}
              />
            </div>
          ))
        )}
      </div>

      {/* Ad Section */}
      <div className="px-4 py-4">
        <div className="flex justify-center">
          <ContentAd />
        </div>
      </div>

      <BottomNav />
      <StickyFooterAd />
    </div>
  );
};

export default MarketplacePage;
