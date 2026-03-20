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
const targetEmail = process.argv[2] || 'mauricioelhobbit@gmail.com';

console.log(`\n🔍 Looking up: ${targetEmail}\n`);

const orgsSnapshot = await db.collection('organizations').get();

for (const orgDoc of orgsSnapshot.docs) {
  const membersSnapshot = await db.collection('organizations').doc(orgDoc.id)
    .collection('members').get();

  for (const memberDoc of membersSnapshot.docs) {
    const member = memberDoc.data();
    if (member.email?.toLowerCase() === targetEmail.toLowerCase()) {
      const org = orgDoc.data();
      console.log(`✅ Found org!`);
      console.log(`  Org Name:  ${org.name}`);
      console.log(`  Org ID:    ${orgDoc.id}`);
      console.log(`  Role:      ${member.role}`);
      console.log(`  Status:    ${member.status}`);

      // Subscription
      const subDoc = await db.collection('organizations').doc(orgDoc.id)
        .collection('billing').doc('subscription').get();
      const sub = subDoc.data();
      console.log(`\n📋 Subscription:`);
      console.log(`  Plan Tier:   ${sub?.planTier || 'NO SUBSCRIPTION DOC'}`);
      console.log(`  Status:      ${sub?.status || 'N/A'}`);
      console.log(`  Stripe Sub:  ${sub?.stripeSubscriptionId || 'N/A'}`);
      console.log(`  Period End:  ${sub?.currentPeriodEnd?.toDate?.() || 'N/A'}`);
      console.log(`  usage.videos:    ${sub?.usage?.videos ?? 'NOT SET'}`);
      console.log(`  usage.accounts:  ${sub?.usage?.accounts ?? 'NOT SET'}`);

      // Usage doc
      const usageDoc = await db.collection('organizations').doc(orgDoc.id)
        .collection('billing').doc('usage').get();
      const usage = usageDoc.data();
      console.log(`\n📊 Usage Doc (billing/usage):`);
      console.log(`  trackedVideos:  ${usage?.trackedVideos ?? 'NOT SET'}`);
      console.log(`  trackedAccounts: ${usage?.trackedAccounts ?? 'NOT SET'}`);
      console.log(`  videoLimit:     ${usage?.videoLimit ?? 'NOT SET'}`);

      // Count actual videos across all projects
      const projectsSnapshot = await db.collection('organizations').doc(orgDoc.id)
        .collection('projects').get();

      let totalVideos = 0;
      let totalAccounts = 0;
      for (const projDoc of projectsSnapshot.docs) {
        const proj = projDoc.data();
        const videosSnap = await projDoc.ref.collection('videos').count().get();
        const accountsSnap = await projDoc.ref.collection('trackedAccounts').count().get();
        const vCount = videosSnap.data().count;
        const aCount = accountsSnap.data().count;
        totalVideos += vCount;
        totalAccounts += aCount;
        console.log(`\n📁 Project: ${proj.name} (${projDoc.id})`);
        console.log(`  Videos:   ${vCount}`);
        console.log(`  Accounts: ${aCount}`);

        // List accounts
        const accs = await projDoc.ref.collection('trackedAccounts').get();
        for (const accDoc of accs.docs) {
          const a = accDoc.data();
          console.log(`    @${a.username} (${a.platform}) - ${a.totalVideos || 0} videos, maxVideos: ${a.maxVideos || '?'}, status: ${a.syncStatus || '?'}`);
        }
      }

      console.log(`\n📊 TOTALS:`);
      console.log(`  Actual videos in Firestore: ${totalVideos}`);
      console.log(`  Actual accounts in Firestore: ${totalAccounts}`);
      console.log(`  Plan limit (basic=150): ${sub?.planTier === 'basic' ? 150 : sub?.planTier === 'free' ? 5 : '?'}`);
      console.log(`  Over limit? ${sub?.planTier === 'basic' && totalVideos > 150 ? '⚠️  YES' : 'No'}`);
      console.log('');

      process.exit(0);
    }
  }
}

console.log(`❌ No org found with member email: ${targetEmail}`);
process.exit(1);
