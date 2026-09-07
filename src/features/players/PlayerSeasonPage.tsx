import { Link, useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { useActiveSeason, usePlayers, useTeam } from "@/app/hooks";
import { PageHeader, Spinner, StatBadge } from "@/components/ui";
import { playerLabel } from "@/domain/format";
import { useSeasonStatistics } from "@/features/season/useSeasonStats";
import { formatFiDateShort } from "@/services/dates";

export function PlayerSeasonPage() {
  const { playerId } = useParams();
  const navigate = useNavigate();
  const team = useTeam();
  const season = useActiveSeason();
  const players = usePlayers(team?.id, true);
  const player = useLiveQuery(
    () => (playerId ? db.players.get(playerId) : undefined),
    [playerId],
  );
  const { data, loading } = useSeasonStatistics(season?.id, players);

  if (loading || player === undefined) return <Spinner />;

  const row = data?.players.find((p) => p.playerId === playerId);
  const matches = (playerId && data?.perPlayerMatches[playerId]) || [];
  const label = player
    ? playerLabel(player)
    : row
      ? `#${row.playerNumber}${row.playerName ? " " + row.playerName : ""}`
      : "Pelaaja";

  return (
    <div>
      <PageHeader
        title={label}
        subtitle={season ? `Kausi ${season.name}` : undefined}
        actions={
          <Link to="/players" className="btn-ghost">
            ← Pelaajat
          </Link>
        }
      />

      <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-7">
        <StatBadge label="Ottelut" value={row?.appearances ?? 0} />
        <StatBadge label="Maalit" value={row?.goals ?? 0} />
        <StatBadge label="Syötöt" value={row?.assists ?? 0} />
        <StatBadge label="Pisteet" value={row?.points ?? 0} />
        <StatBadge label="Plus" value={row?.plus ?? 0} />
        <StatBadge label="Miinus" value={row?.minus ?? 0} />
        <StatBadge label="+/-" value={fmtPm(row?.plusMinus ?? 0)} />
      </div>

      <section className="card">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-300">Ottelut</h2>
        {matches.length === 0 ? (
          <p className="text-sm text-slate-500">Ei pelattuja otteluita tällä kaudella.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-800">
            {matches.map((m) => (
              <li key={m.matchId}>
                <button
                  className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm"
                  onClick={() => navigate(`/matches/${m.matchId}/stats`)}
                >
                  <span className="text-slate-300">
                    {formatFiDateShort(m.date)} {m.opponentName}
                  </span>
                  <span className="font-mono text-slate-200">
                    {m.goals} M · {m.assists} S · {fmtPm(m.plusMinus)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function fmtPm(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}
