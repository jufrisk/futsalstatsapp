import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { PageHeader, Spinner, StatBadge, Tabs } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { useToast } from "@/app/toast";
import { useMatchData } from "@/features/matches/useMatchData";
import type { MatchEvent } from "@/domain/types";
import { deleteMatch, recordOpponentGoal, recordOwnGoal, resumeMatch } from "@/db/repositories";
import { buildMatchExport } from "@/services/backupService";
import {
  downloadTextFile,
  jsonString,
  matchEventsCsv,
  matchPlayerStatsCsv,
  safeFilePart,
} from "@/services/exportService";
import { formatFiDate } from "@/services/dates";
import { formatMatchTime } from "@/services/matchTime";
import { GoalDialog } from "@/features/liveMatch/GoalDialog";
import { EventEditorModal } from "@/features/liveMatch/EventEditorModal";
import { GoalBreakdownList } from "@/features/liveMatch/GoalBreakdownList";
import { describeEvent, eventIcon, eventTitle } from "@/features/liveMatch/eventDescribe";

type TabId = "summary" | "players" | "goals" | "events";

export function MatchViewPage() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const data = useMatchData(matchId);
  const { match, roster, events, state, stats, labelOf } = data;
  const [tab, setTab] = useState<TabId>("summary");
  const [editingEvent, setEditingEvent] = useState<MatchEvent | null>(null);
  const [addKind, setAddKind] = useState<"own" | "opponent" | null>(null);

  if (match === undefined) return <Spinner />;
  if (!match) return <Navigate to="/" replace />;

  const filePart = `${formatFiDate(match.date)}-${safeFilePart(match.opponentName)}`;

  const exportPlayersCsv = () =>
    downloadTextFile(`${filePart}-pelaajat.csv`, matchPlayerStatsCsv(stats.rows), "text/csv;charset=utf-8");
  const exportEventsCsv = () =>
    downloadTextFile(`${filePart}-tapahtumat.csv`, matchEventsCsv(events, roster), "text/csv;charset=utf-8");
  const exportJson = async () => {
    const payload = await buildMatchExport(match.id);
    downloadTextFile(`${filePart}.json`, jsonString(payload), "application/json");
  };

  return (
    <div>
      <PageHeader
        title={
          <span data-testid="match-score">
            {state.ownScore}–{state.opponentScore} vs {match.opponentName}
          </span>
        }
        subtitle={`${formatFiDate(match.date)} · ${match.venue === "HOME" ? "koti" : "vieras"} · ${
          match.status === "FINISHED" ? "päättynyt" : match.status.toLowerCase()
        }`}
        actions={
          <>
            <Link to="/" className="btn-ghost">
              ← Ottelut
            </Link>
            <button
              className="btn-secondary"
              onClick={async () => {
                await resumeMatch(match.id);
                navigate(`/matches/${match.id}/live`);
              }}
            >
              Jatka tilastointia
            </button>
          </>
        }
      />

      <Tabs<TabId>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "summary", label: "Yhteenveto" },
          { id: "players", label: "Pelaajat" },
          { id: "goals", label: "Maalit & +/-" },
          { id: "events", label: "Tapahtumat" },
        ]}
      />

      {tab === "summary" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2">
            <StatBadge label="Oma" value={state.ownScore} />
            <StatBadge label="Vastustaja" value={state.opponentScore} />
            <StatBadge
              label="Tulos"
              value={
                state.ownScore > state.opponentScore
                  ? "Voitto"
                  : state.ownScore < state.opponentScore
                    ? "Tappio"
                    : "Tasapeli"
              }
            />
          </div>

          <section className="card">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-300">Maalit</h2>
            <GoalBreakdownList events={events} labelOf={labelOf} onPick={setEditingEvent} />
          </section>

          <section className="card">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-300">Vienti</h2>
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" onClick={exportPlayersCsv}>
                Vie pelaajat CSV
              </button>
              <button className="btn-secondary" onClick={exportEventsCsv}>
                Vie tapahtumat CSV
              </button>
              <button className="btn-secondary" onClick={exportJson}>
                Vie ottelu JSON
              </button>
            </div>
          </section>

          <div className="flex justify-end">
            <ConfirmButton
              className="btn-ghost"
              confirmLabel="Poista ottelu?"
              onConfirm={async () => {
                await deleteMatch(match.id);
                navigate("/");
              }}
            >
              Poista ottelu
            </ConfirmButton>
          </div>
        </div>
      )}

      {tab === "players" && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[28rem]">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="th">#</th>
                <th className="th">Pelaaja</th>
                <th className="th text-right">M</th>
                <th className="th text-right">S</th>
                <th className="th text-right">+</th>
                <th className="th text-right">−</th>
                <th className="th text-right">+/-</th>
              </tr>
            </thead>
            <tbody>
              {stats.rows.map((r) => (
                <tr
                  key={r.playerId}
                  data-testid={`stat-row-${r.playerNumber}`}
                  className="cursor-pointer border-b border-slate-800/60 hover:bg-slate-800/40"
                  onClick={() => navigate(`/players/${r.playerId}`)}
                >
                  <td className="td font-mono">#{r.playerNumber}</td>
                  <td className="td">{r.playerName ?? ""}</td>
                  <td className="td text-right" data-testid={`stat-${r.playerNumber}-goals`}>
                    {r.goals}
                  </td>
                  <td className="td text-right" data-testid={`stat-${r.playerNumber}-assists`}>
                    {r.assists}
                  </td>
                  <td className="td text-right">{r.plus}</td>
                  <td className="td text-right">{r.minus}</td>
                  <td
                    className="td text-right font-semibold"
                    data-testid={`stat-${r.playerNumber}-pm`}
                  >
                    {fmtPm(r.plusMinus)}
                  </td>
                </tr>
              ))}
              {stats.rows.length === 0 && (
                <tr>
                  <td className="td text-slate-500" colSpan={7}>
                    Ei kokoonpanoa.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "goals" && (
        <div className="card">
          <p className="mb-3 text-sm text-slate-400">
            Jokainen maali ja siitä syntynyt oman joukkueen +/-. Rangaistusmaaleista
            (6 m / 10 m) ei kirjata +/-. Napauta riviä korjataksesi.
          </p>
          <GoalBreakdownList events={events} labelOf={labelOf} onPick={setEditingEvent} />
        </div>
      )}

      {tab === "events" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={() => setAddKind("own")}>
              + Oma maali
            </button>
            <button className="btn-secondary" onClick={() => setAddKind("opponent")}>
              + Vastustajan maali
            </button>
          </div>
          <div className="card divide-y divide-slate-800">
            {events.length === 0 && <p className="py-2 text-sm text-slate-500">Ei tapahtumia.</p>}
            {events.map((e) => (
              <button
                key={e.id}
                data-testid={`event-${e.type}`}
                onClick={() => setEditingEvent(e)}
                className="flex w-full items-center gap-3 py-2.5 text-left"
              >
                <span className="text-base">{eventIcon(e.type)}</span>
                <span className="w-14 font-mono text-xs text-slate-400">
                  {e.matchTimeSeconds != null ? formatMatchTime(e.matchTimeSeconds) : "--:--"}
                </span>
                <span className="w-6 text-xs text-slate-500">{e.period}.</span>
                <span className="flex-1 text-sm text-slate-200">
                  <span className="font-medium">{eventTitle(e.type)}</span>{" "}
                  <span className="text-slate-400">{describeEvent(e, labelOf)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {editingEvent && (
        <EventEditorModal
          event={editingEvent}
          roster={roster}
          defaultLineup={state.lineupPlayerIds}
          onClose={() => setEditingEvent(null)}
        />
      )}

      {addKind && (
        <GoalDialog
          kind={addKind}
          roster={roster}
          defaultLineup={state.lineupPlayerIds}
          defaultPeriod={state.currentPeriod}
          onCancel={() => setAddKind(null)}
          onSubmit={async (value) => {
            if (addKind === "own") await recordOwnGoal(match.id, value);
            else
              await recordOpponentGoal(match.id, {
                period: value.period,
                matchTimeSeconds: value.matchTimeSeconds,
                lineupPlayerIds: value.lineupPlayerIds,
                situation: value.situation,
              });
            setAddKind(null);
            toast.push("Tapahtuma lisätty", "success");
          }}
        />
      )}
    </div>
  );
}

function fmtPm(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

