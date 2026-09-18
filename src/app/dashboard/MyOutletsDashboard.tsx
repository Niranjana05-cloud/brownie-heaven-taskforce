"use client";
import { useEffect, useState } from "react";
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

type OutletRow = {
  outlet_id: string; report_date: string;
  shop_sales_value: number | null; swiggy_sales_value: number | null; zomato_sales_value: number | null;
  swiggy_sales_count: number | null; zomato_sales_count: number | null;
};

export default function MyOutletsDashboard({ user }: { user: Staff }) {
  const myOutlets = user.outlets || [];
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<OutletRow[]>([]);

  // outlet_reports.report_date is the FILING date, not the sale date — a row
  // filed under date D actually holds sales from D-1 ("you're filing
  // yesterday's sales, recorded under today's date" — same text staff see on
  // the daily report form). So to get rows for real sale dates [start, end],
  // we query report_date in [start+1 day, end+1 day].
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // "This week" = the last 7 full sale-days, ending yesterday (today's sales
  // likely aren't filed yet — filing is due by noon the next day).
  const thisWeekEnd = new Date(today.getTime() - 1 * 86400000);
  const thisWeekStart = new Date(thisWeekEnd.getTime() - 6 * 86400000);
  const lastWeekEnd = new Date(thisWeekStart.getTime() - 1 * 86400000);
  const lastWeekStart = new Date(lastWeekEnd.getTime() - 6 * 86400000);

  const filedRangeFor = (saleStart: Date, saleEnd: Date) => ({
    from: isoDate(new Date(saleStart.getTime() + 86400000)),
    to: isoDate(new Date(saleEnd.getTime() + 86400000)),
  });
  const thisWeekFiled = filedRangeFor(thisWeekStart, thisWeekEnd);
  const lastWeekFiled = filedRangeFor(lastWeekStart, lastWeekEnd);

  useEffect(() => {
    if (myOutlets.length === 0) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("outlet_reports")
        .select("outlet_id, report_date, shop_sales_value, swiggy_sales_value, zomato_sales_value, swiggy_sales_count, zomato_sales_count")
        .in("outlet_id", myOutlets)
        .gte("report_date", lastWeekFiled.from)
        .lte("report_date", thisWeekFiled.to);
      setRows(data || []);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sum = (list: OutletRow[], field: keyof OutletRow) => list.reduce((s, r) => s + (Number(r[field]) || 0), 0);
  const inThisWeek = (r: OutletRow) => r.report_date >= thisWeekFiled.from && r.report_date <= thisWeekFiled.to;
  const inLastWeek = (r: OutletRow) => r.report_date >= lastWeekFiled.from && r.report_date <= lastWeekFiled.to;

  const perOutlet = myOutlets.map((oid) => {
    const outletRows = rows.filter((r) => r.outlet_id === oid);
    const tw = outletRows.filter(inThisWeek);
    const lw = outletRows.filter(inLastWeek);

    const twSales = sum(tw, "shop_sales_value") + sum(tw, "swiggy_sales_value") + sum(tw, "zomato_sales_value");
    const lwSales = sum(lw, "shop_sales_value") + sum(lw, "swiggy_sales_value") + sum(lw, "zomato_sales_value");

    const twOnlineSales = sum(tw, "swiggy_sales_value") + sum(tw, "zomato_sales_value");
    const lwOnlineSales = sum(lw, "swiggy_sales_value") + sum(lw, "zomato_sales_value");
    const twOnlineOrders = sum(tw, "swiggy_sales_count") + sum(tw, "zomato_sales_count");
    const lwOnlineOrders = sum(lw, "swiggy_sales_count") + sum(lw, "zomato_sales_count");

    const diff = twSales - lwSales;
    const pct = lwSales > 0 ? (diff / lwSales) * 100 : null;

    // Honest "why" note — built only from Swiggy/Zomato numbers, since that's
    // the only place we have order counts. There's no walk-in order count in
    // outlet_reports, so we never guess a reason for in-store sales moving.
    let why: string | null = null;
    if (twOnlineOrders > 0 && lwOnlineOrders > 0) {
      const orderDiffPct = ((twOnlineOrders - lwOnlineOrders) / lwOnlineOrders) * 100;
      const twAvg = twOnlineOrders > 0 ? twOnlineSales / twOnlineOrders : 0;
      const lwAvg = lwOnlineOrders > 0 ? lwOnlineSales / lwOnlineOrders : 0;
      const avgDiffPct = lwAvg > 0 ? ((twAvg - lwAvg) / lwAvg) * 100 : 0;

      if (Math.abs(orderDiffPct) >= 8 && Math.abs(orderDiffPct) >= Math.abs(avgDiffPct)) {
        why = orderDiffPct < 0
          ? `Fewer Swiggy/Zomato orders this week (${Math.round(twOnlineOrders)} vs ${Math.round(lwOnlineOrders)} last week)`
          : `More Swiggy/Zomato orders this week (${Math.round(twOnlineOrders)} vs ${Math.round(lwOnlineOrders)} last week)`;
      } else if (Math.abs(avgDiffPct) >= 8) {
        why = avgDiffPct < 0
          ? `Roughly the same number of Swiggy/Zomato orders, but each one was smaller on average (${inr(twAvg)} vs ${inr(lwAvg)})`
          : `Roughly the same number of Swiggy/Zomato orders, but each one was bigger on average (${inr(twAvg)} vs ${inr(lwAvg)})`;
      }
    } else if (twOnlineOrders === 0 && lwOnlineOrders === 0 && Math.abs(diff) > 0) {
      why = "This is entirely walk-in (shop) sales — no Swiggy/Zomato orders either week.";
    }

    return { oid, name: OUTLET_NAMES[oid] || oid, twSales, lwSales, diff, pct, why };
  });

  if (myOutlets.length === 0) {
    return (
      <div className="text-sm text-zinc-500">No outlets are assigned to you yet.</div>
    );
  }

  return (
    <div>
      <div className="mb-6 pb-5 border-b border-zinc-800">
        <h2 className="text-2xl font-black tracking-tight">My Outlets</h2>
        <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">
          {shortDate(thisWeekStart)}–{shortDate(thisWeekEnd)} vs {shortDate(lastWeekStart)}–{shortDate(lastWeekEnd)}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {perOutlet.map((o) => {
            const up = o.diff >= 0;
            return (
              <div key={o.oid} className="border border-zinc-800 p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-lg">{o.name}</p>
                  <span className={`text-xs font-mono px-2 py-1 ${up ? "bg-green-400/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                    {up ? "↑" : "↓"} {o.pct !== null ? `${Math.abs(o.pct).toFixed(0)}%` : "—"}
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-2xl font-black">{inr(o.twSales)}</span>
                  <span className="text-xs text-zinc-500 font-mono">this week</span>
                </div>
                <p className="text-xs text-zinc-500 font-mono mb-3">{inr(o.lwSales)} last week</p>
                {o.why && (
                  <p className="text-xs text-zinc-400 border-t border-zinc-800 pt-3 mt-1">💡 {o.why}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
