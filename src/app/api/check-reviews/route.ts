import { ImapFlow } from "imapflow";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { simpleParser } from "mailparser";
import { isGoogleReviewEmail, parseGoogleReview } from "@/lib/reviewParsers/google";
import { isZomatoReviewEmail, parseZomatoReview } from "@/lib/reviewParsers/zomato";
import { matchReviewOutletId, staffIdForReviewOutlet } from "@/lib/reviewOutletMap";

// Give this route more time than Vercel's default 10s — IMAP + parsing +
// inserting several emails can take a while.
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PROCESSED_FLAG = "TASKFORCEPROCESSED";
// Each platform gets its OWN slice of the time budget — previously Google ran
// to completion (or timed out) before Zomato's search even started, so a large
// Google backlog could starve Zomato indefinitely. Splitting the budget means
// every single "Check Now" click makes progress on both, regardless of how
// lopsided the backlog is.
const TIME_BUDGET_PER_PLATFORM_MS = 20000;

type BatchResult = { inserted: any[]; skipped: any[]; skipReasons: Record<string, number>; sampleSkips: any[]; candidateCount: number; timedOut: boolean };

async function processGoogleBatch(client: ImapFlow, out: BatchResult) {
  const uids = await client.search(
    { from: "businessprofile-noreply@google.com", subject: "left a review for", unKeyword: PROCESSED_FLAG } as any,
    { uid: true }
  );
  out.candidateCount += (uids || []).length;
  const startedAt = Date.now();

  for (const uid of (uids || []) as number[]) {
    if (Date.now() - startedAt > TIME_BUDGET_PER_PLATFORM_MS) { out.timedOut = true; break; }
    const raw = await client.download(uid.toString(), undefined, { uid: true });
    if (!raw || !raw.content) {
      const reason = "download returned no content";
      out.skipReasons[reason] = (out.skipReasons[reason] || 0) + 1;
      out.skipped.push({ uid, reason });
      continue;
    }
    const parsedEmail = await simpleParser(raw.content);
    const subject = parsedEmail.subject || "";
    const plainText = parsedEmail.text || "";

    const review = parseGoogleReview(subject, plainText);
    if (!review) {
      const reason = "could not parse";
      out.skipReasons[reason] = (out.skipReasons[reason] || 0) + 1;
      out.skipped.push({ uid, reason, subject });
      if (out.sampleSkips.length < 3) {
        const anchor = plainText.search(/Read review/i);
        const start = anchor >= 0 ? Math.max(0, anchor - 20) : 0;
        out.sampleSkips.push({ reason, subject, foundReadReview: anchor >= 0, textPreview: plainText.slice(start, start + 1200) });
      }
      continue;
    }

    const outletId = matchReviewOutletId(review.outletNameRaw);
    if (!outletId) {
      const reason = "outlet not matched";
      out.skipReasons[reason] = (out.skipReasons[reason] || 0) + 1;
      out.skipped.push({ uid, reason, outletNameRaw: review.outletNameRaw });
      if (out.sampleSkips.length < 5) out.sampleSkips.push({ reason, outletNameRaw: review.outletNameRaw, subject });
      continue;
    }

    const staffId = staffIdForReviewOutlet(outletId);
    const emailDate = parsedEmail.date ? parsedEmail.date.toISOString().split("T")[0] : new Date().toISOString().split("T")[0];
    const note = `${review.reviewerName}: ${review.reviewText}`.trim();

    const { error } = await supabase.from("outlet_reviews").insert({
      outlet_id: outletId, staff_id: staffId, report_date: emailDate,
      platform: "Google", rating: review.rating, valid_complaint: false, refund_given: false, note,
    });

    if (error) {
      const reason = "db insert failed";
      out.skipReasons[reason] = (out.skipReasons[reason] || 0) + 1;
      out.skipped.push({ uid, reason, error: error.message });
      if (out.sampleSkips.length < 5) out.sampleSkips.push({ reason, error: error.message });
      continue;
    }

    out.inserted.push({ outletId, platform: "Google", rating: review.rating, reviewer: review.reviewerName });
    await client.messageFlagsAdd(uid.toString(), [PROCESSED_FLAG], { uid: true });
  }
}

async function processZomatoBatch(client: ImapFlow, out: BatchResult) {
  // No confirmed sender address for Zomato's review emails yet, so matched by
  // subject ("New Review") plus a body-content check for "zomato" as a safety
  // net against unrelated emails with a similar subject line.
  const uids = await client.search(
    { subject: "New Review", unKeyword: PROCESSED_FLAG } as any,
    { uid: true }
  );
  out.candidateCount += (uids || []).length;
  const startedAt = Date.now();

  for (const uid of (uids || []) as number[]) {
    if (Date.now() - startedAt > TIME_BUDGET_PER_PLATFORM_MS) { out.timedOut = true; break; }
    const raw = await client.download(uid.toString(), undefined, { uid: true });
    if (!raw || !raw.content) {
      const reason = "download returned no content";
      out.skipReasons[reason] = (out.skipReasons[reason] || 0) + 1;
      out.skipped.push({ uid, reason });
      continue;
    }
    const parsedEmail = await simpleParser(raw.content);
    const subject = parsedEmail.subject || "";
    const plainText = parsedEmail.text || "";

    if (!isZomatoReviewEmail(subject) || !/zomato/i.test(plainText)) {
      const reason = "subject matched but not a real Zomato review email";
      out.skipReasons[reason] = (out.skipReasons[reason] || 0) + 1;
      out.skipped.push({ uid, reason, subject });
      continue; // don't mark processed — genuinely not ours to claim
    }

    const review = parseZomatoReview(plainText);
    if (!review) {
      const reason = "could not parse Zomato review";
      out.skipReasons[reason] = (out.skipReasons[reason] || 0) + 1;
      out.skipped.push({ uid, reason, subject });
      if (out.sampleSkips.length < 3) out.sampleSkips.push({ reason, subject, textPreview: plainText.slice(0, 1200) });
      continue;
    }

    const outletId = matchReviewOutletId(review.outletNameRaw);
    if (!outletId) {
      const reason = "outlet not matched (Zomato)";
      out.skipReasons[reason] = (out.skipReasons[reason] || 0) + 1;
      out.skipped.push({ uid, reason, outletNameRaw: review.outletNameRaw });
      if (out.sampleSkips.length < 5) out.sampleSkips.push({ reason, outletNameRaw: review.outletNameRaw, subject });
      continue;
    }

    const staffId = staffIdForReviewOutlet(outletId);
    const emailDate = parsedEmail.date ? parsedEmail.date.toISOString().split("T")[0] : new Date().toISOString().split("T")[0];

    const { error } = await supabase.from("outlet_reviews").insert({
      outlet_id: outletId, brand: review.brand, staff_id: staffId, report_date: emailDate,
      platform: "Zomato", rating: review.rating, valid_complaint: false, refund_given: false, note: review.reviewText,
    });

    if (error) {
      const reason = "db insert failed (Zomato)";
      out.skipReasons[reason] = (out.skipReasons[reason] || 0) + 1;
      out.skipped.push({ uid, reason, error: error.message });
      if (out.sampleSkips.length < 5) out.sampleSkips.push({ reason, error: error.message });
      continue;
    }

    out.inserted.push({ outletId, brand: review.brand, platform: "Zomato", rating: review.rating });
    await client.messageFlagsAdd(uid.toString(), [PROCESSED_FLAG], { uid: true });
  }
}

export async function GET() {
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: process.env.GMAIL_USER!, pass: process.env.GMAIL_APP_PASSWORD! },
    logger: false,
  });

  const result: BatchResult = {
    inserted: [],
    skipped: [],
    skipReasons: {},
    sampleSkips: [],
    candidateCount: 0,
    timedOut: false,
  };

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      // Each platform runs with its own independent time budget — Zomato is
      // guaranteed to get checked every run, not just whenever Google's
      // backlog happens to be small enough to finish early.
      await processGoogleBatch(client, result);
      await processZomatoBatch(client, result);
    } finally {
      lock.release();
    }

    await client.logout();

    return NextResponse.json({
      success: true,
      ...result,
      remaining: result.timedOut ? result.candidateCount - result.inserted.length - result.skipped.length : 0,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}
