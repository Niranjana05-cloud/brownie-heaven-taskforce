// Maps a Swiggy "Rest. ID" (from the payout email) to the exact outlet + brand it
// belongs to. Each outlet has three separate Swiggy listings — one per brand
// (Brownie Heaven, Cakes by Brownie Heaven, Ice Cream by Brownie Heaven) — each with
// its own Rest ID and its own weekly payout email.
//
// Franchise outlets (Kovilambakkam, Thiruvanmiyur/ECR) are deliberately excluded —
// Nishant confirmed these are not part of TASKFORCE's payout tracking.
// "Egmore" also excluded — not one of TASKFORCE's 12 outlets.
//
// Source: ID sheets confirmed with Nishant, cross-checked for duplicates (two real
// duplicates were found and corrected before this list was finalized: CBH
// Perumbakkam/Besant Nagar, and CBH Adambakkam/Vadapalani).
//
// NOTE: outlet names in Swiggy's own sheets don't match TASKFORCE's names in two
// cases — "Thoraipakkam" = BSR Mall, "Adambakkam" = Velachery.

export type SwiggyBrand = "BH" | "CBH" | "ICBH";

export const SWIGGY_REST_ID_MAP: Record<string, { outlet_id: string; brand: SwiggyBrand }> = {
  // Brownie Heaven (BH)
  "8893":    { outlet_id: "royapettah",   brand: "BH" },
  "14808":   { outlet_id: "anna_nagar",   brand: "BH" },
  "179288":  { outlet_id: "bsr_mall",     brand: "BH" }, // Thoraipakkam
  "179292":  { outlet_id: "tambaram",     brand: "BH" },
  "179300":  { outlet_id: "porur",        brand: "BH" },
  "179301":  { outlet_id: "ra_puram",     brand: "BH" },
  "19915":   { outlet_id: "adayar",       brand: "BH" },
  "1073954": { outlet_id: "perumbakkam",  brand: "BH" },
  "1086206": { outlet_id: "besant_nagar", brand: "BH" },
  "1389031": { outlet_id: "velachery",    brand: "BH" }, // Adambakkam
  "1397892": { outlet_id: "pallavaram",   brand: "BH" },
  "1389035": { outlet_id: "vadapalani",   brand: "BH" },

  // Cakes by Brownie Heaven (CBH)
  "748300":  { outlet_id: "royapettah",   brand: "CBH" },
  "802180":  { outlet_id: "anna_nagar",   brand: "CBH" },
  "801724":  { outlet_id: "bsr_mall",     brand: "CBH" }, // Thoraipakkam
  "874056":  { outlet_id: "tambaram",     brand: "CBH" },
  "772709":  { outlet_id: "porur",        brand: "CBH" },
  "772568":  { outlet_id: "ra_puram",     brand: "CBH" },
  "1069917": { outlet_id: "adayar",       brand: "CBH" },
  "1074082": { outlet_id: "perumbakkam",  brand: "CBH" }, // corrected — was a duplicate with Besant Nagar
  "1084187": { outlet_id: "besant_nagar", brand: "CBH" },
  "1386395": { outlet_id: "velachery",    brand: "CBH" }, // corrected — was a duplicate with Vadapalani; Adambakkam
  "1398338": { outlet_id: "pallavaram",   brand: "CBH" },
  "1389028": { outlet_id: "vadapalani",   brand: "CBH" },
  // Ice Cream by Brownie Heaven (ICBH)
  "1329622": { outlet_id: "royapettah",   brand: "ICBH" },
  "1329546": { outlet_id: "anna_nagar",   brand: "ICBH" },
  "1329623": { outlet_id: "bsr_mall",     brand: "ICBH" }, // Thoraipakkam
  "1329614": { outlet_id: "tambaram",     brand: "ICBH" },
  "1332264": { outlet_id: "porur",        brand: "ICBH" },
  "1329618": { outlet_id: "ra_puram",     brand: "ICBH" },
  "1329615": { outlet_id: "adayar",       brand: "ICBH" },
  "1329629": { outlet_id: "perumbakkam",  brand: "ICBH" },
  "1383452": { outlet_id: "velachery",    brand: "ICBH" }, // Adambakkam
  // "1397892" appears blank/removed for Pallavaram ICBH in the corrected sheet —
  // Pallavaram may not have a separate ICBH Swiggy listing. Confirm with Nishant
  // before assuming; left out entirely rather than guessing a wrong ID.
  "1383457": { outlet_id: "vadapalani",   brand: "ICBH" },
  // "besant_nagar" ICBH — PENDING, Nishant sending this separately. Add it here
  // the moment it arrives, e.g.: "XXXXXXX": { outlet_id: "besant_nagar", brand: "ICBH" },
};

export function lookupSwiggyRestId(restId: string): { outlet_id: string; brand: SwiggyBrand } | null {
  return SWIGGY_REST_ID_MAP[restId] || null;
}
