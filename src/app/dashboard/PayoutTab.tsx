"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
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
type Parsed = {
  period_start: string | null; period_end: string | null;
  total_orders: string | number | null;
  customer_payable?: string | null; swiggy_service_fee?: string | null;
  other_charges_refund?: string | null; govt_taxes?: string | null;
  amount_transferable?: string | null; next_payout_cycle?: string | null; next_payout_date?: string | null;
  net_payout?: string | number | null; bank_utr?: string | null;
  _detected: string;
};

const fmt = (n: number | null | undefined) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");
const prettyD = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const num = (s: string | undefined) => { const v = parseFloat(String(s ?? "").replace(/,/g, "")); return isNaN(v) ? null : v; };
const int = (s: string | undefined) => { const v = parseInt(String(s ?? "").replace(/,/g, "")); return isNaN(v) ? null : v; };

const ORDERS_TOLERANCE_PCT = 10; // flag a week only when reported vs actual ORDERS differ by more than this %
const ordersGapPct = (rep: number, act: number) => (act > 0 ? Math.round((Math.abs(rep - act) / act) * 100) : (rep > 0 ? 100 : 0));

const MON: Record<string, string> = { jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12" };
const toISO = (s: string | null | undefined) => {
  if (!s) return null;
  const m = String(s).match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) return null;
  const mm = MON[m[2].slice(0, 3).toLowerCase()];
  if (!mm) return null;
  return `${m[3]}-${mm}-${m[1].padStart(2, "0")}`;
};
const cleanNum = (s: unknown): number | null => {
  if (s == null || s === "") return null;
  if (typeof s === "number") return s;
  const v = parseFloat(String(s).replace(/[₹,]/g, "").trim());
  return isNaN(v) ? null : v;
};

function parseSwiggy(text: string): Parsed {
  const t = text.replace(/\u00a0/g, " ");
  const grabBefore = (labelRe: RegExp) => {
    const m = labelRe.exec(t);
    if (!m) return null;
    const before = t.slice(0, m.index);
    const nums = before.match(/-?[\d,]+(?:\.\d+)?/g);
    if (!nums) return null;
    return nums[nums.length - 1].replace(/,/g, "");
  };
  const range = t.match(/(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})\s*[-\u2013]\s*(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})/);
  const cycleM = t.match(/Next Payout Cycle[\s\S]{0,80}?(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4}\s*[-\u2013]\s*\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})/i);
  const payM = t.match(/Next Payout on[\s\S]{0,40}?(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})/i);
  const idM = t.match(/Rest\.?\s*ID\s*:?\s*(\d+)/i);
  const lines = t.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const idxRest = lines.findIndex((l) => /Rest\.?\s*ID/i.test(l));
  const name = idxRest > 0 ? lines[idxRest - 1] : null;
  return {
    period_start: range ? toISO(range[1]) : null,
    period_end: range ? toISO(range[2]) : null,
    total_orders: grabBefore(/Total Orders/i),
    customer_payable: grabBefore(/Total Customer Payable/i),
    swiggy_service_fee: grabBefore(/Swiggy Service Fee/i),
    other_charges_refund: grabBefore(/Other Charges\s*\/?\s*Refund/i),
    govt_taxes: grabBefore(/Government Taxes/i),
    amount_transferable: grabBefore(/Amount Transferable/i),
    next_payout_cycle: cycleM ? cycleM[1] : null,
    next_payout_date: payM ? toISO(payM[1]) : null,
    _detected: (name || "") + (idM ? ` \u00b7 Rest ID ${idM[1]}` : ""),
  };
}

function parseZomato(rows: unknown[][]): Parsed {
  const find = (re: RegExp): unknown => {
    for (let i = 0; i < rows.length; i++) {
      const b = String(rows[i]?.[1] ?? "").trim();
      if (re.test(b)) {
        let c = rows[i]?.[2];
        if ((c === "" || c == null) && rows[i + 1]) c = rows[i + 1]?.[2];
        return c;
      }
    }
    return null;
  };
  const period = String(find(/report period/i) ?? "");
  const pm = period.match(/(\d{1,2}\s+[A-Za-z]+\s+\d{4})\s*[-\u2013]\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/);
  return {
    period_start: pm ? toISO(pm[1]) : null,
    period_end: pm ? toISO(pm[2]) : null,
    total_orders: cleanNum(find(/total orders/i)),
    net_payout: cleanNum(find(/net\s*pay-?out/i)),
    bank_utr: (String(find(/bank\s*utr/i) ?? "").trim()) || null,
    _detected: `${String(find(/res\s*name/i) || "").trim()} \u00b7 Res id ${String(find(/^res\s*id/i) || "").trim()}`,
  };
}

export default function PayoutTab({ user }: { user: Staff }) {
  const canViewAll = user.role === "Owner" || user.role === "Manager";
  const myOutlets = user.outlets || [];
  const visibleOutlets = canViewAll ? OUTLETS : myOutlets;

  const [platform, setPlatform] = useState<"swiggy" | "zomato">("swiggy");
  const [outlet, setOutlet] = useState<string>(visibleOutlets[0] || "");
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [reports, setReports] = useState<Rep[]>([]);
  const [loading, setLoading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>({});
  const [saving, setSaving] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [detected, setDetected] = useState("");
  const [parseErr, setParseErr] = useState("");
  const formRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"entry" | "history">("entry");
  const [histRows, setHistRows] = useState<Payout[]>([]);
  const [histReports, setHistReports] = useState<Rep[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histPf, setHistPf] = useState<"all" | "swiggy" | "zomato">("all");

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

  const recon = (p: Payout, reps: Rep[]) => {
    const pf = p.platform === "zomato" ? "zomato" : "swiggy";
    const inRange = reps.filter((r) => r.outlet_id === p.outlet_id && r.report_date >= p.period_start && r.report_date <= p.period_end);
    const repOrders = inRange.reduce((s, r) => s + (Number(pf === "swiggy" ? r.swiggy_sales_count : r.zomato_sales_count) || 0), 0);
    const repValue = inRange.reduce((s, r) => s + (Number(pf === "swiggy" ? r.swiggy_sales_value : r.zomato_sales_value) || 0), 0);
    const actualOrders = Number(p.total_orders) || 0;
    const actualValue = pf === "swiggy" ? (Number(p.customer_payable) || 0) : (Number(p.net_payout) || 0);
    return { repOrders, repValue, actualOrders, actualValue, ordersDiff: repOrders - actualOrders, valueDiff: Math.round(repValue) - Math.round(actualValue), days: inRange.length };
  };

  useEffect(() => {
    if (view !== "history") return;
    let cancelled = false;
    (async () => {
      if (visibleOutlets.length === 0) return;
      setHistLoading(true);
      const [{ data: pData }, { data: rData }] = await Promise.all([
        supabase.from("outlet_payouts").select("*").in("outlet_id", visibleOutlets).order("period_start", { ascending: false }),
        supabase.from("outlet_reports").select("outlet_id,report_date,swiggy_sales_count,swiggy_sales_value,zomato_sales_count,zomato_sales_value").in("outlet_id", visibleOutlets),
      ]);
      if (cancelled) return;
      setHistRows((pData as Payout[]) || []);
      setHistReports((rData as Rep[]) || []);
      setHistLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const resetForm = () => { setEditingId(null); setForm({}); setPasteText(""); setDetected(""); setParseErr(""); };
  const openEdit = (p: Payout) => {
    setEditingId(p.id);
    setPasteText(""); setDetected(""); setParseErr("");
    setForm({
      period_start: p.period_start || "", period_end: p.period_end || "",
      total_orders: p.total_orders?.toString() || "",
      customer_payable: p.customer_payable?.toString() || "", swiggy_service_fee: p.swiggy_service_fee?.toString() || "",
      other_charges_refund: p.other_charges_refund?.toString() || "", govt_taxes: p.govt_taxes?.toString() || "",
      amount_transferable: p.amount_transferable?.toString() || "", next_payout_cycle: p.next_payout_cycle || "",
      next_payout_date: p.next_payout_date || "", net_payout: p.net_payout?.toString() || "", bank_utr: p.bank_utr || "",
    });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const setF = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const applyParsed = (r: Parsed) => {
    setForm((f) => ({
      ...f,
      period_start: r.period_start || f.period_start || "",
      period_end: r.period_end || f.period_end || "",
      total_orders: r.total_orders != null ? String(r.total_orders) : (f.total_orders || ""),
      ...(platform === "swiggy"
        ? {
            customer_payable: r.customer_payable ?? "", swiggy_service_fee: r.swiggy_service_fee ?? "",
            other_charges_refund: r.other_charges_refund ?? "", govt_taxes: r.govt_taxes ?? "",
            amount_transferable: r.amount_transferable ?? "", next_payout_cycle: r.next_payout_cycle ?? "",
            next_payout_date: r.next_payout_date ?? "",
          }
        : { net_payout: r.net_payout != null ? String(r.net_payout) : "", bank_utr: r.bank_utr ?? "" }),
    }));
    setDetected(r._detected || "");
  };

  const extractSwiggy = () => {
    const r = parseSwiggy(pasteText);
    if (!r.period_start) { setParseErr("Couldn't find a period — paste the full email body."); return; }
    setParseErr("");
    applyParsed(r);
  };
  const uploadZomato = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames.find((n) => /summary/i.test(n)) || wb.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: "" }) as unknown[][];
      const r = parseZomato(rows);
      if (!r.period_start) { setParseErr("Couldn't read the Summary sheet — is this the right file?"); return; }
      setParseErr("");
      applyParsed(r);
    } catch (err) {
      setParseErr("Could not read file: " + (err instanceof Error ? err.message : String(err)));
    }
    e.target.value = "";
  };

  const save = async () => {
    if (!form.period_start || !form.period_end) { alert("Period start and end are required."); return; }
    if (form.period_end < form.period_start) { alert("Period end is before start."); return; }
    setSaving(true);
    const base = {
      outlet_id: outlet, platform,
      period_start: form.period_start, period_end: form.period_end,
      total_orders: int(form.total_orders),
      entry_method: pasteText || detected ? "upload" : "manual", entered_by: user.id, updated_at: new Date().toISOString(),
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
    resetForm();
    load();
  };

  const accent = platform === "swiggy" ? "text-orange-400" : "text-red-400";
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
      </div>

      {/* Entry | History toggle */}
      <div className="flex gap-2 mb-5">
        {(["entry", "history"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-2 text-xs font-mono uppercase tracking-widest border transition-colors ${view === v ? "border-yellow-400 text-yellow-400" : "border-zinc-800 text-zinc-500 hover:text-white"}`}>
            {v === "entry" ? "Entry" : "History"}
          </button>
        ))}
      </div>

      {view === "entry" && (
      <>
      {/* Platform toggle */}
      <div className="flex gap-2 mb-4">
        {(["swiggy", "zomato"] as const).map((pf) => (
          <button key={pf} onClick={() => { setPlatform(pf); resetForm(); }}
            className={`px-4 py-2 text-xs font-mono uppercase tracking-widest border transition-colors ${platform === pf ? (pf === "swiggy" ? "border-orange-400 text-orange-400" : "border-red-400 text-red-400") : "border-zinc-800 text-zinc-500 hover:text-white"}`}>
            {pf}
          </button>
        ))}
      </div>

      {/* Outlet selector */}
      <div className="mb-6">
        <label className={lblCls}>Outlet</label>
        <select value={outlet} onChange={(e) => { setOutlet(e.target.value); resetForm(); }} className={inputCls + " max-w-xs"}>
          {visibleOutlets.map((o) => <option key={o} value={o}>{OUTLET_NAMES[o] || o}</option>)}
        </select>
      </div>

      {/* Entry form (always visible for editors) */}
      {canEdit && (
        <div ref={formRef} className="bg-[#131316] border border-zinc-800 p-5 mb-6 max-w-3xl">
          <div className="flex justify-between items-center mb-4">
            <p className={`font-mono text-xs uppercase tracking-widest ${accent}`}>{editingId ? "Edit" : "New"} {platform} payout · {OUTLET_NAMES[outlet]}</p>
            {editingId && <button onClick={resetForm} className="text-[10px] font-mono uppercase tracking-widest px-2 py-1 border border-zinc-700 text-zinc-400 hover:text-white transition-colors">+ New instead</button>}
          </div>

          {/* Auto-fill */}
          {!editingId && (
            <div className="border border-zinc-800 bg-black/40 p-4 mb-5">
              <p className={lblCls}>{platform === "swiggy" ? "Paste Swiggy email, then Extract" : "Upload Zomato .xlsx"}</p>
              {platform === "swiggy" ? (
                <div className="space-y-2">
                  <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={4} placeholder="Paste the full Swiggy weekly payout email here…" className={inputCls + " font-mono text-xs"} />
                  <button onClick={extractSwiggy} className="text-[11px] font-mono uppercase tracking-widest px-3 py-2 border border-orange-400 text-orange-400 hover:bg-zinc-900 transition-colors">Extract</button>
                </div>
              ) : (
                <input type="file" accept=".xlsx,.xls" onChange={uploadZomato} className="block text-xs text-zinc-400 file:mr-3 file:py-2 file:px-3 file:border file:border-red-400 file:bg-transparent file:text-red-400 file:text-[11px] file:font-mono file:uppercase file:tracking-widest" />
              )}
              {detected && <p className="text-[11px] font-mono text-green-400 mt-2">Detected: {detected}</p>}
              {parseErr && <p className="text-[11px] font-mono text-red-400 mt-2">{parseErr}</p>}
              <p className="text-[10px] font-mono text-zinc-600 mt-2">Check the outlet above matches, then review fields below before saving.</p>
            </div>
          )}

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
            <button onClick={save} disabled={saving} className="text-[11px] font-mono uppercase tracking-widest px-4 py-2 bg-yellow-400 text-black font-bold hover:bg-yellow-300 transition-colors disabled:opacity-50">{saving ? "Saving…" : editingId ? "Update" : "Save"}</button>
            <button onClick={resetForm} className="text-[11px] font-mono uppercase tracking-widest px-4 py-2 border border-zinc-700 text-zinc-400 hover:text-white transition-colors">Clear</button>
          </div>
        </div>
      )}

      {/* History header */}
      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-3">{OUTLET_NAMES[outlet]} · {platform} history</p>

      {loading && <p className="text-zinc-600 font-mono text-xs">Loading…</p>}
      {!loading && payouts.length === 0 && (
        <p className="text-zinc-600 font-mono text-xs">No {platform} payouts entered for {OUTLET_NAMES[outlet]} yet.</p>
      )}

      <div className="space-y-4 max-w-3xl">
        {payouts.map((p) => {
          const rc = reconcile(p);
          const pct = ordersGapPct(rc.repOrders, rc.actualOrders);
          const ordersOk = pct <= ORDERS_TOLERANCE_PCT;
          const valueOk = true;
          const allOk = ordersOk;
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
                    {allOk ? "✓ orders match" : `⚠ orders ${pct}% off`}
                  </span>
                </div>
              </div>

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

              <div className="border-t border-zinc-800 pt-3">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Reported vs Actual · {rc.days} day{rc.days === 1 ? "" : "s"} of reports</p>
                <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                  <div className="text-zinc-600"></div>
                  <div className="text-zinc-500 text-right">Reported</div>
                  <div className="text-zinc-500 text-right">Actual</div>

                  <div className="text-zinc-400">Orders</div>
                  <div className="text-right">{rc.repOrders}</div>
                  <div className={`text-right ${ordersOk ? "" : "text-red-400"}`}>{rc.actualOrders}{ordersOk ? "" : ` (${rc.ordersDiff > 0 ? "+" : ""}${rc.ordersDiff})`}</div>

                  <div className="text-zinc-400">{platform === "swiggy" ? "Value (gross)" : "Value (gross vs net)"}</div>
                  <div className="text-right">{fmt(rc.repValue)}</div>
                  <div className={`text-right ${valueOk ? "" : "text-red-400"}`}>{fmt(rc.actualValue)}{valueOk ? "" : ` (${rc.valueDiff > 0 ? "+" : "\u2212"}${fmt(Math.abs(rc.valueDiff))})`}</div>
                </div>
                {platform === "swiggy" && (
                  <p className="text-[10px] font-mono text-zinc-600 mt-2">Net transferable {fmt(p.amount_transferable)} (after fees/taxes). Status is based on the orders gap, not value.</p>
                )}
                {platform === "zomato" && (
                  <p className="text-[10px] font-mono text-zinc-600 mt-2">Zomato payout is net of commission &amp; taxes, so it is lower than reported gross sales &mdash; that value gap is expected. Status is based on the orders gap.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      </>
      )}

      {view === "history" && (
        <div className="max-w-5xl">
          <div className="flex gap-2 mb-4">
            {(["all", "swiggy", "zomato"] as const).map((pf) => (
              <button key={pf} onClick={() => setHistPf(pf)}
                className={`px-3 py-1.5 text-[11px] font-mono uppercase tracking-widest border transition-colors ${histPf === pf ? "border-yellow-400 text-yellow-400" : "border-zinc-800 text-zinc-500 hover:text-white"}`}>
                {pf}
              </button>
            ))}
          </div>

          {histLoading && <p className="text-zinc-600 font-mono text-xs">Loading…</p>}
          {!histLoading && histRows.length === 0 && <p className="text-zinc-600 font-mono text-xs">No payouts saved yet.</p>}

          {!histLoading && histRows.length > 0 && (
            <>
              <div className="overflow-x-auto border border-zinc-800">
                <table className="w-full text-xs font-mono whitespace-nowrap">
                  <thead>
                    <tr className="text-zinc-500 uppercase tracking-widest text-[10px] border-b border-zinc-800">
                      <th className="text-left px-3 py-2.5">Outlet</th>
                      <th className="text-left px-3 py-2.5">Platform</th>
                      <th className="text-left px-3 py-2.5">Week</th>
                      <th className="text-right px-3 py-2.5">Orders R / A</th>
                      <th className="text-right px-3 py-2.5">Value R / A (gross)</th>
                      <th className="text-right px-3 py-2.5">Orders gap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {histRows.filter((p) => histPf === "all" || p.platform === histPf).map((p) => {
                      const rc = recon(p, histReports);
                      const pct = ordersGapPct(rc.repOrders, rc.actualOrders);
                      const ok = pct <= ORDERS_TOLERANCE_PCT;
                      const pfColor = p.platform === "swiggy" ? "text-orange-400" : "text-red-400";
                      return (
                        <tr key={p.id} className="border-b border-zinc-900 hover:bg-zinc-900/40">
                          <td className="px-3 py-2.5 text-white">{OUTLET_NAMES[p.outlet_id] || p.outlet_id}</td>
                          <td className={`px-3 py-2.5 uppercase ${pfColor}`}>{p.platform}</td>
                          <td className="px-3 py-2.5 text-zinc-300">{prettyD(p.period_start)} – {prettyD(p.period_end)}</td>
                          <td className="px-3 py-2.5 text-right text-zinc-300">{rc.repOrders} / <span className={ok ? "text-zinc-300" : "text-red-400"}>{rc.actualOrders}</span></td>
                          <td className="px-3 py-2.5 text-right text-zinc-400">{fmt(rc.repValue)} / {fmt(rc.actualValue)}{p.platform === "zomato" ? " net" : ""}</td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap"><span className={ok ? "text-green-400" : "text-red-400"}>{ok ? "✓" : "⚠"} {pct}%</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] font-mono text-zinc-600 mt-2 leading-relaxed max-w-3xl">R = reported in daily reports · A = actual from the platform. &ldquo;Orders gap&rdquo; = how far reported orders are from actual; flagged &#9888; only above {ORDERS_TOLERANCE_PCT}%. Value is gross reported vs payout &mdash; Zomato&rsquo;s payout is net of commission &amp; taxes, so its value gap is expected, not an error. Newest week first.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
