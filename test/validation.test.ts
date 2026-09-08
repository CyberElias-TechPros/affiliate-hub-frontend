import { describe, expect, it } from "vitest";
import {
  PASSWORD_MIN,
  emailIssue,
  newIdempotencyKey,
  nubanIssue,
  passwordIssue,
  trc20Issue,
  whatsappIssue,
  whatsappLink,
} from "@/lib/validation";

/**
 * Validation rules.
 *
 * These are the client-side mirror of the server's Zod schemas. They are worth
 * testing because a mismatch between the two produces the worst possible UX:
 * the client accepts a value, the server rejects it, and the user sees an error
 * for input that was never marked invalid.
 */
describe("passwordIssue", () => {
  it("rejects anything under the minimum length", () => {
    expect(passwordIssue("a1".repeat((PASSWORD_MIN - 1) / 2))).toBeTruthy();
    // Exactly at the limit, and containing both required character classes.
    expect(passwordIssue("abcdefghi1")).toBeNull();
  });

  it("requires both a letter and a digit, not just length", () => {
    expect(passwordIssue("aaaaaaaaaaaa")).toBeTruthy();
    expect(passwordIssue("123456789012")).toBeTruthy();
    expect(passwordIssue("abcdefghij1")).toBeNull();
  });

  it("treats an empty password as missing rather than malformed", () => {
    expect(passwordIssue("")).toBeNull();
  });
});

describe("nubanIssue", () => {
  it("accepts exactly ten digits, as every Nigerian bank issues them", () => {
    expect(nubanIssue("0123456789")).toBeNull();
    expect(nubanIssue("123456789")).toBeTruthy();
    expect(nubanIssue("01234567890")).toBeTruthy();
  });

  it("rejects non-digits rather than silently stripping them", () => {
    expect(nubanIssue("012345678a")).toBeTruthy();
  });
});

describe("trc20Issue", () => {
  it("accepts a well-formed TRON address", () => {
    expect(trc20Issue("TQrZ9wBsZ3xw8VtKK3mnbFQeJmfvqVrYhZ")).toBeNull();
  });

  it("rejects an ERC-20 address pasted into the TRC-20 field", () => {
    // A very common user error: both are 34-ish chars and look interchangeable.
    expect(trc20Issue("0x71C7656EC7ab88b098defB751B7401B5f6d8976F")).toBeTruthy();
  });

  it("rejects the base58 characters TRON excludes", () => {
    expect(trc20Issue("TQrZ9wBsZ3xw8VtKK3mnbFQeJmfvqVrYh0")).toBeTruthy(); // '0'
    expect(trc20Issue("TQrZ9wBsZ3xw8VtKK3mnbFQeJmfvqVrYhI")).toBeTruthy(); // 'I'
  });
});

describe("emailIssue / whatsappIssue", () => {
  it("accepts a normal address and rejects an obvious typo", () => {
    expect(emailIssue("hello@example.com")).toBeNull();
    expect(emailIssue("hello@example")).toBeTruthy();
    expect(emailIssue("hello @example.com")).toBeTruthy();
  });

  it("accepts an E.164 WhatsApp number and rejects a local-format one", () => {
    expect(whatsappIssue("+2348012345678")).toBeNull();
    expect(whatsappIssue("08012345678")).toBeTruthy();
    expect(whatsappIssue("+0348012345678")).toBeTruthy();
  });

  it("treats WhatsApp as optional", () => {
    expect(whatsappIssue("")).toBeNull();
    expect(whatsappIssue("   ")).toBeNull();
  });
});

describe("whatsappLink", () => {
  it("builds a click-to-chat deep link", () => {
    expect(whatsappLink("+2348012345678", "Hi there")).toBe(
      "https://wa.me/2348012345678?text=Hi%20there",
    );
  });

  it("omits the phone segment when sharing without a preset recipient", () => {
    expect(whatsappLink("", "Hi")).toBe("https://wa.me/?text=Hi");
  });

  it("URL-encodes the message so ampersands and newlines survive", () => {
    const link = whatsappLink("", "50% off & free shipping\nShop now");
    expect(link).toContain("50%25%20off%20%26%20free%20shipping%0AShop%20now");
  });
});

describe("newIdempotencyKey", () => {
  it("produces a key long enough to be unguessable", () => {
    const key = newIdempotencyKey();
    expect(key.length).toBeGreaterThanOrEqual(32);
  });

  it("never repeats, so a retry cannot collide with an unrelated withdrawal", () => {
    const keys = new Set(Array.from({ length: 500 }, () => newIdempotencyKey()));
    expect(keys.size).toBe(500);
  });
});
