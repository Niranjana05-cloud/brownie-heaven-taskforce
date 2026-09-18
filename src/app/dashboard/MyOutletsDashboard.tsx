"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Staff = { id: string; name: string; role: string; outlets?: string[] };

const OUTLET_NAMES: Record<string, string> = {
  royapettah: "Royapettah", adayar: "Adyar", bsr_mall: "BSR Mall", velachery: "Velachery",
  ra_puram: "RA Puram", anna_nagar: "Anna Nagar", pallavaram: "Pallavaram", vadapalani: "Vadapalani",
  besant_nagar: "Besant Nagar", perumbakkam: "Perumbakkam", tambaram: "Tambaram", porur: "Porur",
};

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const shortDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const weekdayName = (d: Date) => d.toLocaleDateString("en-IN", { weekday: "long" });

type OutletRow = {
  outlet_id: string; report_date: string;
  shop_sales_value: number | null; swiggy_sales_value: number | null; zomato_sales_value: number | null;
  swiggy_sales_count: number | null; zomato_sales_count: number | null;
};

// outlet_reports.report_date is the FILING date, not the sale date — a row
// filed under date D actually holds sales from D-1 ("you're filing
// yesterday's sales, recorded under today's date" — same text staff see on
// the daily report form). This turns a filed row's date into the real date
// the sales happened on.
const actualSaleDate = (filedDateStr: string) => new Date(new Date(filedDateStr + "T00:00:00").getTime() - 86400000);

export default function MyOutletsDashboard({ user }: { user: Staff }) {
  const myOutlets = user.outlets || [];
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<OutletRow[]>([]);
  const [tick, setTick] = useState(0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - 86400000);
  const yesterdayIso = isoDate(yesterday);

  // Default window: last 7 real sale-days, ending yesterday.
  const defaultEnd = yesterday;
  const defaultStart = new Date(defaultEnd.getTime() - 6 * 86400000);

  const [customFrom, setCustomFrom] = useState<string>(isoDate(defaultStart));
  const [customTo, setCustomTo] = useState<string>(isoDate(defaultEnd));

  const effectiveStart = new Date(customFrom + "T00:00:00");
  const effectiveEndRaw = new Date(customTo + "T00:00:00");
  const effectiveEnd = effectiveEndRaw.getTime() > yesterday.getTime() ? yesterday : effectiveEndRaw;
  const numDays = Math.max(1, Math.round((effectiveEnd.getTime() - effectiveStart.getTime()) / 86400000) + 1);

  const compareEnd = new Date(effectiveStart.getTime() - 86400000);
  const compareStart = new Date(compareEnd.getTime() - (numDays - 1) * 86400000);

  const filedRangeFor = (saleStart: Date, saleEnd: Date) => ({
    from: isoDate(new Date(saleStart.getTime() + 86400000)),
    to: isoDate(new Date(saleEnd.getTime() + 86400000)),
  });
  const curFiled = filedRangeFor(effectiveStart, effectiveEnd);
  const cmpFiled = filedRangeFor(compareStart, compareEnd);

  const isDefaultRange = customFrom === isoDate(defaultStart) && customTo === isoDate(defaultEnd);

  useEffect(() => {
    if (myOutlets.length === 0) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("outlet_reports")
        .select("outlet_id, report_date, shop_sales_value, swiggy_sales_value, zomato_sales_value, swiggy_sales_count, zomato_sales_count")
        .in("outlet_id", myOutlets)
        .gte("report_date", cmpFiled.from)
        .lte("report_date", curFiled.to);
      setRows(data || []);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customFrom, customTo]);

  // Rotate the insight box every 5 seconds.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const sum = (list: OutletRow[], field: keyof OutletRow) => list.reduce((s, r) => s + (Number(r[field]) || 0), 0);
  const inCur = (r: OutletRow) => r.report_date >= curFiled.from && r.report_date <= curFiled.to;
  const inCmp = (r: OutletRow) => r.report_date >= cmpFiled.from && r.report_date <= cmpFiled.to;

  const perOutlet = useMemo(() => myOutlets.map((oid) => {
    const outletRows = rows.filter((r) => r.outlet_id === oid);
    const cur = outletRows.filter(inCur);
    const cmp = outletRows.filter(inCmp);

    const curSales = sum(cur, "shop_sales_value") + sum(cur, "swiggy_sales_value") + sum(cur, "zomato_sales_value");
    const cmpSales = sum(cmp, "shop_sales_value") + sum(cmp, "swiggy_sales_value") + sum(cmp, "zomato_sales_value");

    const curOnlineSales = sum(cur, "swiggy_sales_value") + sum(cur, "zomato_sales_value");
    const cmpOnlineSales = sum(cmp, "swiggy_sales_value") + sum(cmp, "zomato_sales_value");
    const curOnlineOrders = sum(cur, "swiggy_sales_count") + sum(cur, "zomato_sales_count");
    const cmpOnlineOrders = sum(cmp, "swiggy_sales_count") + sum(cmp, "zomato_sales_count");

    const diff = curSales - cmpSales;
    const pct = cmpSales > 0 ? (diff / cmpSales) * 100 : null;

    // Every signal below is computed only from real numbers already in
    // outlet_reports. Nothing here is invented — an outlet with no real
    // signal this period just shows fewer (or zero) messages, on purpose.
    const signals: string[] = [];

    // Signal 1: orders vs average order value (Swiggy/Zomato only — no
    // walk-in order count exists to do this for shop sales).
    if (curOnlineOrders > 0 && cmpOnlineOrders > 0) {
      const orderDiffPct = ((curOnlineOrders - cmpOnlineOrders) / cmpOnlineOrders) * 100;
      const curAvg = curOnlineSales / curOnlineOrders;
      const cmpAvg = cmpOnlineSales / cmpOnlineOrders;
      const avgDiffPct = cmpAvg > 0 ? ((curAvg - cmpAvg) / cmpAvg) * 100 : 0;

      if (Math.abs(orderDiffPct) >= 8 && Math.abs(orderDiffPct) >= Math.abs(avgDiffPct)) {
        signals.push(orderDiffPct < 0
          ? `Fewer Swiggy/Zomato orders this period (${Math.round(curOnlineOrders)} vs ${Math.round(cmpOnlineOrders)} last period)`
          : `More Swiggy/Zomato orders this period (${Math.round(curOnlineOrders)} vs ${Math.round(cmpOnlineOrders)} last period)`);
      } else if (Math.abs(avgDiffPct) >= 8) {
        signals.push(avgDiffPct < 0
          ? `Similar order count, but each Swiggy/Zomato order was smaller on average (${inr(curAvg)} vs ${inr(cmpAvg)})`
          : `Similar order count, but each Swiggy/Zomato order was bigger on average (${inr(curAvg)} vs ${inr(cmpAvg)})`);
      }
    } else if (curOnlineOrders === 0 && cmpOnlineOrders === 0 && Math.abs(diff) > 0) {
      signals.push("This is entirely walk-in (shop) sales — no Swiggy/Zomato orders either period.");
    }

    // Signal 2: Swiggy vs Zomato — did one channel move much more than the other?
    const curSwiggy = sum(cur, "swiggy_sales_value");
    const cmpSwiggy = sum(cmp, "swiggy_sales_value");
    const curZomato = sum(cur, "zomato_sales_value");
    const cmpZomato = sum(cmp, "zomato_sales_value");
    if (cmpSwiggy > 0 && cmpZomato > 0) {
      const swiggyPct = ((curSwiggy - cmpSwiggy) / cmpSwiggy) * 100;
      const zomatoPct = ((curZomato - cmpZomato) / cmpZomato) * 100;
      if (Math.abs(swiggyPct - zomatoPct) >= 15) {
        const worse = swiggyPct < zomatoPct ? "Swiggy" : "Zomato";
        const better = worse === "Swiggy" ? "Zomato" : "Swiggy";
        const worsePct = worse === "Swiggy" ? swiggyPct : zomatoPct;
        const betterPct = worse === "Swiggy" ? zomatoPct : swiggyPct;
        signals.push(`${worse} moved a lot more than ${better} this period (${worse} ${worsePct >= 0 ? "+" : ""}${worsePct.toFixed(0)}%, ${better} ${betterPct >= 0 ? "+" : ""}${betterPct.toFixed(0)}%)`);
      }
    }

    // Signal 3: one day stood out — real daily totals, not a guess.
    if (numDays >= 3) {
      const dailyTotals: Record<string, number> = {};
      cur.forEach((r) => {
        const d = isoDate(actualSaleDate(r.report_date));
        dailyTotals[d] = (dailyTotals[d] || 0) + (Number(r.shop_sales_value) || 0) + (Number(r.swiggy_sales_value) || 0) + (Number(r.zomato_sales_value) || 0);
      });
      const entries = Object.entries(dailyTotals);
      if (entries.length >= 3) {
        const avgDaily = curSales / numDays;
        const worstDay: [string, number] | null = entries.reduce((acc: [string, number] | null, [d, v]) => {
          if (avgDaily <= 0) return acc;
          if (!acc || Math.abs(v - avgDaily) > Math.abs(acc[1] - avgDaily)) return [d, v];
          return acc;
        }, null);
        if (worstDay) {
          const [dStr, dVal] = worstDay as [string, number];
          const devPct = avgDaily > 0 ? ((dVal - avgDaily) / avgDaily) * 100 : 0;
          if (Math.abs(devPct) >= 30) {
            const dDate = new Date(dStr + "T00:00:00");
            signals.push(devPct < 0
              ? `${weekdayName(dDate)} (${shortDate(dDate)}) was unusually low — ${inr(dVal)} vs a normal day of ${inr(avgDaily)}`
              : `${weekdayName(dDate)} (${shortDate(dDate)}) was unusually strong — ${inr(dVal)} vs a normal day of ${inr(avgDaily)}`);
          }
        }
      }
    }

    return { oid, name: OUTLET_NAMES[oid] || oid, curSales, cmpSales, diff, pct, signals };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [rows, myOutlets, curFiled.from, curFiled.to, cmpFiled.from, cmpFiled.to, numDays]);

  if (myOutlets.length === 0) {
    return <div className="text-sm text-zinc-500">No outlets are assigned to you yet.</div>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6 pb-5 border-b border-zinc-800">
        <div>
          <h2 className="text-2xl font-black tracking-tight">My Outlets</h2>
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">
            {shortDate(effectiveStart)}–{shortDate(effectiveEnd)} vs {shortDate(compareStart)}–{shortDate(compareEnd)}
          </p>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block mb-1">From</label>
            <input type="date" value={customFrom} max={yesterdayIso} onChange={(e) => setCustomFrom(e.target.value)} className="bg-black border border-zinc-800 text-white px-3 py-2 text-sm focus:outline-none focus:border-yellow-400 transition-colors font-mono" />
          </div>
          <div>
            <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block mb-1">To</label>
            <input type="date" value={customTo} max={yesterdayIso} onChange={(e) => setCustomTo(e.target.value)} className="bg-black border border-zinc-800 text-white px-3 py-2 text-sm focus:outline-none focus:border-yellow-400 transition-colors font-mono" />
          </div>
          {!isDefaultRange && (
            <button onClick={() => { setCustomFrom(isoDate(defaultStart)); setCustomTo(isoDate(defaultEnd)); }} className="text-[11px] font-mono uppercase px-3 py-2 border border-zinc-700 hover:border-yellow-400 hover:text-yellow-400 transition-colors">
              This week
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {perOutlet.map((o) => {
            const up = o.diff >= 0;
            const activeSignal = o.signals.length > 0 ? o.signals[tick % o.signals.length] : null;
            return (
              <div key={o.oid} className="border border-zinc-800 p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-lg">{o.name}</p>
                  <span className={`text-xs font-mono px-2 py-1 ${up ? "bg-green-400/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                    {up ? "↑" : "↓"} {o.pct !== null ? `${Math.abs(o.pct).toFixed(0)}%` : "—"}
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-2xl font-black">{inr(o.curSales)}</span>
                  <span className="text-xs text-zinc-500 font-mono">this period</span>
                </div>
                <p className="text-xs text-zinc-500 font-mono mb-3">{inr(o.cmpSales)} last period</p>
                {activeSignal && (
                  <div className="bg-yellow-400/5 border border-yellow-400/30 px-3 py-2.5 mt-1">
                    <p className="text-xs text-yellow-200">💡 {activeSignal}</p>
                    {o.signals.length > 1 && (
                      <div className="flex gap-1 mt-2">
                        {o.signals.map((_, i) => (
                          <span key={i} className={`h-1 flex-1 rounded-full ${i === tick % o.signals.length ? "bg-yellow-400" : "bg-zinc-700"}`} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
