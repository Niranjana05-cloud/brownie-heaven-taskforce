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
  const skipReasons: Record<string, number> = {};
  const sampleSkips: any[] = [];
  let candidateCount = 0;
  let timedOut = false;

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      // Look at emails from Google's review sender whose SUBJECT already looks like
      // a review notification ("X left a review for Y") — narrowing by subject too,
      // not just sender, cuts the candidate list drastically (Google Business Profile
      // also sends weekly summaries, Q&A alerts, etc. from the same address that
      // aren't reviews at all, and downloading every one of those was what made this
      // slow). We still track "processed" via our own private keyword, not
      // read/unread, so an already-opened email is still picked up. Must pass
      // { uid: true } here, or the numbers returned are sequence numbers, not UIDs.
      const PROCESSED_FLAG = "TASKFORCEPROCESSED";
      const uids = await client.search(
        { from: "businessprofile-noreply@google.com", subject: "left a review for", unKeyword: PROCESSED_FLAG } as any,
        { uid: true }
      );
      candidateCount = (uids || []).length;

      // Hard time budget, not just a candidate-count cap — some emails take longer
      // to download than others, so this adapts instead of guessing a fixed batch
      // size. Stops with plenty of margin before Vercel's own 60s limit kicks in
      // and returns its own (non-JSON) timeout page instead of our response.
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
        const plainText = parsedEmail.text || "";

        const review = parseGoogleReview(subject, plainText);
        if (!review) {
          const reason = "could not parse";
          skipReasons[reason] = (skipReasons[reason] || 0) + 1;
          skipped.push({ uid, reason, subject });
          if (sampleSkips.length < 5) sampleSkips.push({ reason, subject, textPreview: plainText.slice(0, 300) });
          continue;
        }

        const outletId = matchReviewOutletId(review.outletNameRaw);
        if (!outletId) {
          const reason = "outlet not matched";
          skipReasons[reason] = (skipReasons[reason] || 0) + 1;
          skipped.push({ uid, reason, outletNameRaw: review.outletNameRaw });
          if (sampleSkips.length < 5) sampleSkips.push({ reason, outletNameRaw: review.outletNameRaw, subject });
          continue;
        }

        const staffId = staffIdForReviewOutlet(outletId);
        const emailDate = parsedEmail.date ? parsedEmail.date.toISOString().split("T")[0] : new Date().toISOString().split("T")[0];
        const note = `${review.reviewerName}: ${review.reviewText}`.trim();

        const { error } = await supabase.from("outlet_reviews").insert({
          outlet_id: outletId,
          staff_id: staffId,
          report_date: emailDate,
          platform: "Google",
          rating: review.rating,
          valid_complaint: false,
          refund_given: false,
          note,
        });

        if (error) {
          const reason = "db insert failed";
          skipReasons[reason] = (skipReasons[reason] || 0) + 1;
          skipped.push({ uid, reason, error: error.message });
          if (sampleSkips.length < 5) sampleSkips.push({ reason, error: error.message });
          continue; // don't mark as processed — worth retrying once the DB issue is fixed
        }

        inserted.push({ outletId, rating: review.rating, reviewer: review.reviewerName });

        // Mark as processed with our own private flag — leaves the email's actual
        // read/unread status untouched either way.
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
