/**
 * API Key Management Endpoint
 * POST - Create new API key
 * GET - List API keys for organization
 * DELETE - Revoke an API key
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { createHash, randomBytes } from 'crypto';
import { initializeFirebase } from './utils/firebase-admin';
import { authenticateRequest, verifyOrgAccess } from './middleware/auth';

// ─── Inline types (avoid cross-boundary import issues) ────
interface ApiKeyDoc {
  organizationId: string;
  projectId?: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt?: any;
  usageCount: number;
  rateLimit: number;
  status: string;
  expiresAt?: any;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
  revokedAt?: any;
  revokedBy?: string;
}

const SUPER_ADMIN_EMAILS = ['ernesto@maktubtechnologies.com'];

// Initialize Firebase Admin
try {
  initializeFirebase();
} catch (e) {
  console.error('Failed to init Firebase in api-keys:', e);
}

/**
 * Generate a secure API key
 */
function generateApiKey(): { key: string; hash: string; prefix: string } {
  const pfx = 'vt_live_';
  const randomPart = randomBytes(24).toString('base64url');
  const key = `${pfx}${randomPart}`;
  const hash = createHash('sha256').update(key).digest('hex');
  return { key, hash, prefix: key.substring(0, 12) };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let db: FirebaseFirestore.Firestore;
  try {
    db = getFirestore();
  } catch (e: any) {
    console.error('Firestore init failed:', e);
    return res.status(500).json({ success: false, error: { message: 'Database unavailable', code: 'DB_INIT_ERROR' } });
  }

  try {
    // Authenticate user (requires Firebase auth token)
    const user = await authenticateRequest(req);
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
          error: { message: 'Admin or owner role required to manage API keys', code: 'FORBIDDEN' },
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
      key, // Full key — only shown once!
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
