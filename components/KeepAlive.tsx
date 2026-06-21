"use client";

import { useEffect } from "react";

/**
 * Ties the local server's lifetime to this browser tab.
 * - Pings /api/heartbeat every 5s while open (cancels any pending shutdown).
 * - On tab close, sends a beacon to /api/shutdown, which exits the server
 *   after a short grace window (a refresh / second tab cancels it via heartbeat).
 * Only the packaged production app actually self-terminates; dev is unaffected.
 */
export function KeepAlive() {
  useEffect(() => {
    const ping = () => fetch("/api/heartbeat", { cache: "no-store" }).catch(() => {});
    ping();
    const id = setInterval(ping, 5000);
    const bye = () => {
      try {
        navigator.sendBeacon("/api/shutdown");
      } catch {
        /* ignore */
      }
    };
    // pagehide fires on real close, navigation, and refresh; refresh/2nd-tab
    // re-mount this component and the next heartbeat cancels the shutdown.
    window.addEventListener("pagehide", bye);
    return () => {
      clearInterval(id);
      window.removeEventListener("pagehide", bye);
    };
  }, []);
  return null;
}
