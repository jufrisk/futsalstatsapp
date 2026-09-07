/**
 * Manual match-clock handling (TECHNICAL_SPEC §14).
 * The app never runs an authoritative clock — the user types MM:SS per goal.
 */

export const MAX_MINUTES = 20;
export const MAX_SECONDS = 59;

export interface MatchTimeParts {
  minutes: number;
  seconds: number;
}

export function parseMatchTime(minutes: number, seconds: number): number {
  return minutes * 60 + seconds;
}

export function secondsToParts(total: number): MatchTimeParts {
  const safe = Math.max(0, Math.floor(total));
  return { minutes: Math.floor(safe / 60), seconds: safe % 60 };
}

export function formatMatchTime(totalSeconds?: number): string {
  if (totalSeconds == null) return "--:--";
  const { minutes, seconds } = secondsToParts(totalSeconds);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export interface MatchTimeValidation {
  ok: boolean;
  error?: string;
}

export function validateMatchTime(
  minutes: number,
  seconds: number,
  opts: { maxMinutes?: number } = {},
): MatchTimeValidation {
  const maxMinutes = opts.maxMinutes ?? MAX_MINUTES;
  if (!Number.isInteger(minutes) || !Number.isInteger(seconds)) {
    return { ok: false, error: "Peliajan on oltava kokonaisluku." };
  }
  if (minutes < 0 || minutes > maxMinutes) {
    return { ok: false, error: `Minuuttien on oltava välillä 0–${maxMinutes}.` };
  }
  if (seconds < 0 || seconds > MAX_SECONDS) {
    return { ok: false, error: `Sekuntien on oltava välillä 0–${MAX_SECONDS}.` };
  }
  return { ok: true };
}

/** Parse loose user input such as "7", "734", "7:34", "07:34". */
export function parseLooseTimeInput(raw: string): MatchTimeParts | null {
  const value = raw.trim();
  if (!value) return null;

  if (value.includes(":")) {
    const [m, s] = value.split(":");
    const minutes = Number(m);
    const seconds = Number(s ?? "0");
    if (Number.isNaN(minutes) || Number.isNaN(seconds)) return null;
    return { minutes, seconds };
  }

  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length <= 2) return { minutes: Number(digits), seconds: 0 };
  const seconds = Number(digits.slice(-2));
  const minutes = Number(digits.slice(0, -2));
  return { minutes, seconds };
}
