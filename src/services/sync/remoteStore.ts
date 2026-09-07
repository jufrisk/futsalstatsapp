import { APP_STATE_ID, APP_STATE_TABLE, getSupabase } from "./supabaseClient";
import type { SyncSnapshot } from "./types";
import { emptySnapshot } from "./types";

export interface RemoteState {
  version: number;
  snapshot: SyncSnapshot;
}

function coerceSnapshot(data: unknown): SyncSnapshot {
  const base = emptySnapshot();
  if (!data || typeof data !== "object") return base;
  const d = data as Partial<SyncSnapshot>;
  return {
    schemaVersion: 1,
    tables: { ...base.tables, ...(d.tables ?? {}) },
    tombstones: d.tombstones ?? {},
  };
}

/** Read the shared document. Creates the row on first use. Returns null if sync is off. */
export async function pullRemote(): Promise<RemoteState | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from(APP_STATE_TABLE)
    .select("version,data")
    .eq("id", APP_STATE_ID)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const empty = emptySnapshot();
    const { error: insertError } = await supabase
      .from(APP_STATE_TABLE)
      .insert({ id: APP_STATE_ID, version: 0, data: empty });
    // A concurrent insert from another device is fine — re-read below.
    if (insertError && insertError.code !== "23505") throw insertError;
    return { version: 0, snapshot: empty };
  }

  return {
    version: Number((data as { version: number }).version) || 0,
    snapshot: coerceSnapshot((data as { data: unknown }).data),
  };
}

export interface PushResult {
  ok: boolean;
  version: number;
}

/**
 * Optimistic write: only succeeds if the row is still at `baseVersion`
 * (nobody else pushed in the meantime).
 */
export async function pushRemote(
  baseVersion: number,
  snapshot: SyncSnapshot,
): Promise<PushResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, version: baseVersion };

  const nextVersion = baseVersion + 1;
  const { data, error } = await supabase
    .from(APP_STATE_TABLE)
    .update({
      version: nextVersion,
      data: snapshot,
      updated_at: new Date().toISOString(),
    })
    .eq("id", APP_STATE_ID)
    .eq("version", baseVersion)
    .select("version");

  if (error) throw error;
  const updated = Array.isArray(data) && data.length === 1;
  return { ok: updated, version: updated ? nextVersion : baseVersion };
}
