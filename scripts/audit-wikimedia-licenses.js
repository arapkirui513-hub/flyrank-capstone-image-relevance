// scripts/audit-wikimedia-licenses.js
//
// Batch-queries the Wikimedia Commons API for license/attribution data on
// every corpus image suspected to be sourced from Commons (identified by
// filename pattern in data/rename-map.csv). Writes results to
// data/wikimedia-license-audit.csv for manual review and merge into
// data/dataset.csv.
//
// Run: node scripts/audit-wikimedia-licenses.js

import fs from 'node:fs';
import path from 'node:path';

const API = 'https://commons.wikimedia.org/w/api.php';

// IMPORTANT: replace with a real contact per Wikimedia's User-Agent policy
// (https://meta.wikimedia.org/wiki/User-Agent_policy) -- requests without
// one may be throttled or rejected.
const USER_AGENT = 'flyrank-capstone-provenance-audit/1.0 (kiruikevin388@example.com)';

// id -> Commons filename, taken directly from data/rename-map.csv source
// column. Extension case matters on Commons (case-sensitive after the
// first letter) -- if a lookup below reports NOT FOUND for a file you know
// exists, try flipping .jpg/.JPG or check the page manually.
const candidates = [
  ['st-010', 'Sterilizer Getinge HS11k3 IMG 0569.JPG'],
  ['hb-007', 'Intensivstation (01) 2007-03-03.jpg'],
  ['hb-003', 'Betabed Alternating Pressure Pad System.jpg'],
  ['hb-006', 'Hospital bed for patients.jpg'],
  ['df-009', 'Defibrillator Monitor.jpg'],
  ['hb-010', 'Patient room with hospital bed.jpg'],
  ['st-003', 'Autoclaves; from a medical laboratory in Abuja, Nigeria.jpg'],
  ['st-006', 'Internationale Dental-Schau IDS 2009 Cologne 027.jpg'],
  ['st-009', 'Sterilisator.jpg'],
  ['st-012', 'Systec H-Series Autoclaves.jpg'],
  ['st-004', 'Autoklav2.jpg'],
  ['st-011', 'SterisRennaisance3011.jpg'],
  ['hb-005', 'Hospital Bed 2011 CPR.jpg'],
  ['df-011', 'Modern AED Automated external defibrillator.png'],
  ['hb-004', 'Hill-Rom hospital bed.jpg'],
  ['st-001', '2003-12-03-Auto-und-Chemiclav-1.jpg'],
  ['df-007', 'Automated External Defibrillator Amsterdam airport.jpg'],
  ['st-005', 'Hospital autoclave.jpg'],
  ['st-007', 'Melag Autoclave 01.jpg'],
  ['df-008', 'Defibrillator (UOMZ).jpg'],
  ['hb-011', 'Stryker Hospital bed in Out patient clinic.jpg'],
  ['df-010', 'Defibrillator monitor Lifepak 12.jpg'],
  ['st-002', 'Autoclave Prestige Medical Omega from side.jpg'],
  ['st-008', 'Melag Autoclave 02.jpg'],
  ['hb-002', 'Aufstehbett-1.jpg'],
];

function stripTags(html) {
  return (html ?? '').replace(/<[^>]+>/g, '').trim();
}

async function lookup(filename) {
  const title = 'File:' + filename;
  const url =
    `${API}?action=query&titles=${encodeURIComponent(title)}` +
    `&prop=imageinfo&iiprop=extmetadata&format=json&formatversion=2`;

  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  const page = data?.query?.pages?.[0];
  if (!page || page.missing) return { found: false };

  const meta = page.imageinfo?.[0]?.extmetadata ?? {};
  return {
    found: true,
    pageUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
    license: meta.LicenseShortName?.value ?? '',
    licenseUrl: meta.LicenseUrl?.value ?? '',
    artist: stripTags(meta.Artist?.value),
    credit: stripTags(meta.Credit?.value),
    usageTerms: meta.UsageTerms?.value ?? '',
  };
}

const header = [
  'id',
  'filename',
  'found',
  'license',
  'license_url',
  'artist',
  'credit',
  'usage_terms',
  'source_page',
];
const rows = [header];

for (const [id, filename] of candidates) {
  try {
    const info = await lookup(filename);
    if (!info.found) {
      console.log(`${id}: NOT FOUND -- ${filename} (check filename/case manually)`);
      rows.push([id, filename, 'false', '', '', '', '', '', '']);
    } else {
      console.log(`${id}: ${info.license || 'LICENSE FIELD EMPTY -- check manually'} -- ${filename}`);
      rows.push([
        id,
        filename,
        'true',
        info.license,
        info.licenseUrl,
        info.artist,
        info.credit,
        info.usageTerms,
        info.pageUrl,
      ]);
    }
  } catch (err) {
    console.error(`${id}: ERROR -- ${err.message}`);
    rows.push([id, filename, 'error', '', '', '', '', '', '']);
  }
  // be polite to the API -- avoid hammering it in a tight loop
  await new Promise((r) => setTimeout(r, 300));
}

const csv = rows
  .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  .join('\n');

fs.writeFileSync(path.join('data', 'wikimedia-license-audit.csv'), csv, 'utf8');
console.log('\nWritten to data/wikimedia-license-audit.csv');
console.log('Review NOT FOUND / empty-license rows manually before merging into dataset.csv.');