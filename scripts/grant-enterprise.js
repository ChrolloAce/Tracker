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

const ORG_ID   = process.argv[2];
const NEW_PLAN = process.argv[3] || 'enterprise';
const GRANTED_BY = process.argv[4] || 'mauriciobaronvergara@gmail.com';

if (!ORG_ID) {
  console.error('Usage: node scripts/grant-enterprise.js <orgId> [planTier] [grantedBy]');
  process.exit(1);
}

const subRef = db.collection('organizations').doc(ORG_ID).collection('billing').doc('subscription');

console.log(`\n📄 BEFORE — organizations/${ORG_ID}/billing/subscription`);
const before = await subRef.get();
if (before.exists) {
  const d = before.data();
  console.log(`  planTier:              ${d.planTier}`);
  console.log(`  status:                ${d.status}`);
  console.log(`  stripeSubscriptionId:  ${d.stripeSubscriptionId || '(empty)'}`);
  console.log(`  currentPeriodEnd:      ${d.currentPeriodEnd?.toDate?.() || d.currentPeriodEnd}`);
  console.log(`  grantedBy:             ${d.grantedBy || '(unset)'}`);
} else {
  console.log('  (no doc exists — will be created)');
}

const now = new Date();
const expiresAt = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

// Merge-write: matches api/super-admin/grant-plan.ts exact shape
await subRef.set({
  planTier: NEW_PLAN,
  status: 'active',
  currentPeriodStart: Timestamp.fromDate(now),
  currentPeriodEnd: Timestamp.fromDate(expiresAt),
  updatedAt: Timestamp.fromDate(now),
  grantedBy: GRANTED_BY,
  grantedAt: Timestamp.fromDate(now),
}, { merge: true });

console.log(`\n✏️  Merge-write complete with planTier="${NEW_PLAN}"`);

console.log(`\n📄 AFTER — organizations/${ORG_ID}/billing/subscription`);
const after = await subRef.get();
const d = after.data();
console.log(`  planTier:              ${d.planTier}`);
console.log(`  status:                ${d.status}`);
console.log(`  stripeSubscriptionId:  ${d.stripeSubscriptionId || '(empty)'}`);
console.log(`  currentPeriodEnd:      ${d.currentPeriodEnd?.toDate?.() || d.currentPeriodEnd}`);
console.log(`  grantedBy:             ${d.grantedBy}`);
console.log(`  grantedAt:             ${d.grantedAt?.toDate?.() || d.grantedAt}`);

console.log(`\n🎉 ${ORG_ID} is now on "${NEW_PLAN}" plan.`);
process.exit(0);
