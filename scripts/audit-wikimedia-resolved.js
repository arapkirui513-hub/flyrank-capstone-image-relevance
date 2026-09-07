// scripts/audit-wikimedia-resolved.js
//
// Re-queries the exact-title lookup for the five files that were only
// missing due to lowercase .jpg vs Commons' actual .JPG extension.
// Appends results to data/wikimedia-license-audit.csv (does not overwrite
// the existing 17 confirmed rows).
//
// Run: node scripts/audit-wikimedia-resolved.js

import fs from 'node:fs';
import path from 'node:path';

const API = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'flyrank-capstone-provenance-audit/1.0 (kiruikevin388@gmail.com)';

// id -> confirmed exact Commons title (from fuzzy-search results)
const confirmed = [
  ['st-006', 'Internationale Dental-Schau IDS 2009 Cologne 027.JPG'],
  ['st-004', 'Autoklav2.JPG'],
  ['hb-005', 'Hospital Bed 2011 CPR.JPG'],
  ['st-007', 'Melag Autoclave 01.JPG'],
  ['st-008', 'Melag Autoclave 02.JPG'],
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

const csvPath = path.join('data', 'wikimedia-license-audit.csv');
const newRows = [];

for (const [id, filename] of confirmed) {
  try {
    const info = await lookup(filename);
    if (!info.found) {
      console.log(`${id}: STILL NOT FOUND -- ${filename} (double-check title exactly)`);
      newRows.push([id, filename, 'false', '', '', '', '', '', '']);
    } else {
      console.log(`${id}: ${info.license || 'LICENSE FIELD EMPTY'} -- ${filename}`);
      newRows.push([
        id, filename, 'true', info.license, info.licenseUrl,
        info.artist, info.credit, info.usageTerms, info.pageUrl,
      ]);
    }
  } catch (err) {
    console.error(`${id}: ERROR -- ${err.message}`);
    newRows.push([id, filename, 'error', '', '', '', '', '', '']);
  }
  await new Promise((r) => setTimeout(r, 300));
}

const csvLine = (r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',');
const appendText = '\n' + newRows.map(csvLine).join('\n');
fs.appendFileSync(csvPath, appendText, 'utf8');

console.log(`\nAppended ${newRows.length} rows to ${csvPath}`);
console.log('hb-003, st-009, hb-004 still need visual confirmation before any lookup -- see candidate list.');