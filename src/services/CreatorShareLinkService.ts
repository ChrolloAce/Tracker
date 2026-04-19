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

/** One row in the creator's "My payouts" section on the public portal. */
export interface CreatorPayoutSummary {
  campaignId: string;
  campaignName: string;
  campaignDescription: string;
  campaignStatus: 'draft' | 'active' | 'completed';
  campaignCreatedAt: string;
  status: 'not_calculated' | 'pending' | 'approved' | 'paid';
  amount: number | null;
  currency: string;
  note?: string;
  structureName?: string;
  /** Human-readable deal terms — server-generated. UI should render as bullets.
   *  Empty means the structure was missing/malformed; show a generic fallback. */
  dealSummary: string[];
  /** When status === 'paid' — ISO string of when the admin clicked Pay. */
  paidAt?: string;
  /** When status === 'paid' — immutable paid amount from the snapshot (may differ from `amount`
   *  if the underlying structure/videos change after payment, which is why we freeze it). */
  paidAmount?: number;
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
  /** Fetch a creator's payout summaries for their public share page. Read-only. */
  async fetchPayouts(token: string): Promise<{ payouts: CreatorPayoutSummary[] }> {
    const res = await fetch('/api/public-creator-payouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const body = await res.json().catch(() => ({} as any));
    if (!res.ok || !body.success) {
      throw new Error(body.error || body.message || `HTTP ${res.status}`);
    }
    return { payouts: body.payouts || [] };
  }

  /**
   * Public: start Stripe Connect onboarding for the creator behind this share token.
   * Returns a short-lived hosted URL — always open in a new tab.
   */
  async startStripeOnboarding(token: string): Promise<{ onboardingUrl: string; accountId: string }> {
    const res = await fetch('/api/stripe/creator-onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const body = await res.json().catch(() => ({} as any));
    if (!res.ok || !body.success) {
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return { onboardingUrl: body.onboardingUrl, accountId: body.accountId };
  }

  /** Public: current Stripe Connect status for this creator — drives portal UI state. */
  async fetchStripeStatus(token: string): Promise<{
    status: 'none' | 'pending' | 'restricted' | 'complete';
    detailsSubmitted: boolean;
    payoutsEnabled: boolean;
    chargesEnabled: boolean;
    requirements?: { currentlyDue: string[]; disabledReason: string | null };
  }> {
    const res = await fetch('/api/stripe/creator-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const body = await res.json().catch(() => ({} as any));
    if (!res.ok || !body.success) {
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return {
      status: body.status,
      detailsSubmitted: body.detailsSubmitted,
      payoutsEnabled: body.payoutsEnabled,
      chargesEnabled: body.chargesEnabled,
      requirements: body.requirements,
    };
  }

  async submitVideo(
    token: string,
    url: string,
    opts?: { crossPostGroupId?: string },
  ): Promise<{ jobId: string }> {
    const body: Record<string, unknown> = { token, url };
    if (opts?.crossPostGroupId) body.crossPostGroupId = opts.crossPostGroupId;
    const res = await fetch('/api/submit-creator-share-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const resBody = await res.json().catch(() => ({} as any));
    if (!res.ok || !resBody.success) {
      throw new Error(resBody.error || resBody.message || `HTTP ${res.status}`);
    }
    return { jobId: resBody.jobId };
  }
}

export default new CreatorShareLinkService();
