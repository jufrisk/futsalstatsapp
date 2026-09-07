import { beforeEach, describe, expect, it } from "vitest";
import { buildMatchState, reduceMatchEvents, initialMatchState } from "@/services/matchEngine";
import {
  matchStarted,
  ownGoal,
  opponentGoal,
  substitution,
  periodChanged,
  resetSeq,
} from "./factories";

const LINEUP = ["p1", "p2", "p3", "p4", "p5"];

beforeEach(resetSeq);

describe("reduceMatchEvents – goals", () => {
  it("own goal increments own score and gives +1 to every player on court", () => {
    const state = buildMatchState(LINEUP, [
      matchStarted(LINEUP),
      ownGoal({ lineup: LINEUP }),
    ]);
    expect(state.ownScore).toBe(1);
    expect(state.opponentScore).toBe(0);
    for (const id of LINEUP) {
      expect(state.playerStats[id]!.plus).toBe(1);
      expect(state.playerStats[id]!.minus).toBe(0);
      expect(state.playerStats[id]!.plusMinus).toBe(1);
    }
  });

  it("opponent goal increments opponent score and gives -1 to own players on court", () => {
    const state = buildMatchState(LINEUP, [
      matchStarted(LINEUP),
      opponentGoal({ lineup: LINEUP }),
    ]);
    expect(state.opponentScore).toBe(1);
    for (const id of LINEUP) {
      expect(state.playerStats[id]!.minus).toBe(1);
      expect(state.playerStats[id]!.plusMinus).toBe(-1);
    }
  });

  it("scorer gets a goal and assister gets an assist when provided", () => {
    const state = buildMatchState(LINEUP, [
      matchStarted(LINEUP),
      ownGoal({ lineup: LINEUP, scorer: "p3", assist: "p1" }),
    ]);
    expect(state.playerStats["p3"]!.goals).toBe(1);
    expect(state.playerStats["p1"]!.assists).toBe(1);
    expect(state.playerStats["p3"]!.assists).toBe(0);
  });

  it("plus/minus is independent of scorer/assist being recorded", () => {
    const withDetails = buildMatchState(LINEUP, [
      matchStarted(LINEUP),
      ownGoal({ lineup: LINEUP, scorer: "p3", assist: "p1" }),
    ]);
    const withoutDetails = buildMatchState(LINEUP, [
      matchStarted(LINEUP),
      ownGoal({ lineup: LINEUP }),
    ]);
    for (const id of LINEUP) {
      expect(withDetails.playerStats[id]!.plus).toBe(withoutDetails.playerStats[id]!.plus);
      expect(withDetails.playerStats[id]!.plusMinus).toBe(
        withoutDetails.playerStats[id]!.plusMinus,
      );
    }
    expect(withoutDetails.playerStats["p3"]!.goals).toBe(0);
  });

  it("own goal with scorer only (no assist) is valid", () => {
    const state = buildMatchState(LINEUP, [ownGoal({ lineup: LINEUP, scorer: "p2" })]);
    expect(state.playerStats["p2"]!.goals).toBe(1);
    expect(Object.values(state.playerStats).every((s) => s.assists === 0)).toBe(true);
  });
});

describe("reduceMatchEvents – penalty goals (6 m / 10 m)", () => {
  it("own penalty goal updates the score and scorer but gathers no plus", () => {
    const state = buildMatchState(LINEUP, [
      matchStarted(LINEUP),
      ownGoal({ lineup: LINEUP, scorer: "p3", situation: "PENALTY_6M" }),
    ]);
    expect(state.ownScore).toBe(1);
    expect(state.playerStats["p3"]!.goals).toBe(1);
    for (const id of LINEUP) expect(state.playerStats[id]!.plus).toBe(0);
  });

  it("opponent penalty goal updates the score but gathers no minus", () => {
    const state = buildMatchState(LINEUP, [
      matchStarted(LINEUP),
      opponentGoal({ lineup: LINEUP, situation: "PENALTY_10M" }),
    ]);
    expect(state.opponentScore).toBe(1);
    for (const id of LINEUP) expect(state.playerStats[id]!.minus).toBe(0);
  });

  it("reclassifying a penalty back to open play restores plus/minus", () => {
    const open = buildMatchState(LINEUP, [ownGoal({ lineup: LINEUP })]);
    const penalty = buildMatchState(LINEUP, [
      ownGoal({ lineup: LINEUP, situation: "PENALTY_6M" }),
    ]);
    expect(open.playerStats["p1"]!.plus).toBe(1);
    expect(penalty.playerStats["p1"]!.plus).toBe(0);
  });

  it("uneven-strength goals (e.g. 4v3 after a red card) gather no plus/minus", () => {
    const shortHanded = ["p1", "p2", "p3", "p4"];
    const own = buildMatchState(shortHanded, [
      ownGoal({ lineup: shortHanded, scorer: "p2", situation: "UNEVEN_STRENGTH" }),
    ]);
    const opp = buildMatchState(shortHanded, [
      opponentGoal({ lineup: shortHanded, situation: "UNEVEN_STRENGTH" }),
    ]);
    expect(own.ownScore).toBe(1);
    expect(own.playerStats["p2"]!.goals).toBe(1);
    for (const id of shortHanded) expect(own.playerStats[id]!.plus).toBe(0);

    expect(opp.opponentScore).toBe(1);
    for (const id of shortHanded) expect(opp.playerStats[id]!.minus).toBe(0);
  });
});

describe("reduceMatchEvents – substitutions", () => {
  it("removes the outgoing player and adds the incoming player to the lineup", () => {
    const state = buildMatchState([...LINEUP, "p6"], [
      matchStarted(LINEUP),
      substitution({ out: "p5", in: "p6", lineupAfter: ["p1", "p2", "p3", "p4", "p6"] }),
    ]);
    expect(state.lineupPlayerIds).toEqual(["p1", "p2", "p3", "p4", "p6"]);
  });

  it("credits +/- to the player who was on court at the moment of each goal", () => {
    const state = buildMatchState([...LINEUP, "p6"], [
      matchStarted(LINEUP),
      ownGoal({ lineup: LINEUP }), // p5 on court -> +1
      substitution({ out: "p5", in: "p6", lineupAfter: ["p1", "p2", "p3", "p4", "p6"] }),
      opponentGoal({ lineup: ["p1", "p2", "p3", "p4", "p6"] }), // p6 on court -> -1, p5 not
    ]);
    expect(state.playerStats["p5"]!.plus).toBe(1);
    expect(state.playerStats["p5"]!.minus).toBe(0);
    expect(state.playerStats["p6"]!.plus).toBe(0);
    expect(state.playerStats["p6"]!.minus).toBe(1);
  });
});

describe("reduceMatchEvents – ordering & determinism", () => {
  it("orders by sequence, not by match time", () => {
    const early = ownGoal({ lineup: LINEUP, time: 1100, sequence: 1 });
    const late = opponentGoal({ lineup: LINEUP, time: 30, sequence: 2 });
    const state = reduceMatchEvents(initialMatchState(LINEUP), [late, early]);
    expect(state.ownScore).toBe(1);
    expect(state.opponentScore).toBe(1);
  });

  it("is deterministic – rebuilding from the same events yields the same state (reload safety)", () => {
    const events = [
      matchStarted(LINEUP),
      ownGoal({ lineup: LINEUP, scorer: "p1" }),
      periodChanged(2),
      opponentGoal({ lineup: LINEUP }),
    ];
    const a = buildMatchState(LINEUP, events);
    const b = buildMatchState(LINEUP, events);
    expect(a).toEqual(b);
    expect(a.currentPeriod).toBe(2);
  });

  it("undo = dropping the last event recomputes cleanly", () => {
    const events = [
      matchStarted(LINEUP),
      ownGoal({ lineup: LINEUP }),
      opponentGoal({ lineup: LINEUP }),
    ];
    const full = buildMatchState(LINEUP, events);
    expect(full.opponentScore).toBe(1);

    const undone = buildMatchState(LINEUP, events.slice(0, -1));
    expect(undone.opponentScore).toBe(0);
    expect(undone.ownScore).toBe(1);
    for (const id of LINEUP) expect(undone.playerStats[id]!.minus).toBe(0);
  });
});
