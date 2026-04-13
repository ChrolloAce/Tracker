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

// Get last 10 jobs from syncQueue ordered by creation
const snap = await db.collection('syncQueue').orderBy('createdAt', 'desc').limit(10).get();

console.log(`\n🔍 Last 10 syncQueue jobs:\n`);
for (const doc of snap.docs) {
  const d = doc.data();
  console.log(`${doc.id}:`);
  console.log(`  status:      ${d.status}`);
  console.log(`  videoUrl:    ${d.videoUrl}`);
  console.log(`  projectId:   ${d.projectId}`);
  console.log(`  addedBy:     ${d.addedBy}`);
  console.log(`  creator:     ${d.assignedCreatorId || 'NONE'}`);
  console.log(`  created:     ${d.createdAt?.toDate?.()}`);
  console.log(`  error:       ${d.error || '(none)'}`);
  console.log('');
}

// Also check latest videos added to Prayer Lock Research
const orgId = '00JnaavZp41PofxFf3cP';
const projectId = 'UtwLPXeMTkXxkqDxZ8gv';
const vSnap = await db.collection('organizations').doc(orgId)
  .collection('projects').doc(projectId).collection('videos')
  .orderBy('dateAdded', 'desc').limit(3).get();

console.log(`\n📹 Latest 3 videos in Prayer Lock Research:`);
for (const doc of vSnap.docs) {
  const d = doc.data();
  console.log(`  ${doc.id}: @${d.uploaderHandle} | creator=${d.assignedCreatorId || 'NONE'} | added ${d.dateAdded?.toDate?.()}`);
}

process.exit(0);
