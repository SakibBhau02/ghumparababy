/**
 * Builds public/data/bd-geo.json — compact nested BD admin hierarchy for the
 * order form's cascading Division → District → Upazila → Union dropdowns.
 *
 * Input: phpMyAdmin JSON exports from
 *   https://github.com/kaamrul/geocode-bangladesh (MIT)
 *   divisions.json, districts.json, upazilas.json, unions.json
 *
 * Usage:
 *   bun scripts/build-bd-geo.mjs <input-dir> <output-file>
 *
 * Output shape:
 *   [{ id, en, bn, districts: [{ id, en, bn, upazilas: [{ id, en, bn, unions: [{ id, en, bn }] }] }] }]
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";

const [inDir, outFile] = process.argv.slice(2);
if (!inDir || !outFile) {
  console.error("usage: build-bd-geo.mjs <input-dir> <output-file>");
  process.exit(1);
}

function table(file) {
  const raw = JSON.parse(readFileSync(join(inDir, file), "utf8"));
  const t = raw.find((x) => x && x.type === "table");
  if (!t || !Array.isArray(t.data)) throw new Error("no table data in " + file);
  return t.data;
}

const divisions = table("divisions.json");
const districts = table("districts.json");
const upazilas = table("upazilas.json");
const unions = table("unions.json");

const byUpazila = new Map();
let orphanUnions = 0;
const upazilaIds = new Set(upazilas.map((u) => u.id));
for (const un of unions) {
  if (!un.bn_name) continue;
  if (!upazilaIds.has(un.upazilla_id)) {
    orphanUnions++;
    continue;
  }
  const arr = byUpazila.get(un.upazilla_id) ?? [];
  arr.push({ id: un.id, en: un.name, bn: un.bn_name });
  byUpazila.set(un.upazilla_id, arr);
}

const byDistrict = new Map();
const districtIds = new Set(districts.map((d) => d.id));
let orphanUpazilas = 0;
for (const up of upazilas) {
  if (!districtIds.has(up.district_id)) {
    orphanUpazilas++;
    continue;
  }
  const arr = byDistrict.get(up.district_id) ?? [];
  arr.push({
    id: up.id,
    en: up.name,
    bn: up.bn_name,
    unions: byUpazila.get(up.id) ?? [],
  });
  byDistrict.set(up.district_id, arr);
}

const byDivision = new Map();
const divisionIds = new Set(divisions.map((d) => d.id));
let orphanDistricts = 0;
for (const d of districts) {
  if (!divisionIds.has(d.division_id)) {
    orphanDistricts++;
    continue;
  }
  const arr = byDivision.get(d.division_id) ?? [];
  arr.push({
    id: d.id,
    en: d.name,
    bn: d.bn_name,
    upazilas: byDistrict.get(d.id) ?? [],
  });
  byDivision.set(d.division_id, arr);
}

const nested = divisions.map((dv) => ({
  id: dv.id,
  en: dv.name,
  bn: dv.bn_name,
  districts: byDivision.get(dv.id) ?? [],
}));

const nDistricts = nested.reduce((s, d) => s + d.districts.length, 0);
const nUpazilas = nested.reduce(
  (s, d) => s + d.districts.reduce((a, x) => a + x.upazilas.length, 0),
  0
);
const nUnions = nested.reduce(
  (s, d) =>
    s +
    d.districts.reduce(
      (a, x) => a + x.upazilas.reduce((b, u) => b + u.unions.length, 0),
      0
    ),
  0
);

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(nested));

console.log(
  `divisions=${nested.length} districts=${nDistricts} upazilas=${nUpazilas} unions=${nUnions}`
);
console.log(
  `orphans skipped: districts=${orphanDistricts} upazilas=${orphanUpazilas} unions=${orphanUnions}`
);
