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

// Matches anything containing "dan" case-insensitive, but try to prefer explicit matches
const NAME_RE = /\bdan\b|dan[._-]|^dan/i;

console.log('\n=== PHASE 1: scan all orgs for Instagram accounts tied to "Dan" ===\n');

const orgsSnap = await db.collection('organizations').get();
console.log(`Found ${orgsSnap.size} organizations\n`);

const candidateAccounts = []; // { orgId, orgName, projectId, projectName, accountId, username, platform, displayName }

for (const orgDoc of orgsSnap.docs) {
  const orgId = orgDoc.id;
  const orgName = orgDoc.data().name || '(unnamed org)';
  const projectsSnap = await db.collection('organizations').doc(orgId).collection('projects').get();

  for (const projDoc of projectsSnap.docs) {
    const projectId = projDoc.id;
    const projectName = projDoc.data().name || '(unnamed project)';

    const accountsSnap = await db.collection('organizations').doc(orgId)
      .collection('projects').doc(projectId)
      .collection('trackedAccounts')
      .where('platform', '==', 'instagram')
      .get();

    for (const accDoc of accountsSnap.docs) {
      const a = accDoc.data();
      const username = a.username || '';
      const displayName = a.displayName || a.fullName || '';
      if (NAME_RE.test(username) || NAME_RE.test(displayName)) {
        candidateAccounts.push({
          orgId, orgName,
          projectId, projectName,
          accountId: accDoc.id,
          username,
          displayName,
          followerCount: a.followerCount || a.followersCount || 0,
          lastSynced: a.lastSynced?.toDate?.() || null,
        });
      }
    }
  }
}

console.log(`Found ${candidateAccounts.length} Instagram accounts matching "dan":\n`);
for (const c of candidateAccounts) {
  console.log(`  org=${c.orgName} (${c.orgId})`);
  console.log(`     project=${c.projectName} (${c.projectId})`);
  console.log(`     accountId=${c.accountId}  @${c.username}  displayName="${c.displayName}"`);
  console.log(`     followers=${c.followerCount}  lastSynced=${c.lastSynced}`);
  console.log('');
}

if (candidateAccounts.length === 0) {
  console.log('❌ No match. Will broaden search to any account with "dan" substring in next run.');
  process.exit(0);
}

console.log('\n=== PHASE 2: fetch videos for each Dan account ===\n');

for (const c of candidateAccounts) {
  console.log(`\n━━━ @${c.username} (${c.orgName} / ${c.projectName}) ━━━`);

  const videosSnap = await db.collection('organizations').doc(c.orgId)
    .collection('projects').doc(c.projectId)
    .collection('videos')
    .where('accountUsername', '==', c.username)
    .get();

  // Also try trackedAccountId linkage in case accountUsername is inconsistent
  let vids = videosSnap.docs;
  if (vids.length === 0) {
    const alt = await db.collection('organizations').doc(c.orgId)
      .collection('projects').doc(c.projectId)
      .collection('videos')
      .where('trackedAccountId', '==', c.accountId)
      .get();
    vids = alt.docs;
    if (vids.length > 0) console.log(`  (matched via trackedAccountId, not accountUsername)`);
  }

  console.log(`  ${vids.length} video(s)`);
  if (vids.length === 0) continue;

  // Sort by upload date desc
  vids.sort((a, b) => {
    const ta = a.data().uploadDate?.toMillis?.() || 0;
    const tb = b.data().uploadDate?.toMillis?.() || 0;
    return tb - ta;
  });

  for (const vDoc of vids) {
    const v = vDoc.data();
    const numericVideoId = /^\d+(_\d+)?$/.test(v.videoId || '');
    console.log('');
    console.log(`  ─ doc=${vDoc.id}  videoId="${v.videoId}" ${numericVideoId ? '⚠️ NUMERIC' : ''}`);
    console.log(`    url:            ${v.videoUrl || v.url || '(none)'}`);
    console.log(`    title:          ${(v.videoTitle || v.caption || '').substring(0, 80)}`);
    console.log(`    uploadDate:     ${v.uploadDate?.toDate?.() || '(none)'}`);
    console.log(`    views:          ${v.views ?? '(undef)'}`);
    console.log(`    likes:          ${v.likes ?? '(undef)'}`);
    console.log(`    comments:       ${v.comments ?? '(undef)'}`);
    console.log(`    lastRefreshed:  ${v.lastRefreshed?.toDate?.() || '(never)'}`);

    // Pull recent snapshots to see the view trajectory
    const snapsSnap = await vDoc.ref.collection('snapshots')
      .orderBy('capturedAt', 'desc')
      .limit(10)
      .get();

    if (!snapsSnap.empty) {
      console.log(`    recent snapshots (newest first):`);
      for (const s of snapsSnap.docs) {
        const sd = s.data();
        const ts = sd.capturedAt?.toDate?.() || sd.timestamp?.toDate?.() || null;
        console.log(`       ${ts?.toISOString?.() || '?'}  views=${sd.views}  likes=${sd.likes}  by=${sd.capturedBy || '?'}  initial=${!!sd.isInitialSnapshot}`);
      }
    } else {
      console.log(`    no snapshots`);
    }
  }
}

console.log('\n\n=== done ===\n');
process.exit(0);
