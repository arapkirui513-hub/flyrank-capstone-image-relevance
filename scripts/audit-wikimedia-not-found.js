// scripts/audit-wikimedia-not-found.js
//
// For each filename that came back NOT FOUND in the exact-title lookup,
// search Commons' File namespace for close matches instead of guessing
// case/spacing by hand. Prints candidates for manual confirmation --
// does NOT auto-select a match, since a wrong guess here would poison
// dataset.csv with an incorrect source.
//
// Run: node scripts/audit-wikimedia-not-found.js

const API = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'flyrank-capstone-provenance-audit/1.0 (kiruikevin388@gmail.com)';

const notFound = [
  ['hb-003', 'Betabed Alternating Pressure Pad System'],
  ['st-006', 'Internationale Dental-Schau IDS 2009 Cologne 027'],
  ['st-009', 'Sterilisator'],
  ['st-004', 'Autoklav2'],
  ['hb-005', 'Hospital Bed 2011 CPR'],
  ['hb-004', 'Hill-Rom hospital bed'],
  ['st-007', 'Melag Autoclave 01'],
  ['st-008', 'Melag Autoclave 02'],
];

async function search(term) {
  const url =
    `${API}?action=query&list=search&srnamespace=6` +
    `&srsearch=${encodeURIComponent(term)}&srlimit=5&format=json&formatversion=2`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data?.query?.search ?? [];
}

for (const [id, term] of notFound) {
  console.log(`\n${id}: searching for "${term}"`);
  try {
    const results = await search(term);
    if (results.length === 0) {
      console.log('  no candidates found -- likely deleted, renamed, or not a Commons file');
    } else {
      for (const r of results) {
        console.log(`  candidate: ${r.title}  -> https://commons.wikimedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`);
      }
    }
  } catch (err) {
    console.error(`  ERROR: ${err.message}`);
  }
  await new Promise((r) => setTimeout(r, 300));
}

console.log('\nConfirm each candidate visually before updating the filename in rename-map.csv / dataset.csv.');