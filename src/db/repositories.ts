import { db, recordTombstone } from "./database";
import { newId, nowIso } from "@/domain/ids";
import { getStoredActiveSeasonId, setStoredActiveSeasonId } from "@/app/activeSeason";
import type {
  GoalSituation,
  Match,
  MatchEvent,
  MatchPlayer,
  MatchVenue,
  Period,
  Player,
  Season,
  Team,
} from "@/domain/types";
import {
  duplicateTeamNumber,
  validateJerseyNumber,
  validateStartMatch,
} from "@/domain/validation";
import { MAX_COURT_PLAYERS, goalLineupTooLarge } from "@/domain/goals";
import { nextSequence, sortEvents } from "@/services/matchEngine";

function assertGoalLineupSize(lineupPlayerIds: readonly string[]): void {
  if (goalLineupTooLarge(lineupPlayerIds)) {
    throw new Error(
      `Kentällä voi olla enintään ${MAX_COURT_PLAYERS} pelaajaa maalin hetkellä.`,
    );
  }
}

/* ============================================================================
 * Bootstrap
 * ========================================================================= */

const DEFAULT_TEAM_NAME = "Oma joukkue";

export async function ensureBootstrap(): Promise<{ team: Team; season: Season }> {
  return db.transaction("rw", db.teams, db.seasons, async () => {
    let team = await db.teams.toCollection().first();
    if (!team) {
      const ts = nowIso();
      team = {
        id: newId(),
        name: DEFAULT_TEAM_NAME,
        createdAt: ts,
        updatedAt: ts,
      };
      await db.teams.add(team);
    }

    let season = await db.seasons.filter((s) => s.active).first();
    if (!season) {
      season = await db.seasons.toCollection().first();
    }
    if (!season) {
      const ts = nowIso();
      const year = new Date().getFullYear();
      season = {
        id: newId(),
        name: `${year}–${String((year + 1) % 100).padStart(2, "0")}`,
        active: true,
        createdAt: ts,
        updatedAt: ts,
      };
      await db.seasons.add(season);
    }
    return { team, season };
  });
}

export async function getPrimaryTeam(): Promise<Team> {
  const team = await db.teams.toCollection().first();
  if (!team) return (await ensureBootstrap()).team;
  return team;
}

/* ============================================================================
 * Seasons
 * ========================================================================= */

export function listSeasons(): Promise<Season[]> {
  return db.seasons.toArray().then((rows) =>
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

export async function getActiveSeason(): Promise<Season | undefined> {
  const seasons = await db.seasons.toArray();
  if (seasons.length === 0) return undefined;
  const storedId = getStoredActiveSeasonId();
  const chosen = storedId && seasons.find((s) => s.id === storedId);
  if (chosen) return chosen;
  return [...seasons].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export async function createSeason(name: string, activate = true): Promise<Season> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Kauden nimi on pakollinen.");
  const ts = nowIso();
  const season: Season = {
    id: newId(),
    name: trimmed,
    active: false,
    createdAt: ts,
    updatedAt: ts,
  };
  await db.seasons.add(season);
  if (activate) setActiveSeason(season.id);
  return season;
}

/** Per-device selection only — never written to the DB, never synced. */
export function setActiveSeason(seasonId: string): void {
  setStoredActiveSeasonId(seasonId);
}

export async function renameSeason(seasonId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Kauden nimi on pakollinen.");
  await db.seasons.update(seasonId, { name: trimmed, updatedAt: nowIso() });
}

export async function deleteSeason(seasonId: string): Promise<void> {
  const matches = await db.matches.where("seasonId").equals(seasonId).toArray();
  await db.transaction(
    "rw",
    [db.seasons, db.matches, db.matchPlayers, db.matchEvents, db.tombstones],
    async () => {
      for (const m of matches) await deleteMatchInternal(m.id);
      await db.seasons.delete(seasonId);
      await recordTombstone("seasons", seasonId);
    },
  );
}

/* ============================================================================
 * Players
 * ========================================================================= */

export function listPlayers(teamId: string, includeInactive = false): Promise<Player[]> {
  return db.players
    .where("teamId")
    .equals(teamId)
    .toArray()
    .then((rows) =>
      rows
        .filter((p) => includeInactive || p.active)
        .sort((a, b) => a.number - b.number),
    );
}

export async function createPlayer(
  teamId: string,
  numberInput: number | string,
  name?: string,
): Promise<Player> {
  const check = validateJerseyNumber(numberInput);
  if (!check.ok) throw new Error(check.error);
  const number = Number(numberInput);

  const existing = await listPlayers(teamId, true);
  if (duplicateTeamNumber(existing, number)) {
    throw new Error(`Pelinumero ${number} on jo käytössä joukkueessa.`);
  }

  const ts = nowIso();
  const player: Player = {
    id: newId(),
    teamId,
    number,
    name: name?.trim() ? name.trim() : undefined,
    active: true,
    createdAt: ts,
    updatedAt: ts,
  };
  await db.players.add(player);
  return player;
}

export async function updatePlayer(
  playerId: string,
  patch: { number?: number | string; name?: string | undefined; active?: boolean },
): Promise<void> {
  const player = await db.players.get(playerId);
  if (!player) throw new Error("Pelaajaa ei löytynyt.");

  const next: Partial<Player> = { updatedAt: nowIso() };

  if (patch.number !== undefined) {
    const check = validateJerseyNumber(patch.number);
    if (!check.ok) throw new Error(check.error);
    const number = Number(patch.number);
    const others = await listPlayers(player.teamId, true);
    if (duplicateTeamNumber(others, number, playerId)) {
      throw new Error(`Pelinumero ${number} on jo käytössä joukkueessa.`);
    }
    next.number = number;
  }

  if (patch.name !== undefined) {
    next.name = patch.name?.trim() ? patch.name.trim() : undefined;
  }
  if (patch.active !== undefined) next.active = patch.active;

  await db.players.update(playerId, next);
}

export async function deletePlayer(playerId: string): Promise<void> {
  // Roster snapshots (MatchPlayer) keep historical numbers, so a hard delete of
  // the master record is safe for past matches.
  await db.transaction("rw", [db.players, db.tombstones], async () => {
    await db.players.delete(playerId);
    await recordTombstone("players", playerId);
  });
}

/* ============================================================================
 * Matches
 * ========================================================================= */

export function listMatchesBySeason(seasonId: string): Promise<Match[]> {
  return db.matches
    .where("seasonId")
    .equals(seasonId)
    .toArray()
    .then((rows) => rows.sort((a, b) => b.date.localeCompare(a.date)));
}

export function getMatch(matchId: string): Promise<Match | undefined> {
  return db.matches.get(matchId);
}

export async function createMatch(input: {
  seasonId: string;
  teamId: string;
  opponentName: string;
  date: string;
  venue: MatchVenue;
}): Promise<Match> {
  const opponentName = input.opponentName.trim();
  if (!opponentName) throw new Error("Vastustaja on pakollinen.");
  if (!input.date) throw new Error("Päivämäärä on pakollinen.");

  const ts = nowIso();
  const match: Match = {
    id: newId(),
    seasonId: input.seasonId,
    teamId: input.teamId,
    opponentName,
    date: input.date,
    venue: input.venue,
    status: "DRAFT",
    createdAt: ts,
    updatedAt: ts,
  };
  await db.matches.add(match);
  return match;
}

export async function updateMatch(
  matchId: string,
  patch: Partial<Pick<Match, "opponentName" | "date" | "venue" | "status">>,
): Promise<void> {
  const next: Partial<Match> = { ...patch, updatedAt: nowIso() };
  if (patch.opponentName !== undefined) {
    const trimmed = patch.opponentName.trim();
    if (!trimmed) throw new Error("Vastustaja on pakollinen.");
    next.opponentName = trimmed;
  }
  await db.matches.update(matchId, next);
}

async function deleteMatchInternal(matchId: string): Promise<void> {
  const [eventIds, rosterIds] = await Promise.all([
    db.matchEvents.where("matchId").equals(matchId).primaryKeys(),
    db.matchPlayers.where("matchId").equals(matchId).primaryKeys(),
  ]);
  await db.matchEvents.where("matchId").equals(matchId).delete();
  await db.matchPlayers.where("matchId").equals(matchId).delete();
  await db.matches.delete(matchId);

  const ts = nowIso();
  await db.tombstones.bulkPut([
    { id: `matches:${matchId}`, table: "matches", recordId: matchId, deletedAt: ts },
    ...eventIds.map((id) => ({
      id: `matchEvents:${String(id)}`,
      table: "matchEvents" as const,
      recordId: String(id),
      deletedAt: ts,
    })),
    ...rosterIds.map((id) => ({
      id: `matchPlayers:${String(id)}`,
      table: "matchPlayers" as const,
      recordId: String(id),
      deletedAt: ts,
    })),
  ]);
}

export async function deleteMatch(matchId: string): Promise<void> {
  await db.transaction(
    "rw",
    [db.matches, db.matchPlayers, db.matchEvents, db.tombstones],
    () => deleteMatchInternal(matchId),
  );
}

/* ============================================================================
 * Match roster
 * ========================================================================= */

export function getMatchRoster(matchId: string): Promise<MatchPlayer[]> {
  return db.matchPlayers
    .where("matchId")
    .equals(matchId)
    .toArray()
    .then((rows) => rows.sort((a, b) => a.playerNumber - b.playerNumber));
}

/**
 * Create MatchPlayer rows for every active team player that is not yet on the
 * roster. Existing rows (and their match-specific overrides) are left untouched.
 * Inherits `playerNumber` / `playerName` from the current Player master data
 * (TECHNICAL_SPEC §49).
 */
export async function ensureRosterRows(matchId: string, teamId: string): Promise<void> {
  await db.transaction("rw", db.players, db.matchPlayers, async () => {
    const [players, existing] = await Promise.all([
      listPlayers(teamId),
      getMatchRoster(matchId),
    ]);
    const known = new Set(existing.map((mp) => mp.playerId));
    const additions: MatchPlayer[] = players
      .filter((p) => !known.has(p.id))
      .map((p) => ({
        id: newId(),
        matchId,
        playerId: p.id,
        playerNumber: p.number,
        playerName: p.name,
        selected: false,
        startingLineup: false,
        updatedAt: nowIso(),
      }));
    if (additions.length > 0) await db.matchPlayers.bulkAdd(additions);
  });
}

export async function setRosterSelected(
  matchId: string,
  playerId: string,
  selected: boolean,
): Promise<void> {
  const mp = await findRosterRow(matchId, playerId);
  const patch: Partial<MatchPlayer> = { selected, updatedAt: nowIso() };
  if (!selected) patch.startingLineup = false;
  await db.matchPlayers.update(mp.id, patch);
  await refreshMatchReadiness(matchId);
}

export async function setRosterNumber(
  matchId: string,
  playerId: string,
  numberInput: number | string,
): Promise<void> {
  const check = validateJerseyNumber(numberInput);
  if (!check.ok) throw new Error(check.error);
  const mp = await findRosterRow(matchId, playerId);
  await db.matchPlayers.update(mp.id, {
    playerNumber: Number(numberInput),
    updatedAt: nowIso(),
  });
  await refreshMatchReadiness(matchId);
}

export async function setRosterName(
  matchId: string,
  playerId: string,
  name: string | undefined,
): Promise<void> {
  const mp = await findRosterRow(matchId, playerId);
  await db.matchPlayers.update(mp.id, {
    playerName: name?.trim() ? name.trim() : undefined,
    updatedAt: nowIso(),
  });
}

export async function toggleStarter(
  matchId: string,
  playerId: string,
  value: boolean,
): Promise<void> {
  const mp = await findRosterRow(matchId, playerId);
  const patch: Partial<MatchPlayer> = { startingLineup: value, updatedAt: nowIso() };
  if (value) patch.selected = true;
  await db.matchPlayers.update(mp.id, patch);
  await refreshMatchReadiness(matchId);
}

async function findRosterRow(matchId: string, playerId: string): Promise<MatchPlayer> {
  const rows = await db.matchPlayers.where("matchId").equals(matchId).toArray();
  const mp = rows.find((r) => r.playerId === playerId);
  if (!mp) throw new Error("Pelaaja ei ole ottelun kokoonpanossa.");
  return mp;
}

/** Move DRAFT <-> READY based on whether the roster passes start validation. */
async function refreshMatchReadiness(matchId: string): Promise<void> {
  const match = await db.matches.get(matchId);
  if (!match || (match.status !== "DRAFT" && match.status !== "READY")) return;
  const roster = await getMatchRoster(matchId);
  const check = validateStartMatch(roster);
  const nextStatus: Match["status"] = check.ok ? "READY" : "DRAFT";
  if (nextStatus !== match.status) {
    await db.matches.update(matchId, { status: nextStatus, updatedAt: nowIso() });
  }
}

/* ============================================================================
 * Match lifecycle
 * ========================================================================= */

export async function startMatch(matchId: string): Promise<void> {
  await db.transaction("rw", db.matches, db.matchPlayers, db.matchEvents, async () => {
    const match = await db.matches.get(matchId);
    if (!match) throw new Error("Ottelua ei löytynyt.");
    if (match.status === "LIVE") return;

    const roster = await getMatchRoster(matchId);
    const check = validateStartMatch(roster);
    if (!check.ok) throw new Error(check.errors.join(" "));

    const events = await listMatchEvents(matchId);
    const startingIds = roster
      .filter((mp) => mp.selected && mp.startingLineup)
      .map((mp) => mp.playerId);

    if (!events.some((e) => e.type === "MATCH_STARTED")) {
      const ts = nowIso();
      const started: MatchEvent = {
        id: newId(),
        matchId,
        type: "MATCH_STARTED",
        sequence: nextSequence(events),
        period: 1,
        source: "MANUAL",
        createdAt: ts,
        updatedAt: ts,
        payload: { startingLineupPlayerIds: startingIds },
      };
      await db.matchEvents.add(started);
    }

    await db.matches.update(matchId, { status: "LIVE", updatedAt: nowIso() });
  });
}

export async function finishMatch(matchId: string): Promise<void> {
  await db.transaction("rw", db.matches, db.matchEvents, async () => {
    const match = await db.matches.get(matchId);
    if (!match) throw new Error("Ottelua ei löytynyt.");
    const events = await listMatchEvents(matchId);
    const ts = nowIso();
    if (!events.some((e) => e.type === "MATCH_FINISHED")) {
      const finished: MatchEvent = {
        id: newId(),
        matchId,
        type: "MATCH_FINISHED",
        sequence: nextSequence(events),
        period: currentPeriodFromEvents(events),
        source: "MANUAL",
        createdAt: ts,
        updatedAt: ts,
        payload: {},
      };
      await db.matchEvents.add(finished);
    }
    await db.matches.update(matchId, {
      status: "FINISHED",
      finishedAt: ts,
      updatedAt: ts,
    });
  });
}

/** Re-enter statistics on a finished match without a separate "reopen" flow. */
export async function resumeMatch(matchId: string): Promise<void> {
  await db.matches.update(matchId, { status: "LIVE", updatedAt: nowIso() });
}

function currentPeriodFromEvents(events: readonly MatchEvent[]): Period {
  let period: Period = 1;
  for (const e of sortEvents(events)) {
    if (e.type === "PERIOD_CHANGED") period = e.payload.period as Period;
  }
  return period;
}

/* ============================================================================
 * Events
 * ========================================================================= */

export function listMatchEvents(matchId: string): Promise<MatchEvent[]> {
  return db.matchEvents
    .where("matchId")
    .equals(matchId)
    .toArray()
    .then((rows) => sortEvents(rows));
}

type EventDraft =
  | {
      type: "OWN_GOAL";
      period: Period;
      matchTimeSeconds?: number;
      payload: {
        scorerPlayerId?: string;
        assistPlayerId?: string;
        lineupPlayerIds: string[];
        situation?: GoalSituation;
      };
    }
  | {
      type: "OPPONENT_GOAL";
      period: Period;
      matchTimeSeconds?: number;
      payload: { lineupPlayerIds: string[]; situation?: GoalSituation };
    }
  | {
      type: "SUBSTITUTION";
      period: Period;
      matchTimeSeconds?: number;
      payload: { playerOutId: string; playerInId: string; lineupAfter: string[] };
    }
  | { type: "PERIOD_CHANGED"; period: Period; payload: { period: Period } };

export async function appendEvent(matchId: string, draft: EventDraft): Promise<MatchEvent> {
  return db.transaction("rw", db.matchEvents, async () => {
    const events = await listMatchEvents(matchId);
    const ts = nowIso();
    const base = {
      id: newId(),
      matchId,
      sequence: nextSequence(events),
      source: "MANUAL" as const,
      createdAt: ts,
      updatedAt: ts,
    };
    const event = {
      ...base,
      ...draft,
      matchTimeSeconds: "matchTimeSeconds" in draft ? draft.matchTimeSeconds : undefined,
    } as MatchEvent;
    await db.matchEvents.add(event);
    return event;
  });
}

export async function recordOwnGoal(
  matchId: string,
  args: {
    period: Period;
    matchTimeSeconds?: number;
    lineupPlayerIds: string[];
    scorerPlayerId?: string;
    assistPlayerId?: string;
    situation?: GoalSituation;
  },
): Promise<MatchEvent> {
  assertGoalLineupSize(args.lineupPlayerIds);
  return appendEvent(matchId, {
    type: "OWN_GOAL",
    period: args.period,
    matchTimeSeconds: args.matchTimeSeconds,
    payload: {
      lineupPlayerIds: [...args.lineupPlayerIds],
      scorerPlayerId: args.scorerPlayerId,
      assistPlayerId: args.assistPlayerId,
      situation: args.situation,
    },
  });
}

export async function recordOpponentGoal(
  matchId: string,
  args: {
    period: Period;
    matchTimeSeconds?: number;
    lineupPlayerIds: string[];
    situation?: GoalSituation;
  },
): Promise<MatchEvent> {
  assertGoalLineupSize(args.lineupPlayerIds);
  return appendEvent(matchId, {
    type: "OPPONENT_GOAL",
    period: args.period,
    matchTimeSeconds: args.matchTimeSeconds,
    payload: { lineupPlayerIds: [...args.lineupPlayerIds], situation: args.situation },
  });
}

export async function recordSubstitution(
  matchId: string,
  args: {
    period: Period;
    matchTimeSeconds?: number;
    playerOutId: string;
    playerInId: string;
    lineupAfter: string[];
  },
): Promise<MatchEvent> {
  return appendEvent(matchId, {
    type: "SUBSTITUTION",
    period: args.period,
    matchTimeSeconds: args.matchTimeSeconds,
    payload: {
      playerOutId: args.playerOutId,
      playerInId: args.playerInId,
      lineupAfter: [...args.lineupAfter],
    },
  });
}

export async function changePeriod(matchId: string, period: Period): Promise<MatchEvent> {
  return appendEvent(matchId, {
    type: "PERIOD_CHANGED",
    period,
    payload: { period },
  });
}

export async function updateEvent(
  eventId: string,
  patch: {
    period?: Period;
    matchTimeSeconds?: number;
    payload?: MatchEvent["payload"];
  },
): Promise<void> {
  const event = await db.matchEvents.get(eventId);
  if (!event) throw new Error("Tapahtumaa ei löytynyt.");
  const next: Partial<MatchEvent> = { updatedAt: nowIso() };
  if (patch.period !== undefined) next.period = patch.period;
  if (patch.matchTimeSeconds !== undefined) next.matchTimeSeconds = patch.matchTimeSeconds;
  if (patch.payload !== undefined) {
    if ("lineupPlayerIds" in patch.payload) {
      assertGoalLineupSize(patch.payload.lineupPlayerIds);
    }
    next.payload = patch.payload as MatchEvent["payload"];
  }
  // `sequence` is intentionally never modified (TECHNICAL_SPEC §24).
  await db.matchEvents.update(eventId, next);
}

export async function deleteEvent(eventId: string): Promise<void> {
  await db.transaction("rw", [db.matchEvents, db.tombstones], async () => {
    await db.matchEvents.delete(eventId);
    await recordTombstone("matchEvents", eventId);
  });
}

export async function undoLastEvent(matchId: string): Promise<MatchEvent | undefined> {
  return db.transaction("rw", [db.matchEvents, db.tombstones], async () => {
    const events = await listMatchEvents(matchId);
    const last = events.at(-1);
    if (!last) return undefined;
    await db.matchEvents.delete(last.id);
    await recordTombstone("matchEvents", last.id);
    return last;
  });
}
