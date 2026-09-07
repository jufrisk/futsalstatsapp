import type { MatchEvent, MatchPlayer } from "@/domain/types";
import type { MatchStatRow } from "./statisticsEngine";
import { formatMatchTime } from "./matchTime";
import { sortEvents } from "./matchEngine";

function csvCell(value: string | number | undefined | null): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRow(cells: Array<string | number | undefined | null>): string {
  return cells.map(csvCell).join(",");
}

/** README §28 – player stats CSV. */
export function matchPlayerStatsCsv(rows: readonly MatchStatRow[]): string {
  const lines = [csvRow(["number", "name", "goals", "assists", "plus", "minus", "plus_minus"])];
  for (const r of rows) {
    lines.push(
      csvRow([r.playerNumber, r.playerName ?? "", r.goals, r.assists, r.plus, r.minus, r.plusMinus]),
    );
  }
  return lines.join("\n");
}

/** README §28 / TECHNICAL_SPEC §43 – match events CSV. */
export function matchEventsCsv(
  events: readonly MatchEvent[],
  roster: readonly MatchPlayer[],
): string {
  const numberOf = new Map(roster.map((mp) => [mp.playerId, mp.playerNumber]));
  const toNum = (id?: string): string => (id ? String(numberOf.get(id) ?? "") : "");

  const lines = [
    csvRow(["sequence", "period", "time", "type", "scorer", "assist", "lineup", "situation"]),
  ];

  for (const e of sortEvents(events)) {
    let scorer = "";
    let assist = "";
    let lineup: string[] = [];
    let situation = "";

    if (e.type === "OWN_GOAL") {
      scorer = toNum(e.payload.scorerPlayerId);
      assist = toNum(e.payload.assistPlayerId);
      lineup = e.payload.lineupPlayerIds.map((id) => toNum(id)).filter(Boolean);
      situation = e.payload.situation ?? "OPEN_PLAY";
    } else if (e.type === "OPPONENT_GOAL") {
      lineup = e.payload.lineupPlayerIds.map((id) => toNum(id)).filter(Boolean);
      situation = e.payload.situation ?? "OPEN_PLAY";
    } else if (e.type === "SUBSTITUTION") {
      lineup = e.payload.lineupAfter.map((id) => toNum(id)).filter(Boolean);
    } else if (e.type === "MATCH_STARTED") {
      lineup = e.payload.startingLineupPlayerIds.map((id) => toNum(id)).filter(Boolean);
    }

    lines.push(
      csvRow([
        e.sequence,
        e.period,
        e.matchTimeSeconds == null ? "" : formatMatchTime(e.matchTimeSeconds),
        e.type,
        scorer,
        assist,
        lineup.join("|"),
        situation,
      ]),
    );
  }
  return lines.join("\n");
}

export function jsonString(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/* ------------------------------------------------------------------------- */

export function downloadTextFile(
  filename: string,
  content: string,
  mime = "text/plain;charset=utf-8",
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFilePart(value: string): string {
  return value
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "ottelu";
}
