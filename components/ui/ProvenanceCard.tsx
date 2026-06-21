"use client";

import { createContext, useContext, useId, useRef, useState } from "react";
import { Eye } from "lucide-react";

import { cn } from "@/lib/utils";
import type { SourceMeta } from "@/lib/sources/meta";
import { ProvenancePanel } from "@/components/ProvenancePanel";

type ProvenanceCtx = {
  meta: SourceMeta | null;
  flipped: boolean;
  flip: () => void;
  backId: string;
};
const Ctx = createContext<ProvenanceCtx | null>(null);

/** Eye toggle rendered by CardHeader when inside a ProvenanceCard. */
export function ProvenanceEye() {
  const ctx = useContext(Ctx);
  if (!ctx) return null;
  return (
    <button
      type="button"
      onClick={ctx.flip}
      aria-label={ctx.flipped ? "Hide data source" : "Show data source"}
      aria-expanded={ctx.flipped}
      aria-controls={ctx.backId}
      title="Where does this data come from?"
      className="flex cursor-pointer items-center justify-center rounded-md border border-border-solid bg-bg-top p-1.5 text-text-tertiary transition-colors hover:bg-bg-layered hover:text-text-primary"
    >
      <Eye size={14} />
    </button>
  );
}

const CARD_CHROME = "rounded-lg border border-border-solid bg-bg-top";

export function ProvenanceCard({
  meta,
  className,
  children,
}: {
  meta: SourceMeta | null;
  className?: string;
  children: React.ReactNode;
}) {
  const [flipped, setFlipped] = useState(false);
  const backId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);

  const flip = () => setFlipped((f) => !f);
  const flipBack = () => setFlipped(false);

  // Esc returns to the front ONLY when focus is inside this card, so it never
  // fights the dashboard's global Esc (insights / selection).
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && flipped) {
      e.stopPropagation();
      flipBack();
      wrapRef.current?.querySelector<HTMLElement>("[data-provenance-eye-anchor] button")?.focus();
    }
  };

  return (
    <Ctx.Provider value={{ meta, flipped, flip, backId }}>
      <div
        ref={wrapRef}
        className={cn("provenance-flip", className)}
        data-flipped={flipped}
        onKeyDown={onKeyDown}
      >
        <div className="provenance-flip-inner">
          <div className={cn("provenance-face provenance-front overflow-hidden", CARD_CHROME)}>
            {children}
          </div>
          <div
            id={backId}
            className={cn("provenance-face provenance-back overflow-hidden", CARD_CHROME)}
            aria-hidden={!flipped}
          >
            <ProvenancePanel meta={meta} onBack={flipBack} active={flipped} />
          </div>
        </div>
      </div>
    </Ctx.Provider>
  );
}
