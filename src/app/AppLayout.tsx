import { NavLink, Outlet } from "react-router-dom";
import { useOnlineStatus } from "./hooks";
import { useSyncStatus } from "./useSync";
import { useAdmin } from "./adminAuth";
import { forceSync, syncConfigured } from "@/services/sync";

const navItems = [
  { to: "/", label: "Ottelut", end: true },
  { to: "/players", label: "Pelaajat", end: false },
  { to: "/season", label: "Kausi", end: false },
];

export function AppLayout() {
  const online = useOnlineStatus();

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚽</span>
          <span className="font-bold tracking-tight">Futsal Stats</span>
        </div>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  "rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                  isActive ? "bg-slate-800 text-slate-50" : "text-slate-400 hover:text-slate-200",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              [
                "ml-1 rounded-lg px-2 py-2 text-base transition-colors",
                isActive ? "bg-slate-800 text-slate-50" : "text-slate-400 hover:text-slate-200",
              ].join(" ")
            }
            aria-label="Asetukset"
          >
            ⚙️
          </NavLink>
        </nav>
      </header>

      <div className="flex items-center justify-between gap-2 px-4 py-1.5 text-xs text-slate-400">
        <AdminBadge />
        <div className="flex items-center gap-2">
          {!online && <span>Offline – tallentuu laitteelle</span>}
          <SyncPill />
        </div>
      </div>

      <main className="flex-1 px-4 pb-6 pt-2">
        <Outlet />
      </main>
    </div>
  );
}

function AdminBadge() {
  const { unlocked } = useAdmin();
  return (
    <span className="inline-flex items-center gap-1">
      {unlocked ? "🔓 Muokkaus avattu" : "🔒 Muokkaus lukittu"}
    </span>
  );
}

function SyncPill() {
  const status = useSyncStatus();
  if (!syncConfigured) return <span>Vain tässä laitteessa</span>;

  const label =
    status.state === "syncing"
      ? "Synkronoidaan…"
      : status.state === "offline"
        ? "Ei yhteyttä – yritetään uudelleen"
        : status.state === "error"
          ? "Synkronointivirhe"
          : status.lastSyncedAt
            ? `Synkronoitu ${new Date(status.lastSyncedAt).toLocaleTimeString("fi-FI", {
                hour: "2-digit",
                minute: "2-digit",
              })}`
            : "Yhdistetty";

  return (
    <button
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-slate-800"
      onClick={() => void forceSync()}
      title="Päivitä nyt"
      data-testid="sync-refresh"
    >
      <span
        className={[
          "h-1.5 w-1.5 rounded-full",
          status.state === "syncing"
            ? "animate-pulse bg-sky-400"
            : status.state === "offline" || status.state === "error"
              ? "bg-amber-400"
              : "bg-emerald-400",
        ].join(" ")}
      />
      {label}
    </button>
  );
}
