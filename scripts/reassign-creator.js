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

const [, , orgId, userId, newProjectId] = process.argv;
if (!orgId || !userId || !newProjectId) {
  console.error('Usage: node scripts/reassign-creator.js <orgId> <userId> <newProjectId>');
  process.exit(1);
}

const memberRef = db.collection('organizations').doc(orgId).collection('members').doc(userId);
const projectRef = db.collection('organizations').doc(orgId).collection('projects').doc(newProjectId);
const creatorProfileRef = projectRef.collection('creators').doc(userId);

// 1. Verify target project exists
const projectDoc = await projectRef.get();
if (!projectDoc.exists) {
  console.error(`❌ Target project ${newProjectId} does not exist`);
  process.exit(1);
}
const projectData = projectDoc.data();
console.log(`✅ Target project: "${projectData.name}" (${newProjectId})`);
if (projectData.isArchived) {
  console.error(`❌ Target project is archived — refusing to assign`);
  process.exit(1);
}

// 2. Snapshot current member doc
const memberSnap = await memberRef.get();
if (!memberSnap.exists) {
  console.error(`❌ Member doc not found`);
  process.exit(1);
}
const memberData = memberSnap.data();
console.log(`\n📄 Member BEFORE:`);
console.log(`   role:                ${memberData.role}`);
console.log(`   status:              ${memberData.status}`);
console.log(`   email:               ${memberData.email}`);
console.log(`   displayName:         ${memberData.displayName}`);
console.log(`   creatorProjectIds:   ${JSON.stringify(memberData.creatorProjectIds || null)}`);
console.log(`   lastActiveProjectId: ${memberData.lastActiveProjectId}`);

// 3. Update member doc
await memberRef.update({
  creatorProjectIds: [newProjectId],
  lastActiveProjectId: newProjectId,
});
console.log(`\n✏️  Member doc updated`);

// 4. Create creator profile in new project (if doesn't exist)
const existingProfile = await creatorProfileRef.get();
if (existingProfile.exists) {
  console.log(`\nℹ️  Creator profile already exists in target project — leaving untouched`);
} else {
  await creatorProfileRef.set({
    orgId,
    projectId: newProjectId,
    displayName: memberData.displayName || memberData.email?.split('@')[0] || 'Creator',
    email: memberData.email,
    linkedAccountsCount: 0,
    totalEarnings: 0,
    payoutsEnabled: true,
    createdAt: Timestamp.now(),
  });
  console.log(`\n✏️  Creator profile CREATED at organizations/${orgId}/projects/${newProjectId}/creators/${userId}`);
}

// 5. Verify member doc after
const afterSnap = await memberRef.get();
const afterData = afterSnap.data();
console.log(`\n📄 Member AFTER:`);
console.log(`   creatorProjectIds:   ${JSON.stringify(afterData.creatorProjectIds)}`);
console.log(`   lastActiveProjectId: ${afterData.lastActiveProjectId}`);

console.log(`\n🎉 ${userId} reassigned to project "${projectData.name}"`);
process.exit(0);
