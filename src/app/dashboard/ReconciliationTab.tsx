"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const OUTLETS = ["royapettah","adayar","bsr_mall","velachery","ra_puram","anna_nagar","pallavaram","vadapalani","besant_nagar","perumbakkam","tambaram","porur"];
const OUTLET_NAMES: Record<string, string> = {
  royapettah: "Royapettah", adayar: "Adyar", bsr_mall: "BSR Mall", velachery: "Velachery",
  ra_puram: "RA Puram", anna_nagar: "Anna Nagar", pallavaram: "Pallavaram", vadapalani: "Vadapalani",
  besant_nagar: "Besant Nagar", perumbakkam: "Perumbakkam", tambaram: "Tambaram", porur: "Porur",
};

const DEFAULT_THRESHOLD = 500;

type AtlasMap = { id: string; atlas_name: string; outlet_id: string };
type ReconRow = {
  outlet_id: string;
  atlasGross: number;
  atlasNet: number;
  atlasLost: number;
  reportedGross: number;
  diff: number; // atlasGross − reportedGross
};

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const parseRow = (line: string): string[] => {
    const cells: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQ = !inQ; }
      } else if (c === ',' && !inQ) {
        cells.push(cur.trim()); cur = "";
      } else {
        cur += c;
      }
    }
    cells.push(cur.trim());
    return cells;
  };
  const headers = parseRow(lines[0]).map(h => h.toLowerCase().trim());
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const cells = parseRow(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = cells[i] ?? ""; });
    return obj;
  });
}

const parseNum = (s: string | undefined): number => {
  const v = parseFloat(String(s ?? "").replace(/[₹,\s]/g, ""));
  return isNaN(v) ? 0 : v;
};

const fmt = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export default function ReconciliationTab() {
  const [view, setView] = useState<"reconcile" | "mapping">("reconcile");

  // Mapping state
  const [maps, setMaps] = useState<AtlasMap[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [newAtlasName, setNewAtlasName] = useState("");
  const [newOutletId, setNewOutletId] = useState(OUTLETS[0]);
  const [mapSaving, setMapSaving] = useState(false);

  // Reconcile state
  const [month, setMonth] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  });
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [reconRows, setReconRows] = useState<ReconRow[] | null>(null);
  const [unmapped, setUnmapped] = useState<string[]>([]);
  const [reconLoading, setReconLoading] = useState(false);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [savingDash, setSavingDash] = useState(false);
  const [savedDash, setSavedDash] = useState(false);

  const loadMaps = async () => {
    setMapLoading(true);
    const { data } = await supabase.from("atlas_outlet_map").select("*").order("outlet_id");
    setMaps((data as AtlasMap[]) || []);
    setMapLoading(false);
  };

  useEffect(() => { loadMaps(); }, []);

  const addMap = async () => {
    const name = newAtlasName.trim();
    if (!name) return;
    setMapSaving(true);
    const { error } = await supabase.from("atlas_outlet_map").insert({ atlas_name: name, outlet_id: newOutletId });
    setMapSaving(false);
    if (error) { alert("Error: " + error.message); return; }
    setNewAtlasName("");
    loadMaps();
  };

  const deleteMap = async (id: string) => {
    if (!confirm("Remove this mapping?")) return;
    await supabase.from("atlas_outlet_map").delete().eq("id", id);
    loadMaps();
  };

  const runReconcile = async () => {
    if (!csvFile || !month) return;
    setReconLoading(true);
    setReconRows(null);
    setUnmapped([]);
    setSavedDash(false);

    const text = await csvFile.text();
    const csvRows = parseCSV(text);

    const lookup: Record<string, string> = {};
    maps.forEach(m => { lookup[m.atlas_name.toLowerCase()] = m.outlet_id; });

    const atlasGross: Record<string, number> = {};
    const atlasNet: Record<string, number> = {};
    const atlasLost: Record<string, number> = {};
    const unmappedSet = new Set<string>();

    csvRows.forEach(row => {
      const name = (row["name"] ?? "").trim();
      if (!name) return;
      const outletId = lookup[name.toLowerCase()];
      if (!outletId) { unmappedSet.add(name); return; }
      atlasGross[outletId] = (atlasGross[outletId] ?? 0) + parseNum(row["gross revenue"]);
      atlasNet[outletId] = (atlasNet[outletId] ?? 0) + parseNum(row["net revenue"]);
      atlasLost[outletId] = (atlasLost[outletId] ?? 0) + parseNum(row["lost revenue"]);
    });

    const periodStart = `${month}-01`;
    const lastDay = new Date(parseInt(month.slice(0, 4)), parseInt(month.slice(5, 7)), 0).getDate();
    const periodEnd = `${month}-${String(lastDay).padStart(2, "0")}`;

    const { data: reportData } = await supabase
      .from("outlet_reports")
      .select("outlet_id, shop_sales_value, swiggy_sales_value, zomato_sales_value")
      .gte("report_date", periodStart)
      .lte("report_date", periodEnd);

    const reportedGross: Record<string, number> = {};
    ((reportData as any[]) || []).forEach((r: any) => {
      const g = (Number(r.shop_sales_value) || 0) + (Number(r.swiggy_sales_value) || 0) + (Number(r.zomato_sales_value) || 0);
      reportedGross[r.outlet_id] = (reportedGross[r.outlet_id] ?? 0) + g;
    });

    const allOutlets = new Set([...Object.keys(atlasGross), ...Object.keys(reportedGross)]);
    const result: ReconRow[] = Array.from(allOutlets).map(oid => ({
      outlet_id: oid,
      atlasGross: atlasGross[oid] ?? 0,
      atlasNet: atlasNet[oid] ?? 0,
      atlasLost: atlasLost[oid] ?? 0,
      reportedGross: reportedGross[oid] ?? 0,
      diff: (atlasGross[oid] ?? 0) - (reportedGross[oid] ?? 0),
    }));

    result.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    setReconRows(result);
    setUnmapped(Array.from(unmappedSet).sort());
    setReconLoading(false);
  };

  const saveToDashboard = async () => {
    if (!reconRows || reconRows.length === 0) return;
    setSavingDash(true);
    const rows = reconRows.map(r => ({
      month,
      outlet_id: r.outlet_id,
      atlas_gross: r.atlasGross,
      atlas_net: r.atlasNet,
      atlas_lost: r.atlasLost,
    }));
    const { error } = await supabase.from("atlas_monthly_results").upsert(rows, { onConflict: "month,outlet_id" });
    setSavingDash(false);
    if (error) { alert("Error saving: " + error.message); return; }
    setSavedDash(true);
  };

  const inputCls = "w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm";
  const lblCls = "block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1";

  return (
    <div>
      <div className="flex justify-between items-start mb-6 pb-5 border-b border-zinc-800">
        <div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight">Reconciliation</h2>
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">UrbanPiper Atlas vs daily reports · monthly honesty check</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {(["reconcile", "mapping"] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-2 text-xs font-mono uppercase tracking-widest border transition-colors ${view === v ? "border-yellow-400 text-yellow-400" : "border-zinc-800 text-zinc-500 hover:text-white"}`}>
            {v === "reconcile" ? "Reconcile" : "Outlet Mapping"}
          </button>
        ))}
      </div>

      {/* ── MAPPING VIEW ── */}
      {view === "mapping" && (
        <div className="max-w-3xl">
          <p className="text-[11px] font-mono text-zinc-500 mb-5 leading-relaxed">
            Map each row name from the Atlas CSV to one of your internal outlet IDs. Do this once — add a row for every unique &ldquo;Name&rdquo; value that appears in the export.
          </p>

          <div className="bg-[#131316] border border-zinc-800 p-5 mb-6">
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-4">Add mapping</p>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-end">
              <div>
                <label className={lblCls}>Atlas row name (exact, case-insensitive)</label>
                <input value={newAtlasName} onChange={e => setNewAtlasName(e.target.value)}
                  placeholder='e.g. Royapettah - BH - POS' className={inputCls}
                  onKeyDown={e => { if (e.key === "Enter") addMap(); }} />
              </div>
              <div>
                <label className={lblCls}>Outlet</label>
                <select value={newOutletId} onChange={e => setNewOutletId(e.target.value)} className={inputCls + " min-w-[160px]"}>
                  {OUTLETS.map(o => <option key={o} value={o}>{OUTLET_NAMES[o]}</option>)}
                </select>
              </div>
              <button onClick={addMap} disabled={mapSaving || !newAtlasName.trim()}
                className="bg-yellow-400 text-black font-bold text-[11px] uppercase tracking-widest px-4 py-2 hover:bg-yellow-300 transition-colors disabled:opacity-50 whitespace-nowrap">
                {mapSaving ? "Saving…" : "Add"}
              </button>
            </div>
          </div>

          {mapLoading && <p className="text-zinc-600 font-mono text-xs">Loading…</p>}
          {!mapLoading && maps.length === 0 && (
            <p className="text-zinc-600 font-mono text-xs">No mappings yet. Add Atlas row names above.</p>
          )}
          {!mapLoading && maps.length > 0 && (
            <div className="border border-zinc-800 overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-zinc-500 uppercase tracking-widest text-[10px] border-b border-zinc-800">
                    <th className="text-left px-4 py-2.5">Atlas name</th>
                    <th className="text-left px-4 py-2.5">Outlet</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {maps.map(m => (
                    <tr key={m.id} className="border-b border-zinc-900 hover:bg-zinc-900/40">
                      <td className="px-4 py-2.5 text-zinc-300">{m.atlas_name}</td>
                      <td className="px-4 py-2.5 text-yellow-400">{OUTLET_NAMES[m.outlet_id] || m.outlet_id}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => deleteMap(m.id)}
                          className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors uppercase tracking-widest">
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── RECONCILE VIEW ── */}
      {view === "reconcile" && (
        <div>
          <div className="bg-[#131316] border border-zinc-800 p-5 mb-6 max-w-3xl">
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-4">Upload &amp; compare</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className={lblCls}>Month</label>
                <input type="month" value={month} onChange={e => setMonth(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={lblCls}>Atlas CSV</label>
                <input type="file" accept=".csv"
                  onChange={e => { setCsvFile(e.target.files?.[0] || null); setReconRows(null); setUnmapped([]); }}
                  className="block text-xs text-zinc-400 file:mr-3 file:py-2 file:px-3 file:border file:border-yellow-400 file:bg-transparent file:text-yellow-400 file:text-[11px] file:font-mono file:uppercase file:tracking-widest" />
              </div>
              <div>
                <label className={lblCls}>Flag threshold (₹)</label>
                <input type="number" value={threshold} onChange={e => setThreshold(Number(e.target.value))}
                  className={inputCls} min={0} step={100} />
              </div>
            </div>
            <button onClick={runReconcile} disabled={reconLoading || !csvFile || !month}
              className="bg-yellow-400 text-black font-bold text-[11px] uppercase tracking-widest px-5 py-2.5 hover:bg-yellow-300 transition-colors disabled:opacity-50">
              {reconLoading ? "Comparing…" : "Run Reconciliation"}
            </button>
          </div>

          {unmapped.length > 0 && (
            <div className="border border-yellow-400/40 bg-yellow-400/5 p-4 mb-5 max-w-3xl">
              <p className="text-[10px] font-mono text-yellow-400 uppercase tracking-widest mb-2">
                ⚠ {unmapped.length} unmapped Atlas row{unmapped.length !== 1 ? "s" : ""} — revenue excluded from comparison
              </p>
              <ul className="space-y-0.5">
                {unmapped.map(n => <li key={n} className="text-xs font-mono text-zinc-400">· {n}</li>)}
              </ul>
              <p className="text-[10px] font-mono text-zinc-600 mt-2">Add these in the Outlet Mapping tab, then re-run.</p>
            </div>
          )}

          {reconRows !== null && reconRows.length === 0 && (
            <p className="text-zinc-600 font-mono text-xs">No data found. Check that the CSV has mapped rows and that outlet_reports exist for this period.</p>
          )}

          {reconRows !== null && reconRows.length > 0 && (() => {
            const totalAtlasGross = reconRows.reduce((s, r) => s + r.atlasGross, 0);
            const totalReported = reconRows.reduce((s, r) => s + r.reportedGross, 0);
            const totalDiff = totalAtlasGross - totalReported;
            const totalNet = reconRows.reduce((s, r) => s + r.atlasNet, 0);
            const totalLost = reconRows.reduce((s, r) => s + r.atlasLost, 0);
            return (
              <div>
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-3">
                  {new Date(month + "-01T00:00:00").toLocaleString("en-IN", { month: "long", year: "numeric" })} · sorted by absolute discrepancy
                </p>
                <div className="overflow-x-auto border border-zinc-800">
                  <table className="w-full text-xs font-mono whitespace-nowrap">
                    <thead>
                      <tr className="text-zinc-500 uppercase tracking-widest text-[10px] border-b border-zinc-800">
                        <th className="text-left px-3 py-2.5">Outlet</th>
                        <th className="text-right px-3 py-2.5">Atlas Gross</th>
                        <th className="text-right px-3 py-2.5">Reported Gross</th>
                        <th className="text-right px-3 py-2.5">Diff</th>
                        <th className="text-center px-3 py-2.5">Status</th>
                        <th className="text-right px-3 py-2.5">Atlas Net</th>
                        <th className="text-right px-3 py-2.5">Lost Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconRows.map(r => {
                        const ok = Math.abs(r.diff) <= threshold;
                        const diffAbs = Math.abs(r.diff);
                        return (
                          <tr key={r.outlet_id} className="border-b border-zinc-900 hover:bg-zinc-900/40">
                            <td className="px-3 py-2.5 text-white font-medium">{OUTLET_NAMES[r.outlet_id] || r.outlet_id}</td>
                            <td className="px-3 py-2.5 text-right text-zinc-300">{fmt(r.atlasGross)}</td>
                            <td className="px-3 py-2.5 text-right text-zinc-300">{fmt(r.reportedGross)}</td>
                            <td className={`px-3 py-2.5 text-right font-semibold ${ok ? "text-zinc-500" : (r.diff < 0 ? "text-red-400" : "text-yellow-400")}`}>
                              {r.diff >= 0 ? "+" : "−"}{fmt(diffAbs)}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className={`px-2 py-0.5 text-[10px] uppercase tracking-widest border ${ok ? "border-green-500/40 text-green-400" : "border-red-500/40 text-red-400"}`}>
                                {ok ? "✓ ok" : "⚠ flag"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right text-blue-400">{fmt(r.atlasNet)}</td>
                            <td className="px-3 py-2.5 text-right text-red-400">{r.atlasLost > 0 ? fmt(r.atlasLost) : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-zinc-700 bg-zinc-900/40">
                        <td className="px-3 py-2.5 text-zinc-400 font-bold uppercase text-[10px] tracking-widest">Total</td>
                        <td className="px-3 py-2.5 text-right font-bold text-white">{fmt(totalAtlasGross)}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-white">{fmt(totalReported)}</td>
                        <td className={`px-3 py-2.5 text-right font-bold ${totalDiff < 0 ? "text-red-400" : "text-yellow-400"}`}>
                          {totalDiff >= 0 ? "+" : "−"}{fmt(Math.abs(totalDiff))}
                        </td>
                        <td></td>
                        <td className="px-3 py-2.5 text-right font-bold text-blue-400">{fmt(totalNet)}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-red-400">{fmt(totalLost)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="text-[10px] font-mono text-zinc-600 mt-2 leading-relaxed max-w-3xl">
                  Atlas Gross = &ldquo;Gross Revenue&rdquo; summed for all mapped rows &middot; Reported Gross = shop + Swiggy + Zomato from daily outlet_reports &middot; Diff = Atlas &minus; Reported &middot; positive (+) means staff under-reported, negative (&minus;) means over-reported &middot; Atlas Net = founder&rsquo;s true revenue figure &middot; Lost Revenue = potential lost to cancellations/refusals &middot; flag threshold {fmt(threshold)}
                </p>
                <div className="mt-4 flex items-center gap-4">
                  <button onClick={saveToDashboard} disabled={savingDash || savedDash}
                    className="bg-yellow-400 text-black font-bold text-[11px] uppercase tracking-widest px-4 py-2 hover:bg-yellow-300 transition-colors disabled:opacity-50">
                    {savingDash ? "Saving…" : savedDash ? "✓ Saved" : "Save to Founder Dashboard"}
                  </button>
                  {savedDash && <p className="text-[11px] font-mono text-green-400">Founder&apos;s Office will now show this month&apos;s Atlas data.</p>}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
