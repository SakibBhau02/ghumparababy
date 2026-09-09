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
