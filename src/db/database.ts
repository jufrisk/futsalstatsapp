import Dexie, { type Table } from "dexie";
import type {
  Match,
  MatchEvent,
  MatchPlayer,
  Player,
  Season,
  Team,
} from "@/domain/types";

/**
 * Tables whose whole content lives in the shared `app_state` JSON document.
 * `players` is NOT here — it has its own Postgres table (see services/sync/players.ts).
 */
export type SyncTableName =
  | "seasons"
  | "teams"
  | "matches"
  | "matchPlayers"
  | "matchEvents";

/** A record deleted locally, kept so the deletion can propagate during sync. */
export interface Tombstone {
  id: string; // `${table}:${recordId}`
  table: SyncTableName;
  recordId: string;
  deletedAt: string;
}

export class FutsalStatsDatabase extends Dexie {
  seasons!: Table<Season, string>;
  teams!: Table<Team, string>;
  players!: Table<Player, string>;
  matches!: Table<Match, string>;
  matchPlayers!: Table<MatchPlayer, string>;
  matchEvents!: Table<MatchEvent, string>;
  tombstones!: Table<Tombstone, string>;

  constructor(name = "FutsalStats") {
    super(name);
    this.version(1).stores({
      seasons: "id,name,active",
      teams: "id,name",
      players: "id,teamId,number,active",
      matches: "id,seasonId,teamId,date,status",
      matchPlayers: "id,matchId,playerId",
      matchEvents: "id,matchId,sequence,type,period",
    });
    // v2 adds a tombstone table for multi-device sync (existing data is kept).
    this.version(2).stores({
      tombstones: "id,table,deletedAt",
    });
  }
}

export const db = new FutsalStatsDatabase();

export const ALL_TABLES = [
  db.seasons,
  db.teams,
  db.players,
  db.matches,
  db.matchPlayers,
  db.matchEvents,
];

export const SYNC_TABLE_NAMES: SyncTableName[] = [
  "seasons",
  "teams",
  "matches",
  "matchPlayers",
  "matchEvents",
];

export async function recordTombstone(
  table: SyncTableName,
  recordId: string,
  deletedAt = new Date().toISOString(),
): Promise<void> {
  await db.tombstones.put({ id: `${table}:${recordId}`, table, recordId, deletedAt });
}

export async function clearTombstones(table: SyncTableName, recordIds: string[]): Promise<void> {
  if (recordIds.length === 0) return;
  await db.tombstones.bulkDelete(recordIds.map((rid) => `${table}:${rid}`));
}

export async function clearAllData(): Promise<void> {
  await db.transaction("rw", [...ALL_TABLES, db.tombstones], async () => {
    await Promise.all([...ALL_TABLES.map((t) => t.clear()), db.tombstones.clear()]);
  });
}
