import type { MatchPlayer, Player } from "./types";

export interface Check {
  ok: boolean;
  error?: string;
}

export function validateJerseyNumber(value: unknown): Check {
  const n = typeof value === "string" ? Number(value) : (value as number);
  if (value === "" || value == null || Number.isNaN(n)) {
    return { ok: false, error: "Pelinumero on pakollinen." };
  }
  if (!Number.isInteger(n)) {
    return { ok: false, error: "Pelinumeron on oltava kokonaisluku." };
  }
  if (n < 0 || n > 999) {
    return { ok: false, error: "Pelinumeron on oltava välillä 0–999." };
  }
  return { ok: true };
}

/** Duplicate active jersey numbers inside the same team are not allowed. */
export function duplicateTeamNumber(
  players: readonly Player[],
  number: number,
  exceptPlayerId?: string,
): boolean {
  return players.some(
    (p) => p.active && p.number === number && p.id !== exceptPlayerId,
  );
}

export interface MatchNumberValidation {
  ok: boolean;
  duplicateNumbers: number[];
  error?: string;
}

/**
 * Within one match roster, selected players must have unique `playerNumber`
 * values. Duplicates must block match start (TECHNICAL_SPEC §49).
 */
export function validateUniqueMatchNumbers(
  matchPlayers: readonly MatchPlayer[],
): MatchNumberValidation {
  const counts = new Map<number, number>();
  for (const mp of matchPlayers) {
    if (!mp.selected) continue;
    counts.set(mp.playerNumber, (counts.get(mp.playerNumber) ?? 0) + 1);
  }
  const duplicateNumbers = [...counts.entries()]
    .filter(([, c]) => c > 1)
    .map(([n]) => n)
    .sort((a, b) => a - b);

  if (duplicateNumbers.length > 0) {
    const list = duplicateNumbers.map((n) => `#${n}`).join(", ");
    return {
      ok: false,
      duplicateNumbers,
      error: `Pelinumero ${list} on käytössä useammalla kokoonpanon pelaajalla.`,
    };
  }
  return { ok: true, duplicateNumbers: [] };
}

export interface StartMatchValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
  starterCount: number;
}

export function validateStartMatch(
  matchPlayers: readonly MatchPlayer[],
): StartMatchValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const selected = matchPlayers.filter((mp) => mp.selected);
  const starters = selected.filter((mp) => mp.startingLineup);

  if (selected.length === 0) {
    errors.push("Valitse vähintään yksi pelaaja kokoonpanoon.");
  }
  if (starters.length === 0) {
    errors.push("Valitse aloitusviisikko.");
  } else if (starters.length !== 5) {
    warnings.push(`Aloitusviisikossa on ${starters.length} pelaajaa (yleensä 5).`);
  }

  const numbers = validateUniqueMatchNumbers(matchPlayers);
  if (!numbers.ok && numbers.error) errors.push(numbers.error);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    starterCount: starters.length,
  };
}
