import type { MatchStatus } from "@/domain/types";

export const STATUS_LABEL: Record<MatchStatus, string> = {
  DRAFT: "Luonnos",
  READY: "Valmis",
  LIVE: "LIVE",
  FINISHED: "Päättynyt",
};

export const STATUS_CLASS: Record<MatchStatus, string> = {
  DRAFT: "bg-slate-700 text-slate-200",
  READY: "bg-amber-600/80 text-white",
  LIVE: "bg-rose-600 text-white",
  FINISHED: "bg-emerald-700 text-white",
};

export function resultLabel(own: number, opp: number): "voitto" | "tasapeli" | "tappio" {
  if (own > opp) return "voitto";
  if (own < opp) return "tappio";
  return "tasapeli";
}
