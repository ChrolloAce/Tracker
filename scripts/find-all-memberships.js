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
const targetEmail = process.argv[2];
if (!targetEmail) {
  console.error('Usage: node scripts/find-all-memberships.js <email>');
  process.exit(1);
}

console.log(`\n🔍 Scanning all orgs for memberships of: ${targetEmail}\n`);

const orgsSnapshot = await db.collection('organizations').get();
const matches = [];

for (const orgDoc of orgsSnapshot.docs) {
  const membersSnapshot = await db.collection('organizations').doc(orgDoc.id)
    .collection('members').get();

  for (const memberDoc of membersSnapshot.docs) {
    const member = memberDoc.data();
    if (member.email?.toLowerCase() === targetEmail.toLowerCase()) {
      matches.push({
        orgId: orgDoc.id,
        orgName: orgDoc.data().name,
        memberDocId: memberDoc.id,
        role: member.role,
        status: member.status,
        userId: member.userId,
      });
    }
  }
}

if (matches.length === 0) {
  console.log('❌ No memberships found.');
} else {
  console.log(`✅ Found ${matches.length} membership(s):\n`);
  for (const m of matches) {
    console.log(`  Org: ${m.orgName} (${m.orgId})`);
    console.log(`    memberDocId: ${m.memberDocId}`);
    console.log(`    userId:      ${m.userId}`);
    console.log(`    role:        ${m.role}`);
    console.log(`    status:      ${m.status}`);
    console.log('');
  }
}

process.exit(0);
