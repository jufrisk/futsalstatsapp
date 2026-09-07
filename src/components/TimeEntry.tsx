import { useEffect, useMemo, useState } from "react";
import { parseMatchTime, secondsToParts, validateMatchTime } from "@/services/matchTime";

interface TimeEntryProps {
  initialSeconds?: number;
  onChange: (result: { seconds: number; valid: boolean }) => void;
  autoFocus?: boolean;
}

/**
 * Fast MM:SS entry (UX_AND_RULES §9). A custom numpad fills a 4-digit buffer;
 * the user never types the colon.
 */
export function TimeEntry({ initialSeconds, onChange, autoFocus }: TimeEntryProps) {
  const [digits, setDigits] = useState<string>(() => {
    if (initialSeconds == null) return "";
    const { minutes, seconds } = secondsToParts(initialSeconds);
    return `${String(minutes).padStart(2, "0")}${String(seconds).padStart(2, "0")}`;
  });

  const { minutes, seconds } = useMemo(() => {
    const padded = digits.padStart(4, "0");
    return {
      minutes: Number(padded.slice(0, 2)),
      seconds: Number(padded.slice(2, 4)),
    };
  }, [digits]);

  const validation = validateMatchTime(minutes, seconds);
  const valid = digits.length > 0 && validation.ok;

  useEffect(() => {
    onChange({ seconds: parseMatchTime(minutes, seconds), valid });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minutes, seconds, valid]);

  const press = (d: string) => setDigits((cur) => (cur.length >= 4 ? cur : `${cur}${d}`));
  const back = () => setDigits((cur) => cur.slice(0, -1));
  const clear = () => setDigits("");

  const display = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={[
          "select-none rounded-xl border px-6 py-3 font-mono text-4xl tracking-widest",
          digits.length === 0
            ? "border-slate-700 text-slate-500"
            : validation.ok
              ? "border-brand text-slate-50"
              : "border-rose-500 text-rose-300",
        ].join(" ")}
        aria-live="polite"
      >
        {display}
      </div>
      {!validation.ok && digits.length > 0 && (
        <p className="text-xs text-rose-400">{validation.error}</p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d, i) => (
          <NumBtn
            key={d}
            testid={`numpad-${d}`}
            onClick={() => press(d)}
            autoFocus={autoFocus && i === 0}
          >
            {d}
          </NumBtn>
        ))}
        <NumBtn onClick={clear} variant="muted" testid="numpad-clear">
          C
        </NumBtn>
        <NumBtn onClick={() => press("0")} testid="numpad-0">
          0
        </NumBtn>
        <NumBtn onClick={back} variant="muted" testid="numpad-back">
          ⌫
        </NumBtn>
      </div>
    </div>
  );
}

function NumBtn({
  children,
  onClick,
  variant = "solid",
  autoFocus,
  testid,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "solid" | "muted";
  autoFocus?: boolean;
  testid?: string;
}) {
  return (
    <button
      data-testid={testid}
      autoFocus={autoFocus}
      onClick={onClick}
      className={[
        "h-16 w-20 rounded-xl text-2xl font-semibold transition-colors",
        variant === "muted"
          ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
          : "bg-slate-700 text-slate-50 hover:bg-slate-600",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
