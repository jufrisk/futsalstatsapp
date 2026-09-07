import { describe, expect, it } from "vitest";
import {
  formatMatchTime,
  parseLooseTimeInput,
  parseMatchTime,
  secondsToParts,
  validateMatchTime,
} from "@/services/matchTime";

describe("match time parsing", () => {
  it("parseMatchTime(7, 34) === 454", () => {
    expect(parseMatchTime(7, 34)).toBe(454);
  });

  it("formats seconds back to MM:SS", () => {
    expect(formatMatchTime(454)).toBe("07:34");
    expect(formatMatchTime(0)).toBe("00:00");
    expect(formatMatchTime(undefined)).toBe("--:--");
  });

  it("secondsToParts round-trips", () => {
    expect(secondsToParts(454)).toEqual({ minutes: 7, seconds: 34 });
  });
});

describe("match time validation", () => {
  it("accepts values in range", () => {
    expect(validateMatchTime(0, 0).ok).toBe(true);
    expect(validateMatchTime(20, 0).ok).toBe(true);
    expect(validateMatchTime(7, 59).ok).toBe(true);
  });

  it("rejects out-of-range minutes and seconds", () => {
    expect(validateMatchTime(21, 0).ok).toBe(false);
    expect(validateMatchTime(-1, 0).ok).toBe(false);
    expect(validateMatchTime(5, 60).ok).toBe(false);
    expect(validateMatchTime(5.5, 10).ok).toBe(false);
  });
});

describe("loose time input", () => {
  it("handles the many ways a user types a time", () => {
    expect(parseLooseTimeInput("7:34")).toEqual({ minutes: 7, seconds: 34 });
    expect(parseLooseTimeInput("07:34")).toEqual({ minutes: 7, seconds: 34 });
    expect(parseLooseTimeInput("734")).toEqual({ minutes: 7, seconds: 34 });
    expect(parseLooseTimeInput("7")).toEqual({ minutes: 7, seconds: 0 });
    expect(parseLooseTimeInput("")).toBeNull();
  });
});
