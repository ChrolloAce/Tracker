/**
 * Get the base URL for internal API-to-API dispatch calls.
 *
 * - Production Vercel  → https://www.viewtrack.app
 * - Preview Vercel     → https://{deployment}.vercel.app
 * - Local dev (vercel dev) → http://localhost:3001
 */
export function getBaseUrl(): string {
  if (process.env.VERCEL_ENV === 'production') return 'https://www.viewtrack.app';
  if (process.env.VERCEL_URL) {
    // vercel dev sets VERCEL_URL to localhost — use http, not https
    if (process.env.VERCEL_URL.includes('localhost')) {
      return `http://${process.env.VERCEL_URL}`;
    }
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3001';
}

/**
 * Get the base URL for the frontend app (used for Stripe redirect URLs).
 * In production/preview the frontend and API share the same origin.
 * In local dev the API runs on 3001 but the frontend runs on a different port.
 *
 * Override with FRONTEND_URL env var if the default doesn't match your setup.
 */
export function getFrontendUrl(): string {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;
  if (process.env.VERCEL_ENV === 'production') return 'https://www.viewtrack.app';
  if (process.env.VERCEL_URL) {
    if (process.env.VERCEL_URL.includes('localhost')) {
      return 'http://localhost:3000';
    }
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
}
