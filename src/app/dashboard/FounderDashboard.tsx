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
const MONTHLY_TARGET = 8750000; // ₹87.5 L company-wide
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
const lakh = (n: number) => "₹" + (n / 100000).toFixed(2) + " L";

export default function FounderDashboard({ user }: { user: Staff }) {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [out, setOut] = useState<any[]>([]);
  const [month, setMonth] = useState<any[]>([]);
  const [daily, setDaily] = useState<any[]>([]);
  const [revs, setRevs] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const d0 = new Date(date + "T00:00:00");
  const monthStart = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, "0")}-01`;
  const daysInMonth = new Date(d0.getFullYear(), d0.getMonth() + 1, 0).getDate();
  const dayOfMonth = d0.getDate();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [o, mo, d, r, p] = await Promise.all([
        supabase.from("outlet_reports").select("*").eq("report_date", date),
        supabase.from("outlet_reports").select("outlet_id,report_date,shop_sales_value,swiggy_sales_value,zomato_sales_value,swiggy_sales_count,zomato_sales_count").gte("report_date", monthStart).lte("report_date", date),
        supabase.from("reports").select("staff_id,report_date,is_late,is_backfill,no_points").eq("report_date", date),
        supabase.from("outlet_reviews").select("*").eq("report_date", date),
        supabase.from("outlet_payouts").select("outlet_id,platform,period_start,amount_transferable,net_payout").order("period_start", { ascending: false }).limit(60),
      ]);
      setOut(o.data || []); setMonth(mo.data || []); setDaily(d.data || []); setRevs(r.data || []); setPayouts(p.data || []);
      setLoading(false);
    })();
  }, [date, monthStart]);

  const n = (v: any) => Number(v) || 0;
  const sum = (rows: any[], k: string) => rows.reduce((s, r) => s + n(r[k]), 0);

  // today
  const tShop = sum(out, "shop_sales_value"), tSw = sum(out, "swiggy_sales_value"), tZo = sum(out, "zomato_sales_value");
  const tTotal = tShop + tSw + tZo;
  const swC = sum(out, "swiggy_sales_count"), zoC = sum(out, "zomato_sales_count");

  // month to date
  const mShop = sum(month, "shop_sales_value"), mOnline = sum(month, "swiggy_sales_value") + sum(month, "zomato_sales_value");
  const mtd = mShop + mOnline;
  const runRate = dayOfMonth > 0 ? mtd / dayOfMonth : 0;
  const projected = runRate * daysInMonth;
  const daysLeft = Math.max(daysInMonth - dayOfMonth, 0);
  const required = daysLeft > 0 ? (MONTHLY_TARGET - mtd) / daysLeft : 0;
  const targetPct = MONTHLY_TARGET > 0 ? (mtd / MONTHLY_TARGET) * 100 : 0;
  const shortfall = projected - MONTHLY_TARGET;
  const onTrack = projected >= MONTHLY_TARGET;
  const offlineRatio = mShop > 0 ? (mOnline / mShop) : 0;

  const filedDaily = new Set(daily.filter(x => !x.no_points).map(x => x.staff_id));
  const filedOutlets = new Set(out.map(r => r.outlet_id));

  const pts: Record<string, number> = {};
  daily.forEach(x => { if (x.no_points) return; pts[x.staff_id] = (pts[x.staff_id] || 0) + (x.is_backfill || x.is_late ? -5 : 10); });
  out.forEach(r => {
    const owner = OUTLET_OWNER[r.outlet_id]; if (!owner) return;
    let p = 0;
    if (r.no_points) p = 0; else if (r.is_backfill) p = -30; else if (r.is_late) p = 0;
    else { const t = n(r.target) || OUTLET_TARGETS[r.outlet_id]; const tot = n(r.shop_sales_value) + n(r.swiggy_sales_value) + n(r.zomato_sales_value); p = 20 + (t > 0 && tot >= t ? 30 : 0); }
    pts[owner] = (pts[owner] || 0) + p;
  });
  revs.forEach(rv => { const owner = OUTLET_OWNER[rv.outlet_id] || rv.staff_id; pts[owner] = (pts[owner] || 0) + reviewPoints(n(rv.rating), rv.valid_complaint); });

  const latestPay: Record<string, any> = {};
  payouts.forEach(p => { const k = p.outlet_id + "_" + p.platform; if (!latestPay[k]) latestPay[k] = p; });

  const Hero = ({ label, value, sub, accent }: any) => (
    <div className="flex-1 min-w-[150px] bg-gradient-to-b from-zinc-900 to-[#0e0e10] border border-zinc-800 p-5">
      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">{label}</p>
      <p className={`text-2xl md:text-3xl font-black ${accent || "text-white"}`}>{value}</p>
      {sub && <p className="text-[11px] text-zinc-500 mt-1">{sub}</p>}
    </div>
  );
  const Card = ({ title, children, right }: any) => (
    <div className="bg-[#131316] border border-zinc-800 p-5 mb-5">
      <div className="flex justify-between items-center mb-4"><p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{title}</p>{right}</div>
      {children}
    </div>
  );

  const dayLabel = d0.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div>
      <div className="flex flex-wrap justify-between items-end gap-3 mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight">Founder&apos;s Office</h2>
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">{dayLabel}</p>
        </div>
        <input type="date" max={today} value={date} onChange={e => setDate(e.target.value)} className="bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 text-sm font-mono" />
      </div>

      <p className="text-[11px] font-mono text-zinc-500 mb-5 border-l-2 border-yellow-400/40 pl-3">📊 Outlet sales reflect the <span className="text-yellow-400">previous day&apos;s</span> business — figures below are {new Date(d0.getTime() - 86400000).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}&apos;s sales, filed this morning.</p>

      {loading ? <p className="text-zinc-600 font-mono text-sm">Loading…</p> : (
        <>
          <div className="flex flex-wrap gap-3 mb-5">
            <Hero label="Today's sales" value={inr(tTotal)} sub={`${out.length}/12 reported`} accent="text-yellow-400" />
            <Hero label="Month to date" value={lakh(mtd)} sub={`${dayOfMonth} days`} />
            <Hero label="Projected month-end" value={lakh(projected)} sub={onTrack ? "on track" : "below target"} accent={onTrack ? "text-green-400" : "text-red-400"} />
          </div>

          <Card title={`Monthly target · ${d0.toLocaleDateString("en-IN", { month: "long" })}`}>
            <div className="flex justify-between text-xs mb-2"><span className="text-zinc-400">Achieved {lakh(mtd)}</span><span className="text-zinc-400">Target {lakh(MONTHLY_TARGET)}</span></div>
            <div className="h-3 bg-black border border-zinc-800 overflow-hidden mb-1"><div className="h-full bg-yellow-400" style={{ width: `${Math.min(targetPct, 100)}%` }} /></div>
            <p className="text-[11px] text-zinc-500 mb-4">{targetPct.toFixed(1)}% of target · {lakh(Math.max(MONTHLY_TARGET - mtd, 0))} to go</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-zinc-800">
              <div><p className="text-[10px] text-zinc-500 uppercase">Current run rate</p><p className="text-base font-bold">{lakh(runRate)}<span className="text-[10px] text-zinc-500">/day</span></p></div>
              <div><p className="text-[10px] text-zinc-500 uppercase">Required run rate</p><p className={`text-base font-bold ${required > runRate ? "text-red-400" : "text-green-400"}`}>{lakh(required)}<span className="text-[10px] text-zinc-500">/day</span></p></div>
              <div><p className="text-[10px] text-zinc-500 uppercase">Gap / day</p><p className={`text-base font-bold ${required > runRate ? "text-red-400" : "text-green-400"}`}>{required > runRate ? lakh(required - runRate) : "On pace"}</p></div>
              <div><p className="text-[10px] text-zinc-500 uppercase">Proj. shortfall</p><p className={`text-base font-bold ${shortfall >= 0 ? "text-green-400" : "text-red-400"}`}>{shortfall >= 0 ? "+" : "−"}{lakh(Math.abs(shortfall))}</p></div>
            </div>
            <p className="text-[11px] text-zinc-500 mt-3 pt-3 border-t border-zinc-800">Channel mix (MTD): Offline {lakh(mShop)} · Online {lakh(mOnline)} — for every ₹1 walk-in, <span className="text-yellow-400 font-bold">₹{offlineRatio.toFixed(1)}</span> online.</p>
          </Card>

          <Card title="Today — sales by channel" right={<span className="text-[10px] font-mono text-zinc-600">{dayOfMonth}/{daysInMonth}</span>}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><p className="text-[10px] text-zinc-500 uppercase">Shop</p><p className="text-lg font-bold">{inr(tShop)}</p></div>
              <div><p className="text-[10px] text-zinc-500 uppercase">Swiggy</p><p className="text-lg font-bold text-orange-400">{inr(tSw)}</p></div>
              <div><p className="text-[10px] text-zinc-500 uppercase">Zomato</p><p className="text-lg font-bold text-red-400">{inr(tZo)}</p></div>
              <div><p className="text-[10px] text-zinc-500 uppercase">Orders Sw / Zo</p><p className="text-lg font-bold">{swC} / {zoC}</p></div>
            </div>
          </Card>

          <Card title="Per-outlet · target hit/miss (today)">
            <div className="space-y-1">
              {OUTLETS.map(o => {
                const r = out.find(x => x.outlet_id === o);
                if (!r) return <div key={o} className="flex justify-between text-xs py-1.5 border-t border-zinc-800/60"><span className="text-zinc-500">{OUTLET_NAMES[o]}</span><span className="text-zinc-600">not reported</span></div>;
                const tot = n(r.shop_sales_value) + n(r.swiggy_sales_value) + n(r.zomato_sales_value);
                const t = n(r.target) || OUTLET_TARGETS[o]; const hit = t > 0 && tot >= t;
                return <div key={o} className="flex justify-between items-center text-xs py-1.5 border-t border-zinc-800/60"><span className="text-zinc-300">{OUTLET_NAMES[o]}</span><span className="font-mono">{inr(tot)} {t > 0 && <span className={hit ? "text-green-400 ml-1" : "text-red-400 ml-1"}>{hit ? "✓" : "✗"}</span>}</span></div>;
              })}
            </div>
          </Card>

          <Card title="Reporting status (today)">
            <p className="text-[10px] text-zinc-500 uppercase mb-1">Daily reports</p>
            <p className="text-xs mb-3">{DUTY_STAFF.map(s => <span key={s.id} className={filedDaily.has(s.id) ? "text-green-400 mr-3 inline-block" : "text-red-400 mr-3 inline-block"}>{filedDaily.has(s.id) ? "✓" : "✗"} {s.name}</span>)}</p>
            <p className="text-[10px] text-zinc-500 uppercase mb-1">Outlet reports</p>
            <p className="text-xs">{OUTLETS.map(o => <span key={o} className={filedOutlets.has(o) ? "text-green-400 mr-3 inline-block" : "text-red-400 mr-3 inline-block"}>{filedOutlets.has(o) ? "✓" : "✗"} {OUTLET_NAMES[o]}</span>)}</p>
          </Card>

          <Card title="Reviews & complaints (today)">
            {revs.length === 0 ? <p className="text-zinc-600 text-xs">No reviews logged.</p> : (
              <div className="space-y-1">
                <p className="text-xs text-zinc-400 mb-2">{revs.length} review(s) · {revs.filter(r => r.valid_complaint).length} valid complaint(s) · {revs.filter(r => r.refund_given).length} refunded</p>
                {revs.map(rv => { const p = reviewPoints(n(rv.rating), rv.valid_complaint); return (
                  <div key={rv.id} className="flex justify-between text-xs py-1 border-t border-zinc-800/60">
                    <span className="text-zinc-300">{OUTLET_NAMES[rv.outlet_id] || rv.outlet_id} · {rv.platform} · {rv.rating}★{rv.valid_complaint ? " · complaint" : ""}</span>
                    <span className={p >= 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>{p >= 0 ? "+" : ""}{p}</span>
                  </div>
                ); })}
              </div>
            )}
          </Card>

          <Card title={`Points earned · ${d0.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}>
            <div className="space-y-1">
              {DUTY_STAFF.map(s => (
                <div key={s.id} className="flex justify-between text-sm py-1.5 border-t border-zinc-800/60">
                  <span className="text-zinc-300">{s.name}</span>
                  <span className={`font-bold font-mono ${(pts[s.id] || 0) >= 0 ? "text-yellow-400" : "text-red-400"}`}>{(pts[s.id] || 0) >= 0 ? "+" : ""}{pts[s.id] || 0}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-zinc-600 mt-2">Daily +10 / late −5 · outlet +20 (+30 target) · reviews. Season totals on Leaderboard.</p>
          </Card>

          <Card title="Payout — latest week per outlet">
            <div className="space-y-1">
              {OUTLETS.map(o => {
                const sw = latestPay[o + "_swiggy"], zo = latestPay[o + "_zomato"];
                if (!sw && !zo) return null;
                return <div key={o} className="flex justify-between text-xs py-1 border-t border-zinc-800/60"><span className="text-zinc-300">{OUTLET_NAMES[o]}</span><span className="font-mono text-zinc-400">{sw ? `Sw ${inr(n(sw.amount_transferable))}` : ""} {zo ? `Zo ${inr(n(zo.net_payout))}` : ""}</span></div>;
              })}
              {OUTLETS.every(o => !latestPay[o + "_swiggy"] && !latestPay[o + "_zomato"]) && <p className="text-zinc-600 text-xs">No payout data yet.</p>}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
