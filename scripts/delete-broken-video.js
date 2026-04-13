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
const ref = db.collection('organizations').doc('00JnaavZp41PofxFf3cP')
  .collection('projects').doc('UtwLPXeMTkXxkqDxZ8gv')
  .collection('videos').doc('MyosXxSguuCFfhzInWKt');

await ref.delete();
console.log('✅ Deleted broken video MyosXxSguuCFfhzInWKt (@undefined, url=https://www.tiktok.com/)');

// Also clean up the failed job
await db.collection('syncQueue').doc('MtxTAyGrsejXQKfXyDQe').delete();
console.log('✅ Deleted failed syncQueue job MtxTAyGrsejXQKfXyDQe');

process.exit(0);
