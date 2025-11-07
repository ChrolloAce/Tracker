/**
 * DataAggregationService
 * 
 * Handles time-based data aggregation and interval calculations.
 * Ensures consistent date comparisons and proper grouping across different time ranges.
 */

export type IntervalType = 'hour' | 'day' | 'week' | 'month' | 'year';

export interface TimeInterval {
  startDate: Date;
  endDate: Date;
  intervalType: IntervalType;
  label: string;
  timestamp: number; // Representative timestamp for the interval (start)
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export class DataAggregationService {
  /**
   * Determine the appropriate interval type based on the date range duration
   */
  static determineIntervalType(dateRange: DateRange): IntervalType {
    const durationMs = dateRange.endDate.getTime() - dateRange.startDate.getTime();
    const durationDays = durationMs / (24 * 60 * 60 * 1000);
    
    // Use hourly for single day views (today/yesterday)
    if (durationDays <= 1) {
      return 'hour';
    }
    
    // Use daily for everything else (including year-long or multi-year periods)
    return 'day';
  }

  /**
   * Calculate the interval duration in milliseconds
   */
  static getIntervalDurationMs(intervalType: IntervalType): number {
    switch (intervalType) {
      case 'hour':
        return 60 * 60 * 1000;
      case 'day':
        return 24 * 60 * 60 * 1000;
      case 'week':
        return 7 * 24 * 60 * 60 * 1000;
      case 'month':
        return 30 * 24 * 60 * 60 * 1000; // Approximation
      case 'year':
        return 365 * 24 * 60 * 60 * 1000; // Approximation
      default:
        return 24 * 60 * 60 * 1000;
    }
  }

  /**
   * Generate all intervals for a given date range
   * Returns an array of TimeInterval objects that cover the entire range
   */
  static generateIntervals(dateRange: DateRange, intervalType: IntervalType): TimeInterval[] {
    const intervals: TimeInterval[] = [];
    const startDate = new Date(dateRange.startDate);
    startDate.setHours(0, 0, 0, 0); // Normalize to start of day
    
    // Normalize start date based on interval type
    if (intervalType === 'year') {
      startDate.setMonth(0, 1); // January 1st of the year
    } else if (intervalType === 'month') {
      startDate.setDate(1); // 1st day of the month
    } else if (intervalType === 'week') {
      const day = startDate.getDay();
      const diff = startDate.getDate() - day; // Adjust to Sunday
      startDate.setDate(diff);
    }
    
    const endDate = new Date(dateRange.endDate);
    endDate.setHours(23, 59, 59, 999); // Normalize to end of day
    
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const intervalStart = new Date(currentDate);
      const intervalEnd = this.getIntervalEnd(intervalStart, intervalType);
      
      // Don't create intervals that extend beyond the end date
      if (intervalStart > endDate) break;
      
      const actualEnd = intervalEnd > endDate ? endDate : intervalEnd;
      
      intervals.push({
        startDate: intervalStart,
        endDate: actualEnd,
        intervalType,
        label: this.formatIntervalLabel(intervalStart, intervalType),
        timestamp: intervalStart.getTime()
      });
      
      // Move to next interval
      currentDate = this.advanceInterval(currentDate, intervalType);
    }
    
    return intervals;
  }

  /**
   * Get the end date for an interval starting at the given date
   */
  private static getIntervalEnd(startDate: Date, intervalType: IntervalType): Date {
    const end = new Date(startDate);
    
    switch (intervalType) {
      case 'hour':
        end.setHours(end.getHours() + 1);
        end.setMilliseconds(end.getMilliseconds() - 1);
        break;
      case 'day':
        end.setDate(end.getDate() + 1);
        end.setMilliseconds(end.getMilliseconds() - 1);
        break;
      case 'week':
        end.setDate(end.getDate() + 7);
        end.setMilliseconds(end.getMilliseconds() - 1);
        break;
      case 'month':
        end.setMonth(end.getMonth() + 1);
        end.setMilliseconds(end.getMilliseconds() - 1);
        break;
      case 'year':
        end.setFullYear(end.getFullYear() + 1);
        end.setMilliseconds(end.getMilliseconds() - 1);
        break;
    }
    
    return end;
  }

  /**
   * Advance a date to the next interval
   */
  private static advanceInterval(date: Date, intervalType: IntervalType): Date {
    const next = new Date(date);
    
    switch (intervalType) {
      case 'hour':
        next.setHours(next.getHours() + 1);
        break;
      case 'day':
        next.setDate(next.getDate() + 1);
        break;
      case 'week':
        next.setDate(next.getDate() + 7);
        break;
      case 'month':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'year':
        next.setFullYear(next.getFullYear() + 1);
        break;
    }
    
    return next;
  }

  /**
   * Format an interval label for display
   */
  static formatIntervalLabel(date: Date, intervalType: IntervalType): string {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const fullMonthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    switch (intervalType) {
      case 'hour':
        const hour = date.getHours();
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${monthNames[date.getMonth()]} ${date.getDate()}, ${displayHour}:00 ${period}`;
        
      case 'day':
        return `${monthNames[date.getMonth()]} ${date.getDate()}`;
        
      case 'week':
        const weekEnd = new Date(date);
        weekEnd.setDate(weekEnd.getDate() + 6);
        return `${monthNames[date.getMonth()]} ${date.getDate()}-${monthNames[weekEnd.getMonth()]} ${weekEnd.getDate()}`;
        
      case 'month':
        return `${fullMonthNames[date.getMonth()]} ${date.getFullYear()}`;
        
      case 'year':
        return `${date.getFullYear()}`;
        
      default:
        return date.toLocaleDateString();
    }
  }

  /**
   * Format an interval label for full display (tooltip)
   */
  static formatIntervalLabelFull(date: Date, intervalType: IntervalType): string {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    switch (intervalType) {
      case 'hour':
        const hour = date.getHours();
        const nextHour = (hour + 1) % 24;
        const period = hour >= 12 ? 'PM' : 'AM';
        const nextPeriod = nextHour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        const displayNextHour = nextHour % 12 || 12;
        return `${monthNames[date.getMonth()]} ${this.getOrdinalSuffix(date.getDate())}, ${date.getFullYear()} • ${displayHour}:00 ${period} - ${displayNextHour}:00 ${nextPeriod}`;
        
      case 'day':
        return `${monthNames[date.getMonth()]} ${this.getOrdinalSuffix(date.getDate())}, ${date.getFullYear()}`;
        
      case 'week':
        const weekEnd = new Date(date);
        weekEnd.setDate(weekEnd.getDate() + 6);
        if (date.getMonth() === weekEnd.getMonth()) {
          return `${monthNames[date.getMonth()]} ${this.getOrdinalSuffix(date.getDate())} - ${this.getOrdinalSuffix(weekEnd.getDate())}, ${date.getFullYear()}`;
        } else {
          return `${monthNames[date.getMonth()]} ${this.getOrdinalSuffix(date.getDate())} - ${monthNames[weekEnd.getMonth()]} ${this.getOrdinalSuffix(weekEnd.getDate())}, ${date.getFullYear()}`;
        }
        
      case 'month':
        return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        
      case 'year':
        return `${date.getFullYear()}`;
        
      default:
        return date.toLocaleDateString();
    }
  }

  /**
   * Get ordinal suffix for a day (1st, 2nd, 3rd, etc.)
   */
  private static getOrdinalSuffix(day: number): string {
    if (day >= 11 && day <= 13) return `${day}th`;
    
    switch (day % 10) {
      case 1: return `${day}st`;
      case 2: return `${day}nd`;
      case 3: return `${day}rd`;
      default: return `${day}th`;
    }
  }

  /**
   * Check if a date falls within an interval
   * Uses inclusive start, exclusive end boundary logic
   */
  static isDateInInterval(date: Date, interval: TimeInterval): boolean {
    const dateTime = date.getTime();
    const intervalStart = interval.startDate.getTime();
    const intervalEnd = interval.endDate.getTime();
    
    return dateTime >= intervalStart && dateTime <= intervalEnd;
  }

  /**
   * Find which interval a date belongs to from an array of intervals
   */
  static findIntervalForDate(date: Date, intervals: TimeInterval[]): TimeInterval | null {
    return intervals.find(interval => this.isDateInInterval(date, interval)) || null;
  }

  /**
   * Normalize a date to the start of its interval
   */
  static normalizeToIntervalStart(date: Date, intervalType: IntervalType): Date {
    const normalized = new Date(date);
    
    switch (intervalType) {
      case 'hour':
        normalized.setMinutes(0, 0, 0);
        break;
      case 'day':
        normalized.setHours(0, 0, 0, 0);
        break;
      case 'week':
        // Normalize to Sunday (start of week)
        const day = normalized.getDay();
        normalized.setDate(normalized.getDate() - day);
        normalized.setHours(0, 0, 0, 0);
        break;
      case 'month':
        normalized.setDate(1);
        normalized.setHours(0, 0, 0, 0);
        break;
      case 'year':
        normalized.setMonth(0, 1);
        normalized.setHours(0, 0, 0, 0);
        break;
    }
    
    return normalized;
  }

  /**
   * Get a date range description for display
   */
  static getDateRangeDescription(dateRange: DateRange): string {
    const start = dateRange.startDate;
    const end = dateRange.endDate;
    
    if (start.toDateString() === end.toDateString()) {
      return this.formatIntervalLabelFull(start, 'day');
    }
    
    const durationMs = end.getTime() - start.getTime();
    const durationDays = Math.ceil(durationMs / (24 * 60 * 60 * 1000));
    
    if (durationDays <= 7) {
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    
    return `${start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
  }
}

export default DataAggregationService;

