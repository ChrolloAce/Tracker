import { auth } from './firebase';

/**
 * Authenticated API Service
 * Automatically includes Firebase ID token in all API requests
 */
class AuthenticatedApiService {
  /**
   * Wait for auth to be ready and get the current user's ID token
   * Fixes intermittent "No authenticated user" errors when auth hasn't initialized yet
   */
  private async getIdToken(): Promise<string> {
    // Wait for auth to be ready (max 5 seconds)
    const maxWait = 5000;
    const startTime = Date.now();
    
    while (!auth.currentUser && (Date.now() - startTime) < maxWait) {
      console.log('⏳ Waiting for Firebase auth to be ready...');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user after waiting 5s - please refresh and try again');
    }
    
    console.log(`✅ Auth ready: ${user.email}`);
    return await user.getIdToken();
  }

  /**
   * Make an authenticated POST request
   */
  async post<T = any>(
    endpoint: string,
    data: any,
    options?: RequestInit
  ): Promise<T> {
    const idToken = await this.getIdToken();

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
        ...options?.headers,
      },
      body: JSON.stringify(data),
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ 
        error: `HTTP ${response.status}: ${response.statusText}` 
      }));
      throw new Error(error.message || error.error || 'Request failed');
    }

    return await response.json();
  }

  /**
   * Make an authenticated GET request
   */
  async get<T = any>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const idToken = await this.getIdToken();

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ 
        error: `HTTP ${response.status}: ${response.statusText}` 
      }));
      throw new Error(error.message || error.error || 'Request failed');
    }

    return await response.json();
  }

  /**
   * Sync a single account (authenticated)
   */
  async syncAccount(accountId: string, orgId: string, projectId: string) {
    return this.post('/api/sync-single-account', {
      accountId,
      orgId,
      projectId,
    });
  }

  /**
   * Process a single video (authenticated)
   * Queues video for high-priority processing through the job queue
   */
  async processVideo(videoId: string, orgId: string, projectId: string) {
    return this.post('/api/queue-manual-video', {
      url: videoId, // videoId is actually the URL
      orgId,
      projectId,
    });
  }

  /**
   * Refresh account videos (authenticated)
   */
  async refreshAccount(accountId: string, orgId: string, projectId: string) {
    return this.post('/api/refresh-account', {
      accountId,
      orgId,
      projectId,
    });
  }
}

// Export singleton instance
export default new AuthenticatedApiService();

