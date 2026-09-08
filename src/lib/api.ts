import type {
  ApiResponse,
  ApiError,
  AuthSession,
  BankDetails,
  DashboardStats,
  ErrorCode,
  FaqItem,
  LeaderboardEntry,
  LoginRequest,
  Notification,
  OnboardingRequest,
  Page,
  PayoutOption,
  Product,
  ProductListQuery,
  ProductSort,
  PromoAsset,
  PublicUser,
  SignupRequest,
  StatsRange,
  Transaction,
  TransactionStatus,
  TransactionType,
  WalletSummary,
  WithdrawRequest,
  WithdrawResult,
  AffiliateLink,
} from '@shared/api-contract';
import { config } from './config';

/**
 * Typed API client.
 *
 * Design notes:
 *  - Requests use `fetch`, not axios. axios adds ~14 kB gzipped and its
 *    interceptor model was doing nothing here that a 40-line function cannot.
 *    Removing it also removes the five `any` types the linter rejected.
 *  - Every response is the `{ ok, data | error }` envelope. A non-envelope
 *    response (a proxy error page, an HTML 502) is converted into a typed
 *    client error rather than thrown raw.
 *  - A 401 does NOT hard-redirect. The prototype ran
 *    `window.location.href = '/auth'` from an interceptor, which threw away
 *    the whole React tree and the user's in-progress form. It now raises an
 *    event the AuthContext handles with a client-side navigation.
 */

const TOKEN_KEY = 'affiliatehub.accessToken';
const REFRESH_KEY = 'affiliatehub.refreshToken';

export const UNAUTHENTICATED_EVENT = 'affiliatehub:unauthenticated';

/**
 * Guards the sign-out event.
 *
 * A single screen can easily have three queries in flight. When a token
 * expires they all fail with 401 at once, and without this flag the auth
 * context would run its sign-out routine three times in the same tick —
 * clearing storage, dispatching three events, and re-rendering the tree for
 * each one.
 */
let unauthenticatedDispatched = false;

/** Reset by a successful sign-in, so a later expiry can fire again. */
export function resetUnauthenticatedFlag(): void {
  unauthenticatedDispatched = false;
}

function notifyUnauthenticated(): void {
  if (unauthenticatedDispatched) return;
  unauthenticatedDispatched = true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(UNAUTHENTICATED_EVENT));
  }
}

export class ApiClientError extends Error {
  readonly code: ErrorCode | 'network_error' | 'unknown_error';
  readonly status: number;
  readonly fields: Record<string, string>;
  readonly requestId: string;

  /**
   * Whether retrying the identical request could plausibly succeed.
   *
   * The error screens offer a retry button; showing it for a 404 or a
   * validation failure is worse than showing nothing, because it invites the
   * user to repeat an action that will fail identically every time.
   *   - 0            no response arrived (offline, DNS, timeout)
   *   - 408 / 429    the server asked us to come back
   *   - 5xx          the server failed, likely transiently
   * Everything else is a definite answer about this request.
   */
  readonly retryable: boolean;

  constructor(
    code: ErrorCode | 'network_error' | 'unknown_error',
    message: string,
    options: { status?: number; fields?: Record<string, string>; requestId?: string } = {},
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = options.status ?? 0;
    this.fields = options.fields ?? {};
    this.requestId = options.requestId ?? '';
    this.retryable =
      this.status === 0 ||
      this.status === 408 ||
      this.status === 429 ||
      (this.status >= 500 && this.status <= 599);
  }

  /** A message suitable for showing next to the field the user got wrong. */
  fieldMessage(field: string): string | undefined {
    return this.fields[field];
  }
}

/* ------------------------------- token store ------------------------------ */

export const tokenStore = {
  get access(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  get refresh(): string | null {
    try {
      return localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },
  set(session: { accessToken: string; refreshToken: string }): void {
    try {
      localStorage.setItem(TOKEN_KEY, session.accessToken);
      localStorage.setItem(REFRESH_KEY, session.refreshToken);
    } catch {
      /* Storage can be full or blocked in private mode; the session still
         works for the lifetime of the page. */
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      /* ignore */
    }
  },
};

/* --------------------------------- request -------------------------------- */

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
  /** Skip the automatic refresh-and-retry on 401 (used by the refresh call). */
  skipRefresh?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${config.apiBaseUrl}${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function toApiError(status: number, payload: unknown): ApiClientError {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const error = (payload as { error: ApiError }).error;
    return new ApiClientError(error.code, error.message, {
      status,
      fields: error.fields,
      requestId: error.requestId,
    });
  }
  return new ApiClientError('unknown_error', defaultMessage(status), { status });
}

function defaultMessage(status: number): string {
  if (status === 0) return 'We could not reach the server. Check your connection and try again.';
  if (status === 429) return 'That was too many attempts. Please wait a moment.';
  if (status >= 500) return 'Something went wrong on our side. Please try again.';
  return 'That request could not be completed.';
}

/** Serialises refresh attempts so parallel 401s trigger exactly one refresh. */
let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) return false;

  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(buildUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) return false;
      const payload = (await response.json()) as ApiResponse<AuthSession>;
      if (!payload.ok) return false;
      tokenStore.set(payload.data);
      return true;
    } catch {
      return false;
    } finally {
      // Cleared on the next tick so callers awaiting this promise see the result.
      queueMicrotask(() => {
        refreshInFlight = null;
      });
    }
  })();

  return refreshInFlight;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal, skipRefresh } = options;

  const send = async (): Promise<Response> => {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    const token = tokenStore.access;
    if (token) headers.authorization = `Bearer ${token}`;

    return fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  };

  let response: Response;
  try {
    response = await send();
  } catch {
    throw new ApiClientError('network_error', defaultMessage(0));
  }

  if (response.status === 401 && !skipRefresh) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      try {
        response = await send();
      } catch {
        throw new ApiClientError('network_error', defaultMessage(0));
      }
    }
  }

  if (response.status === 401) {
    tokenStore.clear();
    notifyUnauthenticated();
    throw new ApiClientError('unauthenticated', 'Your session expired. Please sign in again.', {
      status: 401,
    });
  }

  // An empty 204 is a legitimate success with no body.
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok || !payload || typeof payload !== 'object' || !('ok' in payload)) {
    throw toApiError(response.status, payload);
  }

  const envelope = payload as ApiResponse<T>;
  if (!envelope.ok) {
    throw new ApiClientError(envelope.error.code, envelope.error.message, {
      status: response.status,
      fields: envelope.error.fields,
      requestId: envelope.error.requestId,
    });
  }

  return envelope.data;
}

/* ---------------------------------- API ---------------------------------- */

export const AuthAPI = {
  login: (input: LoginRequest) => request<AuthSession>('/auth/login', { method: 'POST', body: input }),
  signup: (input: SignupRequest) => request<AuthSession>('/auth/signup', { method: 'POST', body: input }),
  me: () => request<{ user: PublicUser }>('/auth/me'),
  logout: (refreshToken?: string | null) =>
    request<{ revoked: boolean }>('/auth/logout', {
      method: 'POST',
      body: { refreshToken: refreshToken ?? undefined },
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ changed: boolean }>('/auth/password', { method: 'POST', body: { currentPassword, newPassword } }),
  completeOnboarding: (input: OnboardingRequest) =>
    request<{ user: PublicUser }>('/auth/onboarding', { method: 'POST', body: input }),
};

export const ProductAPI = {
  list: (query: ProductListQuery = {}) =>
    request<Page<Product>>('/products', {
      query: {
        category: query.category,
        sort: query.sort,
        q: query.q,
        minCommissionBps: query.minCommissionBps,
        page: query.page,
        pageSize: query.pageSize,
      },
    }),
  /** Product detail is addressed by slug, which is what the public URL uses. */
  detail: (slug: string) => request<Product>(`/products/${encodeURIComponent(slug)}`),
  categories: () => request<Array<{ category: string; count: number }>>('/products/categories'),
  assets: (slug: string) =>
    request<{ productSlug: string; assets: PromoAsset[] }>(`/products/${encodeURIComponent(slug)}/assets`),
};

export const AffiliateAPI = {
  links: (page = 1, pageSize = 20) =>
    request<Page<AffiliateLink>>('/affiliate/links', { query: { page, pageSize } }),
  generateLink: (productId: string) =>
    request<{ link: AffiliateLink }>('/affiliate/links', { method: 'POST', body: { productId } }),
};

export const WalletAPI = {
  summary: () => request<WalletSummary>('/wallet/summary'),
  transactions: (query: { status?: TransactionStatus; type?: TransactionType; page?: number; pageSize?: number } = {}) =>
    request<Page<Transaction>>('/wallet/transactions', { query }),
  payoutOptions: (currency?: string) =>
    request<{ options: PayoutOption[] }>('/wallet/payout-options', { query: { currency } }),
  withdraw: (input: WithdrawRequest) =>
    request<WithdrawResult>('/wallet/withdraw', { method: 'POST', body: input }),
};

export const StatsAPI = {
  dashboard: (range: StatsRange = '30d') =>
    request<DashboardStats>('/stats/dashboard', { query: { range } }),
  leaderboard: (limit = 10) => request<{ entries: LeaderboardEntry[] }>('/stats/leaderboard', { query: { limit } }),
};

export const ProfileAPI = {
  get: () => request<{ user: PublicUser; bank: BankDetails }>('/profile'),
  update: (data: Partial<Pick<PublicUser, 'name' | 'country' | 'whatsapp' | 'niches'>>) =>
    request<{ user: PublicUser }>('/profile', { method: 'PATCH', body: data }),
  saveBankDetails: (data: { bankName: string; accountName: string; accountNumber: string }) =>
    request<{ bank: BankDetails }>('/profile/bank-details', { method: 'PUT', body: data }),
  goal: () =>
    request<{ targetMinor: number; currency: string; period: string } | null>('/profile/goal'),
  setGoal: (data: { targetMinor: number; currency: 'NGN' | 'USD'; period?: string }) =>
    request<{ targetMinor: number; currency: string; period: string }>('/profile/goal', {
      method: 'PUT',
      body: data,
    }),
};

export const NotificationAPI = {
  list: (query: { unreadOnly?: boolean; page?: number; pageSize?: number } = {}) =>
    request<Page<Notification> & { unreadCount: number }>('/notifications', { query }),
  markRead: (id: string) => request<{ marked: number }>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' }),
  markAllRead: () => request<{ marked: number }>('/notifications/read-all', { method: 'POST' }),
  remove: (id: string) => request<{ deleted: boolean }>(`/notifications/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

export const ContentAPI = {
  faqs: (category?: string) => request<{ items: FaqItem[] }>('/faqs', { query: { category } }),
  createTicket: (data: { subject: string; message: string; contactEmail: string; category?: string }) =>
    request<{ ticketId: string; status: string }>('/support/tickets', { method: 'POST', body: data }),
};

export type { ProductSort };
export { request };
