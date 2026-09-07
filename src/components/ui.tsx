import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-50">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 py-10 text-center">
      <p className="text-base font-semibold text-slate-200">{title}</p>
      {hint && <p className="max-w-sm text-sm text-slate-400">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-slate-900 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          data-testid={`tab-${t.id}`}
          onClick={() => onChange(t.id)}
          className={[
            "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            t.id === value
              ? "bg-slate-700 text-slate-50"
              : "text-slate-400 hover:text-slate-200",
          ].join(" ")}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Spinner({ label = "Ladataan…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-brand" />
      {label}
    </div>
  );
}

export function StatBadge({
  label,
  value,
  testid,
}: {
  label: string;
  value: ReactNode;
  testid?: string;
}) {
  return (
    <div className="rounded-xl bg-slate-800/70 px-3 py-2 text-center">
      <div className="text-lg font-bold text-slate-50" data-testid={testid}>
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}
