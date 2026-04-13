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
const targetEmail = (process.argv[2] || '').toLowerCase();
if (!targetEmail) {
  console.error('Usage: node scripts/check-invitation.js <email>');
  process.exit(1);
}

console.log(`\n🔍 Looking up invitations for: ${targetEmail}\n`);

// 1. Check invitationsLookup (public) collection
console.log('📂 invitationsLookup collection:');
const lookupSnap = await db.collection('invitationsLookup').get();
let lookupHits = 0;
for (const doc of lookupSnap.docs) {
  const d = doc.data();
  if (d.email?.toLowerCase() === targetEmail) {
    lookupHits++;
    console.log(`  ✅ ${doc.id}`);
    console.log(`     orgId:        ${d.orgId}`);
    console.log(`     orgName:      ${d.organizationName}`);
    console.log(`     role:         ${d.role}`);
    console.log(`     status:       ${d.status}`);
    console.log(`     projectId:    ${d.projectId || 'NOT SET'}`);
    console.log(`     invitedBy:    ${d.invitedByName} <${d.invitedByEmail}>`);
    console.log(`     createdAt:    ${d.createdAt?.toDate?.() || d.createdAt}`);
    console.log(`     expiresAt:    ${d.expiresAt?.toDate?.() || d.expiresAt}`);
    console.log(`     creatorWorkflow: ${d.creatorWorkflow || 'N/A'}`);
    console.log('');
  }
}
if (lookupHits === 0) {
  console.log('  (none)\n');
}

// 2. Scan each org's invitations subcollection
console.log('📂 per-org invitations subcollection:');
const orgsSnap = await db.collection('organizations').get();
let orgHits = 0;
for (const orgDoc of orgsSnap.docs) {
  const invitesSnap = await db.collection('organizations').doc(orgDoc.id)
    .collection('invitations').get();
  for (const invDoc of invitesSnap.docs) {
    const d = invDoc.data();
    if (d.email?.toLowerCase() === targetEmail) {
      orgHits++;
      console.log(`  ✅ organizations/${orgDoc.id}/invitations/${invDoc.id}`);
      console.log(`     orgName:   ${orgDoc.data().name}`);
      console.log(`     role:      ${d.role}`);
      console.log(`     status:    ${d.status}`);
      console.log(`     projectId: ${d.projectId || 'NOT SET'}`);
      console.log(`     createdAt: ${d.createdAt?.toDate?.() || d.createdAt}`);
      console.log(`     expiresAt: ${d.expiresAt?.toDate?.() || d.expiresAt}`);
      console.log('');
    }
  }
}
if (orgHits === 0) {
  console.log('  (none)\n');
}

// 3. Check if they already became a member (in case invite was accepted + deleted)
console.log('📂 existing memberships:');
let memberHits = 0;
for (const orgDoc of orgsSnap.docs) {
  const membersSnap = await db.collection('organizations').doc(orgDoc.id)
    .collection('members').get();
  for (const memDoc of membersSnap.docs) {
    const d = memDoc.data();
    if (d.email?.toLowerCase() === targetEmail) {
      memberHits++;
      console.log(`  ✅ organizations/${orgDoc.id}/members/${memDoc.id}`);
      console.log(`     orgName: ${orgDoc.data().name}`);
      console.log(`     role:    ${d.role}`);
      console.log(`     status:  ${d.status}`);
      console.log(`     joinedAt:${d.joinedAt?.toDate?.() || d.joinedAt}`);
      console.log('');
    }
  }
}
if (memberHits === 0) {
  console.log('  (none)\n');
}

console.log(`\n📊 Summary: ${lookupHits} lookup doc(s), ${orgHits} org invitation(s), ${memberHits} existing membership(s)`);
process.exit(0);
