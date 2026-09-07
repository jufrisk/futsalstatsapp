import { beforeEach, describe, expect, it } from "vitest";
import { calculateMatchStatistics } from "@/services/statisticsEngine";
import { formatPlayerLabel } from "@/domain/format";
import { matchStarted, ownGoal, opponentGoal, roster, resetSeq } from "./factories";

beforeEach(resetSeq);

const LINEUP = ["p1", "p2", "p3", "p4", "p5"];

describe("calculateMatchStatistics", () => {
  it("builds per-player rows from the roster snapshot and event log", () => {
    const r = roster([
      { playerId: "p1", number: 1, name: "Anna", starter: true },
      { playerId: "p2", number: 4, name: "Laura", starter: true },
      { playerId: "p3", number: 7, name: "Emma", starter: true },
      { playerId: "p4", number: 9, name: "Sofia", starter: true },
      { playerId: "p5", number: 14, starter: true }, // number-only player
    ]);
    const { rows, ownScore, opponentScore } = calculateMatchStatistics(r, [
      matchStarted(LINEUP),
      ownGoal({ lineup: LINEUP, scorer: "p4", assist: "p3" }),
      opponentGoal({ lineup: LINEUP }),
      ownGoal({ lineup: LINEUP, scorer: "p4" }),
    ]);

    expect(ownScore).toBe(2);
    expect(opponentScore).toBe(1);

    const sofia = rows.find((x) => x.playerId === "p4")!;
    expect(sofia.goals).toBe(2);
    expect(sofia.plus).toBe(2);
    expect(sofia.minus).toBe(1);
    expect(sofia.plusMinus).toBe(1);

    const veera = rows.find((x) => x.playerId === "p5")!;
    expect(veera.playerNumber).toBe(14);
    expect(veera.playerName).toBeUndefined();
    expect(formatPlayerLabel(veera.playerNumber, veera.playerName)).toBe("#14");
  });

  it("uses the match-specific jersey-number snapshot, not current master data", () => {
    // Sofia's default is #9 but in this match she wore #17.
    const r = roster([
      { playerId: "p4", number: 17, name: "Sofia", starter: true },
      { playerId: "p1", number: 1, starter: true },
    ]);
    const { rows } = calculateMatchStatistics(r, [ownGoal({ lineup: ["p4", "p1"], scorer: "p4" })]);
    const sofia = rows.find((x) => x.playerId === "p4")!;
    expect(sofia.playerNumber).toBe(17);
    expect(formatPlayerLabel(sofia.playerNumber, sofia.playerName)).toBe("#17 Sofia");
  });

  it("does not gather +/- for penalty goals, but still counts the scorer and score", () => {
    const r = roster([
      { playerId: "p1", number: 1, starter: true },
      { playerId: "p2", number: 2, starter: true },
    ]);
    const { rows, ownScore, opponentScore } = calculateMatchStatistics(r, [
      matchStarted(["p1", "p2"]),
      ownGoal({ lineup: ["p1", "p2"], scorer: "p1", situation: "PENALTY_6M" }),
      opponentGoal({ lineup: ["p1", "p2"], situation: "PENALTY_10M" }),
    ]);

    expect(ownScore).toBe(1);
    expect(opponentScore).toBe(1);

    const p1 = rows.find((x) => x.playerId === "p1")!;
    const p2 = rows.find((x) => x.playerId === "p2")!;
    expect(p1.goals).toBe(1); // penalty scorer still counts
    expect(p1.plus).toBe(0);
    expect(p1.minus).toBe(0);
    expect(p1.plusMinus).toBe(0);
    expect(p2.plus).toBe(0);
    expect(p2.minus).toBe(0);
  });

  it("sorts rows by plus/minus then goals", () => {
    const r = roster([
      { playerId: "p1", number: 1, starter: true },
      { playerId: "p2", number: 2, starter: true },
    ]);
    const { rows } = calculateMatchStatistics(r, [
      ownGoal({ lineup: ["p1"] }),
      opponentGoal({ lineup: ["p2"] }),
    ]);
    expect(rows[0]!.playerId).toBe("p1");
    expect(rows[1]!.playerId).toBe("p2");
  });
});
