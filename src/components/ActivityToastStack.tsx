"use client";

import { useEffect, useState } from "react";

const STAFF_NAMES: Record<string, string> = {
  arun: "Arun", ahila: "Ahila", vishnu: "Vishnu",
  nilani: "Nilani", bharani: "Bharani", rafiq: "Rafiq", gowtham: "Gowtham",
};

const POLL_INTERVAL_MS = 30 * 1000;
const CONSIDER_ACTIVE_WITHIN_MS = 90 * 1000;
const TOAST_LIFETIME_MS = 4 * 1000;

type Toast = { id: string; label: string };

export default function ActivityToastStack() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const alreadyNotified = new Set<string>();

    const poll = async () => {
      const res = await fetch("/api/activity/summary");
      const data: Record<string, { last_seen_at: string }> = await res.json();
      const now = Date.now();

      for (const [staffId, info] of Object.entries(data)) {
        const lastSeen = new Date(info.last_seen_at).getTime();
        const isFresh = now - lastSeen < CONSIDER_ACTIVE_WITHIN_MS;

        if (isFresh && !alreadyNotified.has(staffId)) {
          alreadyNotified.add(staffId);
          const toastId = `${staffId}-${now}`;
          setToasts((prev) => [...prev, { id: toastId, label: `${STAFF_NAMES[staffId] ?? staffId} is active` }]);
          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== toastId));
          }, TOAST_LIFETIME_MS);
        }
        if (!isFresh) alreadyNotified.delete(staffId);
      }
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="bg-neutral-900 text-white text-sm px-3 py-2 rounded-lg shadow-lg">
          🟢 {t.label}
        </div>
      ))}
    </div>
  );
}
