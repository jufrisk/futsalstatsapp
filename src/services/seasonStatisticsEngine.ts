import type {
  Match,
  MatchEvent,
  MatchPlayer,
  Player,
  PlayerSeasonStats,
  SeasonRecord,
} from "@/domain/types";
import { calculateMatchStatistics } from "./statisticsEngine";

export interface MatchBundle {
  match: Match;
  matchPlayers: MatchPlayer[];
  events: MatchEvent[];
}

export interface PlayerSeasonStatsRow extends PlayerSeasonStats {
  playerNumber: number;
  playerName?: string;
}

export interface SeasonMatchLine {
  matchId: string;
  date: string;
  opponentName: string;
  goals: number;
  assists: number;
  plusMinus: number;
}

export interface SeasonStatistics {
  record: SeasonRecord;
  players: PlayerSeasonStatsRow[];
  perPlayerMatches: Record<string, SeasonMatchLine[]>;
}

const PLAYED: ReadonlyArray<Match["status"]> = ["LIVE", "FINISHED"];

/**
 * Season statistics are aggregated dynamically from every match's event log
 * (README §24, TECHNICAL_SPEC §31). Editing an old match therefore changes
 * season totals automatically.
 */
export function calculateSeasonStatistics(
  bundles: readonly MatchBundle[],
  players: readonly Player[] = [],
): SeasonStatistics {
  const record: SeasonRecord = {
    matchesPlayed: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
  };

  const agg = new Map<string, PlayerSeasonStatsRow>();
  const perPlayerMatches: Record<string, SeasonMatchLine[]> = {};
  const masterById = new Map(players.map((p) => [p.id, p]));

  const ensureRow = (playerId: string, number: number, name?: string): PlayerSeasonStatsRow => {
    let row = agg.get(playerId);
    if (!row) {
      const master = masterById.get(playerId);
      row = {
        playerId,
        appearances: 0,
        goals: 0,
        assists: 0,
        points: 0,
        plus: 0,
        minus: 0,
        plusMinus: 0,
        playerNumber: master?.number ?? number,
        playerName: master?.name ?? name,
      };
      agg.set(playerId, row);
    }
    return row;
  };

  const played = [...bundles]
    .filter((b) => PLAYED.includes(b.match.status))
    .sort((a, b) => b.match.date.localeCompare(a.match.date));

  for (const bundle of played) {
    const { state, rows } = calculateMatchStatistics(bundle.matchPlayers, bundle.events);

    if (bundle.match.status === "FINISHED") {
      record.matchesPlayed += 1;
      record.goalsFor += state.ownScore;
      record.goalsAgainst += state.opponentScore;
      if (state.ownScore > state.opponentScore) record.wins += 1;
      else if (state.ownScore < state.opponentScore) record.losses += 1;
      else record.draws += 1;
    }

    for (const mp of bundle.matchPlayers) {
      if (!mp.selected) continue;
      const row = ensureRow(mp.playerId, mp.playerNumber, mp.playerName);
      row.appearances += 1;
    }

    for (const r of rows) {
      const row = ensureRow(r.playerId, r.playerNumber, r.playerName);
      row.goals += r.goals;
      row.assists += r.assists;
      row.plus += r.plus;
      row.minus += r.minus;

      (perPlayerMatches[r.playerId] ??= []).push({
        matchId: bundle.match.id,
        date: bundle.match.date,
        opponentName: bundle.match.opponentName,
        goals: r.goals,
        assists: r.assists,
        plusMinus: r.plusMinus,
      });
    }
  }

  const playerRows = [...agg.values()].map((row) => ({
    ...row,
    points: row.goals + row.assists,
    plusMinus: row.plus - row.minus,
  }));

  playerRows.sort(
    (a, b) =>
      b.points - a.points ||
      b.plusMinus - a.plusMinus ||
      b.goals - a.goals ||
      a.playerNumber - b.playerNumber,
  );

  return { record, players: playerRows, perPlayerMatches };
}
