import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToSubscription } from "@/lib/webpush";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Runs once daily via Vercel Cron (see vercel.json) at 10pm IST. Checks
// whether Rafiq has logged anything in kitchen_production for today yet —
// doesn't care which category, just whether anything was submitted at all.
// If nothing's there, sends him a push reminder the same way Fines/Nudge
// already do (push_subscriptions + sendPushToSubscription).
export async function GET() {
  try {
    const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const todayIst = istNow.toISOString().slice(0, 10);

    const { count, error } = await supabase
      .from("kitchen_production")
      .select("id", { count: "exact", head: true })
      .eq("prod_date", todayIst);

    if (error) {
      console.error("check-production query failed", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if ((count || 0) > 0) {
      return NextResponse.json({ ok: true, alreadyFiled: true, count });
    }

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("staff_id, endpoint, p256dh, auth")
      .eq("staff_id", "rafiq");

    if (!subs || subs.length === 0) {
      return NextResponse.json({ ok: true, alreadyFiled: false, sent: 0, note: "No registered device for Rafiq yet — he needs to open the app once and allow notifications." });
    }

    let sent = 0;
    const deadEndpoints: string[] = [];
    for (const sub of subs) {
      const result = await sendPushToSubscription(sub as any, {
        title: "🏭 Today's production isn't filed yet",
        body: "It's 10pm — open the Production tab and fill in today's production before the day ends.",
        tag: "production-reminder",
      });
      if (result === "ok") sent++;
      if (result === "gone") deadEndpoints.push((sub as any).endpoint);
    }
    if (deadEndpoints.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", deadEndpoints);
    }

    return NextResponse.json({ ok: true, alreadyFiled: false, sent, total: subs.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unexpected error" }, { status: 500 });
  }
}
