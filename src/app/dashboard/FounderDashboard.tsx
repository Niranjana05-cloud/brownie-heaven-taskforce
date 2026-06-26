"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Staff = { id: string; name: string; role: string; outlets?: string[] };

const OUTLETS = ["royapettah","adayar","bsr_mall","velachery","ra_puram","anna_nagar","pallavaram","vadapalani","besant_nagar","perumbakkam","tambaram","porur"];
const OUTLET_NAMES: Record<string, string> = {
  royapettah: "Royapettah", adayar: "Adyar", bsr_mall: "BSR Mall", velachery: "Velachery",
  ra_puram: "RA Puram", anna_nagar: "Anna Nagar", pallavaram: "Pallavaram", vadapalani: "Vadapalani",
  besant_nagar: "Besant Nagar", perumbakkam: "Perumbakkam", tambaram: "Tambaram", porur: "Porur",
};
const OUTLET_TARGETS: Record<string, number> = {
  royapettah: 80000, adayar: 18333, bsr_mall: 35000, ra_puram: 21666, anna_nagar: 50000,
  porur: 50000, perumbakkam: 13000, tambaram: 20000, velachery: 0, pallavaram: 0, vadapalani: 23333, besant_nagar: 11667,
};
const MONTHLY_TARGET = 8750000; // ₹87.5 L company-wide
const DUTY_STAFF = [
  { id: "arun", name: "Arun" }, { id: "nilani", name: "Nilani" }, { id: "vishnu", name: "Vishnu" },
  { id: "ahila", name: "Ahila" }, { id: "gowtham", name: "Gowtham" }, { id: "bharani", name: "Bharani" },
];
const OUTLET_OWNER: Record<string, string> = {
  ra_puram: "nilani", anna_nagar: "nilani", pallavaram: "nilani", vadapalani: "nilani",
  velachery: "vishnu", perumbakkam: "vishnu", tambaram: "vishnu", porur: "vishnu",
  royapettah: "ahila", adayar: "ahila", bsr_mall: "ahila", besant_nagar: "ahila",
};
const reviewPoints = (rating: number, valid: boolean) => {
  let p = 0;
  if (rating === 5) p += 5; else if (rating === 4) p += 3; else if (rating >= 1 && rating <= 2) p -= 5;
  if (valid) p -= 10;
  return p;
};
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const lakh = (n: number) => "₹" + (n / 100000).toFixed(2) + " L";

export default function FounderDashboard({ user }: { user: Staff }) {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [out, setOut] = useState<any[]>([]);
  const [month, setMonth] = useState<any[]>([]);
  const [daily, setDaily] = useState<any[]>([]);
  const [offRows, setOffRows] = useState<string[]>([]);
  const [stFixed, setStFixed] = useState<Record<string, any>>({});
  const [revs, setRevs] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const d0 = new Date(date + "T00:00:00");
  const monthStart = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, "0")}-01`;
  const daysInMonth = new Date(d0.getFullYear(), d0.getMonth() + 1, 0).getDate();
  const dayOfMonth = d0.getDate();

  useEffect(() => {
    (async () => {
      setLoading(true);
     const [o, mo, d, r, p, off, st] = await Promise.all([
        supabase.from("outlet_reports").select("*").eq("report_date", date),
        supabase.from("outlet_reports").select("outlet_id,report_date,shop_sales_value,swiggy_sales_value,zomato_sales_value,swiggy_sales_count,zomato_sales_count").gte("report_date", monthStart).lte("report_date", date),
        supabase.from("reports").select("staff_id,report_date,is_late,is_backfill,no_points").eq("report_date", date),
        supabase.from("outlet_reviews").select("*").eq("report_date", date),
        supabase.from("outlet_payouts").select("outlet_id,platform,period_start,amount_transferable,net_payout").order("period_start", { ascending: false }).limit(60),
        supabase.from("day_off").select("staff_id").eq("off_date", date),
        supabase.from("sales_target").select("outlet_id,line_items").eq("brand", "BH"),
      ]);
      setOut(o.data || []); setMonth(mo.data || []); setDaily(d.data || []); setRevs(r.data || []); setPayouts(p.data || []); setOffRows((off.data || []).map((x: any) => x.staff_id));
      const fm: Record<string, any> = {}; (st.data || []).forEach((row: any) => { fm[row.outlet_id] = row.line_items?.fixed || {}; }); setStFixed(fm);
      setLoading(false);
    })();
  }, [date, monthStart]);

  const n = (v: any) => Number(v) || 0;
  const sum = (rows: any[], k: string) => rows.reduce((s, r) => s + n(r[k]), 0);

  // today
  const tShop = sum(out, "shop_sales_value"), tSw = sum(out, "swiggy_sales_value"), tZo = sum(out, "zomato_sales_value");
  const tTotal = tShop + tSw + tZo;
  const swC = sum(out, "swiggy_sales_count"), zoC = sum(out, "zomato_sales_count");

  // month to date
  const mShop = sum(month, "shop_sales_value"), mOnline = sum(month, "swiggy_sales_value") + sum(month, "zomato_sales_value");
  const mtd = mShop + mOnline;
  const runRate = dayOfMonth > 0 ? mtd / dayOfMonth : 0;
  const projected = runRate * daysInMonth;
  const daysLeft = Math.max(daysInMonth - dayOfMonth, 0);
  const required = daysLeft > 0 ? (MONTHLY_TARGET - mtd) / daysLeft : 0;
  const targetPct = MONTHLY_TARGET > 0 ? (mtd / MONTHLY_TARGET) * 100 : 0;
  const shortfall = projected - MONTHLY_TARGET;
  const onTrack = projected >= MONTHLY_TARGET;
  const offlineRatio = mShop > 0 ? (mOnline / mShop) : 0;

  const pnl = OUTLETS.map(o => {
    const rows = month.filter((r: any) => r.outlet_id === o);
    const oNet = rows.reduce((s: number, r: any) => s + (Number(r.shop_sales_value) || 0) + (Number(r.swiggy_sales_value) || 0) + (Number(r.zomato_sales_value) || 0), 0);
    const oOnline = rows.reduce((s: number, r: any) => s + (Number(r.swiggy_sales_value) || 0) + (Number(r.zomato_sales_value) || 0), 0);
    const f = stFixed[o] || {};
    const fixed = (Number(f.staff) || 0) + (Number(f.rent) || 0) + (Number(f.eb) || 0) + (Number(f.transport) || 0) + 0.2 * (Number(f.rent) || 0) + (Number(f.pest) || 0) + (Number(f.water) || 0) + (Number(f.airtel) || 0);
    const comm = 0.5 * oOnline;
    const contribution = oNet - 0.294 * oNet - 0.05 * oNet - comm;
    const netProfit = contribution - fixed;
    return { o, name: OUTLET_NAMES[o] || o, net: oNet, online: oOnline, fixed, comm, contribution, netProfit, reported: rows.length };
  });
  const totalProfit = pnl.reduce((s, p) => s + p.netProfit, 0);
  const bleeders = pnl.filter(p => p.netProfit < 0).sort((a, b) => a.netProfit - b.netProfit);
  const worstPnl = bleeders[0];
  const noFixedCount = OUTLETS.filter(o => { const f = stFixed[o] || {}; return !((Number(f.staff) || 0) + (Number(f.rent) || 0) + (Number(f.pest) || 0)); }).length;
  const whyBleed = (p: any) => { if (!p) return ""; if (p.comm > p.contribution + p.fixed) return "aggregator commission (50% on online) is the killer — too online-dependent."; if (p.fixed > p.contribution) return "fixed costs (rent/staff) outweigh what sales bring in — rent is high or sales too low to cover it."; return "sales are simply too low this month to cover its costs."; };
  const fixBleed = (p: any) => { if (!p) return ""; if (p.comm > p.contribution + p.fixed) return "Shift mix toward dine-in/takeaway (commission-free) and cut discounting on the apps."; if (p.fixed > p.contribution) return "Drive volume hard (footfall + online) to cover fixed costs, or review the cost base for that site."; return "Push both channels — promotions, visibility, counter upsell — to lift the topline."; };

  const filedDaily = new Set(daily.filter(x => !x.no_points).map(x => x.staff_id));
  const filedOutlets = new Set(out.map(r => r.outlet_id));

  const pts: Record<string, number> = {};
  daily.forEach(x => { if (x.no_points) return; pts[x.staff_id] = (pts[x.staff_id] || 0) + (x.is_backfill || x.is_late ? -5 : 10); });
  out.forEach(r => {
    const owner = OUTLET_OWNER[r.outlet_id]; if (!owner) return;
    let p = 0;
    if (r.no_points) p = 0; else if (r.is_backfill) p = -30; else if (r.is_late) p = 0;
    else { const t = n(r.target) || OUTLET_TARGETS[r.outlet_id]; const tot = n(r.shop_sales_value) + n(r.swiggy_sales_value) + n(r.zomato_sales_value); p = 20 + (t > 0 && tot >= t ? 30 : 0); }
    pts[owner] = (pts[owner] || 0) + p;
  });
  revs.forEach(rv => { const owner = OUTLET_OWNER[rv.outlet_id] || rv.staff_id; pts[owner] = (pts[owner] || 0) + reviewPoints(n(rv.rating), rv.valid_complaint); });

  const latestPay: Record<string, any> = {};
  payouts.forEach(p => { const k = p.outlet_id + "_" + p.platform; if (!latestPay[k]) latestPay[k] = p; });

  const loadJsPDF = (): Promise<any> => new Promise((resolve, reject) => {
    const w = window as any;
    if (w.jspdf && w.jspdf.jsPDF) return resolve(w.jspdf.jsPDF);
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload = () => resolve((window as any).jspdf.jsPDF);
    s.onerror = () => reject(new Error("pdf lib failed"));
    document.body.appendChild(s);
  });
  const downloadPDF = async () => {
    let jsPDF: any;
    try { jsPDF = await loadJsPDF(); } catch { alert("Could not load the PDF tool — check your connection and retry."); return; }
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 40;
    const rs = (nn: number) => "Rs " + Math.round(nn).toLocaleString("en-IN");
    const rsL = (nn: number) => "Rs " + (nn / 100000).toFixed(2) + " L";
    const txt = (s: string, x: number, yy: number, size: number, bold = false, c: number[] = [30, 30, 30], align: any = "left") => {
      doc.setFontSize(size); doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setTextColor(c[0], c[1], c[2]);
      doc.text(s, x, yy, { align });
    };
    const _gen = new Date(date + "T00:00:00");
    const _data = new Date(_gen.getTime() - 86400000);
    const _dataLbl = _data.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const _genLbl = _gen.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

    doc.setFillColor(250, 204, 21); doc.rect(0, 0, W, 74, "F");
    txt("BROWNIE HEAVEN", M, 38, 22, true, [20, 20, 20]);
    txt("Daily Scoreboard — the one-glance morning brief", M, 58, 10, false, [90, 70, 0]);
    txt("Compiled " + _genLbl, W - M, 40, 9, false, [90, 70, 0], "right");
    txt("Sales for " + _dataLbl, M, 98, 11, true, [40, 40, 40]);

    const profit = totalProfit >= 0;
    const by = 112, bh = 92;
    if (profit) doc.setFillColor(34, 160, 70); else doc.setFillColor(200, 55, 55);
    doc.roundedRect(M, by, W - 2 * M, bh, 6, 6, "F");
    txt(profit ? "WE'RE MAKING MONEY" : "WE'RE LOSING MONEY", M + 22, by + 34, 17, true, [255, 255, 255]);
    txt(rs(Math.abs(totalProfit)) + (profit ? " up" : " down") + " this month", M + 22, by + 66, 24, true, [255, 255, 255]);
    const icx = W - M - 50, icy = by + bh / 2, icr = 26;
    doc.setFillColor(255, 255, 255); doc.circle(icx, icy, icr, "F"); doc.setLineWidth(3.5);
    if (profit) { doc.setDrawColor(34, 160, 70); doc.line(icx - 12, icy + 1, icx - 3, icy + 11); doc.line(icx - 3, icy + 11, icx + 14, icy - 11); }
    else { doc.setDrawColor(200, 55, 55); doc.line(icx - 10, icy - 10, icx + 10, icy + 10); doc.line(icx - 10, icy + 10, icx + 10, icy - 10); }

    const gx = M + 110, gy = 290, gr = 60, seg = 48;
    for (let i = 0; i < seg; i++) {
      const f0 = i / seg, f1 = (i + 1) / seg, a0 = Math.PI - f0 * Math.PI, a1 = Math.PI - f1 * Math.PI, pctAt = f0 * 100;
      if (pctAt < 50) doc.setDrawColor(220, 70, 70); else if (pctAt < 80) doc.setDrawColor(240, 150, 40); else doc.setDrawColor(40, 170, 80);
      doc.setLineWidth(11); doc.line(gx + gr * Math.cos(a0), gy - gr * Math.sin(a0), gx + gr * Math.cos(a1), gy - gr * Math.sin(a1));
    }
    const pcl = Math.max(0, Math.min(targetPct, 100)), na = Math.PI - pcl / 100 * Math.PI;
    doc.setDrawColor(30, 30, 30); doc.setLineWidth(2.5); doc.line(gx, gy, gx + (gr - 14) * Math.cos(na), gy - (gr - 14) * Math.sin(na));
    doc.setFillColor(30, 30, 30); doc.circle(gx, gy, 4, "F");
    txt(targetPct.toFixed(0) + "%", gx, gy - 16, 20, true, [30, 30, 30], "center");
    txt("of monthly target", gx, gy + 16, 8, false, [120, 120, 120], "center");
    txt(rsL(mtd) + " / " + rsL(MONTHLY_TARGET), gx, gy + 30, 8, false, [120, 120, 120], "center");

    const stats: [string, string][] = [["Sales (this day)", rs(tTotal)], ["Month to date", rsL(mtd)], ["Projected month-end", rsL(projected)]];
    let scy = 232;
    stats.forEach(([lab, val]) => {
      doc.setFillColor(245, 245, 245); doc.roundedRect(300, scy, W - M - 300, 40, 4, 4, "F");
      txt(lab, 312, scy + 15, 8, false, [120, 120, 120]); txt(val, 312, scy + 33, 14, true, [20, 20, 20]); scy += 48;
    });

    const cy0 = 400;
    doc.setFillColor(253, 242, 242); doc.setDrawColor(220, 90, 90); doc.setLineWidth(1); doc.roundedRect(M, cy0, W - 2 * M, 116, 5, 5, "FD");
    txt("BIGGEST DRAIN THIS MONTH", M + 16, cy0 + 24, 11, true, [180, 50, 50]);
    if (worstPnl) {
      txt(worstPnl.name + "  (" + rs(worstPnl.netProfit) + ")", M + 16, cy0 + 46, 14, true, [30, 30, 30]);
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(70, 70, 70);
      const wl = doc.splitTextToSize("Why: " + whyBleed(worstPnl), W - 2 * M - 32); let ly = cy0 + 66; wl.forEach((l: string) => { doc.text(l, M + 16, ly); ly += 13; });
      doc.setTextColor(150, 100, 0); const fl = doc.splitTextToSize("Fix: " + fixBleed(worstPnl), W - 2 * M - 32); fl.forEach((l: string) => { doc.text(l, M + 16, ly); ly += 13; });
    } else { txt("No outlet is in the red this month. Good going!", M + 16, cy0 + 48, 12, true, [40, 130, 50]); }

    let gC = 0, oC = 0, grC = 0;
    OUTLETS.forEach(o => { const r = out.find((x: any) => x.outlet_id === o); if (!r) { grC++; return; } const tot = (Number(r.shop_sales_value) || 0) + (Number(r.swiggy_sales_value) || 0) + (Number(r.zomato_sales_value) || 0); const tgt = Number(r.target) || OUTLET_TARGETS[o] || 0; if (tgt > 0 && tot >= tgt) gC++; else oC++; });
    const ty0 = cy0 + 150;
    txt("OUTLET HEALTH (this day)", M, ty0, 11, true, [40, 40, 40]);
    const dotY = ty0 + 24;
    doc.setFillColor(40, 170, 80); doc.circle(M + 8, dotY - 4, 7, "F"); txt(gC + " hit target", M + 22, dotY, 10, false, [50, 50, 50]);
    doc.setFillColor(240, 150, 40); doc.circle(M + 145, dotY - 4, 7, "F"); txt(oC + " below target", M + 159, dotY, 10, false, [50, 50, 50]);
    doc.setFillColor(160, 160, 160); doc.circle(M + 320, dotY - 4, 7, "F"); txt(grC + " not reported", M + 334, dotY, 10, false, [50, 50, 50]);
    const offNames = offRows.map((id: string) => (DUTY_STAFF.find(s => s.id === id)?.name) || id);
    txt("Off today: " + (offNames.length ? offNames.join(", ") : "none"), M, ty0 + 50, 10, false, offNames.length ? [170, 110, 0] : [80, 80, 80]);
    if (noFixedCount > 0) txt("Note: fixed costs missing for " + noFixedCount + " outlet(s) in Sales Target — profit is overstated until added.", M, ty0 + 70, 8, false, [170, 110, 0]);
    txt("Page 1 of 2 — detail & per-outlet breakdown overleaf", M, H - 30, 8, false, [160, 160, 160]);

    doc.addPage();
    let y = 50;
    const put = (s: string, size = 10, bold = false, c: number[] = [30, 30, 30]) => {
      doc.setFontSize(size); doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setTextColor(c[0], c[1], c[2]);
      const ls = doc.splitTextToSize(s, W - 2 * M); ls.forEach((l: string) => { if (y > H - 50) { doc.addPage(); y = 50; } doc.text(l, M, y); y += size + 5; });
    };
    doc.setFillColor(250, 204, 21); doc.rect(0, 0, W, 8, "F");
    put("PROFIT / LOSS BY OUTLET — MONTH TO DATE", 13, true, [0, 0, 0]); y += 4;
    doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(120, 120, 120);
    doc.text("OUTLET", M, y); doc.text("SALES (MTD)", M + 200, y); doc.text("NET P/L", M + 320, y); doc.text("STATUS", M + 430, y);
    y += 6; doc.setDrawColor(220, 220, 220); doc.line(M, y, W - M, y); y += 14;
    pnl.forEach(p => {
      if (y > H - 50) { doc.addPage(); y = 50; }
      const good = p.netProfit >= 0;
      doc.setFillColor(good ? 40 : 200, good ? 170 : 55, good ? 80 : 55); doc.circle(M + 432, y - 3, 4, "F");
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(40, 40, 40);
      doc.text((p.name).slice(0, 22), M, y); doc.text(rs(p.net), M + 200, y);
      doc.setTextColor(good ? 40 : 190, good ? 130 : 50, good ? 60 : 50); doc.setFont("helvetica", "bold"); doc.text((good ? "+" : "") + rs(p.netProfit), M + 320, y);
      doc.setFont("helvetica", "normal"); doc.setTextColor(90, 90, 90); doc.text(good ? "OK" : "LOSS", M + 444, y);
      y += 17;
    });
    y += 6; doc.setDrawColor(220, 220, 220); doc.line(M, y, W - M, y); y += 16;
    put("TOTAL: " + (totalProfit >= 0 ? "Making " : "Losing ") + rs(Math.abs(totalProfit)) + " net this month.", 11, true, totalProfit >= 0 ? [40, 120, 40] : [180, 60, 60]); y += 10;

    put("SALES VS TARGET (this day)", 12, true, [0, 0, 0]); y += 4;
    const chMax = Math.max(...OUTLETS.map(o => { const rr = out.find((x: any) => x.outlet_id === o); const tt = rr ? (Number(rr.shop_sales_value) || 0) + (Number(rr.swiggy_sales_value) || 0) + (Number(rr.zomato_sales_value) || 0) : 0; return Math.max(tt, Number(rr?.target) || OUTLET_TARGETS[o] || 0); }), 1);
    const barX = M + 95, barW = W - M - barX - 50, barH = 11;
    OUTLETS.forEach((o) => {
      if (y > H - 50) { doc.addPage(); y = 50; }
      const r = out.find((x: any) => x.outlet_id === o);
      const tot = r ? (Number(r.shop_sales_value) || 0) + (Number(r.swiggy_sales_value) || 0) + (Number(r.zomato_sales_value) || 0) : 0;
      const tgt = r ? (Number(r.target) || OUTLET_TARGETS[o] || 0) : (OUTLET_TARGETS[o] || 0);
      const hit = tgt > 0 && tot >= tgt;
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(40, 40, 40); doc.text((OUTLET_NAMES[o] || o).slice(0, 16), M, y + 9);
      doc.setFillColor(235, 235, 235); doc.rect(barX, y, barW, barH, "F");
      const w = Math.min((tot / chMax) * barW, barW);
      if (!r) doc.setFillColor(160, 160, 160); else if (hit) doc.setFillColor(34, 160, 70); else doc.setFillColor(240, 140, 30);
      doc.rect(barX, y, w, barH, "F");
      if (tgt > 0) { const tx = barX + Math.min((tgt / chMax) * barW, barW); doc.setDrawColor(220, 180, 0); doc.setLineWidth(1.4); doc.line(tx, y - 1, tx, y + barH + 1); }
      doc.setFontSize(7); doc.setTextColor(90, 90, 90); doc.text(r ? rs(tot) : "n/r", barX + barW + 4, y + 9);
      y += barH + 6;
    });
    y += 4; put("Green = hit  |  Orange = below  |  Grey = not reported  |  Yellow line = target", 8, false, [120, 120, 120]); y += 10;

    put("PER OUTLET — WHAT TO DO", 12, true, [0, 0, 0]);
    const weak: { name: string; gap: number; comment: string }[] = [];
    OUTLETS.forEach((o) => {
      const r = out.find((x: any) => x.outlet_id === o);
      const name = OUTLET_NAMES[o] || o;
      if (!r) { put(name + ": NOT REPORTED — follow up with the manager before anything else.", 10, true, [180, 60, 60]); weak.push({ name, gap: -1e9, comment: "not reported — follow up" }); return; }
      const shop = Number(r.shop_sales_value) || 0, sw = Number(r.swiggy_sales_value) || 0, zo = Number(r.zomato_sales_value) || 0;
      const online = sw + zo, total = shop + online, tgt = Number(r.target) || OUTLET_TARGETS[o] || 0, g = total - tgt;
      let cmt: string;
      if (tgt <= 0) cmt = rs(total) + " for the day (no target set).";
      else if (g >= 0) cmt = "Hit target — " + rs(total) + " vs " + rs(tgt) + " (+" + rs(g) + "). Strong day, keep it going.";
      else {
        const pctUnder = Math.round(Math.abs(g) / tgt * 100), split = "Walk-in " + rs(shop) + " vs online " + rs(online) + ".";
        if (pctUnder < 10) cmt = "So close — just " + rs(Math.abs(g)) + " (" + pctUnder + "%) off. One push closes it.";
        else if (pctUnder > 40) cmt = "Big gap — " + rs(Math.abs(g)) + " (" + pctUnder + "%) under. Needs a proper review. " + (online < shop ? "Online barely moving — start there." : "Footfall is the problem — start there.");
        else if (online < shop) cmt = rs(Math.abs(g)) + " short (" + pctUnder + "% under). Online is soft — push Swiggy/Zomato combos & visibility. " + split;
        else cmt = rs(Math.abs(g)) + " short (" + pctUnder + "% under). Walk-ins soft — drive footfall & counter upsell. " + split;
        weak.push({ name, gap: g, comment: cmt });
      }
      put(name + ": " + rs(total) + " / " + rs(tgt) + " target  [" + (g >= 0 ? "HIT" : "SHORT") + "]", 10, true);
      put("    " + cmt, 9, false, g >= 0 ? [40, 120, 40] : [180, 60, 60]);
    });
    y += 8;
    const worst = weak.filter(w => w.gap < 0).sort((a, b) => a.gap - b.gap).slice(0, 3);
    if (worst.length) { put("TOP 3 TO FIX FIRST", 12, true, [180, 60, 60]); worst.forEach((w, i) => put((i + 1) + ". " + w.name + " — " + w.comment, 9)); }
    doc.save("BrownieHeaven_Report_" + date + ".pdf");
  };
  const Hero = ({ label, value, sub, accent }: any) => (
    <div className="flex-1 min-w-[150px] bg-gradient-to-b from-zinc-900 to-[#0e0e10] border border-zinc-800 p-5">
      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2">{label}</p>
      <p className={`text-2xl md:text-3xl font-black ${accent || "text-white"}`}>{value}</p>
      {sub && <p className="text-[11px] text-zinc-500 mt-1">{sub}</p>}
    </div>
  );
  const Card = ({ title, children, right }: any) => (
    <div className="bg-[#131316] border border-zinc-800 p-5 mb-5">
      <div className="flex justify-between items-center mb-4"><p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{title}</p>{right}</div>
      {children}
    </div>
  );

  const dayLabel = d0.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div>
      <div className="flex flex-wrap justify-between items-end gap-3 mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight">Founder&apos;s Office</h2>
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest mt-1">{dayLabel}</p>
        </div>
       <div className="flex items-center gap-2">
          <button onClick={downloadPDF} className="bg-yellow-400 text-black font-bold text-[10px] px-4 py-2.5 uppercase tracking-widest hover:opacity-90">📄 PDF for Nishant</button>
          <input type="date" max={today} value={date} onChange={e => setDate(e.target.value)} className="bg-black border border-zinc-800 text-white px-3 py-2 focus:outline-none focus:border-yellow-400 text-sm font-mono" />
        </div>
      </div>

      <p className="text-[11px] font-mono text-zinc-500 mb-5 border-l-2 border-yellow-400/40 pl-3">📊 Outlet sales reflect the <span className="text-yellow-400">previous day&apos;s</span> business — figures below are {new Date(d0.getTime() - 86400000).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}&apos;s sales, filed this morning.</p>

      {loading ? <p className="text-zinc-600 font-mono text-sm">Loading…</p> : (
        <>
          <div className="flex flex-wrap gap-3 mb-5">
            <Hero label="Today's sales" value={inr(tTotal)} sub={`${out.length}/12 reported`} accent="text-yellow-400" />
            <Hero label="Month to date" value={lakh(mtd)} sub={`${dayOfMonth} days`} />
            <Hero label="Projected month-end" value={lakh(projected)} sub={onTrack ? "on track" : "below target"} accent={onTrack ? "text-green-400" : "text-red-400"} />
          </div>

          <Card title="Profit / Loss — month to date (all outlets)">
            <div className="flex items-baseline gap-3 mb-2">
              <span className={`text-3xl font-black ${totalProfit >= 0 ? "text-green-400" : "text-red-400"}`}>{totalProfit >= 0 ? "Making " : "Losing "}{inr(Math.abs(totalProfit))}</span>
              <span className="text-[11px] font-mono text-zinc-500">net this month</span>
            </div>
            {worstPnl ? (
              <p className="text-xs text-zinc-300 mb-1"><span className="text-red-400 font-bold">Bleeding most: {worstPnl.name}</span> ({inr(worstPnl.netProfit)}) — {whyBleed(worstPnl)}</p>
            ) : <p className="text-xs text-green-400 mb-1">No outlet is in the red this month.</p>}
            {worstPnl && <p className="text-xs text-zinc-400 mb-2"><span className="text-yellow-400">Fix:</span> {fixBleed(worstPnl)}</p>}
            {bleeders.length > 1 && <p className="text-[11px] font-mono text-zinc-500">Also in red: {bleeders.slice(1, 4).map(b => `${b.name} (${inr(b.netProfit)})`).join(", ")}</p>}
            {noFixedCount > 0 && <p className="text-[10px] text-orange-400 mt-2">⚠ Fixed costs not entered for {noFixedCount} outlet(s) in Sales Target — their profit is overstated until you add rent/staff/etc.</p>}
          </Card>

          <Card title={`Monthly target · ${d0.toLocaleDateString("en-IN", { month: "long" })}`}>
            <div className="flex justify-between text-xs mb-2"><span className="text-zinc-400">Achieved {lakh(mtd)}</span><span className="text-zinc-400">Target {lakh(MONTHLY_TARGET)}</span></div>
            <div className="h-3 bg-black border border-zinc-800 overflow-hidden mb-1"><div className="h-full bg-yellow-400" style={{ width: `${Math.min(targetPct, 100)}%` }} /></div>
            <p className="text-[11px] text-zinc-500 mb-4">{targetPct.toFixed(1)}% of target · {lakh(Math.max(MONTHLY_TARGET - mtd, 0))} to go</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-zinc-800">
              <div><p className="text-[10px] text-zinc-500 uppercase">Current run rate</p><p className="text-base font-bold">{lakh(runRate)}<span className="text-[10px] text-zinc-500">/day</span></p></div>
              <div><p className="text-[10px] text-zinc-500 uppercase">Required run rate</p><p className={`text-base font-bold ${required > runRate ? "text-red-400" : "text-green-400"}`}>{lakh(required)}<span className="text-[10px] text-zinc-500">/day</span></p></div>
              <div><p className="text-[10px] text-zinc-500 uppercase">Gap / day</p><p className={`text-base font-bold ${required > runRate ? "text-red-400" : "text-green-400"}`}>{required > runRate ? lakh(required - runRate) : "On pace"}</p></div>
              <div><p className="text-[10px] text-zinc-500 uppercase">Proj. shortfall</p><p className={`text-base font-bold ${shortfall >= 0 ? "text-green-400" : "text-red-400"}`}>{shortfall >= 0 ? "+" : "−"}{lakh(Math.abs(shortfall))}</p></div>
            </div>
            <p className="text-[11px] text-zinc-500 mt-3 pt-3 border-t border-zinc-800">Channel mix (MTD): Offline {lakh(mShop)} · Online {lakh(mOnline)} — for every ₹1 walk-in, <span className="text-yellow-400 font-bold">₹{offlineRatio.toFixed(1)}</span> online.</p>
          </Card>
<Card title={`Sales by channel · ${new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`} right={<span className="text-[10px] font-mono text-zinc-600">{dayOfMonth}/{daysInMonth}</span>}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><p className="text-[10px] text-zinc-500 uppercase">Shop</p><p className="text-lg font-bold">{inr(tShop)}</p></div>
              <div><p className="text-[10px] text-zinc-500 uppercase">Swiggy</p><p className="text-lg font-bold text-orange-400">{inr(tSw)}</p></div>
              <div><p className="text-[10px] text-zinc-500 uppercase">Zomato</p><p className="text-lg font-bold text-red-400">{inr(tZo)}</p></div>
              <div><p className="text-[10px] text-zinc-500 uppercase">Orders Sw / Zo</p><p className="text-lg font-bold">{swC} / {zoC}</p></div>
            </div>
          </Card>

          <Card title={`Sales vs target by outlet · ${new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}>
            <div className="space-y-2 mb-2">
              {OUTLETS.map(o => {
                const r = out.find((x: any) => x.outlet_id === o);
                const tot = r ? (Number(r.shop_sales_value) || 0) + (Number(r.swiggy_sales_value) || 0) + (Number(r.zomato_sales_value) || 0) : 0;
                const tgt = r ? (Number(r.target) || OUTLET_TARGETS[o]) : OUTLET_TARGETS[o];
                const maxV = Math.max(...OUTLETS.map(oo => { const rr = out.find((x: any) => x.outlet_id === oo); const tt = rr ? (Number(rr.shop_sales_value) || 0) + (Number(rr.swiggy_sales_value) || 0) + (Number(rr.zomato_sales_value) || 0) : 0; return Math.max(tt, Number(rr?.target) || OUTLET_TARGETS[oo] || 0); }), 1);
                const hit = tgt > 0 && tot >= tgt;
                const salesPct = Math.min((tot / maxV) * 100, 100);
                const tgtPct = Math.min((tgt / maxV) * 100, 100);
                return (
                  <div key={o}>
                    <div className="flex justify-between text-[11px] mb-0.5"><span className="text-zinc-300">{OUTLET_NAMES[o]}</span><span className="font-mono text-zinc-500">{inr(tot)}{tgt > 0 ? ` / ${inr(tgt)}` : ""}</span></div>
                    <div className="relative h-4 bg-black border border-zinc-800">
                      <div className={`absolute top-0 left-0 h-full ${!r ? "bg-zinc-700" : hit ? "bg-green-500" : "bg-orange-500"}`} style={{ width: `${salesPct}%` }} />
                      {tgt > 0 && <div className="absolute top-0 h-full w-0.5 bg-yellow-300" style={{ left: `${tgtPct}%` }} title="target" />}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] font-mono text-zinc-600 mb-4">▮ green = hit · ▮ orange = below · ▮ grey = not reported · | yellow line = target</p>
          <div className="hidden">
            <div className="space-y-1">
              {OUTLETS.map(o => {
                const r = out.find(x => x.outlet_id === o);
                if (!r) return <div key={o} className="flex justify-between text-xs py-1.5 border-t border-zinc-800/60"><span className="text-zinc-500">{OUTLET_NAMES[o]}</span><span className="text-zinc-600">not reported</span></div>;
                const tot = n(r.shop_sales_value) + n(r.swiggy_sales_value) + n(r.zomato_sales_value);
                const t = n(r.target) || OUTLET_TARGETS[o]; const hit = t > 0 && tot >= t;
                return <div key={o} className="flex justify-between items-center text-xs py-1.5 border-t border-zinc-800/60"><span className="text-zinc-300">{OUTLET_NAMES[o]}</span><span className="font-mono">{inr(tot)} {t > 0 && <span className={hit ? "text-green-400 ml-1" : "text-red-400 ml-1"}>{hit ? "✓" : "✗"}</span>}</span></div>;
              })}
            </div>
          </div>
          </Card>

          <Card title="Reporting status (today)">
            <p className="text-[10px] text-zinc-500 uppercase mb-1">Daily reports</p>
            <p className="text-xs mb-3">{DUTY_STAFF.map(s => { const isOff = offRows.includes(s.id); return <span key={s.id} className={isOff ? "text-zinc-500 mr-3 inline-block" : filedDaily.has(s.id) ? "text-green-400 mr-3 inline-block" : "text-red-400 mr-3 inline-block"}>{isOff ? "🌙" : filedDaily.has(s.id) ? "✓" : "✗"} {s.name}{isOff ? " (off)" : ""}</span>; })}</p>
            <p className="text-[10px] text-zinc-500 uppercase mb-1">Outlet reports</p>
            <p className="text-xs">{OUTLETS.map(o => <span key={o} className={filedOutlets.has(o) ? "text-green-400 mr-3 inline-block" : "text-red-400 mr-3 inline-block"}>{filedOutlets.has(o) ? "✓" : "✗"} {OUTLET_NAMES[o]}</span>)}</p>
          </Card>

          <Card title="Reviews & complaints (today)">
            {revs.length === 0 ? <p className="text-zinc-600 text-xs">No reviews logged.</p> : (
              <div className="space-y-1">
                <p className="text-xs text-zinc-400 mb-2">{revs.length} review(s) · {revs.filter(r => r.valid_complaint).length} valid complaint(s) · {revs.filter(r => r.refund_given).length} refunded</p>
                {revs.map(rv => { const p = reviewPoints(n(rv.rating), rv.valid_complaint); return (
                  <div key={rv.id} className="flex justify-between text-xs py-1 border-t border-zinc-800/60">
                    <span className="text-zinc-300">{OUTLET_NAMES[rv.outlet_id] || rv.outlet_id} · {rv.platform} · {rv.rating}★{rv.valid_complaint ? " · complaint" : ""}</span>
                    <span className={p >= 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>{p >= 0 ? "+" : ""}{p}</span>
                  </div>
                ); })}
              </div>
            )}
          </Card>

          <Card title={`Points earned · ${d0.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}>
            <div className="space-y-1">
              {DUTY_STAFF.map(s => (
                <div key={s.id} className="flex justify-between text-sm py-1.5 border-t border-zinc-800/60">
                  <span className="text-zinc-300">{s.name}</span>
                  <span className={`font-bold font-mono ${(pts[s.id] || 0) >= 0 ? "text-yellow-400" : "text-red-400"}`}>{(pts[s.id] || 0) >= 0 ? "+" : ""}{pts[s.id] || 0}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-zinc-600 mt-2">Daily +10 / late −5 · outlet +20 (+30 target) · reviews. Season totals on Leaderboard.</p>
          </Card>

          <Card title="Payout — latest week per outlet">
            <div className="space-y-1">
              {OUTLETS.map(o => {
                const sw = latestPay[o + "_swiggy"], zo = latestPay[o + "_zomato"];
                if (!sw && !zo) return null;
                return <div key={o} className="flex justify-between text-xs py-1 border-t border-zinc-800/60"><span className="text-zinc-300">{OUTLET_NAMES[o]}</span><span className="font-mono text-zinc-400">{sw ? `Sw ${inr(n(sw.amount_transferable))}` : ""} {zo ? `Zo ${inr(n(zo.net_payout))}` : ""}</span></div>;
              })}
              {OUTLETS.every(o => !latestPay[o + "_swiggy"] && !latestPay[o + "_zomato"]) && <p className="text-zinc-600 text-xs">No payout data yet.</p>}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
