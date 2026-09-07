import { useRef, useState } from "react";
import { PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { useToast } from "@/app/toast";
import { clearAllData } from "@/db/database";
import { buildBackup, restoreBackup, type ImportMode } from "@/services/backupService";
import { downloadTextFile, jsonString } from "@/services/exportService";
import { formatFiDate, todayIsoDate } from "@/services/dates";
import { useOnlineStatus } from "@/app/hooks";

export function SettingsPage() {
  const toast = useToast();
  const online = useOnlineStatus();
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

      <section className="card mb-4">
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-300">
          Varmuuskopiointi
        </h2>
        <p className="mb-3 text-sm text-slate-400">
          Kaikki data on vain tässä laitteessa (IndexedDB). Ota säännöllisesti JSON-varmuuskopio.
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
            “Korvaa kaikki” tyhjentää nykyisen datan ennen palautusta.
          </p>
        </div>
      </section>

      <section className="card mb-4">
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-300">Tila</h2>
        <p className="text-sm text-slate-400">
          Yhteys: {online ? "verkossa" : "offline – kaikki tallentuu laitteelle"}. Sovellus toimii
          täysin ilman internetiä.
        </p>
      </section>

      <section className="card border-rose-900/60">
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-rose-300">
          Vaaravyöhyke
        </h2>
        <p className="mb-3 text-sm text-slate-400">
          Poistaa kaikki kaudet, pelaajat ja ottelut tästä laitteesta. Tee ensin varmuuskopio.
        </p>
        <ConfirmButton
          confirmLabel="Poista KAIKKI data?"
          onConfirm={async () => {
            await clearAllData();
            toast.push("Kaikki data poistettu", "success");
          }}
        >
          Tyhjennä kaikki data
        </ConfirmButton>
      </section>
    </div>
  );
}
