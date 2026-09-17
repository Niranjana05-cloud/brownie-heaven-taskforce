import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildSwiggyUrl, fetchLiveOffers } from "@/lib/swiggyLiveOffers";
import type { SwiggyBrand } from "@/lib/swiggyPayoutMap";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OUTLETS = ["royapettah", "adayar", "bsr_mall", "velachery", "ra_puram", "anna_nagar", "pallavaram", "vadapalani", "besant_nagar", "perumbakkam", "tambaram", "porur"];
const BRANDS: SwiggyBrand[] = ["BH", "CBH", "ICBH"];

function mondayOf(d: Date): string {
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  return monday.toISOString().slice(0, 10);
}

export async function GET() {
  const weekStart = mondayOf(new Date());
  const { data: targets } = await supabase.from("outlet_discount_targets").select("outlet_id,brand,approved_pct").eq("week_start", weekStart);
  const approvedByKey: Record<string, number> = {};
  (targets || []).forEach((t: any) => { approvedByKey[`${t.outlet_id}_${t.brand}`] = Number(t.approved_pct); });

  const results: any[] = [];

  for (const outletId of OUTLETS) {
    for (const brand of BRANDS) {
      const built = buildSwiggyUrl(outletId, brand);
      if (!built) {
        results.push({ outlet_id: outletId, brand, skipped: true, reason: "no Rest ID known for this outlet+brand" });
        continue;
      }
      const isFirst = results.length === 0;
      const live = await fetchLiveOffers(built.url, isFirst);
      const approvedPct = approvedByKey[`${outletId}_${brand}`] ?? null;
      const flagged = live.maxPct != null && approvedPct != null && live.maxPct > approvedPct + 5; // small buffer, not a hair-trigger
      results.push({
        outlet_id: outletId,
        brand,
        restId: built.restId,
        url: built.url,
        offers: live.offers,
        maxPct: live.maxPct,
        approvedPct,
        flagged,
        fetchOk: live.fetchOk,
        error: live.error,
        debugRawLength: live.debugRawLength,
        debugTextPreview: live.debugTextPreview,
        debugLooksLikeJsShell: live.debugLooksLikeJsShell,
      });
    }
  }

  return NextResponse.json(
    { success: true, weekStart, results, checkedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } }
  );
}
