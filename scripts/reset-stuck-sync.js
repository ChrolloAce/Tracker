import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

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

console.log('\n🔧 Resetting stuck sync jobs and account status...\n');

// 1. Mark all running/pending jobs as failed
const jobs = await db.collection('syncQueue')
  .where('orgId', '==', orgId)
  .get();

let fixed = 0;
for (const doc of jobs.docs) {
  const j = doc.data();
  if (j.status === 'running' || j.status === 'pending') {
    await doc.ref.update({
      status: 'failed',
      completedAt: Timestamp.now(),
      error: 'Manually reset - stuck job'
    });
    console.log(`  ✅ Job ${doc.id} (@${j.accountUsername}) → failed`);
    fixed++;
  }
}
console.log(`  Fixed ${fixed} stuck jobs`);

// 2. Reset account syncStatus from 'syncing' to 'synced'
const accs = await db.collection('organizations').doc(orgId)
  .collection('projects').doc(projectId)
  .collection('trackedAccounts').get();

for (const doc of accs.docs) {
  const a = doc.data();
  if (a.syncStatus === 'syncing') {
    await doc.ref.update({
      syncStatus: 'synced',
      syncProgress: null
    });
    console.log(`  ✅ @${a.username} syncStatus → synced`);
  }
}

// 3. Delete ALL videos to test fresh
const videosSnap = await db.collection('organizations').doc(orgId)
  .collection('projects').doc(projectId)
  .collection('videos').get();

console.log(`\n🗑️  Deleting ${videosSnap.size} videos to test fresh...`);
const batch = db.batch();
let count = 0;
for (const doc of videosSnap.docs) {
  batch.delete(doc.ref);
  count++;
  if (count % 500 === 0) {
    await batch.commit();
    console.log(`  Deleted ${count}...`);
  }
}
if (count % 500 !== 0) {
  await batch.commit();
}
console.log(`  ✅ Deleted ${count} videos`);

// 4. Reset account totalVideos
for (const doc of accs.docs) {
  await doc.ref.update({ totalVideos: 0 });
}

// 5. Verify
const check = await db.collection('organizations').doc(orgId)
  .collection('projects').doc(projectId)
  .collection('videos').count().get();
console.log(`\n✅ Done! Videos remaining: ${check.data().count}`);
console.log('   You can now test adding accounts fresh.\n');

process.exit(0);
