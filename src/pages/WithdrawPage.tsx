import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Building2, Check, DollarSign, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CustomInput } from "@/components/ui/CustomInput";
import { DataErrorState } from "@/components/routing/ProtectedRoute";
import { Seo } from "@/components/seo/Seo";
import { ApiClientError, WalletAPI } from "@/lib/api";
import { newIdempotencyKey } from "@/lib/validation";
import { formatMoney, toMinor, toMajor } from "@shared/api-contract";
import type { PayoutMethod } from "@shared/api-contract";

/**
 * Withdrawal flow.
 *
 * The prototype's submit handler was:
 *
 *     await new Promise((r) => setTimeout(r, 2000));
 *     toast.success("Withdrawal request submitted!");
 *     navigate("/wallet");
 *
 * It never called an API. It showed a success message for a withdrawal that did
 * not exist, against a balance hardcoded to ₦472,500. This is the version that
 * actually moves money.
 *
 * Three client-side behaviours matter:
 *  - The amount is converted to integer minor units before it is sent, so no
 *    float rounding reaches the ledger.
 *  - An idempotency key is generated once per attempt and reused on retry, so
 *    a double tap cannot pay out twice.
 *  - Fees and minimums come from the server, so the UI cannot advertise terms
 *    the API does not honour.
 */

const METHOD_ICONS: Record<PayoutMethod, React.ComponentType<{ className?: string }>> = {
  bank: Building2,
  usdt: DollarSign,
  paypal: Wallet,
};

const WithdrawPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = React.useState(1);
  const [amountText, setAmountText] = React.useState("");
  const [method, setMethod] = React.useState<PayoutMethod>("bank");
  const [destination, setDestination] = React.useState("");
  const [destinationError, setDestinationError] = React.useState<string | null>(null);

  // One key per attempt. Regenerated only when the user starts a new withdrawal,
  // not on every render or retry.
  const idempotencyKeyRef = React.useRef<string>(newIdempotencyKey());

  const summary = useQuery({ queryKey: ["wallet", "summary"], queryFn: () => WalletAPI.summary() });
  const options = useQuery({ queryKey: ["wallet", "payout-options"], queryFn: () => WalletAPI.payoutOptions() });

  const available = summary.data?.available;
  const currency = available?.currency ?? "NGN";
  const availableMinor = available?.amountMinor ?? 0;

  const selectedOption = options.data?.options.find((o) => o.method === method);
  const amountMinor = amountText.trim() === "" ? 0 : toMinor(Number(amountText.replace(/,/g, "")), currency);
  const feeMinor = selectedOption ? Math.round((amountMinor * selectedOption.feeBps) / 10_000) : 0;

  const isValidAmount =
    amountMinor > 0 &&
    availableMinor > 0 &&
    amountMinor <= availableMinor &&
    (!selectedOption || amountMinor >= selectedOption.minimumMinor);

  const destinationLabel =
    method === "bank"
      ? "Account number (NUBAN)"
      : method === "usdt"
        ? "TRC-20 wallet address"
        : "PayPal email";

  const destinationPlaceholder =
    method === "bank" ? "0123456789" : method === "usdt" ? "TQrZ9wBsZ3xw8VtKK3mnbFQeJmfvqVrYhZ" : "you@example.com";

  const validateDestination = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return "Enter your payout destination";
    if (method === "bank") return /^\d{10}$/.test(trimmed) ? null : "Enter your 10-digit NUBAN account number";
    if (method === "usdt")
      return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(trimmed) ? null : "Enter a valid TRC-20 address starting with T";
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed) ? null : "Enter the email on your PayPal account";
  };

  const withdraw = useMutation({
    mutationFn: () =>
      WalletAPI.withdraw({
        amountMinor,
        currency,
        method,
        destination: destination.trim(),
        idempotencyKey: idempotencyKeyRef.current,
      }),
    onSuccess: (result) => {
      // Balances and history both changed; both caches must be dropped or the
      // wallet page will show the pre-withdrawal figure.
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      void queryClient.invalidateQueries({ queryKey: ["stats"] });

      toast.success(
        result.deduplicated
          ? "That withdrawal was already submitted."
          : `${formatMoney(result.amount)} is on its way.`,
      );
      navigate("/wallet");
    },
    onError: (error) => {
      // A failed attempt must get a fresh key, otherwise a corrected retry
      // would be deduplicated against the failed one.
      idempotencyKeyRef.current = newIdempotencyKey();

      if (error instanceof ApiClientError) {
        if (error.fields.destination) {
          setDestinationError(error.fields.destination);
          setStep(2);
        }
        toast.error(error.message);
        return;
      }
      toast.error("We could not submit that withdrawal. Please try again.");
    },
  });

  const handleAmountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/[^0-9]/g, "");
    setAmountText(digits === "" ? "" : Number(digits).toLocaleString("en-NG"));
  };

  const canContinueToDestination = isValidAmount;

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Withdraw funds"
        description="Withdraw your affiliate earnings."
        path="/withdraw"
        robots="noindex, nofollow"
      />

      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="flex items-center gap-3 px-4 py-4">
          <button
            type="button"
            onClick={() => (step > 1 ? setStep(step - 1) : navigate(-1))}
            className="rounded-full p-2 transition-colors hover:bg-muted"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-lg font-semibold">Withdraw funds</h1>
        </div>
        <div className="px-4 pb-4">
          <div className="flex gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step} aria-label={`Step ${step} of 3`}>
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-all ${s <= step ? "gradient-primary" : "bg-muted"}`}
              />
            ))}
          </div>
        </div>
      </header>

      <main id="main-content" className="p-4">
        {summary.isError ? (
          <DataErrorState
            message="We could not load your balance, so withdrawals are unavailable."
            onRetry={() => void summary.refetch()}
          />
        ) : step === 1 ? (
          <div className="animate-fade-in space-y-6">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Enter amount</h2>
              <p className="text-muted-foreground">
                Available:{" "}
                <span className="font-medium text-foreground">
                  {summary.isLoading ? "…" : available ? formatMoney(available) : "—"}
                </span>
              </p>
            </div>

            <div>
              <label htmlFor="withdraw-amount" className="sr-only">
                Amount to withdraw
              </label>
              <div className="relative">
                <span
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground"
                  aria-hidden="true"
                >
                  {currency === "NGN" ? "₦" : "$"}
                </span>
                <input
                  id="withdraw-amount"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={amountText}
                  onChange={handleAmountChange}
                  placeholder="0"
                  aria-invalid={amountText !== "" && !isValidAmount}
                  className="h-16 w-full rounded-xl border border-input bg-card pl-12 pr-4 text-3xl font-bold text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {amountText !== "" && !isValidAmount && (
                <p className="mt-2 flex items-center gap-1 text-sm text-destructive" role="alert">
                  <AlertCircle className="h-4 w-4" aria-hidden="true" />
                  {selectedOption && amountMinor < selectedOption.minimumMinor
                    ? `The minimum for ${selectedOption.label} is ${formatMoney({
                        amountMinor: selectedOption.minimumMinor,
                        currency,
                      })}`
                    : amountMinor > availableMinor
                      ? "That is more than your available balance"
                      : "Enter an amount greater than zero"}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              {[10_000, 50_000, 100_000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmountText(preset.toLocaleString("en-NG"))}
                  className="flex-1 rounded-lg bg-muted py-2 font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  {currency === "NGN" ? `₦${preset / 1000}K` : `$${preset / 100}`}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAmountText(toMajor(availableMinor, currency).toLocaleString("en-NG"))}
                className="flex-1 rounded-lg bg-primary/10 py-2 font-medium text-primary transition-colors hover:bg-primary/20"
              >
                Max
              </button>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-foreground">Payout method</h3>
              <div className="space-y-2">
                {(options.data?.options ?? []).map((option) => {
                  const Icon = METHOD_ICONS[option.method];
                  const isSelected = method === option.method;
                  return (
                    <button
                      key={option.method}
                      type="button"
                      onClick={() => {
                        setMethod(option.method);
                        setDestinationError(null);
                      }}
                      aria-pressed={isSelected}
                      className={`flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                        isSelected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"
                      }`}
                    >
                      <Icon className="h-5 w-5 text-primary" />
                      <span className="flex-1">
                        <span className="block font-medium text-foreground">{option.label}</span>
                        <span className="block text-sm text-muted-foreground">{option.description}</span>
                      </span>
                      <span className="text-right text-sm">
                        <span className="block font-medium text-foreground">
                          {option.feeBps === 0 ? "Free" : `${option.feeBps / 100}% fee`}
                        </span>
                        <span className="block text-muted-foreground">{option.estimatedSettlement}</span>
                      </span>
                      {isSelected && <Check className="h-5 w-5 text-primary" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              disabled={!canContinueToDestination}
              onClick={() => setStep(2)}
              className="gradient-primary h-14 w-full rounded-xl font-semibold text-primary-foreground shadow-glow"
            >
              Continue
            </Button>
          </div>
        ) : step === 2 ? (
          <div className="animate-fade-in space-y-6">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Where should we send it?</h2>
              <p className="text-muted-foreground">Double-check this — we cannot recall a payout.</p>
            </div>

            <CustomInput
              id="withdraw-destination"
              label={destinationLabel}
              value={destination}
              onChange={(e) => {
                setDestination(e.target.value);
                setDestinationError(null);
              }}
              placeholder={destinationPlaceholder}
              error={destinationError ?? undefined}
              autoComplete="off"
              inputMode={method === "paypal" ? "email" : "text"}
            />

            <div className="flex gap-3">
              <Button variant="outline" className="h-12 flex-1 rounded-xl" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                className="gradient-primary h-12 flex-1 rounded-xl font-semibold text-primary-foreground"
                onClick={() => {
                  const issue = validateDestination(destination);
                  if (issue) {
                    setDestinationError(issue);
                    return;
                  }
                  setStep(3);
                }}
              >
                Review
              </Button>
            </div>
          </div>
        ) : (
          <div className="animate-fade-in space-y-6">
            <h2 className="font-display text-xl font-bold text-foreground">Confirm withdrawal</h2>

            <dl className="bg-card shadow-card space-y-3 rounded-xl p-4">
              <Row label="Amount" value={formatMoney({ amountMinor, currency })} />
              <Row
                label="Fee"
                value={feeMinor === 0 ? "Free" : formatMoney({ amountMinor: feeMinor, currency })}
              />
              <Row
                label="You receive"
                value={formatMoney({ amountMinor: amountMinor - feeMinor, currency })}
                strong
              />
              <Row label="Method" value={selectedOption?.label ?? method} />
              <Row label="Destination" value={destination} />
            </dl>

            {withdraw.isError && (
              <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                {withdraw.error instanceof ApiClientError
                  ? withdraw.error.message
                  : "We could not submit that withdrawal."}
              </p>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="h-12 flex-1 rounded-xl"
                disabled={withdraw.isPending}
                onClick={() => setStep(2)}
              >
                Back
              </Button>
              <Button
                className="gradient-primary h-12 flex-1 rounded-xl font-semibold text-primary-foreground"
                disabled={withdraw.isPending}
                onClick={() => withdraw.mutate()}
              >
                {withdraw.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Confirm withdrawal"
                )}
              </Button>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Submitting twice will not pay out twice — the request is deduplicated.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => (
  <div className="flex items-center justify-between">
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className={strong ? "font-bold text-foreground" : "font-medium text-foreground"}>{value}</dd>
  </div>
);

export default WithdrawPage;
