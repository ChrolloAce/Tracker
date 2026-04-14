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

const orgId = '00JnaavZp41PofxFf3cP';
const projectId = 'zUO7WgoL14Oy6UYlHX5z';

// Check all of @danharebin's videos: current views, lastRefreshed, and full snapshot list
const docs = [
  'n9zNfRpByae3vmqBVyJY',  // DXFnHzLgQux (expected ~9480)
  'uytOeY65XfYXmd0V1cvc',  // DW-KgAGjcuO
  'N5Zjd4uqaANNqrtfqYXC',  // DW9taTwgTsa
  'wCS5d00cho4z5dOUJ2mV',  // DW9PIdJjXk3
  'v3QpXxjPN1EWylNCBlgp',  // DW7EbELgcQL
];

console.log(`\n=== Post-migration refresh activity check ===\n`);
console.log(`Migration completed: approximately 2026-04-13 between 17:40-17:55 Central (UTC-6).\n`);

for (const docId of docs) {
  const vRef = db.collection('organizations').doc(orgId)
    .collection('projects').doc(projectId)
    .collection('videos').doc(docId);

  const v = (await vRef.get()).data();
  if (!v) {
    console.log(`${docId}: NOT FOUND`);
    continue;
  }
  console.log(`━━━ ${v.videoId} (${docId})`);
  console.log(`    views:         ${v.views}`);
  console.log(`    likes:         ${v.likes}`);
  console.log(`    lastRefreshed: ${v.lastRefreshed?.toDate?.()?.toISOString() || '(none)'}`);

  const allSnaps = await vRef.collection('snapshots').orderBy('capturedAt', 'desc').get();
  console.log(`    snapshot count: ${allSnaps.size}`);
  for (const s of allSnaps.docs) {
    const sd = s.data();
    const t = sd.capturedAt?.toDate?.()?.toISOString() || '?';
    console.log(`       ${t}  views=${sd.views}  likes=${sd.likes}  by=${sd.capturedBy}  initial=${!!sd.isInitialSnapshot}  videoId=${sd.videoId}`);
  }
  console.log('');
}

// Also check trackedAccount's lastRefreshed and refreshStatus
const accRef = db.collection('organizations').doc(orgId)
  .collection('projects').doc(projectId)
  .collection('trackedAccounts').doc('instagram_danharebin');
const acc = (await accRef.get()).data();
console.log(`\n━━━ trackedAccount @danharebin`);
console.log(`    lastRefreshed:  ${acc.lastRefreshed?.toDate?.()?.toISOString() || '(none)'}`);
console.log(`    refreshStatus:  ${acc.refreshStatus}`);
console.log(`    lastSynced:     ${acc.lastSynced?.toDate?.()?.toISOString() || '(none)'}`);

process.exit(0);
