"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Staff = { id: string; name: string; role: string; outlets?: string[] };

const OUTLETS = ["royapettah","adayar","bsr_mall","velachery","ra_puram","anna_nagar","pallavaram","vadapalani","besant_nagar","perumbakkam","tambaram","porur"];
const OUTLET_NAMES: Record<string, string> = {
  royapettah: "Royapettah", adayar: "Adyar", bsr_mall: "BSR Mall", velachery: "Velachery",
  ra_puram: "RA Puram", anna_nagar: "Anna Nagar", pallavaram: "Pallavaram", vadapalani: "Vadapalani",
  besant_nagar: "Besant Nagar", perumbakkam: "Perumbakkam", tambaram: "Tambaram", porur: "Porur",
};
const OUTLET_TARGETS: Record<string, number> = {
  royapettah: 80000, adayar: 18333, bsr_mall: 35000, ra_puram: 21666, anna_nagar: 50000,
  porur: 50000, perumbakkam: 13000, tambaram: 20000, velachery: 0, pallavaram: 0, vadapalani: 23333, besant_nagar: 11667,
};
const DUTY_STAFF = [
  { id: "arun", name: "Arun" }, { id: "nilani", name: "Nilani" }, { id: "vishnu", name: "Vishnu" },
  { id: "ahila", name: "Ahila" }, { id: "gowtham", name: "Gowtham" }, { id: "bharani", name: "Bharani" },
];
const OUTLET_OWNER: Record<string, string> = {
  ra_puram: "nilani", anna_nagar: "nilani", pallavaram: "nilani", vadapalani: "nilani",
  velachery: "vishnu", perumbakkam: "vishnu", tambaram: "vishnu", porur: "vishnu",
  royapettah: "ahila", adayar: "ahila", bsr_mall: "ahila", besant_nagar: "ahila",
};
const reviewPoints = (rating: number, valid: boolean) => {
  let p = 0;
  if (rating === 5) p += 5; else if (rating === 4) p += 3; else if (rating >= 1 && rating <= 2) p -= 5;
  if (valid) p -= 10;
  return p;
};
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export default function FounderDashboard({ user }: { user: Staff }) {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [out, setOut] = useState<any[]>([]);
  const [daily, setDaily] = useState<any[]>([]);
  const [revs, setRevs] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [o, d, r, p] = await Promise.all([
        supabase.from("outlet_reports").select("*").eq("report_date", date),
        supabase.from("reports").select("staff_id,report_date,is_late,is_backfill,no_points").eq("report_date", date),
        supabase.from("outlet_reviews").select("*").eq("report_date", date),
        supabase.from("outlet_payouts").select("outlet_id,platform,period_start,period_end,total_orders,amount_transferable,net_payout").order("period_start", { ascending: false }).limit(60),
      ]);
      setOut(o.data || []); setDaily(d.data || []); setRevs(r.data || []); setPayouts(p.data || []);
      setLoading(false);
    })();
  }, [date]);

  const num = (v: any) => Number(v) || 0;
  const sum = (k: string) => out.reduce((s, r) => s + num(r[k]), 0);
  const shopV = sum("shop_sales_value"), swV = sum("swiggy_sales_value"), zoV = sum("zomato_sales_value");
  const totalV = shopV + swV + zoV;
  const swC = sum("swiggy_sales_count"), zoC = sum("zomato_sales_count");

  const filedDaily = new Set(daily.filter(d => !d.no_points).map(d => d.staff_id));
  const filedOutlets = new Set(out.map(r => r.outlet_id));

  // points earned on this date
  const pts: Record<string, number> = {};
  daily.forEach(d => { if (d.no_points) return; pts[d.staff_id] = (pts[d.staff_id] || 0) + (d.is_backfill || d.is_late ? -5 : 10); });
  out.forEach(r => {
    const owner = OUTLET_OWNER[r.outlet_id]; if (!owner) return;
    let p = 0;
    if (r.no_points) p = 0;
    else if (r.is_backfill) p = -30;
    else if (r.is_late) p = 0;
    else { const t = num(r.target) || OUTLET_TARGETS[r.outlet_id]; const tot = num(r.shop_sales_value) + num(r.swiggy_sales_value) + num(r.zomato_sales_value); p = 20 + (t > 0 && tot >= t ? 30 : 0); }
    pts[owner] = (pts[owner] || 0) + p;
  });
  revs.forEach(rv => { const owner = OUTLET_OWNER[rv.outlet_id] || rv.staff_id; pts[owner] = (pts[owner] || 0) + reviewPoints(num(rv.rating), rv.valid_complaint); });

  // latest payout per outlet+platform
  const latestPay: Record<string, any> = {};
  payouts.forEach(p => { const k = p.outlet_id + "_" + p.platform; if (!latestPay[k]) latestPay[k] = p; });

  const Card = ({ title, children }: any) => (
    <div className="bg-[#131316] border border-zinc-800 p-5 mb-5">
      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-4">{title}</p>
      {children}
    </div>
  );

  const dayLabel = new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", year: "numeric" });

  return (
    <div>
      <div className="flex flex-wrap justify-between items-end gap-3 mb-6 pb-5 border-b border-zinc-800">
        <div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight">Founder&apos;s Office</h2>
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">{dayLabel}</p>
        </div>
        <input type="date" max={today} value={date} onChange={e => setDate(e.target.value)} className="bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 text-sm font-mono" />
      </div>

      {loading ? <p className="text-zinc-600 font-mono text-sm">Loading…</p> : (
        <>
          <Card title="Total sales — all outlets">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><p className="text-[10px] text-zinc-500 uppercase">Shop</p><p className="text-lg font-bold">{inr(shopV)}</p></div>
              <div><p className="text-[10px] text-zinc-500 uppercase">Swiggy</p><p className="text-lg font-bold text-orange-400">{inr(swV)}</p></div>
              <div><p className="text-[10px] text-zinc-500 uppercase">Zomato</p><p className="text-lg font-bold text-red-400">{inr(zoV)}</p></div>
              <div><p className="text-[10px] text-zinc-500 uppercase">Total</p><p className="text-lg font-bold text-yellow-400">{inr(totalV)}</p></div>
            </div>
            <p className="text-[11px] font-mono text-zinc-500 mt-3">{out.length} / 12 outlets reported</p>
          </Card>

          <Card title="Swiggy vs Zomato — orders">
            <div className="flex items-center justify-between">
              <div><p className="text-[10px] text-orange-400 uppercase font-bold">Swiggy</p><p className="text-3xl font-bold text-orange-400">{swC}</p></div>
              <span className="text-zinc-600 text-sm">vs</span>
              <div className="text-right"><p className="text-[10px] text-red-400 uppercase font-bold">Zomato</p><p className="text-3xl font-bold text-red-400">{zoC}</p></div>
            </div>
            <p className="text-center text-xs text-zinc-400 mt-2">{swC === zoC ? "Tied" : swC > zoC ? `Swiggy leads by ${swC - zoC}` : `Zomato leads by ${zoC - swC}`}</p>
          </Card>

          <Card title="Per-outlet sales · target hit/miss">
            <div className="space-y-1">
              {OUTLETS.map(o => {
                const r = out.find(x => x.outlet_id === o);
                if (!r) return <div key={o} className="flex justify-between text-xs py-1 border-t border-zinc-800/60"><span className="text-zinc-500">{OUTLET_NAMES[o]}</span><span className="text-zinc-600">— not reported</span></div>;
                const tot = num(r.shop_sales_value) + num(r.swiggy_sales_value) + num(r.zomato_sales_value);
                const t = num(r.target) || OUTLET_TARGETS[o];
                const hit = t > 0 && tot >= t;
                return <div key={o} className="flex justify-between items-center text-xs py-1 border-t border-zinc-800/60"><span className="text-zinc-300">{OUTLET_NAMES[o]}</span><span className="font-mono">{inr(tot)} {t > 0 && <span className={hit ? "text-green-400" : "text-red-400"}>{hit ? "✓ hit" : "✗ miss"}</span>}</span></div>;
              })}
            </div>
          </Card>

          <Card title="Who filed · who's missing">
            <p className="text-[10px] text-zinc-500 uppercase mb-1">Daily reports</p>
            <p className="text-xs text-zinc-300 mb-3">{DUTY_STAFF.map(s => <span key={s.id} className={filedDaily.has(s.id) ? "text-green-400 mr-3" : "text-red-400 mr-3"}>{filedDaily.has(s.id) ? "✓" : "✗"} {s.name}</span>)}</p>
            <p className="text-[10px] text-zinc-500 uppercase mb-1">Outlet reports</p>
            <p className="text-xs text-zinc-300">{OUTLETS.map(o => <span key={o} className={filedOutlets.has(o) ? "text-green-400 mr-3" : "text-red-400 mr-3"}>{filedOutlets.has(o) ? "✓" : "✗"} {OUTLET_NAMES[o]}</span>)}</p>
          </Card>

          <Card title="Reviews & valid complaints">
            {revs.length === 0 ? <p className="text-zinc-600 text-xs">No reviews logged for this date.</p> : (
              <div className="space-y-1">
                <p className="text-xs text-zinc-400 mb-2">{revs.length} review{revs.length === 1 ? "" : "s"} · {revs.filter(r => r.valid_complaint).length} valid complaint(s) · {revs.filter(r => r.refund_given).length} refunded</p>
                {revs.map(rv => { const p = reviewPoints(num(rv.rating), rv.valid_complaint); return (
                  <div key={rv.id} className="flex justify-between text-xs py-1 border-t border-zinc-800/60">
                    <span className="text-zinc-300">{OUTLET_NAMES[rv.outlet_id] || rv.outlet_id} · {rv.platform} · {rv.rating}★{rv.valid_complaint ? " · complaint" : ""}{rv.refund_given ? " · refunded" : ""}</span>
                    <span className={p >= 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>{p >= 0 ? "+" : ""}{p}</span>
                  </div>
                ); })}
              </div>
            )}
          </Card>

          <Card title={`Points earned on ${new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}>
            <div className="space-y-1">
              {DUTY_STAFF.map(s => (
                <div key={s.id} className="flex justify-between text-sm py-1 border-t border-zinc-800/60">
                  <span className="text-zinc-300">{s.name}</span>
                  <span className={`font-bold font-mono ${(pts[s.id] || 0) >= 0 ? "text-yellow-400" : "text-red-400"}`}>{(pts[s.id] || 0) >= 0 ? "+" : ""}{pts[s.id] || 0}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-zinc-600 mt-2">Daily +10 / late −5 · outlet +20 (+30 target) · reviews · see Leaderboard for season totals.</p>
          </Card>

          <Card title="Payout — latest week per outlet">
            <div className="space-y-1">
              {OUTLETS.map(o => {
                const sw = latestPay[o + "_swiggy"], zo = latestPay[o + "_zomato"];
                if (!sw && !zo) return null;
                return <div key={o} className="flex justify-between text-xs py-1 border-t border-zinc-800/60">
                  <span className="text-zinc-300">{OUTLET_NAMES[o]}</span>
                  <span className="font-mono text-zinc-400">{sw ? `Sw ${inr(num(sw.amount_transferable))}` : ""} {zo ? `Zo ${inr(num(zo.net_payout))}` : ""}</span>
                </div>;
              })}
              {OUTLETS.every(o => !latestPay[o + "_swiggy"] && !latestPay[o + "_zomato"]) && <p className="text-zinc-600 text-xs">No payout data yet.</p>}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
