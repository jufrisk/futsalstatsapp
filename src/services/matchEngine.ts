import type {
  MatchEvent,
  MatchState,
  PlayerMatchStats,
  Period,
} from "@/domain/types";
import { goalCountsForPlusMinus } from "@/domain/goals";

/**
 * Event-sourced match reducer (TECHNICAL_SPEC §17–20).
 *
 *   initialState + ordered events = current match state
 *
 * Events are ordered by `sequence` ASC — never by match time, because the user
 * may record events with a delay.
 */

export function emptyPlayerStats(playerId: string): PlayerMatchStats {
  return { playerId, goals: 0, assists: 0, plus: 0, minus: 0, plusMinus: 0 };
}

export function initialMatchState(seedPlayerIds: string[] = []): MatchState {
  const playerStats: Record<string, PlayerMatchStats> = {};
  for (const id of seedPlayerIds) playerStats[id] = emptyPlayerStats(id);
  return {
    ownScore: 0,
    opponentScore: 0,
    currentPeriod: 1,
    lineupPlayerIds: [],
    started: false,
    finished: false,
    playerStats,
  };
}

export function sortEvents(events: readonly MatchEvent[]): MatchEvent[] {
  return [...events].sort((a, b) => a.sequence - b.sequence);
}

function ensure(state: MatchState, playerId: string): PlayerMatchStats {
  let stats = state.playerStats[playerId];
  if (!stats) {
    stats = emptyPlayerStats(playerId);
    state.playerStats[playerId] = stats;
  }
  return stats;
}

function applyEvent(state: MatchState, event: MatchEvent): void {
  switch (event.type) {
    case "MATCH_STARTED": {
      state.started = true;
      state.lineupPlayerIds = [...new Set(event.payload.startingLineupPlayerIds)];
      for (const id of state.lineupPlayerIds) ensure(state, id);
      break;
    }

    case "PERIOD_CHANGED": {
      state.currentPeriod = event.payload.period as Period;
      break;
    }

    case "SUBSTITUTION": {
      const { playerOutId, playerInId, lineupAfter } = event.payload;
      let next = state.lineupPlayerIds.filter((id) => id !== playerOutId);
      if (!next.includes(playerInId)) next.push(playerInId);
      // If the running lineup is empty (e.g. a sub recorded before MATCH_STARTED
      // during correction), fall back to the stored snapshot.
      if (state.lineupPlayerIds.length === 0 && lineupAfter.length > 0) {
        next = [...new Set(lineupAfter)];
      }
      state.lineupPlayerIds = next;
      ensure(state, playerInId);
      break;
    }

    case "OWN_GOAL": {
      state.ownScore += 1;
      // Penalty goals (6 m / 10 m) count for the score only — no plus/minus.
      if (goalCountsForPlusMinus(event.payload.situation)) {
        for (const id of event.payload.lineupPlayerIds) ensure(state, id).plus += 1;
      }
      if (event.payload.scorerPlayerId) {
        ensure(state, event.payload.scorerPlayerId).goals += 1;
      }
      if (event.payload.assistPlayerId) {
        ensure(state, event.payload.assistPlayerId).assists += 1;
      }
      break;
    }

    case "OPPONENT_GOAL": {
      state.opponentScore += 1;
      if (goalCountsForPlusMinus(event.payload.situation)) {
        for (const id of event.payload.lineupPlayerIds) ensure(state, id).minus += 1;
      }
      break;
    }

    case "MATCH_FINISHED": {
      state.finished = true;
      break;
    }
  }
}

export function reduceMatchEvents(
  initialState: MatchState,
  events: readonly MatchEvent[],
): MatchState {
  const state: MatchState = {
    ...initialState,
    lineupPlayerIds: [...initialState.lineupPlayerIds],
    playerStats: Object.fromEntries(
      Object.entries(initialState.playerStats).map(([id, s]) => [id, { ...s }]),
    ),
  };

  for (const event of sortEvents(events)) applyEvent(state, event);

  for (const stats of Object.values(state.playerStats)) {
    stats.plusMinus = stats.plus - stats.minus;
  }

  return state;
}

/** Convenience: rebuild full state from a roster + the raw event list. */
export function buildMatchState(
  seedPlayerIds: string[],
  events: readonly MatchEvent[],
): MatchState {
  return reduceMatchEvents(initialMatchState(seedPlayerIds), events);
}

export function nextSequence(events: readonly MatchEvent[]): number {
  return events.reduce((max, e) => Math.max(max, e.sequence), 0) + 1;
}

export function lastEvent(events: readonly MatchEvent[]): MatchEvent | undefined {
  return sortEvents(events).at(-1);
}
