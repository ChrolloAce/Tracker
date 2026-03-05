/**
 * Client-side service for managing API keys.
 * Calls /api/api-keys with Firebase auth token.
 */

import { getAuth } from 'firebase/auth';
import type {
  ApiKeyResponse,
  ApiKeyCreateResponse,
  ApiKeyScope,
} from '../types/apiKeys';

const BASE = '/api/api-keys';

async function authHeaders(): Promise<HeadersInit> {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

class ApiKeyService {
  /** Safely parse JSON, returning a fallback on failure. */
  private static async safeJson(res: Response): Promise<any> {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(text || `Server returned ${res.status}`);
    }
  }

  /** List all API keys for an organization. */
  static async list(orgId: string): Promise<ApiKeyResponse[]> {
    const res = await fetch(`${BASE}?orgId=${orgId}`, {
      headers: await authHeaders(),
    });
    const json = await this.safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Failed to list keys');
    return json.data.keys;
  }

  /** Create a new API key. Returns the full key ONCE. */
  static async create(
    orgId: string,
    name: string,
    scopes: ApiKeyScope[],
    options?: { projectId?: string; expiresInDays?: number; rateLimit?: number },
  ): Promise<ApiKeyCreateResponse> {
    const res = await fetch(`${BASE}?orgId=${orgId}`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        name,
        scopes,
        projectId: options?.projectId,
        expiresInDays: options?.expiresInDays,
        rateLimit: options?.rateLimit,
      }),
    });
    const json = await this.safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Failed to create key');
    return json.data;
  }

  /** Revoke (deactivate) an API key. */
  static async revoke(orgId: string, keyId: string): Promise<void> {
    const res = await fetch(`${BASE}?orgId=${orgId}&keyId=${keyId}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    });
    const json = await this.safeJson(res);
    if (!json.success) throw new Error(json.error?.message || 'Failed to revoke key');
  }
}

export default ApiKeyService;
