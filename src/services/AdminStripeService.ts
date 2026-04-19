import authenticatedApiService from './AuthenticatedApiService';

/**
 * AdminStripeService
 *
 * Super-admin–gated client wrapper for the Stripe endpoints used inside the Payouts admin UI.
 * Every call here requires a Firebase ID token whose email is in `SUPER_ADMIN_EMAILS` —
 * mirroring the UI gate so a non-admin who crafts a request can't bypass permissions.
 */

export type CreatorStripeStatus = 'none' | 'pending' | 'restricted' | 'complete';

export interface CreatorStripeStatusResult {
  status: CreatorStripeStatus;
  accountId?: string;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  requirements?: {
    currentlyDue: string[];
    disabledReason: string | null;
  };
}

export interface PlatformBalance {
  /** Multi-currency arrays — a platform can hold USD + EUR + GBP simultaneously. Amounts in major units (dollars). */
  available: Array<{ amount: number; currency: string }>;
  pending: Array<{ amount: number; currency: string }>;
  /** True when the API key is live-mode (real money). UI shows a test-mode banner when false. */
  livemode: boolean;
}

export interface StripeConfig {
  /** When false, top-up / onboarding / transfer endpoints return 503. UI should hide or
   *  disable the corresponding buttons and show a banner explaining why. */
  payoutsEnabled: boolean;
  /** True when the server's Stripe key is `sk_test_*`. Shown as a "Test mode" badge in the UI. */
  testMode: boolean;
}

class AdminStripeService {
  /**
   * Fetch live Stripe Connect status for a single creator. Results in one Stripe API call,
   * so call sparingly — e.g. before triggering mark-paid, not on every render.
   */
  async fetchCreatorStatus(params: {
    orgId: string;
    projectId: string;
    creatorId: string;
  }): Promise<CreatorStripeStatusResult> {
    return authenticatedApiService.post<CreatorStripeStatusResult>(
      '/api/stripe/admin-creator-status',
      params,
    );
  }

  /** Current platform balance — available + pending. Cheap call, fine to run on page mount. */
  async fetchPlatformBalance(): Promise<PlatformBalance> {
    return authenticatedApiService.post<PlatformBalance>('/api/stripe/platform-balance', {});
  }

  /** Stripe runtime config — which features are operational. Used to gate UI around states
   *  where live-mode is on but Connect isn't approved yet, so admins don't click through to errors. */
  async fetchConfig(): Promise<StripeConfig> {
    return authenticatedApiService.post<StripeConfig>('/api/stripe/config', {});
  }

  /**
   * Start a hosted Checkout flow to fund the platform balance. Returns a short-lived URL —
   * caller should open it in a new tab so the admin doesn't lose their place.
   */
  async createTopupSession(amount: number, currency = 'usd'): Promise<{ url: string; sessionId: string }> {
    return authenticatedApiService.post<{ url: string; sessionId: string }>(
      '/api/stripe/create-topup-session',
      { amount, currency },
    );
  }

  /**
   * Fire the actual Stripe Transfer for a creator that's already been marked paid.
   * The server re-reads the snapshot from Firestore (source of truth for amount) and uses
   * `paidSnapshot.idempotencyKey` as Stripe's idempotency header — retrying is always safe.
   *
   * Returns:
   *   - Success: `{ transferId, status: 'paid' }` — client writes transferId onto the snapshot
   *   - Failure: throws with the Stripe error message; snapshot stays with `status: 'failed'`
   */
  async transferToCreator(params: {
    orgId: string;
    projectId: string;
    campaignId: string;
    creatorId: string;
  }): Promise<{ transferId: string; status: 'paid'; alreadyTransferred?: boolean }> {
    return authenticatedApiService.post<{ transferId: string; status: 'paid'; alreadyTransferred?: boolean }>(
      '/api/stripe/transfer',
      params,
    );
  }
}

export default new AdminStripeService();
