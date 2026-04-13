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
const orgId = '00JnaavZp41PofxFf3cP';
const searchName = (process.argv[2] || 'mau baron test').toLowerCase();

console.log(`\n🔍 Searching for creator "${searchName}" in Maktub...\n`);

const membersSnap = await db.collection('organizations').doc(orgId).collection('members').get();
let found = false;

for (const doc of membersSnap.docs) {
  const d = doc.data();
  if (d.displayName && d.displayName.toLowerCase().includes(searchName)) {
    found = true;
    console.log('=== MEMBER DOC ===');
    console.log(`  docId:              ${doc.id}`);
    console.log(`  userId:             ${d.userId}`);
    console.log(`  displayName:        ${d.displayName}`);
    console.log(`  role:               ${d.role}`);
    console.log(`  status:             ${d.status}`);
    console.log(`  creatorProjectIds:  ${JSON.stringify(d.creatorProjectIds)}`);

    if (d.creatorProjectIds) {
      for (const pid of d.creatorProjectIds) {
        const projDoc = await db.collection('organizations').doc(orgId).collection('projects').doc(pid).get();
        console.log(`\n  📁 Project: ${projDoc.exists ? projDoc.data().name : 'NOT FOUND'} (${pid})`);

        const creatorDoc = await db.collection('organizations').doc(orgId)
          .collection('projects').doc(pid).collection('creators').doc(doc.id).get();
        if (creatorDoc.exists) {
          const cd = creatorDoc.data();
          console.log(`    creator profile:       EXISTS`);
          console.log(`    externalShareToken:    ${cd.externalShareToken || '(not set)'}`);
          console.log(`    isExternal:            ${cd.isExternal}`);
          console.log(`    linkedAccountsCount:   ${cd.linkedAccountsCount}`);
          console.log(`    acceptSubmissions:     check token doc`);

          // Check share link doc
          if (cd.externalShareToken) {
            const shareDoc = await db.collection('creatorShareLinks').doc(cd.externalShareToken).get();
            if (shareDoc.exists) {
              const sd = shareDoc.data();
              console.log(`\n    🔗 Share Link (${cd.externalShareToken.slice(0,12)}...):`);
              console.log(`      revoked:            ${sd.revoked}`);
              console.log(`      acceptSubmissions:   ${sd.acceptSubmissions}`);
              console.log(`      submitCount:         ${sd.submitCount}`);
            } else {
              console.log(`    🔗 Share link doc NOT FOUND`);
            }
          }

          // Check linked accounts
          const linksSnap = await db.collection('organizations').doc(orgId)
            .collection('projects').doc(pid).collection('creatorLinks')
            .where('creatorId', '==', doc.id).get();
          console.log(`\n    Linked accounts: ${linksSnap.size}`);
          for (const link of linksSnap.docs) {
            const ld = link.data();
            const accDoc = await db.collection('organizations').doc(orgId)
              .collection('projects').doc(pid).collection('trackedAccounts').doc(ld.accountId).get();
            if (accDoc.exists) {
              console.log(`      @${accDoc.data().username} (${accDoc.data().platform})`);
            } else {
              console.log(`      ❌ account ${ld.accountId} NOT FOUND`);
            }
          }
        } else {
          console.log(`    creator profile:       ❌ MISSING`);
        }
      }
    }
  }
}

if (!found) {
  console.log(`❌ No creator found matching "${searchName}"`);
}

// Also re-verify plan
const subDoc = await db.collection('organizations').doc(orgId).collection('billing').doc('subscription').get();
console.log(`\n=== MAKTUB PLAN ===`);
console.log(`  planTier: ${subDoc.data()?.planTier}`);
console.log(`  status:   ${subDoc.data()?.status}`);

process.exit(0);
