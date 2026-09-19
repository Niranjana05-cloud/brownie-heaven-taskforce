"use client";
import { useState } from "react";

type StaffLite = { id: string; name: string; role: string };

export default function NotifyTab({ staffList }: { staffList: StaffLite[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<null | { ok: boolean; sent?: number; total?: number; note?: string; error?: string }>(null);

  const toggle = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const send = async () => {
    if (selected.length === 0) { alert("Pick at least one person."); return; }
    if (!title.trim()) { alert("Write a title first."); return; }
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_ids: selected, title: title.trim(), body: body.trim(), tag: "manual" }),
      });
      const json = await res.json();
      setResult(json);
    } catch (e: any) {
      setResult({ ok: false, error: e?.message || "Something went wrong" });
    }
    setSending(false);
  };

  return (
    <div>
      <div className="mb-6 pb-5 border-b border-zinc-800">
        <h2 className="text-2xl font-black tracking-tight">Send Notification</h2>
        <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Sends a real push notification — for testing or a direct message</p>
      </div>

      <div className="max-w-xl">
        <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Who</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {staffList.map((s) => {
            const on = selected.includes(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                className={`px-3 py-1.5 text-sm font-semibold transition-colors ${on ? "bg-yellow-400 text-black" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}
              >
                {s.name.split(" ")[0]}
              </button>
            );
          })}
        </div>

        <div className="mb-4">
          <label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1"
            placeholder="e.g. Test notification"
          />
        </div>
        <div className="mb-5">
          <label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Message (optional)</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1"
            placeholder="Type the message..."
          />
        </div>

        <button
          onClick={send}
          disabled={sending}
          className="bg-yellow-400 text-black px-5 py-2.5 text-sm font-bold uppercase tracking-widest hover:bg-yellow-300 disabled:opacity-50 transition-colors"
        >
          {sending ? "Sending…" : `Send to ${selected.length || 0} ${selected.length === 1 ? "person" : "people"}`}
        </button>

        {result && (
          <div className={`mt-4 border p-4 text-sm ${result.ok ? "border-green-500/30 bg-green-500/5 text-green-300" : "border-red-500/30 bg-red-500/5 text-red-300"}`}>
            {result.ok ? (
              result.sent === 0 ? (
                <p>No registered device found for the selected people yet — they need to log in on their phone and allow notifications first.</p>
              ) : (
                <p>✓ Sent to {result.sent} of {result.total} registered device(s).</p>
              )
            ) : (
              <p>⚠️ {result.error || "Failed to send."}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
