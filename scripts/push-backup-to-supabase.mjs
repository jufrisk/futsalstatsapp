/**
 * Push a Futsal Stats backup JSON (the format written by "Varmuuskopioi kaikki"
 * or by scripts/import-torneopal.mjs) directly into the shared Supabase
 * database, without going through the app's UI.
 *
 * Safe to re-run: uses the exact same last-write-wins-by-`updatedAt` merge the
 * app itself uses (src/services/sync/merge.ts), so it never blindly overwrites
 * newer data already in the cloud — it only adds/updates rows that are newer
 * than what's there.
 *
 * Usage:
 *   node scripts/push-backup-to-supabase.mjs [path-to-backup.json]
 *   node scripts/push-backup-to-supabase.mjs --dry-run [path-to-backup.json]
 *
 * Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env in the project
 * root (or the real environment, which takes precedence).
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

/* ------------------------------------------------------------- args ---- */
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const backupPath = resolve(args.find((a) => !a.startsWith("--")) ?? "torneopal-import.json");

/* --------------------------------------------------------- load .env ---- */
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, key, rawVal] = m;
    if (process.env[key] !== undefined) continue; // real env wins
    process.env[key] = rawVal.replace(/^["']|["']$/g, "");
  }
}
loadEnvFile(resolve(ROOT, ".env"));

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (checked .env and the environment).",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

/* -------------------------------------------------------- backup file --- */
if (!existsSync(backupPath)) {
  console.error(`Backup file not found: ${backupPath}`);
  process.exit(1);
}
const backup = JSON.parse(readFileSync(backupPath, "utf8"));
for (const key of ["seasons", "teams", "players", "matches", "matchPlayers", "matchEvents"]) {
  if (!Array.isArray(backup[key])) backup[key] = [];
}
console.log(
  `Backup "${backupPath}": ${backup.seasons.length} season(s), ${backup.teams.length} team(s), ` +
    `${backup.players.length} player(s), ${backup.matches.length} match(es), ` +
    `${backup.matchPlayers.length} matchPlayer row(s), ${backup.matchEvents.length} matchEvent(s).`,
);

/* --------------------------------------------- same merge as the app ---- */
const SNAPSHOT_TABLES = ["seasons", "teams", "matches", "matchPlayers", "matchEvents"];

function recordTime(r) {
  return r.updatedAt ?? r.createdAt ?? "";
}

function newer(a, b) {
  if (!a) return b;
  if (!b) return a;
  return recordTime(a) > recordTime(b) ? a : b;
}

function laterIso(a, b) {
  if (a == null) return b;
  if (b == null) return a;
  return a >= b ? a : b;
}

/** Identical algorithm to src/services/sync/merge.ts#mergeSnapshots. */
function mergeSnapshots(local, remote) {
  const out = { schemaVersion: 1, tables: {}, tombstones: {} };

  for (const table of SNAPSHOT_TABLES) {
    const lRows = local.tables[table] ?? [];
    const rRows = remote.tables[table] ?? [];
    const lById = new Map(lRows.map((r) => [r.id, r]));
    const rById = new Map(rRows.map((r) => [r.id, r]));

    const lTomb = local.tombstones[table] ?? {};
    const rTomb = remote.tombstones[table] ?? {};

    const ids = new Set([
      ...lById.keys(),
      ...rById.keys(),
      ...Object.keys(lTomb),
      ...Object.keys(rTomb),
    ]);

    const mergedRows = [];
    const mergedTomb = {};

    for (const id of ids) {
      const winner = newer(lById.get(id), rById.get(id));
      const tomb = laterIso(lTomb[id], rTomb[id]);

      if (winner && (!tomb || recordTime(winner) > tomb)) {
        mergedRows.push(winner);
      } else if (tomb) {
        mergedTomb[id] = tomb;
      }
    }

    mergedRows.sort((a, b) => a.id.localeCompare(b.id));
    out.tables[table] = mergedRows;
    if (Object.keys(mergedTomb).length > 0) out.tombstones[table] = mergedTomb;
  }

  return out;
}

function emptySnapshot() {
  return {
    schemaVersion: 1,
    tables: { seasons: [], teams: [], matches: [], matchPlayers: [], matchEvents: [] },
    tombstones: {},
  };
}

/* ------------------------------------------------------------- players -- */
async function pushPlayers(players) {
  if (players.length === 0) return;

  const { data: remote, error: pullErr } = await supabase
    .from("players")
    .select("id,teamId,number,name,active,createdAt,updatedAt,deletedAt");
  if (pullErr) throw pullErr;

  const byId = new Map((remote ?? []).map((p) => [p.id, p]));
  const toWrite = [];
  for (const p of players) {
    const existing = byId.get(p.id);
    if (!existing || recordTime(p) > recordTime(existing)) {
      toWrite.push({
        id: p.id,
        teamId: p.teamId,
        number: p.number,
        name: p.name ?? null,
        active: p.active,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        deletedAt: p.deletedAt ?? null,
      });
    }
  }

  console.log(`players: ${toWrite.length} new/updated row(s) (of ${players.length} in backup).`);
  if (toWrite.length === 0 || DRY_RUN) return;

  const { error } = await supabase.from("players").upsert(toWrite, { onConflict: "id" });
  if (error) throw error;
}

/* ----------------------------------------------------------- app_state -- */
async function pushAppState(local) {
  const MAX_RETRIES = 6;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { data, error } = await supabase
      .from("app_state")
      .select("version,data")
      .eq("id", "main")
      .maybeSingle();
    if (error) throw error;

    let baseVersion = 0;
    let remoteSnapshot = emptySnapshot();
    if (!data) {
      const { error: insertError } = await supabase
        .from("app_state")
        .insert({ id: "main", version: 0, data: emptySnapshot() });
      if (insertError && insertError.code !== "23505") throw insertError;
    } else {
      baseVersion = Number(data.version) || 0;
      remoteSnapshot = {
        schemaVersion: 1,
        tables: { ...emptySnapshot().tables, ...(data.data?.tables ?? {}) },
        tombstones: data.data?.tombstones ?? {},
      };
    }

    const merged = mergeSnapshots(local, remoteSnapshot);

    for (const table of SNAPSHOT_TABLES) {
      const before = remoteSnapshot.tables[table]?.length ?? 0;
      const after = merged.tables[table]?.length ?? 0;
      if (after !== before) console.log(`${table}: ${before} -> ${after} row(s) in the cloud.`);
    }

    if (JSON.stringify(merged) === JSON.stringify(remoteSnapshot)) {
      console.log("app_state: nothing new to push (cloud already has everything, or is newer).");
      return;
    }

    if (DRY_RUN) {
      console.log("(dry run — not writing)");
      return;
    }

    const nextVersion = baseVersion + 1;
    const { data: updated, error: updateError } = await supabase
      .from("app_state")
      .update({ version: nextVersion, data: merged, updated_at: new Date().toISOString() })
      .eq("id", "main")
      .eq("version", baseVersion)
      .select("version");
    if (updateError) throw updateError;

    if (Array.isArray(updated) && updated.length === 1) {
      console.log(`app_state: pushed as version ${nextVersion}.`);
      return;
    }
    console.log("app_state: concurrent write detected, retrying merge...");
  }
  throw new Error("Gave up after too many concurrent-write retries.");
}

/* ------------------------------------------------------------------ run - */
const local = {
  schemaVersion: 1,
  tables: {
    seasons: backup.seasons,
    teams: backup.teams,
    matches: backup.matches,
    matchPlayers: backup.matchPlayers,
    matchEvents: backup.matchEvents,
  },
  tombstones: {},
};

if (DRY_RUN) console.log("--dry-run: no writes will be made.\n");

await pushPlayers(backup.players);
await pushAppState(local);

console.log("Done.");
