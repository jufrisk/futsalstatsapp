import type { MatchPlayer, Player } from "./types";

/**
 * Player label rules (TECHNICAL_SPEC §48):
 *  - never require a name
 *  - never hide the jersey number in match-related UI
 *  - `#9 Sofia` when a name exists, `#9` otherwise
 */
export function formatPlayerLabel(number: number, name?: string): string {
  const trimmed = name?.trim();
  return trimmed ? `#${number} ${trimmed}` : `#${number}`;
}

export function playerLabel(player: Pick<Player, "number" | "name">): string {
  return formatPlayerLabel(player.number, player.name);
}

/** Match-scoped label — always resolves the jersey number from the snapshot. */
export function matchPlayerLabel(mp: Pick<MatchPlayer, "playerNumber" | "playerName">): string {
  return formatPlayerLabel(mp.playerNumber, mp.playerName);
}

export function shortName(name?: string): string {
  return name?.trim() ?? "";
}
