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
const orgId = 'GV3J3N13Icg56H8FYy14';
const projectId = 'gJPkSZ7jJj0SRV6ZVdHd';

console.log('\n=== Your Test Org Status ===\n');

// Check subscription
const subDoc = await db.collection('organizations').doc(orgId)
  .collection('billing').doc('subscription').get();
const sub = subDoc.data();
console.log(`Plan: ${sub?.planTier} | Usage videos: ${sub?.usage?.videos ?? 'not set'}`);

// Check accounts
const accountsSnap = await db.collection('organizations').doc(orgId)
  .collection('projects').doc(projectId)
  .collection('trackedAccounts').get();

console.log(`\nAccounts (${accountsSnap.size}):`);
const now = Date.now();
for (const doc of accountsSnap.docs) {
  const a = doc.data();
  const lr = a.lastRefreshed?.toDate();
  const hrs = lr ? ((now - lr.getTime()) / 3600000).toFixed(1) : null;
  console.log(`  @${a.username} (${a.platform})`);
  console.log(`    Status: ${a.syncStatus} | Videos: ${a.totalVideos || 0} | maxVideos: ${a.maxVideos || '?'}`);
  console.log(`    Last refreshed: ${hrs ? hrs + 'h ago' : 'Never'}`);
}

// Count actual videos
const videosSnap = await db.collection('organizations').doc(orgId)
  .collection('projects').doc(projectId)
  .collection('videos').get();

console.log(`\nTotal videos in database: ${videosSnap.size}`);
console.log('');

process.exit(0);
