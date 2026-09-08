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

      <main className="flex-1 px-4 pb-12 pt-4">
        <Outlet />
      </main>

      <StatusBar />
    </div>
  );
}

/** Thin, muted strip pinned to the bottom — easy to ignore. */
function StatusBar() {
  const { unlocked } = useAdmin();
  const online = useOnlineStatus();
  const status = useSyncStatus();

  let syncText: string | null = null;
  let dot = "bg-slate-600";
  if (!online) {
    syncText = "Offline – tallentuu laitteelle";
    dot = "bg-amber-500";
  } else if (!syncConfigured) {
    syncText = "Vain tässä laitteessa";
  } else if (status.state === "syncing") {
    syncText = "Synkronoidaan…";
    dot = "bg-sky-500";
  } else if (status.state === "offline") {
    syncText = "Ei yhteyttä";
    dot = "bg-amber-500";
  } else if (status.state === "error") {
    syncText = "Synkronointivirhe";
    dot = "bg-amber-500";
  } else if (status.lastSyncedAt) {
    syncText = `Synkronoitu ${new Date(status.lastSyncedAt).toLocaleTimeString("fi-FI", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
    dot = "bg-emerald-600";
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 border-t border-slate-800/70 bg-slate-950/85 px-4 py-1 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between text-[11px] text-slate-500">
        <span>{unlocked ? "🔓 muokkaus auki" : "🔒 muokkaus lukittu"}</span>
        {syncText && (
          <button
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 hover:text-slate-300"
            onClick={() => void forceSync()}
            title="Päivitä nyt"
            data-testid="sync-refresh"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
            {syncText}
          </button>
        )}
      </div>
    </div>
  );
}
