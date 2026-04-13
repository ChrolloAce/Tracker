// Quick: list every tracked account in the Prayer Lock project so we can find "Nicole"
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

const orgId = '00JnaavZp41PofxFf3cP';     // Maktub
const projectId = 'zUO7WgoL14Oy6UYlHX5z';  // Prayer Lock

const snap = await db.collection('organizations').doc(orgId)
  .collection('projects').doc(projectId)
  .collection('trackedAccounts').get();

console.log(`\nPrayer Lock has ${snap.size} tracked accounts:\n`);

const rows = [];
for (const d of snap.docs) {
  const a = d.data();
  const lr = a.lastRefreshed?.toDate?.();
  rows.push({
    docId: d.id,
    username: a.username || '?',
    displayName: a.displayName || '',
    platform: a.platform || '?',
    isActive: a.isActive,
    creatorType: a.creatorType || 'automatic',
    totalVideos: a.totalVideos ?? 0,
    lastRefreshed: lr ? `${((Date.now() - lr.getTime()) / 3600000).toFixed(1)}h ago` : 'NEVER',
    lastSynced: a.lastSynced?.toDate?.()?.toISOString() || 'NULL',
    syncStatus: a.syncStatus || '-',
    lastRefreshError: a.lastRefreshError || '',
    syncProgressMsg: a.syncProgress?.message || '',
  });
}

rows.sort((a, b) => a.username.localeCompare(b.username));

for (const r of rows) {
  const flag = r.username.toLowerCase().includes('nicole') || r.displayName.toLowerCase().includes('nicole') ? '🎯 ' : '   ';
  console.log(`${flag}@${r.username.padEnd(28)} ${r.platform.padEnd(10)} ${r.creatorType.padEnd(10)} videos:${String(r.totalVideos).padStart(4)}  refreshed:${r.lastRefreshed.padStart(12)}  status:${r.syncStatus}`);
  if (r.lastRefreshError) console.log(`     err: ${r.lastRefreshError}`);
  if (r.syncProgressMsg && r.syncProgressMsg.toLowerCase().includes('warning')) console.log(`     ⚠️  ${r.syncProgressMsg}`);
}

process.exit(0);
