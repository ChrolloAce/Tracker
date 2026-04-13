import authenticatedApiService from './AuthenticatedApiService';

/**
 * CreatorShareLinkService
 *
 * Client wrapper for the creator-share endpoints. The `create` call is
 * authenticated (admin-side minting), while the public `fetchPublic` and
 * `submitVideo` methods are plain fetches — the token is the credential.
 */

export interface CreateShareLinkParams {
  orgId: string;
  projectId: string;
  creatorId: string;
  acceptSubmissions?: boolean;
}

export interface CreateShareLinkResponse {
  success: boolean;
  token: string;
  shareUrl: string;
  existing?: boolean;
}

export interface PublicCreatorShareData {
  project: { name: string; icon: string; color: string };
  creator: { id: string; displayName: string; photoURL: string };
  acceptSubmissions: boolean;
  pendingJobs: number;
  summary: {
    totalAccounts: number;
    totalVideos: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
  };
  accounts: Array<{
    id: string;
    username: string;
    displayName: string;
    platform: string;
    profilePicture: string;
    followerCount: number;
    totalVideos: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
  }>;
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

export interface RevokeShareLinkParams {
  orgId: string;
  // One of these two must be provided:
  token?: string;
  creatorId?: string;
  // Optional: when revoking by creatorId, limit to one project
  projectId?: string;
}

export interface RevokeShareLinkResponse {
  success: boolean;
  revokedCount: number;
  tokens: string[];
}

class CreatorShareLinkService {
  /**
   * Admin-side: mint (or fetch existing) share link for a creator.
   * Authenticated — requires Firebase ID token + org admin role.
   */
  async create(params: CreateShareLinkParams): Promise<CreateShareLinkResponse> {
    return authenticatedApiService.post<CreateShareLinkResponse>(
      '/api/create-creator-share',
      params
    );
  }

  /**
   * Admin-side: soft-delete one or more share links.
   * Sets revoked: true — subsequent reads return 410, submits return 410.
   * Pass { token } for a specific link, or { creatorId } to revoke all of
   * this creator's links across the org (optionally scoped to a project).
   */
  /**
   * Admin-side: update settings on an existing share link (e.g. toggle submissions).
   */
  async update(params: { orgId: string; token: string; acceptSubmissions?: boolean }): Promise<{ success: boolean }> {
    return authenticatedApiService.post<{ success: boolean }>(
      '/api/update-creator-share',
      params
    );
  }

  async revoke(params: RevokeShareLinkParams): Promise<RevokeShareLinkResponse> {
    return authenticatedApiService.post<RevokeShareLinkResponse>(
      '/api/revoke-creator-share',
      params
    );
  }

  /**
   * Public: fetch a share view by token. No auth.
   * Throws on non-OK response; the caller decides how to render errors.
   */
  async fetchPublic(token: string): Promise<PublicCreatorShareData> {
    const res = await fetch(`/api/public-creator-share?token=${encodeURIComponent(token)}`);
    const body = await res.json().catch(() => ({} as any));
    if (!res.ok || !body.success) {
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return body.data as PublicCreatorShareData;
  }

  /**
   * Public: submit a video URL from the share page. No auth — token only.
   * Returns the new job ID on success. Throws on rate limits / errors.
   */
  async submitVideo(token: string, url: string): Promise<{ jobId: string }> {
    const res = await fetch('/api/submit-creator-share-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, url }),
    });
    const body = await res.json().catch(() => ({} as any));
    if (!res.ok || !body.success) {
      throw new Error(body.error || body.message || `HTTP ${res.status}`);
    }
    return { jobId: body.jobId };
  }
}

export default new CreatorShareLinkService();
