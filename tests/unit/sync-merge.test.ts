import { describe, expect, it } from "vitest";
import { mergeSnapshots, snapshotsEqual } from "@/services/sync/merge";
import { emptySnapshot, type SyncSnapshot } from "@/services/sync/types";
import type { MatchEvent } from "@/domain/types";

function snap(
  matchEvents: MatchEvent[],
  tombstones: SyncSnapshot["tombstones"] = {},
): SyncSnapshot {
  const base = emptySnapshot();
  return { ...base, tables: { ...base.tables, matchEvents }, tombstones };
}

const evt = (id: string, updatedAt: string, seconds = 0): MatchEvent => ({
  id,
  matchId: "m1",
  type: "OWN_GOAL",
  sequence: 1,
  period: 1,
  matchTimeSeconds: seconds,
  source: "MANUAL",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt,
  payload: { lineupPlayerIds: [] },
});

describe("mergeSnapshots", () => {
  it("keeps records that exist only on one side", () => {
    const local = snap([evt("a", "2026-09-01T10:00:00Z")]);
    const remote = snap([evt("b", "2026-09-01T11:00:00Z")]);
    const merged = mergeSnapshots(local, remote);
    expect(merged.tables.matchEvents.map((e) => e.id).sort()).toEqual(["a", "b"]);
  });

  it("newest updatedAt wins for a record edited on both devices", () => {
    const local = snap([evt("a", "2026-09-01T12:00:00Z", 111)]);
    const remote = snap([evt("a", "2026-09-01T10:00:00Z", 222)]);
    const merged = mergeSnapshots(local, remote);
    expect(merged.tables.matchEvents).toHaveLength(1);
    expect(merged.tables.matchEvents[0]!.matchTimeSeconds).toBe(111);
  });

  it("a tombstone removes the record and propagates", () => {
    const local = snap([], { matchEvents: { a: "2026-09-02T09:00:00Z" } });
    const remote = snap([evt("a", "2026-09-01T10:00:00Z")]);
    const merged = mergeSnapshots(local, remote);
    expect(merged.tables.matchEvents).toHaveLength(0);
    expect(merged.tombstones.matchEvents?.a).toBe("2026-09-02T09:00:00Z");
  });

  it("a record edited after it was deleted elsewhere is revived", () => {
    const local = snap([evt("a", "2026-09-03T08:00:00Z")]);
    const remote = snap([], { matchEvents: { a: "2026-09-02T09:00:00Z" } });
    const merged = mergeSnapshots(local, remote);
    expect(merged.tables.matchEvents).toHaveLength(1);
    expect(merged.tombstones.matchEvents?.a).toBeUndefined();
  });

  it("is order-independent (merge(a,b) == merge(b,a) by content)", () => {
    const a = snap(
      [evt("x", "2026-09-01T10:00:00Z"), evt("y", "2026-09-02T10:00:00Z")],
      { matchEvents: { z: "2026-09-01T00:00:00Z" } },
    );
    const b = snap([evt("x", "2026-09-03T10:00:00Z"), evt("z", "2026-09-01T09:00:00Z")]);
    expect(snapshotsEqual(mergeSnapshots(a, b), mergeSnapshots(b, a))).toBe(true);
  });

  it("merge is idempotent", () => {
    const a = snap([evt("x", "2026-09-01T10:00:00Z")]);
    const b = snap([evt("y", "2026-09-02T10:00:00Z")]);
    const once = mergeSnapshots(a, b);
    const twice = mergeSnapshots(once, b);
    expect(snapshotsEqual(once, twice)).toBe(true);
  });
});
