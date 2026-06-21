"use client";

// Generates a PDF from the self-contained report HTML by printing it in a hidden
// iframe (browser "Save as PDF"). Vector-perfect and identical to the HTML export,
// which html2canvas-based libraries fail to reproduce for multi-section layouts.
export function printReportHtml(html: string): void {
  const iframe = document.createElement("iframe");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
    opacity: "0",
  });
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  let printed = false;
  const cleanup = () => {
    try {
      iframe.remove();
    } catch {
      /* ignore */
    }
  };
  const doPrint = () => {
    if (printed) return;
    printed = true;
    const win = iframe.contentWindow;
    try {
      win?.focus();
      // Remove only once the print/save dialog is dismissed (print() is
      // non-blocking in Safari/Firefox, so a fixed timer would tear out the
      // iframe mid-dialog and blank the PDF).
      if (win) win.onafterprint = () => setTimeout(cleanup, 500);
      win?.print();
    } catch {
      cleanup();
      return;
    }
    // Fallback if afterprint never fires.
    setTimeout(cleanup, 60000);
  };

  iframe.onload = () => setTimeout(doPrint, 300);

  const doc = iframe.contentWindow!.document;
  doc.open();
  doc.write(html);
  doc.close();

  // Fallback: onload may not fire reliably after document.write.
  setTimeout(doPrint, 1200);
}
