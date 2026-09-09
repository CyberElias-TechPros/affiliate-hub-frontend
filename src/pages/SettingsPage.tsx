import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CustomInput } from "@/components/ui/CustomInput";
import { DataErrorState } from "@/components/routing/ProtectedRoute";
import { Seo } from "@/components/seo/Seo";
import { ApiClientError, ProfileAPI, AuthAPI } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { PASSWORD_MIN } from "@/lib/validation";
import { formatMoney, money, toMajor } from "@shared/api-contract";
import type { PublicUser } from "@shared/api-contract";

/**
 * Settings: profile, payout details, goal and password.
 *
 * In the prototype these were four menu items on the profile page wired to
 * `onClick={() => {}}`. Clicking them did nothing at all. They now do the work.
 */
const SettingsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, setUser, refresh } = useAuth();

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => ProfileAPI.get() });

  return (
    <div className="min-h-screen bg-background pb-16">
      <Seo title="Settings" description="Manage your account." path="/settings" robots="noindex, nofollow" />

      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="flex items-center gap-3 px-4 py-4">
          <button
            type="button"
            onClick={() => navigate("/profile")}
            className="rounded-full p-2 transition-colors hover:bg-muted"
            aria-label="Back to profile"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-lg font-semibold">Settings</h1>
        </div>
      </header>

      <main id="main-content" className="space-y-8 px-4 py-6">
        {profile.isError ? (
          <DataErrorState message="We could not load your settings." onRetry={() => void profile.refetch()} />
        ) : (
          <>
            <ProfileSection defaultName={user?.name ?? ""} defaultCountry={user?.country ?? "NG"} defaultWhatsapp={user?.whatsapp ?? ""} onSaved={setUser} />
            <BankSection defaultBank={profile.data?.bank} />
            <GoalSection />
            <PasswordSection onChanged={() => void refresh()} />
          </>
        )}
      </main>
    </div>
  );
};

const Section: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({
  title,
  description,
  children,
}) => (
  <section aria-labelledby={title.toLowerCase().replace(/\s+/g, "-")}>
    <h2 id={title.toLowerCase().replace(/\s+/g, "-")} className="font-display text-lg font-semibold text-foreground">
      {title}
    </h2>
    {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    <div className="mt-4">{children}</div>
  </section>
);

const ProfileSection: React.FC<{
  defaultName: string;
  defaultCountry: string;
  defaultWhatsapp: string;
  onSaved: (user: PublicUser) => void;
}> = ({ defaultName, defaultCountry, defaultWhatsapp, onSaved }) => {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState(defaultName);
  const [country, setCountry] = React.useState(defaultCountry);
  const [whatsapp, setWhatsapp] = React.useState(defaultWhatsapp);

  const save = useMutation({
    mutationFn: () => ProfileAPI.update({ name, country, whatsapp: whatsapp || null }),
    onSuccess: ({ user }) => {
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      onSaved(user);
      toast.success("Profile updated");
    },
    onError: (error) => toast.error(error instanceof ApiClientError ? error.message : "Could not save your profile."),
  });

  return (
    <Section title="Personal information">
      <div className="space-y-4">
        <CustomInput id="settings-name" label="Full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        <CustomInput
          id="settings-country"
          label="Country code"
          value={country}
          onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))}
          hint="Two-letter code, e.g. NG"
        />
        <CustomInput
          id="settings-whatsapp"
          label="WhatsApp number"
          type="tel"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="+2348012345678"
          hint="Optional. Used for sale notifications."
        />
        <Button className="gradient-primary h-12 w-full rounded-xl font-semibold text-primary-foreground" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save changes
        </Button>
      </div>
    </Section>
  );
};

const BankSection: React.FC<{ defaultBank?: { bankName: string | null; accountName: string | null; accountNumberMasked: string | null } }> = ({
  defaultBank,
}) => {
  const queryClient = useQueryClient();
  const [bankName, setBankName] = React.useState(defaultBank?.bankName ?? "");
  const [accountName, setAccountName] = React.useState(defaultBank?.accountName ?? "");
  const [accountNumber, setAccountNumber] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => ProfileAPI.saveBankDetails({ bankName, accountName, accountNumber }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      setAccountNumber("");
      setError(null);
      toast.success("Payout details saved");
    },
    onError: (e) => {
      setError(e instanceof ApiClientError ? (e.fields.accountNumber ?? e.message) : "Could not save your details.");
    },
  });

  return (
    <Section title="Payout details" description="Your account number is encrypted at rest and only ever shown back masked.">
      <div className="space-y-4">
        {defaultBank?.accountNumberMasked && (
          <p className="rounded-xl border border-border bg-muted p-3 text-sm text-muted-foreground">
            Current account: <span className="font-mono text-foreground">{defaultBank.accountNumberMasked}</span>
          </p>
        )}
        <CustomInput id="settings-bank" label="Bank name" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="GTBank" />
        <CustomInput id="settings-account-name" label="Account name" value={accountName} onChange={(e) => setAccountName(e.target.value)} autoComplete="name" />
        <CustomInput
          id="settings-account-number"
          label="Account number (NUBAN)"
          value={accountNumber}
          onChange={(e) => {
            setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10));
            setError(null);
          }}
          inputMode="numeric"
          placeholder="0123456789"
          error={error ?? undefined}
          hint={defaultBank?.accountNumberMasked ? "Enter a new number to replace the saved one." : "10 digits."}
        />
        <Button
          className="gradient-primary h-12 w-full rounded-xl font-semibold text-primary-foreground"
          disabled={save.isPending || accountNumber.length !== 10 || !bankName || !accountName}
          onClick={() => save.mutate()}
        >
          {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save payout details
        </Button>
      </div>
    </Section>
  );
};

const GoalSection: React.FC = () => {
  const queryClient = useQueryClient();
  const goal = useQuery({ queryKey: ["profile", "goal"], queryFn: () => ProfileAPI.goal() });
  const [target, setTarget] = React.useState("");

  React.useEffect(() => {
    if (goal.data) setTarget(String(toMajor(goal.data.targetMinor, goal.data.currency as "NGN" | "USD")));
  }, [goal.data]);

  const save = useMutation({
    mutationFn: () => ProfileAPI.setGoal({ targetMinor: Math.round(Number(target) * 100), currency: "NGN", period: "monthly" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile", "goal"] });
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast.success("Goal updated");
    },
    onError: (e) => toast.error(e instanceof ApiClientError ? e.message : "Could not save your goal."),
  });

  const currency = (goal.data?.currency ?? "NGN") as "NGN" | "USD";

  return (
    <Section title="Monthly goal" description="Shown as a progress bar on your dashboard.">
      <div className="space-y-4">
        <CustomInput
          id="settings-goal"
          label="Target"
          value={target}
          onChange={(e) => setTarget(e.target.value.replace(/[^0-9]/g, ""))}
          inputMode="numeric"
          hint={target ? `That is ${formatMoney(money(Math.round(Number(target) * 100), currency))}` : undefined}
        />
        <Button
          variant="outline"
          className="h-12 w-full rounded-xl"
          disabled={save.isPending || !target || Number(target) <= 0}
          onClick={() => save.mutate()}
        >
          Save goal
        </Button>
      </div>
    </Section>
  );
};

const PasswordSection: React.FC<{ onChanged: () => void }> = ({ onChanged }) => {
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => AuthAPI.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setError(null);
      onChanged();
      // Changing a password revokes every session server-side, including this one.
      toast.success("Password changed. Please sign in again on your other devices.");
    },
    onError: (e) => {
      setError(e instanceof ApiClientError ? (e.fields.currentPassword ?? e.message) : "Could not change your password.");
    },
  });

  return (
    <Section title="Password" description={`At least ${PASSWORD_MIN} characters, with a letter and a number.`}>
      <div className="space-y-4">
        <CustomInput
          id="settings-current-password"
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <CustomInput
          id="settings-new-password"
          label="New password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => {
            setNewPassword(e.target.value);
            setError(null);
          }}
        />
        <Button
          className="h-12 w-full rounded-xl"
          variant="outline"
          disabled={save.isPending || !currentPassword || newPassword.length < PASSWORD_MIN}
          onClick={() => save.mutate()}
        >
          {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Change password
        </Button>
      </div>
    </Section>
  );
};

export default SettingsPage;
