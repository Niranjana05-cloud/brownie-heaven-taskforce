// Parses a Google Business Profile "you got a new review" email.
// Works off the plain-text body + subject line, not the HTML (much more stable).

export type ParsedReview = {
  platform: "google";
  outletNameRaw: string;   // e.g. "Royapettah" — needs mapping to your outlet_id
  reviewerName: string;
  rating: number;          // 1-5
  reviewText: string;
  reviewUrl: string | null; // direct link to the review on Google, when the email includes one
};

export function isGoogleReviewEmail(fromAddress: string): boolean {
  return fromAddress.toLowerCase().includes("businessprofile-noreply@google.com");
}

export function parseGoogleReview(subject: string, plainTextBody: string): ParsedReview | null {
  // Subject format: "<Name> left a review for <Outlet Name>" — note: the name in the
  // subject can be TRUNCATED (e.g. "Ajay" instead of "Ajay Rajan"), so we only use the
  // subject for the outlet name, and get the real reviewer name from the body instead.
  const subjectMatch = subject.match(/^(.+?) left a review for (.+)$/i);
  if (!subjectMatch) return null;

  const outletNameRaw = subjectMatch[2].trim();

  // Rating from body: "You got a new 2-star review"
  const ratingMatch = plainTextBody.match(/got a new (\d)-star review/i);
  if (!ratingMatch) return null;
  const rating = parseInt(ratingMatch[1], 10);

  // Body structure after the "Read review" link:
  //   Read review <https://...>
  //   (blank line)
  //   <reviewer full name>
  //   (blank line)
  //   <review text, may span multiple lines — Google truncates long reviews here with "...",
  //    the link above is the only way to read the full text for those>
  //   (blank line)
  //   Reply to review
  const bodyMatch = plainTextBody.match(
    /Read review\s+<([\s\S]+?)>\r?\n\r?\n(.+?)\r?\n\r?\n([\s\S]+?)\r?\n\r?\nReply to review/i
  );
  if (!bodyMatch) return null;

  const reviewUrl = bodyMatch[1].trim() || null;
  const reviewerName = bodyMatch[2].trim();
  const reviewText = bodyMatch[3].replace(/\r/g, "").replace(/\s+/g, " ").trim();

  return {
    platform: "google",
    outletNameRaw,
    reviewerName,
    rating,
    reviewText,
    reviewUrl,
  };
}
