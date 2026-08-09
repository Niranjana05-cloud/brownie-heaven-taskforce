import supabase from './supabase';
import supabaseStock from './supabaseStock';
import { FOOD_COST_MAP } from './foodCosts';
import { OUTLET_ID_TO_STOCK_NAME } from './outletMap';

export interface OutletMargin {
  outletId: string;
  outletName: string;
  salesNet: number;
  cogs: number;
  grossMargin: number;
  marginPercent: number | null;
  uncostedProducts: string[]; // products dispatched with no known food cost — excluded from cogs
}

// month format: 'YYYY-MM', matching atlas_monthly_results.month
export async function getOutletMargins(month: string): Promise<OutletMargin[]> {
  // 1. Sales side — TASKFORCE
  const { data: salesRows, error: salesError } = await supabase
    .from('atlas_monthly_results')
    .select('outlet_id, atlas_net')
    .eq('month', month);

  if (salesError) throw new Error(`Sales query failed: ${salesError.message}`);

  // 2. Cost side — Stock DB, for the same calendar month
  const startDate = `${month}-01`;
  const [year, mon] = month.split('-').map(Number);
  const nextMonth = mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, '0')}-01`;

  // Supabase caps a single query at 1000 rows by default — page through
  // in batches until a page comes back with fewer than pageSize rows.
  const pageSize = 1000;
  let dispatchRows: { outlet: string; product: string; qty: number }[] = [];
  let page = 0;
  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data: pageRows, error: dispatchError } = await supabaseStock
      .from('outlet_supply_ledger')
      .select('outlet, product, qty')
      .gte('date', startDate)
      .lt('date', nextMonth)
      .range(from, to);

    if (dispatchError) throw new Error(`Dispatch query failed: ${dispatchError.message}`);

    dispatchRows = dispatchRows.concat(pageRows ?? []);
    if (!pageRows || pageRows.length < pageSize) break;
    page += 1;
  }

  // 3. Aggregate cost per outlet (by Stock outlet name)
  const cogsByOutletName: Record<string, number> = {};
  const uncostedByOutletName: Record<string, Set<string>> = {};

  for (const row of dispatchRows ?? []) {
    const unitCost = FOOD_COST_MAP[row.product];
    if (unitCost === undefined) {
      uncostedByOutletName[row.outlet] ??= new Set();
      uncostedByOutletName[row.outlet].add(row.product);
      continue; // skip from cogs total — unknown cost, don't silently treat as zero
    }
    cogsByOutletName[row.outlet] = (cogsByOutletName[row.outlet] ?? 0) + row.qty * unitCost;
  }

  // 4. Join sales (outlet_id) to cost (outlet name) via the mapping
  const results: OutletMargin[] = (salesRows ?? []).map((sale) => {
    const stockName = OUTLET_ID_TO_STOCK_NAME[sale.outlet_id];
    const cogs = stockName ? (cogsByOutletName[stockName] ?? 0) : 0;
    const salesNet = sale.atlas_net ?? 0;
    const grossMargin = salesNet - cogs;
    return {
      outletId: sale.outlet_id,
      outletName: stockName ?? sale.outlet_id,
      salesNet,
      cogs: Math.round(cogs * 100) / 100,
      grossMargin: Math.round(grossMargin * 100) / 100,
      marginPercent: salesNet > 0 ? Math.round((grossMargin / salesNet) * 1000) / 10 : null,
      uncostedProducts: stockName ? Array.from(uncostedByOutletName[stockName] ?? []) : [],
    };
  });

  return results;
}
