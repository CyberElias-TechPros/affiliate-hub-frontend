import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiClientError,
  NotificationAPI,
  UNAUTHENTICATED_EVENT,
  resetUnauthenticatedFlag,
  tokenStore,
} from "@/lib/api";

/**
 * The HTTP client.
 *
 * The prototype's version typed every response as `any` and swallowed errors
 * into a generic `throw new Error()`. These tests pin the behaviour the UI
 * depends on: field-level errors must survive the round trip (or the form
 * cannot show them under the right input), and a 401 must surface as a single
 * event so the auth context can sign the user out exactly once.
 */

/** Install a fetch stub and return the requests it received. */
const stubFetch = (handler: (req: Request) => Promise<Response> | Response) => {
  const calls: Request[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = new Request(input, init);
      calls.push(req);
      return handler(req);
    }),
  );
  return calls;
};

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  tokenStore.clear();
  // The de-dup flag lives at module scope; without this the first 401 test
  // would suppress the second test's event.
  resetUnauthenticatedFlag();
});

afterEach(() => {
  vi.unstubAllGlobals();
  tokenStore.clear();
});

describe("ApiClientError", () => {
  it("exposes per-field messages so a form can render them inline", async () => {
    const { ProductAPI } = await import("@/lib/api");
    stubFetch(() =>
      jsonResponse(400, {
        error: {
          code: "validation_failed",
          message: "Please correct the highlighted fields.",
          fields: { email: "Enter a valid email", password: "Too short" },
        },
      }),
    );

    await expect(ProductAPI.list()).rejects.toMatchObject({
      code: "validation_failed",
      fields: { email: "Enter a valid email", password: "Too short" },
    });
  });

  it("carries a retry flag so the UI can offer a retry only when it would help", async () => {
    const { ProductAPI } = await import("@/lib/api");
    stubFetch(() => jsonResponse(503, { error: { code: "unavailable", message: "Try again later" } }));

    const error = await ProductAPI.list().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiClientError);
    expect((error as ApiClientError).retryable).toBe(true);
  });

  it("does not offer a retry for a 4xx that will fail identically", async () => {
    const { ProductAPI } = await import("@/lib/api");
    stubFetch(() => jsonResponse(404, { error: { code: "not_found", message: "Gone" } }));

    const error = await ProductAPI.list().catch((e: unknown) => e);
    expect((error as ApiClientError).retryable).toBe(false);
  });

  it("produces a readable message when the body is not our envelope", async () => {
    const { ProductAPI } = await import("@/lib/api");
    stubFetch(() => new Response("<html>502 Bad Gateway</html>", { status: 502 }));

    const error = (await ProductAPI.list().catch((e: unknown) => e)) as ApiClientError;
    expect(error.message).toBeTruthy();
    // Must not leak a raw HTML body into a toast.
    expect(error.message).not.toContain("<html>");
  });
});

describe("authentication handling", () => {
  it("emits exactly one unauthenticated event for a burst of concurrent 401s", async () => {
    const { ProductAPI, StatsAPI, ProfileAPI } = await import("@/lib/api");

    stubFetch(() => jsonResponse(401, { error: { code: "unauthenticated", message: "Sign in" } }));

    const events: unknown[] = [];
    const listener = (event: Event) => events.push(event);
    window.addEventListener(UNAUTHENTICATED_EVENT, listener);

    await Promise.allSettled([ProductAPI.list(), StatsAPI.dashboard(), ProfileAPI.get()]);

    window.removeEventListener(UNAUTHENTICATED_EVENT, listener);

    // Without de-duplication the auth context would tear down and rebuild
    // session state once per in-flight request.
    expect(events.length).toBe(1);
  });

  it("sends the bearer token once one is stored", async () => {
    const { ProfileAPI } = await import("@/lib/api");
    tokenStore.set({ accessToken: "access-token-abc", refreshToken: "refresh-xyz" });

    const calls = stubFetch(() => jsonResponse(200, { ok: true, data: { user: {} } }));
    await ProfileAPI.get();

    expect(calls[0]?.headers.get("authorization")).toBe("Bearer access-token-abc");
  });

  it("omits the authorization header when signed out rather than sending 'Bearer undefined'", async () => {
    const { ProductAPI } = await import("@/lib/api");
    const calls = stubFetch(() =>
      jsonResponse(200, {
        ok: true,
        data: { items: [], totalItems: 0, page: 1, pageSize: 20, totalPages: 0 },
      }),
    );

    await ProductAPI.list();
    expect(calls[0]?.headers.get("authorization")).toBeNull();
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   Token refresh

   The access token lives 15 minutes and the refresh token 30 days, so an active
   user hits the refresh path constantly. If it is broken the symptom is not an
   error message — it is a signed-out user every fifteen minutes, with no
   indication of why. Nothing covered this path before.
   ──────────────────────────────────────────────────────────────────────────── */

const SESSION = {
  accessToken: "rotated-access-token",
  refreshToken: "rotated-refresh-token",
  expiresIn: 900,
  user: {
    id: "u1",
    name: "Chinedu Nwankwo",
    email: "demo@affiliatehub.test",
    whatsapp: null,
    country: "NG",
    referralCode: "DEMO1",
    tier: "pro",
    onboardingCompleted: true,
    niches: ["tech"],
    createdAt: "2026-01-01T00:00:00.000Z",
  },
};

const UNAUTH_BODY = { error: { code: "unauthenticated", message: "Token expired" } };

describe("token refresh", () => {
  it("transparently retries the original request after a successful refresh", async () => {
    tokenStore.set({ accessToken: "expired-access", refreshToken: "still-valid-refresh" });

    let sawStaleToken = false;
    const calls = stubFetch(async (req) => {
      const url = req.url;
      if (url.includes("/auth/refresh")) return jsonResponse(200, { ok: true, data: SESSION });
      // The retry must carry the rotated token, not the expired one.
      const auth = req.headers.get("authorization") ?? "";
      if (auth === "Bearer rotated-access-token") {
        return jsonResponse(200, { ok: true, data: { items: [], unreadCount: 0 } });
      }
      sawStaleToken = true;
      return jsonResponse(401, UNAUTH_BODY);
    });

    await expect(NotificationAPI.list()).resolves.toBeDefined();
    expect(sawStaleToken).toBe(true); // it really did 401 first
    // The rotated token is persisted, so the next request does not 401 again.
    expect(tokenStore.access).toBe("rotated-access-token");
    expect(tokenStore.refresh).toBe("rotated-refresh-token");
    expect(calls.length).toBe(3); // stale GET, refresh, retry
  });

  it("does not sign the user out when the refresh succeeds", async () => {
    tokenStore.set({ accessToken: "expired-access", refreshToken: "still-valid-refresh" });
    const events: unknown[] = [];
    const listener = (e: Event) => events.push(e);
    window.addEventListener(UNAUTHENTICATED_EVENT, listener);

    stubFetch(async (req) =>
      req.url.includes("/auth/refresh")
        ? jsonResponse(200, { ok: true, data: SESSION })
        : jsonResponse(401, UNAUTH_BODY),
    );
    // First call 401s, refreshes, then the retry also 401s in this stub — so
    // assert on a handler that lets the retry through.
    vi.unstubAllGlobals();
    let first = true;
    stubFetch(async (req) => {
      if (req.url.includes("/auth/refresh")) return jsonResponse(200, { ok: true, data: SESSION });
      if (first) {
        first = false;
        return jsonResponse(401, UNAUTH_BODY);
      }
      return jsonResponse(200, { ok: true, data: { items: [], unreadCount: 0 } });
    });

    await NotificationAPI.list();
    expect(events).toHaveLength(0);
    expect(tokenStore.access).not.toBeNull();
    window.removeEventListener(UNAUTHENTICATED_EVENT, listener);
  });

  it("triggers exactly one refresh for a burst of concurrent 401s", async () => {
    tokenStore.set({ accessToken: "expired-access", refreshToken: "still-valid-refresh" });

    let refreshCalls = 0;
    stubFetch(async (req) => {
      if (req.url.includes("/auth/refresh")) {
        refreshCalls += 1;
        return jsonResponse(200, { ok: true, data: SESSION });
      }
      const auth = req.headers.get("authorization") ?? "";
      return auth === "Bearer rotated-access-token"
        ? jsonResponse(200, { ok: true, data: { items: [], unreadCount: 0 } })
        : jsonResponse(401, UNAUTH_BODY);
    });

    // Five pages' worth of queries firing at once is normal on a dashboard load.
    // Rotating a refresh token is destructive server-side: the first rotation
    // invalidates the token the others would send, and the server's reuse
    // detection would then revoke the entire family — signing the user out.
    await Promise.all([
      NotificationAPI.list(),
      NotificationAPI.list(),
      NotificationAPI.list(),
      NotificationAPI.list(),
      NotificationAPI.list(),
    ]);

    expect(refreshCalls).toBe(1);
  });

  it("signs the user out once when the refresh token is rejected", async () => {
    tokenStore.set({ accessToken: "expired-access", refreshToken: "revoked-refresh" });
    const events: unknown[] = [];
    const listener = (e: Event) => events.push(e);
    window.addEventListener(UNAUTHENTICATED_EVENT, listener);

    stubFetch(async (req) =>
      req.url.includes("/auth/refresh")
        ? jsonResponse(401, UNAUTH_BODY)
        : jsonResponse(401, UNAUTH_BODY),
    );

    await expect(NotificationAPI.list()).rejects.toBeInstanceOf(ApiClientError);
    expect(events).toHaveLength(1);
    // Tokens must be cleared, or every subsequent request retries a dead refresh.
    expect(tokenStore.access).toBeNull();
    expect(tokenStore.refresh).toBeNull();
    window.removeEventListener(UNAUTHENTICATED_EVENT, listener);
  });

  it("treats a refresh that fails at the network as a sign-out, not a crash", async () => {
    tokenStore.set({ accessToken: "expired-access", refreshToken: "still-valid-refresh" });

    stubFetch(async (req) => {
      if (req.url.includes("/auth/refresh")) throw new TypeError("Failed to fetch");
      return jsonResponse(401, UNAUTH_BODY);
    });

    await expect(NotificationAPI.list()).rejects.toBeInstanceOf(ApiClientError);
    expect(tokenStore.access).toBeNull();
  });

  it("does not loop when the refreshed token is also rejected", async () => {
    tokenStore.set({ accessToken: "expired-access", refreshToken: "still-valid-refresh" });

    let attempts = 0;
    stubFetch(async (req) => {
      if (req.url.includes("/auth/refresh")) return jsonResponse(200, { ok: true, data: SESSION });
      attempts += 1;
      return jsonResponse(401, UNAUTH_BODY);
    });

    await expect(NotificationAPI.list()).rejects.toBeInstanceOf(ApiClientError);
    // One retry, then stop. Retrying in a loop would hammer the API and burn
    // rate-limit budget on a session that is already dead.
    expect(attempts).toBe(2);
  });

  it("never recurses into refresh when the refresh call itself fails", async () => {
    tokenStore.set({ accessToken: "expired-access", refreshToken: "still-valid-refresh" });

    let refreshCalls = 0;
    stubFetch(async (req) => {
      if (req.url.includes("/auth/refresh")) {
        refreshCalls += 1;
        return jsonResponse(401, UNAUTH_BODY);
      }
      return jsonResponse(401, UNAUTH_BODY);
    });

    await expect(NotificationAPI.list()).rejects.toBeInstanceOf(ApiClientError);
    // The refresh call goes out over raw fetch rather than the request wrapper,
    // so a failing refresh cannot re-enter the refresh path. One call only.
    expect(refreshCalls).toBe(1);
  });
});
