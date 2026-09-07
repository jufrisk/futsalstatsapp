import type { GoalSituation, MatchEvent, MatchPlayer, Period } from "@/domain/types";

let seq = 0;
export function resetSeq() {
  seq = 0;
}

const ts = "2026-09-07T10:00:00.000Z";

function base<T extends MatchEvent["type"]>(type: T, period: Period, sequence?: number) {
  const s = sequence ?? ++seq;
  return {
    id: `evt-${type}-${s}`,
    matchId: "m1",
    type,
    sequence: s,
    period,
    source: "MANUAL" as const,
    createdAt: ts,
    updatedAt: ts,
  };
}

export function matchStarted(lineup: string[], sequence?: number): MatchEvent {
  return { ...base("MATCH_STARTED", 1, sequence), payload: { startingLineupPlayerIds: lineup } };
}

export function ownGoal(
  opts: {
    lineup: string[];
    scorer?: string;
    assist?: string;
    period?: Period;
    time?: number;
    sequence?: number;
    situation?: GoalSituation;
  },
): MatchEvent {
  return {
    ...base("OWN_GOAL", opts.period ?? 1, opts.sequence),
    matchTimeSeconds: opts.time,
    payload: {
      lineupPlayerIds: opts.lineup,
      scorerPlayerId: opts.scorer,
      assistPlayerId: opts.assist,
      situation: opts.situation,
    },
  };
}

export function opponentGoal(
  opts: {
    lineup: string[];
    period?: Period;
    time?: number;
    sequence?: number;
    situation?: GoalSituation;
  },
): MatchEvent {
  return {
    ...base("OPPONENT_GOAL", opts.period ?? 1, opts.sequence),
    matchTimeSeconds: opts.time,
    payload: { lineupPlayerIds: opts.lineup, situation: opts.situation },
  };
}

export function substitution(
  opts: { out: string; in: string; lineupAfter: string[]; period?: Period; sequence?: number },
): MatchEvent {
  return {
    ...base("SUBSTITUTION", opts.period ?? 1, opts.sequence),
    payload: { playerOutId: opts.out, playerInId: opts.in, lineupAfter: opts.lineupAfter },
  };
}

export function periodChanged(period: Period, sequence?: number): MatchEvent {
  return { ...base("PERIOD_CHANGED", period, sequence), payload: { period } };
}

export function matchFinished(sequence?: number): MatchEvent {
  return { ...base("MATCH_FINISHED", 2, sequence), payload: {} };
}

export function roster(
  entries: Array<{ playerId: string; number: number; name?: string; selected?: boolean; starter?: boolean }>,
): MatchPlayer[] {
  return entries.map((e, i) => ({
    id: `mp-${i}`,
    matchId: "m1",
    playerId: e.playerId,
    playerNumber: e.number,
    playerName: e.name,
    selected: e.selected ?? true,
    startingLineup: e.starter ?? false,
  }));
}
