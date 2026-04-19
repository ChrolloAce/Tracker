/**
 * Server-side super-admin gate.
 *
 * The Payouts feature (and by extension Stripe Connect) is restricted to the emails in
 * `SUPER_ADMIN_EMAILS` while we dogfood it inside the Maktub org. This helper verifies:
 *   1. The request has a valid Firebase ID token in the Authorization header
 *   2. The decoded token's email is in the super-admin list
 *
 * Endpoints call this at the top; it either returns the authenticated user or writes a 401/403
 * response and returns null — caller should `return` immediately on null.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, type AuthenticatedUser } from '../_middleware/auth.js';
import { SUPER_ADMIN_EMAILS } from '../_constants/admin-emails.js';

/**
 * Writes a 401/403 and returns null if the caller isn't a super-admin, otherwise returns the user.
 * Always check for `null` and `return` — don't proceed with business logic.
 */
export async function requireSuperAdmin(
  req: VercelRequest,
  res: VercelResponse,
): Promise<AuthenticatedUser | null> {
  let user: AuthenticatedUser;
  try {
    user = await authenticateRequest(req);
  } catch (err: any) {
    res.status(401).json({ error: err?.message || 'Not authenticated' });
    return null;
  }
  if (!user.email || !SUPER_ADMIN_EMAILS.includes(user.email)) {
    // Deliberately 403, not 404 — we want the caller to know they're authenticated but
    // lack permission, not to expose whether the endpoint exists at all.
    res.status(403).json({ error: 'Forbidden — payouts is restricted to Maktub super-admins.' });
    return null;
  }
  return user;
}
