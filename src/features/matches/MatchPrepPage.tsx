import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useToast } from "@/app/toast";
import { useMatch, useMatchRoster, useTeam, usePlayers } from "@/app/hooks";
import { EmptyState, PageHeader, Spinner } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import {
  deleteMatch,
  ensureRosterRows,
  setRosterNumber,
  setRosterSelected,
  startMatch,
  toggleStarter,
} from "@/db/repositories";
import { validateStartMatch, validateUniqueMatchNumbers } from "@/domain/validation";
import { formatFiDate } from "@/services/dates";
import { EditMatchModal } from "./EditMatchModal";

export function MatchPrepPage() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const match = useMatch(matchId);
  const team = useTeam();
  const players = usePlayers(team?.id);
  const roster = useMatchRoster(matchId);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (matchId && team?.id) void ensureRosterRows(matchId, team.id);
  }, [matchId, team?.id, players.length]);

  const dup = useMemo(() => validateUniqueMatchNumbers(roster), [roster]);
  const startCheck = useMemo(() => validateStartMatch(roster), [roster]);

  if (match === undefined) return <Spinner />;
  if (!match) return <EmptyState title="Ottelua ei löytynyt" />;

  const selected = roster.filter((r) => r.selected);
  const starters = selected.filter((r) => r.startingLineup);

  const start = async () => {
    try {
      await startMatch(match.id);
      navigate(`/matches/${match.id}/live`);
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <div>
      <PageHeader
        title={`vs ${match.opponentName}`}
        subtitle={`${formatFiDate(match.date)} · ${match.venue === "HOME" ? "koti" : "vieras"}`}
        actions={
          <>
            <Link to="/" className="btn-ghost">
              ← Ottelut
            </Link>
            <button className="btn-secondary" onClick={() => setEditing(true)}>
              Muokkaa tietoja
            </button>
          </>
        }
      />

      {players.length === 0 ? (
        <EmptyState
          title="Ei pelaajia"
          hint="Lisää joukkueen pelaajat ennen kokoonpanon valintaa."
          action={
            <Link to="/players" className="btn-primary">
              Lisää pelaajia
            </Link>
          }
        />
      ) : (
        <>
          <section className="card mb-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-300">
                Kokoonpano
              </h2>
              <span className="text-sm text-slate-400">
                {selected.length} / {roster.length} valittu
              </span>
            </div>

            {!dup.ok && (
              <p className="mb-3 rounded-lg bg-rose-950/60 px-3 py-2 text-sm text-rose-300">
                {dup.error}
              </p>
            )}

            <ul className="flex flex-col divide-y divide-slate-800">
              {roster.map((mp) => {
                const isDup = dup.duplicateNumbers.includes(mp.playerNumber) && mp.selected;
                return (
                  <li
                    key={mp.id}
                    className="flex items-center gap-3 py-2"
                    data-testid={`roster-row-${mp.playerNumber}`}
                  >
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-brand"
                      data-testid={`roster-select-${mp.playerNumber}`}
                      checked={mp.selected}
                      onChange={(e) =>
                        setRosterSelected(match.id, mp.playerId, e.target.checked).catch(
                          toast.error,
                        )
                      }
                    />
                    <NumberField
                      value={mp.playerNumber}
                      highlight={isDup}
                      onCommit={(n) =>
                        setRosterNumber(match.id, mp.playerId, n).catch(toast.error)
                      }
                    />
                    <span className="flex-1 text-sm text-slate-100">
                      {mp.playerName ?? <span className="text-slate-500">nimetön</span>}
                    </span>
                    <label className="flex items-center gap-1.5 text-xs text-slate-400">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-amber-500"
                        data-testid={`roster-starter-${mp.playerNumber}`}
                        disabled={!mp.selected}
                        checked={mp.startingLineup}
                        onChange={(e) =>
                          toggleStarter(match.id, mp.playerId, e.target.checked).catch(
                            toast.error,
                          )
                        }
                      />
                      Aloittaa
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card mb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-300">
                Aloitusviisikko
              </h2>
              <span
                className={`text-sm ${starters.length === 5 ? "text-emerald-400" : "text-slate-400"}`}
              >
                {starters.length} / 5 valittu
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              {starters.length === 0
                ? "Merkitse aloittavat pelaajat yllä olevasta listasta."
                : starters
                    .sort((a, b) => a.playerNumber - b.playerNumber)
                    .map((s) => `#${s.playerNumber}${s.playerName ? " " + s.playerName : ""}`)
                    .join("  ·  ")}
            </p>
          </section>

          {startCheck.warnings.map((w) => (
            <p key={w} className="mb-2 text-sm text-amber-400">
              ⚠ {w}
            </p>
          ))}
          {startCheck.errors.map((e) => (
            <p key={e} className="mb-2 text-sm text-rose-400">
              {e}
            </p>
          ))}

          <div className="flex flex-wrap justify-between gap-2">
            <ConfirmButton
              className="btn-ghost"
              confirmLabel="Poista ottelu?"
              onConfirm={async () => {
                await deleteMatch(match.id);
                navigate("/");
              }}
            >
              Poista ottelu
            </ConfirmButton>
            <button
              className="btn-primary"
              data-testid="start-match"
              disabled={!startCheck.ok}
              onClick={start}
            >
              Aloita tilastointi
            </button>
          </div>
        </>
      )}

      {editing && <EditMatchModal match={match} onClose={() => setEditing(false)} />}
    </div>
  );
}

function NumberField({
  value,
  onCommit,
  highlight,
}: {
  value: number;
  onCommit: (n: number) => void;
  highlight?: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  return (
    <input
      inputMode="numeric"
      pattern="[0-9]*"
      className={[
        "w-14 rounded-lg border bg-slate-900 px-2 py-1 text-center font-mono text-sm",
        highlight ? "border-rose-500 text-rose-300" : "border-slate-700 text-slate-100",
      ].join(" ")}
      value={draft}
      onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
      onBlur={() => {
        if (draft === "" || Number(draft) === value) {
          setDraft(String(value));
          return;
        }
        onCommit(Number(draft));
      }}
    />
  );
}
