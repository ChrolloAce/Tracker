import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Load .env.local
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

// CONFIG
const TARGET_UID   = 'eGmqOSicPpfKvmxZBrHLr0iZKWQ2'; // Mauricio
const ORG_ID       = '00JnaavZp41PofxFf3cP';          // Maktub
const PROJECT_ID   = 'zUO7WgoL14Oy6UYlHX5z';          // from the creator invite we just looked up
const VIDEO_URL    = 'https://www.tiktok.com/t/ZP8grtxQ2/';
const WEB_API_KEY  = 'AIzaSyCjsUafI6z16Yvc1W4DFKCQnczP1-bB0Tk'; // from src/services/firebase.ts
const API_BASE     = process.argv[2] || 'https://viewtrack.app';

console.log(`\n🔬 Reproducing /api/queue-manual-video call`);
console.log(`   API base:   ${API_BASE}`);
console.log(`   as user:    ${TARGET_UID}`);
console.log(`   orgId:      ${ORG_ID}`);
console.log(`   projectId:  ${PROJECT_ID}`);
console.log(`   videoUrl:   ${VIDEO_URL}\n`);

// 1. Mint custom token via Admin SDK
console.log('🎫 Step 1: Mint custom token via Admin SDK...');
const customToken = await getAuth().createCustomToken(TARGET_UID);
console.log(`   ✅ Custom token minted (${customToken.length} chars)`);

// 2. Exchange custom token for ID token via Firebase Auth REST
console.log('\n🔄 Step 2: Exchange custom token for ID token...');
const exchangeRes = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_API_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  }
);
const exchangeData = await exchangeRes.json();
if (!exchangeRes.ok) {
  console.error(`   ❌ Exchange failed: HTTP ${exchangeRes.status}`);
  console.error('   Response:', exchangeData);
  process.exit(1);
}
const idToken = exchangeData.idToken;
console.log(`   ✅ ID token received (${idToken.length} chars)`);

// 3. POST to /api/queue-manual-video
console.log('\n🚀 Step 3: POST to /api/queue-manual-video...');
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
    assignedCreatorId: TARGET_UID,
  }),
});

const apiText = await apiRes.text();
let apiJson;
try { apiJson = JSON.parse(apiText); } catch { apiJson = null; }

console.log(`\n📥 Response:`);
console.log(`   HTTP status: ${apiRes.status} ${apiRes.statusText}`);
console.log(`   Headers:`);
for (const [k, v] of apiRes.headers.entries()) {
  console.log(`     ${k}: ${v}`);
}
console.log(`   Body:`);
if (apiJson) {
  console.log(JSON.stringify(apiJson, null, 2).split('\n').map(l => '     ' + l).join('\n'));
} else {
  console.log('     ' + apiText.slice(0, 2000));
}

if (apiRes.ok) {
  console.log(`\n✅ SUCCESS — API accepted the submission.`);
  console.log('   (If Mauricio still sees the error in browser, it is client-side.)');
} else {
  console.log(`\n❌ FAILED — reproduced Mauricio's error. See response body above.`);
}

process.exit(0);
