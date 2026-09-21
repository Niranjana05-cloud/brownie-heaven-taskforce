"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type StaffLite = { id: string; name: string };
type Row = { staff_id: string; login_at: string; last_seen_at: string };

export default function ActiveStatusTab({ staffList }: { staffList: StaffLite[] }) {
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const dayStart = `${date}T00:00:00.000Z`;
      const dayEnd = `${date}T23:59:59.999Z`;
      // A session started before this day but still running (last_seen_at falls
      // on or after this day) needs to count too — people don't log out daily,
      // so filtering by login_at alone hides every ongoing session.
      const { data } = await supabase
        .from("activity_log")
        .select("staff_id, login_at, last_seen_at")
        .lte("login_at", dayEnd)
        .gte("last_seen_at", dayStart);
      setRows(data || []);
      setLoading(false);
    })();
  }, [date]);

  const fmtDuration = (ms: number) => {
    const mins = Math.round(ms / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h === 0 ? `${m}m` : `${h}h ${m}m`;
  };
  const fmtAgo = (iso: string | null) => {
    if (!iso) return "never";
    const diffMin = Math.round((now - new Date(iso).getTime()) / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const h = Math.floor(diffMin / 60);
    return `${h}h ${diffMin % 60}m ago`;
  };

  const dayStartMs = new Date(`${date}T00:00:00.000Z`).getTime();
  const dayEndMs = new Date(`${date}T23:59:59.999Z`).getTime();

  const perStaff = staffList
    .map((s) => {
      const sessions = rows.filter((r) => r.staff_id === s.id);
      let totalMs = 0;
      let latestSeen: string | null = null;
      sessions.forEach((sess) => {
        const start = new Date(sess.login_at).getTime();
        const end = new Date(sess.last_seen_at || sess.login_at).getTime();
        // Only count the slice of this session that actually falls on the
        // selected day — a session spanning several days shouldn't dump its
        // whole duration onto just one of them.
        const overlapStart = Math.max(start, dayStartMs);
        const overlapEnd = Math.min(end, dayEndMs);
        if (overlapEnd > overlapStart) totalMs += overlapEnd - overlapStart;
        if (!latestSeen || sess.last_seen_at > latestSeen) latestSeen = sess.last_seen_at;
      });
      const activeNow = latestSeen ? now - new Date(latestSeen).getTime() < 5 * 60 * 1000 : false;
      return { id: s.id, name: s.name, totalMs, latestSeen, activeNow };
    })
    .sort((a, b) => (a.activeNow === b.activeNow ? b.totalMs - a.totalMs : a.activeNow ? -1 : 1));


  return (
    <div>
      <div className="flex flex-wrap justify-between items-end gap-4 mb-6 pb-5 border-b border-zinc-800">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Active Status</h2>
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Who's active, and how long — from the app's own real usage</p>
        </div>
        <input
          type="date"
          value={date}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setDate(e.target.value)}
          className="bg-black border border-zinc-800 text-white px-4 py-2.5 focus:outline-none focus:border-yellow-400 transition-colors font-mono text-sm"
        />
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <div className="bg-[#131316] border border-zinc-800 max-w-2xl">
          {perStaff.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 last:border-0">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${p.activeNow ? "bg-green-400" : "bg-zinc-700"}`}></span>
                <div>
                  <p className="font-semibold text-sm">{p.name}</p>
                  <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
                    {p.activeNow ? "Active now" : p.latestSeen ? `Last seen ${fmtAgo(p.latestSeen)}` : "No activity this day"}
                  </p>
                </div>
              </div>
              <p className="font-mono text-sm text-zinc-300">{p.totalMs > 0 ? fmtDuration(p.totalMs) : "—"}</p>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-zinc-600 mt-3 max-w-2xl">
        "Active time" is measured from the app itself, while the tab is open and visible on screen — time with the app closed or in the background doesn't count.
      </p>
    </div>
  );
}
