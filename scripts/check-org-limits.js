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

const PLAN_LIMITS = { free: 5, basic: 150, pro: 1000, ultra: 5000, enterprise: -1 };

const orgIds = process.argv.slice(2);
if (orgIds.length === 0) {
  console.error('Usage: node scripts/check-org-limits.js <orgId> [orgId2...]');
  process.exit(1);
}

for (const orgId of orgIds) {
  console.log(`\n🔍 Org: ${orgId}`);

  const orgDoc = await db.collection('organizations').doc(orgId).get();
  if (!orgDoc.exists) {
    console.log('  ❌ org not found');
    continue;
  }
  console.log(`  Name: ${orgDoc.data().name}`);

  const subDoc = await db.collection('organizations').doc(orgId).collection('billing').doc('subscription').get();
  const planTier = subDoc.data()?.planTier || 'free';
  const limit = PLAN_LIMITS[planTier] ?? 5;
  console.log(`  Plan: ${planTier}  (limit: ${limit === -1 ? 'unlimited' : limit})`);
  console.log(`  Subscription status: ${subDoc.data()?.status || 'NO DOC'}`);

  const projectsSnap = await db.collection('organizations').doc(orgId).collection('projects').get();
  let totalVideos = 0;
  for (const proj of projectsSnap.docs) {
    const countSnap = await proj.ref.collection('videos').count().get();
    const c = countSnap.data().count;
    totalVideos += c;
    console.log(`    📁 ${proj.data().name} (${proj.id}): ${c} videos`);
  }
  console.log(`  TOTAL videos: ${totalVideos}`);
  console.log(`  Over limit? ${limit !== -1 && totalVideos >= limit ? '⚠️  YES — WILL 403' : '✅ no'}`);
}

// Also check the user doc for defaultOrgId so we know which org the session will land on
const userEmail = 'maubaron.ai@gmail.com';
const usersSnap = await db.collection('users').where('email', '==', userEmail).get();
for (const u of usersSnap.docs) {
  console.log(`\n👤 users/${u.id}`);
  console.log(`  email:        ${u.data().email}`);
  console.log(`  defaultOrgId: ${u.data().defaultOrgId || 'NOT SET'}`);
  console.log(`  plan:         ${u.data().plan || 'NOT SET'}`);
  console.log(`  isAdmin:      ${u.data().isAdmin || false}`);
}

process.exit(0);
