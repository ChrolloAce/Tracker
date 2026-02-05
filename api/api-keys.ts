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
import type { ApiKey, ApiKeyCreateRequest, ApiKeyResponse, ApiKeyCreateResponse } from '../src/types/apiKeys';

// Initialize Firebase Admin
initializeFirebase();
const db = getFirestore();

/**
 * Generate a secure API key
 */
function generateApiKey(isTest: boolean = false): { key: string; hash: string; prefix: string } {
  const prefix = isTest ? 'vt_test_' : 'vt_live_';
  const randomPart = randomBytes(24).toString('base64url');
  const key = `${prefix}${randomPart}`;
  const hash = createHash('sha256').update(key).digest('hex');
  return { key, hash, prefix: key.substring(0, 12) };
}

/**
 * Format API key for response (hide sensitive data)
 */
function formatApiKeyResponse(key: ApiKey): ApiKeyResponse {
  return {
    id: key.id,
    name: key.name,
    keyPrefix: key.keyPrefix,
    scopes: key.scopes,
    status: key.status,
    lastUsedAt: key.lastUsedAt,
    usageCount: key.usageCount,
    createdAt: key.createdAt,
    expiresAt: key.expiresAt
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Authenticate user (requires Firebase auth token)
    const user = await authenticateRequest(req);
    const { orgId, keyId } = req.query;
    
    if (!orgId || typeof orgId !== 'string') {
      return res.status(400).json({
        success: false,
        error: { message: 'Organization ID required', code: 'MISSING_ORG_ID' }
      });
    }
    
    // Verify user has access to org
    const { hasAccess, role } = await verifyOrgAccess(user.userId, orgId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: { message: 'Access denied to this organization', code: 'FORBIDDEN' }
      });
    }
    
    // Only admins/owners can manage API keys
    if (role !== 'admin' && role !== 'owner') {
      return res.status(403).json({
        success: false,
        error: { message: 'Admin or owner role required to manage API keys', code: 'FORBIDDEN' }
      });
    }

    switch (req.method) {
      case 'POST':
        return await createApiKey(req, res, orgId, user.userId);
      case 'GET':
        return await listApiKeys(res, orgId);
      case 'DELETE':
        return await revokeApiKey(req, res, orgId, user.userId, keyId as string);
      default:
        return res.status(405).json({
          success: false,
          error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }
        });
    }
  } catch (error: any) {
    console.error('API Keys error:', error);
    return res.status(error.message?.includes('authentication') ? 401 : 500).json({
      success: false,
      error: {
        message: error.message || 'Internal server error',
        code: error.message?.includes('authentication') ? 'UNAUTHORIZED' : 'INTERNAL_ERROR'
      }
    });
  }
}

/**
 * Create a new API key
 */
async function createApiKey(
  req: VercelRequest,
  res: VercelResponse,
  orgId: string,
  userId: string
) {
  const body = req.body as ApiKeyCreateRequest;
  
  if (!body.name || !body.scopes || body.scopes.length === 0) {
    return res.status(400).json({
      success: false,
      error: { message: 'Name and scopes are required', code: 'VALIDATION_ERROR' }
    });
  }
  
  // Validate scopes
  const validScopes = [
    'accounts:read', 'accounts:write',
    'videos:read', 'videos:write',
    'analytics:read',
    'projects:read', 'projects:write',
    'organizations:read'
  ];
  
  for (const scope of body.scopes) {
    if (!validScopes.includes(scope)) {
      return res.status(400).json({
        success: false,
        error: { message: `Invalid scope: ${scope}`, code: 'VALIDATION_ERROR' }
      });
    }
  }
  
  // Generate the key
  const { key, hash, prefix } = generateApiKey(false);
  
  // Calculate expiration
  let expiresAt: Date | undefined;
  if (body.expiresInDays) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + body.expiresInDays);
  }
  
  // Create the API key document
  const keyDoc: Omit<ApiKey, 'id'> = {
    organizationId: orgId,
    projectId: body.projectId,
    name: body.name,
    keyHash: hash,
    keyPrefix: prefix,
    scopes: body.scopes,
    lastUsedAt: undefined,
    usageCount: 0,
    rateLimit: body.rateLimit || 100, // Default 100 req/min
    status: 'active',
    expiresAt,
    createdBy: userId,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  const docRef = await db
    .collection('organizations')
    .doc(orgId)
    .collection('apiKeys')
    .add({
      ...keyDoc,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: expiresAt || null
    });
  
  // Return the full key (only time it's shown!)
  const response: ApiKeyCreateResponse = {
    id: docRef.id,
    name: body.name,
    key, // Full key - only shown once!
    keyPrefix: prefix,
    scopes: body.scopes,
    status: 'active',
    usageCount: 0,
    createdAt: new Date(),
    expiresAt
  };
  
  console.log(`✅ Created API key ${prefix}... for org ${orgId}`);
  
  return res.status(201).json({
    success: true,
    data: response,
    warning: 'Save this API key now. It will not be shown again.'
  });
}

/**
 * List all API keys for organization
 */
async function listApiKeys(res: VercelResponse, orgId: string) {
  const keysSnapshot = await db
    .collection('organizations')
    .doc(orgId)
    .collection('apiKeys')
    .orderBy('createdAt', 'desc')
    .get();
  
  const keys: ApiKeyResponse[] = keysSnapshot.docs.map(doc => {
    const data = doc.data() as ApiKey;
    return formatApiKeyResponse({
      ...data,
      id: doc.id,
      createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt as any),
      lastUsedAt: data.lastUsedAt?.toDate?.() || (data.lastUsedAt ? new Date(data.lastUsedAt as any) : undefined),
      expiresAt: data.expiresAt?.toDate?.() || (data.expiresAt ? new Date(data.expiresAt as any) : undefined)
    });
  });
  
  return res.status(200).json({
    success: true,
    data: { keys, total: keys.length }
  });
}

/**
 * Revoke an API key
 */
async function revokeApiKey(
  req: VercelRequest,
  res: VercelResponse,
  orgId: string,
  userId: string,
  keyId?: string
) {
  const targetKeyId = keyId || req.body?.keyId;
  
  if (!targetKeyId) {
    return res.status(400).json({
      success: false,
      error: { message: 'Key ID required', code: 'VALIDATION_ERROR' }
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
      error: { message: 'API key not found', code: 'NOT_FOUND' }
    });
  }
  
  await keyRef.update({
    status: 'revoked',
    revokedAt: FieldValue.serverTimestamp(),
    revokedBy: userId,
    updatedAt: FieldValue.serverTimestamp()
  });
  
  console.log(`✅ Revoked API key ${targetKeyId} for org ${orgId}`);
  
  return res.status(200).json({
    success: true,
    message: 'API key revoked successfully'
  });
}
