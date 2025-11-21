/**
 * sync-single-account.ts - LEGACY ENDPOINT (Now delegates to sync-handler.ts)
 * 
 * This file has been refactored to use the new modular sync architecture.
 * The original 2,389 lines of code have been replaced with a thin wrapper
 * that delegates to api/handlers/sync-handler.ts
 * 
 * The new architecture uses:
 * - SyncCoordinator: Orchestrates sync operations
 * - Platform-specific services: InstagramSyncService, TikTokSyncService, etc.
 * - Shared utilities: FirestoreService, ValidationService, LockService, etc.
 * 
 * For implementation details, see:
 * - api/handlers/sync-handler.ts (main handler logic)
 * - api/services/sync/SyncCoordinator.ts (orchestration)
 * - api/services/sync/[platform]/*SyncService.ts (platform logic)
 */

import syncHandler from './handlers/sync-handler.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Delegate to the new modular handler
  return syncHandler(req, res);
}
