import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const supabaseStock = createClient(
  process.env.NEXT_PUBLIC_STOCK_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_STOCK_SUPABASE_ANON_KEY!
);

const BATCH = 1000;

async function fetchAllBatched<T>(
  query: (from: any, offset: number, to: number) => any,
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

export const REAL_FOOD_COST_WINDOW_DAYS = 30;

// The real, purchase-data-backed food cost % — trailing 30 days, company-wide
// (purchases aren't outlet-tagged yet). Used in place of the old flat 29.4%
// assumption across Outlet P&L, Channel P&L, and Command Centre. Falls back to
// null (callers should then fall back to 29.4% themselves) if there's no
// purchase or revenue data in the window — never silently returns a made-up
// number.
export async function fetchRealFoodCostPct(): Promise<{ pct: number | null; windowFrom: string; windowTo: string }> {
  const to = new Date();
  const from = new Date(to.getTime() - REAL_FOOD_COST_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const windowTo = to.toISOString().slice(0, 10);
  const windowFrom = from.toISOString().slice(0, 10);

  const purchaseRows = await fetchAllBatched<{ amount: number }>(
    (client, o, t) => client.from("purchase_ledger").select("amount").gte("date", windowFrom).lte("date", windowTo).range(o, t),
    supabaseStock
  );
  const revenueRows = await fetchAllBatched<{ shop_sales_value: number; swiggy_sales_value: number; zomato_sales_value: number }>(
    (client, o, t) => client.from("outlet_reports").select("shop_sales_value,swiggy_sales_value,zomato_sales_value").gte("report_date", windowFrom).lte("report_date", windowTo).range(o, t),
    supabase
  );

  const totalSpend = purchaseRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalRevenue = revenueRows.reduce((s, r) => s + (Number(r.shop_sales_value) || 0) + (Number(r.swiggy_sales_value) || 0) + (Number(r.zomato_sales_value) || 0), 0);

  const pct = totalRevenue > 0 ? (totalSpend / totalRevenue) * 100 : null;
  return { pct, windowFrom, windowTo };
}
