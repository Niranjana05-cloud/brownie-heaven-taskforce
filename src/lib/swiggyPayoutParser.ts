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

export const toISO = (s: string | null | undefined) => {
  if (!s) return null;
  const m = String(s).match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) return null;
  const mm = MON[m[2].slice(0, 3).toLowerCase()];
  if (!mm) return null;
  return `${m[3]}-${mm}-${m[1].padStart(2, "0")}`;
};

// Reads Swiggy's weekly/monthly payout report email (plain text) — pulls out the
// Rest. ID (which tells us exactly which outlet+brand this is for), the period
// dates, and every financial line item. Same logic as the original manual-paste
// parser in PayoutTab.tsx, just given its own file so the automatic Gmail checker
// can use it too, without duplicating (and risking drifting from) the real thing.
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
    restId: idM ? idM[1] : null,
    _detected: (name || "") + (idM ? ` \u00b7 Rest ID ${idM[1]}` : ""),
  };
}
