import { auth } from './firebase';

/**
 * Authenticated API Service
 * Automatically includes Firebase ID token in all API requests
 */
class AuthenticatedApiService {
  /**
   * Get the current user's ID token
   */
  private async getIdToken(): Promise<string> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user');
    }
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
   */
  async processVideo(videoId: string, orgId: string, projectId: string) {
    return this.post('/api/process-single-video', {
      videoId,
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

