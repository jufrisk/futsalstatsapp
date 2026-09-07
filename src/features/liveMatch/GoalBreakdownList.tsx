import { useMemo } from "react";
import type { MatchEvent } from "@/domain/types";
import { goalCountsForPlusMinus, goalSituationTag } from "@/domain/goals";
import { formatMatchTime } from "@/services/matchTime";
import { sortEvents } from "@/services/matchEngine";

type GoalEvent = Extract<MatchEvent, { type: "OWN_GOAL" | "OPPONENT_GOAL" }>;

/**
 * Every goal in chronological order with the plus/minus it produced for the
 * own-team players on court. Penalty goals (6 m / 10 m) show no plus/minus.
 * Rows are tappable to open the event editor.
 */
export function GoalBreakdownList({
  events,
  labelOf,
  onPick,
  emptyLabel = "Ei maaleja.",
}: {
  events: readonly MatchEvent[];
  labelOf: (id: string | undefined) => string;
  onPick?: (e: MatchEvent) => void;
  emptyLabel?: string;
}) {
  const goals = useMemo(
    () =>
      sortEvents(events).filter(
        (e): e is GoalEvent => e.type === "OWN_GOAL" || e.type === "OPPONENT_GOAL",
      ),
    [events],
  );

  if (goals.length === 0) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>;
  }

  return (
    <ul className="flex flex-col gap-2" data-testid="goal-breakdown">
      {goals.map((e) => {
        const own = e.type === "OWN_GOAL";
        const tag = goalSituationTag(e.payload.situation);
        const counts = goalCountsForPlusMinus(e.payload.situation);
        const lineup = e.payload.lineupPlayerIds;

        return (
          <li key={e.id}>
            <button
              type="button"
              onClick={onPick ? () => onPick(e) : undefined}
              className={[
                "w-full rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-left",
                onPick ? "hover:bg-slate-800/50" : "cursor-default",
              ].join(" ")}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="font-mono text-xs text-slate-400">
                  {e.period}. jakso{" "}
                  {e.matchTimeSeconds != null ? formatMatchTime(e.matchTimeSeconds) : "--:--"}
                </span>
                <span
                  className={
                    own ? "font-semibold text-emerald-300" : "font-semibold text-rose-300"
                  }
                >
                  {own ? "Oma maali" : "Vastustajan maali"}
                </span>
                {tag && (
                  <span className="rounded bg-amber-600/80 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                    {tag}
                  </span>
                )}
              </div>

              {own && (e.payload.scorerPlayerId || e.payload.assistPlayerId) && (
                <div className="mt-1 text-sm text-slate-300">
                  {e.payload.scorerPlayerId && <>Tekijä: {labelOf(e.payload.scorerPlayerId)} </>}
                  {e.payload.assistPlayerId && (
                    <>· Syöttäjä: {labelOf(e.payload.assistPlayerId)}</>
                  )}
                </div>
              )}

              <div className="mt-1 text-sm">
                {counts ? (
                  <span className={own ? "text-emerald-400" : "text-rose-400"}>
                    {own ? "+ " : "− "}
                    <span className="text-slate-300">
                      {lineup.map((id) => labelOf(id)).join("  ") || "—"}
                    </span>
                  </span>
                ) : (
                  <span className="text-slate-500">+/- ei kirjata (rangaistusmaali)</span>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
