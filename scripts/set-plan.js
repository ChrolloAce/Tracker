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
const orgId = 'GV3J3N13Icg56H8FYy14';
const plan = process.argv[2] || 'basic';
const videoCount = parseInt(process.argv[3] || '0');

await db.collection('organizations').doc(orgId)
  .collection('billing').doc('subscription').update({
    planTier: plan,
    'usage.videos': videoCount,
    updatedAt: Timestamp.now()
  });

console.log(`Set plan to "${plan}" with usage.videos = ${videoCount}`);
process.exit(0);
