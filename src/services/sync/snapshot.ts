import { db, ALL_TABLES, SYNC_TABLE_NAMES, type SyncTableName } from "@/db/database";
import type { SyncSnapshot, TombstoneMap } from "./types";
import { emptySnapshot } from "./types";
import { snapshotsEqual } from "./merge";

export async function buildLocalSnapshot(): Promise<SyncSnapshot> {
  const snap = emptySnapshot();
  const [seasons, teams, matches, matchPlayers, matchEvents, tombstones] =
    await Promise.all([
      db.seasons.toArray(),
      db.teams.toArray(),
      db.matches.toArray(),
      db.matchPlayers.toArray(),
      db.matchEvents.toArray(),
      db.tombstones.toArray(),
    ]);

  snap.tables = { seasons, teams, matches, matchPlayers, matchEvents };

  const tomb: TombstoneMap = {};
  for (const t of tombstones) {
    (tomb[t.table] ??= {})[t.recordId] = t.deletedAt;
  }
  snap.tombstones = tomb;
  return snap;
}

/**
 * Overwrite local IndexedDB so it matches `merged` exactly: upsert every row,
 * delete tombstoned ids, and replace the tombstone table. Runs in one
 * transaction. Returns `true` if anything actually changed.
 */
export async function applySnapshot(merged: SyncSnapshot): Promise<boolean> {
  const current = await buildLocalSnapshot();
  if (snapshotsEqual(current, merged)) return false;

  await db.transaction("rw", [...ALL_TABLES, db.tombstones], async () => {
    for (const table of SYNC_TABLE_NAMES) {
      const rows = merged.tables[table] ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any)[table].bulkPut(rows);

      const deadIds = Object.keys(merged.tombstones[table] ?? {});
      if (deadIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db as any)[table].bulkDelete(deadIds);
      }

      // Remove local rows that the merge dropped without a tombstone
      // (should be rare; keeps the two sides exactly aligned).
      const keep = new Set(rows.map((r: { id: string }) => r.id));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const localIds: string[] = await (db as any)[table].toCollection().primaryKeys();
      const orphans = localIds.filter((id) => !keep.has(id) && !deadIds.includes(id));
      if (orphans.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db as any)[table].bulkDelete(orphans);
      }
    }

    await db.tombstones.clear();
    const flat = Object.entries(merged.tombstones).flatMap(([table, map]) =>
      Object.entries(map ?? {}).map(([recordId, deletedAt]) => ({
        id: `${table}:${recordId}`,
        table: table as SyncTableName,
        recordId,
        deletedAt,
      })),
    );
    if (flat.length > 0) await db.tombstones.bulkPut(flat);
  });

  return true;
}
