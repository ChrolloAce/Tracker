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

const snap = await db.collection('organizations').doc('jjW31DAhwCNIbMB9PUJg')
  .collection('projects').doc('cB09Syy58UBksAMBnkMG')
  .collection('trackedAccounts').where('isActive', '==', true).get();

console.log(`\nCuffed Dating — 29 active accounts, basic plan (24h interval)\n`);

const now = Date.now();
let queueCount = 0;
let skipCount = 0;

for (const doc of snap.docs) {
  const d = doc.data();
  const lr = d.lastRefreshed?.toDate();
  const hrs = lr ? ((now - lr.getTime()) / 3600000).toFixed(1) : null;

  if (!hrs || parseFloat(hrs) >= 24) {
    queueCount++;
    const reason = !hrs ? 'never synced' : `${hrs}h since last sync (>= 24h)`;
    console.log(`  QUEUE  @${d.username} (${d.platform}) — ${reason}`);
  } else {
    skipCount++;
    console.log(`  skip   @${d.username} (${d.platform}) — ${hrs}h ago (< 24h)`);
  }
}

console.log(`\nResult: ${queueCount} queued, ${skipCount} skipped\n`);
process.exit(0);
