import type { Currency, PayoutMethod, PayoutOption } from '../../../shared/api-contract';

/**
 * Payout configuration.
 *
 * Single source of truth for fees and minimums. The prototype hardcoded a
 * "1%"/"2%" fee in the React component and enforced no minimum at all on the
 * server, so the client and server disagreed about what a valid withdrawal
 * was. Fees and minimums are business rules and must live server-side.
 */
export interface PayoutConfig {
  method: PayoutMethod;
  label: string;
  description: string;
  feeBps: number;
  minimumMinor: number;
  estimatedSettlement: string;
  /** Currencies this method can pay out in. */
  currencies: Currency[];
}

export const PAYOUT_CONFIG: Record<PayoutMethod, PayoutConfig> = {
  bank: {
    method: 'bank',
    label: 'Nigerian bank transfer',
    description: 'Send straight to your Naira account. Free, and usually same day.',
    feeBps: 0,
    minimumMinor: 500_000, // ₦5,000.00 — matches the minimum the UI advertises
    estimatedSettlement: 'Within 2 hours',
    currencies: ['NGN'],
  },
  usdt: {
    method: 'usdt',
    label: 'USDT (TRC-20)',
    description: 'On-chain transfer to your TRC-20 wallet address.',
    feeBps: 100, // 1%
    minimumMinor: 5_000, // $50.00
    estimatedSettlement: 'Usually under 10 minutes',
    currencies: ['USD'],
  },
  paypal: {
    method: 'paypal',
    label: 'PayPal',
    description: 'Paid to your PayPal balance in US dollars.',
    feeBps: 200, // 2%
    minimumMinor: 5_000, // $50.00
    estimatedSettlement: 'Within 24 hours',
    currencies: ['USD'],
  },
};

/** Fee for a withdrawal, in integer minor units. Rounded half up. */
export function feeFor(method: PayoutMethod, amountMinor: number): number {
  const { feeBps } = PAYOUT_CONFIG[method];
  if (feeBps <= 0) return 0;
  return Math.round((amountMinor * feeBps) / 10_000);
}

export function payoutOptions(currency?: Currency): PayoutOption[] {
  return Object.values(PAYOUT_CONFIG)
    .filter((cfg) => !currency || cfg.currencies.includes(currency))
    .map(({ method, label, description, feeBps, minimumMinor, estimatedSettlement }) => ({
      method,
      label,
      description,
      feeBps,
      minimumMinor,
      estimatedSettlement,
    }));
}

/**
 * Destination shape varies by method. Validate per method rather than trusting
 * a free-text field — a malformed payout destination is money lost.
 */
export function destinationIssue(method: PayoutMethod, destination: string): string | null {
  const value = destination.trim();
  switch (method) {
    case 'bank':
      // Nigerian account numbers are 10 digits.
      return /^\d{10}$/.test(value) ? null : 'Enter your 10-digit NUBAN account number';
    case 'usdt':
      // TRC-20 addresses: base58, 34 chars, starting with 'T'.
      return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value) ? null : 'Enter a valid TRC-20 address starting with T';
    case 'paypal':
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) ? null : 'Enter the email on your PayPal account';
    default:
      return 'Unknown payout method';
  }
}
