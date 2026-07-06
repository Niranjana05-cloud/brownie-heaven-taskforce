"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Staff = { id: string; name: string; role: string };

// Only these people can open the race
const ALLOWED = ["nishant", "arun", "nilani", "vishnu", "ahila"];

// The 3 managers and their 4 outlets each
const MANAGERS = [
 { id: "nilani", name: "Nilani", outlets: [] },
  { id: "vishnu", name: "Vishnu", outlets: ["velachery", "perumbakkam", "tambaram", "porur", "anna_nagar", "vadapalani"] },
  { id: "ahila", name: "Ahila", outlets: ["royapettah", "adayar", "bsr_mall", "besant_nagar", "pallavaram", "ra_puram"] },
];

const OUTLET_NAMES: Record<string, string> = {
  royapettah: "Royapettah", adayar: "Adyar", bsr_mall: "BSR Mall",
  velachery: "Velachery", ra_puram: "RA Puram", anna_nagar: "Anna Nagar",
  pallavaram: "Pallavaram", vadapalani: "Vadapalani", besant_nagar: "Besant Nagar",
  perumbakkam: "Perumbakkam", tambaram: "Tambaram", porur: "Porur",
};

// Combined daily target (Swiggy + Zomato) per outlet.
// Basis: March Zomato avg/day x2 (Swiggy assumed ~= Zomato). null = no baseline yet.
const TARGET: Record<string, number | null> = {
  royapettah: 50,
  anna_nagar: 34,
  porur: 30,
  ra_puram: 13,
  adayar: 12,
  tambaram: 11,
  besant_nagar: 6,
  perumbakkam: 30,
  bsr_mall: null,
  velachery: null,
  pallavaram: null,
  vadapalani: null,
};

type Counts = { swiggy: number; zomato: number };

export default function OrdersRacePage() {
  const router = useRouter();
  const [user, setUser] = useState<Staff | null>(null);
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [byOutlet, setByOutlet] = useState<Record<string, Counts>>({});
  const [monthTotals, setMonthTotals] = useState<Counts>({ swiggy: 0, zomato: 0 });
  const [targets, setTargets] = useState<Record<string, number | null>>(TARGET);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // auth + access gate
  useEffect(() => {
    const stored = localStorage.getItem("currentUser");
    if (!stored) { router.push("/"); return; }
    let parsed: Staff;
    try {
      parsed = JSON.parse(stored);
      if (typeof parsed === "string") { localStorage.removeItem("currentUser"); router.push("/"); return; }
    } catch { localStorage.removeItem("currentUser"); router.push("/"); return; }
    if (!ALLOWED.includes(parsed.id)) { router.push("/dashboard"); return; }
    setUser(parsed);
  }, [router]);

  // load saved targets once
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("outlet_targets").select("outlet_id,target");
      if (data && data.length) {
        const t: Record<string, number | null> = { ...TARGET };
        (data as any[]).forEach(r => { t[r.outlet_id] = r.target === null ? null : Number(r.target); });
        setTargets(t);
      }
    })();
  }, [user]);

  // fetch the chosen day whenever user is set or date changes
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("outlet_reports")
        .select("outlet_id,swiggy_sales_count,zomato_sales_count")
        .eq("report_date", date);
      if (cancelled) return;
      const map: Record<string, Counts> = {};
      (data || []).forEach((r: any) => {
        map[r.outlet_id] = {
          swiggy: Number(r.swiggy_sales_count) || 0,
          zomato: Number(r.zomato_sales_count) || 0,
        };
      });
      setByOutlet(map);
      const ym = date.slice(0, 7);
      const [yy, mm] = ym.split("-").map(Number);
      const mStart = ym + "-01";
      const mEnd = mm === 12 ? `${yy + 1}-01-01` : `${yy}-${String(mm + 1).padStart(2, "0")}-01`;
      const { data: mData } = await supabase
        .from("outlet_reports")
        .select("swiggy_sales_count,zomato_sales_count")
        .gte("report_date", mStart).lt("report_date", mEnd);
      if (cancelled) return;
      let ms = 0, mz = 0;
      (mData || []).forEach((r: any) => { ms += Number(r.swiggy_sales_count) || 0; mz += Number(r.zomato_sales_count) || 0; });
      setMonthTotals({ swiggy: ms, zomato: mz });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, date]);

  const C = {
    bg: "#0a0a0a", panel: "#141414", border: "#262626",
    text: "#ffffff", muted: "#888888", accent: "#facc15",
    swiggy: "#fc8019", zomato: "#e23744", green: "#22c55e",
  };
  const page: React.CSSProperties = {
    background: C.bg, color: C.text, minHeight: "100vh",
    fontFamily: "monospace", padding: "20px",
  };

  const canEdit = user?.id === "nishant";
  const ALL_FOR_EDIT = MANAGERS.flatMap(m => m.outlets);

  const openEditor = () => {
    const d: Record<string, string> = {};
    ALL_FOR_EDIT.forEach(o => { const t = targets[o]; d[o] = t === null || t === undefined ? "" : String(t); });
    setDraft(d);
    setEditing(true);
  };

  const saveTargets = async () => {
    setSaving(true);
    const rows = ALL_FOR_EDIT.map(o => ({
      outlet_id: o,
      target: draft[o]?.trim() === "" || draft[o] === undefined ? null : Number(draft[o]),
    }));
    const { error } = await supabase.from("outlet_targets").upsert(rows, { onConflict: "outlet_id" });
    setSaving(false);
    if (error) { alert("Could not save targets: " + error.message); return; }
    const t: Record<string, number | null> = { ...targets };
    rows.forEach(r => { t[r.outlet_id] = r.target; });
    setTargets(t);
    setEditing(false);
  };

  // which outlets actually reported today
  const ALL_OUTLETS = MANAGERS.flatMap(m => m.outlets);
  const reportedCount = ALL_OUTLETS.filter(o => byOutlet[o]).length;
  const totalOutlets = ALL_OUTLETS.length;
  const missingCount = totalOutlets - reportedCount;

  // totals (only reported outlets contribute)
  const swiggyTotal = ALL_OUTLETS.reduce((s, o) => s + (byOutlet[o]?.swiggy || 0), 0);
  const zomatoTotal = ALL_OUTLETS.reduce((s, o) => s + (byOutlet[o]?.zomato || 0), 0);
  const grandTotal = swiggyTotal + zomatoTotal;

  // per-manager rollup, ranked by wins (outlets beating target), then total orders
  const managerRows = MANAGERS.map(m => {
    let sw = 0, zo = 0, wins = 0;
    const outlets = m.outlets.map(o => {
      const c = byOutlet[o];
      const reported = !!c;
      const swiggy = c ? c.swiggy : 0;
      const zomato = c ? c.zomato : 0;
      const total = swiggy + zomato;
      sw += swiggy; zo += zomato;
      const target = targets[o] ?? null;
      const win = reported && target !== null && total >= target;
      if (win) wins += 1;
      return { id: o, name: OUTLET_NAMES[o] || o, swiggy, zomato, total, reported, target, win };
    });
    const missing = outlets.filter(o => !o.reported).length;
    return { ...m, swiggy: sw, zomato: zo, total: sw + zo, outlets, missing, wins };
  }).sort((a, b) => (b.wins - a.wins) || (b.total - a.total));

  const leaderTotal = Math.max(0, ...managerRows.map(r => r.total));
  const niceDate = new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric",
  });

  if (loading) {
    return <div style={{ ...page, display: "flex", alignItems: "center", justifyContent: "center", color: C.accent }}>Loading race…</div>;
  }

  const swiggyPct = grandTotal ? (swiggyTotal / grandTotal) * 100 : 50;
  const zomatoPct = grandTotal ? (zomatoTotal / grandTotal) * 100 : 50;
  const platformGap = Math.abs(swiggyTotal - zomatoTotal);
 const platformLeader = swiggyTotal === zomatoTotal ? null : (swiggyTotal > zomatoTotal ? "Swiggy" : "Zomato");
  const monthTotal = monthTotals.swiggy + monthTotals.zomato;
  const monthSwiggyPct = monthTotal ? (monthTotals.swiggy / monthTotal) * 100 : 50;
  const monthZomatoPct = monthTotal ? (monthTotals.zomato / monthTotal) * 100 : 50;
  const monthGap = Math.abs(monthTotals.swiggy - monthTotals.zomato);
  const monthLeader = monthTotals.swiggy === monthTotals.zomato ? null : (monthTotals.swiggy > monthTotals.zomato ? "Swiggy" : "Zomato");
  const monthLabel = new Date(date + "T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div style={page}>
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
        <h1 style={{ margin: 0, fontSize: "22px", color: C.accent, letterSpacing: "1px" }}>ORDERS RACE</h1>
        <button onClick={() => router.push("/dashboard")}
          style={{ background: "transparent", color: C.accent, border: `1px solid ${C.accent}`, padding: "8px 14px", cursor: "pointer", fontFamily: "monospace" }}>
          ← DASHBOARD
        </button>
      </div>
      <div style={{ color: C.muted, marginBottom: "16px", fontSize: "13px" }}>SWIGGY vs ZOMATO · {niceDate}</div>

      {/* date picker */}
      <div style={{ marginBottom: "22px" }}>
        <label style={{ color: C.muted, fontSize: "12px", textTransform: "uppercase", marginRight: "10px" }}>Date</label>
        <input
          type="date"
          value={date}
          max={new Date().toISOString().split("T")[0]}
          onChange={e => setDate(e.target.value)}
          style={{ background: C.panel, color: C.text, border: `1px solid ${C.border}`, padding: "8px 10px", fontFamily: "monospace", colorScheme: "dark" }}
        />
      </div>

      {/* edit targets (Nishant only) */}
      {canEdit && !editing && (
        <div style={{ marginBottom: "22px" }}>
          <button onClick={openEditor}
            style={{ background: "transparent", color: C.muted, border: `1px solid ${C.border}`, padding: "7px 12px", cursor: "pointer", fontFamily: "monospace", fontSize: "12px" }}>
            ✎ Edit targets
          </button>
        </div>
      )}

      {canEdit && editing && (
        <div style={{ background: C.panel, border: `1px solid ${C.accent}`, padding: "18px", marginBottom: "22px" }}>
          <div style={{ color: C.accent, fontSize: "13px", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>Set daily targets</div>
          <div style={{ color: C.muted, fontSize: "11px", marginBottom: "14px" }}>Combined Swiggy + Zomato orders per day. Leave blank for no target.</div>
          {MANAGERS.map(m => (
            <div key={m.id} style={{ marginBottom: "12px" }}>
              <div style={{ color: C.muted, fontSize: "11px", textTransform: "uppercase", marginBottom: "6px" }}>{m.name}</div>
              {m.outlets.map(o => (
                <div key={o} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                  <span style={{ fontSize: "13px" }}>{OUTLET_NAMES[o] || o}</span>
                  <input
                    type="number"
                    value={draft[o] ?? ""}
                    placeholder="—"
                    onChange={e => setDraft({ ...draft, [o]: e.target.value })}
                    style={{ width: "80px", background: C.bg, color: C.text, border: `1px solid ${C.border}`, padding: "6px 8px", fontFamily: "monospace", textAlign: "right" }}
                  />
                </div>
              ))}
            </div>
          ))}
          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button onClick={saveTargets} disabled={saving}
              style={{ background: C.accent, color: "#000", border: "none", padding: "9px 18px", cursor: "pointer", fontFamily: "monospace", fontWeight: "bold" }}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setEditing(false)} disabled={saving}
              style={{ background: "transparent", color: C.muted, border: `1px solid ${C.border}`, padding: "9px 18px", cursor: "pointer", fontFamily: "monospace" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* reported counter */}
      <div style={{ marginBottom: "22px", fontSize: "13px" }}>
        <span style={{ color: reportedCount === totalOutlets ? C.green : C.accent, fontWeight: "bold" }}>{reportedCount}</span>
        <span style={{ color: C.muted }}> / {totalOutlets} outlets reported</span>
        {missingCount > 0 && <span style={{ color: C.zomato, marginLeft: "10px" }}>· {missingCount} missing</span>}
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.accent}`, padding: "20px", marginBottom: "26px" }}>
        <div style={{ color: C.muted, fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" }}>This Month · {monthLabel}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "12px" }}>
          <div>
            <div style={{ color: C.swiggy, fontSize: "12px", textTransform: "uppercase", fontWeight: "bold" }}>Swiggy</div>
            <div style={{ color: C.swiggy, fontSize: "40px", fontWeight: "bold", lineHeight: 1 }}>{monthTotals.swiggy}</div>
          </div>
          <div style={{ color: C.muted, fontSize: "14px", paddingBottom: "6px" }}>VS</div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: C.zomato, fontSize: "12px", textTransform: "uppercase", fontWeight: "bold" }}>Zomato</div>
            <div style={{ color: C.zomato, fontSize: "40px", fontWeight: "bold", lineHeight: 1 }}>{monthTotals.zomato}</div>
          </div>
        </div>
        <div style={{ display: "flex", height: "16px", borderRadius: "3px", overflow: "hidden", border: `1px solid ${C.border}` }}>
          <div style={{ width: `${monthSwiggyPct}%`, background: C.swiggy }} />
          <div style={{ width: `${monthZomatoPct}%`, background: C.zomato }} />
        </div>
        <div style={{ textAlign: "center", marginTop: "12px", fontSize: "13px" }}>
          {monthLeader
            ? <span><span style={{ color: monthLeader === "Swiggy" ? C.swiggy : C.zomato, fontWeight: "bold" }}>{monthLeader}</span> leads by {monthGap} order{monthGap === 1 ? "" : "s"}</span>
            : <span style={{ color: C.muted }}>Dead heat — {monthTotals.swiggy} each</span>}
        </div>
      </div>

      <div style={{ color: C.muted, fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" }}>Selected Day</div>

      {reportedCount === 0 ? (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, padding: "26px", textAlign: "center", color: C.muted }}>
          No outlet has reported for {niceDate} yet.
        </div>
      ) : (
        <>
          {/* SWIGGY vs ZOMATO head-to-head */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, padding: "20px", marginBottom: "26px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "12px" }}>
              <div>
                <div style={{ color: C.swiggy, fontSize: "12px", textTransform: "uppercase", fontWeight: "bold" }}>Swiggy</div>
                <div style={{ color: C.swiggy, fontSize: "40px", fontWeight: "bold", lineHeight: 1 }}>{swiggyTotal}</div>
              </div>
              <div style={{ color: C.muted, fontSize: "14px", paddingBottom: "6px" }}>VS</div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: C.zomato, fontSize: "12px", textTransform: "uppercase", fontWeight: "bold" }}>Zomato</div>
                <div style={{ color: C.zomato, fontSize: "40px", fontWeight: "bold", lineHeight: 1 }}>{zomatoTotal}</div>
              </div>
            </div>
            {/* proportional bar */}
            <div style={{ display: "flex", height: "16px", borderRadius: "3px", overflow: "hidden", border: `1px solid ${C.border}` }}>
              <div style={{ width: `${swiggyPct}%`, background: C.swiggy }} />
              <div style={{ width: `${zomatoPct}%`, background: C.zomato }} />
            </div>
            <div style={{ textAlign: "center", marginTop: "12px", fontSize: "13px" }}>
              {platformLeader
                ? <span><span style={{ color: platformLeader === "Swiggy" ? C.swiggy : C.zomato, fontWeight: "bold" }}>{platformLeader}</span> leads by {platformGap} order{platformGap === 1 ? "" : "s"}</span>
                : <span style={{ color: C.muted }}>Dead heat — {swiggyTotal} each</span>}
            </div>
          </div>

          {/* MANAGER RACE */}
          <div style={{ color: C.muted, fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" }}>Manager Race</div>
          {managerRows.map((m, i) => (
            <div key={m.id} style={{
              background: C.panel,
              border: i === 0 ? `1px solid ${C.accent}` : `1px solid ${C.border}`,
              padding: "16px", marginBottom: "14px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <div style={{ fontSize: "16px", fontWeight: "bold" }}>
                  <span style={{ color: C.accent, marginRight: "10px" }}>#{i + 1}</span>
                  {m.name}
                  {i === 0 && m.wins > 0 && <span style={{ marginLeft: "8px" }}>👑</span>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: m.wins > 0 ? C.green : C.muted, fontSize: "28px", fontWeight: "bold", lineHeight: 1 }}>
                    {m.wins}<span style={{ color: C.muted, fontSize: "15px" }}>/4</span>
                  </div>
                  <div style={{ color: C.muted, fontSize: "11px" }}>beat target · {m.total} orders</div>
                </div>
              </div>
              {/* bar relative to leader */}
              <div style={{ height: "8px", background: "#000", borderRadius: "3px", overflow: "hidden", marginBottom: "10px" }}>
                <div style={{ width: `${leaderTotal ? (m.total / leaderTotal) * 100 : 0}%`, height: "100%", background: i === 0 ? C.accent : C.muted }} />
              </div>
              <div style={{ fontSize: "12px", color: C.muted, marginBottom: "10px" }}>
                <span style={{ color: C.swiggy }}>Swiggy {m.swiggy}</span>
                <span style={{ margin: "0 8px" }}>·</span>
                <span style={{ color: C.zomato }}>Zomato {m.zomato}</span>
                {m.missing > 0 && <span style={{ color: C.zomato, marginLeft: "8px" }}>· {m.missing} not reported</span>}
              </div>
              {/* per-outlet breakdown */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: "8px" }}>
                {m.outlets.map(o => (
                  <div key={o.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", padding: "3px 0" }}>
                    <span style={{ color: C.muted }}>{o.name}</span>
                    {o.reported ? (
                      <span>
                        <span style={{ color: C.swiggy }}>{o.swiggy}</span>
                        <span style={{ color: C.muted, margin: "0 5px" }}>/</span>
                        <span style={{ color: C.zomato }}>{o.zomato}</span>
                        <span style={{ color: C.text, marginLeft: "10px", fontWeight: "bold" }}>{o.total}</span>
                        {o.target !== null ? (
                          <span style={{ marginLeft: "10px" }}>
                            {o.win
                              ? <span style={{ color: C.green }}>✅ +{o.total - o.target}</span>
                              : <span style={{ color: C.zomato }}>{o.total - o.target}</span>}
                            <span style={{ color: C.muted, marginLeft: "6px" }}>tgt {o.target}</span>
                          </span>
                        ) : (
                          <span style={{ marginLeft: "10px", color: C.accent, fontStyle: "italic" }}>set target</span>
                        )}
                      </span>
                    ) : (
                      <span style={{ color: C.zomato, fontStyle: "italic" }}>
                        Not reported{o.target !== null ? <span style={{ color: C.muted, fontStyle: "normal" }}> · tgt {o.target}</span> : null}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={{ marginTop: "20px", color: C.muted, fontSize: "11px", lineHeight: 1.8 }}>
            Per outlet: <span style={{ color: C.swiggy }}>Swiggy</span> / <span style={{ color: C.zomato }}>Zomato</span> / Total · then result vs target.
            <span style={{ color: C.green }}> ✅ = beat its daily target</span>. Ranking is by outlets that beat target.
          </div>
        </>
      )}
    </div>
  );
}
