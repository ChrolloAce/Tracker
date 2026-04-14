import { readFileSync } from 'fs';

const envFile = readFileSync('.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq === -1) continue;
  let k = t.slice(0, eq), v = t.slice(eq + 1);
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  process.env[k] = v;
}

const APIFY_TOKEN = process.env.APIFY_TOKEN;
if (!APIFY_TOKEN) throw new Error('Missing APIFY_TOKEN');

// Representative URLs from each Dan account (picked from the Firestore scan)
const reels = [
  // @danharebin — numeric-ID-keyed in DB (suspect)
  { who: 'danharebin', url: 'https://www.instagram.com/reel/DW-KgAGjcuO/', dbViews: 88363 },
  { who: 'danharebin', url: 'https://www.instagram.com/reel/DXFnHzLgQux/', dbViews: 1411 },
  // @coachdango — user says numbers are wildly off; pick low and high examples
  { who: 'coachdango-low', url: 'https://www.instagram.com/reel/DXEh3CVEVr6/', dbViews: 13 },
  { who: 'coachdango-low', url: 'https://www.instagram.com/reel/DXEhpjeEaDt/', dbViews: 6 },
  { who: 'coachdango-low', url: 'https://www.instagram.com/reel/DXEhemykZ8c/', dbViews: 6 },
  { who: 'coachdango-high', url: 'https://www.instagram.com/reel/DXFanC9JIsc/', dbViews: 60686 },
  { who: 'coachdango-med', url: 'https://www.instagram.com/reel/DXEjprrz5Sl/', dbViews: 40586 },
  // @dandybeingdandy — control, appears to work fine
  { who: 'dandybeingdandy', url: 'https://www.instagram.com/reel/DWjmVo8DG6Z/', dbViews: 6357 },
];

const ACTOR = 'hpix~ig-reels-scraper';

async function runActor(postUrls) {
  const url = `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&format=json`;
  const body = {
    post_urls: postUrls,
    target: 'reels_only',
    reels_count: postUrls.length,
    include_raw_data: true,
    custom_functions: '{ shouldSkip: (data) => false, shouldContinue: (data) => true }',
    proxy: {
      useApifyProxy: true,
      apifyProxyGroups: ['RESIDENTIAL'],
      apifyProxyCountry: 'US'
    },
    maxConcurrency: 1,
    maxRequestRetries: 3,
    handlePageTimeoutSecs: 120,
    debugLog: false
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify ${res.status}: ${text.substring(0, 500)}`);
  }
  return await res.json();
}

console.log(`\n🧪 Probing Apify actor ${ACTOR} with ${reels.length} reel URLs (single call, same way production does it)\n`);
const started = Date.now();
const items = await runActor(reels.map(r => r.url));
const elapsed = ((Date.now() - started) / 1000).toFixed(1);
console.log(`✅ returned ${items.length} items in ${elapsed}s\n`);

// Index results by code
const byCode = new Map();
for (const it of items) {
  const code = it.code || it.id || 'unknown';
  byCode.set(code, it);
}

console.log('Raw Apify items: printing diagnostic field summary per item\n');
for (const reel of reels) {
  const shortcode = reel.url.match(/\/reel\/([^\/\?]+)/)?.[1] || '';
  const it = byCode.get(shortcode);
  console.log(`━━━ ${reel.who}  ${reel.url}`);
  console.log(`    DB stored views:  ${reel.dbViews}`);
  if (!it) {
    console.log(`    ❌ NOT RETURNED BY APIFY`);
    // try to find by id match in raw items
    const byUrl = items.find(x => (x.input && x.input.includes(shortcode)) || (x.url && x.url.includes(shortcode)));
    if (byUrl) {
      console.log(`    (found by URL match though)`);
      dumpFields(byUrl);
    }
    console.log('');
    continue;
  }
  dumpFields(it);
  console.log('');
}

// Summarize odd cases
console.log('\n=== FIELD PRESENCE SUMMARY ACROSS ALL ITEMS ===');
const fieldStats = {};
for (const it of items) {
  for (const f of ['play_count', 'view_count', 'video_view_count', 'video_play_count', 'like_count', 'comment_count', 'error', 'code', 'id', 'input']) {
    fieldStats[f] = fieldStats[f] || { present: 0, zero: 0, nonZero: 0, truthy: 0 };
    if (f in it) {
      fieldStats[f].present++;
      if (it[f] === 0) fieldStats[f].zero++;
      else if (typeof it[f] === 'number') fieldStats[f].nonZero++;
      if (it[f]) fieldStats[f].truthy++;
    }
  }
}
for (const [f, s] of Object.entries(fieldStats)) {
  console.log(`  ${f.padEnd(20)} present=${s.present}/${items.length}  zero=${s.zero}  nonZero=${s.nonZero}  truthy=${s.truthy}`);
}

function dumpFields(it) {
  console.log(`    Apify returned code=${it.code}  id=${it.id}  error=${it.error || 'none'}`);
  console.log(`    play_count=${it.play_count}  view_count=${it.view_count}  video_view_count=${it.video_view_count}  video_play_count=${it.video_play_count}`);
  console.log(`    like_count=${it.like_count}  comment_count=${it.comment_count}`);
  if (it.raw_data) {
    const rd = it.raw_data;
    console.log(`    raw_data.video_view_count=${rd.video_view_count}  raw_data.video_play_count=${rd.video_play_count}  raw_data.edge_liked_by.count=${rd.edge_liked_by?.count}`);
  }
}

process.exit(0);
