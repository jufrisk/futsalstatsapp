import type { GoalSituation } from "./types";

/** Futsal is played 5-a-side, so a goal can never have more than five on court. */
export const MAX_COURT_PLAYERS = 5;

export const GOAL_SITUATIONS: GoalSituation[] = [
  "OPEN_PLAY",
  "PENALTY_6M",
  "PENALTY_10M",
  "UNEVEN_STRENGTH",
];

export function goalSituationLabel(situation?: GoalSituation): string {
  switch (situation) {
    case "PENALTY_6M":
      return "6 m rangaistus";
    case "PENALTY_10M":
      return "10 m rangaistus";
    case "UNEVEN_STRENGTH":
      return "Ylivoima / alivoima (4v3)";
    default:
      return "Avoin peli";
  }
}

/** Short tag for goal rows, empty for normal open-play goals. */
export function goalSituationTag(situation?: GoalSituation): string {
  switch (situation) {
    case "PENALTY_6M":
      return "6 m rp";
    case "PENALTY_10M":
      return "10 m rp";
    case "UNEVEN_STRENGTH":
      return "4v3";
    default:
      return "";
  }
}

/**
 * Plus/minus is gathered only for even-strength open-play goals. Penalty goals
 * (6 m / 10 m) and goals scored while the teams are at uneven strength (a red
 * card / 2-minute exclusion, e.g. 4v3) count for the score but never accrue
 * plus/minus.
 */
export function goalCountsForPlusMinus(situation?: GoalSituation): boolean {
  return situation == null || situation === "OPEN_PLAY";
}

/** Penalty goals hide the lineup + assist inputs; other situations keep them. */
export function isPenalty(situation?: GoalSituation): boolean {
  return situation === "PENALTY_6M" || situation === "PENALTY_10M";
}

export function goalLineupTooLarge(lineupPlayerIds: readonly string[]): boolean {
  return new Set(lineupPlayerIds).size > MAX_COURT_PLAYERS;
}
