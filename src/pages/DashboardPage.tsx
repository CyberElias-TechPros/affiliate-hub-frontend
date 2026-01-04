import * as React from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, Eye, ShoppingCart, Target, ChevronRight, Zap } from "lucide-react";
import { BalanceCard } from "@/components/ui/BalanceCard";
import { BottomNav } from "@/components/layout/BottomNav";
import { ContentAd, StickyFooterAd, NativeAd } from "@/components/common/AdBanner";
import { useAdManager } from "@/contexts/AdManagerContext";

const statsCards = [
  { label: "Total Clicks", value: "2,847", change: "+12%", icon: Eye, color: "primary" },
  { label: "Conversions", value: "156", change: "+8%", icon: ShoppingCart, color: "success" },
  { label: "Conv. Rate", value: "5.4%", change: "+2.1%", icon: Target, color: "accent" },
];

const topProducts = [
  { id: "1", name: "Forex Trading Course", sales: 45, earnings: 202500 },
  { id: "2", name: "Fitness Watch Pro", sales: 32, earnings: 144000 },
  { id: "3", name: "Business Masterclass", sales: 28, earnings: 126000 },
];

const topAffiliates = [
  { name: "Adebayo T.", earnings: 450000, rank: 1 },
  { name: "Ngozi O.", earnings: 380000, rank: 2 },
  { name: "Chinedu M.", earnings: 320000, rank: 3 },
];

const weeklyData = [
  { day: "Mon", clicks: 120 },
  { day: "Tue", clicks: 180 },
  { day: "Wed", clicks: 150 },
  { day: "Thu", clicks: 280 },
  { day: "Fri", clicks: 220 },
  { day: "Sat", clicks: 350 },
  { day: "Sun", clicks: 190 },
];

const DashboardPage = () => {
  const navigate = useNavigate();
  const { currentVariant, showInterstitial } = useAdManager();
  const maxClicks = Math.max(...weeklyData.map((d) => d.clicks));

  // Trigger app open interstitial (A/B tested)
  React.useEffect(() => {
    if (currentVariant === 'A') {
      showInterstitial('app_open');
    }
  }, [currentVariant, showInterstitial]);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 gradient-hero">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-muted-foreground text-sm">Welcome back,</p>
            <h1 className="text-xl font-bold font-display text-foreground">Chinedu 👋</h1>
          </div>
          <button className="relative p-2 rounded-full bg-card shadow-sm">
            <Zap className="h-5 w-5 text-accent" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
              3
            </span>
          </button>
        </div>

        {/* Balance Cards */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          <div className="min-w-[280px]">
            <BalanceCard currency="NGN" balance={472500} trend={12} isActive />
          </div>
          <div className="min-w-[280px]">
            <BalanceCard currency="USD" balance={315} trend={8} />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-4 py-4">
        <div className="grid grid-cols-3 gap-3">
          {statsCards.map((stat) => (
            <div
              key={stat.label}
              className="bg-card rounded-xl p-3 shadow-card animate-fade-in"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${
                stat.color === "primary" ? "bg-primary/10 text-primary" :
                stat.color === "success" ? "bg-success/10 text-success" :
                "bg-accent/10 text-accent"
              }`}>
                <stat.icon className="h-4 w-4" />
              </div>
              <p className="text-lg font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-xs text-success font-medium mt-1">{stat.change}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Native Ad - A/B Tested */}
      {currentVariant === 'B' && (
        <NativeAd />
      )}

      {/* Weekly Performance Chart */}
      <div className="px-4 py-4">
        <div className="bg-card rounded-xl p-4 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Weekly Clicks</h2>
            <span className="text-xs text-muted-foreground">Last 7 days</span>
          </div>
          <div className="flex items-end justify-between h-32 gap-2">
            {weeklyData.map((data, index) => {
              const height = (data.clicks / maxClicks) * 100;
              return (
                <div key={data.day} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full relative" style={{ height: `${height}%` }}>
                    <div
                      className="w-full h-full rounded-t-md gradient-primary animate-fade-up"
                      style={{ animationDelay: `${index * 50}ms` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{data.day}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Products */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-foreground">Top Performers</h2>
          <button className="text-sm text-primary font-medium flex items-center">
            View all <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          {topProducts.map((product, index) => (
            <div
              key={product.id}
              className="flex items-center gap-3 bg-card rounded-xl p-3 shadow-card animate-slide-in-right"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground font-bold">
                #{index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{product.name}</p>
                <p className="text-sm text-muted-foreground">{product.sales} sales</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-success">₦{product.earnings.toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-foreground">Top Affiliates</h2>
          <button className="text-sm text-primary font-medium flex items-center">
            View all <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="bg-card rounded-xl p-4 shadow-card">
          <div className="space-y-3">
            {topAffiliates.map((affiliate, index) => (
              <div
                key={affiliate.rank}
                className="flex items-center gap-3"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  affiliate.rank === 1 ? "gradient-gold text-accent-foreground" :
                  affiliate.rank === 2 ? "bg-muted text-muted-foreground" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {affiliate.rank}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{affiliate.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-success">₦{affiliate.earnings.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Goal Tracker */}
      <div className="px-4 py-4">
        <div className="bg-card rounded-xl p-4 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Monthly Goal</h2>
            <span className="text-sm text-muted-foreground">₦500,000</span>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium text-foreground">₦472,500 / ₦500,000</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="gradient-primary h-2 rounded-full" style={{ width: "94.5%" }}></div>
            </div>
            <p className="text-xs text-muted-foreground text-center">27,500 to go!</p>
          </div>
        </div>
      </div>

      {/* Ad Section */}
      <div className="px-4 py-4">
        <div className="flex justify-center">
          <ContentAd />
        </div>
      </div>

      {/* Quick Action */}
      <div className="px-4 py-4">
        <button
          onClick={() => navigate("/marketplace")}
          className="w-full flex items-center justify-between p-4 rounded-xl gradient-gold text-accent-foreground shadow-lg"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent-foreground/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="font-semibold">Find New Products</p>
              <p className="text-sm opacity-80">Explore high-commission offers</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <BottomNav />
      <StickyFooterAd />
    </div>
  );
};

export default DashboardPage;
