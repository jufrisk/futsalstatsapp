import type { Player } from "@/domain/types";
import { getSupabase } from "./supabaseClient";

/**
 * Players are shared reference data, so they get their own Postgres table
 * (`public.players`) rather than living inside the `app_state` JSON document.
 * Column names are camelCase (quoted) to match the domain model 1:1 — no
 * mapping layer. Deletion is a soft delete via `deletedAt`.
 */

const TABLE = "players";
const COLUMNS = 'id,teamId,number,name,active,createdAt,updatedAt,deletedAt';

function recTime(p: Player): string {
  return p.updatedAt ?? p.createdAt ?? "";
}

/** Per-player last-write-wins by `updatedAt`; `deletedAt` is just a field. */
export function mergePlayers(local: readonly Player[], remote: readonly Player[]): Player[] {
  const byId = new Map<string, Player>();
  for (const p of remote) byId.set(p.id, p);
  for (const p of local) {
    const existing = byId.get(p.id);
    if (!existing || recTime(p) > recTime(existing)) byId.set(p.id, p);
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export async function pullPlayers(): Promise<Player[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from(TABLE).select(COLUMNS);
  if (error) throw error;
  return (data ?? []).map((row) => normalize(row as Record<string, unknown>));
}

export async function pushPlayers(players: readonly Player[]): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || players.length === 0) return;
  const { error } = await supabase.from(TABLE).upsert(
    players.map((p) => ({
      id: p.id,
      teamId: p.teamId,
      number: p.number,
      name: p.name ?? null,
      active: p.active,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      deletedAt: p.deletedAt ?? null,
    })),
    { onConflict: "id" },
  );
  if (error) throw error;
}

function normalize(row: Record<string, unknown>): Player {
  return {
    id: String(row.id),
    teamId: String(row.teamId),
    number: Number(row.number),
    name: row.name == null ? undefined : String(row.name),
    active: Boolean(row.active),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
    deletedAt: row.deletedAt == null ? undefined : String(row.deletedAt),
  };
}
