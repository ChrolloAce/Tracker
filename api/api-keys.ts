/**
 * API Key Management Endpoint
 * POST - Create new API key
 * GET - List API keys for organization
 * DELETE - Revoke an API key
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { createHash, randomBytes } from 'crypto';

const SUPER_ADMIN_EMAILS = ['ernesto@maktubtechnologies.com'];

// ─── Firebase Admin Init (inlined) ───────────────────────
function initFirebase() {
  if (!getApps().length) {
    try {
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
        }),
      });
    } catch (e) {
      console.error('❌ Firebase init failed in api-keys:', e);
    }
  }
}

initFirebase();

// ─── Auth helpers (inlined) ──────────────────────────────
async function authenticateUser(req: VercelRequest): Promise<{ userId: string; email?: string }> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('No authentication token provided');
  }
  const idToken = authHeader.split('Bearer ')[1];
  const decoded = await getAuth().verifyIdToken(idToken);
  return { userId: decoded.uid, email: decoded.email };
}

async function verifyOrgAccess(userId: string, orgId: string): Promise<{ hasAccess: boolean; role?: string }> {
  const db = getFirestore();
  try {
    const memberDoc = await db.collection('organizations').doc(orgId).collection('members').doc(userId).get();
    if (!memberDoc.exists) return { hasAccess: false };
    const data = memberDoc.data();
    if (data?.status !== 'active') return { hasAccess: false };
    return { hasAccess: true, role: data.role };
  } catch {
    return { hasAccess: false };
  }
}

// ─── Key Generation ──────────────────────────────────────
function generateApiKey(): { key: string; hash: string; prefix: string } {
  const pfx = 'vt_live_';
  const randomPart = randomBytes(24).toString('base64url');
  const key = `${pfx}${randomPart}`;
  const hash = createHash('sha256').update(key).digest('hex');
  return { key, hash, prefix: key.substring(0, 12) };
}

// ─── Handler ─────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const db = getFirestore();
    const user = await authenticateUser(req);
    const { orgId, keyId } = req.query;

    if (!orgId || typeof orgId !== 'string') {
      return res.status(400).json({
        success: false,
        error: { message: 'Organization ID required', code: 'MISSING_ORG_ID' },
      });
    }

    // Super admins bypass org access checks
    const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(user.email?.toLowerCase() || '');

    if (!isSuperAdmin) {
      const { hasAccess, role } = await verifyOrgAccess(user.userId, orgId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: { message: 'Access denied to this organization', code: 'FORBIDDEN' },
        });
      }
      if (role !== 'admin' && role !== 'owner') {
        return res.status(403).json({
          success: false,
          error: { message: 'Admin or owner role required', code: 'FORBIDDEN' },
        });
      }
    }

    switch (req.method) {
      case 'POST':
        return await createApiKey(req, res, db, orgId, user.userId);
      case 'GET':
        return await listApiKeys(res, db, orgId);
      case 'DELETE':
        return await revokeApiKey(req, res, db, orgId, user.userId, keyId as string);
      default:
        return res.status(405).json({
          success: false,
          error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
        });
    }
  } catch (error: any) {
    console.error('API Keys error:', error);
    const isAuth = error.message?.includes('authentication') || error.message?.includes('token');
    return res.status(isAuth ? 401 : 500).json({
      success: false,
      error: {
        message: error.message || 'Internal server error',
        code: isAuth ? 'UNAUTHORIZED' : 'INTERNAL_ERROR',
      },
    });
  }
}

// ─── Create ───────────────────────────────────────────────
async function createApiKey(
  req: VercelRequest,
  res: VercelResponse,
  db: FirebaseFirestore.Firestore,
  orgId: string,
  userId: string,
) {
  const body = req.body || {};

  if (!body.name || !body.scopes || !Array.isArray(body.scopes) || body.scopes.length === 0) {
    return res.status(400).json({
      success: false,
      error: { message: 'Name and scopes are required', code: 'VALIDATION_ERROR' },
    });
  }

  const validScopes = [
    'accounts:read', 'accounts:write',
    'videos:read', 'videos:write',
    'analytics:read',
    'projects:read', 'projects:write',
    'organizations:read',
  ];

  for (const scope of body.scopes) {
    if (!validScopes.includes(scope)) {
      return res.status(400).json({
        success: false,
        error: { message: `Invalid scope: ${scope}`, code: 'VALIDATION_ERROR' },
      });
    }
  }

  const { key, hash, prefix } = generateApiKey();

  let expiresAt: Date | null = null;
  if (body.expiresInDays && typeof body.expiresInDays === 'number') {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + body.expiresInDays);
  }

  const docData: Record<string, any> = {
    organizationId: orgId,
    name: body.name,
    keyHash: hash,
    keyPrefix: prefix,
    scopes: body.scopes,
    usageCount: 0,
    rateLimit: body.rateLimit || 100,
    status: 'active',
    createdBy: userId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    expiresAt: expiresAt || null,
  };

  if (body.projectId) {
    docData.projectId = body.projectId;
  }

  const docRef = await db
    .collection('organizations')
    .doc(orgId)
    .collection('apiKeys')
    .add(docData);

  console.log(`✅ Created API key ${prefix}... for org ${orgId}`);

  return res.status(201).json({
    success: true,
    data: {
      id: docRef.id,
      name: body.name,
      key,
      keyPrefix: prefix,
      scopes: body.scopes,
      status: 'active',
      usageCount: 0,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt?.toISOString() || null,
    },
    warning: 'Save this API key now. It will not be shown again.',
  });
}

// ─── List ─────────────────────────────────────────────────
async function listApiKeys(
  res: VercelResponse,
  db: FirebaseFirestore.Firestore,
  orgId: string,
) {
  const snapshot = await db
    .collection('organizations')
    .doc(orgId)
    .collection('apiKeys')
    .orderBy('createdAt', 'desc')
    .get();

  const keys = snapshot.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      name: d.name || '',
      keyPrefix: d.keyPrefix || '',
      scopes: d.scopes || [],
      status: d.status || 'active',
      lastUsedAt: d.lastUsedAt?.toDate?.()?.toISOString() || null,
      usageCount: d.usageCount || 0,
      createdAt: d.createdAt?.toDate?.()?.toISOString() || null,
      expiresAt: d.expiresAt?.toDate?.()?.toISOString() || null,
    };
  });

  return res.status(200).json({
    success: true,
    data: { keys, total: keys.length },
  });
}

// ─── Revoke ───────────────────────────────────────────────
async function revokeApiKey(
  req: VercelRequest,
  res: VercelResponse,
  db: FirebaseFirestore.Firestore,
  orgId: string,
  userId: string,
  keyId?: string,
) {
  const targetKeyId = keyId || req.body?.keyId;

  if (!targetKeyId) {
    return res.status(400).json({
      success: false,
      error: { message: 'Key ID required', code: 'VALIDATION_ERROR' },
    });
  }

  const keyRef = db
    .collection('organizations')
    .doc(orgId)
    .collection('apiKeys')
    .doc(targetKeyId);

  const keyDoc = await keyRef.get();

  if (!keyDoc.exists) {
    return res.status(404).json({
      success: false,
      error: { message: 'API key not found', code: 'NOT_FOUND' },
    });
  }

  await keyRef.update({
    status: 'revoked',
    revokedAt: FieldValue.serverTimestamp(),
    revokedBy: userId,
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`✅ Revoked API key ${targetKeyId} for org ${orgId}`);

  return res.status(200).json({
    success: true,
    message: 'API key revoked successfully',
  });
}
