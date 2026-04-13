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

const [, , orgId, userId, newRole] = process.argv;
if (!orgId || !userId || !newRole) {
  console.error('Usage: node scripts/set-org-role.js <orgId> <userId> <newRole>');
  process.exit(1);
}

const VALID_ROLES = ['owner', 'admin', 'member', 'creator'];
if (!VALID_ROLES.includes(newRole)) {
  console.error(`Invalid role "${newRole}". Must be one of: ${VALID_ROLES.join(', ')}`);
  process.exit(1);
}

const memberRef = db.collection('organizations').doc(orgId).collection('members').doc(userId);
const before = await memberRef.get();

if (!before.exists) {
  console.error(`❌ Member doc not found: organizations/${orgId}/members/${userId}`);
  process.exit(1);
}

console.log(`\n📄 Before:`);
console.log(`   role:   ${before.data().role}`);
console.log(`   status: ${before.data().status}`);
console.log(`   email:  ${before.data().email}`);

await memberRef.update({ role: newRole });

const after = await memberRef.get();
console.log(`\n✅ After:`);
console.log(`   role:   ${after.data().role}`);
console.log(`   status: ${after.data().status}`);
console.log(`   email:  ${after.data().email}`);

console.log(`\n🎉 Role updated to "${newRole}" for user ${userId} in org ${orgId}`);
process.exit(0);
