export type ParsedSwiggyPayout = {
  period_start: string | null; period_end: string | null;
  total_orders: string | number | null;
  customer_payable?: string | null; swiggy_service_fee?: string | null;
  other_charges_refund?: string | null; govt_taxes?: string | null;
  amount_transferable?: string | null; next_payout_cycle?: string | null; next_payout_date?: string | null;
  net_payout?: string | number | null; bank_utr?: string | null;
  restId: string | null;
  _detected: string;
};

const MON: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
const MONTH_NAMES = "January|February|March|April|May|June|July|August|September|October|November|December";

export const toISO = (s: string | null | undefined) => {
  if (!s) return null;
  const m = String(s).match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) return null;
  const mm = MON[m[2].slice(0, 3).toLowerCase()];
  if (!mm) return null;
  return `${m[3]}-${mm}-${m[1].padStart(2, "0")}`;
};

// Last day of a given month (1-indexed), accounting for leap years.
const lastDayOfMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

// Reads Swiggy's weekly/monthly payout report email (plain text) — pulls out the
// Rest. ID (which tells us exactly which outlet+brand this is for), the period
// dates, and every financial line item. Same logic as the original manual-paste
// parser in PayoutTab.tsx, just given its own file so the automatic Gmail checker
// can use it too, without duplicating (and risking drifting from) the real thing.
//
// Swiggy has used at least two report formats over time: a newer one with an
// explicit date range ("1st Sep 2026 - 5th Sep 2026") and a Rest. ID, and an
// older, simpler one that just says "<Month> <Year> Payout Summary" with no
// Rest ID and a plain "Total Revenue" figure instead of the detailed breakdown.
// This handles both — falling back to the whole calendar month as the period,
// and to "Total Revenue" as gross, when the newer-format fields aren't present.
export function parseSwiggyPayoutEmail(text: string): ParsedSwiggyPayout {
  const t = text.replace(/\u00a0/g, " ");
  const grabBefore = (labelRe: RegExp) => {
    const m = labelRe.exec(t);
    if (!m) return null;
    const before = t.slice(0, m.index);
    const nums = before.match(/-?[\d,]+(?:\.\d+)?/g);
    if (!nums) return null;
    return nums[nums.length - 1].replace(/,/g, "");
  };
  // Old-format emails put the value AFTER the label ("Total Orders" then "150"
  // on the next line) — the opposite order from the newer format ("81" then
  // "Total Orders"). Detected by the presence of "Payout Summary:" without the
  // newer format's "Total Customer Payable" line.
  const isOldFormat = /Payout Summary:/i.test(t) && !/Total Customer Payable/i.test(t);
  const grabAfter = (labelRe: RegExp) => {
    const m = labelRe.exec(t);
    if (!m) return null;
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 200);
    const nm = after.match(/-?[\d,]+(?:\.\d+)?/);
    return nm ? nm[0].replace(/,/g, "") : null;
  };
  const range = t.match(/(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})\s*[-\u2013]\s*(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})/);
  const cycleM = t.match(/Next Payout Cycle[\s\S]{0,80}?(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4}\s*[-\u2013]\s*\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})/i);
  const payM = t.match(/Next Payout on[\s\S]{0,40}?(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})/i);
  const idM = t.match(/Rest\.?\s*ID\s*:?\s*(\d+)/i);
  const lines = t.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const idxRest = lines.findIndex((l) => /Rest\.?\s*ID/i.test(l));
  const name = idxRest > 0 ? lines[idxRest - 1] : null;

  let period_start = range ? toISO(range[1]) : null;
  let period_end = range ? toISO(range[2]) : null;
  if (!period_start || !period_end) {
    // Old-format fallback: "January 2026 Payout Summary" — use the whole month.
    const monthM = t.match(new RegExp(`(${MONTH_NAMES})\\s+(\\d{4})\\s+Payout Summary`, "i"));
    if (monthM) {
      const mm = MON[monthM[1].slice(0, 3).toLowerCase()];
      const yyyy = monthM[2];
      period_start = `${yyyy}-${mm}-01`;
      period_end = `${yyyy}-${mm}-${String(lastDayOfMonth(parseInt(yyyy), parseInt(mm))).padStart(2, "0")}`;
    }
  }

  return {
    period_start,
    period_end,
    total_orders: isOldFormat ? grabAfter(/Total Orders/i) : grabBefore(/Total Orders/i),
    customer_payable: isOldFormat ? grabAfter(/Total Revenue/i) : grabBefore(/Total Customer Payable/i),
    swiggy_service_fee: grabBefore(/Swiggy Service Fee/i),
    other_charges_refund: grabBefore(/Other Charges\s*\/?\s*Refund/i),
    govt_taxes: grabBefore(/Government Taxes/i),
    amount_transferable: grabBefore(/Amount Transferable/i),
    next_payout_cycle: cycleM ? cycleM[1] : null,
    next_payout_date: payM ? toISO(payM[1]) : null,
    restId: idM ? idM[1] : null,
    _detected: (name || "") + (idM ? ` \u00b7 Rest ID ${idM[1]}` : "") + (isOldFormat ? " (old format)" : ""),
  };
}
