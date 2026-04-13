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
const projectId = 'UtwLPXeMTkXxkqDxZ8gv';
const creatorId = 'o6EZpFewsXBgK9uLv7OA';

// 1. Videos assigned to this creator
console.log(`\n📹 Videos with assignedCreatorId = ${creatorId}:`);
const vSnap = await db.collection('organizations').doc(orgId)
  .collection('projects').doc(projectId).collection('videos').get();
let creatorVideos = 0;
for (const doc of vSnap.docs) {
  const d = doc.data();
  if (d.assignedCreatorId === creatorId) {
    creatorVideos++;
    console.log(`  ✅ ${doc.id}: @${d.uploaderHandle} | views=${d.views} | url=${(d.url || d.videoUrl || '').slice(0, 60)}`);
  }
}
if (creatorVideos === 0) console.log('  (none)');

// 2. Pending/running/failed jobs for this creator
console.log(`\n⏳ syncQueue jobs for creator ${creatorId}:`);
const jobsSnap = await db.collection('syncQueue')
  .where('assignedCreatorId', '==', creatorId).get();
if (jobsSnap.empty) {
  console.log('  (none)');
} else {
  for (const doc of jobsSnap.docs) {
    const j = doc.data();
    console.log(`  ${doc.id}: status=${j.status} | url=${j.videoUrl} | error=${j.error || 'none'} | created=${j.createdAt?.toDate?.()}`);
  }
}

// 3. Jobs from share token (addedBy starts with creatorShare:)
console.log(`\n🔗 syncQueue jobs from share token (544fcfbd...):`);
const tokenJobs = await db.collection('syncQueue')
  .where('sourceToken', '==', '544fcfbdd7e8d3c910f211d6e3135e65e249ff5eaa5ac656').get();
if (tokenJobs.empty) {
  console.log('  (none)');
} else {
  for (const doc of tokenJobs.docs) {
    const j = doc.data();
    console.log(`  ${doc.id}: status=${j.status} | url=${j.videoUrl} | creator=${j.assignedCreatorId} | error=${j.error || 'none'}`);
  }
}

// 4. Jobs added by admin for this creator (addedBy = Mauricio)
console.log(`\n👤 syncQueue jobs added by admin with this creator:`);
const adminJobs = await db.collection('syncQueue')
  .where('projectId', '==', projectId)
  .where('addedBy', '==', 'eGmqOSicPpfKvmxZBrHLr0iZKWQ2')
  .limit(10).get();
for (const doc of adminJobs.docs) {
  const j = doc.data();
  if (j.assignedCreatorId === creatorId) {
    console.log(`  ${doc.id}: status=${j.status} | url=${j.videoUrl} | error=${j.error || 'none'}`);
  }
}

// 5. Last 5 videos added to project (any creator)
console.log(`\n📹 Last 5 videos added to Prayer Lock Research:`);
const recentSnap = await db.collection('organizations').doc(orgId)
  .collection('projects').doc(projectId).collection('videos')
  .orderBy('dateAdded', 'desc').limit(5).get();
for (const doc of recentSnap.docs) {
  const d = doc.data();
  console.log(`  ${doc.id}: @${d.uploaderHandle} | creator=${d.assignedCreatorId || 'NONE'} | added=${d.dateAdded?.toDate?.()}`);
}

process.exit(0);
