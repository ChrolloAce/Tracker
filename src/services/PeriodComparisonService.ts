import { DateFilterType } from '../components/DateRangeFilter';
import { TimePeriodType } from '../components/TimePeriodSelector';

/**
 * Period definition for trend calculations
 */
export interface Period {
  start: Date;
  end: Date;
  label: string;
}

/**
 * Period pair for current vs previous comparison
 */
export interface PeriodPair {
  current: Period;
  previous: Period;
  bucket: TimePeriodType;
  timezone: string;
}

/**
 * Custom date range interface
 */
export interface DateRange {
  startDate: Date;
  endDate: Date;
}

/**
 * Service for timezone-aware period comparison calculations.
 * Handles Current Period (CP) and Previous Period (PP) logic.
 */
export class PeriodComparisonService {
  private static readonly DEFAULT_TIMEZONE = 'America/Los_Angeles';
  private static readonly EPSILON = 0.5; // 0.5% threshold for flat detection

  /**
   * Get Current Period (CP) and Previous Period (PP) based on filter type
   */
  static getPeriodPair(
    filterType: DateFilterType,
    customRange?: DateRange,
    timezone: string = this.DEFAULT_TIMEZONE
  ): PeriodPair {
    const now = new Date();
    
    // Convert "now" to the target timezone
    const nowInTimezone = this.toTimezone(now, timezone);
    
    let currentPeriod: Period;
    let bucket: TimePeriodType;

    switch (filterType) {
      case 'today':
        currentPeriod = this.getTodayPeriod(nowInTimezone, timezone);
        bucket = 'hours';
        break;
        
      case 'last7days':
        currentPeriod = this.getLast7DaysPeriod(nowInTimezone, timezone);
        bucket = 'days';
        break;
        
      case 'last30days':
        currentPeriod = this.getLast30DaysPeriod(nowInTimezone, timezone);
        bucket = 'days';
        break;
        
      case 'last90days':
        currentPeriod = this.getLast90DaysPeriod(nowInTimezone, timezone);
        bucket = 'days';
        break;
        
      case 'mtd':
        currentPeriod = this.getMonthToDatePeriod(nowInTimezone, timezone);
        bucket = 'days';
        break;
        
      case 'ytd':
        currentPeriod = this.getYearToDatePeriod(nowInTimezone, timezone);
        bucket = 'weeks';
        break;
        
      case 'custom':
        if (customRange) {
          currentPeriod = {
            start: customRange.startDate,
            end: customRange.endDate,
            label: this.formatPeriodLabel(customRange.startDate, customRange.endDate, timezone)
          };
          // Derive bucket based on duration
          bucket = this.deriveBucketFromDuration(customRange.startDate, customRange.endDate);
        } else {
          // Fallback to last 30 days
          currentPeriod = this.getLast30DaysPeriod(nowInTimezone, timezone);
          bucket = 'days';
        }
        break;
        
      case 'all':
      default:
        // For "all time", use last 30 days for comparison
        currentPeriod = this.getLast30DaysPeriod(nowInTimezone, timezone);
        bucket = 'days';
        break;
    }

    // Calculate previous period (same duration, immediately before)
    const duration = currentPeriod.end.getTime() - currentPeriod.start.getTime();
    const previousPeriod: Period = {
      start: new Date(currentPeriod.start.getTime() - duration),
      end: currentPeriod.start,
      label: this.formatPeriodLabel(
        new Date(currentPeriod.start.getTime() - duration),
        currentPeriod.start,
        timezone
      )
    };

    return {
      current: currentPeriod,
      previous: previousPeriod,
      bucket,
      timezone
    };
  }

  /**
   * Derive bucket granularity from period duration
   */
  private static deriveBucketFromDuration(start: Date, end: Date): TimePeriodType {
    const durationMs = end.getTime() - start.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    const durationDays = durationHours / 24;
    const durationMonths = durationDays / 30;

    if (durationHours <= 48) return 'hours';
    if (durationDays <= 90) return 'days';
    if (durationMonths <= 12) return 'weeks';
    return 'months';
  }

  /**
   * Get today's period (00:00 to now in timezone)
   */
  private static getTodayPeriod(now: Date, timezone: string): Period {
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    
    return {
      start: startOfDay,
      end: now,
      label: this.formatPeriodLabel(startOfDay, now, timezone)
    };
  }

  /**
   * Get last 7 days period
   */
  private static getLast7DaysPeriod(now: Date, timezone: string): Period {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    
    return {
      start,
      end: now,
      label: this.formatPeriodLabel(start, now, timezone)
    };
  }

  /**
   * Get last 30 days period
   */
  private static getLast30DaysPeriod(now: Date, timezone: string): Period {
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
    
    return {
      start,
      end: now,
      label: this.formatPeriodLabel(start, now, timezone)
    };
  }

  /**
   * Get last 90 days period
   */
  private static getLast90DaysPeriod(now: Date, timezone: string): Period {
    const start = new Date(now);
    start.setDate(start.getDate() - 90);
    start.setHours(0, 0, 0, 0);
    
    return {
      start,
      end: now,
      label: this.formatPeriodLabel(start, now, timezone)
    };
  }

  /**
   * Get month-to-date period
   */
  private static getMonthToDatePeriod(now: Date, timezone: string): Period {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    
    return {
      start,
      end: now,
      label: this.formatPeriodLabel(start, now, timezone)
    };
  }

  /**
   * Get year-to-date period
   */
  private static getYearToDatePeriod(now: Date, timezone: string): Period {
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    
    return {
      start,
      end: now,
      label: this.formatPeriodLabel(start, now, timezone)
    };
  }

  /**
   * Convert a date to a specific timezone (simplified approach)
   * Note: For production, consider using date-fns-tz or moment-timezone
   */
  private static toTimezone(date: Date, timezone: string): Date {
    // Use Intl API to get the date in the target timezone
    const dateStr = date.toLocaleString('en-US', { timeZone: timezone });
    return new Date(dateStr);
  }

  /**
   * Format period label for display
   */
  private static formatPeriodLabel(start: Date, end: Date, _timezone: string): string {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const startMonth = monthNames[start.getMonth()];
    const startDay = start.getDate();
    const endMonth = monthNames[end.getMonth()];
    const endDay = end.getDate();
    
    if (start.getMonth() === end.getMonth()) {
      return `${startMonth} ${startDay}–${endDay}`;
    }
    
    return `${startMonth} ${startDay}–${endMonth} ${endDay}`;
  }

  /**
   * Check if a date is within a period
   */
  static isDateInPeriod(date: Date, period: Period): boolean {
    return date >= period.start && date < period.end;
  }

  /**
   * Get bucket boundaries for a date
   */
  static getBucketBoundaries(date: Date, bucket: TimePeriodType, timezone: string): { start: Date; end: Date } {
    const d = this.toTimezone(date, timezone);
    
    switch (bucket) {
      case 'hours':
        return {
          start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), 0, 0, 0),
          end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1, 0, 0, 0)
        };
        
      case 'days':
        return {
          start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0),
          end: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0)
        };
        
      case 'weeks':
        const dayOfWeek = d.getDay();
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - dayOfWeek);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);
        return { start: weekStart, end: weekEnd };
        
      case 'months':
        return {
          start: new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0),
          end: new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0)
        };
        
      case 'quarters':
        const quarter = Math.floor(d.getMonth() / 3);
        return {
          start: new Date(d.getFullYear(), quarter * 3, 1, 0, 0, 0, 0),
          end: new Date(d.getFullYear(), (quarter + 1) * 3, 1, 0, 0, 0, 0)
        };
        
      case 'years':
        return {
          start: new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0),
          end: new Date(d.getFullYear() + 1, 0, 1, 0, 0, 0, 0)
        };
        
      default:
        return {
          start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0),
          end: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0)
        };
    }
  }

  /**
   * Get epsilon threshold for trend detection
   */
  static getEpsilon(): number {
    return this.EPSILON;
  }
}

