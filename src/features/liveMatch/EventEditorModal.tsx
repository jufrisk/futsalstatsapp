import { useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { TimeEntry } from "@/components/TimeEntry";
import { ConfirmButton } from "@/components/ConfirmButton";
import { useToast } from "@/app/toast";
import type { MatchEvent, MatchPlayer, Period } from "@/domain/types";
import { formatPlayerLabel } from "@/domain/format";
import { deleteEvent, updateEvent } from "@/db/repositories";
import { GoalDialog, type GoalDialogValue } from "./GoalDialog";
import { eventTitle } from "./eventDescribe";

interface Props {
  event: MatchEvent;
  roster: readonly MatchPlayer[];
  defaultLineup: string[];
  onClose: () => void;
}

export function EventEditorModal({ event, roster, defaultLineup, onClose }: Props) {
  const toast = useToast();

  const remove = async () => {
    try {
      await deleteEvent(event.id);
      toast.push("Tapahtuma poistettu", "success");
      onClose();
    } catch (err) {
      toast.error(err);
    }
  };

  if (event.type === "OWN_GOAL" || event.type === "OPPONENT_GOAL") {
    const isOwn = event.type === "OWN_GOAL";
    const initial: Partial<GoalDialogValue> = {
      period: event.period,
      matchTimeSeconds: event.matchTimeSeconds,
      lineupPlayerIds: event.payload.lineupPlayerIds,
      scorerPlayerId: isOwn ? event.payload.scorerPlayerId : undefined,
      assistPlayerId: isOwn ? event.payload.assistPlayerId : undefined,
      situation: event.payload.situation,
    };
    return (
      <GoalDialog
        kind={isOwn ? "own" : "opponent"}
        mode="edit"
        roster={roster}
        defaultLineup={defaultLineup}
        defaultPeriod={event.period}
        initial={initial}
        onCancel={onClose}
        onSubmit={async (value) => {
          await updateEvent(event.id, {
            period: value.period,
            matchTimeSeconds: value.matchTimeSeconds,
            payload: isOwn
              ? {
                  lineupPlayerIds: value.lineupPlayerIds,
                  scorerPlayerId: value.scorerPlayerId,
                  assistPlayerId: value.assistPlayerId,
                  situation: value.situation,
                }
              : { lineupPlayerIds: value.lineupPlayerIds, situation: value.situation },
          });
          toast.push("Muutokset tallennettu", "success");
          onClose();
        }}
      />
    );
  }

  if (event.type === "SUBSTITUTION") {
    return (
      <SubstitutionEditor event={event} roster={roster} onClose={onClose} onDelete={remove} />
    );
  }

  if (event.type === "PERIOD_CHANGED") {
    return <PeriodEditor event={event} onClose={onClose} onDelete={remove} />;
  }

  // MATCH_STARTED / MATCH_FINISHED — delete only.
  return (
    <Modal
      open
      onClose={onClose}
      title={eventTitle(event.type)}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Sulje
          </button>
          <ConfirmButton onConfirm={remove}>Poista tapahtuma</ConfirmButton>
        </>
      }
    >
      <p className="text-sm text-slate-400">
        Tätä tapahtumaa ei voi muokata. Voit poistaa sen ja tila lasketaan uudelleen.
      </p>
    </Modal>
  );
}

function SubstitutionEditor({
  event,
  roster,
  onClose,
  onDelete,
}: {
  event: Extract<MatchEvent, { type: "SUBSTITUTION" }>;
  roster: readonly MatchPlayer[];
  onClose: () => void;
  onDelete: () => void;
}) {
  const toast = useToast();
  const labelById = useMemo(
    () => new Map(roster.map((mp) => [mp.playerId, formatPlayerLabel(mp.playerNumber, mp.playerName)])),
    [roster],
  );
  const selected = roster.filter((mp) => mp.selected);

  const [period, setPeriod] = useState<Period>(event.period);
  const [time, setTime] = useState<{ seconds: number; valid: boolean }>({
    seconds: event.matchTimeSeconds ?? 0,
    valid: event.matchTimeSeconds != null,
  });
  const [outId, setOutId] = useState(event.payload.playerOutId);
  const [inId, setInId] = useState(event.payload.playerInId);

  const save = async () => {
    try {
      const lineupAfter = event.payload.lineupAfter
        .filter((id) => id !== event.payload.playerInId)
        .concat(inId);
      await updateEvent(event.id, {
        period,
        matchTimeSeconds: time.valid ? time.seconds : undefined,
        payload: {
          playerOutId: outId,
          playerInId: inId,
          lineupAfter: [...new Set(lineupAfter.filter((id) => id !== outId))],
        },
      });
      toast.push("Muutokset tallennettu", "success");
      onClose();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Vaihto"
      footer={
        <>
          <ConfirmButton onConfirm={onDelete}>Poista</ConfirmButton>
          <button className="btn-primary" onClick={save}>
            Tallenna
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
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
        <TimeEntry initialSeconds={event.matchTimeSeconds} onChange={setTime} />
        <SelectRow label="Pois kentältä" value={outId} onChange={setOutId} options={selected} labelById={labelById} />
        <SelectRow label="Kentälle" value={inId} onChange={setInId} options={selected} labelById={labelById} />
      </div>
    </Modal>
  );
}

function PeriodEditor({
  event,
  onClose,
  onDelete,
}: {
  event: Extract<MatchEvent, { type: "PERIOD_CHANGED" }>;
  onClose: () => void;
  onDelete: () => void;
}) {
  const toast = useToast();
  const [period, setPeriod] = useState<Period>(event.payload.period);
  return (
    <Modal
      open
      onClose={onClose}
      title="Jakson vaihto"
      footer={
        <>
          <ConfirmButton onConfirm={onDelete}>Poista</ConfirmButton>
          <button
            className="btn-primary"
            onClick={async () => {
              await updateEvent(event.id, { period, payload: { period } });
              toast.push("Tallennettu", "success");
              onClose();
            }}
          >
            Tallenna
          </button>
        </>
      }
    >
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
    </Modal>
  );
}

function SelectRow({
  label,
  value,
  onChange,
  options,
  labelById,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly MatchPlayer[];
  labelById: Map<string, string>;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((mp) => (
          <button
            key={mp.playerId}
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
