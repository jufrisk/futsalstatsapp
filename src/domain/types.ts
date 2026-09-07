import type { z } from "zod";
import type {
  seasonSchema,
  teamSchema,
  playerSchema,
  matchSchema,
  matchStatusSchema,
  matchVenueSchema,
  matchPlayerSchema,
  matchEventSchema,
  eventSourceSchema,
  goalSituationSchema,
  ownGoalPayloadSchema,
  opponentGoalPayloadSchema,
  substitutionPayloadSchema,
  matchStartedPayloadSchema,
  appBackupSchema,
  matchExportSchema,
} from "./schemas";

export type Season = z.infer<typeof seasonSchema>;
export type Team = z.infer<typeof teamSchema>;
export type Player = z.infer<typeof playerSchema>;

export type MatchStatus = z.infer<typeof matchStatusSchema>;
export type MatchVenue = z.infer<typeof matchVenueSchema>;
export type Match = z.infer<typeof matchSchema>;

export type MatchPlayer = z.infer<typeof matchPlayerSchema>;

export type EventSource = z.infer<typeof eventSourceSchema>;
export type GoalSituation = z.infer<typeof goalSituationSchema>;
export type Period = 1 | 2;

export type MatchEvent = z.infer<typeof matchEventSchema>;
export type MatchEventType = MatchEvent["type"];

export type OwnGoalPayload = z.infer<typeof ownGoalPayloadSchema>;
export type OpponentGoalPayload = z.infer<typeof opponentGoalPayloadSchema>;
export type SubstitutionPayload = z.infer<typeof substitutionPayloadSchema>;
export type MatchStartedPayload = z.infer<typeof matchStartedPayloadSchema>;

export type OwnGoalEvent = Extract<MatchEvent, { type: "OWN_GOAL" }>;
export type OpponentGoalEvent = Extract<MatchEvent, { type: "OPPONENT_GOAL" }>;
export type SubstitutionEvent = Extract<MatchEvent, { type: "SUBSTITUTION" }>;

export type AppBackup = z.infer<typeof appBackupSchema>;
export type MatchExport = z.infer<typeof matchExportSchema>;

/* ----------------------------------------------------------------------------
 * Derived (never persisted) statistics
 * ------------------------------------------------------------------------- */
export interface PlayerMatchStats {
  playerId: string;
  goals: number;
  assists: number;
  plus: number;
  minus: number;
  plusMinus: number;
}

export interface MatchState {
  ownScore: number;
  opponentScore: number;
  currentPeriod: Period;
  lineupPlayerIds: string[];
  started: boolean;
  finished: boolean;
  playerStats: Record<string, PlayerMatchStats>;
}

export interface PlayerSeasonStats {
  playerId: string;
  appearances: number;
  goals: number;
  assists: number;
  points: number;
  plus: number;
  minus: number;
  plusMinus: number;
}

export interface SeasonRecord {
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}
