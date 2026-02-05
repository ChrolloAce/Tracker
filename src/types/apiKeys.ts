/**
 * API Key types for ViewTrack Public API
 */

export interface ApiKey {
  id: string;
  organizationId: string;
  projectId?: string; // Optional - if set, key is scoped to specific project
  
  // Key details
  name: string;
  keyHash: string; // SHA-256 hash of the actual key (never store plaintext)
  keyPrefix: string; // First 8 chars for identification (e.g., "vt_live_")
  
  // Permissions
  scopes: ApiKeyScope[];
  
  // Usage tracking
  lastUsedAt?: Date;
  usageCount: number;
  
  // Rate limiting
  rateLimit: number; // Requests per minute
  
  // Status
  status: 'active' | 'revoked' | 'expired';
  expiresAt?: Date;
  
  // Metadata
  createdBy: string; // User ID who created the key
  createdAt: Date;
  updatedAt: Date;
  revokedAt?: Date;
  revokedBy?: string;
}

export type ApiKeyScope = 
  | 'accounts:read'
  | 'accounts:write'
  | 'videos:read'
  | 'videos:write'
  | 'analytics:read'
  | 'projects:read'
  | 'projects:write'
  | 'organizations:read';

export interface ApiKeyCreateRequest {
  name: string;
  projectId?: string;
  scopes: ApiKeyScope[];
  expiresInDays?: number;
  rateLimit?: number;
}

export interface ApiKeyResponse {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  status: 'active' | 'revoked' | 'expired';
  lastUsedAt?: Date;
  usageCount: number;
  createdAt: Date;
  expiresAt?: Date;
}

// The full key is only returned once on creation
export interface ApiKeyCreateResponse extends ApiKeyResponse {
  key: string; // Full API key - only shown once!
}

export interface ApiRateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: Date;
}

export interface AuthenticatedApiRequest {
  apiKey: ApiKey;
  organizationId: string;
  projectId?: string;
}
