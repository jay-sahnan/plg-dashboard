"use client";

import { useRef, useState } from "react";
import { Check, Copy, Download, FileDown, Link2, Loader2, X } from "lucide-react";

import { ReportDocument } from "@/components/report/ReportDocument";
import { buildReportHtml } from "@/lib/report/buildHtml";
import { printReportHtml } from "@/lib/report/pdf";
import { cn } from "@/lib/utils";

type Busy = null | "html" | "pdf" | "link";

// Wait until the report's charts have actually rendered (Recharts paints async)
// before capturing, so the export never serializes blank charts.
async function waitForCharts(node: HTMLElement, expected = 8, timeoutMs = 4000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (node.querySelectorAll(".recharts-surface").length >= expected) return;
    await new Promise((r) => setTimeout(r, 150));
  }
}

export function ExportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [link, setLink] = useState<{ url: string; permanent: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const TITLE = "PLG Growth Report";
  const base = `plg-growth-report-${new Date().toISOString().slice(0, 10)}`;

  const downloadHtml = async () => {
    if (!ref.current) return;
    setBusy("html");
    setError(null);
    try {
      await waitForCharts(ref.current);
      const html = await buildReportHtml(ref.current, TITLE);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${base}.html`;
      document.body.appendChild(a);
      a.click();
      // Defer revoke + removal so the download isn't cancelled (Firefox).
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 4000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const downloadPdf = async () => {
    if (!ref.current) return;
    setBusy("pdf");
    setError(null);
    try {
      await waitForCharts(ref.current);
      const html = await buildReportHtml(ref.current, TITLE);
      printReportHtml(html);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    if (!ref.current) return;
    setBusy("link");
    setError(null);
    setLink(null);
    setCopied(false);
    try {
      await waitForCharts(ref.current);
      const html = await buildReportHtml(ref.current, TITLE);
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, title: TITLE }),
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || `HTTP ${res.status}`);
      setLink({ url: d.url, permanent: !!d.permanent });
      try {
        await navigator.clipboard.writeText(d.url);
        setCopied(true);
      } catch {
        /* clipboard may be blocked; link is still shown */
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const actionBtn =
    "flex items-center gap-2 rounded-md border px-3 py-2 type-body transition-colors disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Export report"
        className="relative z-10 flex max-h-[90vh] w-full max-w-[900px] flex-col overflow-hidden rounded-lg border border-border-solid bg-bg-top shadow-xl"
      >
        <header className="flex items-center justify-between gap-4 border-b border-border-faint px-6 py-4">
          <div>
            <h2 className="type-large text-text-primary">Share / export report</h2>
            <p className="mt-0.5 type-caption text-text-tertiary">
              A designed report of the current view. Share a link or download it.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 shrink-0 rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-bg-layered hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </header>

        {/* Live preview (also the capture source for export) */}
        <div className="min-h-0 flex-1 overflow-auto bg-bg-bedrock p-5">
          <div className="mx-auto w-fit">
            <ReportDocument ref={ref} />
          </div>
        </div>

        <footer className="flex flex-wrap items-center gap-3 border-t border-border-faint px-6 py-4">
          <button onClick={downloadHtml} disabled={!!busy} className={cn(actionBtn, "border-border-solid bg-bg-top text-text-primary hover:bg-bg-layered")}>
            {busy === "html" ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            Download HTML
          </button>
          <button onClick={downloadPdf} disabled={!!busy} className={cn(actionBtn, "border-border-solid bg-bg-top text-text-primary hover:bg-bg-layered")}>
            {busy === "pdf" ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
            Save as PDF
          </button>
          <button onClick={share} disabled={!!busy} className={cn(actionBtn, "border-primary bg-primary text-white hover:opacity-90")}>
            {busy === "link" ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
            {link ? "Re-publish link" : "Create share link"}
          </button>

          <div className="ml-auto flex items-center gap-2">
            {error ? <span className="type-caption text-error">{error}</span> : null}
            {link ? (
              <div className="flex items-center gap-2">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="max-w-[260px] truncate type-caption text-active hover:underline"
                  title={link.url}
                >
                  {link.url}
                </a>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(link.url);
                      setCopied(true);
                    } catch {
                      /* ignore */
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-border-solid px-2 py-1 type-caption text-text-primary hover:bg-bg-layered"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            ) : null}
          </div>
        </footer>
        {link && !link.permanent ? (
          <p className="border-t border-border-faint px-6 py-2 type-caption text-text-tertiary">
            This is a temporary link (expires in 24h). Add a HERE_NOW_API_KEY in settings for permanent links.
          </p>
        ) : null}
      </div>
    </div>
  );
}
