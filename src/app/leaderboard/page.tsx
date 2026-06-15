"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Staff = { id: string; name: string; role: string };

const ALL_STAFF: Staff[] = [
  { id: "nishant", name: "Nishant Vijayakumar", role: "Owner" },
  { id: "arun", name: "Arun Kumar", role: "Manager" },
  { id: "nilani", name: "Nilani Nallamuthu", role: "HR" },
  { id: "gowtham", name: "Gowtham", role: "Purchase Manager" },
  { id: "vishnu", name: "Vishnu", role: "Asst. Ops Manager" },
  { id: "ahila", name: "Ahila", role: "Custom Cakes & Asst Ops" },
  { id: "bharani", name: "Bharani", role: "Auditor" },
];

const SEASON_START = "2026-06-12";
const PTS_ONTIME = 10;
const PTS_LATE = -30;
const STARTING_POINTS: Record<string, number> = { ahila: 630, nilani: 430, vishnu: 30 };
const PTS_TASK = 5;
const PTS_RATING = 100;
const PTS_OUTLET = 5;
const RATING_THRESHOLD = 4.5;

type Row = {
  id: string; name: string; role: string;
 onTime: number; late: number; tasks: number; ratingHits: number; outlets: number; points: number;
};

export default function LeaderboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<Staff | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const monthLabel = now
    .toLocaleString("en-IN", { month: "long", year: "numeric" })
    .toUpperCase();

  useEffect(() => {
    const stored = localStorage.getItem("currentUser");
    if (!stored) { router.push("/"); return; }
    let parsed;
    try {
      parsed = JSON.parse(stored);
      if (typeof parsed === "string") { localStorage.removeItem("currentUser"); router.push("/"); return; }
    } catch { localStorage.removeItem("currentUser"); router.push("/"); return; }
    setUser(parsed);
    fetchScores();
  }, [router]);

  const fetchScores = async () => {
    setLoading(true);
    const y = now.getFullYear();
    const m = now.getMonth();
    const pad = (n: number) => String(n).padStart(2, "0");
    const monthStart = `${y}-${pad(m + 1)}-01`;
    const startDate = SEASON_START > monthStart ? SEASON_START : monthStart;
    const startISO = new Date(startDate + "T00:00:00").toISOString();
    const endISO = new Date(y, m + 1, 1).toISOString();
    const endDate = m === 11 ? `${y + 1}-01-01` : `${y}-${pad(m + 2)}-01`;

    const [repRes, taskRes, outRes] = await Promise.all([
      supabase.from("reports").select("staff_id,is_late,no_points")
        .gte("submitted_at", startISO).lt("submitted_at", endISO),
      supabase.from("tasks").select("assigned_to,completed_at,created_at")
        .eq("status", "completed"),
     supabase.from("outlet_reports").select("staff_id,bh_google_rating,report_date,rating_bonus,no_points")
        .gte("report_date", startDate).lt("report_date", endDate),
    ]);

    const map: Record<string, Row> = {};
    ALL_STAFF.filter(s => s.role !== "Owner").forEach(s => {
     map[s.id] = { id: s.id, name: s.name, role: s.role, onTime: 0, late: 0, tasks: 0, ratingHits: 0, outlets: 0, points: 0 };
    });

    (repRes.data || []).forEach((r: any) => {
      const row = map[r.staff_id]; if (!row) return;
      if (r.no_points) return;
      if (r.is_late) row.late++; else row.onTime++;
    });
    (taskRes.data || []).forEach((t: any) => {
      const row = map[t.assigned_to]; if (!row) return;
      const d = t.completed_at || t.created_at;
      if (d && d >= startISO && d < endISO) row.tasks++;
    });
    (outRes.data || []).forEach((o: any) => {
      const row = map[o.staff_id]; if (!row) return;
     if (o.no_points) return;
      row.outlets++;
      if (o.rating_bonus) row.ratingHits++;
    });

    Object.values(map).forEach(row => {
     row.points =
        (STARTING_POINTS[row.id] || 0) +
        row.onTime * PTS_ONTIME +
        row.late * PTS_LATE +
        row.tasks * PTS_TASK +
       row.ratingHits * PTS_RATING +
        row.outlets * PTS_OUTLET;
    });

    setRows(Object.values(map).sort((a, b) => b.points - a.points));
    setLoading(false);
  };

  const C = {
    bg: "#0a0a0a", panel: "#141414", border: "#262626",
    text: "#ffffff", muted: "#888888", accent: "#facc15",
  };
  const page: React.CSSProperties = { background: C.bg, color: C.text, minHeight: "100vh", fontFamily: "monospace", padding: "20px" };

  if (loading) {
    return <div style={{ ...page, display: "flex", alignItems: "center", justifyContent: "center", color: C.accent }}>Loading scores…</div>;
  }

  const isOwner = user?.role === "Owner" || user?.role === "Manager";
  const me = rows.find(r => r.id === user?.id);
  const myRank = rows.findIndex(r => r.id === user?.id) + 1;

  const th: React.CSSProperties = { textAlign: "right", padding: "10px 12px", color: C.muted, fontSize: "12px", borderBottom: `1px solid ${C.border}`, textTransform: "uppercase" };
  const td: React.CSSProperties = { textAlign: "right", padding: "12px", borderBottom: `1px solid ${C.border}` };

  return (
    <div style={page}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
        <h1 style={{ margin: 0, fontSize: "22px", color: C.accent, letterSpacing: "1px" }}>POINTS &amp; REWARDS</h1>
        <button onClick={() => router.push("/dashboard")}
          style={{ background: "transparent", color: C.accent, border: `1px solid ${C.accent}`, padding: "8px 14px", cursor: "pointer", fontFamily: "monospace" }}>
          ← DASHBOARD
        </button>
      </div>
      <div style={{ color: C.muted, marginBottom: "18px", fontSize: "13px" }}>{monthLabel}</div>

      <div style={{ background: C.panel, border: `1px solid ${C.accent}`, padding: "12px 16px", marginBottom: "22px", fontSize: "14px" }}>
        🏆 Monthly winner gets <span style={{ color: C.accent, fontWeight: "bold" }}>₹1000</span>
      </div>

      {!isOwner && me && (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, padding: "20px", marginBottom: "26px" }}>
          <div style={{ color: C.muted, fontSize: "12px", textTransform: "uppercase" }}>Your Score</div>
          <div style={{ fontSize: "48px", color: C.accent, fontWeight: "bold", lineHeight: 1.1 }}>{me.points}</div>
          <div style={{ color: C.muted, marginBottom: "16px" }}>Rank #{myRank} of {rows.length}</div>
          <div style={{ fontSize: "13px", lineHeight: 1.9 }}>
           {(STARTING_POINTS[me.id] || 0) > 0 && <div>Starting credit: {STARTING_POINTS[me.id]}</div>}
            <div>On-time reports: {me.onTime} × {PTS_ONTIME} = {me.onTime * PTS_ONTIME}</div>
            <div>Late reports: {me.late} × {PTS_LATE} = {me.late * PTS_LATE}</div>
            <div>Tasks completed: {me.tasks} × {PTS_TASK} = {me.tasks * PTS_TASK}</div>
            <div>Outlet reports: {me.outlets} × {PTS_OUTLET} = {me.outlets * PTS_OUTLET}</div>
            <div>4.5+ Google ratings: {me.ratingHits} × {PTS_RATING} = {me.ratingHits * PTS_RATING}</div>
          </div>
        </div>
      )}

      {isOwner && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>#</th>
                <th style={{ ...th, textAlign: "left" }}>Staff</th>
                <th style={th}>On-time</th>
                <th style={th}>Late</th>
                <th style={th}>Tasks</th>
                <th style={th}>4.5★</th>
                <th style={{ ...th, color: C.accent }}>Points</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} style={i === 0 ? { background: "rgba(250,204,21,0.08)" } : {}}>
                  <td style={{ ...td, textAlign: "left", color: C.accent }}>{i + 1}</td>
                  <td style={{ ...td, textAlign: "left" }}>
                    {r.name}
                    {i === 0 && <span style={{ marginLeft: "8px", background: C.accent, color: "#000", padding: "2px 6px", fontSize: "11px", fontWeight: "bold" }}>₹1000</span>}
                    <div style={{ color: C.muted, fontSize: "11px" }}>{r.role}</div>
                  </td>
                  <td style={td}>{r.onTime}</td>
                  <td style={td}>{r.late}</td>
                  <td style={td}>{r.tasks}</td>
                  <td style={td}>{r.ratingHits}</td>
                  <td style={{ ...td, color: C.accent, fontWeight: "bold", fontSize: "16px" }}>{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: "26px", color: C.muted, fontSize: "12px", lineHeight: 1.8 }}>
        On-time report = {PTS_ONTIME} · Late = {PTS_LATE} · Task done = {PTS_TASK} · BH Google rating &gt; {RATING_THRESHOLD} = {PTS_RATING}
      </div>
    </div>
  );
}
