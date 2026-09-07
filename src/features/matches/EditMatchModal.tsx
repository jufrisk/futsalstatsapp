import { useState } from "react";
import { Modal } from "@/components/Modal";
import { useToast } from "@/app/toast";
import { updateMatch } from "@/db/repositories";
import type { Match, MatchVenue } from "@/domain/types";

export function EditMatchModal({ match, onClose }: { match: Match; onClose: () => void }) {
  const toast = useToast();
  const [opponentName, setOpponentName] = useState(match.opponentName);
  const [date, setDate] = useState(match.date);
  const [venue, setVenue] = useState<MatchVenue>(match.venue);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await updateMatch(match.id, { opponentName, date, venue });
      toast.push("Tallennettu", "success");
      onClose();
    } catch (err) {
      toast.error(err);
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Ottelun tiedot"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Peruuta
          </button>
          <button className="btn-primary" onClick={save} disabled={busy || !opponentName.trim()}>
            Tallenna
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-300">Vastustaja *</span>
          <input className="input" value={opponentName} onChange={(e) => setOpponentName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-300">Päivämäärä *</span>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
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
    </Modal>
  );
}
