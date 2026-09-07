import { describe, expect, it } from "vitest";
import { mergeSnapshots, snapshotsEqual } from "@/services/sync/merge";
import { emptySnapshot, type SyncSnapshot } from "@/services/sync/types";

function snap(over: Partial<SyncSnapshot["tables"]>, tombstones: SyncSnapshot["tombstones"] = {}): SyncSnapshot {
  const base = emptySnapshot();
  return { ...base, tables: { ...base.tables, ...over }, tombstones };
}

const player = (id: string, updatedAt: string, name?: string) => ({
  id,
  teamId: "t1",
  number: 9,
  name,
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt,
});

describe("mergeSnapshots", () => {
  it("keeps records that exist only on one side", () => {
    const local = snap({ players: [player("a", "2026-09-01T10:00:00Z")] });
    const remote = snap({ players: [player("b", "2026-09-01T11:00:00Z")] });
    const merged = mergeSnapshots(local, remote);
    expect(merged.tables.players.map((p) => p.id).sort()).toEqual(["a", "b"]);
  });

  it("newest updatedAt wins for a record edited on both devices", () => {
    const local = snap({ players: [player("a", "2026-09-01T12:00:00Z", "Local")] });
    const remote = snap({ players: [player("a", "2026-09-01T10:00:00Z", "Remote")] });
    const merged = mergeSnapshots(local, remote);
    expect(merged.tables.players).toHaveLength(1);
    expect(merged.tables.players[0]!.name).toBe("Local");
  });

  it("a tombstone removes the record and propagates", () => {
    const local = snap({ players: [] }, { players: { a: "2026-09-02T09:00:00Z" } });
    const remote = snap({ players: [player("a", "2026-09-01T10:00:00Z")] });
    const merged = mergeSnapshots(local, remote);
    expect(merged.tables.players).toHaveLength(0);
    expect(merged.tombstones.players?.a).toBe("2026-09-02T09:00:00Z");
  });

  it("a record edited after it was deleted elsewhere is revived", () => {
    const local = snap({ players: [player("a", "2026-09-03T08:00:00Z", "Back")] });
    const remote = snap({ players: [] }, { players: { a: "2026-09-02T09:00:00Z" } });
    const merged = mergeSnapshots(local, remote);
    expect(merged.tables.players).toHaveLength(1);
    expect(merged.tombstones.players?.a).toBeUndefined();
  });

  it("is order-independent (merge(a,b) == merge(b,a) by content)", () => {
    const a = snap(
      { players: [player("x", "2026-09-01T10:00:00Z"), player("y", "2026-09-02T10:00:00Z")] },
      { players: { z: "2026-09-01T00:00:00Z" } },
    );
    const b = snap(
      { players: [player("x", "2026-09-03T10:00:00Z"), player("z", "2026-09-01T09:00:00Z")] },
      {},
    );
    expect(snapshotsEqual(mergeSnapshots(a, b), mergeSnapshots(b, a))).toBe(true);
  });

  it("merge is idempotent", () => {
    const a = snap({ players: [player("x", "2026-09-01T10:00:00Z")] });
    const b = snap({ players: [player("y", "2026-09-02T10:00:00Z")] });
    const once = mergeSnapshots(a, b);
    const twice = mergeSnapshots(once, b);
    expect(snapshotsEqual(once, twice)).toBe(true);
  });
});
