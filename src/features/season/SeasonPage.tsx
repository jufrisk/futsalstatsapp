import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveSeason, usePlayers, useSeasons, useTeam } from "@/app/hooks";
import { EmptyState, PageHeader, Spinner, StatBadge } from "@/components/ui";
import { useToast } from "@/app/toast";
import { useAdmin } from "@/app/adminAuth";
import { createSeason, setActiveSeason } from "@/db/repositories";
import { useSeasonStatistics } from "./useSeasonStats";

export function SeasonPage() {
  const team = useTeam();
  const seasons = useSeasons();
  const active = useActiveSeason();
  const players = usePlayers(team?.id, true);
  const toast = useToast();
  const navigate = useNavigate();
  const { ensureAdmin } = useAdmin();
  const { data, loading } = useSeasonStatistics(active?.id, players);
  const [newName, setNewName] = useState("");

  if (!active) return <Spinner />;

  const record = data?.record;

  return (
    <div>
      <PageHeader title={`Kausi ${active.name}`} subtitle="Koko kauden yhteenveto" />

      <section className="card mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Aktiivinen kausi
            </span>
            <select
              className="input"
              value={active.id}
              onChange={(e) => setActiveSeason(e.target.value)}
            >
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Uusi kausi
              </span>
              <input
                className="input"
                placeholder="2027–28"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </label>
            <button
              className="btn-secondary"
              disabled={!newName.trim()}
              onClick={async () => {
                if (!(await ensureAdmin())) return;
                try {
                  await createSeason(newName.trim());
                  setNewName("");
                  toast.push("Kausi luotu", "success");
                } catch (err) {
                  toast.error(err);
                }
              }}
            >
              Luo
            </button>
          </div>
        </div>
      </section>

      <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
        <StatBadge
          label="Ottelut"
          value={record?.matchesPlayed ?? 0}
          testid="season-matches"
        />
        <StatBadge label="Voitot" value={record?.wins ?? 0} testid="season-wins" />
        <StatBadge label="Tasapelit" value={record?.draws ?? 0} testid="season-draws" />
        <StatBadge label="Tappiot" value={record?.losses ?? 0} testid="season-losses" />
        <StatBadge label="Tehdyt" value={record?.goalsFor ?? 0} />
        <StatBadge label="Päästetyt" value={record?.goalsAgainst ?? 0} />
      </div>

      {loading ? (
        <Spinner label="Lasketaan kausitilastoja…" />
      ) : !data || data.players.length === 0 ? (
        <EmptyState
          title="Ei kausitilastoja"
          hint="Kausitilastot muodostuvat pelattujen otteluiden tapahtumista."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[34rem]">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="th">#</th>
                <th className="th">Pelaaja</th>
                <th className="th text-right">O</th>
                <th className="th text-right">M</th>
                <th className="th text-right">S</th>
                <th className="th text-right">P</th>
                <th className="th text-right">+</th>
                <th className="th text-right">−</th>
                <th className="th text-right">+/-</th>
              </tr>
            </thead>
            <tbody>
              {data.players.map((r) => (
                <tr
                  key={r.playerId}
                  className="cursor-pointer border-b border-slate-800/60 hover:bg-slate-800/40"
                  onClick={() => navigate(`/players/${r.playerId}`)}
                >
                  <td className="td font-mono">#{r.playerNumber}</td>
                  <td className="td">{r.playerName ?? ""}</td>
                  <td className="td text-right" data-testid={`season-stat-${r.playerNumber}-apps`}>
                    {r.appearances}
                  </td>
                  <td className="td text-right" data-testid={`season-stat-${r.playerNumber}-goals`}>
                    {r.goals}
                  </td>
                  <td className="td text-right">{r.assists}</td>
                  <td className="td text-right">{r.points}</td>
                  <td className="td text-right">{r.plus}</td>
                  <td className="td text-right">{r.minus}</td>
                  <td className="td text-right font-semibold">{fmtPm(r.plusMinus)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function fmtPm(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}
