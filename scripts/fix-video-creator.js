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
const videoId = 'dppe1VCTf0yllNQa0aaX';
const correctCreatorId = 'HbTL8786fIFrlfyjm0fh';

const videoRef = db.collection('organizations').doc(orgId)
  .collection('projects').doc(projectId)
  .collection('videos').doc(videoId);

const before = await videoRef.get();
console.log(`\nBEFORE: assignedCreatorId = ${before.data()?.assignedCreatorId || 'NOT SET'}`);

await videoRef.update({ assignedCreatorId: correctCreatorId });

const after = await videoRef.get();
console.log(`AFTER:  assignedCreatorId = ${after.data()?.assignedCreatorId}`);
console.log(`\n✅ Video ${videoId} now attributed to "Mau Baron Test" (${correctCreatorId})`);
process.exit(0);
