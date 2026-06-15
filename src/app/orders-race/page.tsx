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
const ALLOWED = ["nishant", "nilani", "vishnu", "ahila"];

// The 3 managers and their 4 outlets each
const MANAGERS = [
  { id: "nilani", name: "Nilani", outlets: ["ra_puram", "anna_nagar", "pallavaram", "vadapalani"] },
  { id: "vishnu", name: "Vishnu", outlets: ["velachery", "perumbakkam", "tambaram", "porur"] },
  { id: "ahila", name: "Ahila", outlets: ["royapettah", "adayar", "bsr_mall", "besant_nagar"] },
];

const OUTLET_NAMES: Record<string, string> = {
  royapettah: "Royapettah", adayar: "Adyar", bsr_mall: "BSR Mall",
  velachery: "Velachery", ra_puram: "RA Puram", anna_nagar: "Anna Nagar",
  pallavaram: "Pallavaram", vadapalani: "Vadapalani", besant_nagar: "Besant Nagar",
  perumbakkam: "Perumbakkam", tambaram: "Tambaram", porur: "Porur",
};

type Counts = { swiggy: number; zomato: number };

export default function OrdersRacePage() {
  const router = useRouter();
  const [user, setUser] = useState<Staff | null>(null);
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [byOutlet, setByOutlet] = useState<Record<string, Counts>>({});
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

  // which outlets actually reported today
  const ALL_OUTLETS = MANAGERS.flatMap(m => m.outlets);
  const reportedCount = ALL_OUTLETS.filter(o => byOutlet[o]).length;
  const totalOutlets = ALL_OUTLETS.length;
  const missingCount = totalOutlets - reportedCount;

  // totals (only reported outlets contribute)
  const swiggyTotal = ALL_OUTLETS.reduce((s, o) => s + (byOutlet[o]?.swiggy || 0), 0);
  const zomatoTotal = ALL_OUTLETS.reduce((s, o) => s + (byOutlet[o]?.zomato || 0), 0);
  const grandTotal = swiggyTotal + zomatoTotal;

  // per-manager rollup, ranked
  const managerRows = MANAGERS.map(m => {
    let sw = 0, zo = 0;
    const outlets = m.outlets.map(o => {
      const c = byOutlet[o];
      const reported = !!c;
      const swiggy = c ? c.swiggy : 0;
      const zomato = c ? c.zomato : 0;
      sw += swiggy; zo += zomato;
      return { id: o, name: OUTLET_NAMES[o] || o, swiggy, zomato, total: swiggy + zomato, reported };
    });
    const missing = outlets.filter(o => !o.reported).length;
    return { ...m, swiggy: sw, zomato: zo, total: sw + zo, outlets, missing };
  }).sort((a, b) => b.total - a.total);

  const leaderTotal = managerRows[0]?.total || 0;
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

      {/* reported counter */}
      <div style={{ marginBottom: "22px", fontSize: "13px" }}>
        <span style={{ color: reportedCount === totalOutlets ? C.green : C.accent, fontWeight: "bold" }}>{reportedCount}</span>
        <span style={{ color: C.muted }}> / {totalOutlets} outlets reported</span>
        {missingCount > 0 && <span style={{ color: C.zomato, marginLeft: "10px" }}>· {missingCount} missing</span>}
      </div>

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
                  {i === 0 && m.total > 0 && <span style={{ marginLeft: "8px" }}>👑</span>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: C.accent, fontSize: "28px", fontWeight: "bold", lineHeight: 1 }}>{m.total}</div>
                  <div style={{ color: C.muted, fontSize: "11px" }}>orders</div>
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
                      </span>
                    ) : (
                      <span style={{ color: C.zomato, fontStyle: "italic" }}>Not reported</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={{ marginTop: "20px", color: C.muted, fontSize: "11px", lineHeight: 1.8 }}>
            Per outlet shows <span style={{ color: C.swiggy }}>Swiggy</span> / <span style={{ color: C.zomato }}>Zomato</span> / Total ·
            Numbers come straight from the daily outlet reports.
          </div>
        </>
      )}
    </div>
  );
}
