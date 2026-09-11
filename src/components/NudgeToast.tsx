"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const POLL_INTERVAL_MS = 20 * 1000;

// Temporary — shows Nishant's nudge messages as a flying bubble, on whichever tab
// Niranjana happens to be on. Only fires for a genuinely new message (dedup via
// localStorage timestamp), same pattern as the existing CEO popup "seen" tracking.
export default function NudgeToast() {
  const [toast, setToast] = useState<{ message: string; ts: string } | null>(null);

  useEffect(() => {
    const poll = async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "niranjana_nudge").maybeSingle();
      if (!data?.value) return;
      try {
        const parsed = JSON.parse(data.value);
        const lastSeen = localStorage.getItem("niranjana_nudge_seen_ts");
        if (parsed.ts && parsed.ts !== lastSeen) {
          localStorage.setItem("niranjana_nudge_seen_ts", parsed.ts);
          setToast(parsed);
          setTimeout(() => setToast(null), 10000);
        }
      } catch { /* ignore malformed value */ }
    };
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  if (!toast) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className="bg-neutral-900 border border-yellow-400 text-white rounded-xl shadow-2xl p-4">
        <p className="text-[10px] font-mono text-yellow-400 uppercase tracking-widest mb-1">📌 Reminder from Nishant</p>
        <p className="text-sm">{toast.message}</p>
        <button onClick={() => setToast(null)} className="mt-2 text-[10px] font-mono text-zinc-500 hover:text-white uppercase tracking-widest">Dismiss</button>
      </div>
    </div>
  );
}
