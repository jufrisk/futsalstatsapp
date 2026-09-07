import { useRef, useState } from "react";
import { PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { useToast } from "@/app/toast";
import { useAdmin } from "@/app/adminAuth";
import { useOnlineStatus } from "@/app/hooks";
import { useSyncStatus } from "@/app/useSync";
import { clearAllData } from "@/db/database";
import { buildBackup, restoreBackup, type ImportMode } from "@/services/backupService";
import { downloadTextFile, jsonString } from "@/services/exportService";
import { formatFiDate, todayIsoDate } from "@/services/dates";
import { forceSync, syncConfigured } from "@/services/sync";

export function SettingsPage() {
  const toast = useToast();
  const online = useOnlineStatus();
  const sync = useSyncStatus();
  const { unlocked, lock, ensureAdmin } = useAdmin();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<ImportMode>("replace");
  const [busy, setBusy] = useState(false);

  const doExport = async () => {
    const backup = await buildBackup();
    downloadTextFile(
      `futsal-stats-varmuuskopio-${todayIsoDate()}.json`,
      jsonString(backup),
      "application/json",
    );
    toast.push("Varmuuskopio ladattu", "success");
  };

  const onFile = async (file: File) => {
    if (!(await ensureAdmin())) {
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setBusy(true);
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const result = await restoreBackup(raw, mode);
      toast.push(
        `Palautettu (${result.mode}): ${result.counts.matches} ottelua, ${result.counts.players} pelaajaa`,
        "success",
      );
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <PageHeader title="Asetukset" subtitle={`Tänään ${formatFiDate(todayIsoDate())}`} />

      {/* ---- Muokkauksen lukitus ---- */}
      <section className="card mb-4">
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-300">
          Muokkauksen lukitus
        </h2>
        <p className="mb-3 text-sm text-slate-400">
          Pelaajalistan ja päättyneiden otteluiden muokkaus on suojattu jaetulla
          salasanalla. Ottelun tilastointi ja uuden ottelun lisääminen eivät vaadi salasanaa.
        </p>
        {unlocked ? (
          <button className="btn-secondary" data-testid="admin-lock" onClick={lock}>
            🔒 Lukitse muokkaus
          </button>
        ) : (
          <button
            className="btn-primary"
            data-testid="admin-unlock"
            onClick={() => void ensureAdmin()}
          >
            🔓 Avaa muokkaus (salasana)
          </button>
        )}
      </section>

      {/* ---- Synkronointi ---- */}
      <section className="card mb-4">
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-300">
          Synkronointi
        </h2>
        {syncConfigured ? (
          <>
            <p className="mb-3 text-sm text-slate-400">
              Data jaetaan pilven kautta kaikille laitteille. Tila:{" "}
              <span className="font-medium text-slate-200">
                {sync.state === "syncing"
                  ? "synkronoidaan…"
                  : sync.state === "offline"
                    ? "ei yhteyttä"
                    : sync.state === "error"
                      ? `virhe (${sync.lastError ?? "?"})`
                      : "ajan tasalla"}
              </span>
              {sync.lastSyncedAt
                ? ` · viimeksi ${new Date(sync.lastSyncedAt).toLocaleTimeString("fi-FI")}`
                : ""}
            </p>
            <button className="btn-secondary" onClick={() => void forceSync()}>
              Päivitä nyt
            </button>
          </>
        ) : (
          <p className="text-sm text-slate-400">
            Pilvisynkronointia ei ole määritetty – data on vain tässä laitteessa. Aseta{" "}
            <code>VITE_SUPABASE_URL</code> ja <code>VITE_SUPABASE_ANON_KEY</code> ja julkaise
            uudelleen.
          </p>
        )}
      </section>

      {/* ---- Varmuuskopiointi ---- */}
      <section className="card mb-4">
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-300">
          Varmuuskopiointi
        </h2>
        <p className="mb-3 text-sm text-slate-400">
          Lataa JSON-varmuuskopio talteen. Palautus vaatii salasanan.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-primary" data-testid="backup-export" onClick={doExport}>
            Varmuuskopioi kaikki (JSON)
          </button>
        </div>

        <div className="mt-4 border-t border-slate-800 pt-4">
          <p className="mb-2 text-sm font-medium text-slate-300">Palauta varmuuskopio</p>
          <div className="mb-2 flex gap-2">
            {(["replace", "merge"] as const).map((m) => (
              <button
                key={m}
                className={mode === m ? "btn-primary" : "btn-secondary"}
                onClick={() => setMode(m)}
              >
                {m === "replace" ? "Korvaa kaikki" : "Yhdistä"}
              </button>
            ))}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
            className="block text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-slate-100"
          />
          <p className="mt-1 text-xs text-slate-500">
            “Korvaa kaikki” tyhjentää nykyisen datan ennen palautusta ja poistaa puuttuvat
            tietueet myös muilta laitteilta.
          </p>
        </div>
      </section>

      <section className="card mb-4">
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-300">Tila</h2>
        <p className="text-sm text-slate-400">
          Yhteys: {online ? "verkossa" : "offline – kaikki tallentuu laitteelle"}. Ottelun
          tilastointi toimii täysin ilman internetiä; muutokset synkronoituvat, kun yhteys
          palaa.
        </p>
      </section>

      <section className="card border-rose-900/60">
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-rose-300">
          Vaaravyöhyke
        </h2>
        <p className="mb-3 text-sm text-slate-400">
          Tyhjentää datan <strong>tästä laitteesta</strong>. Jos pilvisynkronointi on
          käytössä, data latautuu takaisin seuraavassa synkronoinnissa.
        </p>
        <ConfirmButton
          confirmLabel="Tyhjennä tämä laite?"
          onConfirm={async () => {
            if (!(await ensureAdmin())) return;
            await clearAllData();
            toast.push("Laitteen data tyhjennetty", "success");
          }}
        >
          Tyhjennä laitteen data
        </ConfirmButton>
      </section>
    </div>
  );
}
