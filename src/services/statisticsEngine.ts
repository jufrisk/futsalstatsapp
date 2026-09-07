import type {
  MatchEvent,
  MatchPlayer,
  MatchState,
  PlayerMatchStats,
} from "@/domain/types";
import { buildMatchState, emptyPlayerStats } from "./matchEngine";

export interface MatchStatRow extends PlayerMatchStats {
  playerNumber: number;
  playerName?: string;
  selected: boolean;
  startingLineup: boolean;
}

export interface MatchStatistics {
  state: MatchState;
  rows: MatchStatRow[];
  ownScore: number;
  opponentScore: number;
}

/**
 * Match statistics are always derived from the event log + roster snapshot.
 * Nothing here is persisted (TECHNICAL_SPEC §30, §34).
 */
export function calculateMatchStatistics(
  matchPlayers: readonly MatchPlayer[],
  events: readonly MatchEvent[],
): MatchStatistics {
  const selected = matchPlayers.filter((mp) => mp.selected);
  const seedIds = selected.map((mp) => mp.playerId);
  const state = buildMatchState(seedIds, events);

  const byPlayerId = new Map(matchPlayers.map((mp) => [mp.playerId, mp]));

  const rows: MatchStatRow[] = selected.map((mp) => {
    const stats = state.playerStats[mp.playerId] ?? emptyPlayerStats(mp.playerId);
    return {
      ...stats,
      plusMinus: stats.plus - stats.minus,
      playerNumber: mp.playerNumber,
      playerName: mp.playerName,
      selected: mp.selected,
      startingLineup: mp.startingLineup,
    };
  });

  // Include stat lines for players who appear in events but are not in the
  // selected roster (defensive — should not normally happen).
  for (const [playerId, stats] of Object.entries(state.playerStats)) {
    if (byPlayerId.get(playerId)?.selected) continue;
    if (stats.plus === 0 && stats.minus === 0 && stats.goals === 0 && stats.assists === 0) {
      continue;
    }
    const mp = byPlayerId.get(playerId);
    rows.push({
      ...stats,
      plusMinus: stats.plus - stats.minus,
      playerNumber: mp?.playerNumber ?? 0,
      playerName: mp?.playerName,
      selected: false,
      startingLineup: false,
    });
  }

  rows.sort(
    (a, b) =>
      b.plusMinus - a.plusMinus ||
      b.goals - a.goals ||
      b.assists - a.assists ||
      a.playerNumber - b.playerNumber,
  );

  return {
    state,
    rows,
    ownScore: state.ownScore,
    opponentScore: state.opponentScore,
  };
}
