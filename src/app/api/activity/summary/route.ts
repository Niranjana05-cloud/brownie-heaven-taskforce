import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from("activity_log")
    .select("staff_id, last_seen_at")
    .order("last_seen_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const byStaff: Record<string, { last_seen_at: string }> = {};
  for (const row of data) {
    if (!byStaff[row.staff_id]) {
      byStaff[row.staff_id] = { last_seen_at: row.last_seen_at };
    }
  }

  return NextResponse.json(byStaff);
}
