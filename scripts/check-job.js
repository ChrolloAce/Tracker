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

// Check the specific job from my test
const jobId = process.argv[2] || 'CnIIuEVDmWmrQzL9PfBy';
console.log(`\n🔍 Checking syncQueue job: ${jobId}\n`);

const jobDoc = await db.collection('syncQueue').doc(jobId).get();
if (!jobDoc.exists) {
  console.log('❌ Job doc not found — may have been cleaned up after completion.');
} else {
  const j = jobDoc.data();
  console.log(`status:             ${j.status}`);
  console.log(`videoUrl:           ${j.videoUrl}`);
  console.log(`orgId:              ${j.orgId}`);
  console.log(`projectId:          ${j.projectId}`);
  console.log(`assignedCreatorId:  ${j.assignedCreatorId || 'NOT SET'}`);
  console.log(`addedBy:            ${j.addedBy}`);
  console.log(`error:              ${j.error || '(none)'}`);
  console.log(`createdAt:          ${j.createdAt?.toDate?.()}`);
  console.log(`completedAt:        ${j.completedAt?.toDate?.() || '(not completed)'}`);
}

// Also check: did the video land somewhere? Look for the resolved TikTok URL
const orgId = '00JnaavZp41PofxFf3cP';
const projectId = 'UtwLPXeMTkXxkqDxZ8gv';
console.log('\n🔍 Searching ALL videos in Prayer Lock Research for the TikTok URL...');
const videosSnap = await db.collection('organizations').doc(orgId)
  .collection('projects').doc(projectId).collection('videos')
  .orderBy('dateAdded', 'desc').limit(5).get();

console.log(`\nLast 5 videos added:`);
for (const doc of videosSnap.docs) {
  const d = doc.data();
  console.log(`  ${doc.id}: ${d.uploaderHandle || '?'} | assignedCreator=${d.assignedCreatorId || 'NONE'} | ${d.dateAdded?.toDate?.()}`);
}

process.exit(0);
