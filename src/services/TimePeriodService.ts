import { VideoSubmission } from '../types';
import { TimePeriodType } from '../components/TimePeriodSelector';

interface PeriodData {
  period: string;
  date: Date;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  videoCount: number;
}

interface DateRange {
  startDate: Date;
  endDate: Date;
}

export class TimePeriodService {
  static generateTimeSeriesData(
    submissions: VideoSubmission[],
    timePeriod: TimePeriodType,
    dateRange?: DateRange
  ): PeriodData[] {
    if (submissions.length === 0) return [];

    // Sort submissions by upload date
    const sortedSubmissions = [...submissions].sort((a, b) => {
      const dateA = new Date(a.uploadDate || a.timestamp || a.dateSubmitted);
      const dateB = new Date(b.uploadDate || b.timestamp || b.dateSubmitted);
      return dateA.getTime() - dateB.getTime();
    });

    // If date range is provided, use it; otherwise find from submissions
    let earliestDate: Date;
    let latestDate: Date;
    
    if (dateRange) {
      earliestDate = dateRange.startDate;
      latestDate = dateRange.endDate;
      console.log(`📊 Using provided date range for graphs: ${earliestDate.toLocaleDateString()} to ${latestDate.toLocaleDateString()}`);
    } else {
      // Find the earliest date from either upload dates or snapshot dates
      earliestDate = new Date(sortedSubmissions[0].uploadDate || sortedSubmissions[0].timestamp || sortedSubmissions[0].dateSubmitted);
      latestDate = new Date();

      sortedSubmissions.forEach(submission => {
        // Check upload date
        const uploadDate = new Date(submission.uploadDate || submission.timestamp || submission.dateSubmitted);
        if (uploadDate < earliestDate) {
          earliestDate = uploadDate;
        }

        // Check snapshot dates
        if (submission.snapshots && submission.snapshots.length > 0) {
          submission.snapshots.forEach(snapshot => {
            const snapshotDate = new Date(snapshot.capturedAt);
            if (snapshotDate < earliestDate) {
              earliestDate = snapshotDate;
            }
            if (snapshotDate > latestDate) {
              latestDate = snapshotDate;
            }
          });
        }

        // Check last refresh date
        if (submission.lastRefreshed) {
          const refreshDate = new Date(submission.lastRefreshed);
          if (refreshDate > latestDate) {
            latestDate = refreshDate;
          }
        }
      });
    }

    console.log(`📅 Date range: ${earliestDate.toLocaleDateString()} to ${latestDate.toLocaleDateString()}`);
    
    const firstDate = earliestDate;
    const lastDate = latestDate;

    // Generate periods between first video and now
    const periods = this.generatePeriods(firstDate, lastDate, timePeriod);
    
    // Group submissions by period
    const periodMap = new Map<string, PeriodData>();

    // Initialize all periods with zero values
    periods.forEach(period => {
      periodMap.set(period.key, {
        period: period.label,
        date: period.date,
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        videoCount: 0
      });
    });

    console.log(`🔍 TimePeriodService processing ${sortedSubmissions.length} videos for period: ${timePeriod}`);
    
    // Process each video's snapshot history to build time-based data
    sortedSubmissions.forEach(submission => {
      console.log(`📹 Processing "${submission.title.substring(0, 30)}" with ${submission.snapshots?.length || 0} snapshots`);
      
      if (!submission.snapshots || submission.snapshots.length === 0) {
        // No snapshots - add current metrics to upload date
        const uploadDate = new Date(submission.uploadDate || submission.timestamp || submission.dateSubmitted);
        const uploadPeriodKey = this.getPeriodKey(uploadDate, timePeriod);
        const uploadPeriodData = periodMap.get(uploadPeriodKey);
        
        if (uploadPeriodData) {
          uploadPeriodData.views += submission.views;
          uploadPeriodData.likes += submission.likes;
          uploadPeriodData.comments += submission.comments;
          uploadPeriodData.shares += submission.shares || 0;
          uploadPeriodData.videoCount += 1;
        }
        
        console.log(`  ➜ No snapshots: Added current metrics to upload date (${uploadPeriodKey})`);
        return;
      }

      // Sort snapshots by date
      const sortedSnapshots = submission.snapshots.sort((a, b) => 
        new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
      );

      // Process each snapshot
      sortedSnapshots.forEach((snapshot, index) => {
        const snapshotDate = new Date(snapshot.capturedAt);
        const snapshotPeriodKey = this.getPeriodKey(snapshotDate, timePeriod);
        const periodData = periodMap.get(snapshotPeriodKey);
        
        if (!periodData) return;

        if (index === 0) {
          // First snapshot (initial upload) - add full metrics
          periodData.views += snapshot.views;
          periodData.likes += snapshot.likes;
          periodData.comments += snapshot.comments;
          periodData.shares += snapshot.shares || 0;
          periodData.videoCount += 1;
          
          console.log(`  ➜ Initial snapshot (${snapshotPeriodKey}): ${snapshot.views} views, ${snapshot.likes} likes`);
        } else {
          // Subsequent snapshots - add incremental growth
          const previousSnapshot = sortedSnapshots[index - 1];
          const viewsGrowth = Math.max(0, snapshot.views - previousSnapshot.views);
          const likesGrowth = Math.max(0, snapshot.likes - previousSnapshot.likes);
          const commentsGrowth = Math.max(0, snapshot.comments - previousSnapshot.comments);
          const sharesGrowth = Math.max(0, (snapshot.shares || 0) - (previousSnapshot.shares || 0));
          
          periodData.views += viewsGrowth;
          periodData.likes += likesGrowth;
          periodData.comments += commentsGrowth;
          periodData.shares += sharesGrowth;
          
          // Only count as activity if there was actual growth
          if (viewsGrowth > 0 || likesGrowth > 0 || commentsGrowth > 0 || sharesGrowth > 0) {
            periodData.videoCount += 1;
          }
          
          console.log(`  ➜ Refresh snapshot (${snapshotPeriodKey}): +${viewsGrowth} views, +${likesGrowth} likes`);
        }
      });

      // If current metrics are higher than last snapshot, add the difference to current period
      const lastSnapshot = sortedSnapshots[sortedSnapshots.length - 1];
      const currentViewsGrowth = Math.max(0, submission.views - lastSnapshot.views);
      const currentLikesGrowth = Math.max(0, submission.likes - lastSnapshot.likes);
      const currentCommentsGrowth = Math.max(0, submission.comments - lastSnapshot.comments);
      const currentSharesGrowth = Math.max(0, (submission.shares || 0) - (lastSnapshot.shares || 0));
      
      if (currentViewsGrowth > 0 || currentLikesGrowth > 0 || currentCommentsGrowth > 0 || currentSharesGrowth > 0) {
        const currentDate = submission.lastRefreshed ? new Date(submission.lastRefreshed) : new Date();
        const currentPeriodKey = this.getPeriodKey(currentDate, timePeriod);
        const currentPeriodData = periodMap.get(currentPeriodKey);
        
        if (currentPeriodData) {
          currentPeriodData.views += currentViewsGrowth;
          currentPeriodData.likes += currentLikesGrowth;
          currentPeriodData.comments += currentCommentsGrowth;
          currentPeriodData.shares += currentSharesGrowth;
          currentPeriodData.videoCount += 1;
          
          console.log(`  ➜ Current growth (${currentPeriodKey}): +${currentViewsGrowth} views, +${currentLikesGrowth} likes`);
        }
      }
    });

    return Array.from(periodMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private static generatePeriods(startDate: Date, endDate: Date, timePeriod: TimePeriodType) {
    const periods: { key: string; label: string; date: Date }[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const periodKey = this.getPeriodKey(current, timePeriod);
      const periodLabel = this.getPeriodLabel(current, timePeriod);
      
      // Avoid duplicates
      if (!periods.find(p => p.key === periodKey)) {
        periods.push({
          key: periodKey,
          label: periodLabel,
          date: new Date(current)
        });
      }

      // Move to next period
      this.advancePeriod(current, timePeriod);
    }

    return periods;
  }

  private static getPeriodKey(date: Date, timePeriod: TimePeriodType): string {
    switch (timePeriod) {
      case 'hours':
        // YYYY-MM-DD-HH format for hourly grouping
        return `${date.toISOString().split('T')[0]}-${String(date.getHours()).padStart(2, '0')}`;
      case 'days':
        return date.toISOString().split('T')[0]; // YYYY-MM-DD
      case 'weeks':
        const weekStart = this.getWeekStart(date);
        return `${weekStart.getFullYear()}-W${this.getWeekNumber(weekStart)}`;
      case 'months':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      case 'quarters':
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        return `${date.getFullYear()}-Q${quarter}`;
      case 'years':
        return String(date.getFullYear());
      default:
        return date.toISOString().split('T')[0];
    }
  }

  private static getPeriodLabel(date: Date, timePeriod: TimePeriodType): string {
    switch (timePeriod) {
      case 'hours':
        return date.toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          hour: 'numeric',
          hour12: true 
        });
      case 'days':
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case 'weeks':
        const weekStart = this.getWeekStart(date);
        return `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      case 'months':
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      case 'quarters':
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        return `Q${quarter} ${date.getFullYear()}`;
      case 'years':
        return String(date.getFullYear());
      default:
        return date.toLocaleDateString();
    }
  }

  private static advancePeriod(date: Date, timePeriod: TimePeriodType): void {
    switch (timePeriod) {
      case 'hours':
        date.setHours(date.getHours() + 1);
        break;
      case 'days':
        date.setDate(date.getDate() + 1);
        break;
      case 'weeks':
        date.setDate(date.getDate() + 7);
        break;
      case 'months':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'quarters':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'years':
        date.setFullYear(date.getFullYear() + 1);
        break;
    }
  }

  private static getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }

  private static getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }


  static formatPeriodDescription(timePeriod: TimePeriodType): string {
    switch (timePeriod) {
      case 'hours':
        return 'hourly breakdown';
      case 'days':
        return 'daily breakdown';
      case 'weeks':
        return 'weekly breakdown';
      case 'months':
        return 'monthly breakdown';
      case 'quarters':
        return 'quarterly breakdown';
      case 'years':
        return 'yearly breakdown';
      default:
        return 'breakdown';
    }
  }
}
