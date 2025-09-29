import { VideoSubmission, VideoSnapshot } from '../types';

interface MetricsDelta {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  timeSpan: number; // in milliseconds
}

interface DateRange {
  startDate: Date;
  endDate: Date;
}

class SnapshotService {
  /**
   * Create initial snapshot when video is first uploaded
   */
  static createInitialSnapshot(video: VideoSubmission): VideoSnapshot {
    // Use the video's upload date for the snapshot, not the current date
    // This ensures the snapshot is tied to when the video was actually posted
    const snapshotDate = video.uploadDate 
      ? new Date(video.uploadDate)
      : video.timestamp 
      ? new Date(video.timestamp)
      : new Date(); // Fallback to current date if neither is available
    
    const snapshot: VideoSnapshot = {
      id: `${video.id}_${Date.now()}`,
      videoId: video.id,
      views: video.views,
      likes: video.likes,
      comments: video.comments,
      shares: video.shares || 0,
      capturedAt: snapshotDate,
      capturedBy: 'initial_upload'
    };

    console.log(`📸 Created initial snapshot for video "${video.title.substring(0, 30)}..." at ${snapshotDate.toLocaleDateString()}:`, {
      views: snapshot.views,
      likes: snapshot.likes,
      comments: snapshot.comments,
      shares: snapshot.shares
    });

    return snapshot;
  }

  /**
   * Create refresh snapshot with current metrics
   */
  static createRefreshSnapshot(video: VideoSubmission, currentMetrics: {
    views: number;
    likes: number;
    comments: number;
    shares?: number;
  }): VideoSnapshot {
    const snapshot: VideoSnapshot = {
      id: `${video.id}_${Date.now()}`,
      videoId: video.id,
      views: currentMetrics.views,
      likes: currentMetrics.likes,
      comments: currentMetrics.comments,
      shares: currentMetrics.shares || 0,
      capturedAt: new Date(),
      capturedBy: 'manual_refresh'
    };

    console.log(`📸 Created refresh snapshot for video "${video.title.substring(0, 30)}...":`, {
      views: snapshot.views,
      likes: snapshot.likes,
      comments: snapshot.comments,
      shares: snapshot.shares
    });

    return snapshot;
  }

  /**
   * Add snapshot to video's snapshot history
   */
  static addSnapshotToVideo(video: VideoSubmission, snapshot: VideoSnapshot): VideoSubmission {
    const updatedVideo = { ...video };
    
    if (!updatedVideo.snapshots) {
      updatedVideo.snapshots = [];
    }

    updatedVideo.snapshots.push(snapshot);
    updatedVideo.lastRefreshed = new Date();

    // Update current metrics to latest snapshot values
    updatedVideo.views = snapshot.views;
    updatedVideo.likes = snapshot.likes;
    updatedVideo.comments = snapshot.comments;
    updatedVideo.shares = snapshot.shares;

    console.log(`💾 Added snapshot to video. Total snapshots: ${updatedVideo.snapshots.length}`);
    
    return updatedVideo;
  }

  /**
   * Get snapshots within a specific date range
   */
  static getSnapshotsInRange(video: VideoSubmission, dateRange: DateRange): VideoSnapshot[] {
    if (!video.snapshots || video.snapshots.length === 0) {
      return [];
    }

    return video.snapshots.filter(snapshot => {
      const snapshotDate = new Date(snapshot.capturedAt);
      return snapshotDate >= dateRange.startDate && snapshotDate <= dateRange.endDate;
    });
  }

  /**
   * Calculate metrics growth within a date range
   */
  static calculateGrowthInRange(video: VideoSubmission, dateRange: DateRange): MetricsDelta {
    const snapshots = this.getSnapshotsInRange(video, dateRange);
    
    if (snapshots.length === 0) {
      return {
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        timeSpan: 0
      };
    }

    // Sort snapshots by date
    snapshots.sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());
    
    const firstSnapshot = snapshots[0];
    const lastSnapshot = snapshots[snapshots.length - 1];
    
    const delta: MetricsDelta = {
      views: lastSnapshot.views - firstSnapshot.views,
      likes: lastSnapshot.likes - firstSnapshot.likes,
      comments: lastSnapshot.comments - firstSnapshot.comments,
      shares: (lastSnapshot.shares || 0) - (firstSnapshot.shares || 0),
      timeSpan: new Date(lastSnapshot.capturedAt).getTime() - new Date(firstSnapshot.capturedAt).getTime()
    };

    console.log(`📊 Growth calculation for "${video.title.substring(0, 30)}..." in range:`, {
      period: `${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()}`,
      snapshots: snapshots.length,
      viewsGrowth: delta.views,
      likesGrowth: delta.likes,
      commentsGrowth: delta.comments,
      sharesGrowth: delta.shares
    });

    return delta;
  }

  /**
   * Get the closest snapshot to a specific date (for baseline calculations)
   */
  static getClosestSnapshot(video: VideoSubmission, targetDate: Date): VideoSnapshot | null {
    if (!video.snapshots || video.snapshots.length === 0) {
      return null;
    }

    let closestSnapshot = video.snapshots[0];
    let minDifference = Math.abs(new Date(closestSnapshot.capturedAt).getTime() - targetDate.getTime());

    for (const snapshot of video.snapshots) {
      const difference = Math.abs(new Date(snapshot.capturedAt).getTime() - targetDate.getTime());
      if (difference < minDifference) {
        minDifference = difference;
        closestSnapshot = snapshot;
      }
    }

    return closestSnapshot;
  }

  /**
   * Calculate total growth across multiple videos for a date range
   */
  static calculateTotalGrowthForVideos(videos: VideoSubmission[], dateRange: DateRange): {
    totalViewsGrowth: number;
    totalLikesGrowth: number;
    totalCommentsGrowth: number;
    totalSharesGrowth: number;
    videosWithGrowth: number;
  } {
    let totalViewsGrowth = 0;
    let totalLikesGrowth = 0;
    let totalCommentsGrowth = 0;
    let totalSharesGrowth = 0;
    let videosWithGrowth = 0;

    for (const video of videos) {
      const growth = this.calculateGrowthInRange(video, dateRange);
      
      if (growth.timeSpan > 0) { // Only count videos that have snapshots in the range
        totalViewsGrowth += growth.views;
        totalLikesGrowth += growth.likes;
        totalCommentsGrowth += growth.comments;
        totalSharesGrowth += growth.shares;
        videosWithGrowth++;
      }
    }

    console.log(`📈 Total growth across ${videosWithGrowth} videos:`, {
      period: `${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()}`,
      totalViewsGrowth,
      totalLikesGrowth,
      totalCommentsGrowth,
      totalSharesGrowth
    });

    return {
      totalViewsGrowth,
      totalLikesGrowth,
      totalCommentsGrowth,
      totalSharesGrowth,
      videosWithGrowth
    };
  }

  /**
   * Clean up old snapshots (keep only last N snapshots per video)
   */
  static cleanupOldSnapshots(video: VideoSubmission, maxSnapshots: number = 50): VideoSubmission {
    if (!video.snapshots || video.snapshots.length <= maxSnapshots) {
      return video;
    }

    const updatedVideo = { ...video };
    
    // Ensure snapshots array exists and sort by date, keeping the most recent snapshots
    if (updatedVideo.snapshots) {
      updatedVideo.snapshots.sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
      updatedVideo.snapshots = updatedVideo.snapshots.slice(0, maxSnapshots);
    }

    console.log(`🧹 Cleaned up snapshots for "${video.title.substring(0, 30)}...". Kept ${maxSnapshots} most recent.`);
    
    return updatedVideo;
  }
}

export default SnapshotService;
