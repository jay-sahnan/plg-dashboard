"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Sparkles } from "lucide-react";

import changelog from "@/data/changelog.json";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { useFilters } from "@/components/DashboardFilters";
import { eventKey } from "@/lib/eventKey";
import { cn } from "@/lib/utils";

type Event = {
  date: string;
  cat: string;
  category?: string; // top-level bucket (UI/Launch/…)
  mark?: string;
  src: string;
  channel?: string;
  id?: string;
  url?: string;
  product?: string;
  title: string;
};

const CATEGORIES = ["UI", "Launch", "Social", "Incident", "Billing", "Growth", "Platform", "Other"] as const;
const CAT_COLORS: Record<string, string> = {
  UI: "#4da9e4",
  Launch: "#ff4500",
  Social: "#06b6d4",
  Incident: "#e5484d",
  Billing: "#9c71f0",
  Growth: "#f4ba41",
  Platform: "#71ac38",
  Other: "#969493",
};

// Fast local fallback so the list renders instantly before/without the model.
function heuristicCategory(e: Event): string {
  const c = (e.cat || "").toLowerCase();
  if (e.src === "social" || c === "social") return "Social";
  if (c === "incident") return "Incident";
  if (c === "billing") return "Billing";
  if (c === "growth") return "Growth";
  if (c === "launch" || e.src === "blog") return "Launch";
  if (c === "dashboard" || c === "website" || c === "onboarding") return "UI";
  if (c === "data") return "Platform";
  if (c === "product") return "Launch";
  return "Other";
}

const SRC_LABEL: Record<string, string> = {
  slack: "Slack",
  linear: "Linear",
  changelog: "Changelog",
  blog: "Blog",
  social: "Social",
};

function sourceHref(e: Event): string | undefined {
  if (e.url) return e.url;
  const cid = (changelog.meta.channelIds as Record<string, string>)[e.channel ?? ""];
  return cid ? `${changelog.meta.slackArchiveBase}/${cid}` : undefined;
}

function sourceLabel(e: Event): string {
  if (e.src === "linear") return e.id ?? "Linear";
  if (e.src === "changelog") return e.product ?? "Changelog";
  if (e.src === "blog") return "Launch";
  if (e.src === "social") return e.product ?? "Social";
  return `#${e.channel}`;
}

export function ChangelogTimeline({
  monthFilter,
  range,
  onClear,
}: {
  monthFilter?: string | null;
  range?: { start: string; end: string } | null;
  onClear?: () => void;
}) {
  const [events, setEvents] = useState<Event[]>(
    (changelog.events as Event[]).map((e) => ({ ...e, category: heuristicCategory(e) })),
  );
  const [off, setOff] = useState<Set<string>>(new Set(["Social"])); // Social hidden by default (noisy); toggle its chip to show
  const [refining, setRefining] = useState(false);
  const [categorised, setCategorised] = useState(false);
  const { version } = useFilters();

  // AI categorisation — triggered by the button, not automatically.
  const runCategorise = async () => {
    if (refining || !events.length) return;
    setRefining(true);
    try {
      // Keep the "Categorising…" state visible even when the (demo) endpoint
      // responds instantly, so the button gives clear feedback that it ran.
      const [res] = await Promise.all([
        fetch("/api/categorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: events.map((e) => ({ key: eventKey(e), title: e.title, src: e.src, hint: e.cat })) }),
        }),
        new Promise((r) => setTimeout(r, 700)),
      ]);
      const d = await res.json();
      if (d.cats && Object.keys(d.cats).length) {
        setEvents((prev) => prev.map((e) => ({ ...e, category: d.cats[eventKey(e)] ?? e.category })));
      }
      // Flip to the "re-categorise" state once the pass has run, even if the
      // demo endpoint returned no changes — signals the action completed.
      setCategorised(true);
    } catch {
      /* keep heuristic categories */
    } finally {
      setRefining(false);
    }
  };

  // Fresh pull on mount: live Sanity changelog/launches + high-impact Octolens
  // mentions, merged with the curated events, then categorised by a small model.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [cl, soc, cat] = await Promise.all([
        fetch("/api/changelog", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ events: [] })),
        fetch("/api/social?metric=mentions&start=2025-04-01", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ rows: [] })),
        fetch("/api/categorize", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ cats: {} })),
      ]);
      if (!alive) return;
      const storedCats = (cat?.cats ?? {}) as Record<string, string>;
      const clEvents = Array.isArray(cl.events) ? (cl.events as Event[]) : [];
      const socEvents = ((soc.rows ?? []) as Array<Record<string, unknown>>).map((m) => ({
        date: String(m.timestamp ?? "").slice(0, 10),
        cat: "social",
        src: "social",
        product: m.source ? String(m.source) : undefined,
        title: `${m.author ?? "?"}${m.source ? ` (${m.source})` : ""}: ${String(m.body || m.title || "").slice(0, 120)}`,
        url: m.url ? String(m.url) : undefined,
      })) as Event[];

      // Persisted AI categories (by event key) win; everything else gets the fast
      // local heuristic — so a refresh keeps prior AI categories without re-calling.
      const merged = [...(changelog.events as Event[]), ...clEvents, ...socEvents].map((e) => ({
        ...e,
        category: storedCats[eventKey(e)] ?? heuristicCategory(e),
      }));
      setEvents(merged);
      setCategorised(Object.keys(storedCats).length > 0);
    })();
    return () => {
      alive = false;
    };
    // Re-pull when the user hits "Refresh data" (version bumps) — no remount,
    // so the category-chip filters below are preserved.
  }, [version]);

  const rows = useMemo(
    () =>
      events
        .filter((e) => !off.has(e.category ?? "Other"))
        .filter((e) => {
          if (range) {
            const m = e.date.slice(0, 7);
            return m >= range.start && m <= range.end;
          }
          return !monthFilter || e.date.startsWith(monthFilter);
        })
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [events, off, monthFilter, range],
  );

  // Show only categories that actually appear, in canonical order, with counts.
  const present = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) counts.set(e.category ?? "Other", (counts.get(e.category ?? "Other") ?? 0) + 1);
    return CATEGORIES.filter((c) => counts.has(c)).map((c) => ({ cat: c, n: counts.get(c)! }));
  }, [events]);

  const toggle = (c: string) =>
    setOff((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  return (
    <Card>
      <CardHeader
        title="What shipped & signals"
        subtitle="Shipping log + social signals. ★ likely positive driver · ⚠ likely drag."
        right={
          <button
            onClick={runCategorise}
            disabled={refining}
            className="flex items-center gap-1.5 rounded-md border border-border-solid bg-bg-top px-2.5 py-1.5 type-caption text-text-primary transition-colors hover:bg-bg-layered disabled:opacity-50"
            title="Re-bucket every entry with Claude Haiku"
          >
            <Sparkles size={12} className={cn("text-primary", refining && "animate-pulse")} />
            {refining ? "Categorising…" : categorised ? "Re-categorise" : "Categorise with AI"}
          </button>
        }
      />
      {range || monthFilter ? (
        <div className="flex items-center justify-between gap-2 border-b border-border-faint bg-bg-layered px-5 py-2">
          <span className="type-caption text-text-secondary">
            Filtered to{" "}
            <span className="font-mono text-text-primary">{range ? `${range.start} → ${range.end}` : monthFilter}</span> ·{" "}
            {rows.length} {rows.length === 1 ? "entry" : "entries"}
          </span>
          <button
            onClick={onClear}
            className="rounded border border-border-faint px-2 py-0.5 type-caption text-text-secondary hover:bg-bg-top"
          >
            Clear
          </button>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2 px-5 pt-4">
        {present.map(({ cat, n }) => (
          <button
            key={cat}
            onClick={() => toggle(cat)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border border-border-faint px-2.5 py-1 type-caption transition-opacity",
              off.has(cat) ? "opacity-35" : "opacity-100",
            )}
          >
            <span className="size-2 rounded-full" style={{ backgroundColor: CAT_COLORS[cat] }} />
            {cat}
            <span className="text-text-tertiary">{n}</span>
          </button>
        ))}
      </div>

      <div className="px-2 py-3">
        <ul className="divide-y divide-border-faint">
          {rows.map((e, i) => {
            const href = sourceHref(e);
            const cat = e.category ?? "Other";
            const color = CAT_COLORS[cat] ?? "#969493";
            return (
              <li
                key={`${e.date}-${i}`}
                className={cn(
                  "flex gap-3 px-3 py-3",
                  e.mark === "up" && "bg-success/5",
                  e.mark === "down" && "bg-error/5",
                )}
              >
                <time className="w-20 shrink-0 type-caption font-mono text-text-tertiary">
                  {e.date}
                </time>
                <div className="w-24 shrink-0">
                  <Badge color={color}>{cat}</Badge>
                </div>
                <p className="type-body flex-1 text-text-primary">
                  {e.mark === "up" && <span className="mr-1">★</span>}
                  {e.mark === "down" && <span className="mr-1">⚠</span>}
                  {e.title}
                </p>
                <div className="w-28 shrink-0 text-right">
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 type-caption text-active hover:underline"
                      title={SRC_LABEL[e.src] ?? e.src}
                    >
                      {sourceLabel(e)}
                      <ExternalLink size={11} />
                    </a>
                  ) : (
                    <span className="type-caption text-text-tertiary">{sourceLabel(e)}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}
