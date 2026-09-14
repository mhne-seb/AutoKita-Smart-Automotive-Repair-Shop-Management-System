// Regenerates src/data/ph-address.json from the official PSA PSGC dataset.
// Run:  node scripts/build-ph-address.mjs
// Source: https://psgc.gitlab.io/api  (no API key)
import fs from "fs";

const get = async (u) => {
  const r = await fetch(u);
  if (!r.ok) throw new Error(`${u} -> ${r.status}`);
  return r.json();
};

const [provinces, cities] = await Promise.all([
  get("https://psgc.gitlab.io/api/provinces.json"),
  get("https://psgc.gitlab.io/api/cities-municipalities.json"),
]);

// This client is a local repair shop — home service and walk-ins come from a
// limited radius, so we only list Luzon. Anyone outside picks "Others".
// To widen/narrow later, change this filter and re-run.
const IN_SCOPE = (islandGroupCode) => islandGroupCode === "luzon";

const luzonProvinces = provinces.filter((p) => IN_SCOPE(p.islandGroupCode));
const nameByCode = Object.fromEntries(luzonProvinces.map((p) => [p.code, p.name]));
const NCR = "130000000";

// Tidy PSGC's inconsistent "City of X" / "X City" into "X".
// Strip only the "City of " prefix. Keep "... City" suffixes — they disambiguate
// (e.g. "Quezon City" the LGU vs. "Quezon" the province).
const clean = (n) => n.replace(/^City of\s+/i, "").trim();

const citiesByProvince = {};
for (const c of cities) {
  if (!IN_SCOPE(c.islandGroupCode)) continue; // Luzon only
  let prov = nameByCode[c.provinceCode];
  if (!prov) {
    if (c.regionCode === NCR) prov = "Metro Manila";
    else continue; // province-less city outside NCR — skip, "Others" covers it
  }
  (citiesByProvince[prov] ??= []).push(clean(c.name));
}
for (const k of Object.keys(citiesByProvince)) {
  citiesByProvince[k] = [...new Set(citiesByProvince[k])].sort((a, b) => a.localeCompare(b));
}

const out = {
  _source: "https://psgc.gitlab.io/api (PSA PSGC). Regenerate: node scripts/build-ph-address.mjs",
  provinces: Object.keys(citiesByProvince).sort((a, b) => a.localeCompare(b)),
  citiesByProvince,
};

fs.mkdirSync("src/data", { recursive: true });
fs.writeFileSync("src/data/ph-address.json", JSON.stringify(out, null, 2));

const total = Object.values(citiesByProvince).reduce((n, a) => n + a.length, 0);
console.log(`provinces: ${out.provinces.length}`);
console.log(`city/municipality entries: ${total}`);
console.log(`file size: ${(fs.statSync("src/data/ph-address.json").size / 1024).toFixed(0)} KB`);
