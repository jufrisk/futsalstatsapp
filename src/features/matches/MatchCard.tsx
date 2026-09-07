import { useMatchData } from "./useMatchData";
import { formatFiDate } from "@/services/dates";
import { STATUS_CLASS, STATUS_LABEL } from "./matchStatus";

export function MatchCard({ matchId, onOpen }: { matchId: string; onOpen: () => void }) {
  const { match, state } = useMatchData(matchId);
  if (!match) return null;

  const played = match.status === "LIVE" || match.status === "FINISHED";
  const cta =
    match.status === "FINISHED"
      ? "Katso tilastot"
      : match.status === "LIVE"
        ? "Jatka tilastointia"
        : match.status === "READY"
          ? "Avaa / aloita"
          : "Avaa peli";

  return (
    <li className="card flex items-center justify-between gap-4">
      <button className="flex flex-1 flex-col items-start gap-1 text-left" onClick={onOpen}>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">{formatFiDate(match.date)}</span>
          <span className="text-xs text-slate-500">
            {match.venue === "HOME" ? "koti" : "vieras"}
          </span>
        </div>
        <div className="text-base font-semibold text-slate-50">vs {match.opponentName}</div>
        <div className="mt-1 flex items-center gap-2">
          <span
            className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${STATUS_CLASS[match.status]}`}
          >
            {STATUS_LABEL[match.status]}
          </span>
          {played && (
            <span className="font-mono text-sm text-slate-200">
              {state.ownScore}–{state.opponentScore}
            </span>
          )}
        </div>
      </button>
      <button className="btn-secondary shrink-0" onClick={onOpen}>
        {cta}
      </button>
    </li>
  );
}
