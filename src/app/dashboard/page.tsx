"use client";
import { useEffect, useState, useRef, Fragment } from "react";
import * as XLSX from "xlsx";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { celebrate } from "../celebrate";
import { computeScores, type ScoreRow } from "@/lib/score";
import PayoutTab from "./PayoutTab";
import FounderDashboard from "./FounderDashboard";
import ReconciliationTab from "./ReconciliationTab";
import supabaseStock from "@/lib/supabaseStock";
import { OUTLET_ID_TO_STOCK_NAME } from "@/lib/outletMap";
import { FOOD_COST_MAP } from "@/lib/foodCosts";
import { useActivityHeartbeat } from "@/lib/useActivityHeartbeat";
import ActivityToastStack from "@/components/ActivityToastStack";


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
  discount_running: string; discount_rate_good: boolean; discount_given?: number;
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
  { id: "nilani", name: "Nilani Nallamuthu", role: "HR", report_time: "22:00", outlets: [] },
  { id: "gowtham", name: "Gowtham", role: "Purchase Manager", report_time: "22:00", outlets: [] },
  { id: "vishnu", name: "Vishnu", role: "Asst. Ops Manager", report_time: "22:00", outlets: ["velachery","perumbakkam","tambaram","porur","anna_nagar","vadapalani"] },
  { id: "ahila", name: "Ahila", role: "Custom Cakes & Asst Ops", report_time: "22:00", outlets: ["royapettah","adayar","bsr_mall","pallavaram","ra_puram"] },
  { id: "niranjana", name: "Niranjana", role: "Founder's Office", report_time: null, outlets: [] },
  { id: "rafiq", name: "Rafiq", role: "Head Chef", report_time: null, outlets: [] },
  { id: "ajay", name: "Ajay", role: "Financial Analyst", report_time: null, outlets: [] },
  { id: "bharani", name: "Bharani", role: "Auditor", report_time: "22:00", outlets: ["besant_nagar"] },
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
  ra_puram: "21667",
  anna_nagar: "51667",
  porur: "50000",
  perumbakkam: "13333",
  tambaram: "20000",
  velachery: "23333",
  pallavaram: "23333",
  vadapalani: "23333",
  besant_nagar: "11667",
};

// Official FY 2026-27 monthly targets by brand (BH = Brownie Heaven, CBH = Cakes by BH, ICBH = Ice Creams by BH).
// Vadapalani & Besant Nagar not on the official sheet yet -> no brand split; they keep their default daily target above.
const BRAND_TARGETS: Record<string, { bh: number; cbh: number; icbh: number; total: number }> = {
  royapettah:  { bh: 1500000, cbh: 700000, icbh: 200000, total: 2400000 },
  anna_nagar:  { bh: 800000,  cbh: 600000, icbh: 150000, total: 1550000 },
  porur:       { bh: 750000,  cbh: 600000, icbh: 150000, total: 1500000 },
  bsr_mall:    { bh: 600000,  cbh: 300000, icbh: 150000, total: 1050000 },
  tambaram:    { bh: 300000,  cbh: 200000, icbh: 100000, total: 600000 },
  ra_puram:    { bh: 350000,  cbh: 200000, icbh: 100000, total: 650000 },
  adayar:      { bh: 300000,  cbh: 150000, icbh: 100000, total: 550000 },
  perumbakkam: { bh: 300000,  cbh: 100000, icbh: 0,      total: 400000 },
  pallavaram:  { bh: 350000,  cbh: 250000, icbh: 100000, total: 700000 },
  velachery:   { bh: 350000,  cbh: 250000, icbh: 100000, total: 700000 },
};

// Base monthly totals (current, in effect through July 2026).
const MONTHLY_BASE: Record<string, number> = {
  royapettah: 2400000, adayar: 550000, bsr_mall: 1050000, velachery: 700000,
  ra_puram: 650000, anna_nagar: 1550000, pallavaram: 700000, vadapalani: 699990,
  besant_nagar: 350010, perumbakkam: 400000, tambaram: 600000, porur: 1500000,
};
// Scheduled target changes. Each applies from the given month (YYYY-MM) onward. Latest matching wins.
const TARGET_UPDATES: { from: string; monthly: Record<string, number> }[] = [
 { from: "2026-08", monthly: { royapettah: 2400000, adayar: 600000, bsr_mall: 1050000, velachery: 700000, ra_puram: 650000, anna_nagar: 1800000, pallavaram: 700000, vadapalani: 700000, besant_nagar: 500000, perumbakkam: 550000, tambaram: 650000, porur: 1600000 } },
];
function monthlyTargetFor(oid: string, ym: string): number {
  let v = MONTHLY_BASE[oid] || 0;
  for (const u of TARGET_UPDATES) { if (ym >= u.from && u.monthly[oid] != null) v = u.monthly[oid]; }
  return v;
}
function dailyTargetFor(oid: string, ym: string): number {
  return Math.round(monthlyTargetFor(oid, ym) / 30);
}

function computeCeoData(repRows: any[], monthRep: any[], win: string) {
  const winDays = win === "1" ? 1 : win === "30" ? 30 : 7;
  const duty = (ALL_STAFF as any[]).filter((s) => s.report_time);
  const acct = duty.map((s) => {
    const mine = repRows.filter((r) => r.staff_id === s.id);
    const filed = mine.length, late = mine.filter((r) => r.is_late).length, onTime = filed - late, missed = Math.max(0, winDays - filed);
    let tag = "", tone = "gray";
    if (filed === 0) { tag = "nothing filed 👀 hello?"; tone = "red"; }
    else if (missed === 0 && late === 0) { tag = `${filed}/${winDays} on time 🌟 the reliable one`; tone = "green"; }
    else if (missed >= Math.ceil(winDays * 0.5)) { tag = `skipped ${missed}/${winDays} days 👻 ghost mode`; tone = "red"; }
    else if (late >= Math.ceil(filed * 0.4)) { tag = `late ${late}/${filed} times 😴 loves the snooze button`; tone = "amber"; }
    else { tag = `${onTime} on time · ${late} late · ${missed} missed`; tone = "gray"; }
    return { id: s.id, name: s.name.split(" ")[0], filed, late, missed, tag, tone, score: missed * 2 + late };
  }).sort((a, b) => a.score - b.score);
  const ym = new Date().toISOString().slice(0, 7);
  const _d = new Date();
  const daysInMonth = new Date(_d.getFullYear(), _d.getMonth() + 1, 0).getDate();
  const daysElapsed = Math.max(1, _d.getDate() - 1);
  const perOutlet = OUTLETS.map((o) => {
    const sales = monthRep.filter((r) => r.outlet_id === o).reduce((a, r) => a + (Number(r.shop_sales_value) || 0) + (Number(r.swiggy_sales_value) || 0) + (Number(r.zomato_sales_value) || 0), 0);
    const tgt = monthlyTargetFor(o, ym);
    return { o, name: OUTLET_NAMES[o] || o, sales, tgt, pace: tgt > 0 ? (sales / tgt) / (daysElapsed / daysInMonth) : 0, pct: tgt > 0 ? sales / tgt * 100 : 0 };
  });
  const monthSales = perOutlet.reduce((a, r) => a + r.sales, 0), monthTgt = perOutlet.reduce((a, r) => a + r.tgt, 0);
  const salesPct = monthTgt > 0 ? monthSales / monthTgt * 100 : 0, timePct = daysInMonth > 0 ? daysElapsed / daysInMonth * 100 : 0, onTrack = salesPct >= timePct;
  const sorted = [...perOutlet].filter((r) => r.tgt > 0 && r.sales > 0).sort((a, b) => a.pace - b.pace);
  const drag = sorted[0], hero = sorted[sorted.length - 1];
  const ideas: string[] = [];
  const notFiling = acct.filter((a) => a.filed === 0);
  const lateOnes = acct.filter((a) => a.filed > 0 && a.late >= Math.ceil(a.filed * 0.4));
  const missingOnes = acct.filter((a) => a.filed > 0 && a.missed >= Math.ceil(winDays * 0.5));
  if (notFiling.length >= 2) ideas.push(`${notFiling.length} people filed nothing this period — reporting discipline is slipping. A group reminder or a quick accountability chat would help.`);
  else if (notFiling.length === 1) ideas.push(`${notFiling[0].name} filed nothing — follow up directly; could be a real issue or just slacking.`);
  lateOnes.forEach((a) => ideas.push(`${a.name} is chronically late (${a.late}/${a.filed}). A fixed reminder time or a word in person usually fixes it.`));
  missingOnes.forEach((a) => ideas.push(`${a.name} keeps skipping reports — worth understanding why before it becomes a habit.`));
  if (!onTrack) ideas.push(`Month is behind pace (${salesPct.toFixed(0)}% sales vs ${timePct.toFixed(0)}% of the month gone). A weekend push, a combo offer, or leaning on the strong outlets could close the gap.`);
  if (drag && drag.pct < 15) ideas.push(`${drag.name} is badly behind (${drag.pct.toFixed(0)}% of target). A direct call to the manager or a local promo could lift it.`);
  if (hero && hero.pct >= 90) ideas.push(`${hero.name} is doing great (${hero.pct.toFixed(0)}%). Find out what's working there and copy it to weaker outlets.`);
  if (ideas.length === 0) ideas.push(`Everything looks healthy — team is filing and the month's on pace. Keep the momentum. 🎉`);
  return { winDays, acct, perOutlet, monthSales, monthTgt, salesPct, timePct, onTrack, drag, hero, ideas, ym, daysElapsed, daysInMonth };
}
function computeCeoCustom(staffRows: any[], outletRows: any[], from: string, to: string, outletsSel: string[]) {
  const rows = outletRows;
  const days = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1);
  const duty = (ALL_STAFF as any[]).filter((s) => s.report_time);
  const acct = duty.map((s) => {
    const mine = staffRows.filter((r) => r.staff_id === s.id);
    const filed = mine.length, late = mine.filter((r) => r.is_late).length, onTime = filed - late, missed = Math.max(0, days - filed);
    let tag = "";
    if (filed === 0) tag = "nothing filed 👀 hello?";
    else if (missed === 0 && late === 0) tag = `${filed}/${days} on time 🌟 the reliable one`;
    else if (missed >= Math.ceil(days * 0.5)) tag = `skipped ${missed}/${days} days 👻 ghost mode`;
    else if (late >= Math.ceil(filed * 0.4)) tag = `late ${late}/${filed} times 😴 loves the snooze button`;
    else tag = `${onTime} on time · ${late} late · ${missed} missed`;
    return { id: s.id, name: s.name.split(" ")[0], filed, late, missed, tag };
  });
  const activeOutlets = outletsSel.length ? outletsSel : OUTLETS;
  const ymFrom = from.slice(0, 7);
  const perOutlet = activeOutlets.map((o) => {
    const oRows = rows.filter((r) => r.outlet_id === o);
    const sales = oRows.reduce((a, r) => a + (Number(r.shop_sales_value) || 0) + (Number(r.swiggy_sales_value) || 0) + (Number(r.zomato_sales_value) || 0), 0);
    const tgt = dailyTargetFor(o, ymFrom) * days;
    return { o, name: OUTLET_NAMES[o] || o, sales, tgt, pct: tgt > 0 ? (sales / tgt) * 100 : 0 };
  });
  const periodSales = perOutlet.reduce((a, r) => a + r.sales, 0), periodTgt = perOutlet.reduce((a, r) => a + r.tgt, 0);
  const salesPct = periodTgt > 0 ? (periodSales / periodTgt) * 100 : 0;
  const sortedByPct = [...perOutlet].filter((r) => r.tgt > 0 && r.sales > 0).sort((a, b) => a.pct - b.pct);
  const drag = sortedByPct[0], hero = sortedByPct[sortedByPct.length - 1];
  const ideas: string[] = [];
  const notFiling = acct.filter((a) => a.filed === 0);
  if (notFiling.length >= 2) ideas.push(`${notFiling.length} people filed nothing this period — reporting discipline is slipping.`);
  else if (notFiling.length === 1) ideas.push(`${notFiling[0].name} filed nothing this period — worth a follow-up.`);
  if (periodTgt > 0 && salesPct < 90) ideas.push(`Sales are at ${salesPct.toFixed(0)}% of target for this period.`);
  if (drag && drag.pct < 40) ideas.push(`${drag.name} is badly behind (${drag.pct.toFixed(0)}% of target) for this period.`);
  if (hero && hero.pct >= 90) ideas.push(`${hero.name} is doing great (${hero.pct.toFixed(0)}%) this period.`);
  if (ideas.length === 0) ideas.push(`Everything looks healthy for this period. 🎉`);
  return { days, acct, perOutlet, periodSales, periodTgt, salesPct, drag, hero, ideas };
}
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

function parseMoney(raw: string): number | null {
  const s = (raw || "").replace(/\*/g, "").replace(/₹/g, "").replace(/,/g, "").trim();
  if (!s || /negligible/i.test(s) || /^[-—\s]+$/.test(s)) return null;
  const m = s.match(/([\d.]+)\s*(cr|crore|l|lakh|k)?/i);
  if (!m) return null;
  let v = parseFloat(m[1]); if (isNaN(v)) return null;
  const u = (m[2] || "").toLowerCase();
  if (u === "cr" || u === "crore") v *= 1e7; else if (u === "l" || u === "lakh") v *= 1e5; else if (u === "k") v *= 1e3;
  return Math.round(v);
}
function parseAreaTable(text: string): { rows: { area: string; competitor: string; their: number | null; our: number | null }[] } | null {
  const lines = (text || "").split("\n").map(l => l.trim()).filter(l => l.startsWith("|"));
  if (lines.length < 2) return null;
  const cells = (l: string) => l.split("|").slice(1, -1).map(c => c.trim());
  const header = cells(lines[0]);
  const norm = header.map(h => h.replace(/\*/g, "").toLowerCase().trim());
  const areaIdx = norm.findIndex(h => h.includes("area") || h.includes("locality"));
  const ourIdx = norm.findIndex(h => h.includes("brownie heaven") || h === "bh" || h === "ours" || h === "us");
  if (areaIdx < 0 || ourIdx < 0) return null;
  const skip = /gap|note|verdict|diff|remark|rank|^$/i;
  const compCols = header.map((_, i) => i).filter(i => i !== areaIdx && i !== ourIdx && !skip.test(norm[i]));
  if (compCols.length === 0) return null;
  const nameOf = (i: number) => header[i].replace(/\*/g, "").replace(/gmv/i, "").trim() || "Unknown";
  const rows: { area: string; competitor: string; their: number | null; our: number | null }[] = [];
  for (let li = 1; li < lines.length; li++) {
    const c = cells(lines[li]);
    if (!c[areaIdx] || /^[-:\s]+$/.test(c[areaIdx])) continue;
    const area = c[areaIdx].replace(/\*/g, "").trim();
    if (!area) continue;
    const our = parseMoney(c[ourIdx] || "");
    for (const ci of compCols) {
      const their = parseMoney(c[ci] || "");
      if (their == null && our == null) continue;
      rows.push({ area, competitor: nameOf(ci), their, our });
    }
  }
  return rows.length ? { rows } : null;
}
function parseNum(raw: string): number | null {
  const s = (raw || "").replace(/[^0-9.]/g, "");
  if (!s) return null;
  const n = Math.round(parseFloat(s));
  return isNaN(n) ? null : n;
}
function parseProductTable(text: string): { product: string; gmv: number | null; orders: number | null; units: number | null; areas: number | null }[] | null {
  const lines = (text || "").split("\n").map(l => l.trim()).filter(l => l.startsWith("|"));
  if (lines.length < 2) return null;
  const cells = (l: string) => l.split("|").slice(1, -1).map(c => c.trim());
  const header = cells(lines[0]);
  const norm = header.map(h => h.replace(/\*/g, "").toLowerCase().trim());
  const pIdx = norm.findIndex(h => h.includes("product") || h.includes("item"));
  if (pIdx < 0) return null;
  const gIdx = norm.findIndex(h => h.includes("gmv") || h.includes("sales") || h.includes("value"));
  const oIdx = norm.findIndex(h => h.includes("order"));
  const uIdx = norm.findIndex(h => h.includes("unit"));
  const aIdx = norm.findIndex(h => h.includes("area"));
  const rows: { product: string; gmv: number | null; orders: number | null; units: number | null; areas: number | null }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = cells(lines[i]);
    const product = (c[pIdx] || "").replace(/\*/g, "").trim();
    if (!product || /^[-:\s]+$/.test(product)) continue;
    rows.push({ product, gmv: gIdx >= 0 ? parseMoney(c[gIdx] || "") : null, orders: oIdx >= 0 ? parseNum(c[oIdx] || "") : null, units: uIdx >= 0 ? parseNum(c[uIdx] || "") : null, areas: aIdx >= 0 ? parseNum(c[aIdx] || "") : null });
  }
  return rows.length ? rows : null;
}

export default function DashboardPage() {
    useActivityHeartbeat(typeof window !== "undefined" ? localStorage.getItem("tf_session_id") : null);
  const router = useRouter();
  const [user, setUser] = useState<Staff | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"tasks" | "my_report" | "all_reports" | "analytics" | "outlet_reports" | "owner_outlets" | "history" | "attendance" | "sales_target" | "payout" | "reconciliation" | "competition" | "item_perf" | "ceo_report" | "fines" | "niranjana_report" | "pnl" | "contribution_margins" | "net_realisation" | "cash_flow">("tasks");
  const RANGE_PRESETS = [
    { id: "yesterday", label: "Yesterday" },
    { id: "last7", label: "Last 7 days" },
    { id: "last30", label: "Last 30 days" },
    { id: "mtd", label: "Month to date" },
    { id: "lastmonth", label: "Last month" },
    { id: "custom", label: "Custom" },
  ];
  const [outletRangeSel, setOutletRangeSel] = useState<Record<string, { preset: string; from?: string; to?: string }>>({});
  const getOutletSel = (o: string) => outletRangeSel[o] || { preset: "last30" };
  const resolveOutletRange = (sel: { preset: string; from?: string; to?: string }): { from: string; to: string; label: string } => {
    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    if (sel.preset === "yesterday") { const y = new Date(today); y.setDate(y.getDate() - 1); return { from: iso(y), to: iso(y), label: "Yesterday" }; }
    if (sel.preset === "last7") { const f = new Date(today); f.setDate(f.getDate() - 6); return { from: iso(f), to: iso(today), label: "Last 7 days" }; }
    if (sel.preset === "last30") { const f = new Date(today); f.setDate(f.getDate() - 29); return { from: iso(f), to: iso(today), label: "Last 30 days" }; }
    if (sel.preset === "mtd") { const f = new Date(today.getFullYear(), today.getMonth(), 1); return { from: iso(f), to: iso(today), label: "Month to date" }; }
    if (sel.preset === "lastmonth") { const f = new Date(today.getFullYear(), today.getMonth() - 1, 1); const t = new Date(today.getFullYear(), today.getMonth(), 0); return { from: iso(f), to: iso(t), label: "Last month" }; }
    const f = sel.from || iso(today), t = sel.to || iso(today);
    return { from: f, to: t, label: `${f} → ${t}` };
  };
  const fetchPerOutletReports = async (outlets: string[]) => {
    const results = await Promise.all(outlets.map(async (o) => {
      const r = resolveOutletRange(getOutletSel(o));
      const { data } = await supabase.from("outlet_reports").select("*").eq("outlet_id", o).gte("report_date", r.from).lte("report_date", r.to).order("report_date", { ascending: true });
      return (data || []).map((row: any) => ({ ...row, _rangeLabel: r.label }));
    }));
    return results.flat();
  };
  const buildRangeRows = (rows: any[]) => rows.map(r => {
    const shop = Number(r.shop_sales_value) || 0, sw = Number(r.swiggy_sales_value) || 0, zo = Number(r.zomato_sales_value) || 0;
    return { Date: r.report_date, Outlet: (typeof OUTLET_NAMES !== "undefined" ? (OUTLET_NAMES as any)[r.outlet_id] : r.outlet_id) || r.outlet_id, RangeLabel: r._rangeLabel || "", Shop: shop, Swiggy: sw, Zomato: zo, Total: shop + sw + zo, "Shop Orders": Number(r.shop_sales_count) || 0, "Swiggy Orders": Number(r.swiggy_sales_count) || 0, "Zomato Orders": Number(r.zomato_sales_count) || 0, Target: Number(r.target) || 0, Discount: Number(r.discount_given) || 0, Late: r.is_late ? "Yes" : "No", Issues: r.issues || "" };
  });
  const downloadRangeExcel = async () => {
    setRepBusy(true);
    try {
      const targetOutlets = repOutlets.length ? repOutlets : (canAssign ? OUTLETS : (user?.outlets || []));
      const rows = await fetchPerOutletReports(targetOutlets);
      if (rows.length === 0) { alert("No reports found for the chosen range(s)/outlets."); setRepBusy(false); return; }
      const data = buildRangeRows(rows);
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "Daily Rows");
      const byOutlet: Record<string, any> = {};
      data.forEach(d => { const k = d.Outlet; if (!byOutlet[k]) byOutlet[k] = { Outlet: k, Range: d.RangeLabel, Days: 0, Shop: 0, Swiggy: 0, Zomato: 0, Total: 0 }; byOutlet[k].Days++; byOutlet[k].Shop += d.Shop; byOutlet[k].Swiggy += d.Swiggy; byOutlet[k].Zomato += d.Zomato; byOutlet[k].Total += d.Total; });
      const summary = Object.values(byOutlet).map((s: any) => ({ ...s, "Avg/Day": Math.round(s.Total / s.Days) }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Summary");
     XLSX.writeFile(wb, `OutletReports_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e: any) { alert("Export failed: " + (e?.message || "error")); }
    setRepBusy(false);
  };
  const loadH2P = (): Promise<any> => new Promise((res, rej) => { const w = window as any; if (w.html2pdf) return res(w.html2pdf); const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"; s.onload = () => res((window as any).html2pdf); s.onerror = () => rej(new Error("pdf lib failed")); document.body.appendChild(s); });
 const downloadRangePDF = async () => {
    setRepBusy(true);
    window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 50));
    let h2p: any; try { h2p = await loadH2P(); } catch { alert("Could not load the PDF tool."); setRepBusy(false); return; }
    try {
      const targetOutlets = repOutlets.length ? repOutlets : (canAssign ? OUTLETS : (user?.outlets || []));
      const rows = await fetchPerOutletReports(targetOutlets);
      if (rows.length === 0) { alert("No reports found for the chosen range(s)/outlets."); setRepBusy(false); return; }
      const data = buildRangeRows(rows);
      const rs = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
      const _ym = new Date().toISOString().slice(0, 7);
      const TGT_BY_NAME: Record<string, number> = {};
      const MTGT_BY_NAME: Record<string, number> = {};
      Object.keys(MONTHLY_BASE).forEach(oid => { const nm = (OUTLET_NAMES as any)[oid] || oid; MTGT_BY_NAME[nm] = monthlyTargetFor(oid, _ym); TGT_BY_NAME[nm] = dailyTargetFor(oid, _ym); });
      const dayTgt = (d: any) => (TGT_BY_NAME[d.Outlet] || 0);
      const pctCol = (pc: number) => pc >= 100 ? C.green : (pc >= 60 ? C.gold : C.red);
      const byO: Record<string, any> = {};
      data.forEach(d => { if (!byO[d.Outlet]) byO[d.Outlet] = { Outlet: d.Outlet, Range: d.RangeLabel, Days: 0, Shop: 0, Swiggy: 0, Zomato: 0, Total: 0, Target: 0, Discount: 0 }; const b = byO[d.Outlet]; b.Days++; b.Shop += d.Shop; b.Swiggy += d.Swiggy; b.Zomato += d.Zomato; b.Total += d.Total; b.Discount += (d.Discount || 0); });
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
      const _pm = new Date(); const daysInMonth = new Date(_pm.getFullYear(), _pm.getMonth() + 1, 0).getDate();
      const gPerDay = summ.length > 0 ? summ.reduce((a: number, s: any) => a + avgPerDay(s), 0) : 0;
      const gVerdict = gPerDay >= 80000 * summ.length ? "🎉 Money machine go brrr! We're cooking 🧑‍🍳" : gPerDay >= 40000 * Math.max(summ.length, 1) ? "😎 Solid month, brownies are selling 🍫" : "😅 Could be tastier — let's hustle next month 💸";
      const sumRows = summ.map(s => { const [emo] = comment(avgPerDay(s));const stgt = MTGT_BY_NAME[s.Outlet] || 0; const proj = s.Days > 1 ? Math.round(s.Total / (s.Days - 1) * daysInMonth) : s.Total; const dpc = s.Total > 0 ? (s.Discount / s.Total) * 100 : 0; return `<tr><td style="padding:7px 10px;border-bottom:1px solid ${C.line};font-weight:600;color:${C.ink};font-size:12px">${emo} ${s.Outlet}<br/><span style="font-size:9px;font-weight:400;color:${C.soft}">${s.Range}</span></td><td style="padding:7px 10px;border-bottom:1px solid ${C.line};text-align:right;font-size:12px;color:${C.soft}">${s.Days}</td><td style="padding:7px 10px;border-bottom:1px solid ${C.line};text-align:right;font-size:12px;color:${C.soft}">${rs(s.Shop)}</td><td style="padding:7px 10px;border-bottom:1px solid ${C.line};text-align:right;font-size:12px;color:${C.soft}">${rs(s.Swiggy)}</td><td style="padding:7px 10px;border-bottom:1px solid ${C.line};text-align:right;font-size:12px;color:${C.soft}">${rs(s.Zomato)}</td><td style="padding:7px 10px;border-bottom:1px solid ${C.line};text-align:right;font-weight:800;color:${C.ink};font-size:12px">${rs(s.Total)}</td><td style="padding:7px 10px;border-bottom:1px solid ${C.line};text-align:right;font-size:12px;color:${C.soft}">${stgt > 0 ? rs(stgt) : "-"}</td><td style="padding:7px 10px;border-bottom:1px solid ${C.line};text-align:right;font-size:12px;font-weight:800;color:${stgt > 0 ? pctCol((s.Total / stgt) * 100) : C.soft}">${stgt > 0 ? ((s.Total / stgt) * 100).toFixed(0) + "%" : "-"}</td><td style="padding:7px 10px;border-bottom:1px solid ${C.line};text-align:right;font-weight:700;font-size:12px;color:${stgt > 0 ? pctCol((proj / stgt) * 100) : C.ink}">${rs(proj)}</td><td style="padding:7px 10px;border-bottom:1px solid ${C.line};text-align:right;font-size:12px;font-weight:700;color:${dpc >= 15 ? C.red : dpc >= 8 ? C.gold : C.ink}">${s.Discount > 0 ? dpc.toFixed(1) + "%" : "-"}</td><td style="padding:7px 10px;border-bottom:1px solid ${C.line};text-align:right;font-size:12px;color:${C.soft}">${s.Discount > 0 ? rs(s.Discount) : "-"}</td><td style="padding:7px 10px;border-bottom:1px solid ${C.line};text-align:right;font-size:12px;color:${C.ink}">${rs(Math.max(0, s.Total - s.Discount) * 0.05)}</td></tr>`; }).join("");
      const gT = summ.reduce((a: any, s: any) => { const stgt = MTGT_BY_NAME[s.Outlet] || 0; const proj = s.Days > 1 ? Math.round(s.Total / (s.Days - 1) * daysInMonth) : s.Total; a.Shop += s.Shop; a.Swiggy += s.Swiggy; a.Zomato += s.Zomato; a.Total += s.Total; a.Target += stgt; a.Proj += proj; a.Disc += (s.Discount || 0); return a; }, { Shop: 0, Swiggy: 0, Zomato: 0, Total: 0, Target: 0, Proj: 0, Disc: 0 });
      const totalRow = `<tr style="background:${C.line};border-top:2px solid ${C.ink}"><td style="padding:9px 10px;color:${C.ink};font-size:12px;font-weight:900">TOTAL</td><td style="padding:9px 10px;text-align:right;color:${C.soft};font-size:12px">—</td><td style="padding:9px 10px;text-align:right;color:${C.ink};font-size:12px;font-weight:700">${rs(gT.Shop)}</td><td style="padding:9px 10px;text-align:right;color:${C.ink};font-size:12px;font-weight:700">${rs(gT.Swiggy)}</td><td style="padding:9px 10px;text-align:right;color:${C.ink};font-size:12px;font-weight:700">${rs(gT.Zomato)}</td><td style="padding:9px 10px;text-align:right;color:${C.ink};font-size:13px;font-weight:900">${rs(gT.Total)}</td><td style="padding:9px 10px;text-align:right;color:${C.ink};font-size:12px;font-weight:700">${rs(gT.Target)}</td><td style="padding:9px 10px;text-align:right;font-size:12px;font-weight:900;color:${gT.Target > 0 ? pctCol((gT.Total / gT.Target) * 100) : C.soft}">${gT.Target > 0 ? ((gT.Total / gT.Target) * 100).toFixed(0) + "%" : "-"}</td><td style="padding:9px 10px;text-align:right;color:${C.ink};font-size:13px;font-weight:900">${rs(gT.Proj)}</td><td style="padding:9px 10px;text-align:right;color:${C.ink};font-size:12px;font-weight:700">${gT.Total > 0 ? ((gT.Disc / gT.Total) * 100).toFixed(1) + "%" : "-"}</td><td style="padding:9px 10px;text-align:right;color:${C.ink};font-size:12px;font-weight:700">${rs(gT.Disc)}</td><td style="padding:9px 10px;text-align:right;color:${C.ink};font-size:12px;font-weight:900">${rs(Math.max(0, gT.Total - gT.Disc) * 0.05)}</td></tr>`;
      const noteCards = summ.map(s => { const [emo, msg, col] = comment(avgPerDay(s)); return `<div style="display:flex;align-items:center;gap:8px;background:${C.card};border:1px solid ${C.line};border-left:4px solid ${col};border-radius:8px;padding:8px 12px;margin-bottom:7px"><span style="font-size:18px">${emo}</span><span style="font-size:12px;color:${C.ink};font-weight:600;min-width:120px">${s.Outlet}</span><span style="font-size:12px;color:${col};font-style:italic">${msg}</span></div>`; }).join("");
      const dayRowHtml = (d: any) => `<tr><td style="padding:5px 8px;border-bottom:1px solid ${C.line};font-size:10px;color:${C.soft}">${d.Date}</td><td style="padding:5px 8px;border-bottom:1px solid ${C.line};text-align:right;font-size:10px;color:${C.soft}">${rs(d.Shop)}</td><td style="padding:5px 8px;border-bottom:1px solid ${C.line};text-align:right;font-size:10px;color:${C.soft}">${rs(d.Swiggy)}</td><td style="padding:5px 8px;border-bottom:1px solid ${C.line};text-align:right;font-size:10px;color:${C.soft}">${rs(d.Zomato)}</td><td style="padding:5px 8px;border-bottom:1px solid ${C.line};text-align:right;font-weight:700;color:${C.ink};font-size:10px">${rs(d.Total)}</td><td style="padding:5px 8px;border-bottom:1px solid ${C.line};text-align:right;font-size:10px;color:${C.soft}">${dayTgt(d) > 0 ? rs(dayTgt(d)) : "-"}</td><td style="padding:5px 8px;border-bottom:1px solid ${C.line};text-align:right;font-size:10px;font-weight:700;color:${dayTgt(d) > 0 ? pctCol((d.Total / dayTgt(d)) * 100) : C.soft}">${dayTgt(d) > 0 ? ((d.Total / dayTgt(d)) * 100).toFixed(0) + "%" : "-"}</td></tr>`;
      const dayTablesByOutlet = summ.map((s: any) => {
        const outletRows = [...data].filter((d: any) => d.Outlet === s.Outlet).sort((a: any, b: any) => (a.Date as string).localeCompare(b.Date));
        return `<div style="margin-bottom:16px;page-break-inside:avoid"><div style="font-size:12px;font-weight:800;margin:8px 0 4px;color:${C.ink}">${s.Outlet} — ${s.Range}</div><table style="width:100%;border-collapse:collapse;background:${C.card};border:1px solid ${C.line};border-radius:10px;overflow:hidden"><thead><tr style="background:${C.ink}"><th style="padding:6px 8px;text-align:left;color:#FFF6E5;font-size:9px">DATE</th><th style="padding:6px 8px;text-align:right;color:#FFF6E5;font-size:9px">SHOP</th><th style="padding:6px 8px;text-align:right;color:#FFF6E5;font-size:9px">SWIGGY</th><th style="padding:6px 8px;text-align:right;color:#FFF6E5;font-size:9px">ZOMATO</th><th style="padding:6px 8px;text-align:right;color:#FFF6E5;font-size:9px">TOTAL</th><th style="padding:6px 8px;text-align:right;color:#FFF6E5;font-size:9px">TARGET</th><th style="padding:6px 8px;text-align:right;color:#FFF6E5;font-size:9px">%</th></tr></thead><tbody>${outletRows.map(dayRowHtml).join("")}</tbody></table></div>`;
      }).join("");
      const html = `<div style="width:1120px;background:${C.bg};font-family:'Segoe UI',Arial,sans-serif;color:${C.ink}">
        <div style="background:linear-gradient(135deg,${C.ink},#5C3A22);padding:22px 32px">
          <div style="font-size:22px;font-weight:800;color:#FFF6E5">🍫 Brownie Heaven — Outlet Reports</div>
          <div style="font-size:12px;color:#E0A52E;letter-spacing:1px">📅 Custom per-outlet ranges · ${repOutlets.length ? repOutlets.length + " outlet(s)" : "all outlets"}</div>
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
            <thead><tr style="background:${C.ink}"><th style="padding:8px 10px;text-align:left;color:#FFF6E5;font-size:10px">OUTLET</th><th style="padding:8px 10px;text-align:right;color:#FFF6E5;font-size:10px">DAYS</th><th style="padding:8px 10px;text-align:right;color:#FFF6E5;font-size:10px">SHOP</th><th style="padding:8px 10px;text-align:right;color:#FFF6E5;font-size:10px">SWIGGY</th><th style="padding:8px 10px;text-align:right;color:#FFF6E5;font-size:10px">ZOMATO</th><th style="padding:8px 10px;text-align:right;color:#FFF6E5;font-size:10px">TOTAL</th><th style="padding:8px 10px;text-align:right;color:#FFF6E5;font-size:10px">TARGET</th><th style="padding:8px 10px;text-align:right;color:#FFF6E5;font-size:10px">%</th><th style="padding:8px 10px;text-align:right;color:#FFF6E5;font-size:10px">PROJECTION</th><th style="padding:8px 10px;text-align:right;color:#FFF6E5;font-size:10px">DISC %</th><th style="padding:8px 10px;text-align:right;color:#FFF6E5;font-size:10px">DISCOUNT</th><th style="padding:8px 10px;text-align:right;color:#FFF6E5;font-size:10px">TAXES</th></tr></thead>
       <tbody>${sumRows}${totalRow}</tbody>
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
            <div style="display:flex;gap:18px;align-items:flex-start;margin:18px 0;page-break-inside:avoid">
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
          <div style="background:${C.card};border:1px solid ${C.line};border-radius:12px;padding:16px 18px;margin-bottom:18px;page-break-inside:avoid">
            ${bars}
            <div style="margin-top:10px;font-size:12px;color:${C.ink};font-weight:700">🏆 Best: ${full[DOW[bestI]]} (${rs(avg[bestI])}/day) &nbsp;·&nbsp; 😴 Slowest: ${full[DOW[worstI]]} (${rs(avg[worstI])}/day)</div>
            <div style="font-size:11px;color:${C.soft};font-style:italic;margin-top:4px">${quip}</div>
          </div>
          <div style="font-size:13px;font-weight:800;margin:4px 0 8px;color:${C.ink}">💬 The honest verdict 👀</div>
          ${noteCards}`;
          })()}
          <div style="font-size:15px;font-weight:800;margin:18px 0 10px">🎯 Monthly targets by brand</div>
          <table style="width:100%;border-collapse:collapse;background:${C.card};border:1px solid ${C.line};border-radius:12px;overflow:hidden">
            <thead><tr style="background:${C.ink}"><th style="padding:7px 8px;text-align:left;color:#FFF6E5;font-size:9px">OUTLET</th><th style="padding:7px 8px;text-align:right;color:#FFF6E5;font-size:9px">BH</th><th style="padding:7px 8px;text-align:right;color:#FFF6E5;font-size:9px">CBH</th><th style="padding:7px 8px;text-align:right;color:#FFF6E5;font-size:9px">ICBH</th><th style="padding:7px 8px;text-align:right;color:#FFF6E5;font-size:9px">MONTHLY</th><th style="padding:7px 8px;text-align:right;color:#FFF6E5;font-size:9px">DAILY</th></tr></thead>
            <tbody>${OUTLETS.map((o) => { const bt = (BRAND_TARGETS as any)[o]; const daily = parseFloat(OUTLET_TARGETS[o] || "0") || 0; const monthly = bt ? bt.total : daily * 30; const nm = (OUTLET_NAMES as any)[o] || o; return `<tr><td style="padding:5px 8px;border-bottom:1px solid ${C.line};font-size:10px;color:${C.ink}">${nm}</td><td style="padding:5px 8px;border-bottom:1px solid ${C.line};text-align:right;font-size:10px;color:${C.soft}">${bt ? rs(bt.bh) : "-"}</td><td style="padding:5px 8px;border-bottom:1px solid ${C.line};text-align:right;font-size:10px;color:${C.soft}">${bt ? rs(bt.cbh) : "-"}</td><td style="padding:5px 8px;border-bottom:1px solid ${C.line};text-align:right;font-size:10px;color:${C.soft}">${bt && bt.icbh ? rs(bt.icbh) : "-"}</td><td style="padding:5px 8px;border-bottom:1px solid ${C.line};text-align:right;font-size:10px;font-weight:700;color:${C.ink}">${rs(monthly)}</td><td style="padding:5px 8px;border-bottom:1px solid ${C.line};text-align:right;font-size:10px;color:${C.soft}">${rs(daily)}</td></tr>`; }).join("")}</tbody>
          </table>
          <div style="font-size:9px;color:${C.soft};margin:6px 2px 0">BH = Brownie Heaven · CBH = Cakes by Brownie Heaven · ICBH = Ice Creams by Brownie Heaven. Vadapalani & Besant Nagar pending official brand split — showing current default.</div>
          <div style="font-size:15px;font-weight:800;margin:18px 0 10px">🗓️ Daily detail — by outlet's own range</div>
          ${dayTablesByOutlet}
          <div style="text-align:center;font-size:10px;color:${C.soft};margin-top:18px">🍫 Brownie Heaven · generated ${new Date().toISOString().slice(0, 10)}</div>
        </div></div>`;
      const holder = document.createElement("div"); holder.style.position = "fixed"; holder.style.left = "-9999px"; holder.innerHTML = html; document.body.appendChild(holder);
      try { await h2p().set({ margin: 0, filename: `OutletReports_${new Date().toISOString().slice(0, 10)}.pdf`, image: { type: "jpeg", quality: 0.97 }, html2canvas: { scale: 2, backgroundColor: "#FAF3E7" }, jsPDF: { unit: "pt", format: "a4", orientation: "landscape" }, pagebreak: { mode: ["css", "legacy"] } }).from(holder.firstElementChild).save(); }
      finally { document.body.removeChild(holder); }
    } catch (e: any) { alert("Export failed: " + (e?.message || "error")); }
    setRepBusy(false);
  };
  const [expandedOutlet, setExpandedOutlet] = useState<string | null>(null);
  const _today = new Date().toISOString().split("T")[0];
  const _mStart = _today.slice(0, 8) + "01";
  const [repOutlets, setRepOutlets] = useState<string[]>([]);
  const [repQuickRange, setRepQuickRange] = useState("last30");
  const [repQuickFrom, setRepQuickFrom] = useState("");
  const [repQuickTo, setRepQuickTo] = useState("");
  const [repCustomizePerOutlet, setRepCustomizePerOutlet] = useState(false);
  const activeRepOutlets = () => repOutlets.length ? repOutlets : (canAssign ? OUTLETS : (user?.outlets || []));
  const applyQuickRange = (presetId: string) => {
    setRepQuickRange(presetId);
    const updated = { ...outletRangeSel };
    activeRepOutlets().forEach((o) => { updated[o] = presetId === "custom" ? { preset: "custom", from: repQuickFrom, to: repQuickTo } : { preset: presetId }; });
    setOutletRangeSel(updated);
  };
  const applyQuickCustom = (from: string, to: string) => {
    setRepQuickFrom(from); setRepQuickTo(to);
    const updated = { ...outletRangeSel };
    activeRepOutlets().forEach((o) => { updated[o] = { preset: "custom", from, to }; });
    setOutletRangeSel(updated);
  };
  useEffect(() => {
    if (repCustomizePerOutlet) return;
    const updated = { ...outletRangeSel };
    let changed = false;
    activeRepOutlets().forEach((o) => { if (!updated[o]) { updated[o] = repQuickRange === "custom" ? { preset: "custom", from: repQuickFrom, to: repQuickTo } : { preset: repQuickRange }; changed = true; } });
    if (changed) setOutletRangeSel(updated);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [repOutlets]);
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
  const [outletHealthData, setOutletHealthData] = useState<any[]>([]);
  const [outletHealthLoading, setOutletHealthLoading] = useState(false);
  const [outletHealthSel, setOutletHealthSel] = useState(OUTLETS[0]);
  const [outletHealthPdfBusy, setOutletHealthPdfBusy] = useState(false);
  const [scoreRows, setScoreRows] = useState<ScoreRow[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    computeScores().then((res) => { if (!cancelled) { setScoreRows(res.rows); } }).catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  const [compRows, setCompRows] = useState<any[]>([]);
  const [compSaving, setCompSaving] = useState(false);
  const [compForm, setCompForm] = useState({ competitor: "", area: "", address: "", sales_value: "", our_sales: "", our_outlet_id: "", period_label: "", period_date: new Date().toISOString().slice(0, 10), note: "" });
  const [compPaste, setCompPaste] = useState("");
  const [compPasteComp, setCompPasteComp] = useState("");
  const [compPasteLabel, setCompPasteLabel] = useState("");
  const [compPasteDate, setCompPasteDate] = useState(new Date().toISOString().slice(0, 10));
  const [compParsed, setCompParsed] = useState<{ area: string; competitor: string; their: number | null; our: number | null }[] | null>(null);
  const [compSavingBulk, setCompSavingBulk] = useState(false);
  const [compView, setCompView] = useState<"entry" | "products" | "insights">("entry");
  const [prodSide, setProdSide] = useState<"them" | "us">("them");
  const [prodComp, setProdComp] = useState("");
  const [prodLabel, setProdLabel] = useState("");
  const [prodDate, setProdDate] = useState(new Date().toISOString().slice(0, 10));
  const [prodPaste, setProdPaste] = useState("");
  const [prodParsed, setProdParsed] = useState<{ product: string; gmv: number | null; orders: number | null; units: number | null; areas: number | null }[] | null>(null);
  const [prodSaving, setProdSaving] = useState(false);
  const [compProducts, setCompProducts] = useState<any[]>([]);
  const [compHeadlineOn, setCompHeadlineOn] = useState(true);
  const [fineStaff, setFineStaff] = useState<string[]>([]);
  const [fineReason, setFineReason] = useState("1-star review");
  const [fineAmount, setFineAmount] = useState("50");
  const [fineDate, setFineDate] = useState(new Date().toISOString().split("T")[0]);
  const [fineOutlet, setFineOutlet] = useState("");
  const [fines, setFines] = useState<any[]>([]);
  const [fineBusy, setFineBusy] = useState(false);
  const fetchFines = async () => { const { data } = await supabase.from("fines").select("*").order("created_at", { ascending: false }).limit(50); setFines(data || []); };
  const saveFine = async () => {
    if (fineStaff.length === 0) { alert("Pick at least one person to fine."); return; }
    const amt = Number(fineAmount) || 0;
    setFineBusy(true);
    for (const sid of fineStaff) {
      const st = (ALL_STAFF as any[]).find((x) => x.id === sid);
      await supabase.from("fines").insert({ staff_id: sid, staff_name: st?.name || sid, reason: fineReason.trim() || null, amount: amt, outlet: fineOutlet || null, fine_date: fineDate, entered_by: user?.id || null });
      await supabase.from("point_adjustments").insert({ staff_id: sid, points: -amt, reason: `Fine: ${fineReason.trim() || "review"}` });
    }
    setFineBusy(false);
    setFineStaff([]);
    fetchFines();
  };
  useEffect(() => { if (user && (user.role === "Owner" || user.role === "Manager" || user.role === "Founder's Office")) fetchFines(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user]);
   const [nrEntries, setNrEntries] = useState<any[]>([]);
  const [nrNewContent, setNrNewContent] = useState("");
  const [nrNewDate, setNrNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [nrSaving, setNrSaving] = useState(false);
  const fetchNrEntries = async () => { const { data } = await supabase.from("niranjana_log").select("*").order("entry_date", { ascending: false }); setNrEntries(data || []); };
  const saveNrEntry = async () => {
    if (!nrNewContent.trim()) { alert("Write something first."); return; }
    setNrSaving(true);
    const { error } = await supabase.from("niranjana_log").insert({ entry_date: nrNewDate, content: nrNewContent.trim() });
    setNrSaving(false);
    if (error) { alert("Save failed: " + error.message); return; }
    setNrNewContent("");
    fetchNrEntries();
  };
  useEffect(() => { if (activeTab === "niranjana_report") fetchNrEntries(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeTab]);
  const [pnlFrom, setPnlFrom] = useState<string>(() => new Date().toISOString().slice(0, 8) + "01");
  const [pnlTo, setPnlTo] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [pnlRows, setPnlRows] = useState<any[]>([]);
  const [pnlLoading, setPnlLoading] = useState(false);
  const [pnlExpanded, setPnlExpanded] = useState<string | null>(null);
  const fetchPnl = async () => {
    setPnlLoading(true);
    const { data: salesRows } = await supabase.from("outlet_reports").select("outlet_id, shop_sales_value, swiggy_sales_value, zomato_sales_value").gte("report_date", pnlFrom).lte("report_date", pnlTo);
    const { data: targetRows } = await supabase.from("sales_target").select("outlet_id, brand, line_items").eq("brand", "BH");
       const fixedByOutlet: Record<string, any> = {};
    (targetRows || []).forEach((t: any) => {
      const f = t.line_items?.fixed || {};
      const ab = (v: any) => Math.abs(Number(v) || 0);
      const staff = ab(f.staff), rent = ab(f.rent), eb = ab(f.eb), transport = ab(f.transport), rm = 0.2 * rent, pest = ab(f.pest), water = ab(f.water), airtel = ab(f.airtel);
      fixedByOutlet[t.outlet_id] = { staff, rent, eb, transport, rm, pest, water, airtel, total: staff + rent + eb + transport + rm + pest + water + airtel };
    });
    const byOutlet: Record<string, { shop: number; swiggy: number; zomato: number }> = {};
    (salesRows || []).forEach((r: any) => {
      if (!byOutlet[r.outlet_id]) byOutlet[r.outlet_id] = { shop: 0, swiggy: 0, zomato: 0 };
      byOutlet[r.outlet_id].shop += Number(r.shop_sales_value) || 0;
      byOutlet[r.outlet_id].swiggy += Number(r.swiggy_sales_value) || 0;
      byOutlet[r.outlet_id].zomato += Number(r.zomato_sales_value) || 0;
    });
    const rows = OUTLETS.filter((o) => byOutlet[o]).map((o) => {
      const b = byOutlet[o];
      const chan = (sales: number, isOnline: boolean) => {
        const cogs = sales * 0.294;
        const wastage = sales * 0.05;
        const commission = isOnline ? sales * 0.5 : 0;
        const contrib = sales - cogs - wastage - commission;
        return { sales, cogs, wastage, commission, contrib, margin: sales > 0 ? (contrib / sales) * 100 : 0 };
      };
      const shop = chan(b.shop, false), swiggy = chan(b.swiggy, true), zomato = chan(b.zomato, true);
      const totalSales = b.shop + b.swiggy + b.zomato;
      const totalContrib = shop.contrib + swiggy.contrib + zomato.contrib;
           const fixedBreakdown = fixedByOutlet[o] || { staff: 0, rent: 0, eb: 0, transport: 0, rm: 0, pest: 0, water: 0, airtel: 0, total: 0 };
      const fixed = fixedBreakdown.total;
      const netProfit = totalContrib - fixed;
      return { oid: o, name: OUTLET_NAMES[o] || o, shop, swiggy, zomato, totalSales, totalContrib, fixed, fixedBreakdown, netProfit, netMargin: totalSales > 0 ? (netProfit / totalSales) * 100 : 0 };
    });
    setPnlRows(rows);
    setPnlLoading(false);
  };
   useEffect(() => { if (activeTab === "tasks" && user?.role === "Financial Analyst") fetchPnl(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeTab, user, pnlFrom, pnlTo]);
  const [cfWeeks, setCfWeeks] = useState<any[]>([]);
  const [cfLoading, setCfLoading] = useState(false);
  const fetchCashFlowForecast = async () => {
    setCfLoading(true);
    const today = new Date();
    const start = new Date(today); start.setDate(start.getDate() - 42); // last 6 weeks of history
    const { data: salesRows } = await supabase.from("outlet_reports").select("report_date, shop_sales_value, swiggy_sales_value, zomato_sales_value").gte("report_date", start.toISOString().slice(0, 10));
    const { data: targetRows } = await supabase.from("sales_target").select("outlet_id, line_items").eq("brand", "BH");
    let totalWeeklyFixed = 0;
    (targetRows || []).forEach((t: any) => {
      const f = t.line_items?.fixed || {};
      const ab = (v: any) => Math.abs(Number(v) || 0);
      const monthly = ab(f.staff) + ab(f.rent) + ab(f.eb) + ab(f.transport) + 0.2 * ab(f.rent) + ab(f.pest) + ab(f.water) + ab(f.airtel);
      totalWeeklyFixed += monthly / 4.33;
    });
    // bucket historical sales into weeks (Mon-Sun) for a trend
    const weekOf = (d: Date) => { const x = new Date(d); const day = x.getDay() || 7; x.setDate(x.getDate() - day + 1); return x.toISOString().slice(0, 10); };
    const byWeek: Record<string, number> = {};
    (salesRows || []).forEach((r: any) => {
      const wk = weekOf(new Date(r.report_date));
      const total = (Number(r.shop_sales_value) || 0) + (Number(r.swiggy_sales_value) || 0) + (Number(r.zomato_sales_value) || 0);
      byWeek[wk] = (byWeek[wk] || 0) + total;
    });
    const weekKeys = Object.keys(byWeek).sort();
    const recentWeeks = weekKeys.slice(-5, -1); // exclude current partial week
    const avgWeeklySales = recentWeeks.length ? recentWeeks.reduce((a, k) => a + byWeek[k], 0) / recentWeeks.length : 0;
    // build history rows + 4 forecast weeks
    const historyRows = weekKeys.slice(-5).map((k) => ({ week: k, sales: byWeek[k], fixed: totalWeeklyFixed, net: byWeek[k] - totalWeeklyFixed, isForecast: false }));
    const forecastRows: any[] = [];
    let lastMonday = new Date(weekOf(today));
    for (let i = 1; i <= 4; i++) {
      const wk = new Date(lastMonday); wk.setDate(wk.getDate() + i * 7);
      forecastRows.push({ week: wk.toISOString().slice(0, 10), sales: avgWeeklySales, fixed: totalWeeklyFixed, net: avgWeeklySales - totalWeeklyFixed, isForecast: true });
    }
    setCfWeeks([...historyRows, ...forecastRows]);
    setCfLoading(false);
  };
  useEffect(() => { if (activeTab === "cash_flow") fetchCashFlowForecast(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeTab]);
  const [nrFrom, setNrFrom] = useState<string>(() => { const d = new Date(); d.setDate(d.getDate() - 60); return d.toISOString().slice(0, 10); });
  const [nrTo, setNrTo] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [nrRows, setNrRows] = useState<any[]>([]);
  const [nrLoading, setNrLoading] = useState(false);
  const fetchNetRealisation = async () => {
    setNrLoading(true);
    const { data: payouts } = await supabase.from("outlet_payouts").select("*").gte("period_start", nrFrom).lte("period_end", nrTo);
    const { data: repRows } = await supabase.from("outlet_reports").select("outlet_id, report_date, zomato_sales_value").gte("report_date", nrFrom).lte("report_date", nrTo);
    const rows = (payouts || []).map((p: any) => {
      if (p.platform === "swiggy") {
        const gross = Number(p.customer_payable) || 0;
        const net = Number(p.amount_transferable) || 0;
        return { outlet: OUTLET_NAMES[p.outlet_id] || p.outlet_id, platform: "Swiggy", periodStart: p.period_start, periodEnd: p.period_end, gross, net, pct: gross > 0 ? (net / gross) * 100 : null, verified: true };
      } else {
        const gross = (repRows || []).filter((r: any) => r.outlet_id === p.outlet_id && r.report_date >= p.period_start && r.report_date <= p.period_end).reduce((a: number, r: any) => a + (Number(r.zomato_sales_value) || 0), 0);
        const net = Number(p.net_payout) || 0;
        return { outlet: OUTLET_NAMES[p.outlet_id] || p.outlet_id, platform: "Zomato", periodStart: p.period_start, periodEnd: p.period_end, gross, net, pct: gross > 0 ? (net / gross) * 100 : null, verified: false };
      }
    }).sort((a: any, b: any) => (a.periodStart < b.periodStart ? 1 : -1));
    setNrRows(rows);
    setNrLoading(false);
  };
  useEffect(() => { if (activeTab === "net_realisation") fetchNetRealisation(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeTab, nrFrom, nrTo]);
  const [cmProductRows, setCmProductRows] = useState<any[]>([]);
  const [cmLoading, setCmLoading] = useState(false);
  const fetchContributionMargins = async () => {
    setCmLoading(true);
    const { data: latestUpload } = await supabase.from("item_perf_uploads").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!latestUpload) { setCmProductRows([]); setCmLoading(false); return; }
    const { data: rows } = await supabase.from("item_perf_rows").select("name, net_revenue, units_sold").eq("upload_id", latestUpload.id);
    const withMargin = (rows || []).map((r: any) => {
      const unitCost = (FOOD_COST_MAP as any)[r.name];
      const revenue = Number(r.net_revenue) || 0;
      const units = Number(r.units_sold) || 0;
      if (unitCost === undefined) return { name: r.name, revenue, units, cost: null, margin: null, marginPct: null };
      const cost = unitCost * units;
      const margin = revenue - cost;
      const marginPct = revenue > 0 ? (margin / revenue) * 100 : null;
      return { name: r.name, revenue, units, cost, margin, marginPct };
    });
    setCmProductRows(withMargin);
    setCmLoading(false);
  };
  useEffect(() => { if (activeTab === "tasks" && user?.role === "Financial Analyst") fetchContributionMargins(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeTab, user]);
  const [pnlPdfBusy, setPnlPdfBusy] = useState(false);
  const downloadPnlPDF = async () => {
    if (pnlRows.length === 0) { alert("No data to export for this range."); return; }
    setPnlPdfBusy(true);
    const C = { bg: "#FAF3E7", card: "#FFFDF8", ink: "#3E2415", soft: "#8A6A4A", line: "#EADBC2", green: "#2E7D32", red: "#C62828", amber: "#C8901E" };
    const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
    const totals = pnlRows.reduce((a, r) => ({ shop: a.shop + r.shop.sales, swiggy: a.swiggy + r.swiggy.sales, zomato: a.zomato + r.zomato.sales, sales: a.sales + r.totalSales, contrib: a.contrib + r.totalContrib, fixed: a.fixed + r.fixed, net: a.net + r.netProfit }), { shop: 0, swiggy: 0, zomato: 0, sales: 0, contrib: 0, fixed: 0, net: 0 });
    const rowsHtml = pnlRows.map((r) => `<tr><td style="padding:6px 8px;border-bottom:1px solid ${C.line};font-size:10px;font-weight:600">${r.name}</td><td style="padding:6px 8px;border-bottom:1px solid ${C.line};text-align:right;font-size:10px">${inr(r.shop.sales)}</td><td style="padding:6px 8px;border-bottom:1px solid ${C.line};text-align:right;font-size:10px">${inr(r.swiggy.sales)}</td><td style="padding:6px 8px;border-bottom:1px solid ${C.line};text-align:right;font-size:10px">${inr(r.zomato.sales)}</td><td style="padding:6px 8px;border-bottom:1px solid ${C.line};text-align:right;font-size:10px;font-weight:700">${inr(r.totalSales)}</td><td style="padding:6px 8px;border-bottom:1px solid ${C.line};text-align:right;font-size:10px;color:${C.soft}">${inr(r.totalContrib)}</td><td style="padding:6px 8px;border-bottom:1px solid ${C.line};text-align:right;font-size:10px;color:${C.soft}">${inr(r.fixed)}</td><td style="padding:6px 8px;border-bottom:1px solid ${C.line};text-align:right;font-size:10px;font-weight:700;color:${r.netProfit >= 0 ? C.green : C.red}">${inr(r.netProfit)}</td><td style="padding:6px 8px;border-bottom:1px solid ${C.line};text-align:right;font-size:10px;font-weight:700;color:${r.netMargin >= 0 ? C.green : C.red}">${r.netMargin.toFixed(1)}%</td></tr>`).join("");
    const totalRow = `<tr style="background:${C.line};border-top:2px solid ${C.ink}"><td style="padding:8px;font-size:10px;font-weight:900">TOTAL</td><td style="padding:8px;text-align:right;font-size:10px;font-weight:700">${inr(totals.shop)}</td><td style="padding:8px;text-align:right;font-size:10px;font-weight:700">${inr(totals.swiggy)}</td><td style="padding:8px;text-align:right;font-size:10px;font-weight:700">${inr(totals.zomato)}</td><td style="padding:8px;text-align:right;font-size:10px;font-weight:900">${inr(totals.sales)}</td><td style="padding:8px;text-align:right;font-size:10px;font-weight:700">${inr(totals.contrib)}</td><td style="padding:8px;text-align:right;font-size:10px;font-weight:700">${inr(totals.fixed)}</td><td style="padding:8px;text-align:right;font-size:10px;font-weight:900;color:${totals.net >= 0 ? C.green : C.red}">${inr(totals.net)}</td><td style="padding:8px;text-align:right;font-size:10px;font-weight:900;color:${totals.net >= 0 ? C.green : C.red}">${totals.sales > 0 ? ((totals.net / totals.sales) * 100).toFixed(1) + "%" : "-"}</td></tr>`;
    const html = `<div style="width:1000px;background:${C.bg};font-family:'Segoe UI',Arial,sans-serif;color:${C.ink};padding:34px"><div style="font-size:22px;font-weight:900">Brownie Heaven — Outlet &amp; Channel P&amp;L</div><div style="font-size:11px;color:${C.soft};margin-bottom:16px">${pnlFrom} to ${pnlTo} · real fixed costs from Sales Target · 29.4% COGS · 5% wastage · 50% online commission</div><table style="width:100%;border-collapse:collapse;background:${C.card};border:1px solid ${C.line};border-radius:10px;overflow:hidden"><thead><tr style="background:${C.ink}"><th style="padding:8px;text-align:left;color:#FFF6E5;font-size:9px">OUTLET</th><th style="padding:8px;text-align:right;color:#FFF6E5;font-size:9px">SHOP</th><th style="padding:8px;text-align:right;color:#FFF6E5;font-size:9px">SWIGGY</th><th style="padding:8px;text-align:right;color:#FFF6E5;font-size:9px">ZOMATO</th><th style="padding:8px;text-align:right;color:#FFF6E5;font-size:9px">TOTAL SALES</th><th style="padding:8px;text-align:right;color:#FFF6E5;font-size:9px">CONTRIBUTION</th><th style="padding:8px;text-align:right;color:#FFF6E5;font-size:9px">FIXED COSTS</th><th style="padding:8px;text-align:right;color:#FFF6E5;font-size:9px">NET PROFIT</th><th style="padding:8px;text-align:right;color:#FFF6E5;font-size:9px">NET %</th></tr></thead><tbody>${rowsHtml}${totalRow}</tbody></table><div style="font-size:9px;color:${C.soft};margin-top:12px">Generated ${new Date().toISOString().split("T")[0]}</div></div>`;
    const lib = await loadH2P();
    window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 50));
    const holder = document.createElement("div"); holder.style.position = "fixed"; holder.style.left = "-9999px"; holder.style.top = "0"; holder.innerHTML = html; document.body.appendChild(holder);
    try { await lib().set({ margin: 0, filename: `PnL_${pnlFrom}_to_${pnlTo}.pdf`, image: { type: "jpeg", quality: 0.97 }, html2canvas: { scale: 2, backgroundColor: C.bg }, jsPDF: { unit: "pt", format: "a4", orientation: "landscape" }, pagebreak: { mode: ["css", "legacy"] } }).from(holder.firstElementChild).save(); }
    finally { document.body.removeChild(holder); }
    setPnlPdfBusy(false);
  };
  const [ceoWin, setCeoWin] = useState("7");
  const [ceoRepRows, setCeoRepRows] = useState<any[]>([]);
  const [ceoMonthRep, setCeoMonthRep] = useState<any[]>([]);
  const [ceoPopupOpen, setCeoPopupOpen] = useState(false);
  const [unackedFines, setUnackedFines] = useState<any[]>([]);
  const [fineAckOpen, setFineAckOpen] = useState(false);
  const [fineAckBusy, setFineAckBusy] = useState(false);
  const [marginMonth, setMarginMonth] = useState("");
  const [marginMonths, setMarginMonths] = useState<string[]>([]);
  const [marginData, setMarginData] = useState<any[]>([]);
  const [marginLoading, setMarginLoading] = useState(false);
  const [ceoPushSending, setCeoPushSending] = useState(false);
  const [ceoCustomOpen, setCeoCustomOpen] = useState(false);
  const [ceoCustomFrom, setCeoCustomFrom] = useState("");
  const [ceoCustomTo, setCeoCustomTo] = useState("");
  const [ceoCustomOutlets, setCeoCustomOutlets] = useState<string[]>([]);
  const [ceoCustomBusy, setCeoCustomBusy] = useState(false);
  const [ipUploads, setIpUploads] = useState<any[]>([]);
  const [ipSel, setIpSel] = useState<string>("");
  const [ipRows, setIpRows] = useState<any[]>([]);
  const [ipParsed, setIpParsed] = useState<any[] | null>(null);
  const [ipLabel, setIpLabel] = useState("");
  const [ipDays, setIpDays] = useState("30");
  const [ipBusy, setIpBusy] = useState(false);
  const [ipView, setIpView] = useState<"insights" | "data">("insights");
  const [compPeriod, setCompPeriod] = useState("");
  const fetchCompRows = async () => {
    const { data } = await supabase.from("competitor_sales").select("*").order("period_date", { ascending: false }).order("created_at", { ascending: false });
    setCompRows(data || []);
  };
  const saveComp = async () => {
    if (!compForm.competitor.trim()) { alert("Competitor name is required"); return; }
    setCompSaving(true);
    const { error } = await supabase.from("competitor_sales").insert({ competitor: compForm.competitor.trim(), area: compForm.area.trim() || null, address: compForm.address.trim() || null, sales_value: compForm.sales_value ? Number(compForm.sales_value) : null, our_sales: compForm.our_sales ? Number(compForm.our_sales) : null, our_outlet_id: compForm.our_outlet_id || null, period_label: compForm.period_label.trim() || null, period_date: compForm.period_date, note: compForm.note.trim() || null, entered_by: user?.id || null });
    setCompSaving(false);
    if (error) { alert("Save failed: " + error.message); return; }
   setCompForm({ competitor: "", area: "", address: "", sales_value: "", our_sales: "", our_outlet_id: "", period_label: "", period_date: new Date().toISOString().slice(0, 10), note: "" });
    fetchCompRows();
  };
  const parseComp = () => {
    const res = parseAreaTable(compPaste);
    if (!res || res.rows.length === 0) { alert("Couldn't read a table. Need an Area column, a Brownie Heaven column, and one or more competitor columns."); return; }
    setCompParsed(res.rows);
  };
  const saveParsedComp = async () => {
    if (!compParsed || !compParsed.length) return;
    setCompSavingBulk(true);
    const payload = compParsed.map(r => ({ competitor: (r.competitor || compPasteComp).trim() || "Unknown", area: r.area, sales_value: r.their, our_sales: r.our, period_label: compPasteLabel.trim() || null, period_date: compPasteDate, entered_by: user?.id || null }));
    const { error } = await supabase.from("competitor_sales").insert(payload);
    setCompSavingBulk(false);
    if (error) { alert("Save failed: " + error.message); return; }
    setCompPaste(""); setCompParsed(null);
    fetchCompRows();
  };
  const fetchCompHeadline = async () => { const { data } = await supabase.from("app_settings").select("value").eq("key", "comp_headline_on").maybeSingle(); setCompHeadlineOn(data ? data.value !== "false" : true); };
  const fetchCeoData = async (win: string) => {
    const winDays = win === "1" ? 1 : win === "30" ? 30 : 7;
    const end = new Date(Date.now() - 86400000);
    const start = new Date(end.getTime() - (winDays - 1) * 86400000);
    const sISO = start.toISOString().split("T")[0], eISO = end.toISOString().split("T")[0];
    const { data: reps } = await supabase.from("reports").select("staff_id, is_late, submitted_at").gte("submitted_at", sISO).lte("submitted_at", eISO + "T23:59:59");
    setCeoRepRows(reps || []);
    const ym = new Date().toISOString().slice(0, 7);
    const { data: mrep } = await supabase.from("outlet_reports").select("outlet_id, shop_sales_value, swiggy_sales_value, zomato_sales_value, report_date").gte("report_date", `${ym}-01`).lte("report_date", eISO);
    setCeoMonthRep(mrep || []);
  };
  const fetchMargin = async (month: string) => {
    setMarginLoading(true);
    try {
      const res = await fetch(`/api/margin?month=${month}`);
      const json = await res.json();
      setMarginData(json.success ? json.margins : []);
    } finally { setMarginLoading(false); }
  };
  const fetchMarginMonths = async () => {
    const { data } = await supabase.from("atlas_monthly_results").select("month");
    const uniq = Array.from(new Set((data || []).map((r: any) => r.month))).sort().reverse() as string[];
    setMarginMonths(uniq);
    if (uniq.length) { setMarginMonth(uniq[0]); fetchMargin(uniq[0]); }
  };

  const downloadCeoPDF = async () => {
    const ceo = computeCeoData(ceoRepRows, ceoMonthRep, ceoWin);
    const C = { bg: "#FAF3E7", card: "#FFFDF8", ink: "#3E2415", soft: "#8A6A4A", line: "#EADBC2", green: "#2E7D32", red: "#C62828", amber: "#C8901E" };
    const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
    const hh = new Date().getHours();
    const greet = hh < 12 ? "Good morning" : hh < 17 ? "Good afternoon" : "Good evening";
    const acctRows = ceo.acct.map((a) => `<div style="margin:3px 0;font-size:12px"><b>${a.name}</b> — ${a.tag}</div>`).join("") + `<div style="margin:3px 0;font-size:12px;color:${C.soft}"><b>Niranjana</b> — Founder's Office, MIA from daily reports (but she built this thing)</div>`;
    const ideaRows = ceo.ideas.map((i) => `<li style="margin:5px 0;font-size:12px">${i}</li>`).join("");
    const marginRows = marginData.map((m: any) => `<tr><td style="padding:4px 6px;font-size:11px">${m.outletName}</td><td style="padding:4px 6px;font-size:11px;text-align:right">${inr(m.salesNet)}</td><td style="padding:4px 6px;font-size:11px;text-align:right;color:${C.soft}">${inr(m.cogs)}</td><td style="padding:4px 6px;font-size:11px;text-align:right;font-weight:700;color:${m.marginPercent == null ? C.soft : m.marginPercent < 40 ? C.red : m.marginPercent < 60 ? C.amber : C.green}">${m.marginPercent == null ? "—" : m.marginPercent.toFixed(1) + "%"}</td></tr>`).join("");
    const marginCard = marginData.length > 0 ? `<div style="background:${C.card};border:1px solid ${C.line};border-radius:12px;padding:16px;margin-bottom:14px"><div style="font-size:14px;font-weight:800;margin-bottom:8px">💰 Gross margin by outlet — ${marginMonth}</div><table style="width:100%;border-collapse:collapse"><thead><tr style="text-align:left"><th style="font-size:10px;color:${C.soft};padding:4px 6px">OUTLET</th><th style="font-size:10px;color:${C.soft};padding:4px 6px;text-align:right">SALES</th><th style="font-size:10px;color:${C.soft};padding:4px 6px;text-align:right">COST</th><th style="font-size:10px;color:${C.soft};padding:4px 6px;text-align:right">MARGIN %</th></tr></thead><tbody>${marginRows}</tbody></table></div>` : "";
    const html = `<div style="width:794px;background:${C.bg};font-family:'Segoe UI',Arial,sans-serif;color:${C.ink};padding:34px"><div style="font-size:21px;font-weight:900">${greet} — Brownie Heaven CEO Ops Brief</div><div style="font-size:11px;color:${C.soft};margin-bottom:16px">${ceo.ym} · day ${ceo.daysElapsed} of ${ceo.daysInMonth} · window: ${ceoWin === "1" ? "yesterday" : "last " + ceo.winDays + " days"}</div><div style="background:${C.card};border:1px solid ${C.line};border-radius:12px;padding:16px;margin-bottom:14px"><div style="font-size:14px;font-weight:800;margin-bottom:8px">Who's on top of it — and who's slipping</div>${acctRows}</div><div style="background:${C.card};border:1px solid ${C.line};border-radius:12px;padding:16px;margin-bottom:14px"><div style="font-size:14px;font-weight:800;margin-bottom:8px">Are we going to make the month?</div><div style="font-size:20px;font-weight:900">${inr(ceo.monthSales)}</div><div style="font-size:12px;color:${ceo.onTrack ? C.green : C.amber}">${ceo.salesPct.toFixed(0)}% of ${inr(ceo.monthTgt)} target · ${ceo.onTrack ? "on pace" : "behind pace"} (time elapsed ${ceo.timePct.toFixed(0)}%)</div>${ceo.drag ? `<div style="font-size:12px;color:${C.red};margin-top:6px">Dragging: ${ceo.drag.name} — ${ceo.drag.pct.toFixed(0)}% of target</div>` : ""}${ceo.hero ? `<div style="font-size:12px;color:${C.green}">Carrying: ${ceo.hero.name} — ${ceo.hero.pct.toFixed(0)}% of target</div>` : ""}</div>${marginCard}<div style="background:${C.card};border:2px solid ${C.amber};border-radius:12px;padding:16px"><div style="font-size:14px;font-weight:800;margin-bottom:8px;color:${C.amber}">Ideas to act on</div><ul style="margin:0;padding-left:18px">${ideaRows}</ul></div></div>`;
    const lib = await loadH2P();
    window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 50));
    const holder = document.createElement("div"); holder.style.position = "fixed"; holder.style.left = "-9999px"; holder.style.top = "0"; holder.innerHTML = html; document.body.appendChild(holder);
    try { await lib().set({ margin: 0, filename: `CEO_Brief_${new Date().toISOString().split("T")[0]}.pdf`, image: { type: "jpeg", quality: 0.97 }, html2canvas: { scale: 2, backgroundColor: C.bg }, jsPDF: { unit: "pt", format: "a4", orientation: "portrait" }, pagebreak: { mode: ["css", "legacy"] } }).from(holder.firstElementChild).save(); }
    finally { document.body.removeChild(holder); }
  };
  const openCeoCustom = () => {
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    setCeoCustomFrom(weekAgo); setCeoCustomTo(today); setCeoCustomOutlets([]);
    setCeoCustomOpen(true);
  };
  const downloadCeoPDFCustom = async () => {
    if (!ceoCustomFrom || !ceoCustomTo) { alert("Pick both a from and to date."); return; }
    setCeoCustomBusy(true);
    try {
      const { data: staffRows, error: staffErr } = await supabase.from("reports").select("staff_id, is_late, submitted_at").gte("submitted_at", ceoCustomFrom).lte("submitted_at", ceoCustomTo + "T23:59:59");
      if (staffErr) throw staffErr;
      const { data: outletRows, error: outletErr } = await supabase.from("outlet_reports").select("*").gte("report_date", ceoCustomFrom).lte("report_date", ceoCustomTo);
      if (outletErr) throw outletErr;
      const rows = outletRows || [];
      const cd = computeCeoCustom(staffRows || [], rows, ceoCustomFrom, ceoCustomTo, ceoCustomOutlets);
      const C = { bg: "#FAF3E7", card: "#FFFDF8", ink: "#3E2415", soft: "#8A6A4A", line: "#EADBC2", green: "#2E7D32", red: "#C62828", amber: "#C8901E" };
      const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
      const acctRows = cd.acct.map((a) => `<div style="margin:3px 0;font-size:12px"><b>${a.name}</b> — ${a.tag}</div>`).join("");
      const ideaRows = cd.ideas.map((i) => `<li style="margin:5px 0;font-size:12px">${i}</li>`).join("");
      const outletRowsHtml = cd.perOutlet.map((o) => `<tr><td style="padding:5px 8px;border-bottom:1px solid ${C.line};font-size:11px">${o.name}</td><td style="padding:5px 8px;border-bottom:1px solid ${C.line};text-align:right;font-size:11px">${inr(o.sales)}</td><td style="padding:5px 8px;border-bottom:1px solid ${C.line};text-align:right;font-size:11px;color:${C.soft}">${o.tgt > 0 ? inr(o.tgt) : "-"}</td><td style="padding:5px 8px;border-bottom:1px solid ${C.line};text-align:right;font-size:11px;font-weight:700;color:${o.tgt > 0 ? (o.pct >= 100 ? C.green : o.pct >= 60 ? C.amber : C.red) : C.soft}">${o.tgt > 0 ? o.pct.toFixed(0) + "%" : "-"}</td></tr>`).join("");
      // The real differentiator: true margin for THIS EXACT period, computed live from Stock dispatch
      // quantities x actual recipe cost — not a monthly snapshot. Works for any date range, any outlets.
      let stockCard = "";
      try {
        const stockOutletIds = ceoCustomOutlets.length ? ceoCustomOutlets : OUTLETS;
        const stockOutletNames = stockOutletIds.map((o) => (OUTLET_ID_TO_STOCK_NAME as any)[o]).filter(Boolean);
        const { data: dispatchRows } = await supabaseStock.from("outlet_supply_ledger").select("outlet, product, qty, amount").gte("date", ceoCustomFrom).lte("date", ceoCustomTo).in("outlet", stockOutletNames);
        if (dispatchRows && dispatchRows.length) {
          const byOutlet: Record<string, { cost: number; dispatchValue: number; uncosted: Set<string>; products: Record<string, number> }> = {};
          const productTotals: Record<string, number> = {};
          dispatchRows.forEach((d: any) => {
            if (!byOutlet[d.outlet]) byOutlet[d.outlet] = { cost: 0, dispatchValue: 0, uncosted: new Set(), products: {} };
            const b = byOutlet[d.outlet];
            const unitCost = (FOOD_COST_MAP as any)[d.product];
            b.dispatchValue += Number(d.amount) || 0;
            if (unitCost !== undefined) {
              const c = unitCost * (Number(d.qty) || 0);
              b.cost += c;
              b.products[d.product] = (b.products[d.product] || 0) + c;
              productTotals[d.product] = (productTotals[d.product] || 0) + c;
            } else {
              b.uncosted.add(d.product);
            }
          });
          const marginRowsLive = cd.perOutlet.map((o: any) => {
            const stockName = (OUTLET_ID_TO_STOCK_NAME as any)[o.o];
            const b = stockName ? byOutlet[stockName] : undefined;
            if (!b) return null;
            const margin = o.sales - b.cost;
            const marginPct = o.sales > 0 ? (margin / o.sales) * 100 : null;
            const ratio = o.sales > 0 ? b.dispatchValue / o.sales : 0;
            return { name: o.name, sales: o.sales, cost: b.cost, margin, marginPct, flag: ratio > 1.5, uncostedCount: b.uncosted.size };
          }).filter(Boolean) as any[];
          const totalSales = marginRowsLive.reduce((a, r) => a + r.sales, 0);
          const totalCost = marginRowsLive.reduce((a, r) => a + r.cost, 0);
          const totalMarginPct = totalSales > 0 ? ((totalSales - totalCost) / totalSales) * 100 : 0;
          const mRows = marginRowsLive.map((r: any) => `<tr><td style="padding:5px 8px;border-bottom:1px solid ${C.line};font-size:11px">${r.flag ? "🚩 " : ""}${r.name}</td><td style="padding:5px 8px;border-bottom:1px solid ${C.line};text-align:right;font-size:11px">${inr(r.sales)}</td><td style="padding:5px 8px;border-bottom:1px solid ${C.line};text-align:right;font-size:11px;color:${C.soft}">${inr(r.cost)}</td><td style="padding:5px 8px;border-bottom:1px solid ${C.line};text-align:right;font-size:11px;font-weight:700;color:${r.marginPct == null ? C.soft : r.marginPct < 40 ? C.red : r.marginPct < 60 ? C.amber : C.green}">${r.marginPct == null ? "—" : r.marginPct.toFixed(1) + "%"}</td></tr>`).join("");
          const topProductsHtml = Object.entries(productTotals).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5).map(([pname, val]: any) => `<tr><td style="padding:4px 8px;border-bottom:1px solid ${C.line};font-size:10px">${pname}</td><td style="padding:4px 8px;border-bottom:1px solid ${C.line};text-align:right;font-size:10px;color:${C.soft}">${inr(val as number)}</td></tr>`).join("");
          const uncostedTotal = marginRowsLive.reduce((a, r) => a + r.uncostedCount, 0);
          stockCard = `<div style="background:${C.card};border:2px solid ${C.amber};border-radius:12px;padding:16px;margin-bottom:14px"><div style="font-size:15px;font-weight:900;margin-bottom:2px">📦 True margin for this exact period — live from Stock</div><div style="font-size:9px;color:${C.soft};margin-bottom:10px">Sales minus actual ingredient cost (dispatch quantity × real recipe cost), computed fresh for ${ceoCustomFrom} → ${ceoCustomTo}. This is not available anywhere else in TASKFORCE.</div><div style="font-size:22px;font-weight:900;color:${totalMarginPct < 40 ? C.red : totalMarginPct < 60 ? C.amber : C.green}">${totalMarginPct.toFixed(1)}% overall margin</div><div style="font-size:11px;color:${C.soft};margin-bottom:10px">${inr(totalSales)} sales − ${inr(totalCost)} true food cost</div><table style="width:100%;border-collapse:collapse;margin-bottom:10px"><thead><tr style="text-align:left"><th style="font-size:9px;color:${C.soft};padding:4px 8px">OUTLET</th><th style="font-size:9px;color:${C.soft};padding:4px 8px;text-align:right">SALES</th><th style="font-size:9px;color:${C.soft};padding:4px 8px;text-align:right">FOOD COST</th><th style="font-size:9px;color:${C.soft};padding:4px 8px;text-align:right">MARGIN %</th></tr></thead><tbody>${mRows}</tbody></table>${topProductsHtml ? `<div style="font-size:11px;font-weight:700;margin-bottom:4px">Top 5 costliest products this period</div><table style="width:100%;border-collapse:collapse">${topProductsHtml}</table>` : ""}${uncostedTotal > 0 ? `<div style="font-size:9px;color:${C.soft};margin-top:8px;font-style:italic">${uncostedTotal} outlet-product combos have no recipe cost yet, so true cost is a touch higher than shown.</div>` : ""}${marginRowsLive.some((r: any) => r.flag) ? `<div style="font-size:9px;color:${C.red};margin-top:4px">🚩 = dispatched stock value is running well above sales for that outlet — worth a look.</div>` : ""}</div>`;
        }
      } catch { /* stock connection optional — skip on failure */ }
      const CEO_QUOTES = [
        "Revenue is vanity, margin is sanity, cash is reality.",
        "What gets measured gets managed. — Peter Drucker",
        "The best time to fix a leak was yesterday. The next best time is today.",
        "Small daily improvements are the key to staggering long-term results.",
        "A bakery runs on butter, sugar, and someone actually reading the numbers. 🍫",
        "Amateurs talk revenue. Professionals talk margin.",
      ];
      const quote = CEO_QUOTES[Math.floor(Math.random() * CEO_QUOTES.length)];
      const quoteCard = `<div style="text-align:center;font-size:11px;font-style:italic;color:${C.soft};margin:14px 0;padding:10px;border-top:1px dashed ${C.line};border-bottom:1px dashed ${C.line}">"${quote}"</div>`;
      const html = `<div style="width:794px;background:${C.bg};font-family:'Segoe UI',Arial,sans-serif;color:${C.ink};padding:34px"><div style="font-size:21px;font-weight:900">Brownie Heaven — Custom CEO Report</div><div style="font-size:11px;color:${C.soft};margin-bottom:16px">${ceoCustomFrom} → ${ceoCustomTo} · ${ceoCustomOutlets.length ? ceoCustomOutlets.length + " outlet(s)" : "all outlets"}</div><div style="background:${C.card};border:1px solid ${C.line};border-radius:12px;padding:16px;margin-bottom:14px"><div style="font-size:14px;font-weight:800;margin-bottom:8px">Who's on top of it — and who's slipping</div>${acctRows}</div><div style="background:${C.card};border:1px solid ${C.line};border-radius:12px;padding:16px;margin-bottom:14px"><div style="font-size:14px;font-weight:800;margin-bottom:8px">Sales for this period</div><div style="font-size:20px;font-weight:900">${inr(cd.periodSales)}</div><div style="font-size:12px;color:${cd.salesPct >= 90 ? C.green : C.amber}">${cd.periodTgt > 0 ? cd.salesPct.toFixed(0) + "% of " + inr(cd.periodTgt) + " target" : "No target data for this selection"}</div><table style="width:100%;border-collapse:collapse;margin-top:10px"><thead><tr style="text-align:left"><th style="font-size:10px;color:${C.soft};padding:4px 8px">OUTLET</th><th style="font-size:10px;color:${C.soft};padding:4px 8px;text-align:right">SALES</th><th style="font-size:10px;color:${C.soft};padding:4px 8px;text-align:right">TARGET</th><th style="font-size:10px;color:${C.soft};padding:4px 8px;text-align:right">%</th></tr></thead><tbody>${outletRowsHtml}</tbody></table></div>${stockCard}${quoteCard}<div style="background:${C.card};border:2px solid ${C.amber};border-radius:12px;padding:16px"><div style="font-size:14px;font-weight:800;margin-bottom:8px;color:${C.amber}">Ideas to act on</div><ul style="margin:0;padding-left:18px">${ideaRows}</ul></div></div>`;
      const lib = await loadH2P();
      window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 50));
      const holder = document.createElement("div"); holder.style.position = "fixed"; holder.style.left = "-9999px"; holder.style.top = "0"; holder.innerHTML = html; document.body.appendChild(holder);
      try { await lib().set({ margin: 0, filename: `CEO_Custom_${ceoCustomFrom}_to_${ceoCustomTo}.pdf`, image: { type: "jpeg", quality: 0.97 }, html2canvas: { scale: 2, backgroundColor: C.bg }, jsPDF: { unit: "pt", format: "a4", orientation: "portrait" }, pagebreak: { mode: ["css", "legacy"] } }).from(holder.firstElementChild).save(); }
      finally { document.body.removeChild(holder); }
      setCeoCustomOpen(false);
    } catch (e: any) { alert("Failed to generate: " + (e?.message || "error")); }
    setCeoCustomBusy(false);
  };
  useEffect(() => {
    if (activeTab === "ceo_report" && marginMonths.length === 0) { fetchMarginMonths(); }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [activeTab]);
  useEffect(() => {
    if (user && (user.role === "Owner" || user.role === "Founder's Office")) {
      fetchCeoData(ceoWin);
      const today = new Date().toISOString().split("T")[0];
      let showPopup = localStorage.getItem("ceo_popup_seen") !== today;
      (async () => {
        const { data: pushRow } = await supabase.from("app_settings").select("value").eq("key", "ceo_push_ts").maybeSingle();
        const pushTs = pushRow?.value;
        if (pushTs && pushTs !== localStorage.getItem("ceo_push_seen_ts")) {
          showPopup = true;
          localStorage.setItem("ceo_push_seen_ts", pushTs);
        }
        if (showPopup) { setCeoPopupOpen(true); localStorage.setItem("ceo_popup_seen", today); }
      })();
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [user]);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("fines").select("*").eq("staff_id", user.id).eq("acknowledged", false).order("created_at", { ascending: true });
      if (data && data.length > 0) { setUnackedFines(data); setFineAckOpen(true); }
    })();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [user]);
  const acknowledgeFines = async () => {
    setFineAckBusy(true);
    const ids = unackedFines.map((f) => f.id);
    await supabase.from("fines").update({ acknowledged: true }).in("id", ids);
    setFineAckBusy(false);
    setFineAckOpen(false);
    setUnackedFines([]);
  };
  const toggleCompHeadline = async () => { const nv = !compHeadlineOn; setCompHeadlineOn(nv); await supabase.from("app_settings").upsert({ key: "comp_headline_on", value: nv ? "true" : "false", updated_at: new Date().toISOString() }, { onConflict: "key" }); };
  const pushCeoPopupToNishant = async () => {
    setCeoPushSending(true);
    try {
      await supabase.from("app_settings").upsert({ key: "ceo_push_ts", value: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "key" });
      alert("Pushed — Nishant will see the popup next time he opens TASKFORCE (or right away if he already has it open).");
    } finally { setCeoPushSending(false); }
  };
  const fetchCompProducts = async () => {
    const { data } = await supabase.from("competitor_products").select("*").order("gmv", { ascending: false, nullsFirst: false });
    setCompProducts(data || []);
  };
  const parseProd = () => {
    const rows = parseProductTable(prodPaste);
    if (!rows || rows.length === 0) { alert("Couldn't read a product table. Need a header with Product and GMV columns."); return; }
    setProdParsed(rows);
  };
  const saveProd = async () => {
    if (!prodParsed || !prodParsed.length) return;
    if (prodSide === "them" && !prodComp.trim()) { alert("Enter the competitor name for their products."); return; }
    setProdSaving(true);
    const payload = prodParsed.map((r, i) => ({ side: prodSide, competitor: prodSide === "them" ? prodComp.trim() : null, product: r.product, gmv: r.gmv, orders: r.orders, units: r.units, areas: r.areas, rank: i + 1, period_label: prodLabel.trim() || null, period_date: prodDate, entered_by: user?.id || null }));
    const { error } = await supabase.from("competitor_products").insert(payload);
    setProdSaving(false);
    if (error) { alert("Save failed: " + error.message); return; }
    setProdPaste(""); setProdParsed(null);
    fetchCompProducts();
  };
  const compFmtL = (n: number) => n >= 100000 ? "₹" + (n / 100000).toFixed(2) + "L" : "₹" + Math.round(n).toLocaleString("en-IN");
  const compPeriods = Array.from(new Set(compRows.map((r: any) => r.period_label || r.period_date))).filter(Boolean) as string[];
  const compActivePeriod = compPeriod || compPeriods[0] || "";
  const compPeriodRows = compRows.filter((r: any) => (r.period_label || r.period_date) === compActivePeriod).map((r: any) => { const their = Number(r.sales_value) || 0; const our = r.our_sales == null ? null : Number(r.our_sales); return { area: r.area as string, competitor: (r.competitor || "Unknown") as string, their, our: our as number | null, gap: their - (our || 0) }; });
  const compExpansion = compPeriodRows.filter(r => r.their > (r.our || 0) && (r.our == null || r.our === 0)).sort((a, b) => b.gap - a.gap);
  const compDefend = compPeriodRows.filter(r => r.our != null && r.our > 0 && r.their > r.our).sort((a, b) => b.gap - a.gap);
  const compWinning = compPeriodRows.filter(r => (r.our || 0) >= r.their).sort((a, b) => a.gap - b.gap);
  const compTop = compExpansion[0] || compDefend[0] || compWinning[0] || null;
  const compFunny = (() => {
    if (!compTop) return { playful: "", pro: "" };
    const g = compFmtL(Math.abs(compTop.gap)); const area = compTop.area; const competitor = compTop.competitor;
    if (compExpansion[0] === compTop) return { playful: `${competitor} is printing money in ${area} — ${g} ahead and we haven't even shown up yet 😬🍫`, pro: `${competitor} leads ${area} by ${g} in an area where we have no real presence — worth a look.` };
    if (compDefend[0] === compTop) return { playful: `${competitor} is out-baking us in ${area} by ${g}. Time to fire up the ovens 🔥`, pro: `We trail ${competitor} in ${area} by ${g} — a focus area to defend.` };
    return { playful: `${area} is all ours — ${g} clear of ${competitor}. Chef's kiss 🧑‍🍳`, pro: `We lead ${competitor} in ${area} by ${g}.` };
  })();
  const downloadCompPDF = async () => {
    if (compPeriodRows.length === 0) { alert("No competitor data for this period."); return; }
    const C = { bg: "#FAF3E7", card: "#FFFDF8", ink: "#3E2415", soft: "#8A6A4A", line: "#EADBC2", green: "#2E7D32", red: "#C62828", orange: "#C2410C" };
    const rs = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
    type Row = { area: string; competitor: string; their: number; our: number | null; gap: number };
    const section = (title: string, subtitle: string, rows: Row[], color: string) => {
      if (!rows.length) return "";
      const body = rows.map(r => `<tr><td style="padding:5px 8px;border-bottom:1px solid ${C.line};font-size:10px;color:${C.ink}">${r.area}</td><td style="padding:5px 8px;border-bottom:1px solid ${C.line};font-size:10px;color:${C.soft}">${r.competitor}</td><td style="padding:5px 8px;border-bottom:1px solid ${C.line};font-size:10px;text-align:right">${rs(r.their)}</td><td style="padding:5px 8px;border-bottom:1px solid ${C.line};font-size:10px;text-align:right;color:${C.soft}">${r.our != null ? rs(r.our) : "-"}</td><td style="padding:5px 8px;border-bottom:1px solid ${C.line};font-size:10px;text-align:right;font-weight:700;color:${color}">${rs(Math.abs(r.gap))}</td></tr>`).join("");
      return `<div style="margin-top:20px"><div style="font-size:14px;font-weight:800;color:${color}">${title}</div><div style="font-size:10px;color:${C.soft};margin-bottom:6px">${subtitle}</div><table style="width:100%;border-collapse:collapse;background:${C.card};border:1px solid ${C.line};border-radius:10px;overflow:hidden"><thead><tr style="background:${C.ink}"><th style="padding:7px 8px;text-align:left;color:#FFF6E5;font-size:9px">AREA</th><th style="padding:7px 8px;text-align:left;color:#FFF6E5;font-size:9px">COMPETITOR</th><th style="padding:7px 8px;text-align:right;color:#FFF6E5;font-size:9px">THEM</th><th style="padding:7px 8px;text-align:right;color:#FFF6E5;font-size:9px">US</th><th style="padding:7px 8px;text-align:right;color:#FFF6E5;font-size:9px">GAP</th></tr></thead><tbody>${body}</tbody></table></div>`;
    };
    const html = `<div style="width:794px;background:${C.bg};font-family:'Segoe UI',Arial,sans-serif;color:${C.ink};padding:34px"><div style="font-size:22px;font-weight:900">Brownie Heaven — Competition Report</div><div style="font-size:11px;color:${C.soft};margin-bottom:16px">${compActivePeriod}</div><div style="background:${C.card};border:1px solid ${C.line};border-radius:12px;padding:18px;font-size:17px;font-weight:700;line-height:1.5">${compFunny.playful}</div>${section("Expansion candidates", "They lead where we're absent — worth a look", compExpansion, C.orange)}${section("Defend", "We're present but trailing", compDefend, C.red)}${section("Winning", "We're ahead", compWinning, C.green)}<div style="font-size:9px;color:${C.soft};margin-top:18px">Competitor figures are estimates shared by the owner — a directional signal, not a verdict.</div></div>`;
    const lib = await loadH2P();
    const holder = document.createElement("div"); holder.style.position = "fixed"; holder.style.left = "-9999px"; holder.innerHTML = html; document.body.appendChild(holder);
    try { await lib().set({ margin: 0, filename: `Competition_${(compActivePeriod || "report").replace(/[^a-z0-9]+/gi, "_")}.pdf`, image: { type: "jpeg", quality: 0.97 }, html2canvas: { scale: 2, backgroundColor: C.bg }, jsPDF: { unit: "pt", format: "a4", orientation: "portrait" }, pagebreak: { mode: ["css", "legacy"] } }).from(holder.firstElementChild).save(); }
    finally { document.body.removeChild(holder); }
  };
  useEffect(() => { if (activeTab === "competition") { fetchCompRows(); fetchCompProducts(); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeTab]);
  useEffect(() => { if (user) { fetchCompRows(); fetchCompProducts(); fetchCompHeadline(); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user]);
  const fetchIpRows = async (uploadId: string) => { const { data } = await supabase.from("item_perf_rows").select("*").eq("upload_id", uploadId).order("net_revenue", { ascending: false, nullsFirst: false }); setIpRows(data || []); };
  const fetchIpUploads = async () => { const { data } = await supabase.from("item_perf_uploads").select("*").order("created_at", { ascending: false }); setIpUploads(data || []); if (data && data.length) { setIpSel((cur) => cur || data[0].id); if (!ipSel) fetchIpRows(data[0].id); } };
  useEffect(() => { if (activeTab === "item_perf") fetchIpUploads(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeTab]);
  const parseItemFile = async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
    const num = (v: any) => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, "")); return isNaN(n) ? null : n; };
    const pick = (r: any, keys: string[]) => { for (const k of Object.keys(r)) { const nk = k.replace(/^\ufeff/, "").trim().toLowerCase(); if (keys.some((x) => nk === x || nk.includes(x))) return r[k]; } return ""; };
    return json.map((r) => ({ name: String(pick(r, ["name"])).trim(), category: String(pick(r, ["category"])).trim(), net_revenue: num(pick(r, ["net revenue", "revenue"])), units_sold: num(pick(r, ["units sold", "units"])), avg_price: num(pick(r, ["avg price", "average price"])), lost_orders: num(pick(r, ["lost orders"])), avg_orders_day: num(pick(r, ["avg orders", "orders / day", "orders/day"])) })).filter((r) => r.name);
  };
  const onIpFile = async (e: any) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { const rows = await parseItemFile(f); if (!rows.length) { alert("No item rows found. Check the export format."); return; } setIpParsed(rows); } catch (err: any) { alert("Couldn't read the file: " + (err?.message || "")); }
    e.target.value = "";
  };
  const saveIp = async () => {
    if (!ipParsed || !ipParsed.length) return;
    setIpBusy(true);
    const { data: up, error: e1 } = await supabase.from("item_perf_uploads").insert({ label: ipLabel.trim() || `Last ${ipDays} days`, period_days: Number(ipDays) || null, uploaded_by: user?.id || null, row_count: ipParsed.length }).select().single();
    if (e1 || !up) { setIpBusy(false); alert("Save failed: " + (e1?.message || "")); return; }
    const payload = ipParsed.map((r) => ({ upload_id: up.id, ...r }));
    const { error: e2 } = await supabase.from("item_perf_rows").insert(payload);
    setIpBusy(false);
    if (e2) { alert("Rows save failed: " + e2.message); return; }
    setIpParsed(null); setIpLabel("");
    await fetchIpUploads(); setIpSel(up.id); fetchIpRows(up.id);
  };
  const ipStats = (() => {
    const rows = ipRows.map((r: any) => ({ name: r.name as string, category: r.category as string, rev: Number(r.net_revenue) || 0, units: Number(r.units_sold) || 0, price: Number(r.avg_price) || 0, lost: Number(r.lost_orders) || 0, opd: Number(r.avg_orders_day) || 0 }));
    if (!rows.length) return null;
    const med = (arr: number[]) => { const a = [...arr].sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; };
    const mU = med(rows.map((r) => r.units)), mP = med(rows.map((r) => r.price)), mR = med(rows.map((r) => r.rev));
    const stars = [...rows].filter((r) => r.units >= mU).sort((a, b) => b.rev - a.rev).slice(0, 5);
    const moneyLeft = [...rows].filter((r) => r.lost > 0).sort((a, b) => b.lost - a.lost).slice(0, 5);
    const byCat: Record<string, typeof rows> = {};
    rows.forEach((r) => { (byCat[r.category] = byCat[r.category] || []).push(r); });
    let suspects: typeof rows = [];
    Object.values(byCat).forEach((items) => { if (items.length < 3) return; const cP = med(items.map((r) => r.price)), cU = med(items.map((r) => r.units)); items.forEach((r) => { if (r.units >= 10 && r.price > cP && r.units < cU) suspects.push(r); }); });
    suspects = suspects.sort((a, b) => (b.lost - a.lost) || (b.price - a.price)).slice(0, 5);
    const sweet = [...rows].filter((r) => r.price <= mP && r.units >= mU).sort((a, b) => b.units - a.units).slice(0, 5);
    const dead = [...rows].filter((r) => r.units >= 3 && r.units < mU && r.rev < mR).sort((a, b) => a.units - b.units).slice(0, 5);
    const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
    const top = stars[0], s0 = suspects[0], w0 = sweet[0], d0 = dead[0];
    const funny = {
      headline: top ? `${top.name} at ${inr(top.price)} is your golden child — ${top.units.toLocaleString("en-IN")} sold. Don't you dare touch that price 😤🍫` : "",
      suspect: s0 ? `${s0.name} at ${inr(s0.price)}? People peeked, gasped, and scrolled on — ${s0.lost} lost orders. Maybe ease off the price 💸` : "",
      sweet: w0 ? `${w0.name} at ${inr(w0.price)} is quietly crushing it — ${w0.units.toLocaleString("en-IN")} sold. The people's champion 👏` : "",
      dead: d0 ? `${d0.name}? ${d0.units} whole units this window. It's giving "forgotten leftover" 💀` : "",
    };
    return { rows, stars, moneyLeft, suspects, sweet, dead, funny, inr };
  })();
  const downloadIpPDF = async () => {
    if (!ipStats) { alert("No data to report."); return; }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 50));
    const up = ipUploads.find((u) => u.id === ipSel);
    const C = { bg: "#FAF3E7", card: "#FFFDF8", ink: "#3E2415", soft: "#8A6A4A", line: "#EADBC2", green: "#2E7D32", red: "#C62828", orange: "#C2410C", gold: "#C8901E" };
    const inr = ipStats.inr;
    const tbl = (title: string, sub: string, rows: any[], color: string) => rows.length ? `<div style="margin-top:18px"><div style="font-size:14px;font-weight:800;color:${color}">${title}</div><div style="font-size:10px;color:${C.soft};margin-bottom:6px">${sub}</div><table style="width:100%;border-collapse:collapse;background:${C.card};border:1px solid ${C.line};border-radius:10px;overflow:hidden"><thead><tr style="background:${C.ink}"><th style="padding:6px 8px;text-align:left;color:#FFF6E5;font-size:9px">ITEM</th><th style="padding:6px 8px;text-align:right;color:#FFF6E5;font-size:9px">AVG</th><th style="padding:6px 8px;text-align:right;color:#FFF6E5;font-size:9px">UNITS</th><th style="padding:6px 8px;text-align:right;color:#FFF6E5;font-size:9px">LOST</th></tr></thead><tbody>${rows.map((r) => `<tr><td style="padding:5px 8px;border-bottom:1px solid ${C.line};font-size:10px;color:${C.ink}">${r.name}</td><td style="padding:5px 8px;border-bottom:1px solid ${C.line};text-align:right;font-size:10px">${inr(r.price)}</td><td style="padding:5px 8px;border-bottom:1px solid ${C.line};text-align:right;font-size:10px">${r.units.toLocaleString("en-IN")}</td><td style="padding:5px 8px;border-bottom:1px solid ${C.line};text-align:right;font-size:10px;color:${C.soft}">${r.lost}</td></tr>`).join("")}</tbody></table></div>` : "";
    const html = `<div style="width:794px;background:${C.bg};font-family:'Segoe UI',Arial,sans-serif;color:${C.ink};padding:34px"><div style="font-size:22px;font-weight:900">Brownie Heaven — Item Performance</div><div style="font-size:11px;color:${C.soft};margin-bottom:14px">${up?.label || ""} · ${ipStats.rows.length} items</div><div style="background:${C.card};border:1px solid ${C.line};border-radius:12px;padding:16px;font-size:16px;font-weight:700;line-height:1.5">${ipStats.funny.headline}</div>${ipStats.funny.suspect ? `<div style="margin-top:8px;font-size:13px;color:${C.orange}">${ipStats.funny.suspect}</div>` : ""}${ipStats.funny.sweet ? `<div style="margin-top:4px;font-size:13px;color:${C.green}">${ipStats.funny.sweet}</div>` : ""}${ipStats.funny.dead ? `<div style="margin-top:4px;font-size:13px;color:${C.red}">${ipStats.funny.dead}</div>` : ""}${tbl("Stars", "The workhorses — protect these", ipStats.stars, C.green)}${tbl("Priced-too-high suspects", "High price, shy demand — worth a rethink", ipStats.suspects, C.orange)}${tbl("Sweet-spot winners", "Great price, flying off shelves", ipStats.sweet, C.green)}${tbl("Money left on the table", "People wanted it, didn't get it", ipStats.moneyLeft, C.gold)}${tbl("Dead weight", "Barely moving — rework or retire?", ipStats.dead, C.red)}<div style="font-size:9px;color:${C.soft};margin-top:16px">Directional signals from one export, not final verdicts. Confirm price effects across two windows before changing prices.</div></div>`;
    const lib = await loadH2P();
    const holder = document.createElement("div"); holder.style.position = "fixed"; holder.style.left = "-9999px"; holder.style.top = "0"; holder.innerHTML = html; document.body.appendChild(holder);
    try { await lib().set({ margin: 0, filename: `ItemPerformance_${(up?.label || "report").replace(/[^a-z0-9]+/gi, "_")}.pdf`, image: { type: "jpeg", quality: 0.97 }, html2canvas: { scale: 2, backgroundColor: C.bg }, jsPDF: { unit: "pt", format: "a4", orientation: "portrait" }, pagebreak: { mode: ["css", "legacy"] } }).from(holder.firstElementChild).save(); }
    finally { document.body.removeChild(holder); }
  };

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

  const fetchOutletHealth = async () => {
    setOutletHealthLoading(true);
    const { data } = await supabase.from("outlet_reports").select("outlet_id, report_date, shop_sales_value, swiggy_sales_value, zomato_sales_value").gte("report_date", "2026-06-01");
    const byOutletMonth: Record<string, Record<string, number>> = {};
    (data || []).forEach((r: any) => {
      const oid = r.outlet_id;
      const ym = r.report_date.slice(0, 7);
      const total = (Number(r.shop_sales_value) || 0) + (Number(r.swiggy_sales_value) || 0) + (Number(r.zomato_sales_value) || 0);
      if (!byOutletMonth[oid]) byOutletMonth[oid] = {};
      byOutletMonth[oid][ym] = (byOutletMonth[oid][ym] || 0) + total;
    });
    const nowYm = new Date().toISOString().slice(0, 7);
    const result = OUTLETS.map((oid) => {
      const months = byOutletMonth[oid] || {};
      const sortedMonths = Object.keys(months).sort();
      const thisMonthTotal = months[nowYm] || 0;
      const tgt = monthlyTargetFor(oid, nowYm);
      const pct = tgt > 0 ? (thisMonthTotal / tgt) * 100 : 0;
      const prevMonths = sortedMonths.filter((m) => m !== nowYm);
      const lastMonth = prevMonths[prevMonths.length - 1];
      const lastMonthTotal = lastMonth ? months[lastMonth] : null;
      let trendPct: number | null = null;
      if (lastMonthTotal && lastMonthTotal > 0) trendPct = ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100;
      let health = "No data";
      if (tgt > 0 && thisMonthTotal > 0) health = pct >= 90 ? "Strong" : pct >= 60 ? "On track" : pct >= 30 ? "Needs attention" : "Struggling";
      let trendLabel = "steady";
      if (trendPct != null) trendLabel = trendPct > 10 ? "growing" : trendPct < -10 ? "declining" : "steady";
      return { oid, name: OUTLET_NAMES[oid] || oid, thisMonthTotal, pct, health, trendPct, trendLabel, monthly: sortedMonths.map((m) => ({ month: m, total: months[m] })) };
    });
    setOutletHealthData(result);
    setOutletHealthLoading(false);
  };
   useEffect(() => { if ((activeTab === "analytics" || activeTab === "owner_outlets") && outletHealthData.length === 0) fetchOutletHealth(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeTab]);

  const downloadOutletHealthPDF = async () => {
    const o = outletHealthData.find((x) => x.oid === outletHealthSel);
    if (!o) { alert("No data for this outlet yet."); return; }
    setOutletHealthPdfBusy(true);
    try {
      const { data: rawRows } = await supabase.from("outlet_reports").select("report_date, shop_sales_value, swiggy_sales_value, zomato_sales_value").eq("outlet_id", outletHealthSel).gte("report_date", "2026-06-01");
      const byMonth: Record<string, { shop: number; swiggy: number; zomato: number }> = {};
      (rawRows || []).forEach((r: any) => {
        const ym = r.report_date.slice(0, 7);
        if (!byMonth[ym]) byMonth[ym] = { shop: 0, swiggy: 0, zomato: 0 };
        byMonth[ym].shop += Number(r.shop_sales_value) || 0;
        byMonth[ym].swiggy += Number(r.swiggy_sales_value) || 0;
        byMonth[ym].zomato += Number(r.zomato_sales_value) || 0;
      });
      const months = Object.keys(byMonth).sort();
      const nowYm = new Date().toISOString().slice(0, 7);
      const thisM = byMonth[nowYm] || { shop: 0, swiggy: 0, zomato: 0 };
      const prevYm = months.filter((m) => m !== nowYm).pop();
      const lastM = prevYm ? byMonth[prevYm] : null;
      const chg = (cur: number, prev: number | undefined) => prev == null || prev === 0 ? null : ((cur - prev) / prev) * 100;

      const C = { bg: "#FAF3E7", card: "#FFFDF8", ink: "#3E2415", soft: "#8A6A4A", line: "#EADBC2", green: "#2E7D32", red: "#C62828", amber: "#C8901E" };
      const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

      const tAll = thisM.shop + thisM.swiggy + thisM.zomato || 1;
      const R = 60, CX = 75, CY = 75, SW = 26, CIRC = 2 * Math.PI * R;
      let acc = 0;
      const segs = [[thisM.shop, "#FACC15"], [thisM.swiggy, "#FB923C"], [thisM.zomato, "#EF4444"]].map(([v, c]: any) => {
        const frac = v / tAll; const len = frac * CIRC; const off = -acc * CIRC; acc += frac;
        return `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${c}" stroke-width="${SW}" stroke-dasharray="${len} ${CIRC - len}" stroke-dashoffset="${off}" transform="rotate(-90 ${CX} ${CY})"></circle>`;
      }).join("");
      const leg = (c: string, n: string, v: number) => `<div style="display:flex;align-items:center;gap:7px;margin-bottom:5px"><span style="width:11px;height:11px;background:${c};border-radius:2px;display:inline-block"></span><span style="font-size:12px;color:${C.ink};font-weight:600;min-width:62px">${n}</span><span style="font-size:12px;color:${C.soft}">${inr(v)} · ${((v / tAll) * 100).toFixed(0)}%</span></div>`;

      const shopChg = chg(thisM.shop, lastM?.shop);
      const swiggyChg = chg(thisM.swiggy, lastM?.swiggy);
      const zomatoChg = chg(thisM.zomato, lastM?.zomato);
      const chRow = (name: string, cur: number, prev: number | undefined, pct: number | null) => {
        const col = pct == null ? C.soft : pct >= 0 ? C.green : C.red;
        const arrow = pct == null ? "" : pct >= 0 ? "Up" : "Down";
        return `<tr><td style="padding:7px 10px;border-bottom:1px solid ${C.line};font-size:12px;font-weight:600">${name}</td><td style="padding:7px 10px;border-bottom:1px solid ${C.line};text-align:right;font-size:12px">${inr(cur)}</td><td style="padding:7px 10px;border-bottom:1px solid ${C.line};text-align:right;font-size:12px;color:${C.soft}">${prev != null ? inr(prev) : "—"}</td><td style="padding:7px 10px;border-bottom:1px solid ${C.line};text-align:right;font-size:12px;font-weight:700;color:${col}">${pct == null ? "—" : arrow + " " + Math.abs(pct).toFixed(1) + "%"}</td></tr>`;
      };
      const channelRows = chRow("Shop", thisM.shop, lastM?.shop, shopChg) + chRow("Swiggy", thisM.swiggy, lastM?.swiggy, swiggyChg) + chRow("Zomato", thisM.zomato, lastM?.zomato, zomatoChg);

      const monthTotals = months.map((m) => ({ m, total: byMonth[m].shop + byMonth[m].swiggy + byMonth[m].zomato }));

      const chartW = 700, chartH = 220, padL = 60, padR = 20, padT = 20, padB = 34;
      const plotW = chartW - padL - padR, plotH = chartH - padT - padB;
      const maxV = Math.max(...monthTotals.map((x) => x.total), 1);
      const stepX = monthTotals.length > 1 ? plotW / (monthTotals.length - 1) : 0;
      const pts = monthTotals.map((x, i) => {
        const px = padL + i * stepX;
        const py = padT + plotH - (x.total / maxV) * plotH;
        return { px, py, ...x };
      });
      const linePath = pts.map((p, i) => (i === 0 ? "M" : "L") + p.px.toFixed(1) + " " + p.py.toFixed(1)).join(" ");
      const areaPath = linePath + ` L ${pts[pts.length - 1]?.px.toFixed(1) || padL} ${padT + plotH} L ${padL} ${padT + plotH} Z`;
      const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => {
        const y = padT + plotH * f;
        const val = Math.round(maxV * (1 - f));
        return `<line x1="${padL}" y1="${y}" x2="${chartW - padR}" y2="${y}" stroke="${C.line}" stroke-width="1"></line><text x="${padL - 8}" y="${y + 4}" text-anchor="end" style="font-size:9px;fill:${C.soft}">${val >= 100000 ? (val / 100000).toFixed(1) + "L" : val}</text>`;
      }).join("");
      const dots = pts.map((p) => `<circle cx="${p.px}" cy="${p.py}" r="4" fill="${C.amber}" stroke="${C.card}" stroke-width="2"></circle><text x="${p.px}" y="${chartH - 8}" text-anchor="middle" style="font-size:9px;fill:${C.soft}">${p.m.slice(5)}</text>`).join("");
      const chartSvg = `<svg width="${chartW}" height="${chartH}" viewBox="0 0 ${chartW} ${chartH}">
        <defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${C.amber}" stop-opacity="0.35"/><stop offset="100%" stop-color="${C.amber}" stop-opacity="0"/></linearGradient></defs>
        ${gridLines}
        <path d="${areaPath}" fill="url(#areaFill)"></path>
        <path d="${linePath}" fill="none" stroke="${C.amber}" stroke-width="2.5"></path>
        ${dots}
      </svg>`;

      const insights: string[] = [];
      const channelName = (v: number) => v === shopChg ? "Shop" : v === swiggyChg ? "Swiggy" : "Zomato";
      const validChgs = [shopChg, swiggyChg, zomatoChg].filter((v) => v != null) as number[];
      if (validChgs.length) {
        const worst = Math.min(...validChgs);
        const best = Math.max(...validChgs);
        if (worst < -5) {
          const nm = channelName(worst);
          const advice = nm === "Swiggy" || nm === "Zomato" ? `check if ads are still running, ratings haven't dipped, and the menu is fully available on ${nm}` : "check walk-in footfall, local competition, or staffing at peak hours";
          insights.push(`${nm} dropped ${Math.abs(worst).toFixed(1)}% vs last month — ${advice}.`);
        }
        if (best > 5 && best !== worst) {
          const nm = channelName(best);
          insights.push(`${nm} grew ${best.toFixed(1)}% — worth finding out what worked (a promo, better ratings, more listings) and repeating it elsewhere.`);
        }
      }
      if (monthTotals.length >= 3) {
        const last3 = monthTotals.slice(-3);
        const decliningStreak = last3[2].total < last3[1].total && last3[1].total < last3[0].total;
        if (decliningStreak) insights.push(`Sales have fallen for two months straight (${last3[0].m} → ${last3[2].m}) — this isn't a one-off dip, worth a closer look at what changed.`);
      }
      if (o.pct > 0 && o.pct < 60) insights.push(`Only ${o.pct.toFixed(0)}% of this month's target hit so far — at this pace the outlet will fall well short unless the remaining days pick up.`);
      if (o.pct >= 90) insights.push(`Tracking at ${o.pct.toFixed(0)}% of target — on pace to hit or beat the number this month.`);
      if (insights.length === 0) insights.push("No sharp swings this month — performance is holding steady across channels.");
      const insightRows = insights.map((s) => `<li style="margin:6px 0;font-size:12px;line-height:1.5">${s}</li>`).join("");

      const html = `<div style="width:794px;background:${C.bg};font-family:'Segoe UI',Arial,sans-serif;color:${C.ink};padding:34px">
        <div style="font-size:22px;font-weight:900">Brownie Heaven — Outlet Health: ${o.name}</div>
        <div style="font-size:11px;color:${C.soft};margin-bottom:16px">Since June launch · generated ${new Date().toISOString().split("T")[0]}</div>
        <div style="background:${C.card};border:1px solid ${C.line};border-radius:12px;padding:18px;margin-bottom:16px">
          <div style="font-size:13px;color:${C.soft}">This month</div>
          <div style="font-size:28px;font-weight:900">${inr(o.thisMonthTotal)}</div>
          <div style="font-size:13px;color:${o.health === "Strong" ? C.green : o.health === "Struggling" ? C.red : C.amber};font-weight:700">${o.health}${o.pct > 0 ? ` · ${o.pct.toFixed(0)}% of target` : ""}</div>
        </div>
        <div style="font-size:14px;font-weight:800;margin-bottom:8px">Revenue trend — month by month</div>
        <div style="background:${C.card};border:1px solid ${C.line};border-radius:12px;padding:16px 18px;margin-bottom:18px">
          ${chartSvg}
        </div>
        <div style="display:flex;gap:18px;align-items:flex-start;margin-bottom:18px">
          <div style="text-align:center">
            <div style="font-size:13px;font-weight:800;color:${C.ink};margin-bottom:6px">Channel mix — this month</div>
            <svg width="150" height="150" viewBox="0 0 150 150">
              <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="#EADBC2" stroke-width="${SW}"></circle>
              ${segs}
              <text x="${CX}" y="${CY - 4}" text-anchor="middle" style="font-size:14px;font-weight:800;fill:${C.ink}">${inr(tAll)}</text>
              <text x="${CX}" y="${CY + 12}" text-anchor="middle" style="font-size:8px;fill:${C.soft};letter-spacing:1px">TOTAL</text>
            </svg>
            <div style="margin-top:10px;text-align:left">
              ${leg("#FACC15", "Shop", thisM.shop)}
              ${leg("#FB923C", "Swiggy", thisM.swiggy)}
              ${leg("#EF4444", "Zomato", thisM.zomato)}
            </div>
          </div>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:800;margin-bottom:8px">Did we gain or lose? — vs last month</div>
            <table style="width:100%;border-collapse:collapse;background:${C.card};border:1px solid ${C.line};border-radius:10px;overflow:hidden">
              <thead><tr style="background:${C.ink}"><th style="padding:7px 10px;text-align:left;color:#FFF6E5;font-size:9px">CHANNEL</th><th style="padding:7px 10px;text-align:right;color:#FFF6E5;font-size:9px">THIS MONTH</th><th style="padding:7px 10px;text-align:right;color:#FFF6E5;font-size:9px">LAST MONTH</th><th style="padding:7px 10px;text-align:right;color:#FFF6E5;font-size:9px">CHANGE</th></tr></thead>
              <tbody>${channelRows}</tbody>
            </table>
          </div>
        </div>
        <div style="background:${C.card};border:2px solid ${C.amber};border-radius:12px;padding:16px">
          <div style="font-size:14px;font-weight:800;margin-bottom:6px;color:${C.amber}">What this means, and what to do about it</div>
          <ul style="margin:0;padding-left:18px">${insightRows}</ul>
        </div>
      </div>`;

      const lib = await loadH2P();
      window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 50));
      const holder = document.createElement("div"); holder.style.position = "fixed"; holder.style.left = "-9999px"; holder.style.top = "0"; holder.innerHTML = html; document.body.appendChild(holder);
      try { await lib().set({ margin: 0, filename: `OutletHealth_${o.name.replace(/\s+/g, "_")}.pdf`, image: { type: "jpeg", quality: 0.97 }, html2canvas: { scale: 2, backgroundColor: C.bg }, jsPDF: { unit: "pt", format: "a4", orientation: "portrait" }, pagebreak: { mode: ["css", "legacy"] } }).from(holder.firstElementChild).save(); }
      finally { document.body.removeChild(holder); }
    } catch (e: any) {
      alert("Failed to generate: " + (e?.message || "error"));
    }
    setOutletHealthPdfBusy(false);
  };

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
    let parsed: any;
    try {
      parsed = JSON.parse(stored);
      if (typeof parsed === "string") { localStorage.removeItem("currentUser"); router.push("/"); return; }
    } catch { localStorage.removeItem("currentUser"); router.push("/"); return; }
    const _fresh = ALL_STAFF.find(s => s.id === parsed.id);
    if (_fresh) parsed = { ...parsed, outlets: (_fresh as any).outlets, role: _fresh.role };
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
    discount_given: String(r.discount_given || ""),
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
const _clean = (v: any) => String(v ?? "").replace(/[^0-9.]/g, "");
  const payload = {
    shop_sales_count: parseInt(_clean(d.shop_sales_count)) || 0,
    shop_sales_value: parseFloat(_clean(d.shop_sales_value)) || 0,
    swiggy_sales_count: parseInt(_clean(d.swiggy_sales_count)) || 0,
    swiggy_sales_value: parseFloat(_clean(d.swiggy_sales_value)) || 0,
    discount_given: parseFloat(_clean(d.discount_given)) || 0,
    zomato_sales_count: parseInt(_clean(d.zomato_sales_count)) || 0,
    zomato_sales_value: parseFloat(_clean(d.zomato_sales_value)) || 0,
    target: parseFloat(_clean(d.target)) || 0,
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
  const hasOutlets = (user?.outlets?.length || 0) > 0;
  const isFO = user?.role === "Founder's Office";
  const isOwner = user?.role === "Owner";
  const canUploadItemPerf = user?.id === "ahila" || user?.id === "vishnu";
  const canViewItemPerf = canAssign || canUploadItemPerf;
  const hasReportDuty = user?.role !== "Owner" && user?.role !== "Founder's Office" && user?.role !== "Head Chef" && user?.role !== "Financial Analyst";
  const [kChefs, setKChefs] = useState<any[]>([]);
  const [kRows, setKRows] = useState<any[]>([]);
  const [kDate, setKDate] = useState(new Date().toISOString().slice(0, 10));
  const [kForm, setKForm] = useState({ chef_id: "", flavour: "", qty: "", station: "" });
  const [kNewChef, setKNewChef] = useState("");
  const [kBusy, setKBusy] = useState(false);
  const [kProducts, setKProducts] = useState<any[]>([]);
  const [kTgtEdits, setKTgtEdits] = useState<Record<string, string>>({});
  const [kShowTargets, setKShowTargets] = useState(false);
  const [kcType, setKcType] = useState<"Sangam" | "Hotel" | "Customised cake">("Sangam");
  const [kcHotel, setKcHotel] = useState("");
  const [kcItem, setKcItem] = useState("");
  const [kcQty, setKcQty] = useState("");
  const [kcChef, setKcChef] = useState("");
  const fetchKProducts = async () => { const { data } = await supabase.from("kitchen_products").select("*").eq("active", true).order("sort_order"); setKProducts(data || []); };
  const saveKTargets = async () => { for (const pr of kProducts) { const v = kTgtEdits[pr.id]; if (v !== undefined && v !== String(pr.target_qty ?? "")) { await supabase.from("kitchen_products").update({ target_qty: Number(v) || 0 }).eq("id", pr.id); } } setKTgtEdits({}); fetchKProducts(); };
  const kProdVsTarget = kProducts.map((pr) => { const made = kRows.filter((r) => (r.flavour || "").trim().toLowerCase() === (pr.name || "").trim().toLowerCase()).reduce((sm, r) => sm + (Number(r.qty) || 0), 0); return { name: pr.name as string, category: (pr.category || "Other") as string, made, target: (pr.target_qty || 0) as number }; });
  const kCats = Array.from(new Set(kProducts.map((pr) => pr.category || "Other")));
  const kMasterNames = new Set(kProducts.map((pr) => (pr.name || "").trim().toLowerCase()));
  const kCustom = kRows.filter((r) => !kMasterNames.has((r.flavour || "").trim().toLowerCase()));
  const fetchKChefs = async () => { const { data } = await supabase.from("kitchen_chefs").select("*").eq("active", true).order("name"); setKChefs(data || []); };
  const fetchKProduction = async (d: string) => { const { data } = await supabase.from("kitchen_production").select("*").eq("prod_date", d).order("created_at"); setKRows(data || []); };
  useEffect(() => { if (user?.role === "Head Chef" || user?.role === "Owner") { fetchKChefs(); fetchKProduction(kDate); fetchKProducts(); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user]);
  const addKChef = async () => { if (!kNewChef.trim()) return; const { error } = await supabase.from("kitchen_chefs").insert({ name: kNewChef.trim() }); if (error) { alert("Failed: " + error.message); return; } setKNewChef(""); fetchKChefs(); };
  const addKProd = async () => { if (!kForm.chef_id || !kForm.qty) { alert("Pick a chef and enter a count."); return; } const chef = kChefs.find((c) => c.id === kForm.chef_id); setKBusy(true); const { error } = await supabase.from("kitchen_production").insert({ prod_date: kDate, chef_id: kForm.chef_id, chef_name: chef?.name || null, flavour: kForm.flavour.trim() || null, qty: Number(kForm.qty) || 0, station: kForm.station.trim() || null, entered_by: user?.id || null }); setKBusy(false); if (error) { alert("Save failed: " + error.message); return; } setKForm({ chef_id: "", flavour: "", qty: "", station: "" }); fetchKProduction(kDate); };
  const addKCustom = async () => {
    if (!kcQty) { alert("Enter a count."); return; }
    if (kcType === "Hotel" && !kcHotel.trim()) { alert("Enter the hotel name."); return; }
    const label = kcType === "Hotel" ? `Hotel: ${kcHotel.trim()}${kcItem.trim() ? " · " + kcItem.trim() : ""}` : `${kcType}${kcItem.trim() ? " · " + kcItem.trim() : ""}`;
    const chef = kChefs.find((c) => c.id === kcChef);
    const { error } = await supabase.from("kitchen_production").insert({ prod_date: kDate, flavour: label, qty: Number(kcQty) || 0, chef_id: kcChef || null, chef_name: chef?.name || null, station: "Customised", entered_by: user?.id || null });
    if (error) { alert("Save failed: " + error.message); return; }
    setKcHotel(""); setKcItem(""); setKcQty(""); setKcChef("");
    fetchKProduction(kDate);
  };
  const delKProd = async (id: string) => { await supabase.from("kitchen_production").delete().eq("id", id); fetchKProduction(kDate); };
  const kByChef = kChefs.map((c) => ({ name: c.name, total: kRows.filter((r) => r.chef_id === c.id).reduce((sm, r) => sm + (Number(r.qty) || 0), 0) })).sort((a, b) => b.total - a.total);
  const kDayTotal = kRows.reduce((sm, r) => sm + (Number(r.qty) || 0), 0);
  const kMax = Math.max(1, ...kByChef.map((c) => c.total));
  const kAvg = kByChef.length ? Math.round(kDayTotal / kByChef.length) : 0;
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
      {(user?.role === "Owner" || (user as any)?.isFO) && <ActivityToastStack />}
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
                   {(canAssign || isFO) && (
            <div onClick={() => { setActiveTab("fines"); setSidebarOpen(false); fetchFines(); }} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "fines" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
              <span>⚖️</span> Fines
            </div>
          )}
          {user?.role === "Financial Analyst" && (
            <div onClick={() => { setActiveTab("pnl"); setSidebarOpen(false); fetchPnl(); }} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "pnl" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
              <span>💹</span> Outlet &amp; Channel P&amp;L
            </div>
          )}
                   {user?.role === "Financial Analyst" && (
            <div onClick={() => { setActiveTab("contribution_margins"); setSidebarOpen(false); fetchContributionMargins(); }} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "contribution_margins" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
              <span>📐</span> Contribution Margins
            </div>
          )}
                  {user?.role === "Financial Analyst" && (
            <div onClick={() => { setActiveTab("net_realisation"); setSidebarOpen(false); fetchNetRealisation(); }} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "net_realisation" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
              <span>🧾</span> Net Realisation
            </div>
          )}
          {user?.role === "Financial Analyst" && (
            <div onClick={() => { setActiveTab("cash_flow"); setSidebarOpen(false); fetchCashFlowForecast(); }} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "cash_flow" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
              <span>📉</span> Cash-Flow Forecast
            </div>
          )}
                    {(isOwner || isFO) && (
            <div onClick={() => { setActiveTab("ceo_report"); setSidebarOpen(false); fetchCeoData(ceoWin); }} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "ceo_report" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
              <span>📊</span> CEO Report
            </div>
          )}
                   {(isOwner || isFO) && (
            <div onClick={() => { setActiveTab("niranjana_report"); setSidebarOpen(false); }} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "niranjana_report" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
              <span>📝</span> Niranjana's Report
            </div>
          )}
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
          {(canAssign || isFO) && (
            <div onClick={() => { setActiveTab("competition"); setSidebarOpen(false); }} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "competition" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
              <span>🥊</span> Competition
            </div>
          )}
          {canViewItemPerf && (
            <div onClick={() => { setActiveTab("item_perf"); setSidebarOpen(false); }} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "item_perf" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
              <span>📈</span> Item Performance
            </div>
          )}
          {canAssign && (
            <>
             <div onClick={() => { setActiveTab("all_reports"); setSidebarOpen(false); }} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "all_reports" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
                <span>📋</span> Reports
              </div>
            </>
          )}
          {(canAssign || hasOutlets) && (
              <div onClick={() => { setActiveTab("owner_outlets"); setSidebarOpen(false); }} className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors ${activeTab === "owner_outlets" ? "text-white bg-zinc-900 border-l-2 border-yellow-400" : "text-zinc-500 hover:text-white"}`}>
              <span>🏪</span> Outlet Reports
              </div>
          )}
          {canAssign && (
            <>
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
        {ceoPopupOpen && (isOwner || isFO) && (
          <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
            <div className="bg-zinc-900 border border-zinc-700 max-w-md w-full p-6 relative">
              <button onClick={() => setCeoPopupOpen(false)} className="absolute top-3 right-3 text-zinc-500 hover:text-white text-lg">✕</button>
              <p className="text-2xl font-black mb-1">{(() => { const h = new Date().getHours(); return h < 12 ? "Good morning ☕" : h < 17 ? "Good afternoon 🌤️" : "Good evening 🌙"; })()}</p>
              <p className="text-sm text-zinc-400 mb-4">{user?.name?.split(" ")[0]}, here's your Brownie Heaven morning brief.</p>
              <p className="text-sm text-zinc-300 mb-5">A quick look at who's on top of their game, who's slipping, and how the month is tracking.</p>
              <button onClick={() => { setCeoPopupOpen(false); setActiveTab("ceo_report"); fetchCeoData(ceoWin); }} className="w-full bg-yellow-400 text-black px-4 py-2.5 text-sm font-semibold hover:bg-yellow-300 transition-colors">Wanna go through today's report? →</button>
              <button onClick={() => setCeoPopupOpen(false)} className="w-full mt-2 text-zinc-500 hover:text-white text-sm py-2">Maybe later — take me to the dashboard</button>
            </div>
          </div>
        )}

        {fineAckOpen && unackedFines.length > 0 && (
          <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
            <div className="bg-zinc-900 border border-red-500 max-w-md w-full p-6">
              <p className="text-2xl font-black mb-1 text-red-400">⚠️ You've been fined</p>
              <p className="text-sm text-zinc-400 mb-4">{unackedFines.length === 1 ? "This needs your acknowledgment before you continue." : `${unackedFines.length} fines need your acknowledgment before you continue.`}</p>
              <div className="space-y-2 mb-5 max-h-64 overflow-y-auto">
                {unackedFines.map((f) => (
                  <div key={f.id} className="border border-zinc-800 p-3">
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm font-semibold">{f.reason || "No reason given"}</span>
                      <span className="font-mono text-red-400">−₹{Number(f.amount).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">{f.fine_date}{f.outlet ? ` · ${OUTLET_NAMES[f.outlet] || f.outlet}` : ""}</div>
                  </div>
                ))}
              </div>
              <button onClick={acknowledgeFines} disabled={fineAckBusy} className="w-full bg-red-500 text-white px-4 py-2.5 text-sm font-semibold hover:bg-red-400 disabled:opacity-50 transition-colors">{fineAckBusy ? "…" : "I understand"}</button>
            </div>
          </div>
        )}

       {activeTab === "tasks" && user && user.role === "Founder's Office" && <FounderDashboard user={user} />}
      {activeTab === "tasks" && user?.role === "Head Chef" && (
          <div>
            <div className="flex justify-between items-end mb-6 pb-5 border-b border-zinc-800">
              <div>
                <h2 className="text-2xl font-black tracking-tight">Kitchen Operations</h2>
                <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Daily production & workload · {user.name.split(" ")[0]}</p>
              </div>
              <input type="date" value={kDate} onChange={(e) => { setKDate(e.target.value); fetchKProduction(e.target.value); }} className="bg-black border border-zinc-800 text-white px-4 py-2.5 focus:outline-none focus:border-yellow-400 transition-colors font-mono text-sm" />
            </div>

            <div className="mb-8 border border-zinc-800 p-5 max-w-3xl">
              <p className="text-sm font-semibold mb-4">Assign production</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div><label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Chef</label><select value={kForm.chef_id} onChange={(e) => setKForm(pp => ({ ...pp, chef_id: e.target.value }))} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1"><option value="">— pick —</option>{kChefs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div><label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Flavour / item</label><input type="text" value={kForm.flavour} onChange={(e) => setKForm(pp => ({ ...pp, flavour: e.target.value }))} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1" placeholder="Choco truffle" list="kproducts" /><datalist id="kproducts">{kProducts.map((pr) => <option key={pr.id} value={pr.name} />)}</datalist></div>
                <div><label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Count</label><input type="number" value={kForm.qty} onChange={(e) => setKForm(pp => ({ ...pp, qty: e.target.value }))} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1" placeholder="30" /></div>
                <div><label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Station</label><input list="kstations" value={kForm.station} onChange={(e) => setKForm(pp => ({ ...pp, station: e.target.value }))} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1" placeholder="Icing" /><datalist id="kstations"><option value="Icing" /><option value="Chocolate garnish" /><option value="Whipped cream" /><option value="Baking" /><option value="Decoration" /><option value="Packing" /></datalist></div>
              </div>
              <button onClick={addKProd} disabled={kBusy} className="mt-4 bg-yellow-400 text-black px-5 py-2 text-sm font-semibold hover:bg-yellow-300 disabled:opacity-50 transition-colors">{kBusy ? "Adding…" : "Add"}</button>
            </div>

            <div className="mb-8 border border-zinc-800 p-5 max-w-3xl">
              <p className="text-sm font-semibold mb-1">Customised order</p>
              <p className="text-xs text-zinc-500 mb-4">Hotel / Sangam / one-off custom cakes. These land under &quot;Customised&quot; in the production list.</p>
              <div className="flex gap-2 mb-3">
                {(["Sangam", "Hotel", "Customised cake"] as const).map((t) => (
                  <button key={t} onClick={() => setKcType(t)} className={`px-3 py-1.5 text-sm font-semibold transition-colors ${kcType === t ? "bg-orange-500 text-black" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}>{t}</button>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {kcType === "Hotel" && <div><label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Hotel name</label><input type="text" value={kcHotel} onChange={(e) => setKcHotel(e.target.value)} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1" placeholder="Taj" /></div>}
                <div><label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Item / description</label><input type="text" value={kcItem} onChange={(e) => setKcItem(e.target.value)} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1" placeholder="Choco truffle 1kg" /></div>
                <div><label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Count</label><input type="number" value={kcQty} onChange={(e) => setKcQty(e.target.value)} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1" placeholder="10" /></div>
                <div><label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Chef (optional)</label><select value={kcChef} onChange={(e) => setKcChef(e.target.value)} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1"><option value="">—</option>{kChefs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              </div>
              <button onClick={addKCustom} className="mt-4 bg-yellow-400 text-black px-5 py-2 text-sm font-semibold hover:bg-yellow-300 transition-colors">Add order</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">
              <div className="border border-zinc-800 p-4">
                <div className="flex justify-between items-baseline mb-3">
                  <p className="text-sm font-semibold">Workload balance</p>
                  <p className="text-[11px] font-mono text-zinc-500">Day total: {kDayTotal} · avg {kAvg}/chef</p>
                </div>
                {kByChef.length === 0 ? <p className="text-sm text-zinc-600">No chefs yet.</p> : (
                  <div className="space-y-2">
                    {kByChef.map((c) => { const over = kAvg > 0 && c.total > kAvg * 1.5; const under = kAvg > 0 && c.total > 0 && c.total < kAvg * 0.5; const w = Math.round(c.total / kMax * 100); return (
                      <div key={c.name}>
                        <div className="flex justify-between text-sm mb-0.5"><span>{c.name}</span><span className={`font-mono ${over ? "text-red-400" : "text-zinc-300"}`}>{c.total}{over ? " ⚠" : ""}</span></div>
                        <div className="h-2 bg-zinc-800"><div className={`h-full ${over ? "bg-red-500" : under ? "bg-zinc-600" : "bg-yellow-400"}`} style={{ width: `${w}%` }} /></div>
                      </div>
                    ); })}
                  </div>
                )}
                <p className="text-[10px] text-zinc-600 mt-3">⚠ = more than 1.5× the day's average — consider rebalancing.</p>
              </div>

              <div className="border border-zinc-800 p-4">
                <p className="text-sm font-semibold mb-3">Assignments · {kDate}</p>
                {kRows.length === 0 ? <p className="text-sm text-zinc-600">Nothing assigned yet.</p> : (
                  <div className="space-y-1.5">
                    {kRows.map((r) => (
                      <div key={r.id} className="flex items-baseline gap-2 text-sm border-b border-zinc-900 pb-1.5">
                        <span className="font-medium w-28">{r.chef_name}</span>
                        <span className="flex-1 text-zinc-400">{r.flavour || "—"}{r.station ? ` · ${r.station}` : ""}</span>
                        <span className="font-mono text-yellow-400">{r.qty}</span>
                        <button onClick={() => delKProd(r.id)} className="text-[10px] font-mono uppercase px-2 py-0.5 border border-zinc-700 hover:border-red-500 hover:text-red-500 transition-colors">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 border border-zinc-800 p-4 max-w-3xl">
              <div className="flex justify-between items-baseline mb-3">
                <p className="text-sm font-semibold">Production vs target · {kDate}</p>
                <button onClick={() => setKShowTargets(v => !v)} className="text-[11px] font-mono uppercase text-zinc-400 hover:text-white">{kShowTargets ? "Done" : "Set targets"}</button>
              </div>
              {kProducts.length === 0 ? <p className="text-sm text-zinc-600">No products yet.</p> : (
                <div className="space-y-4">
                  {kCats.map((cat) => { const items = kProdVsTarget.filter((pr) => pr.category === cat); const catMade = items.reduce((sm, pr) => sm + pr.made, 0); const catTgt = items.reduce((sm, pr) => sm + pr.target, 0); return (
                    <div key={cat}>
                      <div className="flex justify-between items-baseline mb-1.5"><p className="text-[11px] font-mono text-zinc-400 uppercase tracking-widest">{cat}</p><span className="font-mono text-xs text-zinc-500">{catMade}{catTgt > 0 ? ` / ${catTgt}` : ""}</span></div>
                      <div className="space-y-1.5">
                        {items.map((pr) => { const pct = pr.target > 0 ? Math.round(pr.made / pr.target * 100) : 0; const col = pr.target === 0 ? "bg-zinc-600" : pct >= 100 ? "bg-green-500" : pct >= 60 ? "bg-yellow-400" : "bg-red-500"; return (
                          <div key={pr.name}>
                            <div className="flex justify-between text-sm mb-0.5"><span>{pr.name}</span><span className="font-mono text-zinc-300">{pr.made}{pr.target > 0 ? ` / ${pr.target} · ${pct}%` : ""}</span></div>
                            <div className="h-2 bg-zinc-800"><div className={`h-full ${col}`} style={{ width: `${pr.target > 0 ? Math.min(100, pct) : (pr.made > 0 ? 100 : 0)}%` }} /></div>
                          </div>
                        ); })}
                      </div>
                    </div>
                  ); })}
                  {kCustom.length > 0 && (
                    <div>
                      <p className="text-[11px] font-mono text-orange-400 uppercase tracking-widest mb-1.5">Customised / special orders</p>
                      <div className="space-y-1">
                        {kCustom.map((r) => (
                          <div key={r.id} className="flex justify-between text-sm"><span>{r.flavour || "—"}{r.chef_name ? ` · ${r.chef_name}` : ""}</span><span className="font-mono text-orange-300">{r.qty}</span></div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {kShowTargets && (
                <div className="mt-4 pt-4 border-t border-zinc-800">
                  <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Daily target per product</p>
                  <div className="space-y-2">
                    {kProducts.map((pr) => (
                      <div key={pr.id} className="flex items-center gap-2 text-sm">
                        <span className="flex-1">{pr.name}</span>
                        <input type="number" value={kTgtEdits[pr.id] ?? String(pr.target_qty ?? 0)} onChange={(e) => setKTgtEdits(m => ({ ...m, [pr.id]: e.target.value }))} className="w-24 bg-black border border-zinc-800 text-white px-2 py-1 focus:outline-none focus:border-yellow-400 text-sm" />
                      </div>
                    ))}
                  </div>
                  <button onClick={saveKTargets} className="mt-3 bg-yellow-400 text-black px-4 py-1.5 text-sm font-semibold hover:bg-yellow-300 transition-colors">Save targets</button>
                </div>
              )}
            </div>

            <div className="mt-6 border border-zinc-800 p-4 max-w-md">
              <p className="text-sm font-semibold mb-2">Chefs</p>
              <p className="text-xs text-zinc-500 mb-3">{kChefs.map((c) => c.name).join(", ") || "None yet"}</p>
              <div className="flex gap-2">
                <input type="text" value={kNewChef} onChange={(e) => setKNewChef(e.target.value)} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1 flex-1" placeholder="Add a chef (e.g. Riyas)" />
                <button onClick={addKChef} className="bg-zinc-800 text-white px-4 py-2 text-sm font-semibold hover:bg-zinc-700 transition-colors self-end">Add</button>
              </div>
            </div>
          </div>
       )}
                    {activeTab === "tasks" && user?.role === "Financial Analyst" && (
          <div className="flex flex-col items-center justify-center py-24 text-center max-w-lg mx-auto">
            <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.3em] mb-3">{user.role}</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-3">Welcome, {user.name.split(" ")[0]}</h2>
            <p className="text-sm text-zinc-500 mb-8">Use the sidebar — Outlet &amp; Channel P&amp;L and Contribution Margins are live. Still building:</p>
            <div className="text-left w-full space-y-3 text-sm text-zinc-400 border border-zinc-800 p-5">
              <p>Weekly cash-flow forecasting</p>
              <p>Swiggy/Zomato net-realisation analysis</p>
            </div>
          </div>
       )}
       {activeTab === "pnl" && user?.role === "Financial Analyst" && (
          <div>
            <div className="flex justify-between items-start mb-6 pb-5 border-b border-zinc-800">
              <div>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight">Outlet & Channel P&amp;L</h2>
                <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Real fixed costs from Sales Target · 29.4% COGS · 5% wastage · 50% online commission</p>
              </div>
              <div className="flex gap-2">
                <input type="date" value={pnlFrom} onChange={(e) => setPnlFrom(e.target.value)} className="bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 text-sm font-mono" />
                <input type="date" value={pnlTo} onChange={(e) => setPnlTo(e.target.value)} className="bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 text-sm font-mono" />
                <button onClick={downloadPnlPDF} disabled={pnlPdfBusy} className="bg-yellow-400 text-black font-bold text-xs px-4 py-2 uppercase tracking-widest disabled:opacity-50 hover:opacity-90 transition-opacity">{pnlPdfBusy ? "Generating…" : "Download Report"}</button>
              </div>
            </div>
            {pnlLoading ? (
              <p className="text-sm text-zinc-500">Loading…</p>
            ) : pnlRows.length === 0 ? (
              <p className="text-sm text-zinc-500">No sales data for this range.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] font-mono text-zinc-500 uppercase border-b border-zinc-800">
                      <th className="py-2 pr-3">Outlet</th>
                      <th className="py-2 pr-3 text-right">Shop</th>
                      <th className="py-2 pr-3 text-right">Swiggy</th>
                      <th className="py-2 pr-3 text-right">Zomato</th>
                      <th className="py-2 pr-3 text-right">Total Sales</th>
                      <th className="py-2 pr-3 text-right">Contribution</th>
                      <th className="py-2 pr-3 text-right">Fixed Costs</th>
                      <th className="py-2 pr-3 text-right">Net Profit</th>
                      <th className="py-2 text-right">Net %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pnlRows.map((r) => (
                      <Fragment key={r.oid}>
                        <tr className="border-b border-zinc-900 cursor-pointer hover:bg-zinc-900" onClick={() => setPnlExpanded(pnlExpanded === r.oid ? null : r.oid)}>
                          <td className="py-2 pr-3 font-semibold">{r.name} <span className="text-zinc-600 text-xs">{pnlExpanded === r.oid ? "▲" : "▼"}</span></td>
                          <td className="py-2 pr-3 text-right font-mono text-xs text-zinc-400">₹{Math.round(r.shop.sales).toLocaleString("en-IN")}<br /><span className="text-zinc-600">{r.shop.margin.toFixed(0)}% margin</span></td>
                          <td className="py-2 pr-3 text-right font-mono text-xs text-zinc-400">₹{Math.round(r.swiggy.sales).toLocaleString("en-IN")}<br /><span className="text-zinc-600">{r.swiggy.margin.toFixed(0)}% margin</span></td>
                          <td className="py-2 pr-3 text-right font-mono text-xs text-zinc-400">₹{Math.round(r.zomato.sales).toLocaleString("en-IN")}<br /><span className="text-zinc-600">{r.zomato.margin.toFixed(0)}% margin</span></td>
                          <td className="py-2 pr-3 text-right font-mono font-semibold">₹{Math.round(r.totalSales).toLocaleString("en-IN")}</td>
                          <td className="py-2 pr-3 text-right font-mono text-zinc-400">₹{Math.round(r.totalContrib).toLocaleString("en-IN")}</td>
                          <td className="py-2 pr-3 text-right font-mono text-zinc-400">₹{Math.round(r.fixed).toLocaleString("en-IN")}</td>
                          <td className={`py-2 pr-3 text-right font-mono font-bold ${r.netProfit >= 0 ? "text-green-400" : "text-red-500"}`}>₹{Math.round(r.netProfit).toLocaleString("en-IN")}</td>
                          <td className={`py-2 text-right font-mono font-bold ${r.netMargin >= 0 ? "text-green-400" : "text-red-500"}`}>{r.netMargin.toFixed(1)}%</td>
                        </tr>
                        {pnlExpanded === r.oid && (
                          <tr className="bg-zinc-900/40">
                            <td colSpan={9} className="py-3 px-3">
                              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Fixed costs — {r.name} (from Sales Target)</p>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                                <div className="flex justify-between bg-black/40 px-2 py-1"><span className="text-zinc-500">Staff</span><span className="text-zinc-300">₹{Math.round(r.fixedBreakdown.staff).toLocaleString("en-IN")}</span></div>
                                <div className="flex justify-between bg-black/40 px-2 py-1"><span className="text-zinc-500">Rent</span><span className="text-zinc-300">₹{Math.round(r.fixedBreakdown.rent).toLocaleString("en-IN")}</span></div>
                                <div className="flex justify-between bg-black/40 px-2 py-1"><span className="text-zinc-500">Electricity</span><span className="text-zinc-300">₹{Math.round(r.fixedBreakdown.eb).toLocaleString("en-IN")}</span></div>
                                <div className="flex justify-between bg-black/40 px-2 py-1"><span className="text-zinc-500">Transport</span><span className="text-zinc-300">₹{Math.round(r.fixedBreakdown.transport).toLocaleString("en-IN")}</span></div>
                                <div className="flex justify-between bg-black/40 px-2 py-1"><span className="text-zinc-500">R&amp;M (20% rent)</span><span className="text-zinc-300">₹{Math.round(r.fixedBreakdown.rm).toLocaleString("en-IN")}</span></div>
                                <div className="flex justify-between bg-black/40 px-2 py-1"><span className="text-zinc-500">Pest control</span><span className="text-zinc-300">₹{Math.round(r.fixedBreakdown.pest).toLocaleString("en-IN")}</span></div>
                                <div className="flex justify-between bg-black/40 px-2 py-1"><span className="text-zinc-500">Water</span><span className="text-zinc-300">₹{Math.round(r.fixedBreakdown.water).toLocaleString("en-IN")}</span></div>
                                <div className="flex justify-between bg-black/40 px-2 py-1"><span className="text-zinc-500">Airtel/WiFi</span><span className="text-zinc-300">₹{Math.round(r.fixedBreakdown.airtel).toLocaleString("en-IN")}</span></div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
                <p className="text-[10px] text-zinc-600 mt-3">Fixed costs pulled from what's entered in Sales Target for each outlet (BH brand). Outlets with no fixed-cost entry yet show ₹0 there — worth flagging to whoever owns that outlet.</p>
              </div>
            )}
          </div>
       )}
       {activeTab === "net_realisation" && user?.role === "Financial Analyst" && (
          <div>
            <div className="flex justify-between items-start mb-6 pb-5 border-b border-zinc-800">
              <div>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight">Net Realisation</h2>
                <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">What Swiggy/Zomato actually pay vs the order value</p>
              </div>
              <div className="flex gap-2">
                <input type="date" value={nrFrom} onChange={(e) => setNrFrom(e.target.value)} className="bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 text-sm font-mono" />
                <input type="date" value={nrTo} onChange={(e) => setNrTo(e.target.value)} className="bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 text-sm font-mono" />
              </div>
            </div>
            {nrLoading ? (
              <p className="text-sm text-zinc-500">Loading…</p>
            ) : nrRows.length === 0 ? (
              <p className="text-sm text-zinc-500">No payouts entered yet for this range — add them in the Payout tab first.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] font-mono text-zinc-500 uppercase border-b border-zinc-800">
                      <th className="py-2 pr-3">Outlet</th>
                      <th className="py-2 pr-3">Platform</th>
                      <th className="py-2 pr-3">Period</th>
                      <th className="py-2 pr-3 text-right">Order Value</th>
                      <th className="py-2 pr-3 text-right">Actually Paid</th>
                      <th className="py-2 text-right">Realisation %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nrRows.map((r, i) => (
                      <tr key={i} className="border-b border-zinc-900">
                        <td className="py-2 pr-3 font-semibold">{r.outlet}</td>
                        <td className="py-2 pr-3">
                          <span className={`font-mono text-[10px] uppercase px-1.5 py-0.5 ${r.platform === "Swiggy" ? "bg-orange-500/10 text-orange-400" : "bg-red-500/10 text-red-400"}`}>{r.platform}</span>
                        </td>
                        <td className="py-2 pr-3 font-mono text-xs text-zinc-400">{r.periodStart} → {r.periodEnd}</td>
                        <td className="py-2 pr-3 text-right font-mono">₹{Math.round(r.gross).toLocaleString("en-IN")}</td>
                        <td className="py-2 pr-3 text-right font-mono">₹{Math.round(r.net).toLocaleString("en-IN")}</td>
                        <td className={`py-2 text-right font-mono font-bold ${r.pct == null ? "text-zinc-600" : r.pct < 50 ? "text-red-500" : r.pct < 65 ? "text-yellow-400" : "text-green-400"}`}>{r.pct == null ? "—" : r.pct.toFixed(1) + "%"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[10px] text-zinc-600 mt-3">Swiggy: both figures come straight from Swiggy's own statement, fully verified. Zomato: "Order Value" is the amount staff reported in Outlet Reports (Zomato's statement doesn't include a gross figure), so Zomato's % is directionally useful but not platform-verified like Swiggy's.</p>
              </div>
            )}
          </div>
       )}
       {activeTab === "contribution_margins" && user?.role === "Financial Analyst" && (
          <div>
            <div className="mb-6 pb-5 border-b border-zinc-800">
              <h2 className="text-2xl md:text-3xl font-black tracking-tight">Contribution Margins</h2>
              <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Outlet and product-level profitability</p>
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight mb-1">Outlet Contribution Margins</h3>
              <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mb-4">Ranked worst to best · same range as the P&amp;L tab</p>
              {pnlRows.length === 0 ? (
                <p className="text-sm text-zinc-500">No data yet — open the P&amp;L tab once first to load a date range.</p>
              ) : (
                <div className="space-y-1.5 max-w-2xl">
                  {[...pnlRows].sort((a, b) => a.netMargin - b.netMargin).map((r) => {
                    const col = r.netMargin >= 10 ? "text-green-400" : r.netMargin >= 0 ? "text-yellow-400" : "text-red-500";
                    const barW = Math.min(100, Math.max(2, Math.abs(r.netMargin) * 3));
                    return (
                      <div key={r.oid} className="flex items-center gap-3 text-sm">
                        <span className="w-28 shrink-0 font-medium">{r.name}</span>
                        <div className="flex-1 h-2 bg-zinc-800"><div className={`h-full ${r.netMargin >= 0 ? "bg-green-500" : "bg-red-500"}`} style={{ width: `${barW}%` }} /></div>
                        <span className={`font-mono w-14 text-right ${col}`}>{r.netMargin.toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-10 pt-6 border-t border-zinc-800">
              <h3 className="text-xl font-black tracking-tight mb-1">Product Contribution Margins</h3>
              <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mb-1">From the latest Item Performance upload</p>
              <p className="text-xs text-zinc-500 mb-4">Chain-wide, not split by outlet — Item Performance data doesn't carry an outlet field, so this shows overall product profitability, not per-outlet.</p>
              {cmLoading ? (
                <p className="text-sm text-zinc-500">Loading…</p>
              ) : cmProductRows.length === 0 ? (
                <p className="text-sm text-zinc-500">No Item Performance upload yet — upload one from the Item Performance tab first.</p>
              ) : (
                <div className="overflow-x-auto max-w-3xl">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[10px] font-mono text-zinc-500 uppercase border-b border-zinc-800">
                        <th className="py-2 pr-3">Product</th>
                        <th className="py-2 pr-3 text-right">Revenue</th>
                        <th className="py-2 pr-3 text-right">Units</th>
                        <th className="py-2 pr-3 text-right">Cost</th>
                        <th className="py-2 text-right">Margin %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...cmProductRows].sort((a, b) => b.revenue - a.revenue).slice(0, 20).map((p, i) => (
                        <tr key={i} className="border-b border-zinc-900">
                          <td className="py-2 pr-3">{p.name}</td>
                          <td className="py-2 pr-3 text-right font-mono">₹{Math.round(p.revenue).toLocaleString("en-IN")}</td>
                          <td className="py-2 pr-3 text-right font-mono text-zinc-400">{p.units.toLocaleString("en-IN")}</td>
                          <td className="py-2 pr-3 text-right font-mono text-zinc-400">{p.cost != null ? "₹" + Math.round(p.cost).toLocaleString("en-IN") : "—"}</td>
                          <td className={`py-2 text-right font-mono font-bold ${p.marginPct == null ? "text-zinc-600" : p.marginPct < 40 ? "text-red-500" : p.marginPct < 60 ? "text-yellow-400" : "text-green-400"}`}>{p.marginPct == null ? "no cost data" : p.marginPct.toFixed(1) + "%"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[10px] text-zinc-600 mt-2">"no cost data" means that product isn't in the recipe cost map yet — margin can't be calculated until it is.</p>
                </div>
              )}
            </div>
          </div>
       )}
       {activeTab === "tasks" && user?.role !== "Founder's Office" && user?.role !== "Head Chef" && user?.role !== "Financial Analyst" && (
         <div>
            {canAssign && compTop && (compHeadlineOn || user?.role === "Owner") && (
              <div className="mb-6 border border-zinc-800 bg-zinc-900/40 px-5 py-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    {compHeadlineOn ? (
                      <>
                        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Competition watch · {compActivePeriod}</p>
                        <p className="text-base md:text-lg">{compFunny.playful}</p>
                      </>
                    ) : (
                      <p className="text-[11px] font-mono text-zinc-600 uppercase tracking-widest">Competition headline is hidden for everyone</p>
                    )}
                  </div>
                  {user?.role === "Owner" && (
                    <button onClick={toggleCompHeadline} className="shrink-0 text-[10px] font-mono uppercase px-3 py-1.5 border border-zinc-700 hover:border-yellow-400 hover:text-yellow-400 transition-colors">{compHeadlineOn ? "Hide for all" : "Show for all"}</button>
                  )}
                </div>
              </div>
            )}
           <p className="text-yellow-400 text-sm font-mono uppercase tracking-wide mb-2">🧾 Coming soon: Cheque Tracking System — landing in the next few days</p>
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
    <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">{canAssign ? "All 12 outlets" : `Your ${(user.outlets || []).length} outlets`} — daily tracker</p>
  </div>
  <input
    type="date"
    value={historyDate}
   onChange={(e) => { setHistoryDate(e.target.value); fetchAllOutletReports(e.target.value); }}
    className="bg-black border border-zinc-800 text-white px-4 py-2.5 focus:outline-none focus:border-yellow-400 transition-colors font-mono text-sm"
  />
</div>
    <div className="mb-8">
    <div className="flex items-center justify-between mb-3">
      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Outlet Health — since June launch</p>
          <button onClick={downloadOutletHealthPDF} disabled={outletHealthPdfBusy} className="px-3 py-1.5 border border-zinc-800 text-zinc-400 hover:border-yellow-400 hover:text-yellow-400 transition-colors disabled:opacity-50 text-[10px] font-mono uppercase tracking-widest">
        {outletHealthPdfBusy ? "…" : "Export"}
      </button>
    </div>
    <div className="mb-4">
      <select value={outletHealthSel} onChange={(e) => setOutletHealthSel(e.target.value)} className="bg-black border border-zinc-800 text-white px-3 py-2 text-sm focus:outline-none focus:border-yellow-400">
        {OUTLETS.map((o) => <option key={o} value={o}>{OUTLET_NAMES[o] || o}</option>)}
      </select>
    </div>
    {outletHealthLoading ? <p className="text-sm text-zinc-500">Loading…</p> : (() => {
      const o = outletHealthData.find((x) => x.oid === outletHealthSel);
      if (!o) return null;
      const healthColor = o.health === "Strong" ? "text-green-400" : o.health === "On track" ? "text-yellow-400" : o.health === "Needs attention" ? "text-orange-400" : o.health === "Struggling" ? "text-red-500" : "text-zinc-600";
      const trendArrow = o.trendPct == null ? "" : o.trendPct > 0 ? "▲" : o.trendPct < 0 ? "▼" : "—";
      return (
        <div className="bg-[#131316] border border-zinc-800 p-5 max-w-2xl">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-sm">{o.name}</p>
            <span className={`font-mono text-[10px] uppercase tracking-widest ${healthColor}`}>{o.health}</span>
          </div>
          <p className="text-2xl font-black">₹{Math.round(o.thisMonthTotal).toLocaleString("en-IN")}</p>
          <p className="text-xs text-zinc-500 mb-3">this month{o.pct > 0 ? ` · ${o.pct.toFixed(0)}% of target` : ""}{o.trendPct != null ? ` · ${trendArrow} ${Math.abs(o.trendPct).toFixed(0)}% vs last month` : ""}</p>
          <p className="text-xs text-zinc-400">{o.name} is {o.trendLabel === "growing" ? "trending up" : o.trendLabel === "declining" ? "trending down" : "holding steady"} month over month.{o.health === "Struggling" ? " Worth a closer look — consistently underperforming." : o.health === "Strong" ? " Performing well, keep the momentum." : ""}</p>
        </div>
      );
    })()}
  </div>

  <div className="bg-[#131316] border border-zinc-800 p-5 mb-6">
    <p className="text-sm font-bold uppercase tracking-widest mb-1">📥 Download custom report</p>
    <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-4">Pick a date range + outlets · Excel or PDF · daily rows + summary</p>
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <label className="text-[10px] font-mono text-zinc-500 uppercase">Outlets {repOutlets.length === 0 ? "(all)" : `(${repOutlets.length})`}</label>
        <div className="flex gap-2">
          <button onClick={() => setRepOutlets([...OUTLETS])} className="text-[10px] font-mono text-yellow-400 uppercase">All</button>
          <button onClick={() => setRepOutlets([])} className="text-[10px] font-mono text-zinc-500 uppercase">Clear</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {(canAssign ? OUTLETS : (user.outlets || [])).map(o => { const on = repOutlets.includes(o); return (
          <button key={o} onClick={() => setRepOutlets(on ? repOutlets.filter(x => x !== o) : [...repOutlets, o])} className={`text-[11px] px-3 py-1.5 border font-mono uppercase tracking-wide transition-colors ${on ? "bg-yellow-400 text-black border-yellow-400" : "bg-black text-zinc-400 border-zinc-800 hover:border-zinc-600"}`}>{OUTLET_NAMES[o] || o}</button>
        ); })}
      </div>
    </div>
    <div className="mb-4">
      <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-2">Range</label>
      <div className="flex flex-wrap items-center gap-2">
        <select value={repQuickRange} onChange={e => applyQuickRange(e.target.value)} className="bg-black border border-zinc-800 text-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-yellow-400">
          {RANGE_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        {repQuickRange === "custom" && !repCustomizePerOutlet && (
          <>
            <input type="date" value={repQuickFrom} onChange={e => applyQuickCustom(e.target.value, repQuickTo)} className="bg-black border border-zinc-800 text-white px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-yellow-400" />
            <span className="text-zinc-600 text-xs">to</span>
            <input type="date" value={repQuickTo} onChange={e => applyQuickCustom(repQuickFrom, e.target.value)} className="bg-black border border-zinc-800 text-white px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-yellow-400" />
          </>
        )}
        <button onClick={() => setRepCustomizePerOutlet(v => !v)} className="text-[11px] font-mono text-yellow-400 uppercase underline ml-1">{repCustomizePerOutlet ? "Use one range for all" : "Customize per outlet"}</button>
      </div>
      {repCustomizePerOutlet && (
        <div className="space-y-2 mt-3">
          {activeRepOutlets().map(o => {
            const sel = getOutletSel(o);
            return (
              <div key={o} className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono w-28 shrink-0 text-zinc-300">{OUTLET_NAMES[o] || o}</span>
                <select value={sel.preset} onChange={e => setOutletRangeSel({ ...outletRangeSel, [o]: { ...sel, preset: e.target.value } })} className="bg-black border border-zinc-800 text-white px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-yellow-400">
                  {RANGE_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                {sel.preset === "custom" && (
                  <>
                    <input type="date" value={sel.from || ""} onChange={e => setOutletRangeSel({ ...outletRangeSel, [o]: { ...sel, from: e.target.value } })} className="bg-black border border-zinc-800 text-white px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-yellow-400" />
                    <span className="text-zinc-600 text-xs">to</span>
                    <input type="date" value={sel.to || ""} onChange={e => setOutletRangeSel({ ...outletRangeSel, [o]: { ...sel, to: e.target.value } })} className="bg-black border border-zinc-800 text-white px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-yellow-400" />
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
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
            {(canAssign ? OUTLETS : (user.outlets || [])).map(o => {
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
         <button key={o} onClick={() => { setActiveOutlet(o); const lastRatings = lastOutletRatings[o]; setOutletReportData({ target: String(dailyTargetFor(o, new Date().toISOString().slice(0, 7))), bh_google_rating: lastRatings ? String(lastRatings.bh_google_rating || "") : "", bh_swiggy_rating: lastRatings ? String(lastRatings.bh_swiggy_rating || "") : "", bh_zomato_rating: lastRatings ? String(lastRatings.bh_zomato_rating || "") : "", cbh_google_rating: lastRatings ? String(lastRatings.cbh_google_rating || "") : "", cbh_swiggy_rating: lastRatings ? String(lastRatings.cbh_swiggy_rating || "") : "", cbh_zomato_rating: lastRatings ? String(lastRatings.cbh_zomato_rating || "") : "", icbh_google_rating: lastRatings ? String(lastRatings.icbh_google_rating || "") : "", icbh_swiggy_rating: lastRatings ? String(lastRatings.icbh_swiggy_rating || "") : "", icbh_zomato_rating: lastRatings ? String(lastRatings.icbh_zomato_rating || "") : "" }); }}
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
  { label: "Discount Given (Rs)", key: "discount_given" },
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
        {activeTab === "ceo_report" && (isOwner || isFO) && (
          <div>
            <div className="mb-6">
              <h2 className="text-3xl font-black tracking-tight">{(() => { const h = new Date().getHours(); return h < 12 ? "Good morning ☕" : h < 17 ? "Good afternoon 🌤️" : "Good evening 🌙"; })()}</h2>
              <p className="text-sm text-zinc-500 mt-1">{user?.name?.split(" ")[0]} — here's the team and the month at a glance.</p>
            </div>
            <div className="flex gap-2 mb-6">
              {[{ k: "1", l: "Yesterday" }, { k: "7", l: "Last 7 days" }, { k: "30", l: "Last 30 days" }].map((w) => (
                <button key={w.k} onClick={() => { setCeoWin(w.k); fetchCeoData(w.k); }} className={`px-3 py-1.5 text-sm font-semibold transition-colors ${ceoWin === w.k ? "bg-yellow-400 text-black" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}>{w.l}</button>
              ))}
            </div>
            {(() => {
              const ceo = computeCeoData(ceoRepRows, ceoMonthRep, ceoWin);
              const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
              const toneC: Record<string, string> = { red: "text-red-400", green: "text-green-400", amber: "text-yellow-400", gray: "text-zinc-300" };
              return (
                <>
                  <div className="flex justify-end gap-2 mb-2 max-w-3xl">
                    {isFO && <button onClick={pushCeoPopupToNishant} disabled={ceoPushSending} className="bg-yellow-400 text-black px-4 py-2 text-sm font-semibold hover:bg-yellow-300 disabled:opacity-50 transition-colors">{ceoPushSending ? "Pushing…" : "📣 Push to Nishant"}</button>}
                    <button onClick={downloadCeoPDF} className="bg-zinc-800 text-white px-4 py-2 text-sm font-semibold hover:bg-zinc-700 transition-colors">Download report (PDF)</button>
                    <button onClick={() => ceoCustomOpen ? setCeoCustomOpen(false) : openCeoCustom()} className="bg-black border border-yellow-400 text-yellow-400 px-4 py-2 text-sm font-semibold hover:bg-yellow-400 hover:text-black transition-colors">🗓️ Custom date &amp; outlets</button>
                  </div>
                  {ceoCustomOpen && (
                    <div className="mb-4 max-w-3xl bg-[#131316] border border-zinc-800 p-4">
                      <div className="flex flex-wrap gap-3 mb-3">
                        <div><label className="text-[10px] font-mono text-zinc-500 uppercase block mb-1">From</label><input type="date" value={ceoCustomFrom} onChange={e => setCeoCustomFrom(e.target.value)} className="bg-black border border-zinc-800 text-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-yellow-400" /></div>
                        <div><label className="text-[10px] font-mono text-zinc-500 uppercase block mb-1">To</label><input type="date" value={ceoCustomTo} onChange={e => setCeoCustomTo(e.target.value)} className="bg-black border border-zinc-800 text-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-yellow-400" /></div>
                      </div>
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-[10px] font-mono text-zinc-500 uppercase">Outlets {ceoCustomOutlets.length === 0 ? "(all)" : `(${ceoCustomOutlets.length})`}</label>
                          <button onClick={() => setCeoCustomOutlets([])} className="text-[10px] font-mono text-zinc-500 uppercase">Reset to all</button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {OUTLETS.map(o => { const on = ceoCustomOutlets.includes(o); return (
                            <button key={o} onClick={() => setCeoCustomOutlets(on ? ceoCustomOutlets.filter(x => x !== o) : [...ceoCustomOutlets, o])} className={`text-[11px] px-3 py-1.5 border font-mono uppercase tracking-wide transition-colors ${on ? "bg-yellow-400 text-black border-yellow-400" : "bg-black text-zinc-400 border-zinc-800 hover:border-zinc-600"}`}>{OUTLET_NAMES[o] || o}</button>
                          ); })}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={downloadCeoPDFCustom} disabled={ceoCustomBusy} className="bg-yellow-400 text-black font-bold text-xs px-5 py-2.5 uppercase tracking-widest disabled:opacity-50 hover:opacity-90">{ceoCustomBusy ? "Generating…" : "Generate PDF"}</button>
                        <button onClick={() => setCeoCustomOpen(false)} className="text-zinc-500 text-xs font-mono uppercase px-3">Cancel</button>
                      </div>
                    </div>
                  )}
                  <div className="mb-6 border border-zinc-800 p-5 max-w-3xl">
                    <p className="text-sm font-bold mb-1">👀 Who's on top of it — and who's slipping</p>
                    <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mb-4">Report filing · {ceoWin === "1" ? "yesterday" : `last ${ceo.winDays} days`}</p>
                    <div className="space-y-2">
                      {ceo.acct.map((a) => (
                        <div key={a.name} className="flex items-baseline gap-2 text-sm">
                          <span className="font-medium w-24">{a.name}</span>
                          <span className={`flex-1 ${toneC[a.tone]}`}>{a.tag}</span>
                        </div>
                      ))}
                      <div className="flex items-baseline gap-2 text-sm pt-2 border-t border-zinc-900">
                        <span className="font-medium w-24">Niranjana</span>
                        <span className="flex-1 text-zinc-500">Founder's Office — MIA from daily reports 😎 but she built this thing, so we'll let it slide</span>
                      </div>
                    </div>
                  </div>
                  <div className="mb-6 border border-zinc-800 p-5 max-w-3xl">
                    <p className="text-sm font-bold mb-1">📈 Are we going to make the month?</p>
                    <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mb-4">{ceo.ym} · day {ceo.daysElapsed} of {ceo.daysInMonth}</p>
                    <div className="flex items-end justify-between mb-3 flex-wrap gap-3">
                      <div>
                        <p className="text-3xl font-black">{inr(ceo.monthSales)}</p>
                        <p className={`text-sm font-mono ${ceo.onTrack ? "text-green-400" : "text-yellow-400"}`}>{ceo.salesPct.toFixed(0)}% of {inr(ceo.monthTgt)} target · {ceo.onTrack ? "on pace ✅" : "behind pace ⚠️"}</p>
                      </div>
                      <div className="text-right text-xs text-zinc-500 font-mono">
                        <p>Time elapsed: {ceo.timePct.toFixed(0)}%</p>
                        <p>Sales so far: {ceo.salesPct.toFixed(0)}%</p>
                      </div>
                    </div>
                    {ceo.drag && <p className="text-sm text-red-400">🔻 Dragging: <span className="font-medium">{ceo.drag.name}</span> — {ceo.drag.pct.toFixed(0)}% of target</p>}
                    {ceo.hero && <p className="text-sm text-green-400 mt-0.5">🔺 Carrying: <span className="font-medium">{ceo.hero.name}</span> — {ceo.hero.pct.toFixed(0)}% of target</p>}
                    <button onClick={() => setActiveTab("owner_outlets")} className="mt-4 text-xs font-mono uppercase text-zinc-400 hover:text-yellow-400 transition-colors">See full sales →</button>
                  </div>
                  <div className="mb-6 border-2 border-yellow-500/30 bg-yellow-500/5 p-5 max-w-3xl">
                    <p className="text-sm font-bold mb-3 text-yellow-400">💡 Ideas to act on</p>
                    <ul className="space-y-2 list-disc list-inside">
                      {ceo.ideas.map((idea, i) => <li key={i} className="text-sm text-white">{idea}</li>)}
                    </ul>
                  </div>
                  <div className="mb-6 border border-zinc-800 p-5 max-w-3xl">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-bold">💰 Gross margin by outlet</p>
                      {marginMonths.length > 0 && (
                        <select value={marginMonth} onChange={(e) => { setMarginMonth(e.target.value); fetchMargin(e.target.value); }} className="bg-black border border-zinc-800 text-white px-2 py-1 text-xs focus:outline-none focus:border-yellow-400">
                          {marginMonths.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mb-4">Sales − true food cost · dispatch-based</p>
                    {marginLoading ? (
                      <p className="text-sm text-zinc-500">Loading…</p>
                    ) : marginData.length === 0 ? (
                      <p className="text-sm text-zinc-500">No data for this month yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-[11px] font-mono text-zinc-500 uppercase">
                              <th className="py-1">Outlet</th>
                              <th className="py-1 text-right">Sales</th>
                              <th className="py-1 text-right">Food cost</th>
                              <th className="py-1 text-right">Margin</th>
                              <th className="py-1 text-right">%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...marginData].sort((a: any, b: any) => (a.marginPercent ?? 0) - (b.marginPercent ?? 0)).map((m: any) => (
                              <tr key={m.outletId} className="border-t border-zinc-800">
                                <td className="py-1.5">{m.outletName}</td>
                                <td className="py-1.5 text-right font-mono">{inr(m.salesNet)}</td>
                                <td className="py-1.5 text-right font-mono text-zinc-400">{inr(m.cogs)}</td>
                                <td className={`py-1.5 text-right font-mono ${m.grossMargin < 0 ? "text-red-400" : "text-zinc-300"}`}>{inr(m.grossMargin)}</td>
                                <td className={`py-1.5 text-right font-mono ${m.marginPercent == null ? "text-zinc-600" : m.marginPercent < 40 ? "text-red-400" : m.marginPercent < 60 ? "text-yellow-400" : "text-green-400"}`}>{m.marginPercent == null ? "—" : m.marginPercent.toFixed(1) + "%"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p className="text-[10px] text-zinc-600 mt-3">A few products (combo boxes, some newer items) don't have a confirmed recipe cost yet, so their cost is left out — true margin is a little lower than shown. Franchise outlets aren't included.</p>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-600 max-w-3xl">Ideas are rule-based for now — the smarter AI-written version is the next phase. Purchases, stock and wastage aren't tracked yet.</p>
                </>
              );
            })()}
          </div>
        )}

                 {activeTab === "niranjana_report" && (isOwner || isFO) && (
          <div>
            <div className="mb-6 pb-5 border-b border-zinc-800">
              <h2 className="text-2xl font-black tracking-tight">Niranjana's Report</h2>
              <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">What's been built, day by day</p>
            </div>
            {isFO && (
              <div className="mb-8 border border-zinc-800 p-5 max-w-3xl">
                <p className="text-sm font-semibold mb-3">Add today's entry</p>
                <div className="flex flex-wrap gap-3 mb-3">
                  <input type="date" value={nrNewDate} onChange={(e) => setNrNewDate(e.target.value)} className="bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm" />
                </div>
                <textarea value={nrNewContent} onChange={(e) => setNrNewContent(e.target.value)} rows={4} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm" placeholder="What did you build/fix today?" />
                <button onClick={saveNrEntry} disabled={nrSaving} className="mt-3 bg-yellow-400 text-black px-5 py-2 text-sm font-semibold hover:bg-yellow-300 disabled:opacity-50 transition-colors">{nrSaving ? "Saving…" : "Push to report"}</button>
              </div>
            )}
            <div className="max-w-3xl space-y-4 text-sm text-zinc-300 leading-relaxed">
              {nrEntries.length === 0 ? <p className="text-zinc-600">No entries yet.</p> : nrEntries.map((e) => (
                <p key={e.id}><span className="text-yellow-400 font-mono text-xs mr-2">{new Date(e.entry_date + "T00:00:00").toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</span>{e.content}</p>
              ))}
            </div>
          </div>
        )}
        {activeTab === "fines" && (canAssign || isFO) && (
          <div>
            <div className="mb-6 pb-5 border-b border-zinc-800">
              <h2 className="text-2xl font-black tracking-tight">Fines</h2>
              <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Log a fine · it also hits their leaderboard score</p>
            </div>
            <div className="mb-8 border border-zinc-800 p-5 max-w-3xl">
              <p className="text-sm font-semibold mb-1">Issue a fine</p>
              <p className="text-xs text-zinc-500 mb-4">Pick who's fined (e.g. for a 1-star review), set the reason and amount. Each selected person is fined the same amount.</p>
              <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Who</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {(ALL_STAFF as any[]).filter((s) => s.id !== "nishant").map((s) => { const on = fineStaff.includes(s.id); return (
                  <button key={s.id} onClick={() => setFineStaff((pp) => on ? pp.filter((x) => x !== s.id) : [...pp, s.id])} className={`px-3 py-1.5 text-sm font-semibold transition-colors ${on ? "bg-red-500 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}>{s.name.split(" ")[0]}</button>
                ); })}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div><label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Reason</label><input type="text" value={fineReason} onChange={(e) => setFineReason(e.target.value)} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1" placeholder="1-star review" /></div>
                <div><label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Amount (₹)</label><input type="number" value={fineAmount} onChange={(e) => setFineAmount(e.target.value)} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1" /></div>
                <div><label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Date</label><input type="date" value={fineDate} onChange={(e) => setFineDate(e.target.value)} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1" /></div>
                <div><label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Outlet (optional)</label><select value={fineOutlet} onChange={(e) => setFineOutlet(e.target.value)} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1"><option value="">—</option>{OUTLETS.map((o) => <option key={o} value={o}>{OUTLET_NAMES[o] || o}</option>)}</select></div>
              </div>
              <button onClick={saveFine} disabled={fineBusy} className="mt-4 bg-red-500 text-white px-5 py-2 text-sm font-semibold hover:bg-red-400 disabled:opacity-50 transition-colors">{fineBusy ? "Saving…" : `Fine ${fineStaff.length || 0} ${fineStaff.length === 1 ? "person" : "people"}`}</button>
            </div>
            <div className="max-w-3xl">
              <p className="text-sm font-semibold mb-3">Recent fines</p>
              {fines.length === 0 ? <p className="text-sm text-zinc-600">No fines yet.</p> : (
                <div className="space-y-1.5">
                  {fines.map((f) => (
                    <div key={f.id} className="flex items-baseline gap-3 text-sm border-b border-zinc-900 pb-1.5">
                      <span className="font-medium w-24">{f.staff_name}</span>
                      <span className="flex-1 text-zinc-400">{f.reason}{f.outlet ? ` · ${OUTLET_NAMES[f.outlet] || f.outlet}` : ""}</span>
                      <span className="font-mono text-red-400">−₹{Number(f.amount).toLocaleString("en-IN")}</span>
                      <span className="font-mono text-zinc-600 text-xs">{f.fine_date}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "item_perf" && (
          <div>
            <div className="mb-8 pb-5 border-b border-zinc-800">
              <h2 className="text-2xl font-black tracking-tight">Item Performance</h2>
              <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">UrbanPiper item export · price vs demand</p>
            </div>

            {canUploadItemPerf && (
              <div className="mb-8 border border-zinc-800 p-5 max-w-3xl">
                <p className="text-sm font-semibold mb-1">Upload item export</p>
                <p className="text-xs text-zinc-500 mb-4">CSV or Excel from UrbanPiper Prime (revenue by item). Pick the window it covers.</p>
                <div className="flex flex-wrap gap-3 items-end">
                  <div><label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Window</label><select value={ipDays} onChange={(e) => setIpDays(e.target.value)} className="bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1 w-36"><option value="7">Last 7 days</option><option value="10">Last 10 days</option><option value="30">Last 30 days</option></select></div>
                  <div><label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Label (optional)</label><input type="text" value={ipLabel} onChange={(e) => setIpLabel(e.target.value)} className="bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1 w-44" placeholder="1–30 Jul" /></div>
                  <label className="bg-zinc-800 text-white px-4 py-2 text-sm font-semibold hover:bg-zinc-700 cursor-pointer transition-colors">Choose file<input type="file" accept=".csv,.xlsx,.xls" onChange={onIpFile} className="hidden" /></label>
                </div>
                {ipParsed && (
                  <div className="mt-5">
                    <p className="text-xs text-zinc-500 mb-2">Parsed {ipParsed.length} items · preview (top 8 by revenue):</p>
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-[11px] font-mono text-zinc-500 uppercase"><th className="py-1">Item</th><th className="py-1 text-right">Revenue</th><th className="py-1 text-right">Units</th><th className="py-1 text-right">Avg ₹</th><th className="py-1 text-right">Lost</th></tr></thead>
                      <tbody>{[...ipParsed].sort((a, b) => (b.net_revenue || 0) - (a.net_revenue || 0)).slice(0, 8).map((r, i) => (
                        <tr key={i} className="border-t border-zinc-800"><td className="py-1.5">{r.name}</td><td className="py-1.5 text-right font-mono">{r.net_revenue != null ? "₹" + Number(r.net_revenue).toLocaleString("en-IN") : "—"}</td><td className="py-1.5 text-right font-mono text-zinc-400">{r.units_sold ?? "—"}</td><td className="py-1.5 text-right font-mono text-zinc-400">{r.avg_price != null ? "₹" + r.avg_price : "—"}</td><td className="py-1.5 text-right font-mono text-zinc-400">{r.lost_orders ?? "—"}</td></tr>
                      ))}</tbody>
                    </table>
                    <button onClick={saveIp} disabled={ipBusy} className="mt-4 bg-yellow-400 text-black px-5 py-2 text-sm font-semibold hover:bg-yellow-300 disabled:opacity-50 transition-colors">{ipBusy ? "Saving…" : `Save ${ipParsed.length} items`}</button>
                  </div>
                )}
              </div>
            )}

            <div className="mb-4 flex items-center gap-3 flex-wrap">
              <label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Upload</label>
              <select value={ipSel} onChange={(e) => { setIpSel(e.target.value); fetchIpRows(e.target.value); }} className="bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 text-sm">
                {ipUploads.length === 0 ? <option value="">No uploads yet</option> : ipUploads.map((u) => <option key={u.id} value={u.id}>{u.label} · {new Date(u.created_at).toLocaleDateString("en-IN")} · {u.row_count} items</option>)}
              </select>
            </div>
            <div className="flex gap-2 mb-6">
              <button onClick={() => setIpView("insights")} className={`px-4 py-2 text-sm font-semibold transition-colors ${ipView === "insights" ? "bg-yellow-400 text-black" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}>Insights</button>
              <button onClick={() => setIpView("data")} className={`px-4 py-2 text-sm font-semibold transition-colors ${ipView === "data" ? "bg-yellow-400 text-black" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}>Data</button>
            </div>
            {ipRows.length === 0 ? <p className="text-sm text-zinc-500">No data yet. {canUploadItemPerf ? "Upload an export above." : "Waiting for an upload."}</p> : ipView === "insights" ? (
              <div>
                {ipStats && (<>
                  <div className="flex items-center justify-between mb-4 max-w-3xl gap-3 flex-wrap">
                    <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">{(ipUploads.find((u) => u.id === ipSel)?.label) || ""}</p>
                    <button onClick={downloadIpPDF} className="bg-zinc-800 text-white px-4 py-2 text-sm font-semibold hover:bg-zinc-700 transition-colors">Download report (PDF)</button>
                  </div>
                  <div className="mb-6 border border-zinc-800 p-5 max-w-3xl">
                    <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mb-2">Headline</p>
                    <p className="text-lg md:text-xl mb-3">{ipStats.funny.headline}</p>
                    {ipStats.funny.suspect && <p className="text-sm text-orange-400 mb-1">{ipStats.funny.suspect}</p>}
                    {ipStats.funny.sweet && <p className="text-sm text-green-400 mb-1">{ipStats.funny.sweet}</p>}
                    {ipStats.funny.dead && <p className="text-sm text-red-400">{ipStats.funny.dead}</p>}
                  </div>
                  {[
                    { title: "🏆 Stars", sub: "The workhorses — protect these", rows: ipStats.stars, border: "border-green-500/30" },
                    { title: "👀 Priced-too-high suspects", sub: "High price, shy demand — worth a rethink", rows: ipStats.suspects, border: "border-orange-500/30" },
                    { title: "💚 Sweet-spot winners", sub: "Great price, flying off shelves", rows: ipStats.sweet, border: "border-green-500/30" },
                    { title: "💸 Money left on the table", sub: "People wanted it, didn't get it", rows: ipStats.moneyLeft, border: "border-yellow-500/30" },
                    { title: "💀 Dead weight", sub: "Barely moving — rework or retire?", rows: ipStats.dead, border: "border-red-500/30" },
                  ].map((b) => (
                    <div key={b.title} className={`mb-4 border ${b.border} p-4 max-w-3xl`}>
                      <p className="text-sm font-semibold">{b.title}</p>
                      <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mb-2">{b.sub}</p>
                      {b.rows.length === 0 ? <p className="text-sm text-zinc-600">None.</p> : (
                        <div className="space-y-1">
                          {b.rows.map((r, i) => (
                            <div key={i} className="flex items-baseline gap-3 text-sm">
                              <span className="flex-1">{r.name}</span>
                              <span className="font-mono text-zinc-400">{ipStats!.inr(r.price)}</span>
                              <span className="font-mono text-zinc-300 w-16 text-right">{r.units.toLocaleString("en-IN")}u</span>
                              <span className="font-mono text-zinc-500 w-16 text-right">{r.lost} lost</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </>)}
              </div>
            ) : (
              <div className="overflow-x-auto max-w-5xl border border-zinc-800">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-[11px] font-mono text-zinc-500 uppercase bg-zinc-900"><th className="py-2 px-3">Item</th><th className="py-2 px-3">Category</th><th className="py-2 px-3 text-right">Revenue</th><th className="py-2 px-3 text-right">Units</th><th className="py-2 px-3 text-right">Avg ₹</th><th className="py-2 px-3 text-right">Lost</th><th className="py-2 px-3 text-right">Orders/day</th></tr></thead>
                  <tbody>{ipRows.map((r) => (
                    <tr key={r.id} className="border-t border-zinc-800"><td className="py-1.5 px-3">{r.name}</td><td className="py-1.5 px-3 text-zinc-500 text-xs">{r.category}</td><td className="py-1.5 px-3 text-right font-mono">{r.net_revenue != null ? "₹" + Number(r.net_revenue).toLocaleString("en-IN") : "—"}</td><td className="py-1.5 px-3 text-right font-mono text-zinc-400">{r.units_sold ?? "—"}</td><td className="py-1.5 px-3 text-right font-mono text-zinc-400">{r.avg_price != null ? "₹" + r.avg_price : "—"}</td><td className="py-1.5 px-3 text-right font-mono text-zinc-400">{r.lost_orders ?? "—"}</td><td className="py-1.5 px-3 text-right font-mono text-zinc-400">{r.avg_orders_day ?? "—"}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "competition" && (
          <div>
            <div className="mb-8 pb-5 border-b border-zinc-800">
              <h2 className="text-2xl font-black tracking-tight">Competition</h2>
             <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Rival bakery sales · expansion signals</p>
            </div>

            <div className="flex gap-2 mb-6">
              <button onClick={() => setCompView("entry")} className={`px-4 py-2 text-sm font-semibold transition-colors ${compView === "entry" ? "bg-yellow-400 text-black" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}>Entry</button>
              <button onClick={() => setCompView("products")} className={`px-4 py-2 text-sm font-semibold transition-colors ${compView === "products" ? "bg-yellow-400 text-black" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}>Products</button>
              <button onClick={() => setCompView("insights")} className={`px-4 py-2 text-sm font-semibold transition-colors ${compView === "insights" ? "bg-yellow-400 text-black" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}>Insights</button>
            </div>

            {compView === "products" && (
              <div>
                <div className="mb-8 border border-zinc-800 p-5 max-w-3xl">
                  <p className="text-sm font-semibold mb-1">Paste a top-products table</p>
                  <p className="text-xs text-zinc-500 mb-4">Rank | Product | GMV | Orders | Units | Areas. Pick whose list it is first.</p>
                  <div className="flex gap-2 mb-3">
                    <button onClick={() => setProdSide("them")} className={`px-3 py-1.5 text-sm font-semibold transition-colors ${prodSide === "them" ? "bg-orange-500 text-black" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}>Their products</button>
                    <button onClick={() => setProdSide("us")} className={`px-3 py-1.5 text-sm font-semibold transition-colors ${prodSide === "us" ? "bg-green-500 text-black" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}>Our products</button>
                  </div>
                  <textarea value={prodPaste} onChange={(e) => setProdPaste(e.target.value)} rows={6} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm font-mono" placeholder="| Rank | Product | GMV | Orders | Units | Areas |" />
                  <div className="flex flex-wrap gap-3 mt-3 items-end">
                    {prodSide === "them" && <div><label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Competitor</label><input type="text" value={prodComp} onChange={(e) => setProdComp(e.target.value)} className="bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1 w-44" placeholder="Brownie Studio" /></div>}
                    <div><label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Period label</label><input type="text" value={prodLabel} onChange={(e) => setProdLabel(e.target.value)} className="bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1 w-40" placeholder="June 2026" /></div>
                    <div><label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Period date</label><input type="date" value={prodDate} onChange={(e) => setProdDate(e.target.value)} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1" /></div>
                    <button onClick={parseProd} className="bg-zinc-800 text-white px-4 py-2 text-sm font-semibold hover:bg-zinc-700 transition-colors">Parse</button>
                  </div>
                  {prodParsed && (
                    <div className="mt-5">
                      <table className="w-full text-sm">
                        <thead><tr className="text-left text-[11px] font-mono text-zinc-500 uppercase"><th className="py-1">#</th><th className="py-1">Product</th><th className="py-1 text-right">GMV</th><th className="py-1 text-right">Orders</th><th className="py-1 text-right">Units</th><th className="py-1 text-right">Areas</th></tr></thead>
                        <tbody>
                          {prodParsed.map((r, i) => (
                            <tr key={i} className="border-t border-zinc-800">
                              <td className="py-1.5 text-zinc-500">{i + 1}</td>
                              <td className="py-1.5">{r.product}</td>
                              <td className="py-1.5 text-right font-mono">{r.gmv != null ? compFmtL(r.gmv) : "—"}</td>
                              <td className="py-1.5 text-right font-mono text-zinc-400">{r.orders != null ? r.orders.toLocaleString("en-IN") : "—"}</td>
                              <td className="py-1.5 text-right font-mono text-zinc-400">{r.units != null ? r.units.toLocaleString("en-IN") : "—"}</td>
                              <td className="py-1.5 text-right font-mono text-zinc-400">{r.areas != null ? r.areas : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <button onClick={saveProd} disabled={prodSaving} className="mt-4 bg-yellow-400 text-black px-5 py-2 text-sm font-semibold hover:bg-yellow-300 disabled:opacity-50 transition-colors">{prodSaving ? "Saving…" : `Save ${prodParsed.length} products (${prodSide === "them" ? "theirs" : "ours"})`}</button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
                  {[{ side: "them", title: "🟠 Their top sellers", color: "text-orange-400" }, { side: "us", title: "🟢 Our top sellers", color: "text-green-400" }].map((col) => {
                    const rows = compProducts.filter((r) => r.side === col.side).sort((a, b) => (Number(b.gmv) || 0) - (Number(a.gmv) || 0)).slice(0, 15);
                    return (
                      <div key={col.side} className="border border-zinc-800 p-4">
                        <p className={`text-sm font-semibold mb-3 ${col.color}`}>{col.title}</p>
                        {rows.length === 0 ? <p className="text-sm text-zinc-600">Nothing saved yet.</p> : (
                          <div className="space-y-1.5">
                            {rows.map((r, i) => (
                              <div key={r.id} className="flex items-baseline gap-2 text-sm">
                                <span className="text-zinc-600 w-5">{i + 1}</span>
                                <span className="flex-1">{r.product}</span>
                                <span className="font-mono text-zinc-300">{r.gmv != null ? compFmtL(Number(r.gmv)) : "—"}</span>
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

            {compView === "insights" && (
              <div>
                <div className="mb-6 flex items-center gap-3 flex-wrap">
                  {compPeriods.length > 0 && (<><label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Period</label>
                    <select value={compActivePeriod} onChange={(e) => setCompPeriod(e.target.value)} className="bg-black border border-zinc-800 text-white px-3 py-2 text-sm focus:outline-none focus:border-yellow-400">
                      {compPeriods.map((pl) => <option key={pl} value={pl}>{pl}</option>)}
                    </select></>)}
                  {compPeriodRows.length > 0 && <button onClick={downloadCompPDF} className="ml-auto bg-zinc-800 text-white px-4 py-2 text-sm font-semibold hover:bg-zinc-700 transition-colors">Download report (PDF)</button>}
                </div>
                {compPeriodRows.length === 0 ? (
                  <p className="text-sm text-zinc-500">No competitor data yet. Add some in the Entry tab.</p>
                ) : (
                  <>
                    {compTop && (
                      <div className="mb-8 border border-zinc-800 p-5 max-w-2xl">
                        <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mb-3">Headline</p>
                        <p className="text-lg md:text-xl">{compFunny.playful}</p>
                      </div>
                    )}
                    {[
                      { title: "🟠 Expansion candidates", sub: "They lead where we're absent", rows: compExpansion, color: "text-orange-400", border: "border-orange-500/30" },
                      { title: "🔴 Defend", sub: "We're here but trailing", rows: compDefend, color: "text-red-400", border: "border-red-500/30" },
                      { title: "🟢 Winning", sub: "We're ahead", rows: compWinning, color: "text-green-400", border: "border-green-500/30" },
                    ].map((b) => (
                      <div key={b.title} className={`mb-6 border ${b.border} p-4 max-w-3xl`}>
                        <p className="text-sm font-semibold">{b.title}</p>
                        <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mb-3">{b.sub}</p>
                        {b.rows.length === 0 ? <p className="text-sm text-zinc-600">None this period.</p> : (
                          <div className="space-y-1.5">
                            {b.rows.map((r, i) => (
                              <div key={i} className="flex flex-wrap gap-x-4 items-baseline text-sm">
                                <span className="font-medium w-32">{r.area}</span>
                                <span className="text-zinc-400 w-36">{r.competitor}</span>
                                <span className="font-mono text-zinc-300">them {compFmtL(r.their)}</span>
                                <span className="font-mono text-zinc-500">us {r.our != null ? compFmtL(r.our) : "—"}</span>
                                <span className={`font-mono ml-auto ${b.color}`}>{compFmtL(Math.abs(r.gap))}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {compView === "entry" && (<>
            <div className="mb-8 border border-zinc-800 p-5 max-w-3xl">
              <p className="text-sm font-semibold mb-1">Paste sir&apos;s area comparison table</p>
              <p className="text-xs text-zinc-500 mb-4">Paste the &quot;Area | … GMV | Brownie Heaven GMV | Gap&quot; table. We parse the rows and compute the gap — you just review and save.</p>
              <textarea value={compPaste} onChange={(e) => setCompPaste(e.target.value)} rows={6} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm font-mono" placeholder="| Area | Brownie Studio GMV | Brownie Heaven GMV | Gap |" />
              <div className="flex flex-wrap gap-3 mt-3 items-end">
                <div><label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Competitor (fallback)</label><input type="text" value={compPasteComp} onChange={(e) => setCompPasteComp(e.target.value)} className="bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1 w-44" placeholder="only if table has no name" /></div>
                <div><label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Period label</label><input type="text" value={compPasteLabel} onChange={(e) => setCompPasteLabel(e.target.value)} className="bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1 w-40" placeholder="June 2026" /></div>
                <div><label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Period date</label><input type="date" value={compPasteDate} onChange={(e) => setCompPasteDate(e.target.value)} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1" /></div>
                <button onClick={parseComp} className="bg-zinc-800 text-white px-4 py-2 text-sm font-semibold hover:bg-zinc-700 transition-colors">Parse</button>
              </div>
              {compParsed && (
                <div className="mt-5">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-[11px] font-mono text-zinc-500 uppercase"><th className="py-1">Area</th><th className="py-1">Competitor</th><th className="py-1 text-right">Them</th><th className="py-1 text-right">Us</th><th className="py-1 text-right">Gap</th></tr></thead>
                    <tbody>
                      {compParsed.map((r, i) => { const gap = (r.their || 0) - (r.our || 0); return (
                        <tr key={i} className="border-t border-zinc-800">
                          <td className="py-1.5">{r.area}</td>
                          <td className="py-1.5">{r.competitor}</td>
                          <td className="py-1.5 text-right font-mono">{r.their != null ? "₹" + r.their.toLocaleString("en-IN") : "—"}</td>
                          <td className="py-1.5 text-right font-mono text-zinc-400">{r.our != null ? "₹" + r.our.toLocaleString("en-IN") : "—"}</td>
                          <td className={`py-1.5 text-right font-mono ${gap > 0 ? "text-orange-400" : "text-green-400"}`}>{gap > 0 ? "they +" : "we +"}₹{Math.abs(gap).toLocaleString("en-IN")}</td>
                        </tr>); })}
                    </tbody>
                  </table>
                  <button onClick={saveParsedComp} disabled={compSavingBulk} className="mt-4 bg-yellow-400 text-black px-5 py-2 text-sm font-semibold hover:bg-yellow-300 disabled:opacity-50 transition-colors">{compSavingBulk ? "Saving…" : `Save ${compParsed.length} rows`}</button>
                </div>
              )}
            </div>

            <div className="mb-8 border border-zinc-800 p-5 max-w-2xl">
              <p className="text-sm font-semibold mb-4">Log a competitor&apos;s numbers</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Competitor *</label><input type="text" value={compForm.competitor} onChange={(e) => setCompForm(pp => ({ ...pp, competitor: e.target.value }))} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1" placeholder="The Brownie Studio" /></div>
                <div><label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Area / locality</label><input type="text" value={compForm.area} onChange={(e) => setCompForm(pp => ({ ...pp, area: e.target.value }))} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1" placeholder="Perambur" /></div>
                <div><label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Specific address (optional)</label><input type="text" value={compForm.address} onChange={(e) => setCompForm(pp => ({ ...pp, address: e.target.value }))} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1" placeholder="123 Main Rd, Perambur" /></div>
                <div><label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Our outlet in this area</label><select value={compForm.our_outlet_id} onChange={(e) => setCompForm(pp => ({ ...pp, our_outlet_id: e.target.value }))} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1"><option value="">— none (we&apos;re not here) —</option>{OUTLETS.map((o) => <option key={o} value={o}>{(OUTLET_NAMES as any)[o] || o}</option>)}</select></div>
                <div><label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Their sales (₹)</label><input type="number" value={compForm.sales_value} onChange={(e) => setCompForm(pp => ({ ...pp, sales_value: e.target.value }))} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1" placeholder="800000" /></div>
                <div><label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Our sales here (₹, optional)</label><input type="number" value={compForm.our_sales} onChange={(e) => setCompForm(pp => ({ ...pp, our_sales: e.target.value }))} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1" placeholder="—" /></div>
                <div><label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Period label</label><input type="text" value={compForm.period_label} onChange={(e) => setCompForm(pp => ({ ...pp, period_label: e.target.value }))} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1" placeholder="July 2026" /></div>
                <div><label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Period date</label><input type="date" value={compForm.period_date} onChange={(e) => setCompForm(pp => ({ ...pp, period_date: e.target.value }))} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1" /></div>
                <div className="md:col-span-2"><label className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Note</label><input type="text" value={compForm.note} onChange={(e) => setCompForm(pp => ({ ...pp, note: e.target.value }))} className="w-full bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 transition-colors text-sm mt-1" placeholder="Sir&apos;s comment / context" /></div>
              </div>
              <button onClick={saveComp} disabled={compSaving} className="mt-4 bg-yellow-400 text-black px-5 py-2 text-sm font-semibold hover:bg-yellow-300 disabled:opacity-50 transition-colors">{compSaving ? "Saving…" : "Save entry"}</button>
            </div>

            <div className="max-w-3xl">
              <p className="text-sm font-semibold mb-3">Recent entries</p>
              {compRows.length === 0 ? (
                <p className="text-sm text-zinc-500">No entries yet.</p>
              ) : (
                <div className="space-y-2">
                  {compRows.slice(0, 10).map((r) => (
                    <div key={r.id} className="border border-zinc-800 px-4 py-3 text-sm flex flex-wrap gap-x-4 gap-y-1 items-baseline">
                      <span className="font-semibold">{r.competitor}</span>
                      {r.area && <span className="text-zinc-400">{r.area}</span>}
                      {r.sales_value != null && <span className="text-yellow-400 font-mono">₹{Number(r.sales_value).toLocaleString("en-IN")}</span>}
                      {r.our_sales != null && <span className="text-zinc-500 font-mono">us: ₹{Number(r.our_sales).toLocaleString("en-IN")}</span>}
                      {!r.our_outlet_id && <span className="text-[10px] font-mono text-orange-400 uppercase">no outlet here</span>}
                      {r.period_label && <span className="text-zinc-600 text-xs">{r.period_label}</span>}
                      {r.note && <span className="text-zinc-500 text-xs italic w-full">{r.note}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            </>)}
          </div>
        )}

        {activeTab === "analytics" && (
          <div>
            <div className="mb-8 pb-5 border-b border-zinc-800">
              <h2 className="text-2xl font-black tracking-tight">Analytics</h2>
                        <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Sales performance · channel mix</p>
            </div>

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
                    const w = Math.max(3, Math.round((r.points - pmin) / span * 100));
                    return (
                      <div key={r.id} className="mb-4">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium">{i + 1}. {r.name.split(" ")[0]}</span>
                         <span className="font-mono text-xs text-zinc-500">{r.dailyToday === "done" && <span className="text-green-400 mr-2">report ✓</span>}{r.dailyToday === "missed" && <span className="text-red-500 mr-2">report ✗</span>}{r.dailyToday === "pending" && <span className="text-zinc-500 mr-2">report …</span>}{r.dailyToday === "off" && <span className="text-zinc-600 mr-2">off</span>}{r.points} pts</span>
                        </div>
                        <div className="h-2 bg-zinc-800 border border-zinc-700">
                          <div className="h-full transition-all bg-zinc-500" style={{ width: `${w}%` }} />
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
