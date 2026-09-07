import { beforeEach, describe, expect, it } from "vitest";
import {
  calculateSeasonStatistics,
  type MatchBundle,
} from "@/services/seasonStatisticsEngine";
import type { Match } from "@/domain/types";
import { matchStarted, ownGoal, opponentGoal, roster, resetSeq } from "./factories";

beforeEach(resetSeq);

function match(id: string, date: string, status: Match["status"] = "FINISHED"): Match {
  return {
    id,
    seasonId: "s1",
    teamId: "t1",
    opponentName: `Team ${id}`,
    date,
    venue: "HOME",
    status,
    createdAt: date,
    updatedAt: date,
  };
}

const LINEUP = ["p1", "p2", "p3"];
const r = () =>
  roster([
    { playerId: "p1", number: 9, name: "Sofia", starter: true },
    { playerId: "p2", number: 7, name: "Emma", starter: true },
    { playerId: "p3", number: 4, name: "Laura", starter: true },
  ]);

describe("calculateSeasonStatistics", () => {
  it("aggregates appearances, goals, assists, points and +/- across matches", () => {
    const bundles: MatchBundle[] = [
      {
        match: match("m1", "2026-09-01"),
        matchPlayers: r(),
        events: [
          matchStarted(LINEUP),
          ownGoal({ lineup: LINEUP, scorer: "p1", assist: "p2" }),
          opponentGoal({ lineup: LINEUP }),
        ],
      },
      {
        match: match("m2", "2026-09-08"),
        matchPlayers: r(),
        events: [
          matchStarted(LINEUP),
          ownGoal({ lineup: LINEUP, scorer: "p1" }),
          ownGoal({ lineup: LINEUP, scorer: "p3", assist: "p1" }),
        ],
      },
    ];

    const { record, players } = calculateSeasonStatistics(bundles);
    expect(record.matchesPlayed).toBe(2);
    expect(record.wins).toBe(1); // m2 2-0
    expect(record.draws).toBe(1); // m1 1-1
    expect(record.goalsFor).toBe(3);
    expect(record.goalsAgainst).toBe(1);

    const sofia = players.find((p) => p.playerId === "p1")!;
    expect(sofia.appearances).toBe(2);
    expect(sofia.goals).toBe(2);
    expect(sofia.assists).toBe(1);
    expect(sofia.points).toBe(3);
    expect(sofia.plus).toBe(3); // 3 own goals while on court
    expect(sofia.minus).toBe(1);
    expect(sofia.plusMinus).toBe(2);
  });

  it("editing an old match changes season totals (no persisted aggregates)", () => {
    const makeBundles = (m1Events: MatchBundle["events"]): MatchBundle[] => [
      { match: match("m1", "2026-09-01"), matchPlayers: r(), events: m1Events },
    ];

    const before = calculateSeasonStatistics(
      makeBundles([matchStarted(LINEUP), ownGoal({ lineup: LINEUP, scorer: "p1" })]),
    );
    expect(before.players.find((p) => p.playerId === "p1")!.goals).toBe(1);
    expect(before.record.wins).toBe(1);

    // Correct the old match: the goal was actually Emma's, and the opponent equalised.
    const after = calculateSeasonStatistics(
      makeBundles([
        matchStarted(LINEUP),
        ownGoal({ lineup: LINEUP, scorer: "p2" }),
        opponentGoal({ lineup: LINEUP }),
      ]),
    );
    expect(after.players.find((p) => p.playerId === "p1")!.goals).toBe(0);
    expect(after.players.find((p) => p.playerId === "p2")!.goals).toBe(1);
    expect(after.record.wins).toBe(0);
    expect(after.record.draws).toBe(1);
  });

  it("counts a selected roster player as an appearance even with no events", () => {
    const bundles: MatchBundle[] = [
      { match: match("m1", "2026-09-01"), matchPlayers: r(), events: [matchStarted(LINEUP)] },
    ];
    const { players } = calculateSeasonStatistics(bundles);
    expect(players.every((p) => p.appearances === 1)).toBe(true);
  });
});
