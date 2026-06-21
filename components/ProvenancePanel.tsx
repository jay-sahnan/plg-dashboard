"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Copy, Database, ExternalLink } from "lucide-react";

import type { SourceMeta } from "@/lib/sources/meta";

const SOURCE_LABEL: Record<string, string> = {
  snowflake: "Snowflake",
  posthog: "PostHog",
  hex: "Hex",
  sqlite: "SQLite",
  postgres: "Postgres",
  mock: "Demo data",
};

function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="flex items-center gap-1 rounded-md border border-border-solid bg-bg-top px-2 py-1 type-caption text-text-tertiary transition-colors hover:text-text-primary"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function ProvenancePanel({
  meta,
  onBack,
  active,
}: {
  meta: SourceMeta | null;
  onBack: () => void;
  active: boolean;
}) {
  const backRef = useRef<HTMLButtonElement>(null);

  // Move focus onto the back panel when it becomes visible (keyboard users land here).
  useEffect(() => {
    if (active) backRef.current?.focus();
  }, [active]);

  const label = meta ? (SOURCE_LABEL[meta.source] ?? meta.source) : "—";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border-faint px-5 py-4">
        <div className="flex items-center gap-2">
          <button
            ref={backRef}
            type="button"
            onClick={onBack}
            aria-label="Back to chart"
            className="flex items-center justify-center rounded-md border border-border-solid bg-bg-top p-1.5 text-text-tertiary transition-colors hover:bg-bg-layered hover:text-text-primary"
          >
            <ArrowLeft size={14} />
          </button>
          <Database size={14} className="text-text-tertiary" />
          <h2 className="type-header text-text-primary">{label}</h2>
        </div>
        {meta ? (
          <span
            className="flex items-center gap-1.5 type-caption text-text-tertiary"
            title={meta.ok ? "Last pull succeeded" : "Last pull failed"}
          >
            <span
              aria-hidden
              className={`h-2 w-2 rounded-full ${meta.ok ? "bg-emerald-500" : "bg-red-500"}`}
            />
            {relTime(meta.fetchedAt)}
            {typeof meta.durationMs === "number" ? ` · ${meta.durationMs}ms` : ""}
          </span>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
        {!meta ? (
          <p className="type-body text-text-tertiary">No source metadata available.</p>
        ) : !meta.ok ? (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3">
            <p className="type-caption font-mono uppercase tracking-wide text-red-500">Last pull failed</p>
            <p className="mt-1 type-body text-text-primary">{meta.error ?? "Unknown error."}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {meta.insight ? (
              <div>
                <p className="type-caption text-text-tertiary">Insight</p>
                <p className="type-body text-text-primary">{meta.insight.name ?? meta.insight.id}</p>
                {meta.insight.url ? (
                  <a
                    href={meta.insight.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 type-caption text-primary hover:underline"
                  >
                    Open in PostHog <ExternalLink size={11} />
                  </a>
                ) : null}
              </div>
            ) : null}

            {meta.dashboardUrl ? (
              <a
                href={meta.dashboardUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 type-body text-primary hover:underline"
              >
                Open dashboard <ExternalLink size={12} />
              </a>
            ) : null}

            {meta.query ? (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="type-caption text-text-tertiary">Query</p>
                  <CopyButton text={meta.query} />
                </div>
                <pre className="overflow-auto rounded-md border border-border-faint bg-bg-subtle p-3 type-caption leading-relaxed text-text-secondary">
                  <code>{meta.query}</code>
                </pre>
              </div>
            ) : null}

            {meta.note ? <p className="type-caption text-text-tertiary">{meta.note}</p> : null}

            <div className="flex flex-wrap gap-x-4 gap-y-1 type-caption text-text-tertiary">
              {typeof meta.rowCount === "number" ? <span>{meta.rowCount} rows</span> : null}
              <span>source: {meta.source}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
