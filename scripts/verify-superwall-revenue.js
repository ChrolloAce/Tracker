/**
 * Verify Superwall revenue data by calling the Charts V2 API directly.
 *
 * Usage: node scripts/verify-superwall-revenue.js <orgId>
 */
import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ── Bootstrap env + Firebase Admin ────────────────────────────────
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

// ── Main ──────────────────────────────────────────────────────────
const orgId = process.argv[2];
if (!orgId) {
  console.error('Usage: node scripts/verify-superwall-revenue.js <orgId>');
  process.exit(1);
}

(async () => {
  // 1. Read Superwall settings from Firestore
  const settingsSnap = await db
    .collection('organizations').doc(orgId)
    .collection('settings').doc('general')
    .get();

  const settings = settingsSnap.data();
  const sw = settings?.integrations?.superwall;

  if (!sw?.apiKey || !sw?.applicationId) {
    console.error('❌ No Superwall API key or Application ID found for this org.');
    console.log('   Settings:', JSON.stringify(settings?.integrations, null, 2));
    process.exit(1);
  }

  console.log(`✅ Found Superwall config: appId=${sw.applicationId}, label=${sw.applicationLabel || 'N/A'}`);
  console.log(`   API key: ${sw.apiKey.slice(0, 8)}...${sw.apiKey.slice(-4)}\n`);

  // 2. Call Superwall Charts API — netProceeds, all time, daily, production only
  const body = {
    application_id: sw.applicationId,
    y_axis: 'netProceeds',
    x_axis: 'purchaseDate',
    date_filter: {
      dimension: 'purchaseDate',
      preset: 'last_365_days',
    },
    date_interval: 'month',
    environment: ['PRODUCTION'],
  };

  console.log('📊 Request body:', JSON.stringify(body, null, 2));
  console.log('');

  const res = await fetch('https://api.superwall.com/v2/charts/data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sw.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error(`❌ Superwall API returned ${res.status}:`, await res.text());
    process.exit(1);
  }

  const data = await res.json();

  // 3. Print raw response shape
  console.log('📊 Response overview:');
  console.log(`   series: ${JSON.stringify(data.series)}`);
  console.log(`   data points: ${data.data?.length}`);
  console.log(`   duration: ${data.duration}ms`);
  console.log('');

  // 4. Print each data point with raw values
  let total = 0;
  console.log('📊 Monthly breakdown (raw from Superwall):');
  console.log('─'.repeat(60));

  for (const point of data.data || []) {
    const keys = Object.keys(point.values || {});
    const entry = point.values?.['null'] ?? point.values?.[keys[0]];
    let value = 0;

    if (entry && typeof entry === 'object' && 'y' in entry) {
      value = entry.y;
    } else if (typeof entry === 'number') {
      value = entry;
    }

    total += value;
    const dateLabel = point.x?.split('T')[0] || point.x;
    console.log(`   ${dateLabel}  →  $${value.toFixed(2)}   (keys: ${JSON.stringify(keys)}, raw: ${JSON.stringify(entry)})`);
  }

  console.log('─'.repeat(60));
  console.log(`\n💰 TOTAL (sum of all points): $${total.toFixed(2)}`);

  // 5. Now try without the production filter to see the difference
  console.log('\n\n📊 Now checking WITHOUT production filter...');
  const bodyAll = { ...body };
  delete bodyAll.environment;

  const resAll = await fetch('https://api.superwall.com/v2/charts/data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sw.apiKey}`,
    },
    body: JSON.stringify(bodyAll),
  });

  const dataAll = await resAll.json();
  let totalAll = 0;
  for (const point of dataAll.data || []) {
    const keys = Object.keys(point.values || {});
    const entry = point.values?.['null'] ?? point.values?.[keys[0]];
    if (entry && typeof entry === 'object' && 'y' in entry) totalAll += entry.y;
    else if (typeof entry === 'number') totalAll += entry;
  }
  console.log(`💰 TOTAL (no env filter): $${totalAll.toFixed(2)}`);
  console.log(`   Difference: $${(totalAll - total).toFixed(2)} (sandbox/test data)`);

  // 6. Also try grossSales to compare
  console.log('\n\n📊 Now checking grossSales (production only)...');
  const bodyGross = { ...body, y_axis: 'grossSales' };

  const resGross = await fetch('https://api.superwall.com/v2/charts/data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sw.apiKey}`,
    },
    body: JSON.stringify(bodyGross),
  });

  const dataGross = await resGross.json();
  let totalGross = 0;
  for (const point of dataGross.data || []) {
    const keys = Object.keys(point.values || {});
    const entry = point.values?.['null'] ?? point.values?.[keys[0]];
    if (entry && typeof entry === 'object' && 'y' in entry) totalGross += entry.y;
    else if (typeof entry === 'number') totalGross += entry;
  }
  console.log(`💰 TOTAL grossSales: $${totalGross.toFixed(2)}`);
  console.log(`   vs netProceeds: $${total.toFixed(2)}`);
  console.log(`   Store fees: $${(totalGross - total).toFixed(2)}`);

  process.exit(0);
})();
