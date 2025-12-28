import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { ProductCard } from "@/components/ui/ProductCard";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { BottomNav } from "@/components/layout/BottomNav";
import { ContentAd, StickyFooterAd } from "@/components/common/AdBanner";

const categories = [
  { id: "all", label: "All Products" },
  { id: "high", label: "🔥 High Commission" },
  { id: "new", label: "✨ New" },
  { id: "digital", label: "Digital" },
  { id: "physical", label: "Physical" },
  { id: "services", label: "Services" },
];

const products = [
  {
    id: "1",
    title: "Premium Forex Trading Course - Complete Bundle",
    price: 150000,
    commission: 45,
    category: "Digital",
    image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=400&fit=crop",
  },
  {
    id: "2",
    title: "Smart Fitness Watch Pro - Health Tracker",
    price: 45000,
    commission: 25,
    category: "Tech",
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop",
  },
  {
    id: "3",
    title: "Organic Skincare Set - Complete Routine",
    price: 28000,
    commission: 30,
    category: "Beauty",
    image: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&h=400&fit=crop",
  },
  {
    id: "4",
    title: "Business Masterclass - Entrepreneurship 101",
    price: 75000,
    commission: 50,
    category: "Education",
    image: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=400&fit=crop",
  },
  {
    id: "5",
    title: "Wireless Noise Cancelling Headphones",
    price: 55000,
    commission: 20,
    category: "Tech",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop",
  },
  {
    id: "6",
    title: "Weight Loss Supplement - 30 Day Supply",
    price: 18000,
    commission: 35,
    category: "Health",
    image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop",
  },
];

const MarketplacePage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeCategory, setActiveCategory] = React.useState("all");
  const [savedProducts, setSavedProducts] = React.useState<string[]>([]);

  const handleSaveProduct = (id: string) => {
    setSavedProducts((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

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
            <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
              <SlidersHorizontal className="h-4 w-4" />
            </button>
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
        {products.map((product, index) => (
          <div
            key={product.id}
            className="animate-fade-up"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <ProductCard
              {...product}
              isSaved={savedProducts.includes(product.id)}
              onSave={handleSaveProduct}
              onClick={() => navigate(`/product/${product.id}`)}
            />
          </div>
        ))}
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
