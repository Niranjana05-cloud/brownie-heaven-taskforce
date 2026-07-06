"use client";
import { useEffect, useState, useRef } from "react";
import * as XLSX from "xlsx";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { celebrate } from "../celebrate";
import { computeScores, type ScoreRow } from "@/lib/score";
import PayoutTab from "./PayoutTab";
import FounderDashboard from "./FounderDashboard";
import ReconciliationTab from "./ReconciliationTab";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Staff = { id: string; name: string; role: string; report_time: string | null; outlets?: string[] };
type Task = { id: string; title: string; description: string; status: string; priority: string; due_at: string; assigned_to: string; assigned_by: string; outlet_id: string | null };
type Report = { id: string; staff_id: string; content: string; submitted_at: string; is_late: boolean; report_data: Record<string, string>; staff_role: string };
type OutletReport = {
  id: string; staff_id: string; outlet_id: string; report_date: string;
  shop_sales_count: number; shop_sales_value: number;
  swiggy_sales_count: number; swiggy_sales_value: number;
  zomato_sales_count: number; zomato_sales_value: number;
  target: number; swiggy_live: boolean; zomato_live: boolean;
  discount_running: string; discount_rate_good: boolean;
  unavailable_items: string; expiry_count: number; expiry_items: string;
  complimentary_count: number; complimentary_reason: string;
issues: string; action_taken: string; submitted_at: string; is_late: boolean; is_edited: boolean;
bh_google_rating: number; bh_swiggy_rating: number; bh_zomato_rating: number;
cbh_google_rating: number; cbh_swiggy_rating: number; cbh_zomato_rating: number;
icbh_google_rating: number; icbh_swiggy_rating: number; icbh_zomato_rating: number;
};

const ALL_STAFF = [
  { id: "nishant", name: "Nishant Vijayakumar", role: "Owner", report_time: null, outlets: [] },
  { id: "arun", name: "Arun Kumar", role: "Manager", report_time: "22:00", outlets: [] },
  { id: "nilani", name: "Nilani Nallamuthu", role: "HR", report_time: "22:00", outlets: ["ra_puram","anna_nagar","pallavaram","vadapalani"] },
  { id: "gowtham", name: "Gowtham", role: "Purchase Manager", report_time: "22:00", outlets: [] },
  { id: "vishnu", name: "Vishnu", role: "Asst. Ops Manager", report_time: "22:00", outlets: ["velachery","perumbakkam","tambaram","porur"] },
  { id: "ahila", name: "Ahila", role: "Custom Cakes & Asst Ops", report_time: "22:00", outlets: ["royapettah","adayar","bsr_mall","besant_nagar"] },
  { id: "niranjana", name: "Niranjana", role: "Founder's Office", report_time: null, outlets: [] },
];

const OUTLETS = ["royapettah","adayar","bsr_mall","velachery","ra_puram","anna_nagar","pallavaram","vadapalani","besant_nagar","perumbakkam","tambaram","porur"];
const OUTLET_NAMES: Record<string, string> = {
  royapettah: "Royapettah",
  adayar: "Adyar",
  bsr_mall: "BSR Mall",
  velachery: "Velachery",
  ra_puram: "RA Puram",
  anna_nagar: "Anna Nagar",
  pallavaram: "Pallavaram",
  vadapalani: "Vadapalani",
  besant_nagar: "Besant Nagar",
  perumbakkam: "Perumbakkam",
  tambaram: "Tambaram",
  porur: "Porur",
};
const OUTLET_TARGETS: Record<string, string> = {
  royapettah: "80000",
  adayar: "18333",
  bsr_mall: "35000",
  ra_puram: "21666",
  anna_nagar: "50000",
  porur: "50000",
  perumbakkam: "13000",
  tambaram: "20000",
  velachery: "23333",
  pallavaram: "18000",
  vadapalani: "23333",
  besant_nagar: "11667",
};

const REPORT_FIELDS: Record<string, { label: string; key: string; type?: string }[]> = {
  arun: [
    { label: "Total Sales (Rs)", key: "total_sales" },
    { label: "Target (Rs)", key: "target" },
    { label: "Achievement %", key: "achievement" },
    { label: "Best Outlet", key: "best_outlet" },
    { label: "Worst Outlet", key: "worst_outlet" },
    { label: "Swiggy Sales (Rs)", key: "swiggy_sales" },
    { label: "Zomato Sales (Rs)", key: "zomato_sales" },
    { label: "Shop Sales (Rs)", key: "shop_sales" },
    { label: "Cake Sales", key: "cake_sales" },
    { label: "Ice Cream Sales", key: "ice_cream_sales" },
    { label: "Complaints Today", key: "complaints" },
    { label: "Negative Reviews", key: "negative_reviews" },
    { label: "Stock-out Issues", key: "stock_out" },
    { label: "Staff Issues", key: "staff_issues" },
    { label: "Top Issue 1", key: "issue_1" },
    { label: "Top Issue 2", key: "issue_2" },
    { label: "Top Issue 3", key: "issue_3" },
    { label: "Tomorrow Action 1", key: "action_1" },
    { label: "Tomorrow Action 2", key: "action_2" },
    { label: "Tomorrow Action 3", key: "action_3" },
  ],
 nilani: [
    { label: "Replacement Required (Yes/No)", key: "replacement_required" },
    { label: "Training Conducted (Yes/No)", key: "training_conducted" },
    { label: "Training Topic", key: "training_topic" },
    { label: "Outlets Checked/Visited", key: "outlets_checked" },
    { label: "Staff Issues", key: "staff_issues" },
    { label: "Warnings Issued", key: "warnings_issued" },
    { label: "New Candidates Contacted", key: "candidates_contacted" },
    { label: "Interviews Scheduled", key: "interviews_scheduled" },
    { label: "Top Issue 1", key: "issue_1" },
    { label: "Top Issue 2", key: "issue_2" },
    { label: "Top Issue 3", key: "issue_3" },
    { label: "Action Needed 1", key: "action_1" },
    { label: "Action Needed 2", key: "action_2" },
    { label: "Action Needed 3", key: "action_3" },
  ],
  gowtham: [
    { label: "Total Purchase Value (Rs)", key: "purchase_value" },
    { label: "Emergency Purchase Value (Rs)", key: "emergency_purchase" },
    { label: "Purchase as per Plan (Yes/No)", key: "purchase_as_planned" },
    { label: "Supplier Issues", key: "supplier_issues" },
    { label: "Material Rejected", key: "material_rejected" },
    { label: "Stock Shortage", key: "stock_shortage" },
    { label: "Dispatch Delay", key: "dispatch_delay" },
    { label: "High-value Stock Variance (Rs)", key: "stock_variance" },
    { label: "Tomorrow Purchase Requirement (Rs)", key: "tomorrow_purchase" },
    { label: "Top Issue 1", key: "issue_1" },
    { label: "Top Issue 2", key: "issue_2" },
    { label: "Top Issue 3", key: "issue_3" },
    { label: "Action Needed 1", key: "action_1" },
    { label: "Action Needed 2", key: "action_2" },
    { label: "Action Needed 3", key: "action_3" },
  ],
  vishnu: [
    { label: "Total Enquiries Received", key: "total_enquiries" },
    { label: "Orders Confirmed", key: "orders_confirmed" },
    { label: "Conversion %", key: "conversion_pct" },
    { label: "WhatsApp Sales Value (Rs)", key: "whatsapp_sales" },
    { label: "Pending Payments (Rs)", key: "pending_payments" },
    { label: "Custom Cake Orders", key: "custom_cake_orders" },
    { label: "Bulk Enquiries", key: "bulk_enquiries" },
    { label: "Complaints Handled", key: "complaints_handled" },
    { label: "Reviews Requested", key: "reviews_requested" },
    { label: "Reviews Received", key: "reviews_received" },
    { label: "Top Revenue Opportunity 1", key: "opportunity_1" },
    { label: "Top Revenue Opportunity 2", key: "opportunity_2" },
    { label: "Top Revenue Opportunity 3", key: "opportunity_3" },
    { label: "Pending Follow-up 1", key: "followup_1" },
    { label: "Pending Follow-up 2", key: "followup_2" },
    { label: "Pending Follow-up 3", key: "followup_3" },
  ],
  
   ahila: [
    { label: "Total No Of Customizations", key: "total_cakes" },
    { label: "Revenue", key: "revenue" },
    { label: "Confirmed & Placed Today", key: "confirmed_placed" },
    { label: "Pending & Following Leads", key: "pending_following" },
    { label: "Customisations Done Today", key: "cake_orders_today" },
    { label: "Orders Delivered on Time", key: "orders_on_time" },
    { label: "Cake Complaints", key: "cake_complaints" },
    { label: "Cake Wastage/Damage", key: "cake_wastage" },
    { label: "Royapettah Sales/Ops Issue", key: "royapettah_issue" },
    { label: "Swiggy/Zomato Issues", key: "swiggy_zomato_issues" },
    { label: "Negative Reviews", key: "negative_reviews" },
    { label: "Product Unavailable Issues", key: "unavailable_issues" },
    { label: "Tomorrow's Cake Orders", key: "tomorrow_cake_orders" },
    { label: "Top Issue 1", key: "issue_1" },
    { label: "Top Issue 2", key: "issue_2" },
    { label: "Top Issue 3", key: "issue_3" },
    { label: "Action Needed 1", key: "action_1" },
    { label: "Action Needed 2", key: "action_2" },
    { label: "Action Needed 3", key: "action_3" },
  ],
  bharani: [
    { label: "Outlets Audited", key: "outlets_audited" },
    { label: "Total Wastage (Rs)", key: "total_wastage" },
    { label: "Stock Mismatch Found (Yes/No)", key: "stock_mismatch" },
    { label: "Cash Reconciliation Status", key: "cash_reconciliation" },
    { label: "Exceptions Found", key: "exceptions_found" },
    { label: "High-value Discrepancy (Rs)", key: "discrepancy_value" },
    { label: "Outlets with Issues", key: "outlets_with_issues" },
    { label: "Top Issue 1", key: "issue_1" },
    { label: "Top Issue 2", key: "issue_2" },
    { label: "Top Issue 3", key: "issue_3" },
    { label: "Action Needed 1", key: "action_1" },
    { label: "Action Needed 2", key: "action_2" },
    { label: "Action Needed 3", key: "action_3" },
  ],
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<Staff | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"tasks" | "my_report" | "all_reports" | "analytics" | "outlet_reports" | "owner_outlets" | "history" | "attendance" | "sales_target" | "payout" | "reconciliation">("tasks");
  const fetchRangeReports = async (outlets: string[]) => {
    let q = supabase.from("outlet_reports").select("*").gte("report_date", repFrom).lte("report_date", repTo).order("report_date", { ascending: true });
    if (outlets.length > 0) q = q.in("outlet_id", outlets);
    const { data } = await q;
    return (data || []) as any[];
  };
  const buildRangeRows = (rows: any[]) => rows.map(r => {
    const shop = Number(r.shop_sales_value) || 0, sw = Number(r.swiggy_sales_value) || 0, zo = Number(r.zomato_sales_value) || 0;
    return { Date: r.report_date, Outlet: (typeof OUTLET_NAMES !== "undefined" ? (OUTLET_NAMES as any)[r.outlet_id] : r.outlet_id) || r.outlet_id, Shop: shop, Swiggy: sw, Zomato: zo, Total: shop + sw + zo, "Shop Orders": Number(r.shop_sales_count) || 0, "Swiggy Orders": Number(r.swiggy_sales_count) || 0, "Zomato Orders": Number(r.zomato_sales_count) || 0, Target: Number(r.target) || 0, Late: r.is_late ? "Yes" : "No", Issues: r.issues || "" };
  });
  const downloadRangeExcel = async () => {
    setRepBusy(true);
    try {
      const rows = await fetchRangeReports(repOutlets);
      if (rows.length === 0) { alert("No reports found for that range/outlets."); setRepBusy(false); return; }
      const data = buildRangeRows(rows);
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "Daily Rows");
      const byOutlet: Record<string, any> = {};
      data.forEach(d => { const k = d.Outlet; if (!byOutlet[k]) byOutlet[k] = { Outlet: k, Days: 0, Shop: 0, Swiggy: 0, Zomato: 0, Total: 0 }; byOutlet[k].Days++; byOutlet[k].Shop += d.Shop; byOutlet[k].Swiggy += d.Swiggy; byOutlet[k].Zomato += d.Zomato; byOutlet[k].Total += d.Total; });
      const summary = Object.values(byOutlet).map((s: any) => ({ ...s, "Avg/Day": Math.round(s.Total / s.Days) }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Summary");
     XLSX.writeFile(wb, `OutletReports_${repFrom}_to_${repTo}.xlsx`);
    } catch (e: any) { alert("Export failed: " + (e?.message || "error")); }
    setRepBusy(false);
  };
  const loadH2P = (): Promise<any> => new Promise((res, rej) => { const w = window as any; if (w.html2pdf) return res(w.html2pdf); const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"; s.onload = () => res((window as any).html2pdf); s.onerror = () => rej(new Error("pdf lib failed")); document.body.appendChild(s); });
  const downloadRangePDF = async () => {
    setRepBusy(true);
    let h2p: any; try { h2p = await loadH2P(); } catch { alert("Could not load the PDF tool."); setRepBusy(false); return; }
    try {
      const rows = await fetchRangeReports(repOutlets);
      if (rows.length === 0) { alert("No reports found for that range/outlets."); setRepBusy(false); return; }
      const data = buildRangeRows(rows);
      const rs = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
      const byO: Record<string, any> = {};
      data.forEach(d => { if (!byO[d.Outlet]) byO[d.Outlet] = { Outlet: d.Outlet, Days: 0, Shop: 0, Swiggy: 0, Zomato: 0, Total: 0 }; const b = byO[d.Outlet]; b.Days++; b.Shop += d.Shop; b.Swiggy += d.Swiggy; b.Zomato += d.Zomato; b.Total += d.Total; });
      const summ = Object.values(byO) as any[];
      const grand = summ.reduce((s, x) => s + x.Total, 0);
      const C = { bg: "#FAF3E7", card: "#FFFDF8", ink: "#3E2415", soft: "#8A6A4A", gold: "#C8901E", line: "#EADBC2", green: "#2E7D32", red: "#C62828" };
      const avgPerDay = (s: any) => s.Days > 0 ? s.Total / s.Days : 0;
      const comment = (perDay: number) => {
        if (perDay >= 80000) return ["🔥", "On fire! Crushing it 🤑", C.green];
        if (perDay >= 50000) return ["💪", "Strong stuff, keep going 👏", C.green];
        if (perDay >= 30000) return ["🙂", "Doing okay, room to grow 📈", C.gold];
        if (perDay >= 15000) return ["😬", "A bit slow… push harder 🏃", C.gold];
        if (perDay > 0)      return ["🥲", "Yikes, needs serious love 🚑", C.red];
        return ["💤", "Fast asleep — wake up! ⏰", C.soft];
      };
      const days = (new Date(repTo).getTime() - new Date(repFrom).getTime()) / 86400000 + 1;
      const gPerDay = days > 0 ? grand / days : 0;
      const gVerdict = gPerDay >= 80000 * summ.length ? "🎉 Money machine go brrr! We're cooking 🧑‍🍳" : gPerDay >= 40000 * Math.max(summ.length, 1) ? "😎 Solid month, brownies are selling 🍫" : "😅 Could be tastier — let's hustle next month 💸";
      const sumRows = summ.map(s => { const [emo] = comment(avgPerDay(s)); return `<tr><td style="padding:7px 10px;border-bottom:1px solid ${C.line};font-weight:600;color:${C.ink};font-size:12px">${emo} ${s.Outlet}</td><td style="padding:7px 10px;border-bottom:1px solid ${C.line};text-align:right;font-size:12px;color:${C.soft}">${s.Days}</td><td style="padding:7px 10px;border-bottom:1px solid ${C.line};text-align:right;font-size:12px;color:${C.soft}">${rs(s.Shop)}</td><td style="padding:7px 10px;border-bottom:1px solid ${C.line};text-align:right;font-size:12px;color:${C.soft}">${rs(s.Swiggy)}</td><td style="padding:7px 10px;border-bottom:1px solid ${C.line};text-align:right;font-size:12px;color:${C.soft}">${rs(s.Zomato)}</td><td style="padding:7px 10px;border-bottom:1px solid ${C.line};text-align:right;font-weight:800;color:${C.ink};font-size:12px">${rs(s.Total)}</td></tr>`; }).join("");
      const noteCards = summ.map(s => { const [emo, msg, col] = comment(avgPerDay(s)); return `<div style="display:flex;align-items:center;gap:8px;background:${C.card};border:1px solid ${C.line};border-left:4px solid ${col};border-radius:8px;padding:8px 12px;margin-bottom:7px"><span style="font-size:18px">${emo}</span><span style="font-size:12px;color:${C.ink};font-weight:600;min-width:120px">${s.Outlet}</span><span style="font-size:12px;color:${col};font-style:italic">${msg}</span></div>`; }).join("");
      const dayRows = data.map(d => `<tr><td style="padding:5px 8px;border-bottom:1px solid ${C.line};font-size:10px;color:${C.soft}">${d.Date}</td><td style="padding:5px 8px;border-bottom:1px solid ${C.line};font-size:10px;color:${C.ink}">${d.Outlet}</td><td style="padding:5px 8px;border-bottom:1px solid ${C.line};text-align:right;font-size:10px;color:${C.soft}">${rs(d.Shop)}</td><td style="padding:5px 8px;border-bottom:1px solid ${C.line};text-align:right;font-size:10px;color:${C.soft}">${rs(d.Swiggy)}</td><td style="padding:5px 8px;border-bottom:1px solid ${C.line};text-align:right;font-size:10px;color:${C.soft}">${rs(d.Zomato)}</td><td style="padding:5px 8px;border-bottom:1px solid ${C.line};text-align:right;font-weight:700;color:${C.ink};font-size:10px">${rs(d.Total)}</td></tr>`).join("");
      const html = `<div style="width:794px;background:${C.bg};font-family:'Segoe UI',Arial,sans-serif;color:${C.ink}">
        <div style="background:linear-gradient(135deg,${C.ink},#5C3A22);padding:22px 32px">
          <div style="font-size:22px;font-weight:800;color:#FFF6E5">🍫 Brownie Heaven — Outlet Reports</div>
          <div style="font-size:12px;color:#E0A52E;letter-spacing:1px">📅 ${repFrom} → ${repTo} · ${repOutlets.length ? repOutlets.length + " outlet(s)" : "all outlets"}</div>
        </div>
        <div style="padding:24px 32px">
          <div style="background:${C.card};border:1px solid ${C.line};border-radius:14px;padding:18px;text-align:center;margin-bottom:18px">
            <div style="font-size:12px;color:${C.soft};text-transform:uppercase;letter-spacing:1px">💰 Total sales in range</div>
            <div style="font-size:34px;font-weight:900;color:${C.ink}">${rs(grand)}</div>
          <div style="font-size:11px;color:${C.soft}">${data.length} daily reports across ${summ.length} outlet(s)</div>
            <div style="margin-top:10px;font-size:14px;font-weight:700;color:${C.ink}">${gVerdict}</div>
          </div>
          <div style="font-size:15px;font-weight:800;margin:6px 0 10px">📊 Summary by outlet — with the honest verdict 👀</div>
        <table style="width:100%;border-collapse:collapse;background:${C.card};border:1px solid ${C.line};border-radius:12px;overflow:hidden;margin-bottom:14px">
            <thead><tr style="background:${C.ink}"><th style="padding:8px 10px;text-align:left;color:#FFF6E5;font-size:10px">OUTLET</th><th style="padding:8px 10px;text-align:right;color:#FFF6E5;font-size:10px">DAYS</th><th style="padding:8px 10px;text-align:right;color:#FFF6E5;font-size:10px">SHOP</th><th style="padding:8px 10px;text-align:right;color:#FFF6E5;font-size:10px">SWIGGY</th><th style="padding:8px 10px;text-align:right;color:#FFF6E5;font-size:10px">ZOMATO</th><th style="padding:8px 10px;text-align:right;color:#FFF6E5;font-size:10px">TOTAL</th></tr></thead>
       <tbody>${sumRows}</tbody>
          </table>
         ${(() => {
            if (summ.length === 0) return "";
            const tShop = summ.reduce((a, s) => a + s.Shop, 0);
            const tSw = summ.reduce((a, s) => a + s.Swiggy, 0);
            const tZo = summ.reduce((a, s) => a + s.Zomato, 0);
            const tAll = tShop + tSw + tZo || 1;
            const R = 60, CX = 75, CY = 75, SW = 26, CIRC = 2 * Math.PI * R;
            let acc = 0;
            const segs = [[tShop, "#FACC15"], [tSw, "#FB923C"], [tZo, "#EF4444"]].map(([v, c]: any) => { const frac = v / tAll; const len = frac * CIRC; const off = -acc * CIRC; acc += frac; return `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${c}" stroke-width="${SW}" stroke-dasharray="${len} ${CIRC - len}" stroke-dashoffset="${off}" transform="rotate(-90 ${CX} ${CY})"></circle>`; }).join("");
            const leg = (c: string, n: string, v: number) => `<div style="display:flex;align-items:center;gap:7px;margin-bottom:5px"><span style="width:11px;height:11px;background:${c};border-radius:2px;display:inline-block"></span><span style="font-size:12px;color:${C.ink};font-weight:600;min-width:62px">${n}</span><span style="font-size:12px;color:${C.soft}">${rs(v)} · ${((v / tAll) * 100).toFixed(0)}%</span></div>`;
            const CLOUD = ["Pallavaram", "Velachery", "Vadapalani"];
            const dineIn = summ.filter(s => !CLOUD.includes(s.Outlet));
            const byTotal = [...summ].sort((a, b) => b.Total - a.Total);
            const star = byTotal[0], slug = byTotal[byTotal.length - 1];
            const onShare = (s: any) => s.Total > 0 ? ((s.Swiggy + s.Zomato) / s.Total) * 100 : 0;
            const onlinePool = dineIn.length > 0 ? dineIn : summ;
            const mostOnline = [...onlinePool].sort((a, b) => onShare(b) - onShare(a))[0];
            const bestShop = [...onlinePool].sort((a, b) => b.Shop - a.Shop)[0];
            const multi = summ.length > 1;
            const card = (emoji: string, title: string, name: string, val: string, quip: string, accent: string) => `<div style="flex:1;min-width:150px;background:${C.card};border:1px solid ${C.line};border-top:4px solid ${accent};border-radius:12px;padding:13px 15px"><div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:${C.soft};margin-bottom:5px">${emoji} ${title}</div><div style="font-size:15px;font-weight:800;color:${C.ink}">${name}</div><div style="font-size:12px;font-weight:700;color:${accent};margin:2px 0 4px">${val}</div><div style="font-size:10px;color:${C.soft};font-style:italic">${quip}</div></div>`;
            const awards = multi ? `
              <div style="display:flex;flex-wrap:wrap;gap:10px">
                ${card("🏆", "Star Outlet", star.Outlet, rs(star.Total), "The MVP carrying the team 💪", C.gold)}
                ${card("🐌", "Needs Help", slug.Outlet, rs(slug.Total), "Send backup… and a hug 🫂", "#C62828")}
                ${card("📱", "Most Online", mostOnline.Outlet, onShare(mostOnline).toFixed(0) + "% online", "Living that delivery life 🛵", "#3B82F6")}
                ${card("🏪", "Best Walk-in", bestShop.Outlet, rs(bestShop.Shop), "People show up here 🚶", "#2E7D32")}
              </div>` : `
              <div style="display:flex;flex-wrap:wrap;gap:10px">
                ${card("📱", "Online share", star.Outlet, onShare(star).toFixed(0) + "%", onShare(star) > 60 ? "Delivery is the bread & butter 🛵" : "Nice walk-in balance 🚶", "#3B82F6")}
                ${card("🏪", "Walk-in sales", star.Outlet, rs(star.Shop), "Counter's doing work 💪", "#2E7D32")}
                ${card("🛵", "Delivery sales", star.Outlet, rs(star.Swiggy + star.Zomato), "Swiggy + Zomato combined 📦", "#FB923C")}
              </div>`;
            return `
          <div style="display:flex;gap:18px;align-items:flex-start;margin:18px 0">
            <div style="text-align:center">
              <div style="font-size:13px;font-weight:800;color:${C.ink};margin-bottom:6px">📱 Channel mix</div>
              <svg width="150" height="150" viewBox="0 0 150 150">
                <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="#EADBC2" stroke-width="${SW}"></circle>
                ${segs}
                <text x="${CX}" y="${CY - 4}" text-anchor="middle" style="font-size:14px;font-weight:800;fill:${C.ink}">${rs(tAll)}</text>
                <text x="${CX}" y="${CY + 12}" text-anchor="middle" style="font-size:8px;fill:${C.soft};letter-spacing:1px">TOTAL</text>
              </svg>
              <div style="margin-top:10px;text-align:left">
                ${leg("#FACC15", "Shop", tShop)}
                ${leg("#FB923C", "Swiggy", tSw)}
                ${leg("#EF4444", "Zomato", tZo)}
              </div>
            </div>
            <div style="flex:1">
              <div style="font-size:15px;font-weight:800;margin-bottom:10px;color:${C.ink}">🏅 ${multi ? "Awards — hall of fame &amp; shame" : "Outlet snapshot"}</div>
              ${awards}
            </div>
          </div>`;
          })()}
          ${(() => {
            const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            const full: Record<string, string> = { Sun: "Sunday", Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday" };
            const tot = [0, 0, 0, 0, 0, 0, 0], cnt = [0, 0, 0, 0, 0, 0, 0];
            data.forEach(d => { const sd = new Date(d.Date + "T00:00:00"); sd.setDate(sd.getDate() - 1); const wd = sd.getDay(); tot[wd] += d.Total; cnt[wd]++; });
            const avg = tot.map((t, i) => cnt[i] > 0 ? t / cnt[i] : 0);
            const maxAvg = Math.max(...avg, 1);
            const order = [1, 2, 3, 4, 5, 6, 0];
            const bestI = avg.indexOf(Math.max(...avg));
            const nz = avg.map((v, i) => ({ v, i })).filter(x => x.v > 0).sort((a, b) => a.v - b.v);
            const worstI = nz.length ? nz[0].i : bestI;
            const bars = order.map(i => { const pct = Math.max(2, (avg[i] / maxAvg) * 100); const best = i === bestI && avg[i] > 0; return `<div style="margin-bottom:9px"><div style="font-size:11px;font-weight:700;color:${best ? C.gold : C.ink};margin-bottom:3px">${best ? "🏆 " : ""}${full[DOW[i]]} — ${rs(avg[i])}/day</div><div style="height:14px;background:${C.line};border-radius:7px;overflow:hidden"><div style="height:14px;width:${pct}%;background:${best ? C.gold : "#D9C3A0"}"></div></div></div>`; }).join("");
            const quip = (bestI === 0 || bestI === 6) ? "Weekends are the goldmine 🤑 — staff up Fri–Sun!" : "Midweek is quietly carrying the month 💪 — most people bet on weekends.";
            return `
          <div style="font-size:15px;font-weight:800;margin:18px 0 10px;color:${C.ink}">📅 Which day sells best? <span style="font-size:11px;font-weight:400;color:${C.soft}">(avg sales per weekday)</span></div>
          <div style="background:${C.card};border:1px solid ${C.line};border-radius:12px;padding:16px 18px;margin-bottom:18px">
            ${bars}
            <div style="margin-top:10px;font-size:12px;color:${C.ink};font-weight:700">🏆 Best: ${full[DOW[bestI]]} (${rs(avg[bestI])}/day) &nbsp;·&nbsp; 😴 Slowest: ${full[DOW[worstI]]} (${rs(avg[worstI])}/day)</div>
            <div style="font-size:11px;color:${C.soft};font-style:italic;margin-top:4px">${quip}</div>
          </div>
          <div style="font-size:13px;font-weight:800;margin:4px 0 8px;color:${C.ink}">💬 The honest verdict 👀</div>
          ${noteCards}`;
          })()}
          <div style="font-size:15px;font-weight:800;margin:18px 0 10px;page-break-before:always">🗓️ Daily detail</div>
          <table style="width:100%;border-collapse:collapse;background:${C.card};border:1px solid ${C.line};border-radius:12px;overflow:hidden">
            <thead><tr style="background:${C.ink}"><th style="padding:7px 8px;text-align:left;color:#FFF6E5;font-size:9px">DATE</th><th style="padding:7px 8px;text-align:left;color:#FFF6E5;font-size:9px">OUTLET</th><th style="padding:7px 8px;text-align:right;color:#FFF6E5;font-size:9px">SHOP</th><th style="padding:7px 8px;text-align:right;color:#FFF6E5;font-size:9px">SWIGGY</th><th style="padding:7px 8px;text-align:right;color:#FFF6E5;font-size:9px">ZOMATO</th><th style="padding:7px 8px;text-align:right;color:#FFF6E5;font-size:9px">TOTAL</th></tr></thead>
            <tbody>${dayRows}</tbody>
          </table>
          <div style="text-align:center;font-size:10px;color:${C.soft};margin-top:18px">🍫 Brownie Heaven · ${repFrom} to ${repTo}</div>
        </div></div>`;
      const holder = document.createElement("div"); holder.style.position = "fixed"; holder.style.left = "-9999px"; holder.innerHTML = html; document.body.appendChild(holder);
      try { await h2p().set({ margin: 0, filename: `OutletReports_${repFrom}_to_${repTo}.pdf`, image: { type: "jpeg", quality: 0.97 }, html2canvas: { scale: 2, backgroundColor: "#FAF3E7" }, jsPDF: { unit: "pt", format: "a4", orientation: "portrait" }, pagebreak: { mode: ["css", "legacy"] } }).from(holder.firstElementChild).save(); }
      finally { document.body.removeChild(holder); }
    } catch (e: any) { alert("Export failed: " + (e?.message || "error")); }
    setRepBusy(false);
  };
  const [expandedOutlet, setExpandedOutlet] = useState<string | null>(null);
  const _today = new Date().toISOString().split("T")[0];
  const _mStart = _today.slice(0, 8) + "01";
  const [repFrom, setRepFrom] = useState<string>(_mStart);
  const [repTo, setRepTo] = useState<string>(_today);
  const [repOutlets, setRepOutlets] = useState<string[]>([]);
  const [repBusy, setRepBusy] = useState(false);
  const [outletFilter, setOutletFilter] = useState("all");
  const [reportData, setReportData] = useState<Record<string, string>>({});
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportOffDay, setReportOffDay] = useState(false);
  const [offToday, setOffToday] = useState<string[]>([]);
  const [attendanceData, setAttendanceData] = useState({ present: "", absent: "", late: "", absent_names: "", late_names: "" });
  const [attendanceSubmitting, setAttendanceSubmitting] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [attendanceDate, setAttendanceDate] = useState<string>(() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split("T")[0]; });
  const [salesTargets, setSalesTargets] = useState<Record<string, any>>({});
  const [stEditing, setStEditing] = useState<string | null>(null);
  const [stDate, setStDate] = useState<string>(() => new Date(Date.now() - 86400000).toISOString().split("T")[0]);
  const [stFiles, setStFiles] = useState<Record<string, { mis?: File; pnl?: File }>>({});
  const [stUpload, setStUpload] = useState<Record<string, any>>({});
  const [stUpBusy, setStUpBusy] = useState<string>("");
  const [stUpMsg, setStUpMsg] = useState<Record<string, string>>({});
  const [stEditValues, setStEditValues] = useState<Record<string, string>>({});
  const [stSaving, setStSaving] = useState(false);
  const [todayReport, setTodayReport] = useState<Report | null>(null);
  const [overdueTask, setOverdueTask] = useState<Task | null>(null);
  const [forceAckReason, setForceAckReason] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("arun");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskDueHours, setTaskDueHours] = useState("4");
  const [taskOutlet, setTaskOutlet] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [pinMsg, setPinMsg] = useState("");
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [reportHistoryDate, setReportHistoryDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [reportByDate, setReportByDate] = useState<Report | null>(null);
  const [activeOutlet, setActiveOutlet] = useState<string>("");
  const [outletReports, setOutletReports] = useState<Record<string, OutletReport>>({});
  const [outletReportData, setOutletReportData] = useState<Record<string, string>>({});
  const [outletSubmitting, setOutletSubmitting] = useState(false);
  const [outletEntryDate, setOutletEntryDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [outletWasOff, setOutletWasOff] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [revForm, setRevForm] = useState<{ platform: string; rating: string; valid: boolean; refund: boolean; note: string }>({ platform: "Swiggy", rating: "5", valid: false, refund: false, note: "" });
  const [revSaving, setRevSaving] = useState(false);
  const [targetCheck, setTargetCheck] = useState<any[] | null>(null);
  const [targetReaction, setTargetReaction] = useState(false);
  const [anFrom, setAnFrom] = useState<string>(() => { const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().slice(0, 10); });
  const [anTo, setAnTo] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [anRows, setAnRows] = useState<any[]>([]);
  const [anLoading, setAnLoading] = useState(false);
  const [worst, setWorst] = useState<ScoreRow | null>(null);
  const [scoreRows, setScoreRows] = useState<ScoreRow[]>([]);
  const [best, setBest] = useState<ScoreRow | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    computeScores().then((res) => { if (!cancelled) { setWorst(res.worst); setBest(res.best); setScoreRows(res.rows); } }).catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (activeTab !== "analytics") return;
    let cancelled = false;
    (async () => {
      setAnLoading(true);
      const { data } = await supabase.from("outlet_reports")
        .select("shop_sales_count,shop_sales_value,swiggy_sales_count,swiggy_sales_value,zomato_sales_count,zomato_sales_value,report_date")
        .gte("report_date", anFrom).lte("report_date", anTo);
      if (cancelled) return;
      setAnRows(data || []);
      setAnLoading(false);
    })();
    return () => { cancelled = true; };
  }, [activeTab, anFrom, anTo]);

  const anAgg = (() => {
    const ch = { shop: { c: 0, v: 0 }, swiggy: { c: 0, v: 0 }, zomato: { c: 0, v: 0 } };
    anRows.forEach((r: any) => {
      ch.shop.c += Number(r.shop_sales_count) || 0; ch.shop.v += Number(r.shop_sales_value) || 0;
      ch.swiggy.c += Number(r.swiggy_sales_count) || 0; ch.swiggy.v += Number(r.swiggy_sales_value) || 0;
      ch.zomato.c += Number(r.zomato_sales_count) || 0; ch.zomato.v += Number(r.zomato_sales_value) || 0;
    });
    const totalV = ch.shop.v + ch.swiggy.v + ch.zomato.v;
    const totalC = ch.shop.c + ch.swiggy.c + ch.zomato.c;
    return { ch, totalV, totalC };
  })();
  const anINR = (v: number) => "₹" + Math.round(v || 0).toLocaleString("en-IN");
  const anPct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
  const [outletHistoryDate, setOutletHistoryDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [lastOutletRatings, setLastOutletRatings] = useState<Record<string, OutletReport>>({});
  const [allOutletReports, setAllOutletReports] = useState<OutletReport[]>([]);
  const [historyDate, setHistoryDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [historyReports, setHistoryReports] = useState<Report[]>([]);
  const [historyOutletReports, setHistoryOutletReports] = useState<OutletReport[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("currentUser");
    if (!stored) { router.push("/"); return; }
    let parsed;
    try {
      parsed = JSON.parse(stored);
      if (typeof parsed === "string") { localStorage.removeItem("currentUser"); router.push("/"); return; }
    } catch { localStorage.removeItem("currentUser"); router.push("/"); return; }
    setUser(parsed);
    fetchDayOff(parsed.id);
    fetchTasks(parsed);
    fetchReports(parsed);
   fetchAttendance(parsed, new Date(Date.now() - 86400000).toISOString().split("T")[0]);
   fetchSalesTargets(parsed);
  fetchOutletReports(parsed);
    fetchLastOutletRatings(parsed);
   if (parsed.role === "Owner" || parsed.role === "Manager") fetchAllOutletReports();
  }, [router]);

 useEffect(() => { if (activeOutlet) fetchReviews(activeOutlet, outletEntryDate); else setReviews([]); }, [activeOutlet, outletEntryDate]);
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => { fetchTasks(user); fetchReports(user); }, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const fetchTasks = async (u: Staff) => {
    setLoading(true);
    let query = supabase.from("tasks").select("*").order("created_at", { ascending: false });
   if (u.role !== "Owner" && u.role !== "Manager") {
  const staffOutlets = (u as Staff & { outlets?: string[] }).outlets || [];
  if (staffOutlets.length > 0) {
    query = query.or(`assigned_to.eq.${u.id},outlet_id.in.(${staffOutlets.join(",")})`);
  } else {
    query = query.eq("assigned_to", u.id);
  }
}
    const { data } = await query;
    setTasks(data || []);
    setLoading(false);
    if (u.role !== "Owner") {
      const overdue = (data || []).find((t: Task) => t.status !== "completed" && new Date(t.due_at) < new Date());
     if (overdue) { setOverdueTask(overdue); playAlert(); }
    }
  };
  const exportCSV = () => {
  if (historyOutletReports.length === 0) { alert("No outlet reports for this date."); return; }
  const headers = ["Outlet", "Manager", "Date", "Shop Sales Value", "Shop Sales Count", "Swiggy Value", "Swiggy Count", "Zomato Value", "Zomato Count", "Total Sales", "Target", "Swiggy Live", "Zomato Live", "Discount Running", "Discount Rate Good", "Unavailable Items", "Expiry Count", "Expiry Items", "Complimentary Count", "Complimentary Reason", "Issues", "Action Taken", "Submitted At", "Late"];
  const rows = historyOutletReports.map(r => {
    const manager = ALL_STAFF.find(s => (s.outlets as string[]).includes(r.outlet_id))?.name || "—";
    const total = Number(r.shop_sales_value) + Number(r.swiggy_sales_value) + Number(r.zomato_sales_value);
    return [
      OUTLET_NAMES[r.outlet_id] || r.outlet_id.replace(/_/g, " "),
      manager,
      r.report_date,
      r.shop_sales_value,
      r.shop_sales_count,
      r.swiggy_sales_value,
      r.swiggy_sales_count,
      r.zomato_sales_value,
      r.zomato_sales_count,
      total,
      r.target,
      r.swiggy_live ? "Yes" : "No",
      r.zomato_live ? "Yes" : "No",
      r.discount_running || "",
      r.discount_rate_good ? "Yes" : "No",
      r.unavailable_items || "",
      r.expiry_count,
      r.expiry_items || "",
      r.complimentary_count,
      r.complimentary_reason || "",
      r.issues || "",
      r.action_taken || "",
      new Date(r.submitted_at).toLocaleString("en-IN"),
      r.is_late ? "Yes" : "No",
    ];
  });
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `brownie-heaven-outlet-reports-${historyDate}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
  const fetchHistoryReports = async (date: string) => {
  setHistoryLoading(true);
  const start = `${date}T00:00:00.000Z`;
  const end = `${date}T23:59:59.999Z`;
  const [{ data: reps }, { data: outletReps }] = await Promise.all([
    supabase.from("reports").select("*").gte("submitted_at", start).lte("submitted_at", end).order("submitted_at", { ascending: false }),
    supabase.from("outlet_reports").select("*").eq("report_date", date).order("submitted_at", { ascending: false }),
  ]);
  setHistoryReports(reps || []);
  setHistoryOutletReports(outletReps || []);
  setHistoryLoading(false);
};
  const fetchAllOutletReportsByDate = async (date: string) => {
  const { data } = await supabase
    .from("outlet_reports")
    .select("*")
    .eq("report_date", date)
    .order("submitted_at", { ascending: false });
  setAllOutletReports(data || []);
};
 const fetchAllOutletReports = async (date?: string) => {
  const today = date || new Date().toISOString().split("T")[0];
  const { data } = await supabase
    .from("outlet_reports")
    .select("*")
    .eq("report_date", today)
    .order("submitted_at", { ascending: false });
  setAllOutletReports(data || []);
};
  const fetchOutletReportsByDate = async (date: string, u: Staff | null = user) => {
  if (!u) return;
  const _isMgr = u.role === "Owner" || u.role === "Manager";
  let _q = supabase.from("outlet_reports").select("*").eq("report_date", date);
  if (!_isMgr) _q = _q.eq("staff_id", u.id);
  const { data } = await _q;
  const map: Record<string, OutletReport> = {};
  (data || []).forEach((r: OutletReport) => { map[r.outlet_id] = r; });
  setOutletReports(map);
};
  const fetchLastOutletRatings = async (u: Staff) => {
  const { data } = await supabase
    .from("outlet_reports")
    .select("outlet_id, bh_google_rating, bh_swiggy_rating, bh_zomato_rating, cbh_google_rating, cbh_swiggy_rating, cbh_zomato_rating, icbh_google_rating, icbh_swiggy_rating, icbh_zomato_rating")
    .eq("staff_id", u.id)
    .not("bh_google_rating", "is", null)
    .order("submitted_at", { ascending: false });
  const map: Record<string, OutletReport> = {};
 (data || []).forEach((r: any) => {
    if (!map[r.outlet_id]) map[r.outlet_id] = r;
  });
 
  setLastOutletRatings(map);
};
const fetchOutletReports = async (u: Staff) => {
  const today = new Date().toISOString().split("T")[0];
  const _isMgr = u.role === "Owner" || u.role === "Manager";
  let _q = supabase.from("outlet_reports").select("*").eq("report_date", today);
  if (!_isMgr) _q = _q.eq("staff_id", u.id);
  const { data } = await _q;
  const map: Record<string, OutletReport> = {};
  (data || []).forEach((r: OutletReport) => { map[r.outlet_id] = r; });
  setOutletReports(map);
  return map;
};
  const fetchReportByDate = async (date: string) => {
  if (!user) return;
  const start = `${date}T00:00:00.000Z`;
  const end = `${date}T23:59:59.999Z`;
  const { data } = await supabase
    .from("reports")
    .select("*")
    .eq("staff_id", user.id)
    .gte("submitted_at", start)
    .lte("submitted_at", end)
    .single();
  setReportByDate(data || null);
};
  const fetchReports = async (u: Staff) => {
    let query = supabase.from("reports").select("*").order("submitted_at", { ascending: false });
    if (u.role !== "Owner") query = query.eq("staff_id", u.id);
    const { data } = await query;
    setReports(data || []);
    const today = new Date().toDateString();
    const mine = (data || []).find((r: Report) => r.staff_id === u.id && new Date(r.submitted_at).toDateString() === today);
    setTodayReport(mine || null);
  };

 const fetchDayOff = async (uid: string) => {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase.from("day_off").select("staff_id").eq("off_date", today);
    const ids = (data || []).map((r: any) => r.staff_id);
    setOffToday(ids);
    setReportOffDay(ids.includes(uid));
  };
  const toggleOffDay = async () => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    if (reportOffDay) {
      await supabase.from("day_off").delete().eq("staff_id", user.id).eq("off_date", today);
    } else {
      await supabase.from("day_off").insert({ staff_id: user.id, off_date: today });
    }
    fetchDayOff(user.id);
  };
 const submitReport = async () => {
    if (!user) return;
    const _fields = REPORT_FIELDS[user.id] || [];
    const _missing = _fields.filter((f) => {
      if (user.id === "arun" && (f.key === "achievement" || f.key === "target")) return false;
      return !reportData[f.key] || !String(reportData[f.key]).trim();
    });
    if (_missing.length) { alert("Please fill all fields before submitting.\n\nMissing: " + _missing.map((f) => f.label).join(", ")); return; }
    setReportSubmitting(true);
    const _today = new Date().toISOString().split("T")[0];
    const _date = reportHistoryDate || _today;
    const _isBackfill = _date < _today;
    const deadline = new Date();
    deadline.setHours(22, 0, 0, 0);
    const isLate = !_isBackfill && new Date() > deadline;
    const { data: _existing } = await supabase.from("reports").select("id").eq("staff_id", user.id).eq("report_date", _date);
    const _isEdit = (_existing?.length || 0) > 0;
    const finalData: Record<string, string> = { ...reportData };
    if (user.id === "arun") {
      if (!finalData.target || !String(finalData.target).trim()) finalData.target = "299666";
      const _ts = parseFloat(finalData.total_sales || "0");
      const _tg = parseFloat(finalData.target || "299666");
      finalData.achievement = _tg ? (_ts / _tg * 100).toFixed(1) + "%" : "";
    }
    const content = Object.entries(finalData).map(([k, v]) => `${k}: ${v}`).join(", ");
    const { data, error } = await supabase.from("reports").insert({
      staff_id: user.id,
      content,
      report_date: _date,
      is_backfill: _isBackfill,
      is_late: reportOffDay ? false : isLate,
      submitted_at: new Date().toISOString(),
      report_data: finalData,
      staff_role: user.role,
      no_points: reportOffDay,
    }).select().single();
    setReportSubmitting(false);
    if (error) { alert("Error: " + error.message); return; }
    if (_date === _today) setTodayReport(data);
    if (!reportOffDay) {
      if (_isEdit) celebrate(0, "Report updated — no extra points");
      else if (_isBackfill) celebrate(-5, "Back-dated report — -5");
      else if (isLate) celebrate(-5, "After 10 PM — -5");
      else celebrate(10);
    }
    setReportData({});
    fetchReports(user);
    if (_date !== _today) fetchReportByDate(_date);
  };

const runTargetCheck = async (u: Staff) => {
    const outlets = (u as Staff & { outlets?: string[] }).outlets || [];
    if (!outlets.length) return;
    const yest = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const { data } = await supabase.from("outlet_reports").select("outlet_id,shop_sales_value,swiggy_sales_value,zomato_sales_value").in("outlet_id", outlets).eq("report_date", yest);
    const byOutlet: Record<string, number> = {};
    (data || []).forEach((r: any) => { byOutlet[r.outlet_id] = (Number(r.shop_sales_value) || 0) + (Number(r.swiggy_sales_value) || 0) + (Number(r.zomato_sales_value) || 0); });
    const results = outlets.map((oid) => {
      const target = parseFloat(OUTLET_TARGETS[oid] || "");
      const actual = byOutlet[oid];
      const name = OUTLET_NAMES[oid] || oid;
      if (!target || isNaN(target)) return { oid, name, status: "notarget" };
      if (actual === undefined) return { oid, name, status: "noentry", target };
      return { oid, name, status: actual >= target ? "win" : "miss", target, actual };
    });
    setTargetCheck(results);
  };

  const fetchSalesTargets = async (u: Staff) => {
    const isViewer = u.role === "Owner" || u.role === "Manager";
    const outlets = (u as Staff & { outlets?: string[] }).outlets || [];
    if (!isViewer && !outlets.length) return;
    let query = supabase.from("sales_target").select("*");
    if (!isViewer) query = query.in("outlet_id", outlets);
    const { data } = await query;
    const map: Record<string, any> = {};
    (data || []).forEach((row: any) => {
      if (!map[row.outlet_id]) map[row.outlet_id] = {};
      map[row.outlet_id][row.brand] = row.line_items;
    });
    setSalesTargets(map);
  };

 const saveSalesTarget = async (outletId: string, brand: string, li: any) => {
    setStSaving(true);
    const num = (k: string, fb: number) => { const v = stEditValues[k]; return v !== undefined && v !== "" ? (parseFloat(String(v).replace(/,/g, "")) || 0) : fb; };
   const f = li?.fixed || {}; const t = li?.targets || {};
    const mk = stDate.slice(0, 7);
    const updated = {
      sales: { ...(li?.sales || {}), [stDate]: { net: num("net", Number(li?.sales?.[stDate]?.net) || 0), online: num("online", Number(li?.sales?.[stDate]?.online) || 0) } },
      monthly: { ...(li?.monthly || {}), [mk]: { net: num("mnet", Number(li?.monthly?.[mk]?.net) || 0), online: num("monline", Number(li?.monthly?.[mk]?.online) || 0) } },
      fixed: { staff: num("staff", Number(f.staff) || 0), rent: num("rent", Number(f.rent) || 0), eb: num("eb", Number(f.eb) || 0), transport: num("transport", Number(f.transport) || 0), pest: num("pest", Number(f.pest) || 0), water: num("water", Number(f.water) || 0), airtel: num("airtel", Number(f.airtel) || 0) },
      targets: { a: num("a", Number(t.a) || 0), b: num("b", Number(t.b) || 0) },
    };
    const { error } = await supabase.from("sales_target").upsert({ outlet_id: outletId, brand, line_items: updated, updated_at: new Date().toISOString() }, { onConflict: "outlet_id,brand" });
    setStSaving(false);
    if (error) { alert("Error: " + error.message); return; }
    setStEditing(null); setStEditValues({});
    if (user) fetchSalesTargets(user);
  };

  const fetchAttendance = async (u: Staff, date: string) => {
    const { data } = await supabase.from("attendance").select("*").eq("staff_id", u.id).eq("attendance_date", date).maybeSingle();
    setTodayAttendance(data || null);
    if (!data) setAttendanceData({ present: "", absent: "", late: "", absent_names: "", late_names: "" });
  };

  const submitAttendance = async () => {
    if (!user) return;
    setAttendanceSubmitting(true);
    const { data, error } = await supabase.from("attendance").upsert({
      staff_id: user.id,
      attendance_date: attendanceDate,
     present: parseInt(attendanceData.present) || 0,
      absent: parseInt(attendanceData.absent) || 0,
      late: parseInt(attendanceData.late) || 0,
      absent_names: attendanceData.absent_names.trim() || null,
      late_names: attendanceData.late_names.trim() || null,
      submitted_at: new Date().toISOString(),
    }, { onConflict: "staff_id,attendance_date" }).select().single();
    setAttendanceSubmitting(false);
    if (error) { alert("Error: " + error.message); return; }
    setTodayAttendance(data);
    setAttendanceData({ present: "", absent: "", late: "", absent_names: "", late_names: "" });
  };

  const assignTask = async () => {
    if (!taskTitle.trim() || !user) return;
    setSubmitting(true);
    const dueAt = new Date(Date.now() + parseFloat(taskDueHours) * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("tasks").insert({
      title: taskTitle.trim(), description: taskDesc.trim(),
      assigned_to: taskAssignee, assigned_by: user.id,
      priority: taskPriority, status: "assigned", due_at: dueAt,
      outlet_id: taskOutlet || null,
    });
    setSubmitting(false);
    if (error) { alert("Error: " + error.message); return; }
    setShowModal(false);
    setTaskTitle(""); setTaskDesc(""); setTaskPriority("medium"); setTaskDueHours("4"); setTaskOutlet("");
    fetchTasks(user);
  };

  const updateStatus = async (taskId: string, status: string) => {
    await supabase.from("tasks").update({ status, ...(status === "completed" ? { completed_at: new Date().toISOString() } : {}) }).eq("id", taskId);
    if (user) fetchTasks(user);
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm("Delete this task?")) return;
    await supabase.from("tasks").delete().eq("id", taskId);
    if (user) fetchTasks(user);
  };

 const updatePin = async () => {
  if (!newPin || newPin.length < 4) { setPinMsg("PIN must be at least 4 digits."); return; }
  if (!user) return;
  const { error } = await supabase
    .from("staff")
    .update({ pin: newPin })
    .eq("id", user.id)
    .select()
    .limit(1);
  if (error) { setPinMsg("Error: " + error.message); return; }
  setPinMsg("PIN updated successfully!");
  setNewPin("");
  setTimeout(() => { setShowPinModal(false); setPinMsg(""); }, 1500);
};
 const editOutletReport = async (outletId: string) => {
  const r = outletReports[outletId];
  if (!r) return;
  setOutletReportData({
    target: String(r.target),
    shop_sales_count: String(r.shop_sales_count),
    shop_sales_value: String(r.shop_sales_value),
    swiggy_sales_count: String(r.swiggy_sales_count),
    swiggy_sales_value: String(r.swiggy_sales_value),
    zomato_sales_count: String(r.zomato_sales_count),
    zomato_sales_value: String(r.zomato_sales_value),
    swiggy_live: r.swiggy_live ? "yes" : "no",
    zomato_live: r.zomato_live ? "yes" : "no",
    discount_running: r.discount_running || "",
    discount_rate_good: r.discount_rate_good ? "yes" : "no",
    unavailable_items: r.unavailable_items || "",
    expiry_count: String(r.expiry_count),
    expiry_items: r.expiry_items || "",
    complimentary_count: String(r.complimentary_count),
    complimentary_reason: r.complimentary_reason || "",
   bh_google_rating: String(r.bh_google_rating || ""),
  bh_swiggy_rating: String(r.bh_swiggy_rating || ""),
  bh_zomato_rating: String(r.bh_zomato_rating || ""),
  cbh_google_rating: String(r.cbh_google_rating || ""),
  cbh_swiggy_rating: String(r.cbh_swiggy_rating || ""),
  cbh_zomato_rating: String(r.cbh_zomato_rating || ""),
 icbh_google_rating: String(r.icbh_google_rating || ""),
 icbh_swiggy_rating: String(r.icbh_swiggy_rating || ""),
 icbh_zomato_rating: String(r.icbh_zomato_rating || ""),
    issues: r.issues || "",
    action_taken: r.action_taken || "",
    is_edited: "true",
    editing_id: r.id,
  });
  setOutletReports(prev => {
    const updated = { ...prev };
    delete updated[outletId];
    return updated;
  });
};
const parseFileRows = async (file: File): Promise<any[][]> => {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  let rows: any[][] = [];
  wb.SheetNames.forEach((sn) => { const rr = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, blankrows: false }) as any[][]; rows = rows.concat(rr); });
  return rows;
};
const parseFileSheets = async (file: File): Promise<Record<string, any[][]>> => {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const out: Record<string, any[][]> = {};
  wb.SheetNames.forEach((sn) => { out[sn] = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, blankrows: false }) as any[][]; });
  return out;
};
const extractMisTotals = (rows: any[][]): { net: number | null; swiggy: number | null; zomato: number | null } => {
  let hr = -1;
  for (let i = 0; i < rows.length; i++) { const r = rows[i] || []; if (r.some((c: any) => typeof c === "string" && /net sales \(after discount/i.test(c))) { hr = i; break; } }
  if (hr < 0) return { net: null, swiggy: null, zomato: null };
  const hdr: string[] = (rows[hr] || []).map((c: any) => (typeof c === "string" ? c : ""));
  const find = (re: RegExp, from = 0) => { for (let c = from; c < hdr.length; c++) { if (re.test(hdr[c])) return c; } return -1; };
  const shopCol = find(/net sales \(after discount/i);
  const swGross = find(/gross sales swiggy/i);
  const zoGross = find(/gross sales zomato/i);
  const swNet = swGross >= 0 ? find(/net sales after discount/i, swGross + 1) : -1;
  const zoNet = zoGross >= 0 ? find(/net sales after discount/i, zoGross + 1) : -1;
  let tr = -1;
  for (let i = hr + 1; i < rows.length; i++) { const r = rows[i] || []; if (typeof r[0] === "string" && /^\s*total\s*$/i.test(r[0])) { tr = i; break; } }
  if (tr < 0) return { net: null, swiggy: null, zomato: null };
  const trow = rows[tr] || [];
  const numAt = (c: number): number | null => { if (c < 0) return null; const v = trow[c]; if (typeof v === "number" && !isNaN(v)) return v; const n = parseFloat(String(v).replace(/[,₹\s]/g, "")); return isNaN(n) ? null : n; };
  const net = numAt(shopCol), sw = numAt(swNet), zo = numAt(zoNet);
  return { net, swiggy: sw, zomato: zo };
};
const findVal = (rows: any[][], regex: RegExp): number | null => {
  for (const row of rows) {
    if (!row) continue;
    let li = -1;
    for (let i = 0; i < row.length; i++) { if (typeof row[i] === "string" && row[i].trim()) { li = i; break; } }
    if (li < 0) continue;
    if (regex.test(String(row[li]))) {
      for (let j = li + 1; j < row.length; j++) {
        const v = row[j];
        if (typeof v === "number" && !isNaN(v)) return v;
        if (typeof v === "string" && v.trim()) { const n = parseFloat(v.replace(/[,₹\s]/g, "")); if (!isNaN(n)) return n; }
      }
    }
  }
  return null;
};
const stExtractOutlet = async (oid: string, brand: string) => {
  const key = oid + "_" + brand;
  const f = stFiles[key] || {};
  if (!f.mis && !f.pnl) { setStUpMsg(m => ({ ...m, [key]: "Pick at least one file." })); return; }
  setStUpBusy(key); setStUpMsg(m => ({ ...m, [key]: "Reading..." }));
  try {
    const e: any = {};
   if (f.mis) {
      const sheets = await parseFileSheets(f.mis);
      const monthName = new Date(stDate + "T00:00:00").toLocaleString("en-US", { month: "long" });
      const snames = Object.keys(sheets);
      const sname = snames.find(s => s.toLowerCase() === monthName.toLowerCase()) || snames.find(s => s.toLowerCase().includes(monthName.toLowerCase()));
      const mis = extractMisTotals(sname ? sheets[sname] : []);
      e.net = mis.net; e.swiggy = mis.swiggy; e.zomato = mis.zomato;
    }
    if (f.pnl) {
      const rows = await parseFileRows(f.pnl);
      e.pest = findVal(rows, /pest/i); e.water = findVal(rows, /water/i); e.airtel = findVal(rows, /airtel|wifi|internet|broadband/i);
      if (brand === "BH") { e.rent = findVal(rows, /rent/i); e.staff = findVal(rows, /salar|staff|wage/i); e.eb = findVal(rows, /electric|power|\beb\b/i); e.transport = findVal(rows, /transport|convey/i); }
    }
    setStUpload(u => ({ ...u, [key]: e })); setStUpMsg(m => ({ ...m, [key]: "" }));
  } catch (err: any) { setStUpMsg(m => ({ ...m, [key]: "Could not read: " + (err?.message || "bad file") })); }
  setStUpBusy("");
};
const stApplyOutlet = async (oid: string, brand: string) => {
  const key = oid + "_" + brand;
  const e = stUpload[key]; if (!e) return;
  setStUpBusy(key);
  const { data: cur } = await supabase.from("sales_target").select("line_items").eq("outlet_id", oid).eq("brand", brand).single();
  const li: any = cur?.line_items || { sales: {}, fixed: {}, targets: {}, monthly: {} };
  const num = (a: any, b: any) => (a != null ? a : (b ?? 0));
  const mk = stDate.slice(0, 7);
  const isCBH = brand === "CBH";
  const updated = {
    sales: li.sales || {},
    monthly: { ...(li.monthly || {}), [mk]: { net: e.net || 0, online: (e.swiggy || 0) + (e.zomato || 0) } },
    fixed: { staff: isCBH ? 0 : num(e.staff, li.fixed?.staff), rent: isCBH ? 0 : num(e.rent, li.fixed?.rent), eb: isCBH ? 0 : num(e.eb, li.fixed?.eb), transport: isCBH ? 0 : num(e.transport, li.fixed?.transport), pest: num(e.pest, li.fixed?.pest), water: num(e.water, li.fixed?.water), airtel: num(e.airtel, li.fixed?.airtel) },
    targets: li.targets || { a: 0, b: 0 },
  };
  const { error } = await supabase.from("sales_target").upsert({ outlet_id: oid, brand, line_items: updated, updated_at: new Date().toISOString() }, { onConflict: "outlet_id,brand" });
  setStUpBusy("");
  if (error) { setStUpMsg(m => ({ ...m, [key]: "Error: " + error.message })); return; }
  setStUpMsg(m => ({ ...m, [key]: "✓ Saved to Sales Target (" + brand + ")." }));
  setStUpload(u => ({ ...u, [key]: null }));
  if (user) fetchSalesTargets(user);
};

const reviewPoints = (rating: number, valid: boolean) => {
  let p = 0;
  if (rating === 5) p += 5; else if (rating === 4) p += 3; else if (rating >= 1 && rating <= 2) p -= 5;
  if (valid) p -= 10;
  return p;
};
const fetchReviews = async (outlet: string, date: string) => {
  if (!outlet) { setReviews([]); return; }
  const { data } = await supabase.from("outlet_reviews").select("*").eq("outlet_id", outlet).eq("report_date", date).order("created_at", { ascending: false });
  setReviews(data || []);
};
const saveReview = async () => {
  if (!user || !activeOutlet) return;
  const _owner = ALL_STAFF.find(s => (s.outlets as string[] | undefined)?.includes(activeOutlet));
  setRevSaving(true);
  const { error } = await supabase.from("outlet_reviews").insert({
    outlet_id: activeOutlet,
    staff_id: _owner ? _owner.id : user.id,
    report_date: outletEntryDate,
    platform: revForm.platform,
    rating: parseInt(revForm.rating) || null,
    valid_complaint: revForm.valid,
    refund_given: revForm.refund,
    note: revForm.note || null,
  });
  setRevSaving(false);
  if (error) { alert("Error: " + error.message); return; }
  setRevForm({ platform: "Swiggy", rating: "5", valid: false, refund: false, note: "" });
  fetchReviews(activeOutlet, outletEntryDate);
};
const deleteReview = async (id: string) => {
  await supabase.from("outlet_reviews").delete().eq("id", id);
  fetchReviews(activeOutlet, outletEntryDate);
};
const submitOutletReport = async () => {
  if (!user || !activeOutlet) return;
  const _req = [
    { k: "shop_sales_count", label: "Shop Sales Count" },
    { k: "shop_sales_value", label: "Shop Sales Value" },
    { k: "swiggy_sales_count", label: "Swiggy Sales Count" },
    { k: "swiggy_sales_value", label: "Swiggy Sales Value" },
    { k: "zomato_sales_count", label: "Zomato Sales Count" },
    { k: "zomato_sales_value", label: "Zomato Sales Value" },
  ];
  const _miss = _req.filter((f) => !(outletReportData as any)[f.k] || !String((outletReportData as any)[f.k]).trim());
  if (_miss.length) { alert("Please fill all sales fields before submitting.\n\nMissing: " + _miss.map((f) => f.label).join(", ")); return; }
  setOutletSubmitting(true);
 const deadline = new Date();
  deadline.setHours(12, 0, 0, 0);
  const _afterNoon = new Date() > deadline;
  const d = outletReportData;
  const newRating = parseFloat(d.bh_google_rating) || 0;
  const todayStr = new Date().toISOString().split("T")[0];
  const { data: prevRows } = await supabase.from("outlet_reports")
    .select("bh_google_rating").eq("outlet_id", activeOutlet).lt("report_date", todayStr)
    .order("report_date", { ascending: false }).limit(1);
  const prevRating = prevRows && prevRows[0] ? Number(prevRows[0].bh_google_rating) || 0 : 0;
  const earnedBonus = newRating > 4.5 && newRating > prevRating;
  const isBackfill = outletEntryDate < new Date().toISOString().split("T")[0];
  const isLate = !isBackfill && _afterNoon;
  const payload = {
    shop_sales_count: parseInt(d.shop_sales_count?.replace(/,/g, "")) || 0,
    shop_sales_value: parseFloat(d.shop_sales_value?.replace(/,/g, "")) || 0,
    swiggy_sales_count: parseInt(d.swiggy_sales_count?.replace(/,/g, "")) || 0,
    swiggy_sales_value: parseFloat(d.swiggy_sales_value?.replace(/,/g, "")) || 0,
    zomato_sales_count: parseInt(d.zomato_sales_count?.replace(/,/g, "")) || 0,
    zomato_sales_value: parseFloat(d.zomato_sales_value?.replace(/,/g, "")) || 0,
    target: parseFloat(d.target?.replace(/,/g, "")) || 0,
    swiggy_live: (d.swiggy_live || "yes").toLowerCase() === "yes",
    zomato_live: (d.zomato_live || "yes").toLowerCase() === "yes",
    discount_running: d.discount_running || "",
    discount_rate_good: (d.discount_rate_good || "yes").toLowerCase() === "yes",
    unavailable_items: d.unavailable_items || "",
    expiry_count: parseInt(d.expiry_count) || 0,
    expiry_items: d.expiry_items || "",
    complimentary_count: parseInt(d.complimentary_count) || 0,
    complimentary_reason: d.complimentary_reason || "",
    issues: d.issues || "",
    action_taken: d.action_taken || "",
    bh_google_rating: parseFloat(d.bh_google_rating) || null,
bh_swiggy_rating: parseFloat(d.bh_swiggy_rating) || null,
bh_zomato_rating: parseFloat(d.bh_zomato_rating) || null,
cbh_google_rating: parseFloat(d.cbh_google_rating) || null,
cbh_swiggy_rating: parseFloat(d.cbh_swiggy_rating) || null,
cbh_zomato_rating: parseFloat(d.cbh_zomato_rating) || null,
icbh_google_rating: parseFloat(d.icbh_google_rating) || null,
icbh_swiggy_rating: parseFloat(d.icbh_swiggy_rating) || null,
icbh_zomato_rating: parseFloat(d.icbh_zomato_rating) || null,
    is_late: isLate,
   is_edited: d.is_edited === "true",
    rating_bonus: isBackfill ? false : earnedBonus,
    is_backfill: isBackfill,
    no_points: isBackfill && outletWasOff,
  };
  let error;
  if (d.editing_id) {
    const result = await supabase.from("outlet_reports").update(payload).eq("id", d.editing_id);
    error = result.error;
  } else {
   const _owner = ALL_STAFF.find(s => (s.outlets as string[] | undefined)?.includes(activeOutlet));
    const result = await supabase.from("outlet_reports").upsert({
  ...payload,
  staff_id: _owner ? _owner.id : user.id,
  outlet_id: activeOutlet,
  report_date: outletEntryDate,
}, { onConflict: "staff_id,outlet_id,report_date" });
error = result.error;
  }
  setOutletSubmitting(false);
 if (error) { alert("Error: " + error.message); return; }
setOutletReportData({});
if (isBackfill) { if (!outletWasOff) celebrate(-30); }
else if (isLate) { celebrate(0, "After 12 PM cut-off — 0 points"); }
else {
  const _total = (Number(payload.shop_sales_value) || 0) + (Number(payload.swiggy_sales_value) || 0) + (Number(payload.zomato_sales_value) || 0);
  const _tgt = Number(payload.target) || 0;
  if (_tgt > 0 && _total < _tgt) celebrate(20, "Boo boo! Target missed — only +20 for submitting 😭");
  else if (_tgt > 0) celebrate(50);
  else celebrate(20);
}
await new Promise(resolve => setTimeout(resolve, 500));
const _today2 = new Date().toISOString().split("T")[0];
if (outletEntryDate === _today2) await fetchOutletReports(user);
else await fetchOutletReportsByDate(outletEntryDate);
};
  const playAlert = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.setValueAtTime(440, ctx.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.4);
  } catch (e) {
    console.log("Audio not supported");
  }
};
  const submitForceAck = async (action: "complete" | "reason") => {
    if (!overdueTask) return;
    if (action === "reason") {
      if (forceAckReason.trim().length < 20) { alert("Please provide at least 20 characters explaining the delay."); return; }
      await supabase.from("tasks").update({ delay_reason: forceAckReason.trim(), status: "overdue" }).eq("id", overdueTask.id);
    } else {
      await supabase.from("tasks").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", overdueTask.id);
    }
    setOverdueTask(null);
    setForceAckReason("");
    if (user) fetchTasks(user);
  };

  const total = tasks.length;
  const completed = tasks.filter(t => t.status === "completed").length;
  const inProgress = tasks.filter(t => t.status === "in_progress").length;
  const overdue = tasks.filter(t => t.status !== "completed" && new Date(t.due_at) < new Date()).length;
  const rate = total > 0 ? Math.round(completed / total * 100) : 0;
  const canAssign = user?.role === "Owner" || user?.role === "Manager";
  const isFO = user?.role === "Founder's Office";
  const hasReportDuty = user?.role !== "Owner" && user?.role !== "Founder's Office";
  const reportFields = user ? REPORT_FIELDS[user.id] || [] : [];
  const reportInput = (f: { label: string; key: string }) => {
    if (user && user.id === "arun" && f.key === "achievement") {
      const ts = parseFloat(reportData.total_sales || "0");
      const tg = parseFloat(reportData.target || "299666");
      const pct = tg ? (ts / tg * 100).toFixed(1) + "%" : "";
      return <input type="text" readOnly value={pct} className="w-full bg-zinc-900 border border-zinc-800 text-yellow-400 px-3 py-2 text-sm cursor-not-allowed" placeholder="—" />;
    }
    const val = (user && user.id === "arun" && f.key === "target") ? (reportData.target ?? "299666") : (reportData[f.key] || "");
    return <input type="text" value={val} onChange={(e) => setReportData(prev => ({ ...prev, [f.key]: e.target.value }))} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm" placeholder="—" />;
  };

  if (!user) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-zinc-500 font-mono text-sm uppercase tracking-widest">Loading...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex">
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />}
      {targetCheck && targetCheck.length > 0 && !targetReaction && (() => {
        const wins = targetCheck.filter((r: any) => r.status === "win").length;
        const misses = targetCheck.filter((r: any) => r.status === "miss").length;
        const header = misses > 0 ? "Yesterday had some gaps — let's go today! 🔥" : (wins > 0 ? "Yesterday was a win! 👏🎉" : "Fresh start today 🚀");
        const fmt = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
        return (
          <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4" onClick={() => setTargetCheck(null)}>
            <div className="bg-[#131316] border border-yellow-400 max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-black mb-4">{header}</h3>
              <div className="space-y-2 mb-5">
                {targetCheck.map((r: any) => (
                  <div key={r.oid} className="text-sm font-mono border-b border-zinc-800 pb-2">
                    {r.status === "win" && <span className="text-green-400">🎉 {r.name}: {fmt(r.actual)} vs {fmt(r.target)} — smashed it!</span>}
                    {r.status === "miss" && <span className="text-yellow-400">💪 {r.name}: {fmt(r.actual)} vs {fmt(r.target)} — bit short, today's the bounce-back!</span>}
                    {r.status === "noentry" && <span className="text-zinc-500">🤔 {r.name}: no entry logged yesterday</span>}
                    {r.status === "notarget" && <span className="text-blue-400">🚀 {r.name}: new outlet — no target yet, every sale counts!</span>}
                  </div>
                ))}
              </div>
             <button onClick={() => setTargetReaction(true)} className="bg-yellow-400 text-black font-bold tracking-widest text-xs px-5 py-2.5 uppercase w-full">Next →</button>
            </div>
          </div>
      );
      })()}
      {targetCheck && targetReaction && (() => {
        const misses = targetCheck.filter((r: any) => r.status === "miss").length;
        const wins = targetCheck.filter((r: any) => r.status === "win").length;
        const bad = misses > 0;
        const neutral = wins === 0 && misses === 0;
        const close = () => { setTargetCheck(null); setTargetReaction(false); };
        return (
          <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={close}>
            <style>{`@keyframes bhShake{0%,100%{transform:translateX(0) rotate(0)}20%{transform:translateX(-10px) rotate(-6deg)}40%{transform:translateX(10px) rotate(6deg)}60%{transform:translateX(-8px) rotate(-4deg)}80%{transform:translateX(8px) rotate(4deg)}}@keyframes bhPop{0%{transform:scale(0)}60%{transform:scale(1.3)}100%{transform:scale(1)}}`}</style>
            <div className={`max-w-sm w-full p-8 text-center border-2 ${bad ? "bg-[#1a1010] border-red-500" : (neutral ? "bg-[#101418] border-blue-400" : "bg-[#101a12] border-green-400")}`} onClick={(e) => e.stopPropagation()}>
              <div className="text-8xl mb-3" style={{ animation: bad ? "bhShake 0.4s ease-in-out 3" : "bhPop 0.5s ease-out", display: "inline-block" }}>{bad ? "🤚💥" : (neutral ? "🚀" : "👏")}</div>
              {!bad && !neutral && <div className="text-3xl mb-3">🎉 🎊 🎉</div>}
              <h3 className="text-2xl font-black mb-2">{bad ? "SLAP! 🖐️😵‍💫 Target said NO" : (neutral ? "Fresh start, let's roll! 🚀" : "BOOM! You SMASHED it! 👏")}</h3>
              <p className="text-sm font-mono text-zinc-400 mb-6">{bad ? "That's a wake-up smack 😤 Shake it off — today you hit back twice as hard!" : (neutral ? "No target pressure — every sale's a bonus." : "Target crushed. Keep that energy going today!")}</p>
              <button onClick={close} className={`${bad ? "bg-red-500" : (neutral ? "bg-blue-400" : "bg-green-400")} text-black font-bold tracking-widest text-xs px-6 py-3 uppercase w-full`}>Let's go →</button>
            </div>
          </div>
        );
      })()}
      <button onClick={() => setSidebarOpen(!sidebarOpen)} className="fixed top-4 left-4 z-50 md:hidden bg-zinc-900 border border-zinc-700 p-2 text-white">☰</button>

      <aside className={`fixed inset-y-0 left-0 z-40 w-60 bg-[#131316] border-r border-zinc-800 flex flex-col shrink-0 transition-transform duration-200 md:relative md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="px-6 py-6 border-b border-zinc-800">
          <h1 className="text-xl font-black tracking-tight">TASK<span className="text-yellow-400">FORCE</span></h1>
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mt-1">Brownie Heaven</p>
        </div>
        <nav className="flex-1 px-3 py-4">
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest px-3 pb-2">Workspace</p>
          <div onClick={() => { setActiveTab("tasks"); setSidebarOpen(false); }} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "tasks" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
            <span>▣</span> Dashboard
          </div>
        <div onClick={() => { router.push("/leaderboard"); }} className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors text-zinc-500 hover:text-white">
            <span>🏆</span> Leaderboard
          </div>
         {["nishant","arun","nilani","vishnu","ahila"].includes(user?.id ?? "") && (
            <div onClick={() => { router.push("/orders-race"); }} className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors text-zinc-500 hover:text-white">
              <span>⚔️</span> Orders Race
            </div>
          )}
          {hasReportDuty && (
            <div onClick={() => { setActiveTab("my_report"); setSidebarOpen(false); }} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "my_report" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
              <span>📋</span> My Report
             {!todayReport && <span className="ml-auto w-2 h-2 bg-yellow-400 rounded-full"></span>}
            </div>
          )}
          {user.role === "HR" && (
            <div onClick={() => { setActiveTab("attendance"); setSidebarOpen(false); }} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "attendance" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
              <span>👥</span> Attendance
            </div>
          )}
         {((user.outlets && user.outlets.length > 0) || canAssign) && (
  <div onClick={() => { setActiveTab("outlet_reports"); setSidebarOpen(false); }} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "outlet_reports" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
    <span>🏪</span> Outlets
  {Object.keys(outletReports).length < (user.outlets?.length || 0) && <span className="ml-auto w-2 h-2 bg-yellow-400 rounded-full"></span>}
  </div>
)}
         {((user.outlets && user.outlets.length > 0) || canAssign) && (
            <div onClick={() => { setActiveTab("sales_target"); setSidebarOpen(false); }} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "sales_target" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
              <span>🎯</span> Sales Target
            </div>
          )}
         {((user.outlets && user.outlets.length > 0) || canAssign) && (
            <div onClick={() => { setActiveTab("payout"); setSidebarOpen(false); }} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "payout" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
              <span>💰</span> Payout
            </div>
          )}
          {user.role === "Owner" && (
            <div onClick={() => { setActiveTab("reconciliation"); setSidebarOpen(false); }} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "reconciliation" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
              <span>⚖️</span> Reconciliation
            </div>
          )}
         {(canAssign || isFO) && (
            <div onClick={() => { setActiveTab("analytics"); setSidebarOpen(false); }} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "analytics" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
              <span>◬</span> Analytics
            </div>
          )}
          {canAssign && (
            <>
             <div onClick={() => { setActiveTab("all_reports"); setSidebarOpen(false); }} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "all_reports" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
                <span>📋</span> Reports
              </div>
              <div onClick={() => { setActiveTab("owner_outlets"); setSidebarOpen(false); }} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "owner_outlets" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
              <span>🏪</span> Outlet Reports
              </div>
              <div onClick={() => { setActiveTab("history"); setSidebarOpen(false); fetchHistoryReports(historyDate); }} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "history" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
             <span>📅</span> History
             </div>
            </>
          )}
        </nav>
        <div className="px-4 py-4 border-t border-zinc-800 flex items-center gap-2">
          <div className="w-9 h-9 bg-yellow-400 text-black flex items-center justify-center font-bold text-sm shrink-0">
            {user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{user.name}</p>
            <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-wide">{user.role}</p>
          </div>
          <button onClick={() => setShowPinModal(true)} className="text-[10px] font-mono text-zinc-600 uppercase hover:text-yellow-400 transition-colors shrink-0">PIN</button>
          <button onClick={() => { localStorage.removeItem("currentUser"); router.push("/"); }} className="text-[10px] font-mono text-zinc-600 uppercase hover:text-red-500 transition-colors shrink-0">Exit</button>
        </div>
      </aside>

      <main className="flex-1 px-4 py-4 md:px-8 md:py-8 overflow-auto">

       {activeTab === "tasks" && user && user.role === "Founder's Office" && <FounderDashboard user={user} />}
       {activeTab === "tasks" && user?.role !== "Founder's Office" && (
          <div>
           {best && (
              <div className="mb-3 border border-green-500/30 bg-green-950/20 p-5">
                <p className="text-[10px] font-mono text-green-400 uppercase tracking-[0.2em] mb-1">★ Best Performer of TASKFORCE</p>
                <p className="text-2xl md:text-3xl font-black tracking-tight">Mr/Ms {best.name.split(" ")[0]}</p>
                <p className="text-[11px] font-mono text-zinc-500 mt-1">{best.points} pts this month · top score</p>
              </div>
            )}
            {worst && (
              <div className="mb-6 border border-red-500/30 bg-red-950/20 p-5">
                <p className="text-[10px] font-mono text-red-400 uppercase tracking-[0.2em] mb-1">⚠ Worst Performer of TASKFORCE</p>
                <p className="text-2xl md:text-3xl font-black tracking-tight">Mr/Ms {worst.name.split(" ")[0]}</p>
                <p className="text-[11px] font-mono text-zinc-500 mt-1">{worst.points} pts this month · lowest score</p>
              </div>
            )}
            <div className="flex justify-between items-start mb-6 pb-5 border-b border-zinc-800">
              <div>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight">{canAssign ? "Command Center" : "My Tasks"}</h2>
                <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Welcome back, {user.name.split(" ")[0]}</p>
              </div>
              {canAssign && (
                <button onClick={() => setShowModal(true)} className="bg-yellow-400 text-black font-bold tracking-widest text-xs px-4 py-3 hover:opacity-90 transition-opacity uppercase">+ Assign Task</button>
              )}
           </div>
            {canAssign && offToday.length > 0 && (
              <div className="bg-[#131316] border border-zinc-800 px-5 py-3 mb-6">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">🌙 Off today: </span>
                <span className="text-sm text-yellow-400">{offToday.map(id => ALL_STAFF.find(s => s.id === id)?.name || id).join(", ")}</span>
              </div>
            )}
            
                {user.role !== "Owner" && (
              <div className="flex items-center justify-between bg-[#131316] border border-zinc-800 px-5 py-4 mb-6">
                <div>
                  <p className="text-sm font-semibold">Off day today</p>
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mt-0.5">Reports you submit won't earn or lose points</p>
                </div>
               <button onClick={toggleOffDay} className={`relative w-12 h-6 rounded-full transition-colors ${reportOffDay ? "bg-yellow-400" : "bg-zinc-700"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-black rounded-full transition-transform ${reportOffDay ? "translate-x-6" : ""}`}></span>
                </button>
              </div>
            )}
           {tasks.filter(t => t.assigned_to === user.id && t.status !== "completed").length > 0 && (
              <div className="bg-yellow-400/5 border border-yellow-400/40 p-5 mb-6">
                <p className="text-[11px] font-mono text-yellow-400 uppercase tracking-widest mb-3">📌 {tasks.filter(t => t.assigned_to === user.id && t.status !== "completed").length} task(s) assigned to you</p>
                <div className="space-y-2">
                  {tasks.filter(t => t.assigned_to === user.id && t.status !== "completed").map(t => {
                    const isOverdue = new Date(t.due_at) < new Date();
                    return (
                      <div key={t.id} className="flex flex-wrap gap-2 items-center bg-black/30 border border-zinc-800 px-3 py-2.5">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${t.priority === "critical" ? "bg-red-500" : t.priority === "high" ? "bg-orange-400" : t.priority === "medium" ? "bg-yellow-400" : "bg-zinc-600"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{t.title}</p>
                          {t.description && <p className="text-[11px] text-zinc-400 mt-0.5">{t.description}</p>}
                          <p className="text-[10px] font-mono text-zinc-500 mt-0.5">From {ALL_STAFF.find(s => s.id === t.assigned_by)?.name || t.assigned_by} · Due {t.due_at ? new Date(t.due_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}{isOverdue ? " · OVERDUE" : ""}{t.outlet_id ? ` · ${OUTLET_NAMES[t.outlet_id] || t.outlet_id}` : ""}</p>
                        </div>
                        <div className="flex gap-2">
                          {t.status === "assigned" && <button onClick={() => updateStatus(t.id, "in_progress")} className="text-[10px] font-mono uppercase px-2 py-1 border border-zinc-700 hover:border-yellow-400 hover:text-yellow-400 transition-colors">Start</button>}
                          <button onClick={() => updateStatus(t.id, "completed")} className="text-[10px] font-mono uppercase px-2 py-1 border border-zinc-700 hover:border-green-400 hover:text-green-400 transition-colors">Done</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
           {canAssign && (
              <div className="flex gap-2 flex-wrap mb-6">
                {["all", ...OUTLETS].map(o => (
                  <button key={o} onClick={() => setOutletFilter(o)} className={`font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 border transition-colors ${outletFilter === o ? "border-yellow-400 text-yellow-400" : "border-zinc-700 text-zinc-500 hover:border-zinc-500"}`}>
                    {o === "all" ? "All" : (OUTLET_NAMES[o] || o.replace(/_/g, " "))}
                  </button>
                ))}
              </div>
            )}
            {canAssign && (
              <div className="bg-[#131316] border border-zinc-800 mb-6">
                <div className="px-5 py-3 border-b border-zinc-800">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Staff Status — Today (report time)</p>
                </div>
                {ALL_STAFF.filter(s => s.id !== "nishant").map(s => {
                  const staffTasks = tasks.filter(t => t.assigned_to === s.id);
                  const staffOverdue = staffTasks.filter(t => t.status !== "completed" && new Date(t.due_at) < new Date()).length;
                  const staffCompleted = staffTasks.filter(t => t.status === "completed").length;
                 const todayReport = reports.find(r => r.staff_id === s.id && new Date(r.submitted_at).toDateString() === new Date().toDateString());
                  const hasReport = !!todayReport;
                  return (
                    <div key={s.id} className="grid grid-cols-[1fr_56px_56px_56px_130px] gap-2 items-center px-5 py-3 border-b border-zinc-800 last:border-0">
                      <div>
                        <p className="font-semibold text-sm">{s.name}</p>
                        <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">{s.role}</p>
                      </div>
                      <div className="text-center">
                        <p className="font-mono text-sm font-bold">{staffTasks.length}</p>
                        <p className="text-[9px] font-mono text-zinc-600 uppercase">Tasks</p>
                      </div>
                      <div className="text-center">
                        <p className={`font-mono text-sm font-bold ${staffOverdue > 0 ? "text-red-500" : "text-zinc-500"}`}>{staffOverdue}</p>
                        <p className="text-[9px] font-mono text-zinc-600 uppercase">Late</p>
                      </div>
                      <div className="text-center">
                        <p className="font-mono text-sm font-bold text-green-400">{staffCompleted}</p>
                        <p className="text-[9px] font-mono text-zinc-600 uppercase">Done</p>
                      </div>
                      <div className="text-center">
                        <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 ${hasReport ? (todayReport!.is_late ? "bg-red-500/10 text-red-500" : "bg-green-400/10 text-green-400") : "bg-yellow-400/10 text-yellow-400"}`}>
                          {hasReport ? `✓ ${new Date(todayReport!.submitted_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}${todayReport!.is_late ? " late" : ""}` : "Pending"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
           {canAssign && (
              <div className="bg-[#131316] border border-zinc-800 mb-6">
                <div className="px-5 py-3 border-b border-zinc-800">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Outlet Reports — Today{outletFilter !== "all" ? ` · ${OUTLET_NAMES[outletFilter] || outletFilter.replace(/_/g, " ")}` : ""}</p>
                </div>
                {(outletFilter === "all" ? OUTLETS : [outletFilter]).map(o => {
                  const rep = allOutletReports.find(r => r.outlet_id === o);
                  const mgr = ALL_STAFF.find(s => (s.outlets as string[]).includes(o));
                  const oTotal = rep ? (Number(rep.shop_sales_value) || 0) + (Number(rep.swiggy_sales_value) || 0) + (Number(rep.zomato_sales_value) || 0) : 0;
                  const oTgt = rep ? Number(rep.target) || 0 : 0;
                  const hit = oTgt > 0 && oTotal >= oTgt;
                  return (
                    <div key={o} className="border-b border-zinc-800 last:border-0 px-5 py-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-semibold text-sm uppercase tracking-widest">{OUTLET_NAMES[o] || o.replace(/_/g, " ")}</p>
                          <p className="text-[10px] font-mono text-zinc-600">{mgr?.name || "—"}</p>
                        </div>
                        {rep ? (
                          <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 ${rep.is_late ? "bg-red-500/10 text-red-500" : "bg-green-400/10 text-green-400"}`}>✓ {new Date(rep.submitted_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}{rep.is_late ? " late" : ""}</span>
                        ) : (
                          <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-1 bg-yellow-400/10 text-yellow-400">Pending</span>
                        )}
                      </div>
                      {rep && (
                        <div className="text-[11px] font-mono text-zinc-400 space-y-1">
                          <div className="flex flex-wrap gap-x-5 gap-y-1">
                            <span>Shop ₹{rep.shop_sales_value} ({rep.shop_sales_count})</span>
                            <span>Swiggy ₹{rep.swiggy_sales_value} ({rep.swiggy_sales_count})</span>
                            <span>Zomato ₹{rep.zomato_sales_value} ({rep.zomato_sales_count})</span>
                            <span className="text-white">Total ₹{oTotal}</span>
                            {oTgt > 0 && <span className={hit ? "text-green-400" : "text-red-500"}>Target ₹{oTgt} {hit ? "✓ hit" : "✗ miss"}</span>}
                          </div>
                          {(rep.bh_google_rating || rep.expiry_count || rep.issues || rep.action_taken) && (
                            <div className="flex flex-wrap gap-x-5 gap-y-1 text-zinc-500">
                              {rep.bh_google_rating ? <span>Google {rep.bh_google_rating}</span> : null}
                              {rep.expiry_count ? <span>Expiry {rep.expiry_count}</span> : null}
                              {rep.issues ? <span>Issues: {rep.issues}</span> : null}
                              {rep.action_taken ? <span>Action: {rep.action_taken}</span> : null}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-zinc-800 border border-zinc-800 mb-6">
              {[
                { label: "Total Tasks", value: total, sub: "assigned", color: "" },
                { label: "Completed", value: completed, sub: `${rate}% rate`, color: "text-green-400" },
                { label: "In Progress", value: inProgress, sub: "active", color: "text-yellow-400" },
                { label: "Overdue", value: overdue, sub: overdue > 0 ? "action needed" : "all clear", color: overdue > 0 ? "text-red-500" : "" },
              ].map((s) => (
                <div key={s.label} className="bg-[#131316] p-4">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">{s.label}</p>
                  <p className={`text-3xl font-black tracking-tight ${s.color}`}>{s.value}</p>
                  <p className="text-[11px] font-mono text-zinc-600 mt-1">{s.sub}</p>
                </div>
              ))}
            </div>
            {loading ? (
              <div className="bg-[#131316] border border-zinc-800 p-10 text-center">
                <p className="text-zinc-600 font-mono text-sm uppercase tracking-widest">Loading...</p>
              </div>
            ) : tasks.filter(t => (outletFilter === "all" || t.outlet_id === outletFilter) && t.status !== "completed").length === 0 ? (
              <div className="bg-[#131316] border border-zinc-800 p-10 text-center">
                <p className="text-zinc-600 font-mono text-sm uppercase tracking-widest">No tasks yet</p>
              </div>
            ) : (
              <div className="bg-[#131316] border border-zinc-800">
                {tasks.filter(t => (outletFilter === "all" || t.outlet_id === outletFilter) && t.status !== "completed").map((t) => {
                  const assigneeName = ALL_STAFF.find(s => s.id === t.assigned_to)?.name || t.assigned_to;
                  const isOverdue = t.status !== "completed" && new Date(t.due_at) < new Date();
                  return (
                    <div key={t.id} className={`flex flex-wrap gap-2 items-center px-4 py-3 border-b border-zinc-800 last:border-0 hover:bg-zinc-900 transition-colors ${isOverdue ? "border-l-2 border-l-red-500" : ""}`}>
                      <div className={`w-2 h-2 rounded-full shrink-0 ${t.priority === "critical" ? "bg-red-500" : t.priority === "high" ? "bg-orange-400" : t.priority === "medium" ? "bg-yellow-400" : "bg-zinc-600"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{t.title}</p>
                        <p className="text-[11px] font-mono text-zinc-500 mt-0.5">{assigneeName} · {t.due_at ? new Date(t.due_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "No deadline"}{t.outlet_id ? ` · ${OUTLET_NAMES[t.outlet_id] || t.outlet_id.replace(/_/g, " ")}` : ""}</p>
                      </div>
                      <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 ${t.status === "completed" ? "bg-green-400/10 text-green-400" : isOverdue ? "bg-red-500/10 text-red-500" : t.status === "in_progress" ? "bg-yellow-400/10 text-yellow-400" : "bg-zinc-800 text-zinc-500"}`}>
                        {isOverdue && t.status !== "completed" ? "overdue" : t.status.replace("_", " ")}
                      </span>
                      <div className="flex gap-2">
                        {t.status !== "completed" && (
                          <>
                            {t.status === "assigned" && <button onClick={() => updateStatus(t.id, "in_progress")} className="text-[10px] font-mono uppercase px-2 py-1 border border-zinc-700 hover:border-yellow-400 hover:text-yellow-400 transition-colors">Start</button>}
                            <button onClick={() => updateStatus(t.id, "completed")} className="text-[10px] font-mono uppercase px-2 py-1 border border-zinc-700 hover:border-green-400 hover:text-green-400 transition-colors">Done</button>
                          </>
                        )}
                        {user.role === "Owner" && <button onClick={() => deleteTask(t.id)} className="text-[10px] font-mono uppercase px-2 py-1 border border-zinc-700 hover:border-red-500 hover:text-red-500 transition-colors">✕</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      {activeTab === "sales_target" && (
          <div>
            <div className="flex justify-between items-start mb-6 pb-5 border-b border-zinc-800">
              <div>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight">Sales Target</h2>
            <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Net &amp; Online filled per day · P&amp;L sums the whole month · fixed costs &amp; targets edit-once</p>
              </div>
              <div className="text-right">
                <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Sales day</label>
                <input type="date" max={new Date().toISOString().split("T")[0]} value={stDate} onChange={(e) => { setStDate(e.target.value); setStEditing(null); setStEditValues({}); }} className="bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 text-sm font-mono" />
              </div>
            </div>
            {(canAssign ? OUTLETS : (user.outlets || [])).map((oid: string) => (
              <div key={oid} className="mb-8">
                <h3 className="text-lg font-bold mb-3">{OUTLET_NAMES[oid] || oid}</h3>
              {["BH", "CBH"].map((brand) => {
                  const li = salesTargets[oid]?.[brand];
                  if (!li) return null;
                  const key = `${oid}_${brand}`;
                  const editing = stEditing === key;
                  const mk = stDate.slice(0, 7);
                  const ml = new Date(stDate + "T00:00:00").toLocaleString("en-IN", { month: "short" });
                  const dayLbl = new Date(stDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
                  const dayNet = Number(li.sales?.[stDate]?.net) || 0;
                  const dayOnline = Number(li.sales?.[stDate]?.online) || 0;
                  const _sales = li.sales || {};
                  const _mKeys = Object.keys(_sales).filter(d => d.length === 10 && d.startsWith(mk));
                  const _moNet = li.monthly?.[mk]?.net;
                  const _moOnline = li.monthly?.[mk]?.online;
                  const _dNet = _mKeys.reduce((s, d) => s + (Number(_sales[d]?.net) || 0), 0);
                  const _dOnline = _mKeys.reduce((s, d) => s + (Number(_sales[d]?.online) || 0), 0);
                  const net = (Number(_moNet) || 0) + _dNet;
                  const online = (Number(_moOnline) || 0) + _dOnline;
                  const f = li.fixed || {}; const t = li.targets || {};
                  const isCBH = brand === "CBH";
                  const _ab = (v: any) => Math.abs(Number(v) || 0);
                  const fStaff = isCBH ? 0 : _ab(f.staff);
                  const fRent = isCBH ? 0 : _ab(f.rent);
                  const fEb = isCBH ? 0 : _ab(f.eb);
                  const fTransport = isCBH ? 0 : _ab(f.transport);
                 const totalSales = net + online;
                  const cogs = 0.294 * totalSales, wastage = 0.05 * totalSales, comm = 0.5 * online;
                  const contrib = totalSales - cogs - wastage - comm;
                  const rm = 0.2 * fRent;
                  const totalFixed = fStaff+fRent+fEb+fTransport+rm+_ab(f.pest)+_ab(f.water)+_ab(f.airtel);
                  const netProfit = contrib - totalFixed;
                  const cMargin = totalSales ? contrib / totalSales : 0;
                  const nMargin = totalSales ? netProfit / totalSales : 0;
                  const cmSame = cMargin > 0 ? cMargin : 0.156;
                  const cmDine = 0.656;
                  const ta = Number(t.a) || 0, tb = Number(t.b) || 0;
                  const req = (p: number, cm: number) => cm > 0 ? (totalFixed + p) / cm : 0;
                  const m = (n: number) => Math.round(n).toLocaleString("en-IN");
                 const inp = (k: string, fb: number) => editing
                    ? <input key={`${key}_${k}`} type="number" value={stEditValues[k] !== undefined ? stEditValues[k] : (fb ? String(fb) : "")} onChange={(e) => setStEditValues(prev => ({ ...prev, [k]: e.target.value }))} className="w-24 bg-black border border-zinc-700 text-white px-2 py-1 text-right focus:outline-none focus:border-yellow-400" placeholder="0" />
                    : <span>{m(fb)}</span>;
                  const row = (label: string, val: any, opts?: { neg?: boolean; bold?: boolean }) => (
                    <tr key={label} className="border-t border-zinc-800/60">
                      <td className={`px-4 py-2 ${opts?.bold ? "text-white font-bold" : "text-zinc-300"}`}>{label}</td>
                      <td className={`px-4 py-2 text-right font-mono ${opts?.neg ? "text-red-400" : opts?.bold ? "text-yellow-400 font-bold" : ""}`}>{val}</td>
                    </tr>
                  );
                  return (
                    <div key={brand} className="bg-[#131316] border border-zinc-800 mb-5 overflow-x-auto">
                      <div className="flex justify-between items-center px-4 py-3 border-b border-zinc-800">
                        <span className="font-mono text-xs uppercase tracking-widest text-yellow-400">{brand}</span>
                        {editing ? (
                          <div className="flex gap-2">
                           <button onClick={() => saveSalesTarget(oid, brand, li)} disabled={stSaving} className="bg-yellow-400 text-black font-bold text-[10px] px-3 py-1.5 uppercase tracking-widest disabled:opacity-50">{stSaving ? "Saving..." : "Save"}</button>
                            <button onClick={() => setStEditValues(prev => ({ ...prev, net: "0", online: "0" }))} className="text-[10px] font-mono text-red-400 uppercase tracking-widest border border-red-900 px-2 py-1.5 hover:bg-red-950">Clear day</button>
                            <button onClick={() => { setStEditing(null); setStEditValues({}); }} className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest px-2">Cancel</button>
                          </div>
                        ) : (
                          (canAssign || (user.outlets || []).includes(oid)) ? <button onClick={() => { setStEditing(key); setStEditValues({}); }} className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest border border-zinc-700 px-3 py-1.5 hover:border-yellow-400 hover:text-yellow-400">Edit {dayLbl}</button> : <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">View only</span>
                        )}
                      </div>
                      <table className="w-full text-sm">
                        <thead><tr className="text-[10px] font-mono text-zinc-500 uppercase"><th className="text-left px-4 py-2">Line item</th><th className="text-right px-4 py-2">{ml}</th></tr></thead>
                        <tbody>
                         {row(`Net Sales (excl GST) · ${dayLbl}`, inp("net", dayNet))}
                          {row(`Online Sales (Swiggy+Zomato) · ${dayLbl}`, inp("online", dayOnline))}
                          <tr key="_pldiv" className="border-t border-zinc-800"><td colSpan={2} className="px-4 pt-3 pb-1 text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Month-to-date P&amp;L · {ml}</td></tr>
                          {row(`Net Sales — ${ml} total ${editing ? "✏️ (whole-month override)" : ""}`, editing ? inp("mnet", Number(_moNet) || 0) : m(net))}
                          {row(`Online Sales — ${ml} total ${editing ? "✏️ (whole-month override)" : ""}`, editing ? inp("monline", Number(_moOnline) || 0) : m(online))}
                          {row("Total Sales (shop + online)", m(totalSales), { bold: true })}
                          {row("Less: COGS (food cost) @ 29.4% of total", m(cogs), { neg: true })}
                          {row("Less: Wastage @ 5% of total", m(wastage), { neg: true })}
                          {row("Less: Commission @ 50% (online)", m(comm), { neg: true })}
                          {row("Contribution (before fixed)", m(contrib), { bold: true })}
                          {row("   Contribution margin %", (cMargin * 100).toFixed(1) + "%")}
                          {row("Less: Staff salaries", isCBH ? <span className="text-zinc-600">0</span> : inp("staff", Number(f.staff) || 0), { neg: !isCBH })}
                          {row("Less: Rent", isCBH ? <span className="text-zinc-600">0</span> : inp("rent", Number(f.rent) || 0), { neg: !isCBH })}
                          {row("Less: Electricity / EB", isCBH ? <span className="text-zinc-600">0</span> : inp("eb", Number(f.eb) || 0), { neg: !isCBH })}
                          {row("Less: Transport", isCBH ? <span className="text-zinc-600">0</span> : inp("transport", Number(f.transport) || 0), { neg: !isCBH })}
                          {row("Less: Repair & Maintenance (20% of rent)", m(rm), { neg: true })}
                          {row("Less: Pest control", inp("pest", Number(f.pest) || 0), { neg: true })}
                          {row("Less: Water", inp("water", Number(f.water) || 0), { neg: true })}
                          {row("Less: Airtel / WiFi", inp("airtel", Number(f.airtel) || 0), { neg: true })}
                          {row("NET PROFIT / (LOSS)", m(netProfit), { bold: true })}
                          {row("   Net margin %", (nMargin * 100).toFixed(1) + "%")}
                        </tbody>
                      </table>
                      <div className="px-4 py-3 border-t border-zinc-800">
                        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Sales needed to hit target profit</p>
                        <div className="mb-3 text-xs text-zinc-400 flex gap-4 items-center">Target A: {inp("a", ta)} &nbsp; Target B: {inp("b", tb)}</div>
                        <table className="w-full text-xs">
                          <thead><tr className="text-[10px] font-mono text-zinc-500 uppercase"><th className="text-left px-2 py-1">Goal</th><th className="text-right px-2 py-1">Same mix</th><th className="text-right px-2 py-1">Via dine-in</th></tr></thead>
                          <tbody>
                            <tr className="border-t border-zinc-800/60"><td className="px-2 py-1 text-zinc-300">Breakeven (₹0)</td><td className="px-2 py-1 text-right font-mono">{m(req(0, cmSame))}</td><td className="px-2 py-1 text-right font-mono">{m(req(0, cmDine))}</td></tr>
                            <tr className="border-t border-zinc-800/60"><td className="px-2 py-1 text-zinc-300">Profit = A ({m(ta)})</td><td className="px-2 py-1 text-right font-mono">{m(req(ta, cmSame))}</td><td className="px-2 py-1 text-right font-mono">{m(req(ta, cmDine))}</td></tr>
                           <tr className="border-t border-zinc-800/60"><td className="px-2 py-1 text-zinc-300">Profit = B ({m(tb)})</td><td className="px-2 py-1 text-right font-mono">{m(req(tb, cmSame))}</td><td className="px-2 py-1 text-right font-mono">{m(req(tb, cmDine))}</td></tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
             {(canAssign || (user.outlets || []).includes(oid)) && ["BH", "CBH"].map((brand) => { const key = oid + "_" + brand; const u = stUpload[key]; const busy = stUpBusy === key; const msg = stUpMsg[key]; const isCBH = brand === "CBH"; return (
                  <div key={key} className="border border-zinc-800 bg-black/20 p-4 mt-3">
                    <p className="text-[11px] font-bold uppercase tracking-widest mb-1"><span className="text-yellow-400">{brand}</span> · 📥 Upload P&amp;L / MIS — {OUTLET_NAMES[oid] || oid}</p>
                    <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-3">MIS → Net + Swiggy + Zomato · P&amp;L → {isCBH ? "Pest, Water, Airtel only" : "fixed costs"} · saved for the month</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                      <div><label className="text-[10px] font-mono text-zinc-500 uppercase block mb-1">{brand} MIS (.xlsx)</label><input type="file" accept=".xlsx,.xls" onChange={e => { const file = e.target.files?.[0]; setStFiles(s => ({ ...s, [key]: { ...s[key], mis: file } })); }} className="text-xs text-zinc-400 w-full" /></div>
                      <div><label className="text-[10px] font-mono text-zinc-500 uppercase block mb-1">{brand} P&amp;L (.xlsx)</label><input type="file" accept=".xlsx,.xls" onChange={e => { const file = e.target.files?.[0]; setStFiles(s => ({ ...s, [key]: { ...s[key], pnl: file } })); }} className="text-xs text-zinc-400 w-full" /></div>
                    </div>
                    <button onClick={() => stExtractOutlet(oid, brand)} disabled={busy} className="bg-zinc-700 text-white font-bold text-[10px] px-4 py-2 uppercase tracking-widest disabled:opacity-50 mb-2">{busy ? "Reading..." : "Extract"}</button>
                    {msg && <p className="text-xs text-yellow-400 mb-2">{msg}</p>}
                    {u && (
                      <div className="bg-black/30 border border-zinc-800 p-3 mb-2">
                        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Found — check, then apply (red = not found)</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                          {((isCBH ? [["Net Sales", u.net], ["Swiggy", u.swiggy], ["Zomato", u.zomato], ["Pest", u.pest], ["Water", u.water], ["Airtel", u.airtel]] : [["Net Sales", u.net], ["Swiggy", u.swiggy], ["Zomato", u.zomato], ["Rent", u.rent], ["Staff", u.staff], ["Electricity", u.eb], ["Transport", u.transport], ["Pest", u.pest], ["Water", u.water], ["Airtel", u.airtel]]) as [string, any][]).map(([k, v]) => (
                            <div key={k} className="flex justify-between bg-black/40 px-2 py-1"><span className="text-zinc-400">{k}</span><span className={v == null ? "text-red-400" : "text-green-400 font-mono"}>{v == null ? "not found" : Math.round(v).toLocaleString("en-IN")}</span></div>
                          ))}
                        </div>
                        <button onClick={() => stApplyOutlet(oid, brand)} disabled={busy} className="bg-yellow-400 text-black font-bold text-[10px] px-4 py-2 uppercase tracking-widest disabled:opacity-50 mt-3">Apply to {brand}</button>
                      </div>
                    )}
                  </div>
                ); })}
              </div>
            ))}
          </div>
        )}
      {activeTab === "payout" && user && <PayoutTab user={user} />}
      {activeTab === "reconciliation" && user && <ReconciliationTab />}
       {activeTab === "attendance" && (
          <div>
            <div className="flex justify-between items-start mb-6 pb-5 border-b border-zinc-800">
              <div>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight">Attendance</h2>
                <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Today's staff count</p>
              </div>
            </div>
           <div className="bg-[#131316] border border-zinc-800 p-6 max-w-md">
              <div className="mb-5">
                <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Date</label>
               <input type="date" value={attendanceDate} onChange={(e) => { setAttendanceDate(e.target.value); if (user) fetchAttendance(user, e.target.value); }} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm" />
                <p className="text-[11px] font-mono text-yellow-400/80 uppercase tracking-widest mt-1.5">
                  {(() => {
                    const today = new Date().toISOString().split("T")[0];
                    const y = new Date(Date.now() - 86400000).toISOString().split("T")[0];
                    const pretty = new Date(attendanceDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
                    const tag = attendanceDate === today ? "Today" : attendanceDate === y ? "Yesterday" : null;
                    return tag ? `${tag} • ${pretty}` : pretty;
                  })()}
                </p>
              </div>
              {todayAttendance ? (
                <div>
                  <p className="text-green-400 font-mono text-sm uppercase tracking-widest mb-4">✓ Submitted for today</p>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div><p className="text-3xl font-black">{todayAttendance.present}</p><p className="text-[10px] font-mono text-zinc-500 uppercase mt-1">Present</p></div>
                    <div><p className="text-3xl font-black">{todayAttendance.absent}</p><p className="text-[10px] font-mono text-zinc-500 uppercase mt-1">Absent</p></div>
                    <div><p className="text-3xl font-black">{todayAttendance.late}</p><p className="text-[10px] font-mono text-zinc-500 uppercase mt-1">Late</p></div>
                  </div>
                  {(todayAttendance.absent_names || todayAttendance.late_names) && (
                    <div className="mt-4 space-y-2 text-sm">
                      {todayAttendance.absent_names && <p><span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Absent:</span> {todayAttendance.absent_names}</p>}
                      {todayAttendance.late_names && <p><span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Late:</span> {todayAttendance.late_names}</p>}
                    </div>
                  )}
                  <button onClick={() => { setAttendanceData({ present: String(todayAttendance.present), absent: String(todayAttendance.absent), late: String(todayAttendance.late), absent_names: todayAttendance.absent_names || "", late_names: todayAttendance.late_names || "" }); setTodayAttendance(null); }} className="mt-5 text-[10px] font-mono text-zinc-500 uppercase tracking-widest hover:text-yellow-400">Edit</button>
                </div>
              ) : (
                <div className="space-y-4">
                  {[{ k: "present", l: "Total Staff Present" }, { k: "absent", l: "Total Absent" }, { k: "late", l: "Total Late" }].map(f => (
                    <div key={f.k}>
                      <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">{f.l}</label>
                      <input type="number" value={(attendanceData as any)[f.k]} onChange={(e) => setAttendanceData(prev => ({ ...prev, [f.k]: e.target.value }))} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm" placeholder="0" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Absent — Names</label>
                    <textarea value={attendanceData.absent_names} onChange={(e) => setAttendanceData(prev => ({ ...prev, absent_names: e.target.value }))} rows={2} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm" placeholder="e.g. Ravi, Priya" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Late — Names</label>
                    <textarea value={attendanceData.late_names} onChange={(e) => setAttendanceData(prev => ({ ...prev, late_names: e.target.value }))} rows={2} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm" placeholder="e.g. Kumar" />
                  </div>
                  <button onClick={submitAttendance} disabled={attendanceSubmitting} className="bg-yellow-400 text-black font-bold tracking-widest text-xs px-6 py-3 hover:opacity-90 transition-opacity uppercase disabled:opacity-50">
                    {attendanceSubmitting ? "Submitting..." : "Submit Attendance →"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        {(activeTab === "my_report" || activeTab === "all_reports") && (
      
          <div>
           <div className="flex justify-between items-end mb-6 pb-5 border-b border-zinc-800">
        <div>
    <h2 className="text-2xl font-black tracking-tight">{canAssign ? "All Reports" : "Daily Report"}</h2>
    <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">
      {canAssign ? "Staff submissions overview" : `Due by ${ALL_STAFF.find(s => s.id === user.id)?.report_time || "--:--"} daily`}
    </p>
  </div>
  {hasReportDuty && (
    <input
      type="date"
      value={reportHistoryDate}
      onChange={(e) => { setReportHistoryDate(e.target.value); fetchReportByDate(e.target.value); }}
      className="bg-black border border-zinc-800 text-white px-4 py-2.5 focus:outline-none focus:border-yellow-400 transition-colors font-mono text-sm"
    />
  )}
</div>
           {(activeTab === "my_report" || activeTab === "all_reports") && hasReportDuty && (
  <div className="mb-8">
    {reportHistoryDate !== new Date().toISOString().split("T")[0] ? (
      <div className="bg-[#131316] border border-zinc-800 p-6">
        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-4">
          Report for {new Date(reportHistoryDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
        </p>
        {reportByDate ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {reportFields.map(f => (
              <div key={f.key} className="bg-black/30 px-3 py-2">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{f.label}</p>
                <p className="text-sm text-white mt-1">{reportByDate.report_data?.[f.key] || "—"}</p>
              </div>
            ))}
          </div>
       ) : (
          <div>
            <p className="text-[10px] font-mono text-yellow-400 uppercase tracking-widest mb-4">Back-dated entry — counts as -5</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {reportFields.map(f => (
                <div key={f.key}>
                  <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">{f.label}</label>
                  {reportInput(f)}
                </div>
              ))}
            </div>
            <button onClick={submitReport} disabled={reportSubmitting} className="bg-yellow-400 text-black font-bold tracking-widest text-xs px-6 py-3 hover:opacity-90 transition-opacity uppercase disabled:opacity-50">
              {reportSubmitting ? "Submitting..." : "Submit Back-dated Report →"}
            </button>
          </div>
        )}
    ) : null
  </div>

    ) : todayReport ? (
  <div className="bg-green-400/5 border border-green-400/30 p-6">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <span className="text-green-400 font-mono text-xs uppercase tracking-widest">✓ Today's report submitted</span>
        {todayReport.is_late && <span className="text-red-500 font-mono text-[10px] uppercase bg-red-500/10 px-2 py-0.5">Late</span>}
      </div>
      <button
        onClick={async () => {
          if (!user) return;
          const data: Record<string, string> = {};
          if (todayReport.report_data) {
            reportFields.forEach(f => { data[f.key] = todayReport.report_data[f.key] || ""; });
          }
          await supabase.from("reports").delete().eq("id", todayReport.id);
          setTodayReport(null);
          setReportData(data);
        }}
        className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 border border-zinc-700 hover:border-yellow-400 hover:text-yellow-400 transition-colors"
      >
        ✏ Edit
      </button>
    </div>
                    {todayReport.report_data && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {reportFields.map(f => (
                          <div key={f.key} className="bg-black/30 px-3 py-2">
                            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{f.label}</p>
                            <p className="text-sm text-white mt-1">{todayReport.report_data[f.key] || "—"}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] font-mono text-zinc-600 mt-4">{new Date(todayReport.submitted_at).toLocaleString("en-IN")}</p>
                  </div>
                ) : (
                  <div className="bg-[#131316] border border-zinc-800 p-6">
                    <div className="flex items-center justify-between mb-6">
                      <p className="text-sm font-bold uppercase tracking-widest">Submit Today's Report</p>
                      <span className="text-yellow-400 font-mono text-xs">Due: {ALL_STAFF.find(s => s.id === user.id)?.report_time}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      {reportFields.map(f => (
                        <div key={f.key}>
                          <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">{f.label}</label>
                          {reportInput(f)}
                        </div>
                      ))}
                    </div>
                    <button onClick={submitReport} disabled={reportSubmitting} className="bg-yellow-400 text-black font-bold tracking-widest text-xs px-6 py-3 hover:opacity-90 transition-opacity uppercase disabled:opacity-50">
                      {reportSubmitting ? "Submitting..." : "Submit Report →"}
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="bg-[#131316] border border-zinc-800">
              {reports.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-zinc-600 font-mono text-sm uppercase tracking-widest">No reports yet</p>
                </div>
              ) : reports.map((r) => {
                const staffName = ALL_STAFF.find(s => s.id === r.staff_id)?.name || r.staff_id;
                const staffFields = REPORT_FIELDS[r.staff_id] || [];
                return (
                  <div key={r.id} className="border-b border-zinc-800 last:border-0">
                    <div className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-zinc-900 transition-colors" onClick={() => setSelectedReport(selectedReport?.id === r.id ? null : r)}>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-sm">{canAssign ? staffName : "My Report"}</span>
                        {r.is_late && <span className="text-red-500 font-mono text-[10px] uppercase bg-red-500/10 px-2 py-0.5">Late</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-mono text-zinc-500">{new Date(r.submitted_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        <span className="text-zinc-500">{selectedReport?.id === r.id ? "▲" : "▼"}</span>
                      </div>
                    </div>
                    {selectedReport?.id === r.id && r.report_data && (
                      <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {staffFields.map(f => (
                          <div key={f.key} className="bg-black/30 px-3 py-2">
                            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{f.label}</p>
                            <p className="text-sm text-white mt-1">{r.report_data[f.key] || "—"}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {activeTab === "owner_outlets" && (
  <div>
   <div className="flex justify-between items-end mb-6 pb-5 border-b border-zinc-800">
  <div>
    <h2 className="text-2xl font-black tracking-tight">Outlet Reports</h2>
    <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">All 12 outlets — daily tracker</p>
  </div>
  <input
    type="date"
    value={historyDate}
   onChange={(e) => { setHistoryDate(e.target.value); fetchAllOutletReports(e.target.value); }}
    className="bg-black border border-zinc-800 text-white px-4 py-2.5 focus:outline-none focus:border-yellow-400 transition-colors font-mono text-sm"
  />
</div>
  <div className="bg-[#131316] border border-zinc-800 p-5 mb-6">
    <p className="text-sm font-bold uppercase tracking-widest mb-1">📥 Download custom report</p>
    <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-4">Pick a date range + outlets · Excel or PDF · daily rows + summary</p>
    <div className="flex flex-col md:flex-row gap-3 mb-4">
      <div><label className="text-[10px] font-mono text-zinc-500 uppercase block mb-1">From</label><input type="date" value={repFrom} onChange={e => setRepFrom(e.target.value)} className="bg-black border border-zinc-800 text-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-yellow-400" /></div>
      <div><label className="text-[10px] font-mono text-zinc-500 uppercase block mb-1">To</label><input type="date" value={repTo} onChange={e => setRepTo(e.target.value)} className="bg-black border border-zinc-800 text-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-yellow-400" /></div>
    </div>
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <label className="text-[10px] font-mono text-zinc-500 uppercase">Outlets {repOutlets.length === 0 ? "(all)" : `(${repOutlets.length})`}</label>
        <div className="flex gap-2">
          <button onClick={() => setRepOutlets([...OUTLETS])} className="text-[10px] font-mono text-yellow-400 uppercase">All</button>
          <button onClick={() => setRepOutlets([])} className="text-[10px] font-mono text-zinc-500 uppercase">Clear</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {OUTLETS.map(o => { const on = repOutlets.includes(o); return (
          <button key={o} onClick={() => setRepOutlets(on ? repOutlets.filter(x => x !== o) : [...repOutlets, o])} className={`text-[11px] px-3 py-1.5 border font-mono uppercase tracking-wide transition-colors ${on ? "bg-yellow-400 text-black border-yellow-400" : "bg-black text-zinc-400 border-zinc-800 hover:border-zinc-600"}`}>{OUTLET_NAMES[o] || o}</button>
        ); })}
      </div>
    </div>
    <div className="flex gap-3">
      <button onClick={downloadRangeExcel} disabled={repBusy} className="bg-green-600 text-white font-bold text-xs px-5 py-2.5 uppercase tracking-widest disabled:opacity-50 hover:opacity-90">{repBusy ? "Working…" : "⬇ Excel"}</button>
      <button onClick={downloadRangePDF} disabled={repBusy} className="bg-yellow-400 text-black font-bold text-xs px-5 py-2.5 uppercase tracking-widest disabled:opacity-50 hover:opacity-90">{repBusy ? "Working…" : "⬇ PDF"}</button>
    </div>
  </div>
   {(() => {
      const cols = ["#FACC15", "#FB923C", "#EF4444"];
      const chLabels = [["Shop", cols[0]], ["Swiggy", cols[1]], ["Zomato", cols[2]]] as [string, string][];
      return (
        <div className="mb-6">
          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-3">Tap an outlet to open its full report ↓</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {OUTLETS.map(o => {
              const r = allOutletReports.find(x => x.outlet_id === o);
              const shop = r ? Number(r.shop_sales_value) || 0 : 0;
              const sw = r ? Number(r.swiggy_sales_value) || 0 : 0;
              const zo = r ? Number(r.zomato_sales_value) || 0 : 0;
              const tot = shop + sw + zo;
              const filed = !!r;
              const sel = expandedOutlet === o;
              const R = 34, CX = 44, CY = 44, SW = 12, CIRC = 2 * Math.PI * R;
              let acc = 0;
              const segs = tot > 0 ? [shop, sw, zo].map((v, i) => { const frac = v / tot; const len = frac * CIRC; const off = -acc * CIRC; acc += frac; return { len, gap: CIRC - len, off, col: cols[i] }; }) : [];
              return (
                <div key={o} onClick={() => setExpandedOutlet(sel ? null : o)} className={`cursor-pointer bg-[#131316] border ${sel ? "border-yellow-400" : filed ? "border-green-400/30" : "border-zinc-800"} p-3 hover:border-yellow-400/50 transition-colors`}>
                  <div className="flex items-center gap-3">
                    <svg width="56" height="56" viewBox="0 0 88 88" className="shrink-0">
                      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#27272a" strokeWidth={SW} />
                      {segs.map((s, i) => (<circle key={i} cx={CX} cy={CY} r={R} fill="none" stroke={s.col} strokeWidth={SW} strokeDasharray={`${s.len} ${s.gap}`} strokeDashoffset={s.off} transform={`rotate(-90 ${CX} ${CY})`} />))}
                    </svg>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{OUTLET_NAMES[o] || o}</p>
                      <p className="text-[11px] font-mono text-zinc-400">{filed ? `₹${(tot / 1000).toFixed(1)}k` : "—"}</p>
                      <p className={`text-[9px] font-mono uppercase tracking-widest ${!filed ? "text-zinc-600" : r.is_late ? "text-red-400" : "text-green-400"}`}>{!filed ? "not filed" : r.is_late ? "late" : "on time"}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-3 text-[10px] font-mono text-zinc-500">
            {chLabels.map(([n, c]) => (<span key={n} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: c }}></span>{n}</span>))}
          </div>
        </div>
      );
    })()}
   <div className="grid grid-cols-1 gap-4">
      {!expandedOutlet && <p className="text-center text-sm text-zinc-600 py-10">Tap an outlet donut above to open its full report.</p>}
      {OUTLETS.filter(o => o === expandedOutlet).map(o => {
        const report = allOutletReports.find(r => r.outlet_id === o);
      const manager = ALL_STAFF.find(s => (s.outlets as string[]).includes(o));
        return (
          <div key={o} className={`bg-[#131316] border ${report ? "border-green-400/30" : "border-zinc-800"} p-5`}>
            <div className="flex items-center justify-between mb-4">
              <div>
               <p className="font-bold text-sm uppercase tracking-widest">{OUTLET_NAMES[o]}</p>
                <p className="text-[10px] font-mono text-zinc-500 mt-0.5">{manager?.name || "—"}</p>
              </div>
              {report ? (
                <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-1 bg-green-400/10 text-green-400">
                 ✓ Submitted {report.is_late ? "· Late" : "· On Time"}{report.is_edited ? " · Edited" : ""}
                 </span>
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-1 bg-yellow-400/10 text-yellow-400">Pending</span>
              )}
            </div>
            {report && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Shop Sales", value: `₹${report.shop_sales_value} (${report.shop_sales_count})` },
                { label: "Shop AOV", value: report.shop_sales_count > 0 ? `₹${Math.round(Number(report.shop_sales_value) / Number(report.shop_sales_count))}` : "—" },
                { label: "Swiggy", value: `₹${report.swiggy_sales_value} (${report.swiggy_sales_count})` },
                { label: "Swiggy AOV", value: report.swiggy_sales_count > 0 ? `₹${Math.round(Number(report.swiggy_sales_value) / Number(report.swiggy_sales_count))}` : "—" },
                { label: "Zomato", value: `₹${report.zomato_sales_value} (${report.zomato_sales_count})` },
                { label: "Zomato AOV", value: report.zomato_sales_count > 0 ? `₹${Math.round(Number(report.zomato_sales_value) / Number(report.zomato_sales_count))}` : "—" },
                { label: "Total Sales", value: `₹${Number(report.shop_sales_value) + Number(report.swiggy_sales_value) + Number(report.zomato_sales_value)}` },
                { label: "Total AOV", value: (() => { const tv = Number(report.shop_sales_value) + Number(report.swiggy_sales_value) + Number(report.zomato_sales_value); const tc = Number(report.shop_sales_count) + Number(report.swiggy_sales_count) + Number(report.zomato_sales_count); return tc > 0 ? `₹${Math.round(tv/tc)}` : "—"; })() },
                 { label: "Target", value: `₹${report.target}` },
                  { label: "Swiggy Live", value: report.swiggy_live ? "✓ Yes" : "✗ No", color: report.swiggy_live ? "text-green-400" : "text-red-500" },
                  { label: "Zomato Live", value: report.zomato_live ? "✓ Yes" : "✗ No", color: report.zomato_live ? "text-green-400" : "text-red-500" },
                  { label: "Discount", value: report.discount_running || "—" },
                  { label: "Expiry", value: report.expiry_count > 0 ? `${report.expiry_count} items` : "None", color: report.expiry_count > 0 ? "text-red-500" : "" },
                  { label: "Complimentary", value: report.complimentary_count > 0 ? `${report.complimentary_count}` : "None" },
                  { label: "Issues", value: report.issues || "—", color: report.issues ? "text-yellow-400" : "" },
                  { label: "Action Taken", value: report.action_taken || "—" },
                ].map(f => (
                  <div key={f.label} className="bg-black/30 px-3 py-2">
                    <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{f.label}</p>
                    <p className={`text-sm mt-1 ${f.color || "text-white"}`}>{f.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
)}
{activeTab === "outlet_reports" && (
  <div>
    <div className="flex justify-between items-end mb-6 pb-5 border-b border-zinc-800">
  <div>
    <h2 className="text-2xl font-black tracking-tight">Outlet Reports</h2>
    <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Daily tracker — fill for each outlet</p>
  </div>
  <input
    type="date"
    value={outletHistoryDate}
    onChange={(e) => { setOutletHistoryDate(e.target.value); setOutletEntryDate(e.target.value); setOutletWasOff(false); fetchOutletReportsByDate(e.target.value); }}
    className="bg-black border border-zinc-800 text-white px-4 py-2.5 focus:outline-none focus:border-yellow-400 transition-colors font-mono text-sm"
  />
</div>

    {/* Outlet selector tabs */}
    <div className="flex gap-2 flex-wrap mb-6">
     {(canAssign ? OUTLETS : (user.outlets || [])).map(o => {
        const submitted = !!outletReports[o];
        return (
         <button key={o} onClick={() => { setActiveOutlet(o); const lastRatings = lastOutletRatings[o]; setOutletReportData({ target: OUTLET_TARGETS[o] || "", bh_google_rating: lastRatings ? String(lastRatings.bh_google_rating || "") : "", bh_swiggy_rating: lastRatings ? String(lastRatings.bh_swiggy_rating || "") : "", bh_zomato_rating: lastRatings ? String(lastRatings.bh_zomato_rating || "") : "", cbh_google_rating: lastRatings ? String(lastRatings.cbh_google_rating || "") : "", cbh_swiggy_rating: lastRatings ? String(lastRatings.cbh_swiggy_rating || "") : "", cbh_zomato_rating: lastRatings ? String(lastRatings.cbh_zomato_rating || "") : "", icbh_google_rating: lastRatings ? String(lastRatings.icbh_google_rating || "") : "", icbh_swiggy_rating: lastRatings ? String(lastRatings.icbh_swiggy_rating || "") : "", icbh_zomato_rating: lastRatings ? String(lastRatings.icbh_zomato_rating || "") : "" }); }}
            className={`font-mono text-[10px] uppercase tracking-widest px-4 py-2 border transition-colors relative ${activeOutlet === o ? "border-yellow-400 text-yellow-400" : "border-zinc-700 text-zinc-500 hover:border-zinc-500"}`}>
           {OUTLET_NAMES[o] || o.replace(/_/g, " ")}
            {submitted && <span className="ml-2 text-green-400">✓</span>}
          </button>
        );
      })}
    </div>

    {!activeOutlet && (
      <div className="bg-[#131316] border border-zinc-800 p-10 text-center">
        <p className="text-zinc-600 font-mono text-sm uppercase tracking-widest">Select an outlet above to fill today's report</p>
      </div>
    )}
 {activeOutlet && outletReports[activeOutlet] && (
  <div className="bg-green-400/5 border border-green-400/30 p-6 mb-4">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
<p className="text-green-400 font-mono text-xs uppercase tracking-widest">✓ Report for {OUTLET_NAMES[activeOutlet] || activeOutlet.replace(/_/g, " ")} — {(() => { const d = new Date(outletHistoryDate + "T00:00:00"); d.setDate(d.getDate() - 1); return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }); })()} <span className="text-zinc-500">(sales day)</span></p>
  {outletReports[activeOutlet]?.is_edited && (
    <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 bg-yellow-400/10 text-yellow-400">Edited</span>
  )}
</div>
      <button
        onClick={() => editOutletReport(activeOutlet)}
        className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 border border-zinc-700 hover:border-yellow-400 hover:text-yellow-400 transition-colors"
      >
        ✏ Edit
      </button>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {[
        { label: "Shop Sales", value: `₹${outletReports[activeOutlet].shop_sales_value} (${outletReports[activeOutlet].shop_sales_count} orders)` },
        { label: "Shop AOV", value: outletReports[activeOutlet].shop_sales_count > 0 ? `₹${Math.round(Number(outletReports[activeOutlet].shop_sales_value) / Number(outletReports[activeOutlet].shop_sales_count))}` : "—" },
        { label: "Swiggy", value: `₹${outletReports[activeOutlet].swiggy_sales_value} (${outletReports[activeOutlet].swiggy_sales_count} orders)` },
        { label: "Swiggy AOV", value: outletReports[activeOutlet].swiggy_sales_count > 0 ? `₹${Math.round(Number(outletReports[activeOutlet].swiggy_sales_value) / Number(outletReports[activeOutlet].swiggy_sales_count))}` : "—" },
        { label: "Zomato", value: `₹${outletReports[activeOutlet].zomato_sales_value} (${outletReports[activeOutlet].zomato_sales_count} orders)` },
        { label: "Zomato AOV", value: outletReports[activeOutlet].zomato_sales_count > 0 ? `₹${Math.round(Number(outletReports[activeOutlet].zomato_sales_value) / Number(outletReports[activeOutlet].zomato_sales_count))}` : "—" },
        { label: "Total Sales", value: `₹${Number(outletReports[activeOutlet].shop_sales_value) + Number(outletReports[activeOutlet].swiggy_sales_value) + Number(outletReports[activeOutlet].zomato_sales_value)}`, color: "text-yellow-400" },
        { label: "Total AOV", value: (() => { const totalVal = Number(outletReports[activeOutlet].shop_sales_value) + Number(outletReports[activeOutlet].swiggy_sales_value) + Number(outletReports[activeOutlet].zomato_sales_value); const totalCount = Number(outletReports[activeOutlet].shop_sales_count) + Number(outletReports[activeOutlet].swiggy_sales_count) + Number(outletReports[activeOutlet].zomato_sales_count); return totalCount > 0 ? `₹${Math.round(totalVal / totalCount)}` : "—"; })(), color: "text-yellow-400" },
        { label: "Target", value: `₹${outletReports[activeOutlet].target}` },
        { label: "Swiggy Live", value: outletReports[activeOutlet].swiggy_live ? "✓ Yes" : "✗ No", color: outletReports[activeOutlet].swiggy_live ? "text-green-400" : "text-red-500" },
        { label: "Zomato Live", value: outletReports[activeOutlet].zomato_live ? "✓ Yes" : "✗ No", color: outletReports[activeOutlet].zomato_live ? "text-green-400" : "text-red-500" },
        { label: "Discount Running", value: outletReports[activeOutlet].discount_running || "—" },
        { label: "Expiry Items", value: `${outletReports[activeOutlet].expiry_count} — ${outletReports[activeOutlet].expiry_items || "—"}` },
        { label: "Complimentary", value: `${outletReports[activeOutlet].complimentary_count} — ${outletReports[activeOutlet].complimentary_reason || "—"}` },
        { label: "BH Google", value: outletReports[activeOutlet].bh_google_rating ? `⭐ ${outletReports[activeOutlet].bh_google_rating}` : "—" },
        { label: "BH Swiggy", value: outletReports[activeOutlet].bh_swiggy_rating ? `⭐ ${outletReports[activeOutlet].bh_swiggy_rating}` : "—" },
        { label: "BH Zomato", value: outletReports[activeOutlet].bh_zomato_rating ? `⭐ ${outletReports[activeOutlet].bh_zomato_rating}` : "—" },
        { label: "CBH Swiggy", value: outletReports[activeOutlet].cbh_swiggy_rating ? `⭐ ${outletReports[activeOutlet].cbh_swiggy_rating}` : "—" },
        { label: "CBH Zomato", value: outletReports[activeOutlet].cbh_zomato_rating ? `⭐ ${outletReports[activeOutlet].cbh_zomato_rating}` : "—" },
        { label: "ICBH Swiggy", value: outletReports[activeOutlet].icbh_swiggy_rating ? `⭐ ${outletReports[activeOutlet].icbh_swiggy_rating}` : "—" },
        { label: "ICBH Zomato", value: outletReports[activeOutlet].icbh_zomato_rating ? `⭐ ${outletReports[activeOutlet].icbh_zomato_rating}` : "—" },
        { label: "Issues", value: outletReports[activeOutlet].issues || "—" },
        { label: "Action Taken", value: outletReports[activeOutlet].action_taken || "—" },
      ].map(f => (
        <div key={f.label} className="bg-black/30 px-3 py-2">
          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{f.label}</p>
          <p className={`text-sm mt-1 ${f.color || "text-white"}`}>{f.value}</p>
        </div>
      ))}
    </div>
  </div>
)}

    {activeOutlet && !outletReports[activeOutlet] && (
      <div className="bg-[#131316] border border-zinc-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm font-bold uppercase tracking-widest">{OUTLET_NAMES[activeOutlet] || activeOutlet.replace(/_/g, " ")} — Yesterday's Sales Report</p>
          <span className="text-yellow-400 font-mono text-xs">Due: 12:00 PM today</span>
        </div>
        <p className="text-[11px] font-mono text-zinc-400 mb-5 -mt-3">📋 You're filing <span className="text-yellow-400">yesterday's sales</span> ({new Date(Date.now() - 86400000).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}) — recorded under today's date, due by 12 noon.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
         {[
  { label: "Yesterday's Target (Rs)", key: "target" },
  { label: "Shop Sales — Orders Count", key: "shop_sales_count" },
  { label: "Shop Sales — Value (Rs)", key: "shop_sales_value" },
  { label: "Swiggy Orders Count", key: "swiggy_sales_count" },
  { label: "Swiggy Sales Value (Rs)", key: "swiggy_sales_value" },
  { label: "Zomato Orders Count", key: "zomato_sales_count" },
  { label: "Zomato Sales Value (Rs)", key: "zomato_sales_value" },
  { label: "Discount/Offer Running", key: "discount_running" },
  { label: "Unavailable Items", key: "unavailable_items" },
  { label: "Expiry Items Count", key: "expiry_count" },
  { label: "Expiry Items (list)", key: "expiry_items" },
  { label: "Complimentary Given (count)", key: "complimentary_count" },
  { label: "Complimentary Reason", key: "complimentary_reason" },
  { label: "BH — Google Rating", key: "bh_google_rating" },
  { label: "BH — Swiggy Rating", key: "bh_swiggy_rating" },
  { label: "BH — Zomato Rating", key: "bh_zomato_rating" },
  { label: "CBH — Swiggy Rating", key: "cbh_swiggy_rating" },
  { label: "CBH — Zomato Rating", key: "cbh_zomato_rating" },
  { label: "ICBH — Swiggy Rating", key: "icbh_swiggy_rating" },
  { label: "ICBH — Zomato Rating", key: "icbh_zomato_rating" },
  { label: "Issues Today", key: "issues" },
  { label: "Action Taken", key: "action_taken" },
].map(f => (
  <div key={f.key}>
    <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">{f.label}</label>
    <input
      type="text"
      value={outletReportData[f.key] || ""}
      onChange={(e) => setOutletReportData(prev => ({ ...prev, [f.key]: e.target.value }))}
      className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm"
      placeholder="—"
    />
  </div>
))}

{/* Yes/No dropdowns */}
{[
  { label: "Swiggy Live?", key: "swiggy_live" },
  { label: "Zomato Live?", key: "zomato_live" },
  { label: "Discount Rate Good?", key: "discount_rate_good" },
].map(f => (
  <div key={f.key}>
    <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">{f.label}</label>
    <select
      value={outletReportData[f.key] || "yes"}
      onChange={(e) => setOutletReportData(prev => ({ ...prev, [f.key]: e.target.value }))}
      className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm"
    >
      <option value="yes">Yes</option>
      <option value="no">No</option>
    </select>
  </div>
))}
        </div>
        <div className="mb-4">
          <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Report Date</label>
         <input type="date" max={new Date().toISOString().split("T")[0]} value={outletEntryDate} onChange={(e) => { setOutletEntryDate(e.target.value); setOutletHistoryDate(e.target.value); setOutletWasOff(false); fetchOutletReportsByDate(e.target.value); }} className="bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm" />
          {outletEntryDate < new Date().toISOString().split("T")[0] && (
            <div className="mt-3">
              <p className="text-[11px] font-mono text-zinc-400 uppercase tracking-widest mb-1.5">Were you off on this day?</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setOutletWasOff(true)} className={`text-[11px] font-mono uppercase tracking-widest px-3 py-1.5 border transition-colors ${outletWasOff ? "border-green-400 text-green-400" : "border-zinc-700 text-zinc-500"}`}>Yes, I was off</button>
                <button type="button" onClick={() => setOutletWasOff(false)} className={`text-[11px] font-mono uppercase tracking-widest px-3 py-1.5 border transition-colors ${!outletWasOff ? "border-red-400 text-red-400" : "border-zinc-700 text-zinc-500"}`}>No</button>
              </div>
              <p className={`text-[11px] font-mono uppercase tracking-widest mt-2 ${outletWasOff ? "text-green-400" : "text-red-400"}`}>{outletWasOff ? "✓ Off day — no points, no penalty" : "⚠️ Back-dated — −30 penalty"}</p>
            </div>
          )}
        </div>
        <button onClick={submitOutletReport} disabled={outletSubmitting} className="bg-yellow-400 text-black font-bold tracking-widest text-xs px-6 py-3 hover:opacity-90 transition-opacity uppercase disabled:opacity-50">
          {outletSubmitting ? "Submitting..." : `Submit ${OUTLET_NAMES[activeOutlet] || activeOutlet.replace(/_/g, " ")} Report →`}
        </button>
        {(user.outlets || []).includes(activeOutlet) && (
          <div className="mt-8 border-t border-zinc-800 pt-6">
            <p className="text-sm font-bold uppercase tracking-widest mb-1">Swiggy / Zomato Reviews</p>
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-4">5★ +5 · 4★ +3 · under 2★ −5 · valid complaint −10 (stacks) · for {new Date(outletEntryDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
            <div className="bg-black/30 border border-zinc-800 p-4 mb-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <select value={revForm.platform} onChange={e => setRevForm(p => ({ ...p, platform: e.target.value }))} className="bg-black border border-zinc-800 text-white px-3 py-2 text-sm"><option>Swiggy</option><option>Zomato</option></select>
              <select value={revForm.rating} onChange={e => setRevForm(p => ({ ...p, rating: e.target.value }))} className="bg-black border border-zinc-800 text-white px-3 py-2 text-sm"><option value="5">5 ★</option><option value="4">4 ★</option><option value="3">3 ★</option><option value="2">2 ★</option><option value="1">1 ★</option></select>
              <input type="text" value={revForm.note} onChange={e => setRevForm(p => ({ ...p, note: e.target.value }))} placeholder="Note (optional)" className="bg-black border border-zinc-800 text-white px-3 py-2 text-sm md:col-span-2" />
              <label className="flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={revForm.valid} onChange={e => setRevForm(p => ({ ...p, valid: e.target.checked }))} /> Valid complaint (our mistake) −10</label>
              <label className="flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={revForm.refund} onChange={e => setRevForm(p => ({ ...p, refund: e.target.checked }))} /> Refund given</label>
            </div>
            <button onClick={saveReview} disabled={revSaving} className="bg-yellow-400 text-black font-bold text-[10px] px-4 py-2 uppercase tracking-widest disabled:opacity-50 mb-4">{revSaving ? "Adding..." : "+ Add Review"}</button>
            {reviews.length > 0 && (
              <div className="space-y-2">
                {reviews.map(rv => { const pts = reviewPoints(Number(rv.rating), rv.valid_complaint); return (
                  <div key={rv.id} className="flex items-center justify-between bg-black/30 border border-zinc-800 px-3 py-2 text-xs">
                    <div className="text-zinc-300">{rv.platform} · {rv.rating}★{rv.valid_complaint ? " · valid complaint" : ""}{rv.refund_given ? " · refunded" : ""}{rv.note ? ` · ${rv.note}` : ""}</div>
                    <div className="flex items-center gap-3">
                      <span className={pts >= 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>{pts >= 0 ? "+" : ""}{pts}</span>
                      <button onClick={() => deleteReview(rv.id)} className="text-zinc-600 hover:text-red-400">✕</button>
                    </div>
                  </div>
                ); })}
              </div>
            )}
          </div>
        )}
      </div>
    )}
  </div>
)}
        {activeTab === "history" && (
  <div>
    <div className="flex justify-between items-end mb-6 pb-5 border-b border-zinc-800">
  <div>
    <h2 className="text-2xl font-black tracking-tight">History</h2>
    <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">View reports by date</p>
  </div>
 <div className="flex gap-2">
  <button
    onClick={exportCSV}
    className="bg-zinc-800 border border-zinc-700 text-white font-bold tracking-widest text-xs px-5 py-3 hover:border-yellow-400 hover:text-yellow-400 transition-colors uppercase"
  >
    ↓ CSV
  </button>
  <button
    onClick={() => window.print()}
    className="bg-yellow-400 text-black font-bold tracking-widest text-xs px-5 py-3 hover:opacity-90 transition-opacity uppercase"
  >
    ↓ PDF
  </button>
</div>
</div>
    <div className="flex items-center gap-4 mb-8">
      <input
        type="date"
        value={historyDate}
        onChange={(e) => { setHistoryDate(e.target.value); fetchHistoryReports(e.target.value); }}
        className="bg-black border border-zinc-800 text-white px-4 py-2.5 focus:outline-none focus:border-yellow-400 transition-colors font-mono text-sm"
      />
      <span className="text-zinc-500 font-mono text-xs uppercase tracking-widest">{historyLoading ? "Loading..." : `${historyReports.length} reports · ${historyOutletReports.length} outlet reports`}</span>
    </div>

    {/* Staff Reports */}
    <div className="mb-8">
      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-4">Staff Reports</p>
      <div className="bg-[#131316] border border-zinc-800">
        {historyReports.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-zinc-600 font-mono text-sm uppercase tracking-widest">No reports for this date</p>
          </div>
        ) : historyReports.map((r) => {
          const staffName = ALL_STAFF.find(s => s.id === r.staff_id)?.name || r.staff_id;
          const staffFields = REPORT_FIELDS[r.staff_id] || [];
          return (
            <div key={r.id} className="border-b border-zinc-800 last:border-0">
              <div className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-zinc-900 transition-colors" onClick={() => setSelectedReport(selectedReport?.id === r.id ? null : r)}>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-sm">{staffName}</span>
                  {r.is_late && <span className="text-red-500 font-mono text-[10px] uppercase bg-red-500/10 px-2 py-0.5">Late</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-mono text-zinc-500">{new Date(r.submitted_at).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="text-zinc-500">{selectedReport?.id === r.id ? "▲" : "▼"}</span>
                </div>
              </div>
              {selectedReport?.id === r.id && r.report_data && (
                <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {staffFields.map(f => (
                    <div key={f.key} className="bg-black/30 px-3 py-2">
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{f.label}</p>
                      <p className="text-sm text-white mt-1">{r.report_data[f.key] || "—"}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>

    {/* Outlet Reports */}
    <div>
      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-4">Outlet Reports</p>
      <div className="grid grid-cols-1 gap-4">
        {historyOutletReports.length === 0 ? (
          <div className="bg-[#131316] border border-zinc-800 p-8 text-center">
            <p className="text-zinc-600 font-mono text-sm uppercase tracking-widest">No outlet reports for this date</p>
          </div>
        ) : historyOutletReports.map((r) => {
          const staffName = ALL_STAFF.find(s => s.id === r.staff_id)?.name || r.staff_id;
          return (
            <div key={r.id} className="bg-[#131316] border border-zinc-800 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-bold text-sm uppercase tracking-widest">{OUTLET_NAMES[r.outlet_id] || r.outlet_id.replace(/_/g, " ")}</p>
                  <p className="text-[10px] font-mono text-zinc-500 mt-0.5">{staffName}</p>
                </div>
                <div className="flex items-center gap-2">
                  {r.is_late && <span className="font-mono text-[10px] uppercase px-2 py-1 bg-red-500/10 text-red-500">Late</span>}
                  <span className="text-[11px] font-mono text-zinc-500">{new Date(r.submitted_at).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Shop Sales", value: `₹${r.shop_sales_value} (${r.shop_sales_count})` },
                  { label: "Swiggy", value: `₹${r.swiggy_sales_value} (${r.swiggy_sales_count})` },
                  { label: "Zomato", value: `₹${r.zomato_sales_value} (${r.zomato_sales_count})` },
                  { label: "Target", value: `₹${r.target}` },
                  { label: "Swiggy Live", value: r.swiggy_live ? "✓ Yes" : "✗ No", color: r.swiggy_live ? "text-green-400" : "text-red-500" },
                  { label: "Zomato Live", value: r.zomato_live ? "✓ Yes" : "✗ No", color: r.zomato_live ? "text-green-400" : "text-red-500" },
                  { label: "Expiry", value: r.expiry_count > 0 ? `${r.expiry_count} — ${r.expiry_items}` : "None", color: r.expiry_count > 0 ? "text-red-500" : "" },
                  { label: "Issues", value: r.issues || "—", color: r.issues ? "text-yellow-400" : "" },
                ].map(f => (
                  <div key={f.label} className="bg-black/30 px-3 py-2">
                    <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{f.label}</p>
                    <p className={`text-sm mt-1 ${f.color || "text-white"}`}>{f.value}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </div>
)}
        {activeTab === "analytics" && (
          <div>
            <div className="mb-8 pb-5 border-b border-zinc-800">
              <h2 className="text-2xl font-black tracking-tight">Analytics</h2>
             <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Sales performance · channel mix</p>
            </div>

          {best && (
              <div className="mb-3 border border-green-500/30 bg-green-950/20 p-5">
                <p className="text-[10px] font-mono text-green-400 uppercase tracking-[0.2em] mb-1">★ Best Performer of TASKFORCE</p>
                <p className="text-2xl md:text-3xl font-black tracking-tight">Mr/Ms {best.name.split(" ")[0]}</p>
                <p className="text-[11px] font-mono text-zinc-500 mt-1">{best.points} pts this month · top score</p>
              </div>
            )}
           {worst && (
              <div className="mb-8 border border-red-500/30 bg-red-950/20 p-5">
                <p className="text-[10px] font-mono text-red-400 uppercase tracking-[0.2em] mb-1">⚠ Worst Performer of TASKFORCE</p>
                <p className="text-2xl md:text-3xl font-black tracking-tight">Mr/Ms {worst.name.split(" ")[0]}</p>
                <p className="text-[11px] font-mono text-zinc-500 mt-1">{worst.points} pts this month · lowest score</p>
              </div>
            )}

            {/* Sales performance (date range) */}
            <div className="mb-10">
              <div className="flex flex-wrap items-end gap-3 mb-6">
                <div>
                  <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">From</label>
                  <input type="date" value={anFrom} onChange={(e) => setAnFrom(e.target.value)} className="bg-black border border-zinc-800 text-white px-3 py-2 text-sm focus:outline-none focus:border-yellow-400 transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">To</label>
                  <input type="date" value={anTo} onChange={(e) => setAnTo(e.target.value)} className="bg-black border border-zinc-800 text-white px-3 py-2 text-sm focus:outline-none focus:border-yellow-400 transition-colors" />
                </div>
                <span className="text-[10px] font-mono text-zinc-600 pb-2">{anLoading ? "Loading…" : `${anRows.length} report-days`}</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-[#131316] border border-zinc-800 p-5">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Total Sales</p>
                  <p className="text-2xl font-black tracking-tight">{anINR(anAgg.totalV)}</p>
                </div>
                <div className="bg-[#131316] border border-zinc-800 p-5">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Total Orders</p>
                  <p className="text-2xl font-black tracking-tight">{anAgg.totalC.toLocaleString("en-IN")}</p>
                </div>
                <div className="bg-[#131316] border border-zinc-800 p-5">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Avg Order Value</p>
                  <p className="text-2xl font-black tracking-tight">{anINR(anAgg.totalC ? anAgg.totalV / anAgg.totalC : 0)}</p>
                </div>
                <div className="bg-[#131316] border border-zinc-800 p-5">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Delivery Share</p>
                  <p className="text-2xl font-black tracking-tight">{anPct(anAgg.ch.swiggy.v + anAgg.ch.zomato.v, anAgg.totalV)}%</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {([["shop", "Shop / Store", "text-blue-400", "bg-blue-400"], ["swiggy", "Swiggy", "text-orange-400", "bg-orange-400"], ["zomato", "Zomato", "text-red-400", "bg-red-400"]] as const).map(([key, label, tc, bc]) => {
                  const c = anAgg.ch[key];
                  const share = anPct(c.v, anAgg.totalV);
                  const aov = c.c ? c.v / c.c : 0;
                  return (
                    <div key={key} className="bg-[#131316] border border-zinc-800 p-5">
                      <div className="flex justify-between items-center mb-3">
                        <p className={`text-[10px] font-mono uppercase tracking-widest ${tc}`}>{label}</p>
                        <span className="font-mono text-xs text-zinc-500">{share}%</span>
                      </div>
                      <p className="text-xl font-black tracking-tight mb-2">{anINR(c.v)}</p>
                      <div className="h-2 bg-zinc-800 border border-zinc-700 mb-3"><div className={`h-full ${bc}`} style={{ width: `${share}%` }} /></div>
                      <div className="flex justify-between text-xs font-mono text-zinc-500">
                        <span>{c.c.toLocaleString("en-IN")} orders</span>
                        <span>AOV {anINR(aov)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#131316] border border-zinc-800 p-6">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-6">Performance by Staff · this month</p>
                {scoreRows.length === 0 && <p className="text-zinc-600 font-mono text-xs">Loading scores…</p>}
                {(() => {
                  const pmax = Math.max(...scoreRows.map(x => x.points), 1);
                  const pmin = Math.min(...scoreRows.map(x => x.points), 0);
                  const span = (pmax - pmin) || 1;
                 return scoreRows.map((r, i) => {
                    const isWorst = worst?.id === r.id;
                    const isBest = best?.id === r.id;
                    const w = Math.max(3, Math.round((r.points - pmin) / span * 100));
                    return (
                      <div key={r.id} className="mb-4">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium">{i + 1}. {r.name.split(" ")[0]}{isBest && <span className="text-green-400 ml-1">★</span>}{isWorst && <span className="text-red-500 ml-1">⚠</span>}</span>
                         <span className="font-mono text-xs text-zinc-500">{r.dailyToday === "done" && <span className="text-green-400 mr-2">report ✓</span>}{r.dailyToday === "missed" && <span className="text-red-500 mr-2">report ✗</span>}{r.dailyToday === "pending" && <span className="text-zinc-500 mr-2">report …</span>}{r.dailyToday === "off" && <span className="text-zinc-600 mr-2">off</span>}{r.points} pts</span>
                        </div>
                        <div className="h-2 bg-zinc-800 border border-zinc-700">
                          <div className={`h-full transition-all ${isWorst ? "bg-red-500" : isBest ? "bg-green-400" : "bg-zinc-600"}`} style={{ width: `${w}%` }} />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
              <div className="bg-[#131316] border border-zinc-800 p-6">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-6">Task Breakdown</p>
                {[
                  { label: "Total Assigned", value: tasks.length, color: "text-white" },
                  { label: "Completed", value: tasks.filter(t => t.status === "completed").length, color: "text-green-400" },
                  { label: "In Progress", value: tasks.filter(t => t.status === "in_progress").length, color: "text-yellow-400" },
                  { label: "Not Started", value: tasks.filter(t => t.status === "assigned").length, color: "text-zinc-400" },
                  { label: "Overdue", value: tasks.filter(t => t.status !== "completed" && new Date(t.due_at) < new Date()).length, color: "text-red-500" },
                ].map(s => (
                  <div key={s.label} className="flex justify-between items-center py-3 border-b border-zinc-800 last:border-0">
                    <span className="text-sm text-zinc-400">{s.label}</span>
                    <span className={`font-mono font-bold text-lg ${s.color}`}>{s.value}</span>
                  </div>
                ))}
              </div>
              <div className="bg-[#131316] border border-zinc-800 p-6">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-6">Reports Today</p>
                {ALL_STAFF.filter(s => s.id !== "nishant").map(s => {
                  const todayStr = new Date().toDateString();
                  const report = reports.find(r => r.staff_id === s.id && new Date(r.submitted_at).toDateString() === todayStr);
                  return (
                    <div key={s.id} className="flex justify-between items-center py-3 border-b border-zinc-800 last:border-0">
                      <span className="text-sm font-medium">{s.name.split(" ")[0]}</span>
                      <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 ${report ? report.is_late ? "bg-red-500/10 text-red-500" : "bg-green-400/10 text-green-400" : "bg-zinc-800 text-zinc-500"}`}>
                        {report ? report.is_late ? "Late" : "On Time" : "Pending"}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="bg-[#131316] border border-zinc-800 p-6">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-6">Tasks by Outlet</p>
                {OUTLETS.map(o => {
                  const count = tasks.filter(t => t.outlet_id === o).length;
                  return (
                    <div key={o} className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0">
                      <span className="text-sm text-zinc-400 capitalize">{OUTLET_NAMES[o] || o.replace(/_/g, " ")}</span>
                      <span className="font-mono text-sm font-bold">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-[500px] bg-[#131316] border border-zinc-800 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-zinc-800">
              <h3 className="text-xl font-black tracking-tight">Assign New Task</h3>
              <button onClick={() => setShowModal(false)} className="text-zinc-500 hover:text-white text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Task Title *</label>
                <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="e.g. Check outlet stock" className="w-full bg-black border border-zinc-800 text-white px-4 py-3 focus:outline-none focus:border-yellow-400 transition-colors text-sm" />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Description</label>
                <textarea value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} placeholder="Optional details..." rows={2} className="w-full bg-black border border-zinc-800 text-white px-4 py-3 focus:outline-none focus:border-yellow-400 transition-colors text-sm resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Assign To</label>
                  <select value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)} className="w-full bg-black border border-zinc-800 text-white px-4 py-3 focus:outline-none focus:border-yellow-400 transition-colors text-sm">
                    {ALL_STAFF.filter(s => s.id !== "nishant").map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Priority</label>
                  <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)} className="w-full bg-black border border-zinc-800 text-white px-4 py-3 focus:outline-none focus:border-yellow-400 transition-colors text-sm">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Outlet (Optional)</label>
                <select value={taskOutlet} onChange={(e) => setTaskOutlet(e.target.value)} className="w-full bg-black border border-zinc-800 text-white px-4 py-3 focus:outline-none focus:border-yellow-400 transition-colors text-sm">
                  <option value="">No specific outlet</option>
                  {OUTLETS.map(o => <option key={o} value={o}>{OUTLET_NAMES[o] || o.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Due In</label>
                <select value={taskDueHours} onChange={(e) => setTaskDueHours(e.target.value)} className="w-full bg-black border border-zinc-800 text-white px-4 py-3 focus:outline-none focus:border-yellow-400 transition-colors text-sm">
                  <option value="1">1 hour</option>
                  <option value="2">2 hours</option>
                  <option value="4">4 hours</option>
                  <option value="8">8 hours</option>
                  <option value="24">1 day</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6 pt-5 border-t border-zinc-800">
              <button onClick={() => setShowModal(false)} className="px-5 py-2.5 border border-zinc-700 text-sm font-medium hover:border-zinc-500 transition-colors">Cancel</button>
              <button onClick={assignTask} disabled={submitting || !taskTitle.trim()} className="px-5 py-2.5 bg-yellow-400 text-black font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50">
                {submitting ? "Assigning..." : "Assign Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPinModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-[400px] bg-[#131316] border border-zinc-800 p-8">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-zinc-800">
              <h3 className="text-xl font-black tracking-tight">Change PIN</h3>
              <button onClick={() => { setShowPinModal(false); setPinMsg(""); setNewPin(""); }} className="text-zinc-500 hover:text-white text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">New PIN (min 4 digits)</label>
                <input type="password" value={newPin} onChange={(e) => setNewPin(e.target.value)} placeholder="Enter new PIN" className="w-full bg-black border border-zinc-800 text-white px-4 py-3 focus:outline-none focus:border-yellow-400 transition-colors text-sm" />
              </div>
              {pinMsg && <p className={`font-mono text-xs uppercase ${pinMsg.includes("success") ? "text-green-400" : "text-red-500"}`}>{pinMsg}</p>}
              <button onClick={updatePin} className="w-full bg-yellow-400 text-black font-bold tracking-widest text-sm py-3 hover:opacity-90 transition-opacity uppercase">Update PIN</button>
            </div>
          </div>
        </div>
      )}

      {overdueTask && user?.role !== "Owner" && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(20,0,0,0.97)" }}>
          <div className="w-full max-w-[560px] bg-[#131316] border-2 border-red-500">
            <div className="bg-red-500 px-6 py-4 text-center font-mono text-xs font-bold uppercase tracking-widest text-white animate-pulse">
              ⚠ Action Required · Overdue Task ⚠
            </div>
            <div className="p-6">
              <h3 className="text-2xl font-black mb-2">You have an overdue task</h3>
              <p className="text-zinc-400 text-sm mb-4 leading-relaxed">This task is past its deadline. You must either complete it or provide a reason.</p>
              <div className="bg-black border border-zinc-800 p-4 mb-4">
                <p className="font-bold text-base mb-1">{overdueTask.title}</p>
                <p className="font-mono text-xs text-red-500 uppercase tracking-widest">
                  Overdue by {Math.round((Date.now() - new Date(overdueTask.due_at).getTime()) / 60000)} min · {overdueTask.priority}
                </p>
              </div>
              <div className="mb-4">
                <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Reason for delay (min 20 characters)</label>
                <textarea value={forceAckReason} onChange={(e) => setForceAckReason(e.target.value)} placeholder="Explain why this task is overdue..." rows={3} className="w-full bg-black border border-zinc-800 text-white px-4 py-3 focus:outline-none focus:border-red-500 transition-colors text-sm resize-none" />
              </div>
              <div className="flex gap-3 justify-end pt-4 border-t border-zinc-800">
                <button onClick={() => submitForceAck("reason")} className="px-5 py-2.5 border border-zinc-700 text-sm font-medium hover:border-zinc-500 transition-colors">Submit Reason</button>
                <button onClick={() => submitForceAck("complete")} className="px-5 py-2.5 bg-yellow-400 text-black font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity">Mark Complete</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
