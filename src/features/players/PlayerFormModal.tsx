import { useState } from "react";
import { Modal } from "@/components/Modal";
import { useToast } from "@/app/toast";
import { createPlayer, updatePlayer } from "@/db/repositories";
import type { Player } from "@/domain/types";

interface Props {
  teamId: string;
  player?: Player;
  onClose: () => void;
}

export function PlayerFormModal({ teamId, player, onClose }: Props) {
  const toast = useToast();
  const editing = Boolean(player);
  const [number, setNumber] = useState(player ? String(player.number) : "");
  const [name, setName] = useState(player?.name ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      if (player) {
        await updatePlayer(player.id, { number, name: name.trim() || undefined });
        toast.push("Pelaaja päivitetty", "success");
      } else {
        await createPlayer(teamId, number, name.trim() || undefined);
        toast.push("Pelaaja lisätty", "success");
      }
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
      title={editing ? "Muokkaa pelaajaa" : "Uusi pelaaja"}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Peruuta
          </button>
          <button
            className="btn-primary"
            data-testid="player-save"
            onClick={submit}
            disabled={busy || number === ""}
          >
            {editing ? "Tallenna" : "Lisää"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-300">Pelinumero *</span>
          <input
            className="input font-mono"
            inputMode="numeric"
            data-testid="player-number"
            autoFocus
            value={number}
            onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))}
            placeholder="9"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-300">Nimi</span>
          <input
            className="input"
            data-testid="player-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="valinnainen"
          />
        </label>
        <p className="text-xs text-slate-500">
          Nimi on valinnainen. Sovellus toimii myös pelkillä pelinumeroilla.
        </p>
      </div>
    </Modal>
  );
}
