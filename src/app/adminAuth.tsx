import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Modal } from "@/components/Modal";

/**
 * Shared team secret that gates edits to the player list and to finished-match
 * results. This is a client-side gate only — it hides/blocks the edit controls
 * on a device until entered, and is remembered on that device. It is not
 * server-enforced, so it keeps honest people honest rather than being real auth.
 */
const ADMIN_PASSWORD = "MuutaTuloksia";
const STORAGE_KEY = "futsal.adminUnlocked";

interface AdminApi {
  unlocked: boolean;
  lock: () => void;
  /** Resolves true if already unlocked, or if the user types the right password. */
  ensureAdmin: () => Promise<boolean>;
}

const AdminContext = createContext<AdminApi | null>(null);

function readPersisted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(readPersisted);
  const [prompting, setPrompting] = useState(false);
  const [entry, setEntry] = useState("");
  const [error, setError] = useState<string | null>(null);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  const persist = (value: boolean) => {
    try {
      if (value) localStorage.setItem(STORAGE_KEY, "1");
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const lock = useCallback(() => {
    setUnlocked(false);
    persist(false);
  }, []);

  const ensureAdmin = useCallback((): Promise<boolean> => {
    if (unlocked) return Promise.resolve(true);
    setEntry("");
    setError(null);
    setPrompting(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, [unlocked]);

  const finish = (ok: boolean) => {
    setPrompting(false);
    resolverRef.current?.(ok);
    resolverRef.current = null;
  };

  const submit = () => {
    if (entry === ADMIN_PASSWORD) {
      setUnlocked(true);
      persist(true);
      finish(true);
    } else {
      setError("Väärä salasana.");
    }
  };

  const api = useMemo<AdminApi>(
    () => ({ unlocked, lock, ensureAdmin }),
    [unlocked, lock, ensureAdmin],
  );

  return (
    <AdminContext.Provider value={api}>
      {children}
      {prompting && (
        <Modal
          open
          onClose={() => finish(false)}
          title="Muokkaus vaatii salasanan"
          footer={
            <>
              <button className="btn-ghost" onClick={() => finish(false)}>
                Peruuta
              </button>
              <button className="btn-primary" data-testid="admin-submit" onClick={submit}>
                Avaa muokkaus
              </button>
            </>
          }
        >
          <p className="mb-3 text-sm text-slate-400">
            Pelaajalistan ja päättyneiden otteluiden muokkaus on suojattu salasanalla.
          </p>
          <input
            className="input"
            type="password"
            autoFocus
            data-testid="admin-password"
            value={entry}
            onChange={(e) => {
              setEntry(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="Salasana"
          />
          {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
        </Modal>
      )}
    </AdminContext.Provider>
  );
}

export function useAdmin(): AdminApi {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminAuthProvider");
  return ctx;
}
