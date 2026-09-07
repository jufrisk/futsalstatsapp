import { format, parseISO } from "date-fns";

/** Stores dates as ISO `yyyy-MM-dd`; displays Finnish `d.M.yyyy`. */

export function todayIsoDate(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function formatFiDate(iso: string): string {
  if (!iso) return "";
  try {
    return format(parseISO(iso), "d.M.yyyy");
  } catch {
    return iso;
  }
}

export function formatFiDateShort(iso: string): string {
  if (!iso) return "";
  try {
    return format(parseISO(iso), "d.M.");
  } catch {
    return iso;
  }
}
