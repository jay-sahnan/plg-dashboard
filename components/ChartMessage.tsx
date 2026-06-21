import { AlertTriangle } from "lucide-react";

/** Shared loading / error placeholder rendered inside a chart's plot area. */
export function ChartMsg({ icon, text }: { icon: "load" | "error" | "pending"; text?: string }) {
  if (icon === "load")
    return (
      <div className="flex h-full animate-pulse items-center justify-center rounded-md bg-bg-subtle">
        <span className="type-body text-text-tertiary">Loading…</span>
      </div>
    );
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border-medium bg-bg-subtle px-6 text-center">
      <AlertTriangle className="text-error" size={22} />
      <p className="type-body text-text-secondary">{text}</p>
    </div>
  );
}
