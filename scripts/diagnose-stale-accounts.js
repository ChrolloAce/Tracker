/**
 * Read-only diagnostic for two specific accounts:
 *   1. "Nicole" inside the "prayer lock" project of the super-admin org
 *   2. "danharebin" Instagram account anywhere in the super-admin org
 *
 * Dumps:
 *   - Account fields (lastRefreshed, lastRefreshError, syncStatus, syncLockId, ...)
 *   - Recent syncQueue jobs for that account (last ~10)
 *   - Recent refreshSessions for the org
 *   - For danharebin: pulls all tracked videos and shows lastRefreshed + age
 *     so we can directly test the age-filter / partition-by-age hypothesis
 *
 * Run: node scripts/diagnose-stale-accounts.js
 */

import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ── Load .env.local ──
const envFile = readFileSync('.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq === -1) continue;
  let k = t.slice(0, eq);
  let v = t.slice(eq + 1);
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

// ── helpers ──
const fmtDate = (ts) => {
  if (!ts) return 'NULL';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const hrs = (Date.now() - d.getTime()) / 3600000;
    return `${d.toISOString()}  (${hrs.toFixed(1)}h ago)`;
  } catch {
    return String(ts);
  }
};

const dumpAccount = (acc, docId) => {
  console.log(`    Doc ID:           ${docId}`);
  console.log(`    Username:         @${acc.username}`);
  console.log(`    Platform:         ${acc.platform}`);
  console.log(`    isActive:         ${acc.isActive}`);
  console.log(`    creatorType:      ${acc.creatorType || '(unset, defaults to automatic)'}`);
  console.log(`    syncStrategy:     ${acc.syncStrategy || '(unset, defaults to progressive)'}`);
  console.log(`    syncStatus:       ${acc.syncStatus || 'none'}`);
  console.log(`    refreshStatus:    ${acc.refreshStatus || 'none'}`);
  console.log(`    totalVideos:      ${acc.totalVideos ?? 0}`);
  console.log(`    maxVideos:        ${acc.maxVideos ?? '-'}`);
  console.log(`    followerCount:    ${acc.followerCount ?? 0}`);
  console.log(`    lastRefreshed:    ${fmtDate(acc.lastRefreshed)}`);
  console.log(`    lastSynced:       ${fmtDate(acc.lastSynced)}`);
  console.log(`    lastRefreshError: ${acc.lastRefreshError || '(none)'}`);
  console.log(`    lastRefreshErrorAt: ${fmtDate(acc.lastRefreshErrorAt)}`);
  console.log(`    lastRefreshDuration: ${acc.lastRefreshDuration ?? '-'}ms`);
  console.log(`    syncLockId:       ${acc.syncLockId || '(none)'}`);
  console.log(`    syncLockTimestamp: ${fmtDate(acc.syncLockTimestamp)}`);
  console.log(`    syncProgress:     ${JSON.stringify(acc.syncProgress || {})}`);
  console.log(`    dateAdded:        ${fmtDate(acc.dateAdded)}`);
};

const dumpJobs = async (accountId) => {
  const jobs = await db.collection('syncQueue')
    .where('accountId', '==', accountId)
    .limit(20)
    .get();

  if (jobs.empty) {
    console.log(`    Recent jobs:      NONE in syncQueue`);
    console.log(`    (note: jobs older than 24h are auto-purged by cleanup-stuck-items)`);
    return;
  }

  // Sort in JS so we don't need a Firestore index
  const sorted = jobs.docs
    .map(d => ({ id: d.id, data: d.data() }))
    .sort((a, b) => {
      const ta = a.data.createdAt?.toMillis?.() || 0;
      const tb = b.data.createdAt?.toMillis?.() || 0;
      return tb - ta;
    });

  console.log(`    Recent jobs (${sorted.length}):`);
  for (const { id, data: j } of sorted) {
    console.log(`      • ${id}`);
    console.log(`          status:   ${j.status} (attempts ${j.attempts ?? 0}/${j.maxAttempts ?? '?'})`);
    console.log(`          type:     ${j.type}  priority:${j.priority}`);
    console.log(`          created:  ${fmtDate(j.createdAt)}`);
    console.log(`          started:  ${fmtDate(j.startedAt)}`);
    console.log(`          completed:${fmtDate(j.completedAt)}`);
    console.log(`          error:    ${j.error || '(none)'}`);
  }
};

const dumpSessions = async (orgId) => {
  const sessions = await db.collection('organizations').doc(orgId)
    .collection('refreshSessions')
    .orderBy('startedAt', 'desc')
    .limit(5)
    .get();

  if (sessions.empty) {
    console.log(`  Recent refreshSessions: NONE`);
    return;
  }

  console.log(`  Recent refreshSessions (${sessions.size}):`);
  for (const sDoc of sessions.docs) {
    const s = sDoc.data();
    console.log(`    • ${sDoc.id}`);
    console.log(`        status:    ${s.status}`);
    console.log(`        started:   ${fmtDate(s.startedAt)}`);
    console.log(`        completed: ${fmtDate(s.completedAt)}`);
    console.log(`        accounts:  ${s.completedAccounts ?? 0}/${s.totalAccounts ?? 0}`);
    console.log(`        videos:    ${s.totalVideos ?? 0}`);
    console.log(`        manual:    ${s.manualTrigger || false}  emailSent: ${s.emailSent || false}`);
  }
};

// Show videos for an account, with their refresh state, to test the age-filter bug
const dumpVideos = async (orgId, projectId, accountId, label) => {
  const videos = await db.collection('organizations').doc(orgId)
    .collection('projects').doc(projectId)
    .collection('videos')
    .where('trackedAccountId', '==', accountId)
    .get();

  console.log(`\n  📹 Videos for ${label} (${videos.size} total):`);
  if (videos.empty) {
    console.log('    (no videos in Firestore for this account)');
    return;
  }

  const now = Date.now();
  const today = new Date();
  const isSunday = today.getDay() === 0;
  const isFirstOfMonth = today.getDate() === 1;

  // Count by age bucket and refresh status
  const buckets = { recent: [], midAge: [], archival: [] };
  const rows = [];

  for (const vDoc of videos.docs) {
    const v = vDoc.data();
    const uploadedAt = v.uploadedAt?.toDate?.() || v.dateAdded?.toDate?.() || null;
    const ageDays = uploadedAt ? (now - uploadedAt.getTime()) / 86400000 : null;
    const lastRefreshed = v.lastRefreshed?.toDate?.() || null;
    const hoursSinceRefresh = lastRefreshed ? (now - lastRefreshed.getTime()) / 3600000 : null;

    let bucket = 'unknown';
    let willRefreshOnCron = false;
    if (ageDays !== null) {
      if (ageDays <= 30) { bucket = 'recent'; willRefreshOnCron = true; }
      else if (ageDays <= 90) { bucket = 'midAge'; willRefreshOnCron = isSunday; }
      else { bucket = 'archival'; willRefreshOnCron = isFirstOfMonth; }
      buckets[bucket].push(vDoc.id);
    }

    rows.push({
      id: vDoc.id,
      videoId: v.videoId,
      views: v.views ?? v.viewCount ?? 0,
      ageDays: ageDays !== null ? Math.round(ageDays) : '?',
      bucket,
      willRefreshOnCron,
      hoursSinceRefresh: hoursSinceRefresh !== null ? Math.round(hoursSinceRefresh * 10) / 10 : null,
      lastRefreshed: lastRefreshed ? lastRefreshed.toISOString() : 'NULL',
    });
  }

  console.log(`    Today: ${today.toISOString()} — isSunday=${isSunday} isFirstOfMonth=${isFirstOfMonth}`);
  console.log(`    Bucket counts: recent=${buckets.recent.length} midAge=${buckets.midAge.length} archival=${buckets.archival.length}`);
  const skippedByAgeFilter = (isSunday ? 0 : buckets.midAge.length) + (isFirstOfMonth ? 0 : buckets.archival.length);
  console.log(`    ⚠️  Videos the cron will SKIP today due to age filter: ${skippedByAgeFilter}`);

  // Show the 10 stalest
  rows.sort((a, b) => (b.hoursSinceRefresh ?? 0) - (a.hoursSinceRefresh ?? 0));
  console.log(`\n    Top 15 stalest videos:`);
  console.log(`    ${'videoId'.padEnd(22)} ${'views'.padStart(10)}  ${'age(d)'.padStart(7)}  ${'lastRefr(h)'.padStart(11)}  bucket    cronToday`);
  for (const r of rows.slice(0, 15)) {
    console.log(
      `    ${String(r.videoId || r.id).slice(0, 22).padEnd(22)} ` +
      `${String(r.views).padStart(10)}  ` +
      `${String(r.ageDays).padStart(7)}  ` +
      `${String(r.hoursSinceRefresh ?? '-').padStart(11)}  ` +
      `${r.bucket.padEnd(9)} ${r.willRefreshOnCron ? '✓' : '✗ SKIPPED'}`
    );
  }
};

// ── main ──
async function main() {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('  STALE ACCOUNT DIAGNOSTIC');
  console.log('════════════════════════════════════════════════════════════════\n');

  // Find candidate orgs (super admin org). We don't know the orgId, so list all
  // and find ones with a project containing "prayer" or an account "danharebin".
  const orgsSnap = await db.collection('organizations').get();
  console.log(`Scanning ${orgsSnap.size} organizations...\n`);

  const matches = []; // { orgId, orgName, projectId, projectName, type, account }

  for (const orgDoc of orgsSnap.docs) {
    const orgId = orgDoc.id;
    const orgName = orgDoc.data().name || '(unnamed)';

    const projectsSnap = await db.collection('organizations').doc(orgId)
      .collection('projects').get();

    for (const projDoc of projectsSnap.docs) {
      const projectId = projDoc.id;
      const projectName = projDoc.data().name || '(unnamed)';
      const projectNameLower = projectName.toLowerCase();

      const accountsSnap = await db.collection('organizations').doc(orgId)
        .collection('projects').doc(projectId)
        .collection('trackedAccounts').get();

      for (const accDoc of accountsSnap.docs) {
        const acc = accDoc.data();
        const username = (acc.username || '').toLowerCase();
        const platform = (acc.platform || '').toLowerCase();

        // 1. "Nicole" inside a "prayer" project
        if (projectNameLower.includes('prayer') && username.includes('nicole')) {
          matches.push({
            label: 'Nicole / prayer',
            orgId, orgName, projectId, projectName,
            accountId: accDoc.id, account: acc,
          });
        }

        // 2. danharebin (any platform — user said Instagram)
        if (username.includes('danharebin') || username.includes('danhare') || username.includes('dan_hare')) {
          matches.push({
            label: 'danharebin',
            orgId, orgName, projectId, projectName,
            accountId: accDoc.id, account: acc,
          });
        }
      }
    }
  }

  if (matches.length === 0) {
    console.log('❌ Could not find either account by name search.\n');
    console.log('Listing all orgs + projects so we can pick the right one manually:\n');
    for (const orgDoc of orgsSnap.docs) {
      const orgId = orgDoc.id;
      const orgName = orgDoc.data().name || '(unnamed)';
      console.log(`Org: ${orgName}  (${orgId})`);
      const projectsSnap = await db.collection('organizations').doc(orgId)
        .collection('projects').get();
      for (const projDoc of projectsSnap.docs) {
        console.log(`  Project: ${projDoc.data().name || '(unnamed)'}  (${projDoc.id})`);
      }
    }
    process.exit(0);
  }

  console.log(`Found ${matches.length} candidate account(s):\n`);

  for (const m of matches) {
    console.log('─'.repeat(64));
    console.log(`🎯 ${m.label}`);
    console.log(`  Org:      ${m.orgName}  (${m.orgId})`);
    console.log(`  Project:  ${m.projectName}  (${m.projectId})`);
    console.log(`  Account fields:`);
    dumpAccount(m.account, m.accountId);
    await dumpJobs(m.accountId);
    if (m.label === 'danharebin') {
      await dumpVideos(m.orgId, m.projectId, m.accountId, '@' + (m.account.username || ''));
    }
    console.log('');
  }

  // Org-level session summaries (one per unique org found)
  const seenOrgs = new Set();
  for (const m of matches) {
    if (seenOrgs.has(m.orgId)) continue;
    seenOrgs.add(m.orgId);
    console.log('─'.repeat(64));
    console.log(`📊 Recent refresh sessions for org: ${m.orgName}`);
    await dumpSessions(m.orgId);
    console.log('');
  }

  console.log('════════════════════════════════════════════════════════════════');
  console.log('Done. Read-only — nothing was modified.');
  console.log('════════════════════════════════════════════════════════════════\n');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
