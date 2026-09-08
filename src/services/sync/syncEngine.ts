import { db, ALL_TABLES } from "@/db/database";
import { syncConfigured } from "./supabaseClient";
import { pullRemote, pushRemote } from "./remoteStore";
import { buildLocalSnapshot, applySnapshot } from "./snapshot";
import { mergeSnapshots, snapshotsEqual } from "./merge";
import { mergePlayers, pullPlayers, pushPlayers } from "./players";

export type SyncState = "disabled" | "idle" | "syncing" | "offline" | "error";

export interface SyncStatus {
  state: SyncState;
  lastSyncedAt: number | null;
  lastError: string | null;
}

let status: SyncStatus = {
  state: syncConfigured ? "idle" : "disabled",
  lastSyncedAt: null,
  lastError: null,
};

const listeners = new Set<() => void>();

export function getSyncStatus(): SyncStatus {
  return status;
}

export function subscribeSyncStatus(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((fn) => fn());
}

/* ------------------------------------------------------------------------- */

let running = false;
let rerun = false;
let applyingRemote = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

const MAX_PUSH_RETRIES = 6;

function looksOffline(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /fetch|network|Failed to fetch|timeout|ECONN|NetworkError/i.test(msg);
}

/** Pull → merge → apply locally → push if we hold newer data. */
export async function runSync(): Promise<void> {
  if (!syncConfigured) return;
  if (running) {
    rerun = true;
    return;
  }
  running = true;
  setStatus({ state: "syncing" });

  try {
    // 1. Players — their own Postgres table.
    await syncPlayers();

    // 2. Everything else — the shared JSON document.
    let attempt = 0;
    // Retry loop handles a concurrent push landing between our pull and push.
    while (attempt < MAX_PUSH_RETRIES) {
      attempt += 1;
      const remote = await pullRemote();
      if (!remote) break;

      const local = await buildLocalSnapshot();
      const merged = mergeSnapshots(local, remote.snapshot);

      applyingRemote = true;
      try {
        await applySnapshot(merged);
      } finally {
        applyingRemote = false;
      }

      if (snapshotsEqual(merged, remote.snapshot)) break; // nothing new to publish

      const res = await pushRemote(remote.version, merged);
      if (res.ok) break;
      // Conflict — someone else pushed; loop and re-merge.
    }

    setStatus({ state: "idle", lastSyncedAt: Date.now(), lastError: null });
  } catch (err) {
    if (looksOffline(err)) {
      setStatus({ state: "offline", lastError: null });
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[sync] failed", err);
      setStatus({ state: "error", lastError: msg });
    }
  } finally {
    running = false;
    if (rerun) {
      rerun = false;
      void runSync();
    }
  }
}

/** Pull the players table, merge with local, apply, and push what's newer here. */
async function syncPlayers(): Promise<void> {
  const remotePlayers = await pullPlayers();
  if (!remotePlayers) return;

  const localPlayers = await db.players.toArray();
  const merged = mergePlayers(localPlayers, remotePlayers);

  applyingRemote = true;
  try {
    const localById = new Map(localPlayers.map((p) => [p.id, JSON.stringify(p)]));
    const changed = merged.filter((p) => localById.get(p.id) !== JSON.stringify(p));
    if (changed.length > 0) await db.players.bulkPut(merged);
  } finally {
    applyingRemote = false;
  }

  const remoteById = new Map(remotePlayers.map((p) => [p.id, p]));
  const toPush = merged.filter((p) => {
    const r = remoteById.get(p.id);
    return !r || (p.updatedAt ?? "") > (r.updatedAt ?? "");
  });
  if (toPush.length > 0) await pushPlayers(toPush);
}

export function scheduleSync(delayMs = 1500): void {
  if (!syncConfigured || applyingRemote) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void runSync();
  }, delayMs);
}

/** Manual "refresh now" (pull-to-refresh / button). */
export function forceSync(): Promise<void> {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  return runSync();
}

/** Repositories call this after a local mutation. */
export function notifyLocalChange(): void {
  scheduleSync(1500);
}

export function startSync(): void {
  if (started) return;
  started = true;
  if (!syncConfigured) {
    setStatus({ state: "disabled" });
    return;
  }

  // Your own edits still get pushed out (debounced) so nothing is stranded on
  // one device — but there is no realtime subscription and no polling loop.
  for (const table of [...ALL_TABLES, db.tombstones]) {
    table.hook("creating", () => scheduleSync());
    table.hook("updating", () => scheduleSync());
    table.hook("deleting", () => scheduleSync());
  }

  // Pull other devices' changes only at natural "refresh" moments: opening the
  // app, bringing the tab back into focus, reconnecting, or tapping the status
  // bar. (A left-open device won't auto-refresh; that's intentional.)
  if (typeof window !== "undefined") {
    window.addEventListener("focus", () => scheduleSync(300));
    window.addEventListener("online", () => scheduleSync(300));
  }

  void runSync();
}
