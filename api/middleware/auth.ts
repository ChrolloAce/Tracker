import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SUPER_ADMIN_EMAILS } from '../constants/admin-emails.js';

// Ensure Firebase Admin is initialized before any auth operations
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

export interface AuthenticatedUser {
  userId: string;
  email?: string;
}

/**
 * Authenticate request using Firebase ID token
 * Extracts and verifies the token from Authorization header
 */
export async function authenticateRequest(req: VercelRequest): Promise<AuthenticatedUser> {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('No authentication token provided');
  }

  const idToken = authHeader.split('Bearer ')[1];
  
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    
    return {
      userId: decodedToken.uid,
      email: decodedToken.email
    };
  } catch (error: any) {
    throw new Error(`Invalid authentication token: ${error.message}`);
  }
}

/**
 * Verify user has access to an organization
 */
export async function verifyOrgAccess(
  userId: string, 
  orgId: string
): Promise<{ hasAccess: boolean; role?: string }> {
  const db = getFirestore();
  
  try {
    const memberDoc = await db
      .collection('organizations')
      .doc(orgId)
      .collection('members')
      .doc(userId)
      .get();
    
    if (!memberDoc.exists) {
      return { hasAccess: false };
    }
    
    const memberData = memberDoc.data();
    if (memberData?.status !== 'active') {
      return { hasAccess: false };
    }
    
    return {
      hasAccess: true,
      role: memberData.role
    };
  } catch (error) {
    console.error('Error verifying org access:', error);
    return { hasAccess: false };
  }
}

/**
 * Combined middleware: Authenticate and verify org access
 */
export async function authenticateAndVerifyOrg(
  req: VercelRequest,
  orgId: string
): Promise<{ user: AuthenticatedUser; role: string }> {
  const user = await authenticateRequest(req);
  const { hasAccess, role } = await verifyOrgAccess(user.userId, orgId);
  
  if (!hasAccess) {
    throw new Error('Access denied to this organization');
  }
  
  return { user, role: role || 'member' };
}

/**
 * Check if an origin is allowed for CORS
 */
function isAllowedOrigin(origin: string | undefined): string | null {
  if (!origin) return null;

  // Production domains
  if (origin === 'https://viewtrack.app' || origin === 'https://www.viewtrack.app') {
    return origin;
  }

  // Vercel preview deployments (e.g. tracker-abc123.vercel.app)
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) {
    return origin;
  }

  // Local development
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) {
    return origin;
  }

  return null;
}

/**
 * Set CORS headers for API routes
 * Pass the request so the Origin header can be checked dynamically.
 */
export function setCorsHeaders(res: VercelResponse, req?: VercelRequest) {
  const requestOrigin = req?.headers?.origin as string | undefined;
  const allowed = isAllowedOrigin(requestOrigin);

  // Use the matched origin so the browser accepts the response,
  // or fall back to the production domain for non-browser callers.
  const origin = allowed || 'https://viewtrack.app';

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
}

/**
 * Handle OPTIONS preflight requests
 */
export function handleCorsPreFlight(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res, req);
    res.status(200).end();
    return true;
  }
  return false;
}

/**
 * Validate required fields in request body
 */
export function validateRequiredFields(
  body: any,
  requiredFields: string[]
): { valid: boolean; missing?: string[] } {
  const missing = requiredFields.filter(field => !body[field]);

  if (missing.length > 0) {
    return { valid: false, missing };
  }

  return { valid: true };
}

/**
 * Authenticate a super admin request.
 * Verifies the Firebase ID token from the Authorization header
 * and checks that the token's email is in the SUPER_ADMIN_EMAILS list.
 */
export async function authenticateSuperAdmin(req: VercelRequest): Promise<AuthenticatedUser> {
  const user = await authenticateRequest(req);

  if (!user.email || !SUPER_ADMIN_EMAILS.map(e => e.toLowerCase()).includes(user.email.toLowerCase())) {
    throw new Error('Unauthorized - Super admin access required');
  }

  return user;
}

