/**
 * Utility functions for constructing platform URLs from video data.
 *
 * ViewTrack stores videos with deterministic Firestore document IDs
 * in the format: "{platform}_{accountId}_{rawVideoId}"
 * (see VideoStorageService.saveVideos)
 */

/**
 * Extract the raw platform video ID from ViewTrack's internal ID format.
 *
 * Internal IDs look like:
 *   "tiktok_username_7622190526032366878"
 *   "instagram_username_ABC123"
 *
 * The format is: {platform}_{accountId}_{rawVideoId}
 * We need just the last segment after the second underscore.
 *
 * Because accountId itself can contain underscores, we strip the known
 * "{platform}_" prefix and then take everything after the first remaining
 * underscore as the raw video ID. If the format doesn't match, the
 * original string is returned as a fallback.
 */
export function extractRawVideoId(internalId: string, platform: string): string {
  const prefix = `${platform}_`;
  if (!internalId.startsWith(prefix)) {
    return internalId;
  }

  const withoutPlatform = internalId.slice(prefix.length);
  const firstUnderscore = withoutPlatform.indexOf('_');
  if (firstUnderscore === -1) {
    return internalId;
  }

  return withoutPlatform.slice(firstUnderscore + 1);
}

/**
 * Build the direct URL to a video on its platform.
 *
 * Supported platforms:
 *   tiktok    -> https://tiktok.com/@username/video/rawId
 *   instagram -> https://instagram.com/reel/rawId
 *   youtube   -> https://youtube.com/shorts/rawId
 *   twitter   -> https://x.com/username/status/rawId
 */
export function buildVideoUrl(platform: string, username: string, rawVideoId: string): string {
  switch (platform) {
    case 'tiktok':
      return `https://tiktok.com/@${username}/video/${rawVideoId}`;
    case 'instagram':
      return `https://instagram.com/reel/${rawVideoId}`;
    case 'youtube':
      return `https://youtube.com/shorts/${rawVideoId}`;
    case 'twitter':
      return `https://x.com/${username}/status/${rawVideoId}`;
    default:
      return '';
  }
}

/**
 * Build the URL to an account profile on its platform.
 *
 * Supported platforms:
 *   tiktok    -> https://tiktok.com/@username
 *   instagram -> https://instagram.com/username
 *   youtube   -> https://youtube.com/@username
 *   twitter   -> https://x.com/username
 */
export function buildAccountUrl(platform: string, username: string): string {
  switch (platform) {
    case 'tiktok':
      return `https://tiktok.com/@${username}`;
    case 'instagram':
      return `https://instagram.com/${username}`;
    case 'youtube':
      return `https://youtube.com/@${username}`;
    case 'twitter':
      return `https://x.com/${username}`;
    default:
      return '';
  }
}

const FIREBASE_STORAGE_BUCKET = 'trackview-6a3a5.firebasestorage.app';

/**
 * Build a thumbnail URL for a video.
 *
 * Priority:
 *   1. If the video already has a Firebase Storage URL in its `thumbnail`
 *      field, return it directly.
 *   2. Otherwise construct the expected Firebase Storage public URL using
 *      the deterministic path used by ImageUploadService:
 *        organizations/{orgId}/thumbnails/{platform}_{videoId}_thumb.jpg
 *   3. For YouTube videos without a stored thumbnail, fall back to the
 *      public YouTube thumbnail CDN.
 */
export function buildThumbnailUrl(video: any, orgId: string, projectId: string): string {
  // Already a Firebase Storage URL — use as-is
  if (
    video.thumbnail &&
    (video.thumbnail.includes('firebasestorage.googleapis.com') ||
      video.thumbnail.includes('storage.googleapis.com'))
  ) {
    return video.thumbnail;
  }

  // Construct the deterministic Firebase Storage public URL
  if (video.videoId && video.platform) {
    const storagePath = `organizations/${orgId}/thumbnails/${video.platform}_${video.videoId}_thumb.jpg`;
    return `https://storage.googleapis.com/${FIREBASE_STORAGE_BUCKET}/${storagePath}`;
  }

  // YouTube fallback — public CDN thumbnail
  if (video.platform === 'youtube' && video.videoId) {
    return `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
  }

  return '';
}
