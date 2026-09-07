import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveSeason, useMatchesBySeason, useTeam } from "@/app/hooks";
import { EmptyState, PageHeader, Spinner } from "@/components/ui";
import { useSeasonBundles } from "@/features/season/useSeasonStats";
import { buildMatchState } from "@/services/matchEngine";
import { MatchCard } from "./MatchCard";
import { NewMatchModal } from "./NewMatchModal";

export function MatchesPage() {
  const season = useActiveSeason();
  const team = useTeam();
  const matches = useMatchesBySeason(season?.id);
  const bundles = useSeasonBundles(season?.id);
  const [creating, setCreating] = useState(false);

  const summary = useMemo(() => {
    if (!bundles) return null;
    let wins = 0;
    let draws = 0;
    let losses = 0;
    let finished = 0;
    for (const b of bundles) {
      if (b.match.status !== "FINISHED") continue;
      finished += 1;
      const s = buildMatchState(
        b.matchPlayers.filter((m) => m.selected).map((m) => m.playerId),
        b.events,
      );
      if (s.ownScore > s.opponentScore) wins += 1;
      else if (s.ownScore < s.opponentScore) losses += 1;
      else draws += 1;
    }
    return { wins, draws, losses, finished };
  }, [bundles]);

  if (!season) return <Spinner />;

  return (
    <div>
      <PageHeader
        title={`Kausi ${season.name}`}
        subtitle={
          summary
            ? `${matches.length} ottelua · ${summary.finished} pelattu`
            : `${matches.length} ottelua`
        }
        actions={
          <button className="btn-primary" onClick={() => setCreating(true)}>
            + Uusi peli
          </button>
        }
      />

      {summary && summary.finished > 0 && (
        <p className="mb-4 text-sm text-slate-400">
          {summary.wins} voittoa • {summary.draws} tasapeliä • {summary.losses} tappiota
        </p>
      )}

      {matches.length === 0 ? (
        <EmptyState
          title="Ei vielä otteluita"
          hint="Lisää kauden ensimmäinen ottelu painamalla “Uusi peli”."
          action={
            <button className="btn-primary" onClick={() => setCreating(true)}>
              + Uusi peli
            </button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {matches.map((match) => (
            <MatchListRow key={match.id} matchId={match.id} />
          ))}
        </ul>
      )}

      {creating && season && team && (
        <NewMatchModal
          seasonId={season.id}
          teamId={team.id}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}

function MatchListRow({ matchId }: { matchId: string }) {
  const navigate = useNavigate();
  return <MatchCard matchId={matchId} onOpen={() => navigate(`/matches/${matchId}`)} />;
}
