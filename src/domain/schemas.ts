import { z } from "zod";

/**
 * Zod schemas are the single source of truth for the persisted data model.
 * TypeScript types are inferred from them (see ./types.ts).
 */

export const isoDateTime = z.string().min(1);

/* ----------------------------------------------------------------------------
 * Season
 * ------------------------------------------------------------------------- */
export const seasonSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  active: z.boolean(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

/* ----------------------------------------------------------------------------
 * Team
 * ------------------------------------------------------------------------- */
export const teamSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

/* ----------------------------------------------------------------------------
 * Player  – jersey number REQUIRED, name OPTIONAL
 * ------------------------------------------------------------------------- */
export const playerSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  number: z.number().int().min(0).max(999),
  name: z.string().trim().min(1).optional(),
  active: z.boolean(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  // Soft delete — kept so the removal syncs (players live in their own DB table).
  deletedAt: isoDateTime.optional(),
  // Link to an external roster (e.g. Palloliitto / Taso). MVP: unused by the UI.
  externalPlayerId: z.string().optional(),
});

/* ----------------------------------------------------------------------------
 * Match
 * ------------------------------------------------------------------------- */
export const matchStatusSchema = z.enum(["DRAFT", "READY", "LIVE", "FINISHED"]);
export const matchVenueSchema = z.enum(["HOME", "AWAY"]);

export const matchSchema = z.object({
  id: z.string().uuid(),
  seasonId: z.string().uuid(),
  teamId: z.string().uuid(),
  opponentName: z.string().min(1),
  date: z.string().min(1),
  venue: matchVenueSchema,
  status: matchStatusSchema,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  finishedAt: z.string().optional(),
  // Provenance for imported / reconciled fixtures (Palloliitto / Taso).
  source: z.enum(["MANUAL", "PALLOLIITTO", "RECONCILED"]).optional(),
  externalMatchId: z.string().optional(),
});

/* ----------------------------------------------------------------------------
 * Match roster (historical snapshot of jersey number + name)
 * ------------------------------------------------------------------------- */
export const matchPlayerSchema = z.object({
  id: z.string().uuid(),
  matchId: z.string().uuid(),
  playerId: z.string().uuid(),
  playerNumber: z.number().int().min(0).max(999),
  playerName: z.string().trim().min(1).optional(),
  selected: z.boolean(),
  startingLineup: z.boolean(),
  // Optional so v1 backups still validate; set by every roster mutation and
  // used as the last-write-wins key during multi-device sync.
  updatedAt: isoDateTime.optional(),
});

/* ----------------------------------------------------------------------------
 * Match events – the source of truth
 * ------------------------------------------------------------------------- */
export const eventSourceSchema = z.enum(["MANUAL", "PALLOLIITTO", "RECONCILED"]);
export const periodSchema = z.union([z.literal(1), z.literal(2)]);

export const matchStartedPayloadSchema = z.object({
  startingLineupPlayerIds: z.array(z.string().uuid()),
});

export const substitutionPayloadSchema = z.object({
  playerOutId: z.string().uuid(),
  playerInId: z.string().uuid(),
  lineupAfter: z.array(z.string().uuid()),
});

/**
 * How the goal was scored. Even-strength open play accrues plus/minus for the
 * own-team players on court. Penalty goals (6 m / 10 m marks) and goals scored
 * at uneven strength (a red card / 2-minute exclusion, e.g. 4v3) count for the
 * score only — no plus/minus is gathered.
 */
export const goalSituationSchema = z.enum([
  "OPEN_PLAY",
  "PENALTY_6M",
  "PENALTY_10M",
  "UNEVEN_STRENGTH",
]);

export const ownGoalPayloadSchema = z.object({
  scorerPlayerId: z.string().uuid().optional(),
  assistPlayerId: z.string().uuid().optional(),
  lineupPlayerIds: z.array(z.string().uuid()),
  situation: goalSituationSchema.optional(),
});

export const opponentGoalPayloadSchema = z.object({
  lineupPlayerIds: z.array(z.string().uuid()),
  situation: goalSituationSchema.optional(),
});

export const periodChangedPayloadSchema = z.object({
  period: periodSchema,
});

export const matchFinishedPayloadSchema = z.object({});

const eventBase = {
  id: z.string().uuid(),
  matchId: z.string().uuid(),
  sequence: z.number().int().nonnegative(),
  period: periodSchema,
  matchTimeSeconds: z.number().int().nonnegative().optional(),
  source: eventSourceSchema,
  externalMatchId: z.string().optional(),
  externalEventId: z.string().optional(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
};

export const matchEventSchema = z.discriminatedUnion("type", [
  z.object({ ...eventBase, type: z.literal("MATCH_STARTED"), payload: matchStartedPayloadSchema }),
  z.object({ ...eventBase, type: z.literal("SUBSTITUTION"), payload: substitutionPayloadSchema }),
  z.object({ ...eventBase, type: z.literal("OWN_GOAL"), payload: ownGoalPayloadSchema }),
  z.object({ ...eventBase, type: z.literal("OPPONENT_GOAL"), payload: opponentGoalPayloadSchema }),
  z.object({ ...eventBase, type: z.literal("PERIOD_CHANGED"), payload: periodChangedPayloadSchema }),
  z.object({ ...eventBase, type: z.literal("MATCH_FINISHED"), payload: matchFinishedPayloadSchema }),
]);

/* ----------------------------------------------------------------------------
 * Full backup
 * ------------------------------------------------------------------------- */
export const appBackupSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: isoDateTime,
  seasons: z.array(seasonSchema),
  teams: z.array(teamSchema),
  players: z.array(playerSchema),
  matches: z.array(matchSchema),
  matchPlayers: z.array(matchPlayerSchema),
  matchEvents: z.array(matchEventSchema),
});

/* ----------------------------------------------------------------------------
 * Single-match export
 * ------------------------------------------------------------------------- */
export const matchExportSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: isoDateTime,
  match: matchSchema,
  matchPlayers: z.array(matchPlayerSchema),
  matchEvents: z.array(matchEventSchema),
});
