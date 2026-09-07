import { describe, expect, it } from "vitest";
import {
  MAX_COURT_PLAYERS,
  goalCountsForPlusMinus,
  goalLineupTooLarge,
  goalSituationTag,
} from "@/domain/goals";

describe("goal situations", () => {
  it("gathers +/- only for even-strength open play", () => {
    expect(goalCountsForPlusMinus(undefined)).toBe(true);
    expect(goalCountsForPlusMinus("OPEN_PLAY")).toBe(true);
    expect(goalCountsForPlusMinus("PENALTY_6M")).toBe(false);
    expect(goalCountsForPlusMinus("PENALTY_10M")).toBe(false);
    expect(goalCountsForPlusMinus("UNEVEN_STRENGTH")).toBe(false);
  });

  it("tags non-open-play goals", () => {
    expect(goalSituationTag("OPEN_PLAY")).toBe("");
    expect(goalSituationTag("PENALTY_6M")).toBe("6 m rp");
    expect(goalSituationTag("UNEVEN_STRENGTH")).toBe("4v3");
  });
});

describe("goalLineupTooLarge", () => {
  it("allows up to five on court and rejects six", () => {
    expect(MAX_COURT_PLAYERS).toBe(5);
    expect(goalLineupTooLarge(["a", "b", "c"])).toBe(false);
    expect(goalLineupTooLarge(["a", "b", "c", "d", "e"])).toBe(false);
    expect(goalLineupTooLarge(["a", "b", "c", "d", "e", "f"])).toBe(true);
  });

  it("counts distinct players only", () => {
    expect(goalLineupTooLarge(["a", "a", "b", "c", "d", "e"])).toBe(false);
  });
});
