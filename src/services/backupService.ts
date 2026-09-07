import { db, clearAllData, ALL_TABLES } from "@/db/database";
import { appBackupSchema, matchExportSchema } from "@/domain/schemas";
import type { AppBackup, MatchExport } from "@/domain/types";
import { nowIso } from "@/domain/ids";

export async function buildBackup(): Promise<AppBackup> {
  const [seasons, teams, players, matches, matchPlayers, matchEvents] = await Promise.all([
    db.seasons.toArray(),
    db.teams.toArray(),
    db.players.toArray(),
    db.matches.toArray(),
    db.matchPlayers.toArray(),
    db.matchEvents.toArray(),
  ]);
  return {
    schemaVersion: 1,
    exportedAt: nowIso(),
    seasons,
    teams,
    players,
    matches,
    matchPlayers,
    matchEvents,
  };
}

export async function buildMatchExport(matchId: string): Promise<MatchExport> {
  const match = await db.matches.get(matchId);
  if (!match) throw new Error("Ottelua ei löytynyt.");
  const [matchPlayers, matchEvents] = await Promise.all([
    db.matchPlayers.where("matchId").equals(matchId).toArray(),
    db.matchEvents.where("matchId").equals(matchId).toArray(),
  ]);
  return {
    schemaVersion: 1,
    exportedAt: nowIso(),
    match,
    matchPlayers: matchPlayers.sort((a, b) => a.playerNumber - b.playerNumber),
    matchEvents: matchEvents.sort((a, b) => a.sequence - b.sequence),
  };
}

export type ImportMode = "replace" | "merge";

export interface ImportResult {
  mode: ImportMode;
  counts: Record<string, number>;
}

/**
 * TECHNICAL_SPEC §41 – parse, Zod-validate, schemaVersion check, conflict
 * handling, single IndexedDB transaction, then the UI refreshes via liveQuery.
 */
export async function restoreBackup(raw: unknown, mode: ImportMode): Promise<ImportResult> {
  const parsed = appBackupSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      "Varmuuskopio ei kelpaa: " + parsed.error.issues.map((i) => i.message).join("; "),
    );
  }
  const backup = parsed.data;
  if (backup.schemaVersion !== 1) {
    throw new Error(`Tuntematon schemaVersion: ${backup.schemaVersion}`);
  }

  if (mode === "replace") {
    await clearAllData();
  }

  await db.transaction("rw", ALL_TABLES, async () => {
      await db.seasons.bulkPut(backup.seasons);
      await db.teams.bulkPut(backup.teams);
      await db.players.bulkPut(backup.players);
      await db.matches.bulkPut(backup.matches);
      await db.matchPlayers.bulkPut(backup.matchPlayers);
      await db.matchEvents.bulkPut(backup.matchEvents);

      if (mode === "merge") {
        const activeCount = (await db.seasons.toArray()).filter((s) => s.active).length;
        if (activeCount !== 1) {
          const all = await db.seasons.toArray();
          await Promise.all(
            all.map((s, i) => db.seasons.update(s.id, { active: i === 0 })),
          );
        }
      }
  });

  return {
    mode,
    counts: {
      seasons: backup.seasons.length,
      teams: backup.teams.length,
      players: backup.players.length,
      matches: backup.matches.length,
      matchPlayers: backup.matchPlayers.length,
      matchEvents: backup.matchEvents.length,
    },
  };
}

export function parseMatchExport(raw: unknown): MatchExport {
  const parsed = matchExportSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Ottelutiedosto ei kelpaa.");
  }
  return parsed.data;
}
