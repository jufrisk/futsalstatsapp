import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { db } from "@/db/database";
import type { Player } from "@/domain/types";
import {
  calculateSeasonStatistics,
  type MatchBundle,
  type SeasonStatistics,
} from "@/services/seasonStatisticsEngine";

export function useSeasonBundles(seasonId: string | undefined): MatchBundle[] | undefined {
  return useLiveQuery(async () => {
    if (!seasonId) return [];
    const matches = await db.matches.where("seasonId").equals(seasonId).toArray();
    const bundles: MatchBundle[] = [];
    for (const match of matches) {
      const [matchPlayers, events] = await Promise.all([
        db.matchPlayers.where("matchId").equals(match.id).toArray(),
        db.matchEvents.where("matchId").equals(match.id).toArray(),
      ]);
      bundles.push({
        match,
        matchPlayers,
        events: events.sort((a, b) => a.sequence - b.sequence),
      });
    }
    return bundles;
  }, [seasonId]);
}

export function useSeasonStatistics(
  seasonId: string | undefined,
  players: readonly Player[],
): { data: SeasonStatistics | undefined; loading: boolean } {
  const bundles = useSeasonBundles(seasonId);
  const data = useMemo(
    () => (bundles ? calculateSeasonStatistics(bundles, players) : undefined),
    [bundles, players],
  );
  return { data, loading: bundles === undefined };
}
