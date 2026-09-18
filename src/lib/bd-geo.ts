/**
 * BD admin hierarchy (Division → District → Upazila → Union) helpers.
 *
 * Data lives in public/data/bd-geo.json (built by scripts/build-bd-geo.mjs).
 * - Client components fetch it over HTTP: fetch("/data/bd-geo.json")
 * - Server code uses loadBdGeo() below (reads from disk, cached).
 *
 * Stored values are Bengali names (bn) — human-readable for courier/admin.
 */

export type BdUnion = { id: string; en: string; bn: string };
export type BdUpazila = {
  id: string;
  en: string;
  bn: string;
  unions: BdUnion[];
};
export type BdDistrict = {
  id: string;
  en: string;
  bn: string;
  upazilas: BdUpazila[];
};
export type BdDivision = {
  id: string;
  en: string;
  bn: string;
  districts: BdDistrict[];
};

export type LocationSelection = {
  division: string;
  district: string;
  upazila: string;
};

/** Verify a Division → District → Upazila chain by Bengali name. */
export function isValidLocationChain(
  divisions: BdDivision[],
  sel: LocationSelection
): boolean {
  if (!sel.division || !sel.district || !sel.upazila) return false;
  const division = divisions.find((d) => d.bn === sel.division);
  if (!division) return false;
  const district = division.districts.find((d) => d.bn === sel.district);
  if (!district) return false;
  return district.upazilas.some((u) => u.bn === sel.upazila);
}

/**
 * Common customer spellings → canonical district `en` (as in bd-geo.json).
 * Covers the famous mismatches (Chittagong/Chattogram, Cumilla, Bogra…)
 * plus a few well-known upazilas that pin the district outright.
 */
const DISTRICT_ALIASES: Record<string, string> = {
  chittagong: "Chattogram",
  chattagram: "Chattogram",
  chattogram: "Chattogram",
  "cox bazar": "Coxsbazar",
  "coxs bazar": "Coxsbazar",
  coxsbazar: "Coxsbazar",
  cumilla: "Comilla",
  bogra: "Bogura",
  barishal: "Barisal",
  jessore: "Jashore",
  jhenidah: "Jhenaidah",
  jhalokathi: "Jhalakathi",
  jhalokati: "Jhalakathi",
  kustia: "Kushtia",
  chapainawabgonj: "Chapainawabganj",
  chapai: "Chapainawabganj",
  "b-baria": "Brahmanbaria",
  bbaria: "Brahmanbaria",
  brahmanbaria: "Brahmanbaria",
  hobigonj: "Habiganj",
  habigonj: "Habiganj",
  sunamgonj: "Sunamganj",
  kishoregonj: "Kishoreganj",
  kishorganj: "Kishoreganj",
  manikgonj: "Manikganj",
  gopalgonj: "Gopalganj",
  sirajgonj: "Sirajganj",
  munshigonj: "Munshiganj",
  norshingdi: "Narsingdi",
  laxmipur: "Lakshmipur",
  // Famous upazilas (unique enough to pin the district).
  keranigonj: "Dhaka",
  savar: "Dhaka",
  dohar: "Dhaka",
  dhamrai: "Dhaka",
  fatikchhari: "Chattogram",
  hathazari: "Chattogram",
  sitakunda: "Chattogram",
};

/** Upazila names too generic to pin a district on their own. */
const UPAZILA_STOPLIST = new Set([
  "sadar",
  "kotwali",
  "cantonment",
  "thana",
  "model",
  "town",
]);

function normEn(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’'‘`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Unify Bengali nukta spellings: customers type RRA/RRHA/YYA precomposed
 * (U+09DC...) or decomposed (base + U+09BC) interchangeably. Fold both
 * sides to the precomposed form so either spelling matches.
 */
const DDA = String.fromCharCode(0x09a1);
const DDHA = String.fromCharCode(0x09a2);
const YA = String.fromCharCode(0x09af);
const NUKTA = String.fromCharCode(0x09bc);
const RRA = String.fromCharCode(0x09dc);
const RRHA = String.fromCharCode(0x09dd);
const YYA = String.fromCharCode(0x09df);
function normBn(s: string): string {
  return s
    .toLowerCase()
    .split(DDA + NUKTA).join(RRA)
    .split(DDHA + NUKTA).join(RRHA)
    .split(YA + NUKTA).join(YYA);
}

function hasWord(hayNormalized: string, needleRaw: string): boolean {
  const n = normEn(needleRaw);
  if (!n) return false;
  return `( ${hayNormalized} )`.includes(` ${n} `);
}

export type GuessedLocation = {
  /** Bengali names (same convention as the cascade stores). */
  division: string;
  district: string;
  upazila: string;
};

/**
 * Guess Division/District (+Upazila when found) from a free-text address.
 * Used when the location cascade is off and the order only has a typed
 * address — e.g. ShopBase forwarding needs a real district instead of the
 * "Dhaka" last-resort fallback. Returns null when nothing matches
 * (caller keeps its existing fallback). Districts win over upazilas;
 * longest names first so "Chapainawabganj" beats "Nawabganj".
 */
export function guessLocationFromAddress(
  raw: string,
  divisions: BdDivision[]
): GuessedLocation | null {
  if (!raw || !raw.trim() || !Array.isArray(divisions)) return null;
  const textEn = normEn(raw);
  const textBn = normBn(raw);
  if (!textEn && !textBn.trim()) return null;

  const byEn = new Map<string, { div: BdDivision; dis: BdDistrict }>();
  for (const div of divisions) {
    for (const dis of div.districts ?? []) {
      byEn.set(normEn(dis.en), { div, dis });
    }
  }
  const aliasToEn = new Map<string, string>();
  for (const [alias, en] of Object.entries(DISTRICT_ALIASES)) {
    aliasToEn.set(normEn(alias), normEn(en));
  }

  // 1) Districts: exact en word, alias word, or full bn-name substring.
  const districtHits: { div: BdDivision; dis: BdDistrict; len: number }[] = [];
  for (const div of divisions) {
    for (const dis of div.districts ?? []) {
      const enN = normEn(dis.en);
      const bnN = normBn((dis.bn ?? "").trim());
      let len = 0;
      if (enN && hasWord(textEn, enN)) len = Math.max(len, enN.length);
      for (const [alias, target] of aliasToEn) {
        if (target === enN && hasWord(textEn, alias)) {
          len = Math.max(len, alias.length);
        }
      }
      if (bnN && textBn.includes(bnN)) len = Math.max(len, bnN.length);
      if (len > 0) districtHits.push({ div, dis, len });
    }
  }
  districtHits.sort((a, b) => b.len - a.len);
  if (districtHits.length > 0) {
    const { div, dis } = districtHits[0];
    const upa = bestUpazila(textEn, textBn, dis);
    return { division: div.bn, district: dis.bn, upazila: upa?.bn ?? "" };
  }

  // 2) Upazilas: full-name match implies the parent district.
  const upaHits: { div: BdDivision; dis: BdDistrict; upa: BdUpazila; len: number }[] = [];
  for (const div of divisions) {
    for (const dis of div.districts ?? []) {
      for (const upa of dis.upazilas ?? []) {
        const enN = normEn(upa.en);
        const bnN = normBn((upa.bn ?? "").trim());
        if (enN && (enN.length < 5 || UPAZILA_STOPLIST.has(enN))) continue;
        let len = 0;
        if (enN && hasWord(textEn, enN)) len = Math.max(len, enN.length);
        if (
          bnN &&
          bnN.length >= 3 &&
          !isGenericUpazilaBn(bnN) &&
          textBn.includes(bnN)
        ) {
          len = Math.max(len, bnN.length);
        }
        if (len > 0) upaHits.push({ div, dis, upa, len });
      }
    }
  }
  upaHits.sort((a, b) => b.len - a.len);
  if (upaHits.length > 0) {
    const { div, dis, upa } = upaHits[0];
    return { division: div.bn, district: dis.bn, upazila: upa.bn };
  }
  return null;
}

/** Best upazila inside an already-matched district (for pre-fill). */
function bestUpazila(
  textEn: string,
  textBn: string,
  dis: BdDistrict
): BdUpazila | null {
  const ups = [...(dis.upazilas ?? [])].sort((a, b) => {
    const al = Math.max(normEn(a.en).length, (a.bn ?? "").trim().length);
    const bl = Math.max(normEn(b.en).length, (b.bn ?? "").trim().length);
    return bl - al;
  });
  for (const upa of ups) {
    const enN = normEn(upa.en);
    const bnN = normBn((upa.bn ?? "").trim());
    if (enN && enN.length >= 5 && !UPAZILA_STOPLIST.has(enN) && hasWord(textEn, enN)) {
      return upa;
    }
    if (bnN && bnN.length >= 3 && !isGenericUpazilaBn(bnN) && textBn.includes(bnN)) {
      return upa;
    }
  }
  return null;
}

/** Bangla upazila names too generic to match on (appear inside many names). */
function isGenericUpazilaBn(bn: string): boolean {
  return bn === "সদর" || bn === "কোতোয়ালি" || bn === "থানা";
}
