import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/database";
import {
  createMatch,
  createPlayer,
  createSeason,
  ensureBootstrap,
  ensureRosterRows,
  finishMatch,
  getMatchRoster,
  listMatchEvents,
  recordOpponentGoal,
  recordOwnGoal,
  setRosterNumber,
  setRosterSelected,
  startMatch,
  toggleStarter,
  undoLastEvent,
  updateEvent,
} from "@/db/repositories";
import { buildBackup, restoreBackup } from "@/services/backupService";
import { calculateSeasonStatistics } from "@/services/seasonStatisticsEngine";
import { buildMatchState } from "@/services/matchEngine";
import { matchPlayerStatsCsv } from "@/services/exportService";
import { calculateMatchStatistics } from "@/services/statisticsEngine";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function seed() {
  const { team, season } = await ensureBootstrap();
  const sofia = await createPlayer(team.id, 9, "Sofia");
  const emma = await createPlayer(team.id, 7, "Emma");
  const laura = await createPlayer(team.id, 4, "Laura");
  const nina = await createPlayer(team.id, 5); // number-only
  const iida = await createPlayer(team.id, 10, "Iida");
  return { team, season, sofia, emma, laura, nina, iida };
}

describe("players", () => {
  it("creates a number-only player and rejects a missing number", async () => {
    const { team } = await ensureBootstrap();
    const p = await createPlayer(team.id, 14);
    expect(p.number).toBe(14);
    expect(p.name).toBeUndefined();
    await expect(createPlayer(team.id, "")).rejects.toThrow();
  });

  it("rejects a duplicate active jersey number in the same team", async () => {
    const { team } = await ensureBootstrap();
    await createPlayer(team.id, 9, "Sofia");
    await expect(createPlayer(team.id, 9, "Other")).rejects.toThrow();
  });
});

describe("match roster – jersey number inheritance & override", () => {
  it("inherits the player default number, and overriding it does not touch the master record", async () => {
    const { team, season, sofia } = await seed();
    const matchA = await createMatch({
      seasonId: season.id,
      teamId: team.id,
      opponentName: "Team A",
      date: "2026-09-12",
      venue: "HOME",
    });
    await ensureRosterRows(matchA.id, team.id);

    let roster = await getMatchRoster(matchA.id);
    expect(roster.find((mp) => mp.playerId === sofia.id)!.playerNumber).toBe(9);

    // Override just for match A.
    await setRosterNumber(matchA.id, sofia.id, 17);
    roster = await getMatchRoster(matchA.id);
    expect(roster.find((mp) => mp.playerId === sofia.id)!.playerNumber).toBe(17);

    // Master record unchanged.
    expect((await db.players.get(sofia.id))!.number).toBe(9);

    // A brand-new match inherits the default again.
    const matchB = await createMatch({
      seasonId: season.id,
      teamId: team.id,
      opponentName: "Team B",
      date: "2026-09-19",
      venue: "AWAY",
    });
    await ensureRosterRows(matchB.id, team.id);
    const rosterB = await getMatchRoster(matchB.id);
    expect(rosterB.find((mp) => mp.playerId === sofia.id)!.playerNumber).toBe(9);
  });
});

describe("live match flow + persistence", () => {
  async function startedMatch() {
    const s = await seed();
    const match = await createMatch({
      seasonId: s.season.id,
      teamId: s.team.id,
      opponentName: "Team A",
      date: "2026-09-12",
      venue: "HOME",
    });
    await ensureRosterRows(match.id, s.team.id);
    for (const p of [s.sofia, s.emma, s.laura, s.nina, s.iida]) {
      await setRosterSelected(match.id, p.id, true);
      await toggleStarter(match.id, p.id, true);
    }
    await startMatch(match.id);
    return { ...s, match };
  }

  it("start creates a MATCH_STARTED event with the starting five", async () => {
    const { match } = await startedMatch();
    const events = await listMatchEvents(match.id);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("MATCH_STARTED");
    expect((await db.matches.get(match.id))!.status).toBe("LIVE");
  });

  it("records goals immediately and rebuilds identical state after a reload", async () => {
    const { match, sofia, emma } = await startedMatch();
    const lineup = (await getMatchRoster(match.id))
      .filter((mp) => mp.selected)
      .map((mp) => mp.playerId);

    await recordOwnGoal(match.id, {
      period: 1,
      matchTimeSeconds: 454,
      lineupPlayerIds: lineup,
      scorerPlayerId: sofia.id,
      assistPlayerId: emma.id,
    });
    await recordOpponentGoal(match.id, { period: 1, matchTimeSeconds: 738, lineupPlayerIds: lineup });

    // Simulate a browser reload: read everything fresh from IndexedDB.
    const events = await listMatchEvents(match.id);
    const roster = await getMatchRoster(match.id);
    const state = buildMatchState(
      roster.filter((mp) => mp.selected).map((mp) => mp.playerId),
      events,
    );
    expect(state.ownScore).toBe(1);
    expect(state.opponentScore).toBe(1);
    expect(state.playerStats[sofia.id]!.goals).toBe(1);
    expect(state.playerStats[emma.id]!.assists).toBe(1);
  });

  it("undo removes the last event and recalculates", async () => {
    const { match } = await startedMatch();
    const lineup = (await getMatchRoster(match.id))
      .filter((mp) => mp.selected)
      .map((mp) => mp.playerId);
    await recordOwnGoal(match.id, { period: 1, matchTimeSeconds: 100, lineupPlayerIds: lineup });
    await recordOpponentGoal(match.id, { period: 1, matchTimeSeconds: 200, lineupPlayerIds: lineup });

    const removed = await undoLastEvent(match.id);
    expect(removed!.type).toBe("OPPONENT_GOAL");

    const events = await listMatchEvents(match.id);
    const state = buildMatchState(lineup, events);
    expect(state.ownScore).toBe(1);
    expect(state.opponentScore).toBe(0);
  });

  it("rejects a goal with more than five own players on court", async () => {
    const { match } = await startedMatch();
    const five = (await getMatchRoster(match.id))
      .filter((mp) => mp.selected)
      .map((mp) => mp.playerId);
    expect(five).toHaveLength(5);
    const six = [...five, "extra-player-id"];

    await expect(
      recordOwnGoal(match.id, { period: 1, matchTimeSeconds: 100, lineupPlayerIds: six }),
    ).rejects.toThrow(/enintään 5/);
    await expect(
      recordOpponentGoal(match.id, { period: 1, matchTimeSeconds: 100, lineupPlayerIds: six }),
    ).rejects.toThrow(/enintään 5/);

    const goal = await recordOwnGoal(match.id, {
      period: 1,
      matchTimeSeconds: 100,
      lineupPlayerIds: five,
    });
    await expect(
      updateEvent(goal.id, { payload: { lineupPlayerIds: six } }),
    ).rejects.toThrow(/enintään 5/);
  });

  it("editing a finished match's goal updates season statistics automatically", async () => {
    const { match, season, team, sofia, emma } = await startedMatch();
    const lineup = (await getMatchRoster(match.id))
      .filter((mp) => mp.selected)
      .map((mp) => mp.playerId);
    const goal = await recordOwnGoal(match.id, {
      period: 1,
      matchTimeSeconds: 300,
      lineupPlayerIds: lineup,
      scorerPlayerId: sofia.id,
    });
    await finishMatch(match.id);

    const seasonBefore = await aggregateSeason(season.id, team.id);
    expect(seasonBefore.players.find((p) => p.playerId === sofia.id)!.goals).toBe(1);

    // Correction: it was actually Emma's goal.
    await updateEvent(goal.id, {
      period: 1,
      matchTimeSeconds: 300,
      payload: { lineupPlayerIds: lineup, scorerPlayerId: emma.id },
    });

    const seasonAfter = await aggregateSeason(season.id, team.id);
    expect(seasonAfter.players.find((p) => p.playerId === sofia.id)!.goals).toBe(0);
    expect(seasonAfter.players.find((p) => p.playerId === emma.id)!.goals).toBe(1);
  });

  it("match player-stats CSV uses match-specific numbers", async () => {
    const { match, sofia } = await startedMatch();
    await setRosterNumber(match.id, sofia.id, 17);
    const roster = await getMatchRoster(match.id);
    const events = await listMatchEvents(match.id);
    const { rows } = calculateMatchStatistics(roster, events);
    const csv = matchPlayerStatsCsv(rows);
    expect(csv.split("\n")[0]).toBe("number,name,goals,assists,plus,minus,plus_minus");
    expect(csv).toContain("17,Sofia,");
  });
});

describe("backup round-trip", () => {
  it("exports and restores all data", async () => {
    const { season, team } = await seed();
    await createSeason("2027–28", false);
    const match = await createMatch({
      seasonId: season.id,
      teamId: team.id,
      opponentName: "Team X",
      date: "2026-10-01",
      venue: "HOME",
    });
    await ensureRosterRows(match.id, team.id);

    const backup = await buildBackup();
    await db.delete();
    await db.open();
    expect(await db.players.count()).toBe(0);

    const result = await restoreBackup(JSON.parse(JSON.stringify(backup)), "replace");
    expect(result.counts.players).toBe(5);
    expect(await db.matches.count()).toBe(1);
    expect(await db.seasons.count()).toBe(2);
  });
});

async function aggregateSeason(seasonId: string, teamId: string) {
  const matches = await db.matches.where("seasonId").equals(seasonId).toArray();
  const bundles = [];
  for (const m of matches) {
    bundles.push({
      match: m,
      matchPlayers: await db.matchPlayers.where("matchId").equals(m.id).toArray(),
      events: (await db.matchEvents.where("matchId").equals(m.id).toArray()).sort(
        (a, b) => a.sequence - b.sequence,
      ),
    });
  }
  const players = await db.players.where("teamId").equals(teamId).toArray();
  return calculateSeasonStatistics(bundles, players);
}
