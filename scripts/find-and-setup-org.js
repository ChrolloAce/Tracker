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

// Find org with maubaron.ai@gmail.com as a member
const email = 'maubaron.ai@gmail.com';

console.log(`\nSearching for org with member: ${email}\n`);

// Search all orgs for this member
const orgsSnapshot = await db.collection('organizations').get();

for (const orgDoc of orgsSnapshot.docs) {
  const membersSnapshot = await db.collection('organizations').doc(orgDoc.id)
    .collection('members').get();

  for (const memberDoc of membersSnapshot.docs) {
    const member = memberDoc.data();
    if (member.email === email || member.email?.toLowerCase() === email) {
      const org = orgDoc.data();
      console.log(`Found your org!`);
      console.log(`  Org Name:  ${org.name}`);
      console.log(`  Org ID:    ${orgDoc.id}`);
      console.log(`  Your Role: ${member.role}`);

      // Get projects
      const projectsSnapshot = await db.collection('organizations').doc(orgDoc.id)
        .collection('projects').get();

      for (const projDoc of projectsSnapshot.docs) {
        console.log(`  Project:   ${projDoc.data().name} (${projDoc.id})`);
      }

      // Check current subscription
      const subDoc = await db.collection('organizations').doc(orgDoc.id)
        .collection('billing').doc('subscription').get();
      console.log(`  Plan:      ${subDoc.data()?.planTier || 'free (no subscription doc)'}`);

      // Grant basic plan
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      await db.collection('organizations').doc(orgDoc.id)
        .collection('billing').doc('subscription').set({
          planTier: 'basic',
          status: 'active',
          stripeSubscriptionId: `test_${Date.now()}`,
          stripePriceId: 'test_price_basic',
          stripeCustomerId: `test_customer_${orgDoc.id}`,
          currentPeriodStart: Timestamp.fromDate(now),
          currentPeriodEnd: Timestamp.fromDate(periodEnd),
          cancelAtPeriodEnd: false,
          usage: { videos: 0, accounts: 0, teamMembers: 1, mcpCalls: 0, links: 0 },
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          testMode: true
        }, { merge: false });

      console.log(`\n  ✅ Upgraded to BASIC plan (test mode, expires ${periodEnd.toISOString()})`);
      console.log(`\n  You should now be able to use the dashboard without the paywall.`);
      console.log(`  Refresh the page in your browser.\n`);

      process.exit(0);
    }
  }
}

console.log(`No org found with member email: ${email}`);
process.exit(1);
