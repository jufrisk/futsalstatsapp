import { describe, expect, it } from "vitest";
import {
  duplicateTeamNumber,
  validateJerseyNumber,
  validateStartMatch,
  validateUniqueMatchNumbers,
} from "@/domain/validation";
import { formatPlayerLabel } from "@/domain/format";
import { roster } from "./factories";
import type { Player } from "@/domain/types";

describe("validateJerseyNumber", () => {
  it("requires a number", () => {
    expect(validateJerseyNumber("").ok).toBe(false);
    expect(validateJerseyNumber(undefined).ok).toBe(false);
  });
  it("requires an integer in range", () => {
    expect(validateJerseyNumber("9").ok).toBe(true);
    expect(validateJerseyNumber(0).ok).toBe(true);
    expect(validateJerseyNumber(9.5).ok).toBe(false);
    expect(validateJerseyNumber(1000).ok).toBe(false);
  });
});

describe("formatPlayerLabel", () => {
  it("shows #number alone when no name", () => {
    expect(formatPlayerLabel(9)).toBe("#9");
    expect(formatPlayerLabel(14, "  ")).toBe("#14");
  });
  it("shows #number name when a name exists", () => {
    expect(formatPlayerLabel(9, "Sofia")).toBe("#9 Sofia");
  });
});

describe("duplicateTeamNumber", () => {
  const players: Player[] = [
    { id: "a", teamId: "t", number: 9, active: true, createdAt: "", updatedAt: "" },
    { id: "b", teamId: "t", number: 7, active: false, createdAt: "", updatedAt: "" },
  ];
  it("flags an existing active number", () => {
    expect(duplicateTeamNumber(players, 9)).toBe(true);
  });
  it("ignores inactive players and the player being edited", () => {
    expect(duplicateTeamNumber(players, 7)).toBe(false);
    expect(duplicateTeamNumber(players, 9, "a")).toBe(false);
  });
});

describe("validateUniqueMatchNumbers", () => {
  it("passes when selected roster numbers are unique", () => {
    const r = roster([
      { playerId: "p1", number: 1 },
      { playerId: "p2", number: 2 },
    ]);
    expect(validateUniqueMatchNumbers(r).ok).toBe(true);
  });
  it("fails and reports the duplicate number", () => {
    const r = roster([
      { playerId: "p1", number: 9 },
      { playerId: "p2", number: 9 },
      { playerId: "p3", number: 3, selected: false },
    ]);
    const res = validateUniqueMatchNumbers(r);
    expect(res.ok).toBe(false);
    expect(res.duplicateNumbers).toEqual([9]);
  });
});

describe("validateStartMatch", () => {
  it("blocks start on duplicate numbers", () => {
    const r = roster([
      { playerId: "p1", number: 9, starter: true },
      { playerId: "p2", number: 9, starter: true },
    ]);
    expect(validateStartMatch(r).ok).toBe(false);
  });
  it("warns (does not block) when starters !== 5", () => {
    const r = roster([
      { playerId: "p1", number: 1, starter: true },
      { playerId: "p2", number: 2, starter: true },
      { playerId: "p3", number: 3 },
    ]);
    const res = validateStartMatch(r);
    expect(res.ok).toBe(true);
    expect(res.warnings.length).toBe(1);
  });
});
