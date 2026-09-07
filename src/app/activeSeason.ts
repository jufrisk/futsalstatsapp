/**
 * Which season a device is *looking at* is a per-device choice, not shared data
 * — so it lives in localStorage and never syncs. The player list and match
 * results are shared; the active-season selection is not.
 */
const KEY = "futsal.activeSeasonId";
export const ACTIVE_SEASON_EVENT = "futsal-active-season-changed";

export function getStoredActiveSeasonId(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setStoredActiveSeasonId(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ACTIVE_SEASON_EVENT));
  }
}
