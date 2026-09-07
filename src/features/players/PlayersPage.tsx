import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveSeason, usePlayers, useTeam } from "@/app/hooks";
import { EmptyState, PageHeader, Spinner } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { useToast } from "@/app/toast";
import { deletePlayer } from "@/db/repositories";
import { playerLabel } from "@/domain/format";
import { useSeasonStatistics } from "@/features/season/useSeasonStats";
import type { Player } from "@/domain/types";
import { PlayerFormModal } from "./PlayerFormModal";

export function PlayersPage() {
  const team = useTeam();
  const season = useActiveSeason();
  const players = usePlayers(team?.id);
  const toast = useToast();
  const navigate = useNavigate();
  const { data: seasonStats } = useSeasonStatistics(season?.id, players);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Player | null>(null);

  if (!team) return <Spinner />;

  const statFor = (playerId: string) =>
    seasonStats?.players.find((p) => p.playerId === playerId);

  return (
    <div>
      <PageHeader
        title="Pelaajat"
        subtitle={team.name}
        actions={
          <button className="btn-primary" onClick={() => setCreating(true)}>
            + Lisää pelaaja
          </button>
        }
      />

      {players.length === 0 ? (
        <EmptyState
          title="Ei pelaajia"
          hint="Pelinumero on pakollinen, nimi valinnainen."
          action={
            <button className="btn-primary" onClick={() => setCreating(true)}>
              + Lisää pelaaja
            </button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {players.map((p) => {
            const s = statFor(p.id);
            return (
              <li key={p.id} className="card flex items-center gap-3">
                <button
                  className="flex flex-1 items-center justify-between gap-3 text-left"
                  onClick={() => navigate(`/players/${p.id}`)}
                >
                  <span className="text-base font-semibold text-slate-50">{playerLabel(p)}</span>
                  {s && s.appearances > 0 && (
                    <span className="text-xs text-slate-400">
                      {s.appearances} O · {s.goals} M · {s.assists} S · {fmtPm(s.plusMinus)}
                    </span>
                  )}
                </button>
                <button className="btn-ghost px-2" onClick={() => setEditing(p)}>
                  ✎
                </button>
                <ConfirmButton
                  className="btn-ghost px-2"
                  confirmLabel="Poista?"
                  onConfirm={async () => {
                    try {
                      await deletePlayer(p.id);
                      toast.push("Pelaaja poistettu", "success");
                    } catch (err) {
                      toast.error(err);
                    }
                  }}
                >
                  🗑
                </ConfirmButton>
              </li>
            );
          })}
        </ul>
      )}

      {creating && <PlayerFormModal teamId={team.id} onClose={() => setCreating(false)} />}
      {editing && (
        <PlayerFormModal teamId={team.id} player={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function fmtPm(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}
