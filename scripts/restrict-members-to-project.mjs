// Restrict specific members (by email) to only see the "Rork Official" project
// in the Maktub org. UI-level filter only: writes `assignedProjects` on the
// OrgMember doc so the ProjectSwitcher + AuthContext filters kick in.
//
// Usage:
//   node scripts/restrict-members-to-project.mjs email1@example.com email2@example.com
//
// Notes:
// - Only applies when the member's role === 'member'. Owners/admins are refused
//   (their role would need to be demoted first; we do not touch roles here).
// - If a user hasn't joined the org yet (no member doc), this reports them as
//   missing and skips them — re-run after they accept the invite.
// - Pass --clear to remove the restriction instead of applying it.

import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

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

const ORG_ID = '00JnaavZp41PofxFf3cP'; // Maktub
const PROJECT_NAME = 'Rork Official';

const args = process.argv.slice(2);
const clear = args.includes('--clear');
const emails = args.filter(a => a !== '--clear').map(e => e.trim().toLowerCase()).filter(Boolean);

if (emails.length === 0) {
  console.error('Usage: node scripts/restrict-members-to-project.mjs [--clear] email1 email2 ...');
  process.exit(1);
}

console.log(`\nOrg: Maktub (${ORG_ID})`);
console.log(`Mode: ${clear ? 'CLEAR restriction' : `RESTRICT to "${PROJECT_NAME}"`}`);
console.log(`Targets (${emails.length}): ${emails.join(', ')}\n`);

// 1. Find the target project by name (skip this lookup when clearing).
let projectId = null;
if (!clear) {
  const projectsSnap = await db.collection('organizations').doc(ORG_ID).collection('projects').get();
  const matches = projectsSnap.docs.filter(d => (d.data()?.name || '').trim().toLowerCase() === PROJECT_NAME.toLowerCase());

  if (matches.length === 0) {
    console.error(`❌ No project named "${PROJECT_NAME}" found in org ${ORG_ID}.`);
    console.error(`   Available projects:`);
    projectsSnap.docs.forEach(d => console.error(`   - ${d.data()?.name} (${d.id})`));
    process.exit(1);
  }
  if (matches.length > 1) {
    console.error(`❌ Multiple projects named "${PROJECT_NAME}" found. Resolve manually:`);
    matches.forEach(d => console.error(`   - ${d.id}`));
    process.exit(1);
  }
  projectId = matches[0].id;
  console.log(`✅ Found project "${PROJECT_NAME}" — id: ${projectId}\n`);
}

// 2. Load members for the org (one read).
const membersSnap = await db.collection('organizations').doc(ORG_ID).collection('members').get();
const membersByEmail = new Map();
for (const d of membersSnap.docs) {
  const data = d.data();
  const email = (data.email || '').trim().toLowerCase();
  if (email) membersByEmail.set(email, { docId: d.id, data });
}

// 3. Apply per email.
let applied = 0, skipped = 0, missing = 0;
for (const email of emails) {
  const m = membersByEmail.get(email);
  if (!m) {
    console.log(`⚠️  ${email} — no member doc in Maktub (not yet joined?). Skipping.`);
    missing++;
    continue;
  }
  const { docId, data } = m;
  if (data.role !== 'member') {
    console.log(`⏭️  ${email} — role is "${data.role}", not "member". Refusing to touch assignedProjects (demote to member first if you want this restriction).`);
    skipped++;
    continue;
  }

  const ref = db.collection('organizations').doc(ORG_ID).collection('members').doc(docId);
  if (clear) {
    await ref.update({ assignedProjects: FieldValue.delete() });
    console.log(`🔓 ${email} — cleared assignedProjects (full access restored).`);
  } else {
    await ref.update({ assignedProjects: [projectId] });
    console.log(`🔒 ${email} — assignedProjects = ["${projectId}"] (restricted to "${PROJECT_NAME}").`);
  }
  applied++;
}

console.log(`\nDone. applied=${applied} skipped=${skipped} missing=${missing}`);
if (missing > 0) {
  console.log(`Hint: re-run this script after missing users accept their invite.`);
}
