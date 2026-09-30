import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BATCH = 1000;

async function fetchAllBatched<T>(
  query: (client: any, offset: number, to: number) => any,
  client: any
): Promise<T[]> {
  let all: T[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await query(client, offset, offset + BATCH - 1);
    if (error) { console.error(error); break; }
    all = all.concat(data || []);
    if (!data || data.length < BATCH) break;
    offset += BATCH;
  }
  return all;
}

// Kept only so any old import doesn't break the build — no longer a fixed
// day count (see below).
export const REAL_COMMISSION_WINDOW_DAYS = 60;

// The real, payout-data-backed online commission % — CALENDAR-MONTH aligned,
// company-wide (payouts aren't reliably outlet-tagged for every period yet).
// Niranjana/Nishant asked for calendar-month windows instead of a rolling
// trailing window that straddles two months in a confusing way (e.g. "31 Aug
// to 30 Sep"). Unlike food cost (pure month-to-date), this uses the CURRENT
// + PREVIOUS full calendar month (1st of last month -> today) rather than
// just the current month alone — Swiggy/Zomato payouts settle in cycles, not
// daily, so a pure current-month window would very often have zero settled
// payouts in the first couple of weeks of any month and just fall back to
// 50%. This still resets cleanly at a month boundary (no more orphan days
// like "31 Aug"), just over two calendar months instead of one.
// Replaces the flat 50% assumption used across Outlet P&L, Channel P&L and
// Command Centre. Swiggy: real gross (customer_payable) vs real net
// (amount_transferable) from outlet_payouts. Zomato: net_payout from
// outlet_payouts against the matching period's reported Zomato sales
// (outlet_reports.zomato_sales_value), since Zomato payouts don't carry
// their own gross figure. Falls back to null (callers should fall back to
// 50% themselves) if there isn't enough settled payout data in the window —
// never silently returns a made-up number.
// Same IST-vs-UTC fix as realFoodCost.ts — "today" must be India time, not
// server/browser UTC, or the window boundary can silently shift by a day
// depending on exactly when the page loads.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
function istDateString(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}
function istNow(): Date {
  return new Date(Date.now() + IST_OFFSET_MS);
}

export async function fetchRealCommissionPct(): Promise<{ pct: number | null; windowFrom: string; windowTo: string }> {
  const nowIst = istNow();
  const windowTo = istDateString(new Date());
  // 1st of the PREVIOUS calendar month, in IST.
  const prevMonthDate = new Date(Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth() - 1, 1));
  const windowFrom = `${prevMonthDate.getUTCFullYear()}-${String(prevMonthDate.getUTCMonth() + 1).padStart(2, "0")}-01`;

  // .order() keeps pagination stable — see realFoodCost.ts for why.
  const payoutRows = await fetchAllBatched<{
    outlet_id: string; platform: string; period_start: string; period_end: string;
    customer_payable: number; amount_transferable: number; net_payout: number;
  }>(
    (client, o, t) => client.from("outlet_payouts").select("outlet_id,platform,period_start,period_end,customer_payable,amount_transferable,net_payout").gte("period_end", windowFrom).lte("period_end", windowTo).order("period_end", { ascending: true }).range(o, t),
    supabase
  );
  const zomatoRevenueRows = await fetchAllBatched<{ outlet_id: string; report_date: string; zomato_sales_value: number }>(
    (client, o, t) => client.from("outlet_reports").select("outlet_id,report_date,zomato_sales_value").gte("report_date", windowFrom).lte("report_date", windowTo).order("report_date", { ascending: true }).range(o, t),
    supabase
  );

  let totalGross = 0;
  let totalNet = 0;

  payoutRows.forEach((p) => {
    if (p.platform === "swiggy") {
      const gross = Number(p.customer_payable) || 0;
      const net = Number(p.amount_transferable) || 0;
      if (gross > 0) { totalGross += gross; totalNet += net; }
    } else if (p.platform === "zomato") {
      const gross = zomatoRevenueRows
        .filter((r) => r.outlet_id === p.outlet_id && r.report_date >= p.period_start && r.report_date <= p.period_end)
        .reduce((s, r) => s + (Number(r.zomato_sales_value) || 0), 0);
      const net = Number(p.net_payout) || 0;
      if (gross > 0) { totalGross += gross; totalNet += net; }
    }
  });

  const pct = totalGross > 0 ? ((totalGross - totalNet) / totalGross) * 100 : null;
  return { pct, windowFrom, windowTo };
}
