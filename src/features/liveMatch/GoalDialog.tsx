import { useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { TimeEntry } from "@/components/TimeEntry";
import { useToast } from "@/app/toast";
import type { GoalSituation, MatchPlayer, Period } from "@/domain/types";
import { formatPlayerLabel } from "@/domain/format";
import {
  GOAL_SITUATIONS,
  MAX_COURT_PLAYERS,
  goalCountsForPlusMinus,
  goalSituationLabel,
  isPenalty,
} from "@/domain/goals";

export interface GoalDialogValue {
  period: Period;
  matchTimeSeconds: number;
  lineupPlayerIds: string[];
  scorerPlayerId?: string;
  assistPlayerId?: string;
  situation?: GoalSituation;
}

interface GoalDialogProps {
  kind: "own" | "opponent";
  roster: readonly MatchPlayer[];
  defaultLineup: string[];
  defaultPeriod: Period;
  initial?: Partial<GoalDialogValue>;
  mode?: "create" | "edit";
  onCancel: () => void;
  onSubmit: (value: GoalDialogValue) => Promise<void> | void;
}

export function GoalDialog({
  kind,
  roster,
  defaultLineup,
  defaultPeriod,
  initial,
  mode = "create",
  onCancel,
  onSubmit,
}: GoalDialogProps) {
  const toast = useToast();
  const labelById = useMemo(
    () => new Map(roster.map((mp) => [mp.playerId, formatPlayerLabel(mp.playerNumber, mp.playerName)])),
    [roster],
  );

  const [period, setPeriod] = useState<Period>(initial?.period ?? defaultPeriod);
  const [situation, setSituation] = useState<GoalSituation>(initial?.situation ?? "OPEN_PLAY");
  const [time, setTime] = useState<{ seconds: number; valid: boolean }>({
    seconds: initial?.matchTimeSeconds ?? 0,
    valid: initial?.matchTimeSeconds != null,
  });
  const [lineup, setLineup] = useState<string[]>(initial?.lineupPlayerIds ?? defaultLineup);
  const [scorer, setScorer] = useState<string | undefined>(initial?.scorerPlayerId);
  const [assist, setAssist] = useState<string | undefined>(initial?.assistPlayerId);
  const [showDetails, setShowDetails] = useState(
    Boolean(initial?.scorerPlayerId || initial?.assistPlayerId),
  );
  const [busy, setBusy] = useState(false);

  const isOwn = kind === "own";
  const penalty = isPenalty(situation);
  const countsForPm = goalCountsForPlusMinus(situation);
  const tooManyOnCourt = !penalty && new Set(lineup).size > MAX_COURT_PLAYERS;
  const title = isOwn ? "Oma maali" : "Vastustajan maali";

  const toggleLineup = (playerId: string) => {
    setLineup((cur) =>
      cur.includes(playerId) ? cur.filter((id) => id !== playerId) : [...cur, playerId],
    );
  };

  const scorerChoices = roster.filter((mp) => mp.selected);

  const submit = async () => {
    if (!time.valid) {
      toast.push("Syötä peliaika", "error");
      return;
    }
    if (tooManyOnCourt) {
      toast.push(`Kentällä voi olla enintään ${MAX_COURT_PLAYERS} pelaajaa maalin hetkellä.`, "error");
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        period,
        matchTimeSeconds: time.seconds,
        lineupPlayerIds: [...lineup],
        scorerPlayerId: isOwn ? scorer : undefined,
        assistPlayerId: isOwn && !penalty ? assist : undefined,
        situation: situation === "OPEN_PLAY" ? undefined : situation,
      });
    } catch (err) {
      toast.error(err);
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onCancel}
      title={title}
      footer={
        <>
          <button className="btn-ghost" onClick={onCancel}>
            Peruuta
          </button>
          <button
            className="btn-primary"
            data-testid="goal-save"
            onClick={submit}
            disabled={busy || !time.valid || tooManyOnCourt}
          >
            {mode === "edit" ? "Tallenna muutokset" : "Tallenna"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex justify-center gap-2">
          {([1, 2] as const).map((p) => (
            <button
              key={p}
              className={period === p ? "btn-primary" : "btn-secondary"}
              onClick={() => setPeriod(p)}
            >
              {p}. jakso
            </button>
          ))}
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Maalitilanne
          </p>
          <div className="flex flex-wrap gap-2">
            {GOAL_SITUATIONS.map((s) => (
              <button
                key={s}
                data-testid={`situation-${s}`}
                className={[
                  "rounded-lg px-2.5 py-1.5 text-sm font-medium",
                  situation === s ? "bg-brand text-white" : "bg-slate-800 text-slate-300",
                ].join(" ")}
                onClick={() => setSituation(s)}
              >
                {goalSituationLabel(s)}
              </button>
            ))}
          </div>
          {!countsForPm && (
            <p className="mt-2 text-xs text-amber-400">
              {penalty
                ? "Rangaistusmaali: tulos päivittyy, mutta +/- ei kirjata kentällä olleille."
                : "Eri kentällisyys (esim. 4v3): tulos päivittyy, mutta +/- ei kirjata."}
            </p>
          )}
        </div>

        <div>
          <p className="mb-2 text-center text-sm font-medium text-slate-300">Peliaika</p>
          <TimeEntry initialSeconds={initial?.matchTimeSeconds} onChange={setTime} autoFocus />
        </div>

        {!penalty && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-300">
                {isOwn ? "Kentällä (plus)" : "Oman joukkueen kentällä (miinus)"}
              </p>
              <span
                className={
                  tooManyOnCourt ? "text-xs font-semibold text-rose-400" : "text-xs text-slate-500"
                }
              >
                {lineup.length} pelaajaa
              </span>
            </div>
            {tooManyOnCourt && (
              <p className="mb-2 text-xs text-rose-400">
                Kentällä voi olla enintään {MAX_COURT_PLAYERS} pelaajaa maalin hetkellä. Poista
                ylimääräiset.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {scorerChoices.map((mp) => {
                const on = lineup.includes(mp.playerId);
                return (
                  <button
                    key={mp.playerId}
                    data-testid={`lineup-${mp.playerNumber}`}
                    onClick={() => toggleLineup(mp.playerId)}
                    className={[
                      "rounded-lg px-2.5 py-1.5 text-sm font-medium",
                      on ? "bg-brand text-white" : "bg-slate-800 text-slate-400",
                    ].join(" ")}
                  >
                    {labelById.get(mp.playerId)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {isOwn && penalty && (
          <PickerRow
            label="Rangaistuksen ampuja"
            testPrefix="scorer"
            value={scorer}
            onChange={setScorer}
            options={scorerChoices}
            labelById={labelById}
          />
        )}

        {isOwn && !penalty && (
          <div>
            {!showDetails ? (
              <button
                className="btn-secondary w-full"
                data-testid="add-scorer-assist"
                onClick={() => setShowDetails(true)}
              >
                + Maalintekijä / syöttäjä
              </button>
            ) : (
              <div className="flex flex-col gap-3 rounded-xl bg-slate-800/50 p-3">
                <PickerRow
                  label="Maalintekijä"
                  testPrefix="scorer"
                  value={scorer}
                  onChange={setScorer}
                  options={scorerChoices}
                  labelById={labelById}
                />
                <PickerRow
                  label="Syöttäjä"
                  testPrefix="assist"
                  value={assist}
                  onChange={setAssist}
                  options={scorerChoices}
                  labelById={labelById}
                />
                <p className="text-xs text-slate-500">
                  Molemmat ovat vapaaehtoisia ja voi lisätä myöhemminkin.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function PickerRow({
  label,
  testPrefix,
  value,
  onChange,
  options,
  labelById,
}: {
  label: string;
  testPrefix: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  options: readonly MatchPlayer[];
  labelById: Map<string, string>;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          data-testid={`${testPrefix}-none`}
          className={[
            "rounded-lg px-2.5 py-1.5 text-sm",
            value === undefined ? "bg-slate-600 text-white" : "bg-slate-800 text-slate-400",
          ].join(" ")}
          onClick={() => onChange(undefined)}
        >
          ei kirjattu
        </button>
        {options.map((mp) => (
          <button
            key={mp.playerId}
            data-testid={`${testPrefix}-${mp.playerNumber}`}
            className={[
              "rounded-lg px-2.5 py-1.5 text-sm font-medium",
              value === mp.playerId ? "bg-brand text-white" : "bg-slate-800 text-slate-300",
            ].join(" ")}
            onClick={() => onChange(mp.playerId)}
          >
            {labelById.get(mp.playerId)}
          </button>
        ))}
      </div>
    </div>
  );
}
