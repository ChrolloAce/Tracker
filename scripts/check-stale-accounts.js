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

// Get the stale instagram account
const snap = await db.collection('organizations').doc('jjW31DAhwCNIbMB9PUJg')
  .collection('projects').doc('cB09Syy58UBksAMBnkMG')
  .collection('trackedAccounts').where('isActive', '==', true).get();

console.log('\n=== Stale accounts (synced >24h ago) ===\n');

const now = Date.now();

for (const doc of snap.docs) {
  const d = doc.data();
  const lr = d.lastRefreshed?.toDate();
  const hrs = lr ? (now - lr.getTime()) / 3600000 : null;

  if (!hrs || hrs >= 24) {
    console.log(`@${d.username} (${d.platform})`);
    console.log(`  Doc ID:          ${doc.id}`);
    console.log(`  isActive:        ${d.isActive}`);
    console.log(`  syncStatus:      ${d.syncStatus || 'none'}`);
    console.log(`  lastRefreshed:   ${lr ? lr.toISOString() : 'NULL'}`);
    console.log(`  lastSynced:      ${d.lastSynced?.toDate()?.toISOString() || 'NULL'}`);
    console.log(`  dateAdded:       ${d.dateAdded?.toDate()?.toISOString() || 'NULL'}`);
    console.log(`  creatorType:     ${d.creatorType || 'automatic'}`);
    console.log(`  totalVideos:     ${d.totalVideos || 0}`);
    console.log(`  syncLockId:      ${d.syncLockId || 'none'}`);
    console.log(`  syncLockTimestamp: ${d.syncLockTimestamp?.toDate()?.toISOString() || 'none'}`);

    // Check if there are any recent failed jobs for this account
    const recentJobs = await db.collection('syncQueue')
      .where('accountId', '==', doc.id)
      .orderBy('createdAt', 'desc')
      .limit(3)
      .get();

    if (recentJobs.empty) {
      console.log(`  Recent jobs:     NONE (never queued?)`);
    } else {
      console.log(`  Recent jobs:`);
      for (const job of recentJobs.docs) {
        const j = job.data();
        console.log(`    - ${j.status} | created: ${j.createdAt?.toDate()?.toISOString()} | error: ${j.error || 'none'}`);
      }
    }
    console.log('');
  }
}

process.exit(0);
