/**
 * Unit invariants for the closest-price number pool.
 *
 * Rule: the number space is ALWAYS cent-granular. Every whole currency unit of
 * the selling price holds exactly 100 selectable numbers (x.01 … x+1.00),
 * regardless of the auction's bid_increment (which only drives ascending mode).
 */
import { describe, expect, test } from "bun:test";
import {
  NUMBER_STEP,
  numberPool,
  sealedStep,
  snapToStep,
  totalNumbers,
  validClosestAmount,
} from "../../src/lib/auction.js";

const auction = (target: number, increment = 0.01) => ({
  mode: "closest",
  target_price: target,
  bid_increment: increment,
});

describe("number space granularity", () => {
  test("step is always one cent, even at 0.1 increment", () => {
    expect(NUMBER_STEP).toBe(0.01);
    expect(sealedStep(auction(1, 0.1))).toBe(0.01);
    expect(sealedStep(auction(500, 5))).toBe(0.01);
  });

  test("100 numbers per 1.00 at 0.1 increment", () => {
    expect(totalNumbers(auction(1, 0.1))).toBe(100);
    expect(totalNumbers(auction(1, 0.01))).toBe(100);
    expect(totalNumbers(auction(1, 1))).toBe(100);
  });

  test("pool scales linearly with the target price", () => {
    expect(totalNumbers(auction(2, 0.1))).toBe(200);
    expect(totalNumbers(auction(500))).toBe(50_000);
    expect(totalNumbers(auction(0))).toBe(0);
  });

  test("fractional targets round to whole cents", () => {
    expect(totalNumbers(auction(1.05))).toBe(105);
    expect(totalNumbers(auction(0.99))).toBe(99);
    expect(totalNumbers(auction(19.999))).toBe(2000);
  });
});

describe("free-number accounting", () => {
  test("free = total - taken and never negative", () => {
    expect(numberPool(auction(1, 0.1), 0)).toEqual({ total: 100, used: 0, free: 100, freePct: 100 });
    expect(numberPool(auction(1, 0.1), 40).free).toBe(60);
    expect(numberPool(auction(1, 0.1), 100).free).toBe(0);
    expect(numberPool(auction(1, 0.1), 250)).toEqual({ total: 100, used: 100, free: 0, freePct: 0 });
  });

  test("percentage is derived from the same integers", () => {
    expect(numberPool(auction(5), 250).freePct).toBe(50); // target 5.00 -> 500 numbers
    expect(numberPool(auction(5), 25).freePct).toBe(95);

  });
});

describe("bid validation with a 0.1 increment", () => {
  test("every cent value between 0.01 and the target is selectable", () => {
    const a = auction(1, 0.1);
    for (let cents = 1; cents <= 100; cents++) {
      expect(validClosestAmount(a, cents / 100)).toBeNull();
    }
  });

  test("out-of-range and sub-cent values are refused", () => {
    const a = auction(1, 0.1);
    expect(validClosestAmount(a, 1.01)).toBe("errOutOfRange");
    expect(validClosestAmount(a, 0)).toBe("errOutOfRange");
    expect(validClosestAmount(a, 0.005)).toBe("errBadStep");
  });

  test("snapping keeps two decimals and stays inside the pool", () => {
    const a = auction(1, 0.1);
    expect(snapToStep(a, "0.25")).toBe("0.25");
    expect(snapToStep(a, "0.254")).toBe("0.25");
    expect(snapToStep(a, "0.001")).toBe("0.01");
  });
});

describe("clock compression invariants", () => {
  // Mirrors place_closest_bid: new_end = now + max(remaining * freeRatio, 60s),
  // clamped so it never moves later, and closes at the 5% (min 3) floor.
  const nextRemaining = (remaining: number, total: number, used: number) => {
    const free = Math.max(total - used, 0);
    const floor = Math.max(Math.ceil(total * 0.05), 3);
    if (free <= floor) return 0;
    return Math.min(Math.max((remaining * free) / total, 60), remaining);
  };

  test("deadline only ever moves earlier", () => {
    let remaining = 6000;
    for (let used = 1; used <= 90; used++) {
      const next = nextRemaining(remaining, 100, used);
      expect(next).toBeLessThanOrEqual(remaining);
      remaining = next || remaining;
    }
  });

  test("shortens proportionally to the free pool", () => {
    expect(nextRemaining(1000, 100, 50)).toBe(500);
    expect(nextRemaining(1000, 100, 20)).toBe(800);
  });

  test("never drops below 60 seconds before the floor", () => {
    expect(nextRemaining(1000, 100, 94)).toBeGreaterThanOrEqual(60);
  });

  test("closes immediately at the safety floor", () => {
    expect(nextRemaining(1000, 100, 95)).toBe(0);
    expect(nextRemaining(1000, 20, 18)).toBe(0);
  });
});
