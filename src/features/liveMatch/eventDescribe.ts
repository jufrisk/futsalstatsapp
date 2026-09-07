import type { MatchEvent } from "@/domain/types";
import { goalSituationTag } from "@/domain/goals";
import { formatMatchTime } from "@/services/matchTime";

/**
 * Which event types appear in the human-facing event lists. Substitutions are
 * still recorded (they carry the on-court lineup for +/-), but they are not
 * shown — only goals matter. Fouls / yellow + red cards will be added later.
 */
export function isListedEvent(event: MatchEvent): boolean {
  return event.type !== "SUBSTITUTION";
}

export function eventIcon(type: MatchEvent["type"]): string {
  switch (type) {
    case "OWN_GOAL":
      return "⚽";
    case "OPPONENT_GOAL":
      return "🥅";
    case "SUBSTITUTION":
      return "⇄";
    case "PERIOD_CHANGED":
      return "⏱";
    case "MATCH_STARTED":
      return "▶";
    case "MATCH_FINISHED":
      return "⏹";
  }
}

export function eventTitle(type: MatchEvent["type"]): string {
  switch (type) {
    case "OWN_GOAL":
      return "Oma maali";
    case "OPPONENT_GOAL":
      return "Vastustajan maali";
    case "SUBSTITUTION":
      return "Vaihto";
    case "PERIOD_CHANGED":
      return "Jakso vaihtui";
    case "MATCH_STARTED":
      return "Ottelu alkoi";
    case "MATCH_FINISHED":
      return "Ottelu päättyi";
  }
}

export function describeEvent(
  event: MatchEvent,
  labelOf: (id: string | undefined) => string,
): string {
  const time = event.matchTimeSeconds != null ? formatMatchTime(event.matchTimeSeconds) : "";
  switch (event.type) {
    case "OWN_GOAL": {
      const parts: string[] = [];
      const tag = goalSituationTag(event.payload.situation);
      if (tag) parts.push(tag);
      if (event.payload.scorerPlayerId) parts.push(labelOf(event.payload.scorerPlayerId));
      if (event.payload.assistPlayerId)
        parts.push(`syöttö ${labelOf(event.payload.assistPlayerId)}`);
      return [time, "Oma maali", parts.join(", ")].filter(Boolean).join("  ");
    }
    case "OPPONENT_GOAL": {
      const tag = goalSituationTag(event.payload.situation);
      return [time, "Vastustajan maali", tag].filter(Boolean).join("  ");
    }
    case "SUBSTITUTION":
      return [
        time,
        `${labelOf(event.payload.playerOutId)} → ${labelOf(event.payload.playerInId)}`,
      ]
        .filter(Boolean)
        .join("  ");
    case "PERIOD_CHANGED":
      return `${event.payload.period}. jakso`;
    case "MATCH_STARTED":
      return "Ottelu alkoi";
    case "MATCH_FINISHED":
      return "Ottelu päättyi";
  }
}
