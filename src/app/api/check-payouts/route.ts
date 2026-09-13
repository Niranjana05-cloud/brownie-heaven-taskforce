import { ImapFlow } from "imapflow";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { simpleParser } from "mailparser";
import { parseSwiggyPayoutEmail } from "@/lib/swiggyPayoutParser";
import { lookupSwiggyRestId } from "@/lib/swiggyPayoutMap";

// Give this route more time than Vercel's default 10s.
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER!,
      pass: process.env.GMAIL_APP_PASSWORD!,
    },
    logger: false,
  });

  const inserted: any[] = [];
  const skipped: any[] = [];
  const skipReasons: Record<string, number> = {};
  const sampleSkips: any[] = [];
  let candidateCount = 0;
  let timedOut = false;

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      // The real automated payout report always comes from dip-prod@swiggy.in with
      // "Swiggy Payout Report" in the subject — narrowing to exactly this (not just
      // any email from swiggy.in) avoids catching human support correspondence
      // ("Fwd: Need Payout details" threads etc.) which have no Rest ID at all.
      // We identify exactly which outlet + brand each real report belongs to from
      // the Rest. ID inside the email body itself — more reliable than name
      // matching, since Swiggy's own outlet names don't always match TASKFORCE's.
      //
      // Also restricted to the last 90 days: Swiggy changed their report template
      // at some point and added the Rest ID — older reports (e.g. a plain "Total
      // Orders / Total Revenue" summary with no ID at all) are a genuinely
      // different, older format that simply doesn't have what we need. No point
      // scanning through potentially a year of those every single check.
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const PROCESSED_FLAG = "TASKFORCEPAYOUTPROCESSED";
      const uids = await client.search(
        { from: "dip-prod@swiggy.in", subject: "Swiggy Payout Report", since: ninetyDaysAgo, unKeyword: PROCESSED_FLAG } as any,
        { uid: true }
      );
      candidateCount = (uids || []).length;

      const startedAt = Date.now();
      const TIME_BUDGET_MS = 45000;

      for (const uid of (uids || []) as number[]) {
        if (Date.now() - startedAt > TIME_BUDGET_MS) { timedOut = true; break; }
        const raw = await client.download(uid.toString(), undefined, { uid: true });
        if (!raw || !raw.content) {
          const reason = "download returned no content";
          skipReasons[reason] = (skipReasons[reason] || 0) + 1;
          skipped.push({ uid, reason });
          continue;
        }
        const parsedEmail = await simpleParser(raw.content);
        const subject = parsedEmail.subject || "";
        // Some Swiggy report emails (the fancier card-style ones) don't include a
        // real plain-text part at all — only HTML. If the plain text is empty or
        // too short to be useful, fall back to stripping the HTML down to text.
        const htmlToText = (html: string) => html
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/(p|div|tr|li|h[1-6]|td)>/gi, "\n")
          .replace(/<[^>]+>/g, "")
          .replace(/&nbsp;/gi, " ")
          .replace(/&amp;/gi, "&")
          .replace(/&lt;/gi, "<")
          .replace(/&gt;/gi, ">")
          .replace(/&#39;/g, "'")
          .replace(/[ \t]+/g, " ")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
        const plainText = (parsedEmail.text && parsedEmail.text.length > 50) ? parsedEmail.text : htmlToText(parsedEmail.html || "");

        const parsed = parseSwiggyPayoutEmail(plainText);
        if (!parsed.restId) {
          const reason = "no Rest ID found in email";
          skipReasons[reason] = (skipReasons[reason] || 0) + 1;
          skipped.push({ uid, reason, subject });
          if (sampleSkips.length < 20) sampleSkips.push({ reason, subject, uid, fullText: plainText.slice(0, 6000) });
          continue;
        }

        const match = lookupSwiggyRestId(parsed.restId);
        if (!match) {
          const reason = "Rest ID not in outlet map yet";
          skipReasons[reason] = (skipReasons[reason] || 0) + 1;
          skipped.push({ uid, reason, restId: parsed.restId, subject });
          if (sampleSkips.length < 20) sampleSkips.push({ reason, restId: parsed.restId, subject, uid, parsed });
          continue; // don't mark processed — worth retrying once the ID is added
        }

        if (!parsed.period_start || !parsed.period_end) {
          const reason = "could not read the payout period dates";
          skipReasons[reason] = (skipReasons[reason] || 0) + 1;
          skipped.push({ uid, reason, restId: parsed.restId, subject });
          continue;
        }

        const num = (s: string | null | undefined) => { const v = parseFloat(String(s ?? "").replace(/,/g, "")); return isNaN(v) ? null : v; };
        const int = (s: string | number | null | undefined) => { const v = parseInt(String(s ?? "").replace(/,/g, "")); return isNaN(v) ? null : v; };

        const payload = {
          outlet_id: match.outlet_id,
          brand: match.brand,
          platform: "swiggy",
          period_start: parsed.period_start,
          period_end: parsed.period_end,
          total_orders: int(parsed.total_orders),
          customer_payable: num(parsed.customer_payable),
          swiggy_service_fee: num(parsed.swiggy_service_fee),
          other_charges_refund: num(parsed.other_charges_refund),
          govt_taxes: num(parsed.govt_taxes),
          amount_transferable: num(parsed.amount_transferable),
          next_payout_cycle: parsed.next_payout_cycle || null,
          next_payout_date: parsed.next_payout_date || null,
          entry_method: "auto",
          updated_at: new Date().toISOString(),
        };

        // Check for an existing row for this exact outlet+brand+platform+period
        // before deciding insert vs update — avoids relying on a database unique
        // constraint that may not (yet) include the new brand column.
        const { data: existing } = await supabase
          .from("outlet_payouts")
          .select("id")
          .eq("outlet_id", match.outlet_id)
          .eq("brand", match.brand)
          .eq("platform", "swiggy")
          .eq("period_start", parsed.period_start)
          .eq("period_end", parsed.period_end)
          .maybeSingle();

        const { error } = existing
          ? await supabase.from("outlet_payouts").update(payload).eq("id", existing.id)
          : await supabase.from("outlet_payouts").insert(payload);

        if (error) {
          const reason = "db save failed";
          skipReasons[reason] = (skipReasons[reason] || 0) + 1;
          skipped.push({ uid, reason, error: error.message });
          if (sampleSkips.length < 20) sampleSkips.push({ reason, error: error.message });
          continue;
        }

        inserted.push({ outlet_id: match.outlet_id, brand: match.brand, period: `${parsed.period_start} to ${parsed.period_end}`, amount_transferable: payload.amount_transferable });

        await client.messageFlagsAdd(uid.toString(), [PROCESSED_FLAG], { uid: true });
      }
    } finally {
      lock.release();
    }

    await client.logout();

    return NextResponse.json({
      success: true,
      inserted,
      skipped,
      candidateCount,
      skipReasons,
      sampleSkips,
      timedOut,
      remaining: timedOut ? candidateCount - inserted.length - skipped.length : 0,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}
