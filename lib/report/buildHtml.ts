"use client";

// Serializes a rendered report DOM node into a fully self-contained .html string:
// inlines the page's CSS and base64-embeds the (local) fonts so the file renders
// identically when opened standalone or hosted on here.now.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function abToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function collectCss(): Promise<string> {
  let css = "";
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) css += rule.cssText + "\n";
    } catch {
      // Cross-origin sheet: fall back to fetching its href.
      if (sheet.href) {
        try {
          css += (await (await fetch(sheet.href)).text()) + "\n";
        } catch {
          /* skip */
        }
      }
    }
  }
  return css;
}

const FONT_URL_RE = /url\(\s*["']?([^"')]+\.(?:woff2?|ttf|otf))["']?\s*\)/g;

async function inlineFonts(css: string): Promise<string> {
  const urls = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = FONT_URL_RE.exec(css))) urls.add(m[1]);

  const dataByUrl = new Map<string, string>();
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const b64 = abToBase64(await res.arrayBuffer());
      const ext = url.split(/[?#]/)[0].split(".").pop()!;
      const mime = ext === "woff2" ? "font/woff2" : ext === "woff" ? "font/woff" : ext === "ttf" ? "font/ttf" : "font/otf";
      dataByUrl.set(url, `data:${mime};base64,${b64}`);
    } catch {
      /* leave the original url() if the font can't be fetched */
    }
  }
  // Replace whole url(...) tokens via a single pass keyed on the exact URL, so a
  // shorter URL (font.woff) can't corrupt a longer one (font.woff2).
  return css.replace(FONT_URL_RE, (full, u) => {
    const data = dataByUrl.get(u);
    return data ? `url(${data})` : full;
  });
}

/** Build a standalone HTML document from a rendered report node. */
export async function buildReportHtml(node: HTMLElement, title: string): Promise<string> {
  const css = await inlineFonts(await collectCss());
  // document.body's classes carry the next/font CSS-variable classes (--font-*).
  const bodyClass = document.body.className;
  const inner = node.outerHTML;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${css}</style>
<style>
@page { size: A4 portrait; margin: 12mm; }
@media print {
  body { background: #ffffff !important; }
  body > div { padding: 0 !important; }
  .report-doc div[class*="rounded-lg"] { break-inside: avoid; }
}
</style>
</head>
<body class="${escapeHtml(bodyClass)}" style="background: var(--color-bg-bedrock); margin: 0;">
<div style="display: flex; justify-content: center; padding: 24px;">${inner}</div>
</body>
</html>`;
}
