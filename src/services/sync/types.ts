import type { SyncTableName } from "@/db/database";
import type {
  Match,
  MatchEvent,
  MatchPlayer,
  Player,
  Season,
  Team,
} from "@/domain/types";

export interface SnapshotTables {
  seasons: Season[];
  teams: Team[];
  players: Player[];
  matches: Match[];
  matchPlayers: MatchPlayer[];
  matchEvents: MatchEvent[];
}

/** recordId -> ISO deletedAt */
export type TombstoneMap = Partial<Record<SyncTableName, Record<string, string>>>;

/**
 * The full application state as stored in the shared cloud document
 * (`app_state.data`). A monotonically increasing `version` column guards
 * concurrent writes; the merge is per-record last-write-wins by `updatedAt`.
 */
export interface SyncSnapshot {
  schemaVersion: 1;
  tables: SnapshotTables;
  tombstones: TombstoneMap;
}

export const SYNC_SNAPSHOT_TABLES: (keyof SnapshotTables)[] = [
  "seasons",
  "teams",
  "players",
  "matches",
  "matchPlayers",
  "matchEvents",
];

export function emptySnapshot(): SyncSnapshot {
  return {
    schemaVersion: 1,
    tables: {
      seasons: [],
      teams: [],
      players: [],
      matches: [],
      matchPlayers: [],
      matchEvents: [],
    },
    tombstones: {},
  };
}
