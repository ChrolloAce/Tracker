import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

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

// Admin user (Mauricio) submitting a video FOR the "Mau Baron Test" creator
const ADMIN_UID        = 'eGmqOSicPpfKvmxZBrHLr0iZKWQ2'; // mauriciobaronvergara@gmail.com
const CREATOR_ID       = 'HbTL8786fIFrlfyjm0fh';          // Mau Baron Test
const ORG_ID           = '00JnaavZp41PofxFf3cP';           // Maktub
const PROJECT_ID       = 'UtwLPXeMTkXxkqDxZ8gv';           // Prayer Lock Research
const VIDEO_URL        = 'https://www.tiktok.com/t/ZP8grtxQ2/';
const WEB_API_KEY      = 'AIzaSyCjsUafI6z16Yvc1W4DFKCQnczP1-bB0Tk';
const API_BASE         = process.argv[2] || 'https://www.viewtrack.app';

console.log(`\n🔬 Admin submitting video for creator "Mau Baron Test"`);
console.log(`   as admin:    ${ADMIN_UID}`);
console.log(`   creatorId:   ${CREATOR_ID}`);
console.log(`   orgId:       ${ORG_ID}`);
console.log(`   projectId:   ${PROJECT_ID}`);
console.log(`   videoUrl:    ${VIDEO_URL}\n`);

const customToken = await getAuth().createCustomToken(ADMIN_UID);
const exchangeRes = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_API_KEY}`,
  { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) }
);
const { idToken } = await exchangeRes.json();
console.log('✅ Admin ID token obtained');

const apiRes = await fetch(`${API_BASE}/api/queue-manual-video`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`,
    'Origin': 'https://viewtrack.app',
  },
  body: JSON.stringify({
    url: VIDEO_URL,
    orgId: ORG_ID,
    projectId: PROJECT_ID,
    assignedCreatorId: CREATOR_ID,
  }),
});

const body = await apiRes.json().catch(() => ({}));
console.log(`\n📥 HTTP ${apiRes.status}`);
console.log(JSON.stringify(body, null, 2));

if (apiRes.ok) {
  console.log('\n✅ Admin video submission for creator works.');
} else {
  console.log('\n❌ Failed — see response above.');
}
process.exit(0);
