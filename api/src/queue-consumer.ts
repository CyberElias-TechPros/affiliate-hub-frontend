import type { Env } from './lib/env';

/**
 * Withdrawal payout consumer.
 *
 * Honest integration status
 * ------------------------
 * The state machine here is complete and tested. The call to an actual payout
 * provider (Paystack Transfers, Flutterwave, a TRON node) is NOT implemented,
 * because it requires live provider credentials that this repository does not
 * contain. Until `PAYOUT_PROVIDER_WEBHOOK` and `PAYOUT_PROVIDER_SECRET` are
 * configured, a withdrawal is left `pending` and logged as awaiting settlement
 * — it is never silently marked `completed`.
 *
 * That is deliberate: marking a payout successful without a provider
 * confirmation would tell an affiliate their money has moved when it has not.
 */

interface PayoutMessage {
  kind: string;
  transactionId: string;
  userId: string;
  amountMinor: number;
  feeMinor: number;
  currency: string;
  method: string;
  destination: string;
  requestedAt: string;
}

interface ProviderEnv extends Env {
  PAYOUT_PROVIDER_WEBHOOK?: string;
  PAYOUT_PROVIDER_SECRET?: string;
}

export async function handlePayoutMessage(env: Env, body: unknown): Promise<void> {
  const message = body as PayoutMessage;

  if (!message || message.kind !== 'withdrawal' || !message.transactionId) {
    console.warn('payout_message_ignored', { reason: 'unrecognised payload' });
    return;
  }

  const tx = await env.DB.prepare(
    'SELECT id, user_id, status FROM transactions WHERE id = ?',
  )
    .bind(message.transactionId)
    .first<{ id: string; user_id: string; status: string }>();

  if (!tx) {
    // Retrying cannot help; the row is gone or never committed.
    console.warn('payout_transaction_missing', { transactionId: message.transactionId });
    return;
  }

  if (tx.status !== 'pending') {
    // Already settled or cancelled by the stale-withdrawal cron.
    console.log('payout_already_settled', { transactionId: tx.id, status: tx.status });
    return;
  }

  const providerEnv = env as ProviderEnv;
  if (!providerEnv.PAYOUT_PROVIDER_WEBHOOK || !providerEnv.PAYOUT_PROVIDER_SECRET) {
    console.warn('payout_awaiting_provider_configuration', {
      transactionId: tx.id,
      userId: tx.user_id,
      amountMinor: message.amountMinor,
    });
    return;
  }

  const providerReference = await callProvider(providerEnv, message);

  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB
      .prepare("UPDATE transactions SET status = 'completed', payout_reference = ?, updated_at = ? WHERE id = ?")
      .bind(providerReference, now, tx.id),
    env.DB
      .prepare('UPDATE wallets SET pending_minor = MAX(0, pending_minor - ?), updated_at = ? WHERE user_id = ?')
      .bind(message.amountMinor, now, tx.user_id),
    env.DB
      .prepare(
        `INSERT INTO notifications (id, user_id, title, body, href, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        tx.user_id,
        'Withdrawal complete',
        `Your withdrawal of ${(message.amountMinor / 100).toLocaleString('en-NG')} ${message.currency} has been paid out.`,
        '/wallet',
        now,
      ),
    env.DB
      .prepare(
        `INSERT INTO audit_events (id, actor_id, action, resource_type, resource_id, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        tx.user_id,
        'wallet.withdraw_settled',
        'transaction',
        tx.id,
        JSON.stringify({ providerReference, method: message.method }),
        now,
      ),
  ]);
}

/**
 * Hand the payout to the provider and return its reference.
 *
 * A non-2xx response throws, which makes the queue retry with backoff rather
 * than dropping the payout on the floor.
 */
async function callProvider(env: ProviderEnv, message: PayoutMessage): Promise<string> {
  const response = await fetch(env.PAYOUT_PROVIDER_WEBHOOK as string, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.PAYOUT_PROVIDER_SECRET}`,
      // Lets the provider reject a replayed or tampered delivery.
      'x-affiliate-hub-signature': await signPayload(env.PAYOUT_PROVIDER_SECRET as string, message),
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    throw new Error(`payout provider responded ${response.status}`);
  }

  const payload = (await response.json().catch(() => ({}))) as { reference?: string };
  return payload.reference ?? `local-${message.transactionId}`;
}

async function signPayload(secret: string, message: PayoutMessage): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(JSON.stringify(message)));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
