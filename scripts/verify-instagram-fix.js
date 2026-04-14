import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Load .env.local
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

let pk = process.env.FIREBASE_PRIVATE_KEY || '';
if (pk.startsWith('"') && pk.endsWith('"')) pk = pk.slice(1, -1);
pk = pk.replace(/\\n/g, '\n');

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: pk,
  }),
});

const db = getFirestore();
const NUMERIC_RE = /^\d+(_\d+)?$/;

// ────────────────────────────────────────────────────────────────
// PHASE A: fleet-wide scan of Instagram videoIds
// ────────────────────────────────────────────────────────────────
console.log('\n=== PHASE A: fleet-wide Instagram videoId scan ===\n');

let totalInstagramVideos = 0;
let numericIdCount = 0;
const numericOffenders = []; // { orgId, orgName, projectId, projectName, accountUsername, videoId, videoUrl }

const orgsSnap = await db.collection('organizations').get();
for (const orgDoc of orgsSnap.docs) {
  const orgId = orgDoc.id;
  const orgName = orgDoc.data().name || '(unnamed)';
  const projectsSnap = await db.collection('organizations').doc(orgId).collection('projects').get();
  for (const projDoc of projectsSnap.docs) {
    const projectId = projDoc.id;
    const projectName = projDoc.data().name || '(unnamed project)';
    const videosSnap = await db.collection('organizations').doc(orgId)
      .collection('projects').doc(projectId)
      .collection('videos')
      .where('platform', '==', 'instagram')
      .get();
    totalInstagramVideos += videosSnap.size;
    for (const vDoc of videosSnap.docs) {
      const v = vDoc.data();
      const vid = v.videoId || '';
      if (NUMERIC_RE.test(vid)) {
        numericIdCount++;
        numericOffenders.push({
          orgId, orgName, projectId, projectName,
          accountUsername: v.accountUsername || '(?)',
          videoId: vid,
          videoUrl: v.videoUrl || v.url || '(none)',
          docId: vDoc.id,
        });
      }
    }
  }
}

console.log(`Total Instagram videos across fleet: ${totalInstagramVideos}`);
console.log(`Videos with purely-numeric videoId:   ${numericIdCount}`);
if (numericOffenders.length) {
  console.log('\nRemaining numeric-id videos:');
  for (const o of numericOffenders) {
    console.log(`  - org="${o.orgName}"(${o.orgId}) project=${o.projectId} @${o.accountUsername} videoId=${o.videoId}`);
    console.log(`      url=${o.videoUrl}  docId=${o.docId}`);
  }
}

// ────────────────────────────────────────────────────────────────
// PHASE B: @danharebin videos in Maktub
// ────────────────────────────────────────────────────────────────
console.log('\n\n=== PHASE B: @danharebin videos ===\n');

const DAN_ORG = '00JnaavZp41PofxFf3cP';
const DAN_PROJECT = 'zUO7WgoL14Oy6UYlHX5z';
const DAN_ACCOUNT_ID = 'instagram_danharebin';

const danAccountRef = db.collection('organizations').doc(DAN_ORG)
  .collection('projects').doc(DAN_PROJECT)
  .collection('trackedAccounts').doc(DAN_ACCOUNT_ID);
const danAccountSnap = await danAccountRef.get();
if (!danAccountSnap.exists) {
  console.log(`⚠️  trackedAccount not found at expected path: ${danAccountRef.path}`);
} else {
  console.log(`trackedAccount OK: @${danAccountSnap.data().username}`);
}

const danUsername = (danAccountSnap.exists && danAccountSnap.data().username) || 'danharebin';

// Prefer trackedAccountId linkage, fall back to accountUsername
let danVideos = (await db.collection('organizations').doc(DAN_ORG)
  .collection('projects').doc(DAN_PROJECT)
  .collection('videos')
  .where('trackedAccountId', '==', DAN_ACCOUNT_ID)
  .get()).docs;
if (danVideos.length === 0) {
  danVideos = (await db.collection('organizations').doc(DAN_ORG)
    .collection('projects').doc(DAN_PROJECT)
    .collection('videos')
    .where('accountUsername', '==', danUsername)
    .get()).docs;
  console.log('(matched via accountUsername)');
} else {
  console.log('(matched via trackedAccountId)');
}

console.log(`\nDan has ${danVideos.length} videos.\n`);

const danVideoSummary = [];
for (const vDoc of danVideos) {
  const v = vDoc.data();
  const snapsSnap = await vDoc.ref.collection('snapshots').get();
  const numeric = NUMERIC_RE.test(v.videoId || '');
  const startsWithLetter = /^[A-Za-z]/.test(v.videoId || '');
  danVideoSummary.push({
    docId: vDoc.id,
    videoId: v.videoId,
    views: v.views,
    videoUrl: v.videoUrl || v.url,
    lastRefreshed: v.lastRefreshed?.toDate?.()?.toISOString?.() || '(never)',
    snapshotCount: snapsSnap.size,
    numeric,
    startsWithLetter,
  });
}

// Sort by uploadDate desc if available
danVideoSummary.sort((a, b) => (a.docId < b.docId ? 1 : -1));

console.log('videoId                       views       snapshots  lastRefreshed                 docId');
for (const s of danVideoSummary) {
  const mark = s.numeric ? '❌NUMERIC' : s.startsWithLetter ? '✅' : '?';
  console.log(
    `  ${mark} ${String(s.videoId).padEnd(28)} ${String(s.views ?? '-').padStart(9)}   ${String(s.snapshotCount).padStart(3)}       ${s.lastRefreshed.padEnd(28)} ${s.docId}`
  );
}

const anyNumeric = danVideoSummary.some((s) => s.numeric);
console.log(`\nDan has any numeric videoIds? ${anyNumeric ? '❌ YES' : '✅ NO — all shortcodes'}`);

// ────────────────────────────────────────────────────────────────
// PHASE C: end-to-end refresh match simulation via Apify
// ────────────────────────────────────────────────────────────────
console.log('\n\n=== PHASE C: live Apify match simulation ===\n');

// Pick Dan's DXFnHzLgQux if present, else first shortcode video.
const targetShortcode = 'DXFnHzLgQux';
let target = danVideoSummary.find((s) => s.videoId === targetShortcode);
if (!target) {
  target = danVideoSummary.find((s) => !s.numeric && s.videoId);
  if (target) {
    console.log(`(DXFnHzLgQux not in Dan's videos; using ${target.videoId} instead)`);
  }
}
if (!target) {
  console.log('❌ No usable Dan video to test.');
  process.exit(1);
}

const testUrl = target.videoUrl || `https://www.instagram.com/reel/${target.videoId}/`;
console.log(`Testing with: ${testUrl}`);
console.log(`DB videoId:   ${target.videoId}`);
console.log(`DB views:     ${target.views}`);

const APIFY_TOKEN = process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN;
if (!APIFY_TOKEN) {
  console.log('❌ APIFY_TOKEN missing from env.');
  process.exit(1);
}

const apifyUrl = `https://api.apify.com/v2/acts/hpix~ig-reels-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&format=json`;
const body = {
  post_urls: [testUrl],
  target: 'reels_only',
  reels_count: 1,
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

console.log('\nCalling Apify hpix~ig-reels-scraper (run-sync-get-dataset-items)...');
const t0 = Date.now();
let apifyResp;
try {
  apifyResp = await fetch(apifyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
} catch (e) {
  console.log('❌ Apify call errored:', e?.message || e);
  process.exit(1);
}
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`Apify responded in ${elapsed}s — HTTP ${apifyResp.status}`);
if (!apifyResp.ok) {
  const text = await apifyResp.text();
  console.log('Body preview:', text.slice(0, 500));
  process.exit(1);
}
const items = await apifyResp.json();
console.log(`Apify returned ${Array.isArray(items) ? items.length : 0} items.`);
if (!Array.isArray(items) || items.length === 0) {
  console.log('❌ Empty Apify result.');
  process.exit(1);
}

const item = items[0];
const apifyCode = item.code || item.shortCode || '';
const apifyNumericId = item.id;
const apifyPlay = item.play_count ?? item.view_count ?? null;

console.log(`\nApify item.code           = ${apifyCode}`);
console.log(`Apify item.id (numeric)   = ${apifyNumericId}`);
console.log(`Apify item.play_count     = ${apifyPlay}`);

const match = apifyCode === target.videoId;
console.log(`\nMATCH: apify.code === db.videoId ?  ${match ? '✅ YES' : '❌ NO'}`);

if (apifyPlay != null && typeof target.views === 'number') {
  const delta = apifyPlay - target.views;
  const pct = target.views > 0 ? ((delta / target.views) * 100).toFixed(1) : 'n/a';
  console.log(`Views delta (apify - db): ${delta}  (${pct}% of db value)`);
}

console.log('\n=== DONE ===\n');
process.exit(0);
