import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { db } from "@/db/database";
import { ensureBootstrap, listMatchEvents, getMatchRoster } from "@/db/repositories";
import type { Match, MatchEvent, MatchPlayer, Player, Season, Team } from "@/domain/types";

export function useBootstrap(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    ensureBootstrap()
      .then(() => !cancelled && setReady(true))
      .catch((err) => {
        console.error("bootstrap failed", err);
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return ready;
}

export function useTeam(): Team | undefined {
  return useLiveQuery(() => db.teams.toCollection().first(), []);
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

export function useActiveSeason(): Season | undefined {
  return useLiveQuery(async () => {
    const active = await db.seasons.filter((s) => s.active).first();
    return active ?? (await db.seasons.toCollection().first());
  }, []);
}

export function usePlayers(teamId: string | undefined, includeInactive = false): Player[] {
  return (
    useLiveQuery(async () => {
      if (!teamId) return [];
      const rows = await db.players.where("teamId").equals(teamId).toArray();
      return rows
        .filter((p) => includeInactive || p.active)
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
