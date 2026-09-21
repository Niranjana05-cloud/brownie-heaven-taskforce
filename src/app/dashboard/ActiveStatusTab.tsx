"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type StaffLite = { id: string; name: string };
type StatusRow = { staff_id: string; last_seen_at: string };
type PingRow = { staff_id: string };

const HEARTBEAT_MINUTES = 2; // matches useActivityHeartbeat's interval — each real ping represents this much genuine active time

export default function ActiveStatusTab({ staffList }: { staffList: StaffLite[] }) {
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [statusRows, setStatusRows] = useState<StatusRow[]>([]);
  const [pingRows, setPingRows] = useState<PingRow[]>([]);
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

      // "Active now" / "last seen" — the most recent real heartbeat per
      // person, regardless of which day their session originally started.
      const { data: latest } = await supabase
        .from("activity_log")
        .select("staff_id, last_seen_at")
        .order("last_seen_at", { ascending: false });
      const byStaff: Record<string, StatusRow> = {};
      (latest || []).forEach((r: any) => { if (!byStaff[r.staff_id]) byStaff[r.staff_id] = r; });
      setStatusRows(Object.values(byStaff));

      // Real active time for the selected day — a true count of individual
      // heartbeat pings (each one only fires while the app was genuinely
      // open and visible), not a guessed span that wrongly counts gaps too.
      const { data: pings } = await supabase
        .from("activity_pings")
        .select("staff_id")
        .gte("pinged_at", dayStart)
        .lte("pinged_at", dayEnd);
      setPingRows(pings || []);

      setLoading(false);
    })();
  }, [date]);

  const fmtDuration = (mins: number) => {
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

  const perStaff = staffList
    .map((s) => {
      const pingCount = pingRows.filter((p) => p.staff_id === s.id).length;
      const activeMinutes = pingCount * HEARTBEAT_MINUTES;
      const latestSeen = statusRows.find((r) => r.staff_id === s.id)?.last_seen_at || null;
      const activeNow = latestSeen ? now - new Date(latestSeen).getTime() < 5 * 60 * 1000 : false;
      return { id: s.id, name: s.name, activeMinutes, latestSeen, activeNow };
    })
    .sort((a, b) => (a.activeNow === b.activeNow ? b.activeMinutes - a.activeMinutes : a.activeNow ? -1 : 1));

  return (
    <div>
      <div className="flex flex-wrap justify-between items-end gap-4 mb-6 pb-5 border-b border-zinc-800">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Active Status</h2>
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Who's active, and how long — from real heartbeat pings, not a guessed span</p>
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
                    {p.activeNow ? "Active now" : p.latestSeen ? `Last seen ${fmtAgo(p.latestSeen)}` : "No activity yet"}
                  </p>
                </div>
              </div>
              <p className="font-mono text-sm text-zinc-300">{p.activeMinutes > 0 ? fmtDuration(p.activeMinutes) : "—"}</p>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-zinc-600 mt-3 max-w-2xl">
        Each 2-minute heartbeat only fires while the app is genuinely open and visible on screen, so "active time" here is a real count of those — not an estimate. Days before this was fixed won't have ping data yet.
      </p>
    </div>
  );
}
