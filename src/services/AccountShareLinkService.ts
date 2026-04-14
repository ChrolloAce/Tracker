import authenticatedApiService from './AuthenticatedApiService';

/**
 * AccountShareLinkService
 *
 * Client wrapper for the account-share endpoints. Used by super admins to
 * mint public dashboard links for individual tracked accounts (marketing).
 */

export interface CreateAccountShareParams {
  orgId: string;
  projectId: string;
  accountId: string;
}

export interface CreateAccountShareResponse {
  success: boolean;
  token: string;
  shareUrl: string;
  existing?: boolean;
}

export interface RevokeAccountShareParams {
  orgId: string;
  token?: string;
  accountId?: string;
  projectId?: string;
}

export interface PublicAccountShareData {
  account: {
    username: string;
    displayName: string;
    platform: string;
    profilePicture: string;
    followerCount: number;
    bio: string;
    isVerified: boolean;
  };
  summary: {
    totalVideos: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    avgViews: number;
  };
  videos: Array<{
    id: string;
    url: string;
    platform: string;
    thumbnail: string;
    title: string;
    caption: string;
    uploader: string;
    uploaderHandle: string;
    uploaderProfilePicture: string;
    followerCount: number;
    trackedAccountId: string;
    status: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    duration: number;
    dateSubmitted: string;
    uploadDate: string | null;
    lastRefreshed: string | null;
  }>;
  generatedAt: string;
}

class AccountShareLinkService {
  /** Super admin mint. */
  async create(params: CreateAccountShareParams): Promise<CreateAccountShareResponse> {
    return authenticatedApiService.post<CreateAccountShareResponse>(
      '/api/create-account-share',
      params
    );
  }

  /** Public fetch by token — no auth. */
  async fetchPublic(token: string): Promise<PublicAccountShareData> {
    const res = await fetch(`/api/public-account-share?token=${encodeURIComponent(token)}`);
    const body = await res.json().catch(() => ({} as any));
    if (!res.ok || !body.success) {
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return body.data as PublicAccountShareData;
  }

  /** Super admin revoke. */
  async revoke(params: RevokeAccountShareParams): Promise<{ success: boolean; revokedCount: number; tokens: string[] }> {
    return authenticatedApiService.post(
      '/api/revoke-account-share',
      params
    );
  }
}

export default new AccountShareLinkService();
