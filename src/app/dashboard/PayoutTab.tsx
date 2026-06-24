"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

type Staff = { id: string; name: string; role: string; outlets?: string[] };

const OUTLETS = ["royapettah","adayar","bsr_mall","velachery","ra_puram","anna_nagar","pallavaram","vadapalani","besant_nagar","perumbakkam","tambaram","porur"];
const OUTLET_NAMES: Record<string, string> = {
  royapettah: "Royapettah", adayar: "Adyar", bsr_mall: "BSR Mall", velachery: "Velachery",
  ra_puram: "RA Puram", anna_nagar: "Anna Nagar", pallavaram: "Pallavaram", vadapalani: "Vadapalani",
  besant_nagar: "Besant Nagar", perumbakkam: "Perumbakkam", tambaram: "Tambaram", porur: "Porur",
};

type Payout = {
  id: string; outlet_id: string; platform: string;
  period_start: string; period_end: string; total_orders: number | null;
  customer_payable: number | null; swiggy_service_fee: number | null;
  other_charges_refund: number | null; govt_taxes: number | null;
  amount_transferable: number | null; next_payout_cycle: string | null;
  next_payout_date: string | null; net_payout: number | null; bank_utr: string | null;
  entry_method: string | null; entered_by: string | null;
};
type Rep = {
  outlet_id: string; report_date: string;
  swiggy_sales_count: number; swiggy_sales_value: number;
  zomato_sales_count: number; zomato_sales_value: number;
};
type Form = Record<string, string>;

const fmt = (n: number | null | undefined) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");
const prettyD = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const num = (s: string | undefined) => { const v = parseFloat(String(s ?? "").replace(/,/g, "")); return isNaN(v) ? null : v; };
const int = (s: string | undefined) => { const v = parseInt(String(s ?? "").replace(/,/g, "")); return isNaN(v) ? null : v; };

export default function PayoutTab({ user }: { user: Staff }) {
  const canViewAll = user.role === "Owner" || user.role === "Manager";
  const myOutlets = user.outlets || [];
  const visibleOutlets = canViewAll ? OUTLETS : myOutlets;

  const [platform, setPlatform] = useState<"swiggy" | "zomato">("swiggy");
  const [outlet, setOutlet] = useState<string>(visibleOutlets[0] || "");
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [reports, setReports] = useState<Rep[]>([]);
  const [loading, setLoading] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>({});
  const [saving, setSaving] = useState(false);

  const canEdit = canViewAll || myOutlets.includes(outlet);

  const load = useCallback(async () => {
    if (!outlet) return;
    setLoading(true);
    const [{ data: pData }, { data: rData }] = await Promise.all([
      supabase.from("outlet_payouts").select("*").eq("outlet_id", outlet).eq("platform", platform).order("period_start", { ascending: false }),
      supabase.from("outlet_reports").select("outlet_id,report_date,swiggy_sales_count,swiggy_sales_value,zomato_sales_count,zomato_sales_value").eq("outlet_id", outlet),
    ]);
    setPayouts((pData as Payout[]) || []);
    setReports((rData as Rep[]) || []);
    setLoading(false);
  }, [outlet, platform]);

  useEffect(() => { load(); }, [load]);

  const reconcile = (p: Payout) => {
    const inRange = reports.filter((r) => r.report_date >= p.period_start && r.report_date <= p.period_end);
    const repOrders = inRange.reduce((s, r) => s + (Number(platform === "swiggy" ? r.swiggy_sales_count : r.zomato_sales_count) || 0), 0);
    const repValue = inRange.reduce((s, r) => s + (Number(platform === "swiggy" ? r.swiggy_sales_value : r.zomato_sales_value) || 0), 0);
    const actualOrders = Number(p.total_orders) || 0;
    const actualValue = platform === "swiggy" ? (Number(p.customer_payable) || 0) : (Number(p.net_payout) || 0);
    const ordersDiff = repOrders - actualOrders;
    const valueDiff = Math.round(repValue) - Math.round(actualValue);
    return { repOrders, repValue, actualOrders, actualValue, ordersDiff, valueDiff, days: inRange.length };
  };

  const openAdd = () => { setEditingId(null); setForm({}); setShowForm(true); };
  const openEdit = (p: Payout) => {
    setEditingId(p.id);
    setForm({
      period_start: p.period_start || "", period_end: p.period_end || "",
      total_orders: p.total_orders?.toString() || "",
      customer_payable: p.customer_payable?.toString() || "", swiggy_service_fee: p.swiggy_service_fee?.toString() || "",
      other_charges_refund: p.other_charges_refund?.toString() || "", govt_taxes: p.govt_taxes?.toString() || "",
      amount_transferable: p.amount_transferable?.toString() || "", next_payout_cycle: p.next_payout_cycle || "",
      next_payout_date: p.next_payout_date || "", net_payout: p.net_payout?.toString() || "", bank_utr: p.bank_utr || "",
    });
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingId(null); setForm({}); };
  const setF = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.period_start || !form.period_end) { alert("Period start and end are required."); return; }
    if (form.period_end < form.period_start) { alert("Period end is before start."); return; }
    setSaving(true);
    const base = {
      outlet_id: outlet, platform,
      period_start: form.period_start, period_end: form.period_end,
      total_orders: int(form.total_orders),
      entry_method: "manual", entered_by: user.id, updated_at: new Date().toISOString(),
    };
    const payload = platform === "swiggy"
      ? { ...base,
          customer_payable: num(form.customer_payable), swiggy_service_fee: num(form.swiggy_service_fee),
          other_charges_refund: num(form.other_charges_refund), govt_taxes: num(form.govt_taxes),
          amount_transferable: num(form.amount_transferable), next_payout_cycle: form.next_payout_cycle || null,
          next_payout_date: form.next_payout_date || null }
      : { ...base, net_payout: num(form.net_payout), bank_utr: form.bank_utr || null };

    let error;
    if (editingId) {
      const r = await supabase.from("outlet_payouts").update(payload as Record<string, unknown>).eq("id", editingId);
      error = r.error;
    } else {
      const r = await supabase.from("outlet_payouts").upsert(payload as Record<string, unknown>, { onConflict: "outlet_id,platform,period_start,period_end" });
      error = r.error;
    }
    setSaving(false);
    if (error) { alert("Error: " + error.message); return; }
    closeForm();
    load();
  };

  const accent = platform === "swiggy" ? "text-orange-400" : "text-red-400";
  const accentBorder = platform === "swiggy" ? "border-orange-400" : "border-red-400";
  const inputCls = "w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm";
  const lblCls = "block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1";

  if (!outlet) {
    return (
      <div>
        <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-2">Payout</h2>
        <p className="text-zinc-600 font-mono text-xs">No outlets assigned to your account.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-6 pb-5 border-b border-zinc-800">
        <div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight">Payout</h2>
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Weekly · reported vs actual</p>
        </div>
        {canEdit && !showForm && (
          <button onClick={openAdd} className={`text-[11px] font-mono uppercase tracking-widest px-3 py-2 border ${accentBorder} ${accent} hover:bg-zinc-900 transition-colors`}>+ Add Entry</button>
        )}
      </div>

      {/* Platform toggle */}
      <div className="flex gap-2 mb-4">
        {(["swiggy", "zomato"] as const).map((pf) => (
          <button key={pf} onClick={() => { setPlatform(pf); closeForm(); }}
            className={`px-4 py-2 text-xs font-mono uppercase tracking-widest border transition-colors ${platform === pf ? (pf === "swiggy" ? "border-orange-400 text-orange-400" : "border-red-400 text-red-400") : "border-zinc-800 text-zinc-500 hover:text-white"}`}>
            {pf}
          </button>
        ))}
      </div>

      {/* Outlet selector */}
      <div className="mb-6">
        <label className={lblCls}>Outlet</label>
        <select value={outlet} onChange={(e) => { setOutlet(e.target.value); closeForm(); }} className={inputCls + " max-w-xs"}>
          {visibleOutlets.map((o) => <option key={o} value={o}>{OUTLET_NAMES[o] || o}</option>)}
        </select>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="bg-[#131316] border border-zinc-800 p-5 mb-6 max-w-3xl">
          <p className={`font-mono text-xs uppercase tracking-widest ${accent} mb-4`}>{editingId ? "Edit" : "Add"} {platform} payout · {OUTLET_NAMES[outlet]}</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div><label className={lblCls}>Period Start</label><input type="date" value={form.period_start || ""} onChange={(e) => setF("period_start", e.target.value)} className={inputCls} /></div>
            <div><label className={lblCls}>Period End</label><input type="date" value={form.period_end || ""} onChange={(e) => setF("period_end", e.target.value)} className={inputCls} /></div>
            <div><label className={lblCls}>Total Orders</label><input inputMode="numeric" value={form.total_orders || ""} onChange={(e) => setF("total_orders", e.target.value)} className={inputCls} /></div>

            {platform === "swiggy" ? (
              <>
                <div><label className={lblCls}>Customer Payable</label><input inputMode="decimal" value={form.customer_payable || ""} onChange={(e) => setF("customer_payable", e.target.value)} className={inputCls} /></div>
                <div><label className={lblCls}>Service Fee</label><input inputMode="decimal" value={form.swiggy_service_fee || ""} onChange={(e) => setF("swiggy_service_fee", e.target.value)} className={inputCls} /></div>
                <div><label className={lblCls}>Other Charges / Refund</label><input inputMode="decimal" value={form.other_charges_refund || ""} onChange={(e) => setF("other_charges_refund", e.target.value)} className={inputCls} /></div>
                <div><label className={lblCls}>Govt Taxes</label><input inputMode="decimal" value={form.govt_taxes || ""} onChange={(e) => setF("govt_taxes", e.target.value)} className={inputCls} /></div>
                <div><label className={lblCls}>Amount Transferable</label><input inputMode="decimal" value={form.amount_transferable || ""} onChange={(e) => setF("amount_transferable", e.target.value)} className={inputCls} /></div>
                <div><label className={lblCls}>Next Payout Cycle</label><input value={form.next_payout_cycle || ""} onChange={(e) => setF("next_payout_cycle", e.target.value)} className={inputCls} /></div>
                <div><label className={lblCls}>Next Payout Date</label><input type="date" value={form.next_payout_date || ""} onChange={(e) => setF("next_payout_date", e.target.value)} className={inputCls} /></div>
              </>
            ) : (
              <>
                <div><label className={lblCls}>Net Pay-out</label><input inputMode="decimal" value={form.net_payout || ""} onChange={(e) => setF("net_payout", e.target.value)} className={inputCls} /></div>
                <div className="col-span-2"><label className={lblCls}>Bank UTR</label><input value={form.bank_utr || ""} onChange={(e) => setF("bank_utr", e.target.value)} className={inputCls} /></div>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="text-[11px] font-mono uppercase tracking-widest px-4 py-2 bg-yellow-400 text-black font-bold hover:bg-yellow-300 transition-colors disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
            <button onClick={closeForm} className="text-[11px] font-mono uppercase tracking-widest px-4 py-2 border border-zinc-700 text-zinc-400 hover:text-white transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {loading && <p className="text-zinc-600 font-mono text-xs">Loading…</p>}
      {!loading && payouts.length === 0 && !showForm && (
        <p className="text-zinc-600 font-mono text-xs">No {platform} payouts entered for {OUTLET_NAMES[outlet]} yet.</p>
      )}

      <div className="space-y-4 max-w-3xl">
        {payouts.map((p) => {
          const rc = reconcile(p);
          const ordersOk = rc.ordersDiff === 0;
          const valueOk = rc.valueDiff === 0;
          const allOk = ordersOk && valueOk;
          return (
            <div key={p.id} className="bg-[#131316] border border-zinc-800 p-5">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className={`font-mono text-xs uppercase tracking-widest ${accent}`}>{platform}</p>
                  <p className="text-lg font-bold mt-0.5">{prettyD(p.period_start)} – {prettyD(p.period_end)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {canEdit && <button onClick={() => openEdit(p)} className="text-[10px] font-mono uppercase tracking-widest px-2 py-1 border border-zinc-700 text-zinc-400 hover:text-white transition-colors">Edit</button>}
                  <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-1 border ${allOk ? "border-green-500/40 text-green-400" : "border-red-500/40 text-red-400"}`}>
                    {allOk ? "✓ matched" : "⚠ mismatch"}
                  </span>
                </div>
              </div>

              {/* Platform fields */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4">
                <div className="flex justify-between"><span className="text-zinc-500">Total Orders</span><span>{p.total_orders ?? "—"}</span></div>
                {platform === "swiggy" ? (
                  <>
                    <div className="flex justify-between"><span className="text-zinc-500">Customer Payable</span><span>{fmt(p.customer_payable)}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Service Fee</span><span>{fmt(p.swiggy_service_fee)}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Other/Refund</span><span>{fmt(p.other_charges_refund)}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Govt Taxes</span><span>{fmt(p.govt_taxes)}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Transferable</span><span className="text-white font-semibold">{fmt(p.amount_transferable)}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Next Cycle</span><span>{p.next_payout_cycle || "—"}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Next Payout</span><span>{p.next_payout_date ? prettyD(p.next_payout_date) : "—"}</span></div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between"><span className="text-zinc-500">Net Pay-out</span><span className="text-white font-semibold">{fmt(p.net_payout)}</span></div>
                    <div className="flex justify-between col-span-2"><span className="text-zinc-500">Bank UTR</span><span className="font-mono text-xs">{p.bank_utr || "—"}</span></div>
                  </>
                )}
              </div>

              {/* Reconciliation */}
              <div className="border-t border-zinc-800 pt-3">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Reported vs Actual · {rc.days} day{rc.days === 1 ? "" : "s"} of reports</p>
                <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                  <div className="text-zinc-600"></div>
                  <div className="text-zinc-500 text-right">Reported</div>
                  <div className="text-zinc-500 text-right">Actual</div>

                  <div className="text-zinc-400">Orders</div>
                  <div className="text-right">{rc.repOrders}</div>
                  <div className={`text-right ${ordersOk ? "" : "text-red-400"}`}>{rc.actualOrders}{ordersOk ? "" : ` (${rc.ordersDiff > 0 ? "+" : ""}${rc.ordersDiff})`}</div>

                  <div className="text-zinc-400">{platform === "swiggy" ? "Value (gross)" : "Value"}</div>
                  <div className="text-right">{fmt(rc.repValue)}</div>
                  <div className={`text-right ${valueOk ? "" : "text-red-400"}`}>{fmt(rc.actualValue)}{valueOk ? "" : ` (${rc.valueDiff > 0 ? "+" : "−"}${fmt(Math.abs(rc.valueDiff))})`}</div>
                </div>
                {platform === "swiggy" && (
                  <p className="text-[10px] font-mono text-zinc-600 mt-2">Net transferable {fmt(p.amount_transferable)} (after fees/taxes — shown for reference, flag is on gross).</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
