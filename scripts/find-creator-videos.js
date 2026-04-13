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
const projectId = 'UtwLPXeMTkXxkqDxZ8gv'; // Prayer Lock Research
const creatorId = 'HbTL8786fIFrlfyjm0fh'; // Mau Baron Test

console.log(`\n🔍 Looking for videos assigned to creator ${creatorId} in project ${projectId}\n`);

// 1. Check videos with assignedCreatorId
const videosSnap = await db.collection('organizations').doc(orgId)
  .collection('projects').doc(projectId)
  .collection('videos').get();

console.log(`Total videos in project: ${videosSnap.size}\n`);

let found = 0;
for (const doc of videosSnap.docs) {
  const d = doc.data();
  if (d.assignedCreatorId === creatorId) {
    found++;
    console.log(`✅ Video ${doc.id}:`);
    console.log(`   url:                ${d.url || d.videoUrl || '(none)'}`);
    console.log(`   uploaderHandle:     ${d.uploaderHandle || '(none)'}`);
    console.log(`   assignedCreatorId:  ${d.assignedCreatorId}`);
    console.log(`   addedBy:            ${d.addedBy}`);
    console.log(`   views:              ${d.views || 0}`);
    console.log(`   dateAdded:          ${d.dateAdded?.toDate?.() || '(none)'}`);
    console.log('');
  }
}

if (found === 0) {
  console.log('❌ No videos found with assignedCreatorId matching this creator.\n');

  // Check if any pending jobs exist for this creator
  console.log('Checking syncQueue for pending jobs...');
  const jobsSnap = await db.collection('syncQueue')
    .where('assignedCreatorId', '==', creatorId)
    .limit(10)
    .get();

  if (jobsSnap.empty) {
    console.log('  No pending/completed jobs found for this creator.');
  } else {
    for (const job of jobsSnap.docs) {
      const j = job.data();
      console.log(`  Job ${job.id}: status=${j.status}, videoUrl=${j.videoUrl}, addedBy=${j.addedBy}, created=${j.createdAt?.toDate?.()}`);
    }
  }

  // Also check if videos exist but with addedBy matching admin instead
  console.log('\nChecking for videos added by admin (addedBy = Mauricio uid)...');
  let adminVideos = 0;
  for (const doc of videosSnap.docs) {
    const d = doc.data();
    if (d.addedBy === 'eGmqOSicPpfKvmxZBrHLr0iZKWQ2') {
      adminVideos++;
      console.log(`  Video ${doc.id}: url=${d.url || d.videoUrl}, assignedCreatorId=${d.assignedCreatorId || 'NOT SET'}, uploaderHandle=${d.uploaderHandle}`);
    }
  }
  if (adminVideos === 0) {
    console.log('  None found.');
  }
} else {
  console.log(`\nTotal: ${found} video(s) assigned to this creator`);
}

process.exit(0);
