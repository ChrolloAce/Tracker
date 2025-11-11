import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { VercelRequest, VercelResponse } from '@vercel/node';

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
 * Set CORS headers for API routes
 */
export function setCorsHeaders(res: VercelResponse, allowedOrigin: string = 'https://viewtrack.app') {
  // In development, allow localhost
  const origin = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3000' 
    : allowedOrigin;
  
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
}

/**
 * Handle OPTIONS preflight requests
 */
export function handleCorsPreFlight(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
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

