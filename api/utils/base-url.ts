/**
 * Get the base URL for internal API-to-API dispatch calls.
 *
 * - Production Vercel  → https://www.viewtrack.app
 * - Preview Vercel     → https://{deployment}.vercel.app
 * - Local dev (vercel dev) → http://localhost:3001
 */
export function getBaseUrl(): string {
  if (process.env.VERCEL_ENV === 'production') return 'https://www.viewtrack.app';
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3001';
}
