import { describe, expect, it } from "vitest";
import {
  commissionFromBps,
  formatMoney,
  money,
  toMajor,
  toMinor,
} from "@shared/api-contract";

/**
 * Money arithmetic.
 *
 * These functions sit on both sides of the wire, so a mistake here corrupts a
 * payout rather than a pixel. They are tested directly because the alternative
 * is discovering a rounding bug from a customer complaint about a ₦1
 * discrepancy.
 */
describe("toMinor / toMajor", () => {
  it("round-trips a value without drift", () => {
    for (const major of [0, 1, 0.01, 99.99, 472500, 1234.56]) {
      expect(toMajor(toMinor(major, "NGN"), "NGN")).toBeCloseTo(major, 2);
    }
  });

  it("rounds rather than truncating a fractional kobo", () => {
    // 19.995 * 100 = 1999.4999… in float. Truncation would silently drop a
    // kobo; rounding keeps the ledger honest.
    expect(toMinor(19.995, "NGN")).toBe(2000);
  });

  it("handles the classic 0.1 + 0.2 case", () => {
    expect(toMinor(0.1 + 0.2, "NGN")).toBe(30);
  });

  it("converts major units for display", () => {
    expect(toMajor(47250000, "NGN")).toBe(472500);
    expect(toMajor(5025, "USD")).toBe(50.25);
  });
});

describe("formatMoney", () => {
  it("uses the naira sign for NGN and a dollar sign for USD", () => {
    expect(formatMoney(money(47250000, "NGN"))).toBe("₦472,500.00");
    expect(formatMoney(money(5025, "USD"))).toBe("$50.25");
  });

  it("always shows two decimals, so a whole number is not rendered as ₦500", () => {
    expect(formatMoney(money(50000, "NGN"))).toBe("₦500.00");
  });

  it("groups thousands with commas", () => {
    expect(formatMoney(money(123456789, "NGN"))).toBe("₦1,234,567.89");
  });

  it("renders a negative amount with a leading minus, never a bare digit run", () => {
    expect(formatMoney(money(-5000, "NGN"))).toBe("-₦50.00");
  });
});

describe("commissionFromBps", () => {
  it("computes 45% of a ₦10,000 price as ₦4,500", () => {
    expect(commissionFromBps(1_000_000, 4500)).toBe(450_000);
  });

  it("rounds to the nearest minor unit rather than truncating", () => {
    // 333 minor at 333 bps = 11.0889 minor, which truncation would turn into 11
    // and rounding into 11 as well — so use a case that straddles the boundary.
    expect(commissionFromBps(333, 333)).toBe(11);
    // 1 minor at 9999 bps = 0.9999 -> rounds to 1, not 0.
    expect(commissionFromBps(1, 9999)).toBe(1);
  });

  it("returns zero for a zero-commission product instead of NaN", () => {
    expect(commissionFromBps(100_000, 0)).toBe(0);
  });
});
