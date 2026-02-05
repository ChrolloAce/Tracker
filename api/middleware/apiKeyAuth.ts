/**
 * API Key Authentication Middleware
 * Validates x-api-key header and enforces rate limits
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { createHash } from 'crypto';
import { initializeFirebase } from '../utils/firebase-admin';
import type { ApiKey, ApiKeyScope, AuthenticatedApiRequest } from '../../src/types/apiKeys';

// Initialize Firebase Admin
initializeFirebase();
const db = getFirestore();

// In-memory rate limit cache (resets on cold start)
const rateLimitCache = new Map<string, { count: number; resetAt: number }>();

/**
 * Hash an API key for comparison
 */
function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Check rate limit for an API key
 */
function checkRateLimit(keyId: string, limit: number): { allowed: boolean; remaining: number; resetAt: Date } {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  
  let entry = rateLimitCache.get(keyId);
  
  // Reset if window expired
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    rateLimitCache.set(keyId, entry);
  }
  
  const remaining = Math.max(0, limit - entry.count);
  const resetAt = new Date(entry.resetAt);
  
  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt };
  }
  
  entry.count++;
  return { allowed: true, remaining: remaining - 1, resetAt };
}

/**
 * Authenticate request using API key
 */
export async function authenticateApiKey(
  req: VercelRequest,
  requiredScopes: ApiKeyScope[] = []
): Promise<AuthenticatedApiRequest> {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    throw new ApiAuthError('API key required. Provide x-api-key header.', 401);
  }
  
  // Validate key format (vt_live_xxx or vt_test_xxx)
  if (!apiKey.startsWith('vt_live_') && !apiKey.startsWith('vt_test_')) {
    throw new ApiAuthError('Invalid API key format', 401);
  }
  
  const keyHash = hashApiKey(apiKey);
  const keyPrefix = apiKey.substring(0, 12);
  
  // Find the API key in Firestore
  const keysSnapshot = await db
    .collectionGroup('apiKeys')
    .where('keyHash', '==', keyHash)
    .where('status', '==', 'active')
    .limit(1)
    .get();
  
  if (keysSnapshot.empty) {
    throw new ApiAuthError('Invalid or revoked API key', 401);
  }
  
  const keyDoc = keysSnapshot.docs[0];
  const keyData = keyDoc.data() as ApiKey;
  
  // Check expiration
  if (keyData.expiresAt && new Date(keyData.expiresAt) < new Date()) {
    throw new ApiAuthError('API key has expired', 401);
  }
  
  // Check rate limit
  const rateCheck = checkRateLimit(keyData.id, keyData.rateLimit);
  if (!rateCheck.allowed) {
    throw new ApiAuthError(
      `Rate limit exceeded. Try again after ${rateCheck.resetAt.toISOString()}`,
      429,
      { retryAfter: Math.ceil((rateCheck.resetAt.getTime() - Date.now()) / 1000) }
    );
  }
  
  // Check required scopes
  for (const scope of requiredScopes) {
    if (!keyData.scopes.includes(scope)) {
      throw new ApiAuthError(
        `Missing required scope: ${scope}. Your key has: ${keyData.scopes.join(', ')}`,
        403
      );
    }
  }
  
  // Update usage stats (non-blocking)
  keyDoc.ref.update({
    lastUsedAt: FieldValue.serverTimestamp(),
    usageCount: FieldValue.increment(1)
  }).catch(err => console.error('Failed to update API key usage:', err));
  
  return {
    apiKey: keyData,
    organizationId: keyData.organizationId,
    projectId: keyData.projectId
  };
}

/**
 * Custom error class for API authentication errors
 */
export class ApiAuthError extends Error {
  statusCode: number;
  details?: Record<string, any>;
  
  constructor(message: string, statusCode: number = 401, details?: Record<string, any>) {
    super(message);
    this.name = 'ApiAuthError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Set rate limit headers on response
 */
export function setRateLimitHeaders(
  res: VercelResponse,
  keyId: string,
  limit: number
): void {
  const entry = rateLimitCache.get(keyId);
  if (entry) {
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));
  }
}

/**
 * Set CORS headers for public API
 */
export function setPublicApiCorsHeaders(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'x-api-key, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

/**
 * Handle API errors consistently
 */
export function handleApiError(res: VercelResponse, error: unknown): void {
  console.error('API Error:', error);
  
  if (error instanceof ApiAuthError) {
    const response: any = {
      success: false,
      error: {
        message: error.message,
        code: error.statusCode === 401 ? 'UNAUTHORIZED' : 
              error.statusCode === 403 ? 'FORBIDDEN' : 
              error.statusCode === 429 ? 'RATE_LIMITED' : 'ERROR'
      }
    };
    
    if (error.details?.retryAfter) {
      res.setHeader('Retry-After', error.details.retryAfter);
      response.error.retryAfter = error.details.retryAfter;
    }
    
    return res.status(error.statusCode).json(response);
  }
  
  const message = error instanceof Error ? error.message : 'Internal server error';
  return res.status(500).json({
    success: false,
    error: {
      message,
      code: 'INTERNAL_ERROR'
    }
  });
}

/**
 * Wrapper for API handlers with authentication
 */
export function withApiAuth(
  requiredScopes: ApiKeyScope[],
  handler: (
    req: VercelRequest,
    res: VercelResponse,
    auth: AuthenticatedApiRequest
  ) => Promise<void>
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    // Handle CORS preflight
    setPublicApiCorsHeaders(res);
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    try {
      const auth = await authenticateApiKey(req, requiredScopes);
      setRateLimitHeaders(res, auth.apiKey.id, auth.apiKey.rateLimit);
      await handler(req, res, auth);
    } catch (error) {
      handleApiError(res, error);
    }
  };
}
