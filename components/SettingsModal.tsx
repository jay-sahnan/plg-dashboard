"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { GOAL_METRICS } from "@/lib/goalsConfig";
import { useFilters } from "@/components/DashboardFilters";
import { cn } from "@/lib/utils";
import { saveGoals, type SaveState } from "@/app/settings/actions";

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { goals, reloadGoals } = useFilters();
  const [status, setStatus] = useState<SaveState>(null);
  const [pending, setPending] = useState(false);

  // Clear any stale result when the modal opens. Keyed on `open` only — not on
  // onClose (a new identity each render) — so a post-save re-render doesn't wipe
  // the freshly-set success message.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation(); // don't let the dashboard's Esc handler also fire
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setStatus(null);
    const res = await saveGoals(null, new FormData(e.currentTarget));
    setStatus(res);
    if (res?.ok) await reloadGoals();
    setPending(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Goal settings"
        className="relative z-10 flex max-h-[85vh] w-full max-w-[520px] flex-col overflow-hidden rounded-lg border border-border-solid bg-bg-top shadow-xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border-faint px-6 py-4">
          <div>
            <h2 className="type-large text-text-primary">Goals</h2>
            <p className="mt-0.5 type-caption text-text-tertiary">Per-period targets · saved locally to goals.json</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 shrink-0 rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-bg-layered hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </header>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-auto px-6 py-5">
            {GOAL_METRICS.map((f) => (
              <div key={f.key}>
                <label htmlFor={`goal-${f.key}`} className="block type-body font-medium text-text-primary">
                  {f.label}
                </label>
                <p className="mt-0.5 type-caption text-text-tertiary">{f.hint}</p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    id={`goal-${f.key}`}
                    name={f.key}
                    type="number"
                    min="0"
                    step="any"
                    defaultValue={goals[f.key] ?? ""}
                    placeholder="No goal set"
                    className="w-44 rounded-md border border-border-solid bg-bg-main px-3 py-2 type-body text-text-primary placeholder:text-text-tertiary focus:border-primary focus:outline-none"
                  />
                  <span className="type-caption text-text-tertiary">{f.suffix}</span>
                </div>
              </div>
            ))}
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-border-faint px-6 py-4">
            <span className={cn("type-caption", status ? (status.ok ? "text-success" : "text-error") : "")}>
              {status?.message ?? ""}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-border-solid bg-bg-top px-4 py-2 type-body text-text-primary transition-colors hover:bg-bg-layered"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-md border border-primary bg-primary px-4 py-2 type-body text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save goals"}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
