// Migrate Instagram videos that were stored with numeric IDs (e.g. 3874675114226289585)
// to use the shortcode (e.g. DXFnHzLgQux) extracted from the stored URL.
//
// Background: api/process-single-video.ts used to prefer rawData.id (numeric) over
// rawData.code (shortcode) when saving manually-added Instagram videos. Every
// downstream refresh path matches videos by shortcode, so numeric-ID videos silently
// never got their views updated. This script backfills them.
//
// Run with DRY=1 to preview, DRY=0 (or unset + --apply flag) to write.

import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

const APPLY = process.argv.includes('--apply');
const MODE = APPLY ? 'APPLY (will write changes)' : 'DRY-RUN (read-only; pass --apply to commit)';

const NUMERIC_ID_RE = /^\d+(_\d+)?$/;
const SHORTCODE_FROM_URL_RE = /\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/;

console.log(`\n=== Instagram numeric-ID migration — ${MODE} ===\n`);

const orgsSnap = await db.collection('organizations').get();
console.log(`Scanning ${orgsSnap.size} organizations…\n`);

let totalVideos = 0;
let fixableVideos = 0;
let unfixableVideos = 0;
const unfixable = []; // videos with numeric ID but no recoverable shortcode
const plan = []; // { orgId, orgName, projectId, projectName, videoDocRef, fromId, toId, url, snapshotsToPatch }

for (const orgDoc of orgsSnap.docs) {
  const orgId = orgDoc.id;
  const orgName = orgDoc.data().name || '(unnamed)';
  const projsSnap = await db.collection('organizations').doc(orgId).collection('projects').get();

  for (const projDoc of projsSnap.docs) {
    const projectId = projDoc.id;
    const projectName = projDoc.data().name || '(unnamed)';

    const vidsSnap = await db.collection('organizations').doc(orgId)
      .collection('projects').doc(projectId)
      .collection('videos')
      .where('platform', '==', 'instagram')
      .get();

    totalVideos += vidsSnap.size;

    for (const vDoc of vidsSnap.docs) {
      const v = vDoc.data();
      const storedId = v.videoId || '';
      if (!NUMERIC_ID_RE.test(storedId)) continue; // already a shortcode — skip

      const url = v.videoUrl || v.url || '';
      const match = url.match(SHORTCODE_FROM_URL_RE);
      if (!match || !match[1]) {
        unfixable.push({ orgName, projectName, docPath: vDoc.ref.path, videoId: storedId, url });
        unfixableVideos++;
        continue;
      }

      const shortcode = match[1];

      // Don't attempt to fix if a video with the shortcode already exists in this project
      // (would create a duplicate match). Query to verify.
      const clashSnap = await db.collection('organizations').doc(orgId)
        .collection('projects').doc(projectId)
        .collection('videos')
        .where('videoId', '==', shortcode)
        .limit(1)
        .get();
      if (!clashSnap.empty) {
        unfixable.push({
          orgName, projectName, docPath: vDoc.ref.path, videoId: storedId, url,
          reason: `shortcode ${shortcode} already exists as another video in this project (${clashSnap.docs[0].ref.path}) — would cause duplicate match`
        });
        unfixableVideos++;
        continue;
      }

      // Check how many snapshots use the numeric videoId — they'll be patched too.
      const snapsSnap = await vDoc.ref.collection('snapshots')
        .where('videoId', '==', storedId)
        .get();

      plan.push({
        orgName, projectName,
        docPath: vDoc.ref.path,
        videoRef: vDoc.ref,
        fromId: storedId,
        toId: shortcode,
        url,
        snapshotsToPatch: snapsSnap.docs.map(s => s.ref)
      });
      fixableVideos++;
    }
  }
}

console.log(`Total Instagram videos scanned: ${totalVideos}`);
console.log(`Fixable (numeric → shortcode):  ${fixableVideos}`);
console.log(`Unfixable (flagged):            ${unfixableVideos}`);
console.log('');

if (unfixable.length > 0) {
  console.log('⚠️  Unfixable videos (will be skipped):');
  for (const u of unfixable) {
    console.log(`  - ${u.docPath}`);
    console.log(`      videoId=${u.videoId}  url=${u.url}`);
    if (u.reason) console.log(`      reason: ${u.reason}`);
  }
  console.log('');
}

if (plan.length === 0) {
  console.log('Nothing to do.\n');
  process.exit(0);
}

console.log('Planned rewrites:');
for (const p of plan) {
  console.log(`  ${p.orgName} / ${p.projectName}`);
  console.log(`    ${p.docPath}`);
  console.log(`    videoId:  ${p.fromId}  →  ${p.toId}`);
  console.log(`    url:      ${p.url}`);
  console.log(`    snapshots to patch: ${p.snapshotsToPatch.length}`);
}
console.log('');

if (!APPLY) {
  console.log('DRY-RUN only — re-run with `--apply` to execute.\n');
  process.exit(0);
}

console.log('Applying changes…\n');
let ok = 0, fail = 0;
for (const p of plan) {
  try {
    // Single batched write per video to keep doc + snapshots consistent
    const batch = db.batch();
    batch.update(p.videoRef, { videoId: p.toId });
    for (const snapRef of p.snapshotsToPatch) {
      batch.update(snapRef, { videoId: p.toId });
    }
    await batch.commit();
    console.log(`  ✓ ${p.docPath}  →  ${p.toId}  (snapshots patched: ${p.snapshotsToPatch.length})`);
    ok++;
  } catch (e) {
    console.error(`  ✗ ${p.docPath}:  ${e.message}`);
    fail++;
  }
}

console.log(`\nDone. ok=${ok} fail=${fail}\n`);
process.exit(fail > 0 ? 1 : 0);
