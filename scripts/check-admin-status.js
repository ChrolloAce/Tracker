import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

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
const email = 'mauricioelhobbit@gmail.com';

console.log(`\n🔍 Checking admin status for: ${email}\n`);

// Find user by email in Firebase Auth
try {
  const userRecord = await getAuth().getUserByEmail(email);
  console.log(`Firebase Auth UID: ${userRecord.uid}`);

  // Check user document
  const userDoc = await db.collection('users').doc(userRecord.uid).get();
  if (userDoc.exists) {
    const data = userDoc.data();
    console.log(`User doc exists: YES`);
    console.log(`  email: ${data.email}`);
    console.log(`  isAdmin: ${data.isAdmin}`);
    console.log(`  role: ${data.role}`);
    console.log(`  All fields:`, JSON.stringify(data, null, 2));
  } else {
    console.log(`User doc exists: NO`);
  }
} catch (e) {
  console.error('Error:', e.message);
}

process.exit(0);
