import { SWIGGY_REST_ID_MAP, type SwiggyBrand } from "./swiggyPayoutMap";

// Swiggy's own area-name slugs don't always match TASKFORCE's outlet names —
// same gap already found for payouts and reviews ("Thoraipakkam" = BSR Mall,
// "Adambakkam" = Velachery). Reused here for URL construction.
const SWIGGY_URL_AREA_SLUG: Record<string, string> = {
  bsr_mall: "thoraipakkam",
  velachery: "adambakkam",
};

const BRAND_URL_SLUG: Record<SwiggyBrand, string> = {
  BH: "brownie-heaven",
  CBH: "cakes-by-brownie-heaven",
  ICBH: "ice-cream-by-brownie-heaven", // unconfirmed — no real ICBH URL tested yet
};

// Built from the Rest ID map so it's always in sync with the confirmed IDs —
// one source of truth, not a second list that can drift out of date.
const REST_ID_BY_OUTLET_BRAND: Record<string, string> = {};
for (const [restId, info] of Object.entries(SWIGGY_REST_ID_MAP)) {
  REST_ID_BY_OUTLET_BRAND[`${info.outlet_id}_${info.brand}`] = restId;
}

const OUTLET_DISPLAY_FOR_SLUG: Record<string, string> = {
  royapettah: "royapettah", adayar: "adyar", bsr_mall: "bsr-mall", velachery: "velachery",
  ra_puram: "ra-puram", anna_nagar: "anna-nagar", pallavaram: "pallavaram", vadapalani: "vadapalani",
  besant_nagar: "besant-nagar", perumbakkam: "perumbakkam", tambaram: "tambaram", porur: "porur",
};

export function buildSwiggyUrl(outletId: string, brand: SwiggyBrand): { url: string; restId: string } | null {
  const restId = REST_ID_BY_OUTLET_BRAND[`${outletId}_${brand}`];
  if (!restId) return null;
  const areaSlug = SWIGGY_URL_AREA_SLUG[outletId] || OUTLET_DISPLAY_FOR_SLUG[outletId] || outletId;
  const url = `https://www.swiggy.com/city/chennai/${BRAND_URL_SLUG[brand]}-${areaSlug}-rest${restId}`;
  return { url, restId };
}

// Strips a raw HTML page down to plain text — same style/script-removal fix
// learned from the Swiggy payout emails, so CSS/JS never leaks into what we
// try to read as content.
function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|td|span)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#8377;/g, "₹")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type LiveOfferResult = { offers: string[]; maxPct: number | null; fetchOk: boolean; error?: string; debugRawLength?: number; debugTextPreview?: string; debugLooksLikeJsShell?: boolean };

// Pulls out lines like "Flat 30% Off", "20% Off Upto ₹50", "Extra ₹20 Off" from
// the page text, and the single highest % figure among them — used as the
// "current live discount level" to compare against what was approved.
export async function fetchLiveOffers(url: string, includeDebug: boolean = false): Promise<LiveOfferResult> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { offers: [], maxPct: null, fetchOk: false, error: `HTTP ${res.status}` };
    const html = await res.text();
    const text = htmlToText(html);

    const offerLines: string[] = [];
    const offerRegex = /((?:Flat|Extra)?\s*(?:\d+%|₹\d+)\s*Off(?:\s*Upto\s*₹\d+)?)/gi;
    let m;
    while ((m = offerRegex.exec(text)) !== null) {
      const line = m[1].trim();
      if (!offerLines.includes(line)) offerLines.push(line);
    }

    let maxPct: number | null = null;
    const pctRegex = /(\d+)%\s*Off/gi;
    let pm;
    while ((pm = pctRegex.exec(text)) !== null) {
      const v = parseInt(pm[1], 10);
      if (maxPct === null || v > maxPct) maxPct = v;
    }

    // A page that's genuinely just a JS-loading shell (content fetched by the
    // browser after load, not present in the raw HTML) tends to be short and
    // lacks any of the dish/menu text that should be all over a real page.
    const looksLikeJsShell = html.length < 20000 || !/Off|menu|restaurant/i.test(text);

    const result: LiveOfferResult = { offers: offerLines.slice(0, 10), maxPct, fetchOk: true };
    if (includeDebug) {
      result.debugRawLength = html.length;
      result.debugTextPreview = text.slice(0, 2000);
      result.debugLooksLikeJsShell = looksLikeJsShell;
    }
    return result;
  } catch (err: any) {
    return { offers: [], maxPct: null, fetchOk: false, error: err.message || String(err) };
  }
}
