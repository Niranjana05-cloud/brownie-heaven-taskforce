// Matches the outlet name that appears in a review email (e.g. "Brownie Heaven Royapettah",
// "Brownie Heaven, Pallavaram") to your internal outlet_id, and finds who owns that outlet.
// Kept separate from outletMap.ts, which is for the Stock/margin integration, not reviews.

export const REVIEW_OUTLET_DISPLAY_NAMES: Record<string, string> = {
  royapettah: "Royapettah",
  adayar: "Adyar",
  bsr_mall: "BSR Mall",
  velachery: "Velachery",
  ra_puram: "RA Puram",
  anna_nagar: "Anna Nagar",
  pallavaram: "Pallavaram",
  vadapalani: "Vadapalani",
  besant_nagar: "Besant Nagar",
  perumbakkam: "Perumbakkam",
  tambaram: "Tambaram",
  porur: "Porur",
};

// Same ownership as ALL_STAFF in dashboard/page.tsx — kept in sync manually since
// this file is used server-side (API route) and shouldn't import the client dashboard.
const STAFF_BY_OUTLET: Record<string, string> = {
  velachery: "vishnu", perumbakkam: "vishnu", tambaram: "vishnu", porur: "vishnu",
  anna_nagar: "vishnu", vadapalani: "vishnu",
  royapettah: "ahila", adayar: "ahila", bsr_mall: "ahila", pallavaram: "ahila", ra_puram: "ahila",
  besant_nagar: "bharani",
};

// Finds the outlet_id whose display name appears inside the raw outlet name text
// from the email. Case-insensitive, ignores punctuation like the comma Zomato adds.
export function matchReviewOutletId(rawOutletName: string): string | null {
  const cleaned = rawOutletName.toLowerCase().replace(/[,.]/g, " ").replace(/\s+/g, " ").trim();

  for (const [outletId, displayName] of Object.entries(REVIEW_OUTLET_DISPLAY_NAMES)) {
    if (cleaned.includes(displayName.toLowerCase())) {
      return outletId;
    }
  }
  return null;
}

export function staffIdForReviewOutlet(outletId: string): string {
  return STAFF_BY_OUTLET[outletId] || "niranjana"; // fallback: Founder's Office
}
