export type ParsedZomatoReview = {
  brandRaw: string;
  outletNameRaw: string;
  reviewText: string;
  rating: number | null;
};

export function isZomatoReviewEmail(subject: string): boolean {
  return /new review/i.test(subject);
}

// Zomato's brand naming on the restaurant name line — "Brownie Heaven",
// "Cakes By Brownie Heaven", "Ice Cream By Brownie Heaven" (exact casing not
// guaranteed, matched loosely).
function brandFromRaw(brandRaw: string): "BH" | "CBH" | "ICBH" {
  const b = brandRaw.toLowerCase();
  if (b.includes("ice cream")) return "ICBH";
  if (b.includes("cake")) return "CBH";
  return "BH";
}

// Real structure (confirmed against an actual Zomato review email):
//   A new review has been written for your restaurant Brownie Heaven, Adambakkam:
//
//       Loved the fudgy brownie and the packaging
//       Rating: 5 / 5
export function parseZomatoReview(body: string): (ParsedZomatoReview & { brand: "BH" | "CBH" | "ICBH" }) | null {
  const t = body.replace(/\u00a0/g, " ");
  const nameMatch = t.match(/for your restaurant\s+([\s\S]+?):/i);
  if (!nameMatch) return null;

  const fullName = nameMatch[1].replace(/\s+/g, " ").trim();
  const parts = fullName.split(",").map((s) => s.trim());
  const brandRaw = parts[0] || "";
  const outletNameRaw = parts.length > 1 ? parts[1] : parts[0];

  const ratingMatch = t.match(/Rating:\s*(\d+)\s*\/\s*5/i);
  const rating = ratingMatch ? parseInt(ratingMatch[1], 10) : null;

  const afterName = t.slice(nameMatch.index! + nameMatch[0].length);
  const textMatch = afterName.match(/^([\s\S]*?)\r?\n\s*Rating:/i);
  const reviewText = textMatch ? textMatch[1].replace(/\s+/g, " ").trim() : "";

  if (rating == null) return null;

  return { brandRaw, outletNameRaw, reviewText, rating, brand: brandFromRaw(brandRaw) };
}
