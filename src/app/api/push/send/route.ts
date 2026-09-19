import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToSubscription } from "@/lib/webpush";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { staff_ids, title, body, url, tag } = await req.json();
    const ids: string[] = Array.isArray(staff_ids) ? staff_ids : [staff_ids].filter(Boolean);
    if (ids.length === 0 || !title) {
      return NextResponse.json({ error: "Missing staff_ids or title" }, { status: 400 });
    }

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, staff_id, endpoint, p256dh, auth")
      .in("staff_id", ids);

    if (!subs || subs.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, note: "No registered devices for these staff_ids" });
    }

    let sent = 0;
    const deadIds: string[] = [];
    for (const sub of subs) {
      const result = await sendPushToSubscription(sub as any, { title, body: body || "", url, tag });
      if (result === "ok") sent++;
      if (result === "gone") deadIds.push((sub as any).id);
    }

    if (deadIds.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", deadIds);
    }

    return NextResponse.json({ ok: true, sent, total: subs.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unexpected error" }, { status: 500 });
  }
}
