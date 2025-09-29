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

export class TimePeriodService {
  static generateTimeSeriesData(
    submissions: VideoSubmission[],
    timePeriod: TimePeriodType
  ): PeriodData[] {
    if (submissions.length === 0) return [];

    // Sort submissions by upload date
    const sortedSubmissions = [...submissions].sort((a, b) => {
      const dateA = new Date(a.timestamp || a.dateSubmitted);
      const dateB = new Date(b.timestamp || b.dateSubmitted);
      return dateA.getTime() - dateB.getTime();
    });

    const firstDate = new Date(sortedSubmissions[0].timestamp || sortedSubmissions[0].dateSubmitted);
    const lastDate = new Date();

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

    // Track which videos were refreshed today to show today's growth
    const today = new Date();
    const todayPeriodKey = this.getPeriodKey(today, timePeriod);
    
    // Aggregate data for each period
    sortedSubmissions.forEach(submission => {
      const uploadDate = new Date(submission.timestamp || submission.dateSubmitted);
      const uploadPeriodKey = this.getPeriodKey(uploadDate, timePeriod);
      
      // Add video to its upload period
      const uploadPeriodData = periodMap.get(uploadPeriodKey);
      if (uploadPeriodData) {
        uploadPeriodData.views += submission.views;
        uploadPeriodData.likes += submission.likes;
        uploadPeriodData.comments += submission.comments;
        uploadPeriodData.shares += submission.shares || 0;
        uploadPeriodData.videoCount += 1;
      }
      
      // If video was refreshed today and it's not the same as upload period,
      // also show the growth in today's period
      const refreshDate = submission.lastRefreshed ? new Date(submission.lastRefreshed) : null;
      if (refreshDate && this.isSameDay(refreshDate, today) && uploadPeriodKey !== todayPeriodKey) {
        const todayPeriodData = periodMap.get(todayPeriodKey);
        if (todayPeriodData) {
          // Calculate the growth since last snapshot or upload
          const lastSnapshot = submission.snapshots && submission.snapshots.length > 0 
            ? submission.snapshots[submission.snapshots.length - 1]
            : null;
          
          if (lastSnapshot) {
            // Add the growth since last snapshot
            const viewsGrowth = Math.max(0, submission.views - lastSnapshot.views);
            const likesGrowth = Math.max(0, submission.likes - lastSnapshot.likes);
            const commentsGrowth = Math.max(0, submission.comments - lastSnapshot.comments);
            const sharesGrowth = Math.max(0, (submission.shares || 0) - (lastSnapshot.shares || 0));
            
            todayPeriodData.views += viewsGrowth;
            todayPeriodData.likes += likesGrowth;
            todayPeriodData.comments += commentsGrowth;
            todayPeriodData.shares += sharesGrowth;
          }
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

  private static isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  static formatPeriodDescription(timePeriod: TimePeriodType): string {
    switch (timePeriod) {
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
