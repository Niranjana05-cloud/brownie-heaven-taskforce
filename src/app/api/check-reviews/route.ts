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
const TIME_BUDGET_PER_PLATFORM_MS = 20000;
// Per-REASON sample cap, not a shared global cap — otherwise a common reason
// (e.g. "outlet not matched") fills the whole sample pool before a rarer but
// more important reason (e.g. "could not parse") ever gets a single example
// shown, making it impossible to diagnose.
const SAMPLES_PER_REASON = 3;

type BatchResult = { inserted: any[]; skipped: any[]; skipReasons: Record<string, number>; sampleSkips: any[]; sampleCountByReason: Record<string, number>; candidateCount: number; timedOut: boolean };

function recordSkip(out: BatchResult, uid: number, reason: string, extra: Record<string, any> = {}) {
  out.skipReasons[reason] = (out.skipReasons[reason] || 0) + 1;
  out.skipped.push({ uid, reason, ...extra });
  const soFar = out.sampleCountByReason[reason] || 0;
  if (soFar < SAMPLES_PER_REASON) {
    out.sampleCountByReason[reason] = soFar + 1;
    out.sampleSkips.push({ reason, ...extra });
  }
}

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
    if (!raw || !raw.content) { recordSkip(out, uid, "download returned no content"); continue; }
    const parsedEmail = await simpleParser(raw.content);
    const subject = parsedEmail.subject || "";
    const plainText = parsedEmail.text || "";

    const review = parseGoogleReview(subject, plainText);
    if (!review) {
      const anchor = plainText.search(/Read review/i);
      const start = anchor >= 0 ? Math.max(0, anchor - 20) : 0;
      recordSkip(out, uid, "could not parse", { subject, foundReadReview: anchor >= 0, textPreview: plainText.slice(start, start + 1200) });
      continue;
    }

    const outletId = matchReviewOutletId(review.outletNameRaw);
    if (!outletId) { recordSkip(out, uid, "outlet not matched", { outletNameRaw: review.outletNameRaw, subject }); continue; }

    const staffId = staffIdForReviewOutlet(outletId);
    const emailDate = parsedEmail.date ? parsedEmail.date.toISOString().split("T")[0] : new Date().toISOString().split("T")[0];
    const note = `${review.reviewerName}: ${review.reviewText}`.trim();

    const { error } = await supabase.from("outlet_reviews").insert({
      outlet_id: outletId, staff_id: staffId, report_date: emailDate,
      platform: "Google", rating: review.rating, valid_complaint: false, refund_given: false, note,
    });

    if (error) { recordSkip(out, uid, "db insert failed", { error: error.message }); continue; }

    out.inserted.push({ outletId, platform: "Google", rating: review.rating, reviewer: review.reviewerName });
    await client.messageFlagsAdd(uid.toString(), [PROCESSED_FLAG], { uid: true });
  }
}

async function processZomatoBatch(client: ImapFlow, out: BatchResult) {
  const uids = await client.search(
    { subject: "New Review", unKeyword: PROCESSED_FLAG } as any,
    { uid: true }
  );
  out.candidateCount += (uids || []).length;
  const startedAt = Date.now();

  for (const uid of (uids || []) as number[]) {
    if (Date.now() - startedAt > TIME_BUDGET_PER_PLATFORM_MS) { out.timedOut = true; break; }
    const raw = await client.download(uid.toString(), undefined, { uid: true });
    if (!raw || !raw.content) { recordSkip(out, uid, "download returned no content"); continue; }
    const parsedEmail = await simpleParser(raw.content);
    const subject = parsedEmail.subject || "";
    const plainText = parsedEmail.text || "";

    if (!isZomatoReviewEmail(subject) || !/zomato/i.test(plainText)) {
      recordSkip(out, uid, "subject matched but not a real Zomato review email", { subject });
      continue; // don't mark processed — genuinely not ours to claim
    }

    const review = parseZomatoReview(plainText);
    if (!review) {
      recordSkip(out, uid, "could not parse Zomato review", { subject, textPreview: plainText.slice(0, 1500) });
      continue;
    }

    const outletId = matchReviewOutletId(review.outletNameRaw);
    if (!outletId) { recordSkip(out, uid, "outlet not matched (Zomato)", { outletNameRaw: review.outletNameRaw, subject }); continue; }

    const staffId = staffIdForReviewOutlet(outletId);
    const emailDate = parsedEmail.date ? parsedEmail.date.toISOString().split("T")[0] : new Date().toISOString().split("T")[0];

    const { error } = await supabase.from("outlet_reviews").insert({
      outlet_id: outletId, brand: review.brand, staff_id: staffId, report_date: emailDate,
      platform: "Zomato", rating: review.rating, valid_complaint: false, refund_given: false, note: review.reviewText,
    });

    if (error) { recordSkip(out, uid, "db insert failed (Zomato)", { error: error.message }); continue; }

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
    sampleCountByReason: {},
    candidateCount: 0,
    timedOut: false,
  };

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      await processGoogleBatch(client, result);
      await processZomatoBatch(client, result);
    } finally {
      lock.release();
    }

    await client.logout();

    return NextResponse.json({
      success: true,
      inserted: result.inserted,
      skipped: result.skipped,
      candidateCount: result.candidateCount,
      skipReasons: result.skipReasons,
      sampleSkips: result.sampleSkips,
      timedOut: result.timedOut,
      remaining: result.timedOut ? result.candidateCount - result.inserted.length - result.skipped.length : 0,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}
