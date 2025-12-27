import * as React from "react";
import { Eye, ShoppingCart, Target, TrendingUp, Trophy } from "lucide-react";
import { BottomNav } from "@/components/layout/BottomNav";

const weeklyData = [
  { day: "Mon", clicks: 120, sales: 8 },
  { day: "Tue", clicks: 180, sales: 12 },
  { day: "Wed", clicks: 150, sales: 9 },
  { day: "Thu", clicks: 280, sales: 18 },
  { day: "Fri", clicks: 220, sales: 14 },
  { day: "Sat", clicks: 350, sales: 22 },
  { day: "Sun", clicks: 190, sales: 11 },
];

const leaderboard = [
  { rank: 1, name: "Emeka O.", earnings: 1250000, avatar: "EO" },
  { rank: 2, name: "Amaka U.", earnings: 980000, avatar: "AU" },
  { rank: 3, name: "John D.", earnings: 750000, avatar: "JD" },
  { rank: 4, name: "You", earnings: 472500, avatar: "CN", isCurrentUser: true },
  { rank: 5, name: "Sarah K.", earnings: 420000, avatar: "SK" },
];

const StatsPage = () => {
  const maxClicks = Math.max(...weeklyData.map((d) => d.clicks));
  const maxSales = Math.max(...weeklyData.map((d) => d.sales));

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold font-display text-foreground">Performance</h1>
        <p className="text-muted-foreground">Track your affiliate stats</p>
      </div>

      {/* Stats Overview */}
      <div className="px-4 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-xl p-4 shadow-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Eye className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">Total Clicks</span>
            </div>
            <p className="text-2xl font-bold text-foreground">12,847</p>
            <p className="text-xs text-success font-medium">+18% vs last month</p>
          </div>
          <div className="bg-card rounded-xl p-4 shadow-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                <ShoppingCart className="h-4 w-4 text-success" />
              </div>
              <span className="text-sm text-muted-foreground">Total Sales</span>
            </div>
            <p className="text-2xl font-bold text-foreground">456</p>
            <p className="text-xs text-success font-medium">+12% vs last month</p>
          </div>
          <div className="bg-card rounded-xl p-4 shadow-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <Target className="h-4 w-4 text-accent" />
              </div>
              <span className="text-sm text-muted-foreground">Conv. Rate</span>
            </div>
            <p className="text-2xl font-bold text-foreground">3.5%</p>
            <p className="text-xs text-success font-medium">+0.8% vs last month</p>
          </div>
          <div className="bg-card rounded-xl p-4 shadow-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-warning" />
              </div>
              <span className="text-sm text-muted-foreground">Avg. Order</span>
            </div>
            <p className="text-2xl font-bold text-foreground">₦45,200</p>
            <p className="text-xs text-success font-medium">+5% vs last month</p>
          </div>
        </div>
      </div>

      {/* Weekly Chart */}
      <div className="px-4 py-4">
        <div className="bg-card rounded-xl p-4 shadow-card">
          <h2 className="font-semibold text-foreground mb-4">Weekly Performance</h2>
          
          <div className="flex gap-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full gradient-primary" />
              <span className="text-sm text-muted-foreground">Clicks</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-success" />
              <span className="text-sm text-muted-foreground">Sales</span>
            </div>
          </div>

          <div className="flex items-end justify-between h-40 gap-2">
            {weeklyData.map((data, index) => {
              const clickHeight = (data.clicks / maxClicks) * 100;
              const saleHeight = (data.sales / maxSales) * 100;
              return (
                <div key={data.day} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex gap-0.5 items-end" style={{ height: "120px" }}>
                    <div
                      className="flex-1 rounded-t-sm gradient-primary animate-fade-up"
                      style={{ height: `${clickHeight}%`, animationDelay: `${index * 50}ms` }}
                    />
                    <div
                      className="flex-1 rounded-t-sm bg-success animate-fade-up"
                      style={{ height: `${saleHeight}%`, animationDelay: `${index * 50 + 25}ms` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{data.day}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-5 w-5 text-accent" />
          <h2 className="font-semibold text-foreground">Top Affiliates</h2>
        </div>
        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          {leaderboard.map((user, index) => (
            <div
              key={user.rank}
              className={`flex items-center gap-3 p-4 border-b border-border last:border-0 ${
                user.isCurrentUser ? "bg-primary/5" : ""
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                user.rank === 1 ? "gradient-gold text-accent-foreground" :
                user.rank === 2 ? "bg-muted-foreground/20 text-muted-foreground" :
                user.rank === 3 ? "bg-warning/20 text-warning" :
                "bg-muted text-muted-foreground"
              }`}>
                {user.rank}
              </div>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${
                user.isCurrentUser ? "gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {user.avatar}
              </div>
              <div className="flex-1">
                <p className={`font-medium ${user.isCurrentUser ? "text-primary" : "text-foreground"}`}>
                  {user.name}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-foreground">₦{user.earnings.toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default StatsPage;
