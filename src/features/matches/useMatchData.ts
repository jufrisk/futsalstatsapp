import { useMemo } from "react";
import { useMatch, useMatchEvents, useMatchRoster } from "@/app/hooks";
import type { Match, MatchEvent, MatchPlayer, MatchState } from "@/domain/types";
import { formatPlayerLabel } from "@/domain/format";
import { buildMatchState } from "@/services/matchEngine";
import { calculateMatchStatistics, type MatchStatistics } from "@/services/statisticsEngine";

export interface MatchData {
  match: Match | undefined;
  roster: MatchPlayer[];
  selectedRoster: MatchPlayer[];
  events: MatchEvent[];
  state: MatchState;
  stats: MatchStatistics;
  labelOf: (playerId: string | undefined) => string;
  numberOf: (playerId: string | undefined) => number | undefined;
  loading: boolean;
}

export function useMatchData(matchId: string | undefined): MatchData {
  const match = useMatch(matchId);
  const roster = useMatchRoster(matchId);
  const events = useMatchEvents(matchId);

  return useMemo<MatchData>(() => {
    const selectedRoster = roster.filter((mp) => mp.selected);
    const seedIds = selectedRoster.map((mp) => mp.playerId);
    const state = buildMatchState(seedIds, events);
    const stats = calculateMatchStatistics(roster, events);

    const byId = new Map(roster.map((mp) => [mp.playerId, mp]));
    const labelOf = (playerId: string | undefined): string => {
      if (!playerId) return "—";
      const mp = byId.get(playerId);
      return mp ? formatPlayerLabel(mp.playerNumber, mp.playerName) : "#?";
    };
    const numberOf = (playerId: string | undefined): number | undefined =>
      playerId ? byId.get(playerId)?.playerNumber : undefined;

    return {
      match,
      roster,
      selectedRoster,
      events,
      state,
      stats,
      labelOf,
      numberOf,
      loading: matchId != null && match === undefined,
    };
  }, [match, roster, events, matchId]);
}
