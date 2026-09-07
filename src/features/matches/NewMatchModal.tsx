import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "@/components/Modal";
import { useToast } from "@/app/toast";
import { createMatch, ensureRosterRows } from "@/db/repositories";
import { todayIsoDate } from "@/services/dates";
import type { MatchVenue } from "@/domain/types";

export function NewMatchModal({
  seasonId,
  teamId,
  onClose,
}: {
  seasonId: string;
  teamId: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const navigate = useNavigate();
  const [opponentName, setOpponentName] = useState("");
  const [date, setDate] = useState(todayIsoDate());
  const [venue, setVenue] = useState<MatchVenue>("HOME");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const match = await createMatch({ seasonId, teamId, opponentName, date, venue });
      await ensureRosterRows(match.id, teamId);
      toast.push("Ottelu lisätty", "success");
      onClose();
      navigate(`/matches/${match.id}/prepare`);
    } catch (err) {
      toast.error(err);
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Uusi peli"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Peruuta
          </button>
          <button
            className="btn-primary"
            data-testid="match-create"
            onClick={submit}
            disabled={busy || !opponentName.trim() || !date}
          >
            Lisää ottelu
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-300">Vastustaja *</span>
          <input
            className="input"
            data-testid="match-opponent"
            autoFocus
            value={opponentName}
            onChange={(e) => setOpponentName(e.target.value)}
            placeholder="FC Team A"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-300">Päivämäärä *</span>
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-300">Koti / vieras</span>
          <div className="flex gap-2">
            {(["HOME", "AWAY"] as const).map((v) => (
              <button
                key={v}
                className={venue === v ? "btn-primary flex-1" : "btn-secondary flex-1"}
                onClick={() => setVenue(v)}
              >
                {v === "HOME" ? "Koti" : "Vieras"}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
