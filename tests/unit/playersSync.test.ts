import { describe, expect, it } from "vitest";
import { mergePlayers } from "@/services/sync/players";
import type { Player } from "@/domain/types";

const player = (id: string, updatedAt: string, over: Partial<Player> = {}): Player => ({
  id,
  teamId: "t1",
  number: 9,
  name: "X",
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt,
  ...over,
});

describe("mergePlayers", () => {
  it("unions players from both devices", () => {
    const merged = mergePlayers(
      [player("a", "2026-09-01T10:00:00Z")],
      [player("b", "2026-09-01T09:00:00Z")],
    );
    expect(merged.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("newest updatedAt wins per player", () => {
    const merged = mergePlayers(
      [player("a", "2026-09-02T10:00:00Z", { number: 17 })],
      [player("a", "2026-09-01T10:00:00Z", { number: 9 })],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]!.number).toBe(17);
  });

  it("a soft delete propagates and wins when it is the newest change", () => {
    const merged = mergePlayers(
      [player("a", "2026-09-03T10:00:00Z", { deletedAt: "2026-09-03T10:00:00Z" })],
      [player("a", "2026-09-01T10:00:00Z")],
    );
    expect(merged[0]!.deletedAt).toBe("2026-09-03T10:00:00Z");
  });

  it("a re-add after a delete elsewhere wins if it is newer", () => {
    const merged = mergePlayers(
      [player("a", "2026-09-05T10:00:00Z")], // re-created locally, no deletedAt
      [player("a", "2026-09-04T10:00:00Z", { deletedAt: "2026-09-04T10:00:00Z" })],
    );
    expect(merged[0]!.deletedAt).toBeUndefined();
  });
});
