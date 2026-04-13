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

const email = process.argv[2];
const orgId = process.argv[3];
if (!email || !orgId) {
  console.error('Usage: node scripts/inspect-creator.js <email> <orgId>');
  process.exit(1);
}

console.log(`\n🔍 Inspecting creator ${email} in org ${orgId}\n`);

// 1. Firebase Auth user record
console.log('🔐 Firebase Auth record:');
try {
  const authRec = await getAuth().getUserByEmail(email);
  console.log(`  uid:            ${authRec.uid}`);
  console.log(`  email:          ${authRec.email}`);
  console.log(`  emailVerified:  ${authRec.emailVerified}`);
  console.log(`  displayName:    ${authRec.displayName || '(none)'}`);
  console.log(`  createdAt:      ${authRec.metadata.creationTime}`);
  console.log(`  lastSignIn:     ${authRec.metadata.lastSignInTime}`);
  console.log(`  providers:      ${authRec.providerData.map(p => p.providerId).join(', ')}`);
  console.log(`  disabled:       ${authRec.disabled}`);

  // 2. users/{uid} doc
  console.log(`\n👤 users/${authRec.uid}:`);
  const userDoc = await db.collection('users').doc(authRec.uid).get();
  if (!userDoc.exists) {
    console.log('  ❌ NO DOC — this user has an Auth record but no Firestore user doc');
  } else {
    const d = userDoc.data();
    console.log(`  email:          ${d.email}`);
    console.log(`  emailVerified:  ${d.emailVerified}`);
    console.log(`  defaultOrgId:   ${d.defaultOrgId || '(not set)'}`);
    console.log(`  plan:           ${d.plan || '(not set)'}`);
    console.log(`  isAdmin:        ${d.isAdmin || false}`);
    console.log(`  createdAt:      ${d.createdAt?.toDate?.() || d.createdAt}`);
    console.log(`  lastLoginAt:    ${d.lastLoginAt?.toDate?.() || d.lastLoginAt}`);
  }

  // 3. member doc in the given org
  console.log(`\n👥 organizations/${orgId}/members/${authRec.uid}:`);
  const memberDoc = await db.collection('organizations').doc(orgId).collection('members').doc(authRec.uid).get();
  if (!memberDoc.exists) {
    console.log('  ❌ NO MEMBER DOC in this org');
  } else {
    const m = memberDoc.data();
    console.log(`  role:                ${m.role}`);
    console.log(`  status:              ${m.status}`);
    console.log(`  email:               ${m.email}`);
    console.log(`  displayName:         ${m.displayName}`);
    console.log(`  joinedAt:            ${m.joinedAt?.toDate?.() || m.joinedAt}`);
    console.log(`  invitedBy:           ${m.invitedBy}`);
    console.log(`  creatorProjectIds:   ${JSON.stringify(m.creatorProjectIds || null)}`);
    console.log(`  lastActiveProjectId: ${m.lastActiveProjectId || '(not set)'}`);
    console.log(`  permissions:         ${m.permissions ? 'custom set' : '(default for role)'}`);
  }

  // 4. If member has creatorProjectIds, verify each project exists and is not archived
  if (memberDoc.exists && memberDoc.data().creatorProjectIds?.length > 0) {
    console.log(`\n📁 Checking ${memberDoc.data().creatorProjectIds.length} assigned project(s):`);
    for (const pid of memberDoc.data().creatorProjectIds) {
      const projDoc = await db.collection('organizations').doc(orgId).collection('projects').doc(pid).get();
      if (!projDoc.exists) {
        console.log(`  ❌ ${pid} — NOT FOUND (deleted?)`);
      } else {
        const p = projDoc.data();
        console.log(`  ${p.isArchived ? '📦' : '✅'} ${pid} — "${p.name}" (archived: ${p.isArchived})`);
      }
      // Also check the creator profile in that project
      const creatorProfileDoc = await db.collection('organizations').doc(orgId).collection('projects').doc(pid).collection('creators').doc(authRec.uid).get();
      if (creatorProfileDoc.exists) {
        console.log(`       ↳ creator profile: exists`);
      } else {
        console.log(`       ↳ creator profile: ⚠️  MISSING`);
      }
    }
  } else if (memberDoc.exists) {
    console.log(`\n⚠️  No creatorProjectIds — creator has NO project assignment.`);
    console.log('     AuthContext.loadOrCreateProject will return empty string,');
    console.log('     which redirects to "/onboarding" — not the creator portal.');
  }

} catch (err) {
  console.error(`❌ Error:`, err.message);
}

process.exit(0);
