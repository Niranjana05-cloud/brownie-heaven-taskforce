import { ImapFlow } from "imapflow";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { simpleParser } from "mailparser";
import { isGoogleReviewEmail, parseGoogleReview } from "@/lib/reviewParsers/google";
import { matchReviewOutletId, staffIdForReviewOutlet } from "@/lib/reviewOutletMap";

// Give this route more time than Vercel's default 10s — IMAP + parsing +
// inserting several emails can take a while.
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

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      // Only look at unread emails from Google's review notification sender
      // (must pass { uid: true } here, or the numbers returned are sequence
      // numbers, not UIDs — and everything downstream expects UIDs)
      const uids = await client.search(
        { seen: false, from: "businessprofile-noreply@google.com" },
        { uid: true }
      );

      for (const uid of (uids || []) as number[]) {
        const raw = await client.download(uid.toString(), undefined, { uid: true });
        if (!raw || !raw.content) {
          skipped.push({ uid, reason: "download returned no content" });
          continue;
        }
        const parsedEmail = await simpleParser(raw.content);

        const subject = parsedEmail.subject || "";
        const plainText = parsedEmail.text || "";

        const review = parseGoogleReview(subject, plainText);
        if (!review) {
          skipped.push({ uid, reason: "could not parse", subject });
          continue;
        }

        const outletId = matchReviewOutletId(review.outletNameRaw);
        if (!outletId) {
          skipped.push({ uid, reason: "outlet not matched", outletNameRaw: review.outletNameRaw });
          continue;
        }

        const staffId = staffIdForReviewOutlet(outletId);
        const today = new Date().toISOString().split("T")[0];
        const note = `${review.reviewerName}: ${review.reviewText}`.trim();

        const { error } = await supabase.from("outlet_reviews").insert({
          outlet_id: outletId,
          staff_id: staffId,
          report_date: today,
          platform: "Google",
          rating: review.rating,
          valid_complaint: false,
          refund_given: false,
          note,
        });

        if (error) {
          skipped.push({ uid, reason: "db insert failed", error: error.message });
          continue;
        }

        inserted.push({ outletId, rating: review.rating, reviewer: review.reviewerName });

        // Mark as read so we don't process it again next time
        await client.messageFlagsAdd(uid.toString(), ["\\Seen"], { uid: true });
      }
    } finally {
      lock.release();
    }

    await client.logout();

    return NextResponse.json({ success: true, inserted, skipped });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}
