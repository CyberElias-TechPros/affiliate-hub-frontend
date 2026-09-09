import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Building2,
  ChevronRight,
  CreditCard,
  LogOut,
  Settings,
  ShieldCheck,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MenuItem } from "@/components/ui/MenuItem";
import { BottomNav } from "@/components/layout/BottomNav";
import { DataErrorState } from "@/components/routing/ProtectedRoute";
import { Seo } from "@/components/seo/Seo";
import { ApiClientError, NotificationAPI, ProfileAPI } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { formatMoney } from "@shared/api-contract";

/**
 * Profile.
 *
 * The prototype hardcoded "Chinedu Nwankwo" into the heading and left every
 * menu item wired to `onClick={() => {}}`, so four settings were advertised and
 * none of them worked. The name now comes from the session, the menu items route
 * somewhere real, and the two actions that belong on this page — marking
 * notifications read and signing out — actually do something.
 */
const ProfilePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => ProfileAPI.get() });
  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: () => NotificationAPI.list(),
  });
  // Separate endpoint: ProfileAPI.get returns { user, bank } only.
  const goal = useQuery({ queryKey: ["profile", "goal"], queryFn: () => ProfileAPI.goal() });

  const unread = notifications.data?.unreadCount ?? 0;

  const markAllRead = useMutation({
    mutationFn: () => NotificationAPI.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("All notifications marked as read");
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiClientError ? error.message : "We could not update your notifications.",
      ),
  });

  const handleLogout = async () => {
    await logout();
    navigate("/auth", { replace: true });
  };

  const initials = (user?.name ?? "?")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background pb-28">
      <Seo title="Profile" description="Your account and settings." path="/profile" robots="noindex, nofollow" />

      <header className="gradient-hero px-4 pb-6 pt-6">
        <div className="flex items-center gap-4">
          <div
            className="gradient-primary flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full text-xl font-bold text-primary-foreground"
            aria-hidden="true"
          >
            {initials}
          </div>
          <div className="min-w-0">
            <h1 className="font-display truncate text-xl font-bold text-foreground">
              {user?.name ?? "…"}
            </h1>
            <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
            {user?.tier && (
              <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium capitalize text-primary">
                {user.tier}
              </span>
            )}
          </div>
        </div>

        {!user?.onboardingCompleted && (
          <Link
            to="/onboarding"
            className="mt-4 block rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-primary"
          >
            Finish setting up your profile
            <ChevronRight className="ml-1 inline h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </header>

      <main id="main-content" className="px-4 py-4">
        {profile.isError ? (
          <DataErrorState message="We could not load your profile." onRetry={() => void profile.refetch()} />
        ) : (
          <>
            {goal.data && (
              <section className="bg-card shadow-card mb-4 rounded-xl p-4" aria-labelledby="goal-heading">
                <h2 id="goal-heading" className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                  <Target className="h-4 w-4 text-primary" aria-hidden="true" />
                  Monthly goal
                </h2>
                <p className="text-sm text-muted-foreground">
                  Target:{" "}
                  {formatMoney({
                    amountMinor: goal.data.targetMinor,
                    currency: goal.data.currency as "NGN" | "USD",
                  })}{" "}
                  per {goal.data.period}
                </p>
              </section>
            )}

            <section className="mb-6" aria-labelledby="account-heading">
              <h2 id="account-heading" className="mb-2 text-sm font-medium text-muted-foreground">
                Account
              </h2>
              <div className="bg-card shadow-card overflow-hidden rounded-xl">
                <MenuItem
                  icon={<Settings className="h-5 w-5 text-primary" aria-hidden="true" />}
                  title="Settings"
                  subtitle="Name, WhatsApp, goal and password"
                  onClick={() => navigate("/settings")}
                />
                <MenuItem
                  icon={<CreditCard className="h-5 w-5 text-primary" aria-hidden="true" />}
                  title="Payout details"
                  subtitle={
                    profile.data?.bank?.accountNumberMasked
                      ? "Saved account"
                      : "Add a bank account to withdraw"
                  }
                  value={profile.data?.bank?.accountNumberMasked ?? undefined}
                  onClick={() => navigate("/settings")}
                />
                <MenuItem
                  icon={<Building2 className="h-5 w-5 text-primary" aria-hidden="true" />}
                  title="Your links"
                  subtitle="Every link you have generated"
                  onClick={() => navigate("/links")}
                />
                <MenuItem
                  icon={<Bell className="h-5 w-5 text-primary" aria-hidden="true" />}
                  title="Mark notifications read"
                  subtitle={unread > 0 ? `${unread} unread` : "All caught up"}
                  onClick={() => markAllRead.mutate()}
                />
              </div>
            </section>

            <section className="mb-6" aria-labelledby="support-heading">
              <h2 id="support-heading" className="mb-2 text-sm font-medium text-muted-foreground">
                Support
              </h2>
              <div className="bg-card shadow-card overflow-hidden rounded-xl">
                <MenuItem
                  icon={<ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />}
                  title="Help centre"
                  subtitle="Payouts, tracking and your account"
                  onClick={() => navigate("/help")}
                />
              </div>
            </section>

            <Button
              variant="outline"
              className="h-12 w-full rounded-xl text-destructive hover:bg-destructive/5 hover:text-destructive"
              onClick={() => void handleLogout()}
            >
              <LogOut className="mr-2 h-5 w-5" />
              Sign out
            </Button>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Affiliate Hub ·{" "}
              <Link to="/terms" className="hover:underline">
                Terms
              </Link>{" "}
              ·{" "}
              <Link to="/privacy" className="hover:underline">
                Privacy
              </Link>
            </p>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default ProfilePage;
