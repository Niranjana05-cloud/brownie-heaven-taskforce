"use client";

import { useEffect } from "react";

const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000; // every 2 minutes

export function useActivityHeartbeat(sessionId: string | null) {
  useEffect(() => {
    if (!sessionId) return;

    const sendHeartbeat = () => {
      if (document.visibilityState !== "visible") return;

      fetch("/api/activity/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      }).catch(() => {});
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [sessionId]);
}
