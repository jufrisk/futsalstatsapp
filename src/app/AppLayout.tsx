import { NavLink, Outlet } from "react-router-dom";
import { useOnlineStatus } from "./hooks";

const navItems = [
  { to: "/", label: "Ottelut", end: true },
  { to: "/players", label: "Pelaajat", end: false },
  { to: "/season", label: "Kausi", end: false },
];

export function AppLayout() {
  const online = useOnlineStatus();

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-4 py-3 backdrop-blur">
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

      {!online && (
        <div className="bg-slate-800 px-4 py-1.5 text-center text-xs text-slate-300">
          Offline – kaikki tallentuu laitteelle
        </div>
      )}

      <main className="flex-1 px-4 py-5">
        <Outlet />
      </main>
    </div>
  );
}
