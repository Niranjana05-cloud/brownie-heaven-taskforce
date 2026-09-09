// Landed cost per item, sourced from Master_Pricing_Final_Revised.xlsx
// ("Product Cost Summary" + "Ice Cream Costing" sheets). Re-export this file
// whenever that workbook is revised so Item Performance margin stays current.
export const ITEM_COST_MAP: Record<string, number> = {
  'Alphonso Mango Ice Cream (scoop)': 18.67,
  'BH Choc Fudge Sundae': 81.68,
  'BH Signature Chocolate Cake (1 kg)': 346.47,
  'BH Signature Chocolate Cake (1/2 kg)': 222.25,
  'Babka Biscoff': 28.68,
  'Babka Chilli Cheese': 22.31,
  'Banana Walnut Fudge Sundae': 78.51,
  'Banana Walnut Ice Cream (scoop)': 27.88,
  'Biscoff Cake (1/2 kg)': 202.39,
  'Biscoff Cheesecake': 76.24,
  'Biscoff Eclair': 20.08,
  'Biscoff Medovik': 16.7,
  'Biscoff Pastry': 17.0,
  'Black Forest Pastry': 58.01,
  'Blueberry Cheesecake': 83.61,
  'Blueberry Medovik': 15.92,
  'Brooklyn Blackout Tub': 69.19,
  'Butterscotch Cake (1 kg)': 283.02,
  'Butterscotch Cake (1/2 kg)': 199.81,
  'Butterscotch Pastry': 17.0,
  'Caramel Brownie': 33.38,
  'Caramel Choc Brownie Sundae': 60.52,
  'Caramelised White Chocolate Pastry': 31.33,
  'Chicken Puff': 34.39,
  'Choco Hazelnut Brownie': 36.99,
  'Choco with Honey Medovik': 16.83,
  'Chocolate Eclair': 22.33,
  'Chocolate Medovik': 15.04,
  'Chocolate Overload Ice Cream (scoop)': 38.41,
  'Chocolate Truffle Cake (1 kg)': 381.98,
  'Chocolate Truffle Cake (1/2 kg)': 234.03,
  'Chocolate Truffle Pastry': 30.41,
  'Classic Brownie': 33.39,
  'Coffee Mocha Fudge Swirl Ice Cream (scoop)': 26.31,
  'Dark Chocolate Heart Cake (1/2 kg)': 174.58,
  'Death By Chocolate Sundae': 82.06,
  'Double Chocolate Brownie Ice Cream (scoop)': 23.87,
  'Doughnut': 21.42,
  'Dubai Royale Chocolate Sundae': 99.77,
  'EGGLESS — Classic': 30.86,
  'EGGLESS — Roasted Nuts': 35.54,
  'EGGLESS — Triple Chocolate': 33.54,
  'French Vanilla Brownie Ice Cream (scoop)': 20.18,
  'Fresh Cream Chocolate Cake (1/2 kg)': 273.3,
  'Fresh Cream Pineapple Cake (1/2 kg)': 212.8,
  'Hazelnut Biscoff Cheesecake': 97.0,
  'Hazelnut Eclair': 20.14,
  'Hazelnut Medovik': 21.07,
  'Hazelnut Truffle Cake (1/2 kg)': 234.92,
  'Korean Bun Mushroom': 36.92,
  'London Strawberry Sundae': 42.84,
  'Mad Over Milo Sundae': 58.12,
  'Mango Maharaja Sundae': 33.22,
  'Milo Brownie Ice Cream (scoop)': 20.23,
  'Milo Tres Leches Tub': 35.45,
  'Mini Pastry Cup (Chocolate)': 10.66,
  'Mini Pastry Cup (Vanilla)': 10.66,
  'Mini Pizza Non Veg': 79.95,
  'Mini Pizza Veg': 83.34,
  'Mocha Madness Sundae': 86.39,
  'Mushroom Puff': 53.96,
  'Oreo Brownie': 32.91,
  'Overload Brownie': 33.43,
  'Overloaded Cake (750 g)': 347.28,
  'Pink Rose Strawberry Cake (850 g)': 256.97,
  'Pista Medovik': 19.69,
  'Red Velvet Brownie': 34.56,
  'Red Velvet Cake (1/2 kg)': 175.39,
  'Roasted Nuts Brownie': 37.85,
  'Roasted Sicilian Pistachio Ice Cream (scoop)': 41.04,
  'Salted Caramel Brownie Ice Cream (scoop)': 23.87,
  'Salted Caramel Crunch Sundae': 58.61,
  'Sausage Claw Chicken': 38.07,
  'Strawberry Ice Cream (scoop)': 22.62,
  'Stuffed Bun Chicken': 27.7,
  'Stuffed Bun Mushroom': 47.28,
  'Stuffed Bun Paneer': 35.62,
  'Swiss Chocolate Ice Cream (scoop)': 27.88,
  'The Ultimate Indulgence Sundae': 88.28,
  'Tiramisu Cake (1 kg)': 323.31,
  'Tiramisu Cake (1/2 kg)': 205.42,
  'Tiramisu Pastry': 32.03,
  'Tiramisu Tub': 54.96,
  'Triple Chocolate Brownie': 35.85,
  'Triple Chocolate Pastry': 40.04,
  'Triple Chocolate Truffle Cake (1/2 kg)': 243.07,
  'Truffle Balls (55g / 100ml container)': 18.8,
  'Vanilla Ice Cream (scoop)': 10.96,
  'Walnut Brownie': 39.98,
  'White Chocolate Brownie': 37.12,
  'Zaitoon (Hotel) Brownie': 33.07,
};

// UrbanPiper sells items under slightly different names than the costing sheet
// (e.g. "BH Signature" vs "Brownie Heaven Signature", or a sliced item named
// after its cake). Confident one-to-one renames only — anything ambiguous (an
// Assorted Box mixing flavours, a cheesecake sold by the slice with only a
// whole-cheesecake cost on file, a combo of two items) is left unmatched on
// purpose rather than guessed.
export const ITEM_NAME_ALIASES: Record<string, string> = {
  'BH Chocolate Fudge Sundae': 'BH Choc Fudge Sundae',
  'Biscoff Slice': 'Biscoff Pastry',
  'Brownie Heaven Signature Chocolate Cake (1/2kg)': 'BH Signature Chocolate Cake (1/2 kg)',
  'Brownie Heaven Signature Chocolate Cake 1 kg': 'BH Signature Chocolate Cake (1 kg)',
  'Butterscotch Slice': 'Butterscotch Pastry',
  'Caramel Chocolate Brownie Sundae': 'Caramel Choc Brownie Sundae',
  'Caramelised White Chocolate Pastry Slice': 'Caramelised White Chocolate Pastry',
  'Choco-Hazelnut Spread Brownie': 'Choco Hazelnut Brownie',
  'Chocolate Overload Cake 750 Gms': 'Overloaded Cake (750 g)',
  'Chocolate Truffle Slice': 'Chocolate Truffle Pastry',
  'Eggless Classic Brownie': 'EGGLESS — Classic',
  'Eggless Roasted -Nuts Brownie': 'EGGLESS — Roasted Nuts',
  'Eggless Triple Chocolate Brownie': 'EGGLESS — Triple Chocolate',
  'Mini Pastry Cup Biscoff': 'Mini Pastry Cup (Chocolate)',
  'Mini Pastry Cup Butterscotch': 'Mini Pastry Cup (Chocolate)',
  'Mini Pastry Cup Chocolate Truffle': 'Mini Pastry Cup (Chocolate)',
  'Mini Pastry Cup Tiramisu': 'Mini Pastry Cup (Chocolate)',
  'Mini Pastry Cup Triple Chocolate': 'Mini Pastry Cup (Chocolate)',
  'Mini pastry cup Black forest': 'Mini Pastry Cup (Chocolate)',
  'Overloaded Brownie': 'Overload Brownie',
  'Pink Rose Strawberry Chocolate Cake 800Gms': 'Pink Rose Strawberry Cake (850 g)',
  'Tiramisu Slice': 'Tiramisu Pastry',
  'Triple Chocolate Truffle Slice': 'Triple Chocolate Pastry',
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[​⁠﻿]/g, '')
    .replace(/[()[\]]/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const stripSize = (s: string) =>
  s
    .replace(/\b\d+(\.\d+)?\s*(kg|g|gms|gm|pcs|pc|ml)\b/g, '')
    .replace(/\b1 ?\/ ?2\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const NORM_TO_KEY = new Map<string, string>();
const NOSIZE_TO_KEYS = new Map<string, string[]>();
for (const key of Object.keys(ITEM_COST_MAP)) {
  const n = norm(key);
  NORM_TO_KEY.set(n, key);
  const ns = stripSize(n);
  NOSIZE_TO_KEYS.set(ns, [...(NOSIZE_TO_KEYS.get(ns) || []), key]);
}

export type CostMatch = { cost: number; matchedName: string; method: 'alias' | 'exact' | 'scoop' | 'fuzzy' };

// Best-effort match from an UrbanPiper item name to a real landed cost.
// Returns null rather than guessing when nothing lines up confidently —
// an unmatched item should read as "no cost on file", never as a made-up number.
export function matchItemCost(rawName: string): CostMatch | null {
  const trimmed = (rawName || '').trim();
  if (!trimmed) return null;

  const alias = ITEM_NAME_ALIASES[trimmed];
  if (alias && ITEM_COST_MAP[alias] != null) {
    return { cost: ITEM_COST_MAP[alias], matchedName: alias, method: 'alias' };
  }

  const n = norm(trimmed);
  const exactKey = NORM_TO_KEY.get(n);
  if (exactKey) return { cost: ITEM_COST_MAP[exactKey], matchedName: exactKey, method: 'exact' };

  // Ice cream sold as a standalone item (not "(scoop)") maps to its per-scoop cost.
  const scoopKey = NORM_TO_KEY.get(norm(`${trimmed} (scoop)`));
  if (scoopKey) return { cost: ITEM_COST_MAP[scoopKey], matchedName: scoopKey, method: 'scoop' };

  const ns = stripSize(n);
  const candidates = NOSIZE_TO_KEYS.get(ns);
  if (candidates && candidates.length === 1) {
    return { cost: ITEM_COST_MAP[candidates[0]], matchedName: candidates[0], method: 'fuzzy' };
  }

  return null;
}
