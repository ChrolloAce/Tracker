import { TrackedAccount, AccountVideo } from '../../../types/accounts';
import YoutubeAccountService from '../../YoutubeAccountService';
import FirebaseStorageService from '../../FirebaseStorageService';
import { DateFilterService } from '../shared/DateFilterService';

/**
 * YoutubeDiscoveryService
 * 
 * Purpose: Discover new YouTube Shorts
 * Responsibilities:
 * - Fetch latest Shorts using YouTube Data API
 * - Filter out existing videos
 * - Apply date-based filtering
 * - Upload thumbnails to Firebase Storage
 * - Stop at first duplicate (early termination)
 */
export class YoutubeDiscoveryService {
  
  /**
   * Discover new YouTube Shorts (max 10)
   * Stops at first duplicate or video older than oldestVideoDate
   */
  static async discoverNewVideos(
    orgId: string,
    channelId: string,
    account: TrackedAccount,
    existingVideoIds: Set<string>,
    oldestVideoDate: Date | null = null
  ): Promise<AccountVideo[]> {
    const maxResults = 10;

    console.log(`🔍 [YouTube] Fetching latest ${maxResults} Shorts for channel: ${channelId}`);
    const shorts = await YoutubeAccountService.syncChannelShorts(
      channelId,
      account.displayName || account.username,
      maxResults
    );
    
    console.log(`📦 [YouTube] API returned ${shorts.length} Shorts (requested ${maxResults})`);
    if (shorts.length < maxResults) {
      console.warn(`⚠️ [YouTube] Expected ${maxResults} Shorts but only got ${shorts.length} - channel may have fewer videos`);
    }
    
    const newVideos: AccountVideo[] = [];
    let foundDuplicate = false;
    let skippedOld = 0;

    for (const short of shorts) {
      const videoId = short.videoId || '';
      
      // SKIP if already exists and STOP discovery
      if (existingVideoIds.has(videoId)) {
        console.log(`   ✓ Found existing video: ${videoId} - stopping discovery`);
        foundDuplicate = true;
        break;
      }

      // SKIP if older than our oldest video
      const videoUploadDate = short.uploadDate ? new Date(short.uploadDate) : null;
      if (DateFilterService.shouldSkipVideo(videoUploadDate, oldestVideoDate)) {
        console.log(`   ⏭️  Skipping old video: ${videoId}`);
        skippedOld++;
        continue;
      }

      // Upload thumbnail
      let uploadedThumbnail = short.thumbnail;
      if (short.thumbnail) {
        try {
          uploadedThumbnail = await FirebaseStorageService.downloadAndUpload(
            orgId,
            short.thumbnail,
            `yt_${videoId}`,
            'thumbnail'
          );
        } catch (error) {
          console.warn(`⚠️ Failed to upload thumbnail, using original URL`);
        }
      }

      newVideos.push({
        ...short,
        id: `${account.id}_${videoId}`,
        accountId: account.id,
        thumbnail: uploadedThumbnail
      });
      
      console.log(`   ✨ NEW video: ${videoId}`);
    }

    console.log(
      `📊 [YouTube] Discovery complete: ${newVideos.length} new videos` +
      `${foundDuplicate ? ' (stopped at duplicate)' : ''}` +
      `${skippedOld > 0 ? ` (skipped ${skippedOld} old)` : ''}`
    );
    
    return newVideos;
  }
}

