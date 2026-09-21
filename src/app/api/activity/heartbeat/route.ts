import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { session_id } = await req.json();

  const { data: session, error: fetchErr } = await supabase
    .from("activity_log")
    .select("staff_id")
    .eq("id", session_id)
    .maybeSingle();

  const { error } = await supabase
    .from("activity_log")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", session_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Every real heartbeat only fires while the tab is genuinely open and
  // visible (see useActivityHeartbeat), so logging each one as its own row
  // lets "active time" be a true count of real pings — not a guessed span
  // between first-seen and last-seen, which wrongly counts the gaps in
  // between as active too.
  if (!fetchErr && session?.staff_id) {
    await supabase.from("activity_pings").insert({ staff_id: session.staff_id, session_id, pinged_at: new Date().toISOString() });
  }

  return NextResponse.json({ ok: true });
}
