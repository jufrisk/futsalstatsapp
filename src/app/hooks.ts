import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { db } from "@/db/database";
import { ensureBootstrap, listMatchEvents, getMatchRoster } from "@/db/repositories";
import type { Match, MatchEvent, MatchPlayer, Player, Season, Team } from "@/domain/types";
import { forceSync, getSyncStatus, startSync, syncConfigured } from "@/services/sync";
import { ACTIVE_SEASON_EVENT, getStoredActiveSeasonId } from "./activeSeason";

const BOOTSTRAP_SYNC_RETRIES = 3;
const BOOTSTRAP_SYNC_RETRY_DELAY_MS = 1000;

export function useBootstrap(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (syncConfigured) {
          // Pull the shared data first so a fresh device doesn't create a
          // duplicate team/season before it learns about the cloud one. A
          // transient failure (cold network, DNS not ready yet) must not be
          // read as "the cloud is genuinely empty" — that would make
          // ensureBootstrap() below fabricate a brand-new team/season, which
          // then syncs out as a permanent duplicate. So retry a few times
          // before falling back to local-only bootstrap.
          startSync();
          for (let attempt = 0; attempt <= BOOTSTRAP_SYNC_RETRIES && !cancelled; attempt++) {
            await forceSync().catch(() => undefined);
            if (getSyncStatus().state === "idle") break;
            if (attempt < BOOTSTRAP_SYNC_RETRIES) {
              await new Promise((r) => setTimeout(r, BOOTSTRAP_SYNC_RETRY_DELAY_MS));
            }
          }
        }
        await ensureBootstrap();
      } catch (err) {
        console.error("bootstrap failed", err);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return ready;
}

export function useTeam(): Team | undefined {
  return useLiveQuery(async () => {
    const teams = await db.teams.toArray();
    if (teams.length <= 1) return teams[0];
    // More than one team means a bootstrap race once created a duplicate
    // (see useBootstrap above). Prefer whichever actually has a roster
    // instead of an arbitrary/empty one; tie-break deterministically by id.
    const players = await db.players.toArray();
    const counts = new Map<string, number>();
    for (const p of players) {
      if (p.deletedAt) continue;
      counts.set(p.teamId, (counts.get(p.teamId) ?? 0) + 1);
    }
    return [...teams].sort(
      (a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.id.localeCompare(b.id),
    )[0];
  }, []);
}

export function useSeasons(): Season[] {
  return (
    useLiveQuery(
      () =>
        db.seasons.toArray().then((r) => r.sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
      [],
    ) ?? []
  );
}

/** seasonId -> number of matches, for the default-season heuristic below. */
function useSeasonMatchCounts(): Map<string, number> {
  return (
    useLiveQuery(async () => {
      const matches = await db.matches.toArray();
      const counts = new Map<string, number>();
      for (const m of matches) counts.set(m.seasonId, (counts.get(m.seasonId) ?? 0) + 1);
      return counts;
    }, []) ?? new Map()
  );
}

export function useActiveSeason(): Season | undefined {
  const seasons = useSeasons(); // newest createdAt first
  const matchCounts = useSeasonMatchCounts();
  const [storedId, setStoredId] = useState<string | null>(() => getStoredActiveSeasonId());

  useEffect(() => {
    const update = () => setStoredId(getStoredActiveSeasonId());
    window.addEventListener(ACTIVE_SEASON_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(ACTIVE_SEASON_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);

  if (seasons.length === 0) return undefined;

  const stored = seasons.find((s) => s.id === storedId);
  if (stored) return stored;

  // This device has never explicitly chosen a season (fresh browser/device,
  // or its choice no longer exists). Rather than defaulting to whichever
  // season happens to have the newest `createdAt` — which, if a bootstrap
  // race ever created an empty duplicate (see useBootstrap), would be that
  // empty one instead of the season people actually use — prefer a season
  // that has matches in it.
  const withMatches = seasons.filter((s) => (matchCounts.get(s.id) ?? 0) > 0);
  return (withMatches.length > 0 ? withMatches : seasons)[0];
}

export function usePlayers(teamId: string | undefined, includeInactive = false): Player[] {
  return (
    useLiveQuery(async () => {
      if (!teamId) return [];
      const rows = await db.players.where("teamId").equals(teamId).toArray();
      return rows
        .filter((p) => !p.deletedAt && (includeInactive || p.active))
        .sort((a, b) => a.number - b.number);
    }, [teamId, includeInactive]) ?? []
  );
}

export function useMatchesBySeason(seasonId: string | undefined): Match[] {
  return (
    useLiveQuery(async () => {
      if (!seasonId) return [];
      const rows = await db.matches.where("seasonId").equals(seasonId).toArray();
      return rows.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    }, [seasonId]) ?? []
  );
}

export function useMatch(matchId: string | undefined): Match | undefined {
  return useLiveQuery(() => (matchId ? db.matches.get(matchId) : undefined), [matchId]);
}

export function useMatchRoster(matchId: string | undefined): MatchPlayer[] {
  return (
    useLiveQuery(() => (matchId ? getMatchRoster(matchId) : Promise.resolve([])), [matchId]) ?? []
  );
}

export function useMatchEvents(matchId: string | undefined): MatchEvent[] {
  return (
    useLiveQuery(() => (matchId ? listMatchEvents(matchId) : Promise.resolve([])), [matchId]) ?? []
  );
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}
