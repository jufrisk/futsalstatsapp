import { db, ALL_TABLES } from "@/db/database";
import { syncConfigured, getSupabase, APP_STATE_TABLE } from "./supabaseClient";
import { pullRemote, pushRemote } from "./remoteStore";
import { buildLocalSnapshot, applySnapshot } from "./snapshot";
import { mergeSnapshots, snapshotsEqual } from "./merge";

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

  // Local writes → debounced push.
  for (const table of [...ALL_TABLES, db.tombstones]) {
    table.hook("creating", () => scheduleSync());
    table.hook("updating", () => scheduleSync());
    table.hook("deleting", () => scheduleSync());
  }

  // Other devices' writes → near-immediate pull (free realtime tier).
  const supabase = getSupabase();
  supabase
    ?.channel("app_state_changes")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: APP_STATE_TABLE },
      () => scheduleSync(300),
    )
    .subscribe();

  // Fallbacks: periodic, on focus, on reconnect.
  setInterval(() => void runSync(), 60_000);
  if (typeof window !== "undefined") {
    window.addEventListener("focus", () => scheduleSync(300));
    window.addEventListener("online", () => scheduleSync(300));
  }

  void runSync();
}
