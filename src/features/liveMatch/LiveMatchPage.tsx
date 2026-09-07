import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useToast } from "@/app/toast";
import { Spinner } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { ConfirmButton } from "@/components/ConfirmButton";
import { useMatchData } from "@/features/matches/useMatchData";
import type { MatchEvent, Period } from "@/domain/types";
import {
  changePeriod,
  finishMatch,
  recordOpponentGoal,
  recordOwnGoal,
  recordSubstitution,
  undoLastEvent,
} from "@/db/repositories";
import { GoalDialog } from "./GoalDialog";
import { EventEditorModal } from "./EventEditorModal";
import { GoalBreakdownList } from "./GoalBreakdownList";
import { describeEvent, eventIcon } from "./eventDescribe";

export function LiveMatchPage() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const data = useMatchData(matchId);
  const { match, roster, selectedRoster, events, state, labelOf } = data;

  const [pendingSwap, setPendingSwap] = useState<string | null>(null);
  const [goalKind, setGoalKind] = useState<"own" | "opponent" | null>(null);
  const [editingEvent, setEditingEvent] = useState<MatchEvent | null>(null);
  const [showGoals, setShowGoals] = useState(false);

  const bench = useMemo(
    () => selectedRoster.filter((mp) => !state.lineupPlayerIds.includes(mp.playerId)),
    [selectedRoster, state.lineupPlayerIds],
  );
  const court = useMemo(
    () =>
      state.lineupPlayerIds
        .map((id) => selectedRoster.find((mp) => mp.playerId === id))
        .filter((mp): mp is (typeof selectedRoster)[number] => Boolean(mp)),
    [selectedRoster, state.lineupPlayerIds],
  );

  if (match === undefined) return <Spinner />;
  if (!match) return <Navigate to="/" replace />;
  if (match.status === "DRAFT" || match.status === "READY") {
    return <Navigate to={`/matches/${match.id}/prepare`} replace />;
  }

  const period = state.currentPeriod;

  const handleCourtTap = (playerId: string) => {
    if (pendingSwap === playerId) return setPendingSwap(null);
    if (pendingSwap && bench.some((b) => b.playerId === pendingSwap)) {
      void doSub(playerId, pendingSwap);
      setPendingSwap(null);
    } else {
      setPendingSwap(playerId);
    }
  };
  const handleBenchTap = (playerId: string) => {
    if (pendingSwap === playerId) return setPendingSwap(null);
    if (pendingSwap && court.some((c) => c.playerId === pendingSwap)) {
      void doSub(pendingSwap, playerId);
      setPendingSwap(null);
    } else {
      setPendingSwap(playerId);
    }
  };

  const doSub = async (outId: string, inId: string) => {
    try {
      const lineupAfter = state.lineupPlayerIds.filter((id) => id !== outId).concat(inId);
      await recordSubstitution(match.id, {
        period,
        playerOutId: outId,
        playerInId: inId,
        lineupAfter,
      });
    } catch (err) {
      toast.error(err);
    }
  };

  const setPeriod = async (p: Period) => {
    if (p === period) return;
    try {
      await changePeriod(match.id, p);
    } catch (err) {
      toast.error(err);
    }
  };

  const undo = async () => {
    const removed = await undoLastEvent(match.id);
    if (removed) toast.push(`Peruttu: ${describeEvent(removed, labelOf)}`, "success");
    else toast.push("Ei peruttavaa", "info");
  };

  const finish = async () => {
    await finishMatch(match.id);
    navigate(`/matches/${match.id}/stats`);
  };

  const recent = [...events].reverse().slice(0, 6);
  const lineupWarning = state.lineupPlayerIds.length !== 5;

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-3 p-3">
      {/* Score header */}
      <header className="flex items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3">
        <button className="btn-ghost" onClick={() => navigate(`/matches/${match.id}/stats`)}>
          ← Tilastot
        </button>
        <div className="flex items-center gap-4 text-center">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            {match.venue === "HOME" ? "Koti" : "Vieras"}
          </div>
          <div className="font-mono text-3xl font-bold text-slate-50" data-testid="live-score">
            {state.ownScore} – {state.opponentScore}
          </div>
          <div className="max-w-[8rem] truncate text-sm text-slate-300">{match.opponentName}</div>
        </div>
        <button className="btn-secondary" data-testid="undo" onClick={undo}>
          ↶ Peru
        </button>
      </header>

      {match.status === "FINISHED" && (
        <div className="rounded-xl bg-amber-900/40 px-3 py-2 text-sm text-amber-200">
          Ottelu on merkitty päättyneeksi. Muutokset päivittävät tilastot automaattisesti.
        </div>
      )}

      {/* Period + goal-by-goal breakdown */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {([1, 2] as const).map((p) => (
          <button
            key={p}
            className={period === p ? "btn-primary" : "btn-secondary"}
            onClick={() => setPeriod(p)}
          >
            {p}. jakso
          </button>
        ))}
        <button
          className="btn-secondary"
          data-testid="goals-breakdown-open"
          onClick={() => setShowGoals(true)}
        >
          Maalit &amp; +/-
        </button>
      </div>

      {/* Court + bench */}
      <div className="grid flex-1 gap-3 md:grid-cols-2">
        <section className="rounded-2xl bg-slate-900 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Kentällä</h2>
            <span className={lineupWarning ? "text-xs text-amber-400" : "text-xs text-slate-500"}>
              {state.lineupPlayerIds.length} pelaajaa
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {court.map((mp) => {
              const st = state.playerStats[mp.playerId];
              return (
                <PlayerRow
                  key={mp.playerId}
                  testid={`court-player-${mp.playerNumber}`}
                  label={labelOf(mp.playerId)}
                  pm={st ? st.plusMinus : 0}
                  active={pendingSwap === mp.playerId}
                  onClick={() => handleCourtTap(mp.playerId)}
                />
              );
            })}
            {court.length === 0 && (
              <li className="text-sm text-slate-500">Ei pelaajia kentällä.</li>
            )}
          </ul>
        </section>

        <section className="rounded-2xl bg-slate-900 p-3">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Penkki</h2>
          <ul className="flex flex-col gap-2">
            {bench.map((mp) => (
              <PlayerRow
                key={mp.playerId}
                testid={`bench-player-${mp.playerNumber}`}
                label={labelOf(mp.playerId)}
                active={pendingSwap === mp.playerId}
                onClick={() => handleBenchTap(mp.playerId)}
              />
            ))}
            {bench.length === 0 && <li className="text-sm text-slate-500">Penkki on tyhjä.</li>}
          </ul>
        </section>
      </div>

      {pendingSwap && (
        <p className="text-center text-xs text-slate-400">
          Valittu <strong>{labelOf(pendingSwap)}</strong> – valitse vaihtopari toisesta listasta.
        </p>
      )}

      {/* Goal buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          className="btn-primary min-h-goal text-base"
          data-testid="own-goal"
          onClick={() => setGoalKind("own")}
        >
          ⚽ Oma maali
        </button>
        <button
          className="btn-danger min-h-goal text-base"
          data-testid="opponent-goal"
          onClick={() => setGoalKind("opponent")}
        >
          🥅 Vastustajan maali
        </button>
      </div>

      {/* Recent events */}
      <section className="rounded-2xl bg-slate-900 p-3">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
          Viimeisimmät tapahtumat
        </h2>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-500">Ei vielä tapahtumia.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-800">
            {recent.map((e) => (
              <li key={e.id}>
                <button
                  className="flex w-full items-center gap-3 py-2 text-left text-sm text-slate-200"
                  onClick={() => setEditingEvent(e)}
                >
                  <span className="text-base">{eventIcon(e.type)}</span>
                  <span className="flex-1">{describeEvent(e, labelOf)}</span>
                  <span className="text-xs text-slate-500">muokkaa</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex justify-end">
        <ConfirmButton
          className="btn-secondary"
          confirmLabel="Lopeta ottelu?"
          testid="finish-match"
          onConfirm={finish}
        >
          Lopeta ottelu
        </ConfirmButton>
      </div>

      {showGoals && (
        <Modal
          open
          onClose={() => setShowGoals(false)}
          wide
          title="Maalit & +/-"
          footer={
            <button
              className="btn-primary"
              data-testid="goals-breakdown-close"
              onClick={() => setShowGoals(false)}
            >
              Sulje
            </button>
          }
        >
          <p className="mb-3 text-sm text-slate-400">
            Jokainen maali ja siitä syntynyt oman joukkueen +/-. Rangaistusmaaleista
            (6 m / 10 m) ei kirjata +/-. Napauta riviä korjataksesi.
          </p>
          <GoalBreakdownList
            events={events}
            labelOf={labelOf}
            onPick={(e) => {
              setShowGoals(false);
              setEditingEvent(e);
            }}
          />
        </Modal>
      )}

      {goalKind && (
        <GoalDialog
          kind={goalKind}
          roster={roster}
          defaultLineup={state.lineupPlayerIds}
          defaultPeriod={period}
          onCancel={() => setGoalKind(null)}
          onSubmit={async (value) => {
            if (goalKind === "own") {
              await recordOwnGoal(match.id, value);
            } else {
              await recordOpponentGoal(match.id, {
                period: value.period,
                matchTimeSeconds: value.matchTimeSeconds,
                lineupPlayerIds: value.lineupPlayerIds,
                situation: value.situation,
              });
            }
            setGoalKind(null);
            toast.push("Maali tallennettu", "success");
          }}
        />
      )}

      {editingEvent && (
        <EventEditorModal
          event={editingEvent}
          roster={roster}
          defaultLineup={state.lineupPlayerIds}
          onClose={() => setEditingEvent(null)}
        />
      )}
    </div>
  );
}

function PlayerRow({
  label,
  pm,
  active,
  onClick,
  testid,
}: {
  label: string;
  pm?: number;
  active?: boolean;
  onClick: () => void;
  testid?: string;
}) {
  return (
    <li>
      <button
        data-testid={testid}
        onClick={onClick}
        className={[
          "flex min-h-card w-full items-center justify-between rounded-xl px-3 text-left text-base font-medium transition-colors",
          active ? "bg-brand text-white" : "bg-slate-800 text-slate-100 hover:bg-slate-700",
        ].join(" ")}
      >
        <span>{label}</span>
        {pm != null && (
          <span
            className={[
              "font-mono text-sm",
              pm > 0 ? "text-emerald-400" : pm < 0 ? "text-rose-400" : "text-slate-400",
            ].join(" ")}
          >
            {pm > 0 ? `+${pm}` : pm}
          </span>
        )}
      </button>
    </li>
  );
}
