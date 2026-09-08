import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiClientError,
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
