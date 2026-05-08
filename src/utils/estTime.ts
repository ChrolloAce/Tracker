/**
 * EST-pinned time helpers. Use these instead of `new Date()` /
 * `setHours(0,0,0,0)` whenever the date label needs to match what an EST
 * user expects — so a user opening the dashboard from PST or UTC still
 * sees today as the current EST calendar day, and intervals bucket on EST
 * day boundaries.
 *
 * Implementation: read the requested wall-clock date from
 * Intl.DateTimeFormat with timeZone America/New_York, then build a JS Date
 * whose LOCAL components match those EST components. Downstream code that
 * does `setHours(0,0,0,0)` etc. continues to work because we're feeding it
 * a date whose local Y/M/D already matches EST.
 */

const EST_TZ = 'America/New_York';

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: EST_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

interface EstParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const readEstParts = (instant: Date): EstParts => {
  const out: Partial<EstParts> = {};
  for (const p of partsFormatter.formatToParts(instant)) {
    if (p.type === 'year') out.year = Number(p.value);
    else if (p.type === 'month') out.month = Number(p.value);
    else if (p.type === 'day') out.day = Number(p.value);
    else if (p.type === 'hour') out.hour = Number(p.value === '24' ? '0' : p.value);
    else if (p.type === 'minute') out.minute = Number(p.value);
    else if (p.type === 'second') out.second = Number(p.value);
  }
  return out as EstParts;
};

/** Today in EST as a Date whose LOCAL Y/M/D matches the EST calendar day
 *  (time = 00:00:00 local). Safe to call setHours / addDays on. */
export const estToday = (): Date => {
  const p = readEstParts(new Date());
  return new Date(p.year, p.month - 1, p.day, 0, 0, 0, 0);
};

/** Same as estToday() but for any instant. */
export const estStartOfDay = (instant: Date): Date => {
  const p = readEstParts(instant);
  return new Date(p.year, p.month - 1, p.day, 0, 0, 0, 0);
};

/** Date string YYYY-MM-DD for the EST calendar day of the given instant. */
export const estDateKey = (instant: Date): string => {
  const p = readEstParts(instant);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
};
