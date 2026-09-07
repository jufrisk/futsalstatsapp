import {
  db,
  clearAllData,
  ALL_TABLES,
  SYNC_TABLE_NAMES,
  type SyncTableName,
} from "@/db/database";
import { appBackupSchema, matchExportSchema } from "@/domain/schemas";
import type { AppBackup, MatchExport, Player } from "@/domain/types";
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

const BACKUP_TABLE_KEYS: Record<SyncTableName, keyof AppBackup> = {
  seasons: "seasons",
  teams: "teams",
  matches: "matches",
  matchPlayers: "matchPlayers",
  matchEvents: "matchEvents",
};

/**
 * TECHNICAL_SPEC §41 – parse, Zod-validate, schemaVersion check, then a single
 * IndexedDB transaction. On "replace", every record the backup no longer
 * contains gets a tombstone so the deletion propagates to other devices.
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

  let removedTombstones: Awaited<ReturnType<typeof collectRemovedTombstones>> = [];
  let softDeletedPlayers: Player[] = [];
  if (mode === "replace") {
    removedTombstones = await collectRemovedTombstones(backup);
    const keptPlayerIds = new Set(backup.players.map((p) => p.id));
    const ts = nowIso();
    softDeletedPlayers = (await db.players.toArray())
      .filter((p) => !keptPlayerIds.has(p.id) && !p.deletedAt)
      .map((p) => ({ ...p, deletedAt: ts, updatedAt: ts }));
    await clearAllData();
  }

  await db.transaction("rw", [...ALL_TABLES, db.tombstones], async () => {
    await db.seasons.bulkPut(backup.seasons);
    await db.teams.bulkPut(backup.teams);
    await db.players.bulkPut(backup.players);
    await db.matches.bulkPut(backup.matches);
    await db.matchPlayers.bulkPut(backup.matchPlayers);
    await db.matchEvents.bulkPut(backup.matchEvents);

    // Players use a soft delete (own table) rather than tombstones: a "replace"
    // marks any player the backup dropped as deleted so the removal syncs.
    if (softDeletedPlayers.length > 0) {
      await db.players.bulkPut(softDeletedPlayers);
    }

    if (removedTombstones.length > 0) {
      await db.tombstones.bulkPut(removedTombstones);
    }
    // Anything present in the backup is explicitly alive again.
    const revived: string[] = [];
    for (const table of SYNC_TABLE_NAMES) {
      for (const row of backup[BACKUP_TABLE_KEYS[table]] as { id: string }[]) {
        revived.push(`${table}:${row.id}`);
      }
    }
    await db.tombstones.bulkDelete(revived);
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

async function collectRemovedTombstones(backup: AppBackup) {
  const ts = nowIso();
  const rows: { id: string; table: SyncTableName; recordId: string; deletedAt: string }[] = [];
  for (const table of SYNC_TABLE_NAMES) {
    const keptIds = new Set(
      (backup[BACKUP_TABLE_KEYS[table]] as { id: string }[]).map((r) => r.id),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing: string[] = await (db as any)[table].toCollection().primaryKeys();
    for (const id of existing) {
      if (!keptIds.has(id)) {
        rows.push({ id: `${table}:${id}`, table, recordId: id, deletedAt: ts });
      }
    }
  }
  return rows;
}

export function parseMatchExport(raw: unknown): MatchExport {
  const parsed = matchExportSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Ottelutiedosto ei kelpaa.");
  }
  return parsed.data;
}
