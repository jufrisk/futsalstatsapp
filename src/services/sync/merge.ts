import type { SyncSnapshot } from "./types";
import { SYNC_SNAPSHOT_TABLES, emptySnapshot } from "./types";

type AnyRecord = { id: string; updatedAt?: string; createdAt?: string };

function recordTime(r: AnyRecord): string {
  return r.updatedAt ?? r.createdAt ?? "";
}

function laterIso(a: string | undefined, b: string | undefined): string | undefined {
  if (a == null) return b;
  if (b == null) return a;
  return a >= b ? a : b;
}

/** Pick the more recently touched of two records (ties favour `b` = remote). */
function newer<T extends AnyRecord>(a: T | undefined, b: T | undefined): T | undefined {
  if (!a) return b;
  if (!b) return a;
  return recordTime(a) > recordTime(b) ? a : b;
}

/**
 * Merge two snapshots into one, deterministically and commutatively enough to
 * converge: per record, the newest `updatedAt` wins; a tombstone wins unless a
 * record was touched strictly after it was deleted (i.e. re-created / edited).
 */
export function mergeSnapshots(local: SyncSnapshot, remote: SyncSnapshot): SyncSnapshot {
  const out = emptySnapshot();

  for (const table of SYNC_SNAPSHOT_TABLES) {
    const lRows = (local.tables[table] ?? []) as AnyRecord[];
    const rRows = (remote.tables[table] ?? []) as AnyRecord[];
    const lById = new Map(lRows.map((r) => [r.id, r]));
    const rById = new Map(rRows.map((r) => [r.id, r]));

    const lTomb = local.tombstones[table] ?? {};
    const rTomb = remote.tombstones[table] ?? {};

    const ids = new Set<string>([
      ...lById.keys(),
      ...rById.keys(),
      ...Object.keys(lTomb),
      ...Object.keys(rTomb),
    ]);

    const mergedRows: AnyRecord[] = [];
    const mergedTomb: Record<string, string> = {};

    for (const id of ids) {
      const winner = newer(lById.get(id), rById.get(id));
      const tomb = laterIso(lTomb[id], rTomb[id]);

      if (winner && (!tomb || recordTime(winner) > tomb)) {
        mergedRows.push(winner);
      } else if (tomb) {
        mergedTomb[id] = tomb;
      }
    }

    mergedRows.sort((a, b) => a.id.localeCompare(b.id));
    (out.tables as unknown as Record<string, AnyRecord[]>)[table] = mergedRows;
    if (Object.keys(mergedTomb).length > 0) out.tombstones[table] = mergedTomb;
  }

  return out;
}

/** Deterministic stringify with sorted keys, for cheap snapshot equality. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      return Object.keys(val as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (val as Record<string, unknown>)[k];
          return acc;
        }, {});
    }
    return val;
  });
}

export function snapshotsEqual(a: SyncSnapshot, b: SyncSnapshot): boolean {
  return stableStringify(a) === stableStringify(b);
}
