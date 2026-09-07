import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/database";
import { appBackupSchema } from "@/domain/schemas";
import { restoreBackup } from "@/services/backupService";
import { listMatchesBySeason, listPlayers } from "@/db/repositories";
import { calculateSeasonStatistics } from "@/services/seasonStatisticsEngine";
import { buildMatchState } from "@/services/matchEngine";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

/**
 * The Torneopal import (scripts/import-torneopal.mjs) produces a backup file
 * with `source` / `externalMatchId` / `externalPlayerId` set and synthetic
 * score-only events for played matches. This checks the app accepts that shape.
 */
const importLikeBackup = {
  schemaVersion: 1 as const,
  exportedAt: "2026-09-07T10:00:00.000Z",
  seasons: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      name: "2026–27",
      active: true,
      createdAt: "2026-09-07T10:00:00.000Z",
      updatedAt: "2026-09-07T10:00:00.000Z",
    },
  ],
  teams: [
    {
      id: "00000000-0000-4000-8000-000000000002",
      name: "GFT",
      createdAt: "2026-09-07T10:00:00.000Z",
      updatedAt: "2026-09-07T10:00:00.000Z",
    },
  ],
  players: [
    {
      id: "00000000-0000-4000-8000-000000000010",
      teamId: "00000000-0000-4000-8000-000000000002",
      number: 4,
      name: "Talvela Jenni",
      active: true,
      externalPlayerId: "torneopal:59586:4",
      createdAt: "2026-09-07T10:00:00.000Z",
      updatedAt: "2026-09-07T10:00:00.000Z",
    },
  ],
  matches: [
    {
      id: "00000000-0000-4000-8000-000000000020",
      seasonId: "00000000-0000-4000-8000-000000000001",
      teamId: "00000000-0000-4000-8000-000000000002",
      opponentName: "RaiFu",
      date: "2026-09-19",
      venue: "AWAY" as const,
      status: "FINISHED" as const,
      source: "PALLOLIITTO" as const,
      externalMatchId: "137",
      createdAt: "2026-09-07T10:00:00.000Z",
      updatedAt: "2026-09-07T10:00:00.000Z",
      finishedAt: "2026-09-07T10:00:00.000Z",
    },
    {
      id: "00000000-0000-4000-8000-000000000021",
      seasonId: "00000000-0000-4000-8000-000000000001",
      teamId: "00000000-0000-4000-8000-000000000002",
      opponentName: "Riemu",
      date: "2026-10-17",
      venue: "HOME" as const,
      status: "DRAFT" as const,
      source: "PALLOLIITTO" as const,
      externalMatchId: "147",
      createdAt: "2026-09-07T10:00:00.000Z",
      updatedAt: "2026-09-07T10:00:00.000Z",
    },
  ],
  matchPlayers: [],
  matchEvents: [
    // synthetic score: GFT (away) lost 3–2
    ...[1, 2, 3].map((i) => ({
      id: `00000000-0000-4000-8000-0000000000${30 + i}`,
      matchId: "00000000-0000-4000-8000-000000000020",
      type: "OPPONENT_GOAL" as const,
      sequence: i,
      period: 1 as const,
      source: "PALLOLIITTO" as const,
      createdAt: "2026-09-07T10:00:00.000Z",
      updatedAt: "2026-09-07T10:00:00.000Z",
      payload: { lineupPlayerIds: [] },
    })),
    ...[4, 5].map((i) => ({
      id: `00000000-0000-4000-8000-0000000000${30 + i}`,
      matchId: "00000000-0000-4000-8000-000000000020",
      type: "OWN_GOAL" as const,
      sequence: i,
      period: 1 as const,
      source: "PALLOLIITTO" as const,
      createdAt: "2026-09-07T10:00:00.000Z",
      updatedAt: "2026-09-07T10:00:00.000Z",
      payload: { lineupPlayerIds: [] },
    })),
  ],
};

describe("Torneopal-style import", () => {
  it("validates against the backup schema", () => {
    expect(appBackupSchema.safeParse(importLikeBackup).success).toBe(true);
  });

  it("restores into the app and produces the right fixtures + record", async () => {
    await restoreBackup(JSON.parse(JSON.stringify(importLikeBackup)), "replace");

    const matches = await listMatchesBySeason("00000000-0000-4000-8000-000000000001");
    expect(matches).toHaveLength(2);
    expect(matches.every((m) => m.source === "PALLOLIITTO")).toBe(true);

    const players = await listPlayers("00000000-0000-4000-8000-000000000002");
    expect(players.map((p) => p.number)).toEqual([4]);

    // synthetic events reproduce the scoreline (3–2 to the opponent), no +/-
    const events = await db.matchEvents
      .where("matchId")
      .equals("00000000-0000-4000-8000-000000000020")
      .toArray();
    const state = buildMatchState([], events);
    expect(state.ownScore).toBe(2);
    expect(state.opponentScore).toBe(3);

    const season = calculateSeasonStatistics([
      {
        match: matches.find((m) => m.externalMatchId === "137")!,
        matchPlayers: [],
        events,
      },
    ]);
    expect(season.record.losses).toBe(1);
    expect(season.record.goalsFor).toBe(2);
    expect(season.record.goalsAgainst).toBe(3);
  });
});
