/**
 * Quick utility to list organizations and their projects from Firestore.
 * Run with: node scripts/list-orgs.js
 *
 * Uses the same Firebase credentials from .env.local
 */

import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Load .env.local manually (no dotenv dependency needed)
const envFile = readFileSync('.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIndex = trimmed.indexOf('=');
  if (eqIndex === -1) continue;
  const key = trimmed.slice(0, eqIndex);
  let value = trimmed.slice(eqIndex + 1);
  if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
  process.env[key] = value;
}

let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
  privateKey = privateKey.slice(1, -1);
}
privateKey = privateKey.replace(/\\n/g, '\n');

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey,
  }),
});

const db = getFirestore();

async function main() {
  console.log('\n=== Organizations ===\n');

  const orgsSnapshot = await db.collection('organizations').get();

  for (const orgDoc of orgsSnapshot.docs) {
    const org = orgDoc.data();
    const orgId = orgDoc.id;

    // Get subscription/plan tier
    const subDoc = await db
      .collection('organizations').doc(orgId)
      .collection('billing').doc('subscription')
      .get();
    const planTier = subDoc.data()?.planTier || 'free';

    console.log(`Org: ${org.name || '(unnamed)'}`);
    console.log(`  ID:   ${orgId}`);
    console.log(`  Plan: ${planTier}`);

    // List projects
    const projectsSnapshot = await db
      .collection('organizations').doc(orgId)
      .collection('projects')
      .get();

    for (const projDoc of projectsSnapshot.docs) {
      const proj = projDoc.data();
      const projId = projDoc.id;

      // Count active accounts
      const accountsSnapshot = await db
        .collection('organizations').doc(orgId)
        .collection('projects').doc(projId)
        .collection('trackedAccounts')
        .where('isActive', '==', true)
        .get();

      // Check last refreshed time on first account
      let lastRefreshed = 'Never';
      if (accountsSnapshot.size > 0) {
        const firstAccount = accountsSnapshot.docs[0].data();
        if (firstAccount.lastRefreshed) {
          const date = firstAccount.lastRefreshed.toDate();
          const hoursAgo = Math.round((Date.now() - date.getTime()) / (1000 * 60 * 60));
          lastRefreshed = `${hoursAgo}h ago (${date.toISOString()})`;
        }
      }

      console.log(`  Project: ${proj.name || '(unnamed)'}`);
      console.log(`    ID:              ${projId}`);
      console.log(`    Active accounts: ${accountsSnapshot.size}`);
      console.log(`    Last refreshed:  ${lastRefreshed}`);
    }
    console.log('');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
