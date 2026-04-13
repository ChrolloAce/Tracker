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

const PROJECT_NAME = process.argv[2] || 'Rork Research';

async function main() {
  console.log(`🔍 Looking for project "${PROJECT_NAME}"...\n`);

  // Find the project across all organizations
  const orgsSnap = await db.collection('organizations').get();
  let found = null;

  for (const orgDoc of orgsSnap.docs) {
    const projectsSnap = await orgDoc.ref.collection('projects').get();
    for (const projDoc of projectsSnap.docs) {
      const data = projDoc.data();
      if (data.name === PROJECT_NAME) {
        found = { orgId: orgDoc.id, orgName: orgDoc.data().name, projectId: projDoc.id, projectName: data.name };
        break;
      }
    }
    if (found) break;
  }

  if (!found) {
    console.error(`❌ Project "${PROJECT_NAME}" not found in any organization.`);
    process.exit(1);
  }

  console.log(`✅ Found: "${found.projectName}" in org "${found.orgName}"`);
  console.log(`   Org ID:     ${found.orgId}`);
  console.log(`   Project ID: ${found.projectId}\n`);

  const projectRef = db.collection('organizations').doc(found.orgId).collection('projects').doc(found.projectId);

  // 1. Freeze the project
  console.log(`❄️  Freezing project...`);
  await projectRef.update({ isStale: true });
  console.log(`   ✅ Project frozen\n`);

  // 2. Freeze all accounts
  const accountsSnap = await projectRef.collection('trackedAccounts').get();
  console.log(`❄️  Freezing ${accountsSnap.size} account(s)...`);

  let accountBatch = db.batch();
  let accountCount = 0;
  for (const accDoc of accountsSnap.docs) {
    accountBatch.update(accDoc.ref, { isStale: true });
    accountCount++;
    // Firestore batch limit is 500
    if (accountCount % 500 === 0) {
      await accountBatch.commit();
      accountBatch = db.batch();
      console.log(`   ...committed ${accountCount} accounts`);
    }
  }
  if (accountCount % 500 !== 0) {
    await accountBatch.commit();
  }
  console.log(`   ✅ ${accountCount} account(s) frozen\n`);

  // 3. Freeze all videos
  const videosSnap = await projectRef.collection('videos').get();
  console.log(`❄️  Freezing ${videosSnap.size} video(s)...`);

  let videoBatch = db.batch();
  let videoCount = 0;
  for (const vidDoc of videosSnap.docs) {
    videoBatch.update(vidDoc.ref, { isStale: true });
    videoCount++;
    if (videoCount % 500 === 0) {
      await videoBatch.commit();
      videoBatch = db.batch();
      console.log(`   ...committed ${videoCount} videos`);
    }
  }
  if (videoCount % 500 !== 0) {
    await videoBatch.commit();
  }
  console.log(`   ✅ ${videoCount} video(s) frozen\n`);

  console.log(`🎉 Done! "${found.projectName}" is fully frozen.`);
  console.log(`   Project: frozen`);
  console.log(`   Accounts: ${accountCount} frozen`);
  console.log(`   Videos: ${videoCount} frozen`);
  console.log(`\n   Zero tokens will be burned on this project going forward.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
