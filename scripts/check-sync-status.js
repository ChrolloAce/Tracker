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
const orgId = 'KEiVWV2FH2HEjRcxSqFO';
const projectId = 'XDinhXuqd4GkCluxM4Un';

// Check recent syncQueue jobs (without compound index)
console.log('\n=== RECENT SYNC QUEUE JOBS ===\n');
const jobs = await db.collection('syncQueue')
  .where('orgId', '==', orgId)
  .limit(10)
  .get();

for (const doc of jobs.docs) {
  const j = doc.data();
  console.log(`Job: ${doc.id}`);
  console.log(`  type: ${j.type} | status: ${j.status} | attempts: ${j.attempts}`);
  console.log(`  account: @${j.accountUsername} (${j.accountPlatform})`);
  console.log(`  maxVideos: ${j.maxVideos}`);
  console.log(`  created: ${j.createdAt?.toDate()}`);
  console.log(`  started: ${j.startedAt?.toDate() || 'NOT STARTED'}`);
  console.log(`  completed: ${j.completedAt?.toDate() || 'NOT COMPLETED'}`);
  console.log(`  error: ${j.error || 'none'}`);
  console.log('');
}

console.log('=== TRACKED ACCOUNTS ===\n');
const accs = await db.collection('organizations').doc(orgId)
  .collection('projects').doc(projectId)
  .collection('trackedAccounts').get();

for (const doc of accs.docs) {
  const a = doc.data();
  console.log(`@${a.username} (${a.platform})`);
  console.log(`  syncStatus: ${a.syncStatus}`);
  console.log(`  syncError: ${a.syncError || 'none'}`);
  console.log(`  totalVideos: ${a.totalVideos}`);
  console.log(`  maxVideos: ${a.maxVideos}`);
  console.log(`  creatorType: ${a.creatorType || 'not set'}`);
  console.log(`  lastRefreshed: ${a.lastRefreshed?.toDate() || 'never'}`);
  console.log(`  lastSynced: ${a.lastSynced?.toDate() || 'never'}`);
  console.log(`  syncProgress: ${JSON.stringify(a.syncProgress || {})}`);
  console.log('');
}

console.log('=== VIDEO COUNT ===\n');
const vids = await db.collection('organizations').doc(orgId)
  .collection('projects').doc(projectId)
  .collection('videos').count().get();
console.log(`Total videos in Firestore: ${vids.data().count}`);

console.log('');
process.exit(0);
