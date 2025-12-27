import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Heart, Share2, Check, Copy, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const productData = {
  id: "1",
  title: "Premium Forex Trading Course - Complete Bundle",
  price: 150000,
  commission: 45,
  commissionAmount: 67500,
  category: "Digital",
  description: "Learn forex trading from zero to pro with this comprehensive course that covers technical analysis, risk management, and proven trading strategies.",
  images: [
    "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1642790106117-e829e14a795f?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800&h=600&fit=crop",
  ],
  whyPromote: [
    "High conversion rate of 12%",
    "30-day cookie duration",
    "Recurring commissions on upsells",
    "Professional marketing materials",
    "Dedicated affiliate support",
  ],
  promoAssets: [
    "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=400&fit=crop",
    "https://images.unsplash.com/photo-1642790106117-e829e14a795f?w=400&h=400&fit=crop",
  ],
};

const ProductDetailPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [currentImage, setCurrentImage] = React.useState(0);
  const [isSaved, setIsSaved] = React.useState(false);
  const [linkCopied, setLinkCopied] = React.useState(false);
  const [showToolkit, setShowToolkit] = React.useState(false);

  const affiliateLink = `https://affiliatehub.ng/ref/user123/${id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(affiliateLink);
    setLinkCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const message = encodeURIComponent(`Check out this amazing product! ${affiliateLink}`);
    window.open(`https://wa.me/?text=${message}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSaved(!isSaved)}
              className={`p-2 rounded-full transition-colors ${
                isSaved ? "bg-destructive/10 text-destructive" : "hover:bg-muted"
              }`}
            >
              <Heart className={`h-5 w-5 ${isSaved && "fill-current"}`} />
            </button>
            <button
              onClick={handleShareWhatsApp}
              className="p-2 rounded-full hover:bg-muted transition-colors"
            >
              <Share2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Image Carousel */}
      <div className="relative">
        <div className="aspect-[4/3] overflow-hidden">
          <img
            src={productData.images[currentImage]}
            alt={productData.title}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {productData.images.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentImage(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                currentImage === index
                  ? "w-6 bg-primary-foreground"
                  : "bg-primary-foreground/50"
              }`}
            />
          ))}
        </div>
        {/* Commission Badge */}
        <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full gradient-primary text-primary-foreground font-bold text-sm shadow-glow">
          {productData.commission}% Commission
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Title & Price */}
        <div>
          <span className="text-sm text-muted-foreground font-medium">{productData.category}</span>
          <h1 className="text-xl font-bold font-display text-foreground mt-1">
            {productData.title}
          </h1>
          <div className="flex items-baseline gap-3 mt-3">
            <span className="text-2xl font-bold text-foreground">
              ₦{productData.price.toLocaleString()}
            </span>
            <span className="text-sm text-success font-semibold">
              Earn ₦{productData.commissionAmount.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Description */}
        <div>
          <h2 className="font-semibold text-foreground mb-2">About this product</h2>
          <p className="text-muted-foreground leading-relaxed">{productData.description}</p>
        </div>

        {/* Why Promote */}
        <div className="bg-success/5 border border-success/20 rounded-xl p-4">
          <h2 className="font-semibold text-foreground mb-3">Why promote this?</h2>
          <ul className="space-y-2">
            {productData.whyPromote.map((point, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Affiliate Toolkit */}
        <div className="bg-card rounded-xl shadow-card p-4 space-y-4">
          <h2 className="font-semibold text-foreground">Your Affiliate Toolkit</h2>
          
          {/* Affiliate Link */}
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Your unique link</label>
            <div className="flex gap-2">
              <div className="flex-1 px-3 py-2.5 bg-muted rounded-lg text-sm text-foreground truncate">
                {affiliateLink}
              </div>
              <Button
                onClick={handleCopyLink}
                className={`px-4 rounded-lg font-medium transition-all ${
                  linkCopied
                    ? "bg-success text-success-foreground"
                    : "gradient-primary text-primary-foreground"
                }`}
              >
                {linkCopied ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Promo Assets */}
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Promo materials</label>
            <div className="grid grid-cols-3 gap-2">
              {productData.promoAssets.map((asset, index) => (
                <div key={index} className="relative aspect-square rounded-lg overflow-hidden group">
                  <img src={asset} alt={`Promo ${index + 1}`} className="w-full h-full object-cover" />
                  <button className="absolute inset-0 bg-foreground/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Download className="h-5 w-5 text-background" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* WhatsApp Share */}
          <Button
            onClick={handleShareWhatsApp}
            className="w-full h-12 bg-success hover:bg-success/90 text-success-foreground font-semibold rounded-xl"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            </svg>
            Share to WhatsApp
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;
