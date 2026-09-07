/**
 * One-time import of Palloliitto / Torneopal data into a Futsal Stats backup.
 *
 * Pulls a competition's fixture list and one team's player list from the public
 * Torneopal widget endpoint (no server, just the club's widget key), and writes
 * a JSON file you load in the app via  Asetukset -> Palauta varmuuskopio.
 *
 * Usage:
 *   node scripts/import-torneopal.mjs [options]
 *
 *   --key <k>           Torneopal widget key            (default: ZII8EUB4Q3)
 *   --team-id <id>      Torneopal team id                (default: 59586  = GFT)
 *   --team-name <name>  team name as it appears in the fixture list, used to
 *                       pick this team's matches         (default: GFT)
 *   --competition <id>  competition id                   (default: splfs2627)
 *   --class <c>         class                            (default: FNL)
 *   --group <g>         group                            (default: 6)
 *   --season-name <n>   season label if creating one     (default: 2026-27)
 *   --base <path>       existing backup (from "Varmuuskopioi kaikki"); the
 *                       import is merged into it and its team/season ids are
 *                       reused. RECOMMENDED if the app already has data.
 *   --out <path>        output file                      (default: torneopal-import.json)
 *   --flip-names        store names as "First Last" instead of "Last First"
 *   --no-results        import every match as DRAFT (don't synthesise score events)
 *
 * Re-running is safe: ids are deterministic, so a second run updates the same
 * records (e.g. fills in results) rather than duplicating them.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

/* --------------------------------------------------------------- args ---- */
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : def;
};
const flag = (name) => args.includes(`--${name}`);

const KEY = process.env.TORNEOPAL_KEY || opt("key", "ZII8EUB4Q3");
const TEAM_ID = opt("team-id", "59586");
const TEAM_NAME = opt("team-name", "GFT");
const COMPETITION = opt("competition", "splfs2627");
const CLASS = opt("class", "FNL");
const GROUP = opt("group", "6");
const SEASON_NAME = opt("season-name", "2026–27");
const BASE_PATH = opt("base", null);
const OUT_PATH = opt("out", "torneopal-import.json");
const FLIP_NAMES = flag("flip-names");
const SYNTH_RESULTS = !flag("no-results");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

/* --------------------------------------------------------- helpers ------ */
const NS = "1b671a64-40d5-491e-99b0-da01ff1f3341"; // fixed namespace
function uuidv5(name) {
  const nsBytes = Buffer.from(NS.replace(/-/g, ""), "hex");
  const h = createHash("sha1").update(nsBytes).update(Buffer.from(name, "utf8")).digest();
  const b = h.subarray(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const x = b.toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}
const nowIso = () => new Date().toISOString();

async function widget(spec) {
  const url =
    "https://spl.torneopal.fi/torneopal/ajax/%5Btorneopal:" + spec + "&key=" + KEY + "%5D";
  const res = await fetch(url, { headers: { "User-Agent": UA, Referer: "https://gft.fi/" } });
  if (!res.ok) throw new Error(`${spec}: HTTP ${res.status}`);
  return res.text();
}

function extractInnerHtml(js) {
  const i = js.indexOf('div.innerHTML = "');
  if (i < 0) return js;
  const rest = js.slice(i + 'div.innerHTML = "'.length);
  let out = "";
  for (let k = 0; k < rest.length; k++) {
    const c = rest[k];
    if (c === "\\") {
      const n = rest[++k];
      out += n === "n" ? "\n" : n === "t" ? "\t" : n;
      continue;
    }
    if (c === '"') break;
    out += c;
  }
  return out;
}
const strip = (s) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
const rowsOf = (html) =>
  [...html.replace(/<script[\s\S]*?<\/script>/g, "").matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) =>
    [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => strip(c[1])),
  );

function toIsoDate(fi) {
  const m = fi.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}
function parseScore(s) {
  const m = s && s.match(/(\d+)\s*[–\-]\s*(\d+)/);
  return m ? { home: +m[1], away: +m[2] } : null;
}
function flipName(n) {
  const parts = n.trim().split(/\s+/);
  if (parts.length < 2) return n;
  return [parts.slice(1).join(" "), parts[0]].join(" ");
}

/* --------------------------------------------------------- fetch -------- */
console.log(`Torneopal import — ${TEAM_NAME} (team ${TEAM_ID}), ${COMPETITION}/${CLASS}/${GROUP}`);

const scheduleJs = await widget(
  `schedule:competition=${COMPETITION}&class=${CLASS}&group=${GROUP}`,
);
const playersJs = await widget(`team_players:team=${TEAM_ID}`);

/* --------------------------------------------------------- parse ------- */
const schedRows = rowsOf(extractInnerHtml(scheduleJs)).filter(
  (c) => c.length >= 7 && /^\d+$/.test(c[0]),
);
const playerRows = rowsOf(extractInnerHtml(playersJs)).filter(
  (c) => c.length === 7 && /^\d+$/.test(c[0]),
);

if (schedRows.length === 0) throw new Error("No fixtures parsed — widget markup may have changed.");
if (playerRows.length === 0) throw new Error("No players parsed — check --team-id.");

const teamKey = TEAM_NAME.toLowerCase();
const myFixtures = schedRows.filter(
  (c) => c[4].toLowerCase() === teamKey || c[5].toLowerCase() === teamKey,
);
console.log(
  `Fixtures: ${schedRows.length} in group, ${myFixtures.length} involving ${TEAM_NAME}`,
);
console.log(`Players: ${playerRows.length}`);

/* --------------------------------------------------------- build ------- */
let backup;
if (BASE_PATH) {
  backup = JSON.parse(readFileSync(BASE_PATH, "utf8"));
  for (const k of ["seasons", "teams", "players", "matches", "matchPlayers", "matchEvents"]) {
    backup[k] = Array.isArray(backup[k]) ? backup[k] : [];
  }
  if (backup.teams.length === 0 || backup.seasons.length === 0) {
    throw new Error("--base backup has no team/season. Open the app once, then export again.");
  }
} else {
  backup = {
    schemaVersion: 1,
    exportedAt: nowIso(),
    seasons: [],
    teams: [],
    players: [],
    matches: [],
    matchPlayers: [],
    matchEvents: [],
  };
}

const ts = nowIso();

// team + season
let team = backup.teams[0];
if (!team) {
  team = { id: uuidv5(`team:${TEAM_ID}`), name: TEAM_NAME, createdAt: ts, updatedAt: ts };
  backup.teams.push(team);
}
let season = backup.seasons.find((s) => s.active) || backup.seasons[0];
if (!season) {
  season = {
    id: uuidv5(`season:${COMPETITION}`),
    name: SEASON_NAME,
    active: true,
    createdAt: ts,
    updatedAt: ts,
  };
  backup.seasons.push(season);
}

// players
const playerById = new Map(backup.players.map((p) => [p.id, p]));
let addedP = 0;
let updatedP = 0;
for (const c of playerRows) {
  const number = parseInt(c[0], 10);
  let name = c[1];
  if (FLIP_NAMES) name = flipName(name);
  const id = uuidv5(`player:${TEAM_ID}:${number}`);
  const existing = playerById.get(id);
  if (existing) {
    existing.number = number;
    existing.name = name || undefined;
    existing.active = true;
    existing.deletedAt = undefined;
    existing.updatedAt = ts;
    existing.externalPlayerId = `torneopal:${TEAM_ID}:${number}`;
    updatedP++;
  } else {
    backup.players.push({
      id,
      teamId: team.id,
      number,
      name: name || undefined,
      active: true,
      createdAt: ts,
      updatedAt: ts,
      externalPlayerId: `torneopal:${TEAM_ID}:${number}`,
    });
    addedP++;
  }
}

// matches
const matchById = new Map(backup.matches.map((m) => [m.id, m]));
const matchByExt = new Map(
  backup.matches.filter((m) => m.externalMatchId).map((m) => [m.externalMatchId, m]),
);
let addedM = 0;
let updatedM = 0;
let synthEvents = 0;

for (const c of myFixtures) {
  // columns: Nro | Pvm | Klo | Kenttä | Koti | Vieras | Tulos
  const nro = c[0];
  const koti = c[4];
  const vieras = c[5];
  const tulos = c[6];
  const date = toIsoDate(c[1]);
  if (!date) continue;
  const isHome = koti.toLowerCase() === teamKey;
  const opponent = isHome ? vieras : koti;
  const score = parseScore(tulos);
  const id = uuidv5(`match:${nro}`);
  const existing = matchById.get(id) || matchByExt.get(nro);

  const finished = SYNTH_RESULTS && score;
  const status = finished ? "FINISHED" : "DRAFT";

  const base = {
    id,
    seasonId: season.id,
    teamId: team.id,
    opponentName: opponent,
    date,
    venue: isHome ? "HOME" : "AWAY",
    status,
    source: "PALLOLIITTO",
    externalMatchId: nro,
    updatedAt: ts,
    ...(finished ? { finishedAt: ts } : {}),
  };

  if (existing) {
    Object.assign(existing, base, { createdAt: existing.createdAt });
    updatedM++;
  } else {
    backup.matches.push({ ...base, createdAt: ts });
    addedM++;
  }

  // synthesise score-only events for played matches (source PALLOLIITTO),
  // leaving any manually-recorded events untouched.
  const targetId = existing ? existing.id : id;
  backup.matchEvents = backup.matchEvents.filter(
    (e) => !(e.matchId === targetId && e.source === "PALLOLIITTO"),
  );
  if (finished) {
    const ownGoals = isHome ? score.home : score.away;
    const oppGoals = isHome ? score.away : score.home;
    let seq = 1;
    const mk = (type, extra) => ({
      id: uuidv5(`event:${nro}:${type}:${seq}`),
      matchId: targetId,
      type,
      sequence: seq++,
      period: 1,
      source: "PALLOLIITTO",
      createdAt: ts,
      updatedAt: ts,
      ...extra,
    });
    for (let i = 0; i < ownGoals; i++)
      backup.matchEvents.push(mk("OWN_GOAL", { payload: { lineupPlayerIds: [] } }));
    for (let i = 0; i < oppGoals; i++)
      backup.matchEvents.push(mk("OPPONENT_GOAL", { payload: { lineupPlayerIds: [] } }));
    backup.matchEvents.push(mk("MATCH_FINISHED", { period: 1, payload: {} }));
    synthEvents += ownGoals + oppGoals + 1;
  }
}

backup.exportedAt = nowIso();
writeFileSync(OUT_PATH, JSON.stringify(backup, null, 2));

/* --------------------------------------------------------- report ----- */
console.log("");
console.log(`  players : +${addedP} new, ~${updatedP} updated`);
console.log(`  matches : +${addedM} new, ~${updatedM} updated`);
if (SYNTH_RESULTS) console.log(`  events  : ${synthEvents} synthesised from known results`);
console.log("");
console.log(`Wrote ${OUT_PATH}`);
console.log(
  BASE_PATH
    ? 'Load it in the app:  Asetukset -> Palauta varmuuskopio -> "Korvaa kaikki"'
    : 'Load it in the app:  Asetukset -> Palauta varmuuskopio -> "Yhdistä" (or "Korvaa kaikki" on a fresh install)',
);
