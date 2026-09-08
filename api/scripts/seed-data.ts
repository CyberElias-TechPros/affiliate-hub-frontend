import type { D1Database } from '@cloudflare/workers-types';

/**
 * Deterministic seed data.
 *
 * Used by `npm run seed:local` for development and by the test suite, so tests
 * exercise the same shape of data a developer sees locally.
 *
 * Everything here is clearly-labelled demonstration data. It replaces the
 * prototype's habit of hardcoding plausible-looking numbers inside React
 * components, where they could never be distinguished from real data.
 */

const PBKDF2_ITERATIONS = 210_000;

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  return `pbkdf2$sha256$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(new Uint8Array(bits))}`;
}

function b64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface SeedOptions {
  /** Password for the demo accounts. Development only. */
  password?: string;
}

export const DEMO_AFFILIATE = {
  email: 'demo@affiliatehub.test',
  name: 'Chinedu Nwankwo',
  referralCode: 'demo-chinedu',
};

export const DEMO_PASSWORD_DEFAULT = 'Demo1234567';

export async function seedDatabase(db: D1Database, options: SeedOptions = {}): Promise<void> {
  const password = options.password ?? DEMO_PASSWORD_DEFAULT;
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  const affiliateId = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO users (id, name, email, password_hash, country, referral_code, tier,
                          onboarding_completed, niches, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'NG', ?, 'pro', 1, ?, ?, ?)`,
    )
    .bind(
      affiliateId,
      DEMO_AFFILIATE.name,
      DEMO_AFFILIATE.email,
      passwordHash,
      DEMO_AFFILIATE.referralCode,
      JSON.stringify(['tech', 'finance']),
      now,
      now,
    )
    .run();

  await db
    .prepare(`INSERT INTO wallets (user_id, currency, available_minor, pending_minor, updated_at)
              VALUES (?, 'NGN', 0, 0, ?)`)
    .bind(affiliateId, now)
    .run();

  // Products. Prices are integer kobo; commission is basis points.
  const products = [
    {
      slug: 'forex-mastery-course',
      title: 'Forex Mastery: Beginner to Funded Trader',
      summary: 'A structured 12-week path from your first chart to a funded account.',
      description:
        'Twelve weeks of video lessons, weekly live reviews and a risk calculator. Built for traders in Nigeria who want a repeatable process instead of signals.',
      category: 'education',
      priceMinor: 15_000_000, // ₦150,000.00
      commissionBps: 4500, // 45%
      merchant: 'Naira Traders Academy',
      whyPromote: [
        'Nigeria\u2019s most-completed trading course, with a 68% completion rate',
        '45% commission is among the highest in the education category',
        '30-day cookie window, so a weekend browser still credits you',
        'Monthly cohort launches mean there is always a deadline to promote',
      ],
    },
    {
      slug: 'pulse-fitness-watch-2',
      title: 'Pulse Fitness Watch 2',
      summary: 'Heart-rate, sleep and SpO2 tracking with a 10-day battery.',
      description:
        'A physical wearable shipped from Lagos, so delivery is 2\u20134 days nationwide rather than three weeks from overseas.',
      category: 'physical',
      priceMinor: 4_500_000, // ₦45,000.00
      commissionBps: 2500, // 25%
      merchant: 'Pulse Wellness NG',
      whyPromote: [
        'Ships locally, so refunds and returns are rare',
        'Strong gifting demand in November and December',
        'Bundles well with fitness content creators',
      ],
    },
    {
      slug: 'glow-organic-skincare-set',
      title: 'Glow Organic Skincare Set',
      summary: 'A four-step routine formulated for melanin-rich skin.',
      description:
        'Cleanser, toner, serum and moisturiser. Dermatologist reviewed and free of hydroquinone.',
      category: 'beauty',
      priceMinor: 2_800_000, // ₦28,000.00
      commissionBps: 3000, // 30%
      merchant: 'Glow Botanics',
      whyPromote: [
        'High repeat purchase rate \u2014 customers reorder every six weeks',
        'Photographs well, which lifts click-through on WhatsApp status',
        'Free delivery over \u20a620,000 reduces abandoned carts',
      ],
    },
    {
      slug: 'sme-bookkeeping-toolkit',
      title: 'SME Bookkeeping Toolkit',
      summary: 'Spreadsheets, templates and a FIRS filing checklist for small businesses.',
      description:
        'Everything a one-person business needs to stay compliant, including a tax calculator tuned to current Nigerian rates.',
      category: 'finance',
      priceMinor: 1_900_000, // ₦19,000.00
      commissionBps: 5000, // 50%
      merchant: 'LedgerLab',
      whyPromote: [
        'Highest commission rate in the catalogue at 50%',
        'Evergreen demand \u2014 no seasonal dip',
        'Business audiences convert from LinkedIn and X as well as WhatsApp',
      ],
    },
    {
      slug: 'home-workout-program',
      title: '12-Week Home Workout Program',
      summary: 'No equipment, 20 minutes a day, with a printable tracker.',
      description: 'Progressive overload without a gym. Includes modifications for beginners and for postpartum users.',
      category: 'health',
      priceMinor: 950_000, // ₦9,500.00
      commissionBps: 4000, // 40%
      merchant: 'FitNaija',
      whyPromote: ['Low price point converts well on first click', '40% commission on a digital product'],
    },
    {
      slug: 'logo-design-service',
      title: 'Professional Logo Design Service',
      summary: 'Three concepts, unlimited revisions, delivered in 72 hours.',
      description: 'A done-for-you service for new businesses, delivered by vetted designers.',
      category: 'services',
      priceMinor: 7_500_000, // ₦75,000.00
      commissionBps: 2000, // 20%
      merchant: 'BrandSmith Studio',
      whyPromote: ['High ticket value means meaningful commission per sale'],
    },
  ];

  for (const product of products) {
    const id = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO products (id, slug, title, summary, description, category, status,
                               price_minor, currency, commission_bps, image_url, gallery,
                               merchant, cookie_days, why_promote, total_promotions,
                               has_promo_assets, published_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?, 'NGN', ?, ?, '[]', ?, 30, ?, 0, 0, ?, ?, ?)`,
      )
      .bind(
        id,
        product.slug,
        product.title,
        product.summary,
        product.description,
        product.category,
        product.priceMinor,
        product.commissionBps,
        `/placeholder.svg`,
        product.merchant,
        JSON.stringify(product.whyPromote),
        now,
        now,
        now,
      )
      .run();

    if (product.slug === 'forex-mastery-course') {
      // One tracked link with real click and conversion history, so the
      // dashboard renders from data rather than from constants.
      const linkId = crypto.randomUUID();
      await db
        .prepare(`INSERT INTO affiliate_links (id, user_id, product_id, code, created_at) VALUES (?, ?, ?, ?, ?)`)
        .bind(linkId, affiliateId, id, 'demoaff01', now)
        .run();

      const clickRows: D1PreparedStatement[] = [];
      for (let day = 6; day >= 0; day--) {
        const clicks = 40 + day * 7;
        for (let n = 0; n < clicks; n++) {
          const ts = new Date(Date.now() - day * 86_400_000 - n * 60_000).toISOString();
          clickRows.push(
            db
              .prepare(
                `INSERT INTO clicks (id, link_id, visitor_hash, user_agent, country, referrer, created_at)
                 VALUES (?, ?, ?, 'seed', 'NG', NULL, ?)`,
              )
              .bind(crypto.randomUUID(), linkId, `seed-visitor-${day}-${n}`, ts),
          );
        }
      }
      await db.batch(clickRows);

      await db
        .prepare(
          `INSERT INTO conversions (id, link_id, order_reference, order_total_minor,
                                    commission_minor, currency, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'NGN', 'approved', ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          linkId,
          'SEED-ORDER-0001',
          15_000_000,
          6_750_000, // 45% of ₦150,000
          new Date(Date.now() - 2 * 86_400_000).toISOString(),
          now,
        )
        .run();

      await db.batch([
        db
          .prepare(
            `INSERT INTO transactions (id, user_id, type, status, amount_minor, fee_minor, currency,
                                       description, product_id, created_at, updated_at)
             VALUES (?, ?, 'commission', 'completed', 6750000, 0, 'NGN',
                     'Commission: Forex Mastery sale', ?, ?, ?)`,
          )
          .bind(crypto.randomUUID(), affiliateId, id, new Date(Date.now() - 2 * 86_400_000).toISOString(), now),
        db
          .prepare(`UPDATE wallets SET available_minor = available_minor + 6750000, updated_at = ? WHERE user_id = ?`)
          .bind(now, affiliateId),
      ]);
    }
  }

  await db
    .prepare(`INSERT INTO affiliate_goals (user_id, target_minor, currency, period, updated_at)
              VALUES (?, 50000000, 'NGN', 'monthly', ?)`)
    .bind(affiliateId, now)
    .run();

  const faqs = [
    {
      question: 'How much does it cost to join Affiliate Hub?',
      answer:
        'Nothing. Creating an account, generating links and downloading promo material is free. We earn a share of the commission the merchant already pays, so there is no fee for you.',
      category: 'getting-started',
    },
    {
      question: 'When do commissions appear in my wallet?',
      answer:
        'A conversion shows as pending the moment an order is recorded. It becomes available once the merchant confirms the sale and the refund window closes, which is usually 14 to 30 days depending on the product.',
      category: 'earnings',
    },
    {
      question: 'What is the minimum withdrawal?',
      answer:
        'The minimum is ₦5,000 for a Nigerian bank transfer, which is free. PayPal and USDT withdrawals start at $50 and carry a 2% and 1% fee respectively.',
      category: 'payouts',
    },
    {
      question: 'How long does a withdrawal take?',
      answer:
        'Bank transfers usually settle within two hours during banking days. USDT transfers are typically on-chain within ten minutes. PayPal payments are completed within 24 hours.',
      category: 'payouts',
    },
    {
      question: 'Do I need a large audience to start?',
      answer:
        'No. Most affiliates start with a WhatsApp status audience or a small Instagram page. What matters is that the people you share with trust your recommendation.',
      category: 'getting-started',
    },
    {
      question: 'What happens if someone buys after clicking a different link?',
      answer:
        'Each product has a cookie window, shown on the product page, typically 30 days. The last valid affiliate link clicked inside that window earns the commission.',
      category: 'tracking',
    },
    {
      question: 'Can I promote on WhatsApp?',
      answer:
        'Yes, and it is the most effective channel for Nigerian audiences. Every product includes a ready-to-paste caption and shareable images.',
      category: 'promotion',
    },
    {
      question: 'Is my bank account number safe?',
      answer:
        'Your account number is encrypted before it is stored and is only ever shown back to you masked. Our support team cannot see the full number.',
      category: 'security',
    },
  ];

  for (const [index, faq] of faqs.entries()) {
    await db
      .prepare(
        `INSERT INTO faqs (id, question, answer, category, position, published, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .bind(crypto.randomUUID(), faq.question, faq.answer, faq.category, index, now, now)
      .run();
  }

  // A starting FX rate so the wallet's secondary balance is not blank on a
  // fresh install. Labelled as bootstrap so it is never mistaken for a live
  // market feed.
  const existingFx = await db.prepare('SELECT COUNT(*) AS total FROM fx_rates').first<{ total: number }>();
  if ((existingFx?.total ?? 0) === 0) {
    await db.batch([
      db
        .prepare(
          `INSERT INTO fx_rates (id, base, quote, rate_scaled, as_of, source, created_at)
           VALUES (?, 'NGN', 'USD', ?, ?, 'bootstrap-default', ?)`,
        )
        .bind(crypto.randomUUID(), Math.round((1 / 1500) * 1_000_000), now, now),
      db
        .prepare(
          `INSERT INTO fx_rates (id, base, quote, rate_scaled, as_of, source, created_at)
           VALUES (?, 'USD', 'NGN', ?, ?, 'bootstrap-default', ?)`,
        )
        .bind(crypto.randomUUID(), 1500 * 1_000_000, now, now),
    ]);
  }
}

