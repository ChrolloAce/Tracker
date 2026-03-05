import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// ─── Firebase init ───────────────────────────────────────
function initializeFirebase() {
  if (!getApps().length) {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');

    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      } as any),
    });
  }
  return getFirestore();
}

// ─── Auth ────────────────────────────────────────────────
const SUPER_ADMIN_EMAILS = ['ernesto@maktubtechnologies.com'];

// ─── Types ───────────────────────────────────────────────
interface SeedEntry {
  order: number;
  contentType: 'video' | 'slideshow';
  uploaderHandle: string;
  followerCount: number;
  uploadDateISO: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  category: string;
  monetization: string;
  productBrand: string;
  hook: string;
  caption: string;
  tags: string[];
  url: string;
  thumbnail: string;
}

// ─── Handler ─────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, entries, clearFirst } = req.body as {
    email: string;
    entries: SeedEntry[];
    clearFirst?: boolean;
  };

  if (!email || !SUPER_ADMIN_EMAILS.includes(email.toLowerCase())) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'entries array is required' });
  }

  try {
    const db = initializeFirebase();
    const collectionRef = db.collection('viralContent');

    // Optional: clear existing documents first (only on the first batch)
    if (clearFirst) {
      console.log('🗑️ Clearing existing viralContent collection…');
      const existing = await collectionRef.listDocuments();
      const deleteBatches = chunkArray(existing, 500);
      for (const chunk of deleteBatches) {
        const batch = db.batch();
        chunk.forEach((docRef) => batch.delete(docRef));
        await batch.commit();
      }
      console.log(`🗑️ Deleted ${existing.length} existing documents`);
    }

    // Write new documents in Firestore batches of 500
    const now = Timestamp.now();
    let writtenCount = 0;

    const entryChunks = chunkArray(entries, 500);
    for (const chunk of entryChunks) {
      const batch = db.batch();

      for (const entry of chunk) {
        // Deterministic doc ID based on order number
        const docId = `viral_${String(entry.order).padStart(5, '0')}`;
        const docRef = collectionRef.doc(docId);

        const title = entry.hook || entry.caption.substring(0, 120) || 'Untitled';

        batch.set(docRef, {
          order: entry.order,
          url: entry.url,
          platform: 'tiktok',
          title,
          description: entry.caption,
          thumbnail: entry.thumbnail,
          views: entry.views,
          likes: entry.likes,
          comments: entry.comments,
          shares: entry.shares,
          saves: entry.saves,
          followerCount: entry.followerCount,
          uploaderHandle: entry.uploaderHandle,
          contentType: entry.contentType,
          category: entry.category,
          monetization: entry.monetization || null,
          productBrand: entry.productBrand || null,
          tags: entry.tags,
          uploadDate: entry.uploadDateISO
            ? Timestamp.fromDate(new Date(entry.uploadDateISO))
            : now,
          addedAt: now,
          addedBy: 'system',
          isActive: true,
        });
      }

      await batch.commit();
      writtenCount += chunk.length;
      console.log(`✅ Wrote batch: ${writtenCount} / ${entries.length}`);
    }

    return res.status(200).json({
      success: true,
      written: writtenCount,
      message: `Seeded ${writtenCount} viral content entries`,
    });
  } catch (error) {
    console.error('❌ Seed error:', error);
    return res.status(500).json({ error: 'Seed failed', details: String(error) });
  }
}

// ─── Utility ─────────────────────────────────────────────
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
