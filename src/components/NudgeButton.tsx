"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Temporary nudge tool — until the real standalone site replaces this. Reuses the
// exact same app_settings upsert pattern as the existing "Push to Nishant" CEO
// report feature, just in the other direction (Nishant -> Niranjana).
export default function NudgeButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (!message.trim()) return;
    setSending(true);
    await supabase.from("app_settings").upsert(
      { key: "niranjana_nudge", value: JSON.stringify({ message: message.trim(), ts: new Date().toISOString() }), updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    setSending(false);
    setSent(true);
    setMessage("");
    setTimeout(() => { setSent(false); setOpen(false); }, 1500);
  };

  return (
    <div className="fixed bottom-4 left-4 z-50">
      {open && (
        <div className="mb-3 w-72 bg-neutral-900 border border-yellow-400/40 rounded-xl shadow-2xl p-4">
          <p className="text-[10px] font-mono text-yellow-400 uppercase tracking-widest mb-1">📌 Temporary reminder tool</p>
          <p className="text-xs text-zinc-400 mb-3">Send Niranjana a nudge to work on TASKFORCE IQ.</p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Type your reminder..."
            className="w-full bg-black border border-zinc-800 text-white px-3 py-2 text-sm focus:outline-none focus:border-yellow-400 transition-colors mb-3"
          />
          <div className="flex gap-2">
            <button onClick={send} disabled={sending || !message.trim()} className="flex-1 bg-yellow-400 text-black px-3 py-2 text-sm font-semibold hover:bg-yellow-300 disabled:opacity-50 transition-colors rounded">
              {sending ? "Sending…" : sent ? "Sent ✓" : "Send"}
            </button>
            <button onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-zinc-500 hover:text-white transition-colors">Cancel</button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="bg-neutral-900 border border-yellow-400/40 text-yellow-400 text-sm font-semibold px-4 py-3 rounded-full shadow-2xl hover:bg-neutral-800 transition-colors"
      >
        📌 Nudge Niranjana
      </button>
    </div>
  );
}
