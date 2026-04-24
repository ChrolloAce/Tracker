/**
 * Stripe Connect Express supported countries (transfers capability).
 * Ordered with US, UK, Canada first — our most common creator geos — then alphabetical by name.
 *
 * Flag is rendered via Unicode regional indicator symbols (2 letters → emoji flag).
 * Works cross-platform without needing a flag image asset.
 *
 * NOTE: This list is curated for creator payouts. It matches Stripe's Express `country` support
 * as of early 2026. If Stripe adds a country later, append it here — no other code needs changes.
 */

export interface StripeCountry {
  /** ISO 3166-1 alpha-2 code (e.g. 'US') — this is what Stripe's `accounts.create({country})` expects. */
  code: string;
  /** Human-readable country name shown in the dropdown. */
  name: string;
  /** Emoji flag (derived via the regional indicator helper below). */
  flag: string;
}

/** Convert a 2-letter country code to its flag emoji by offsetting into the regional-indicator range. */
export function codeToFlag(code: string): string {
  if (!code || code.length !== 2) return '';
  const offset = 127397; // 'A' → 🇦 gap
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => c.charCodeAt(0) + offset));
}

const countryPair = (code: string, name: string): StripeCountry => ({ code, name, flag: codeToFlag(code) });

/** Top-priority countries — shown first with a visual separator underneath. */
export const PRIORITY_COUNTRIES: StripeCountry[] = [
  countryPair('US', 'United States'),
  countryPair('GB', 'United Kingdom'),
  countryPair('CA', 'Canada'),
];

/** Everything else, alphabetical by name. */
export const OTHER_COUNTRIES: StripeCountry[] = [
  countryPair('AU', 'Australia'),
  countryPair('AT', 'Austria'),
  countryPair('BE', 'Belgium'),
  countryPair('BR', 'Brazil'),
  countryPair('BG', 'Bulgaria'),
  countryPair('HR', 'Croatia'),
  countryPair('CY', 'Cyprus'),
  countryPair('CZ', 'Czech Republic'),
  countryPair('DK', 'Denmark'),
  countryPair('EE', 'Estonia'),
  countryPair('FI', 'Finland'),
  countryPair('FR', 'France'),
  countryPair('DE', 'Germany'),
  countryPair('GI', 'Gibraltar'),
  countryPair('GR', 'Greece'),
  countryPair('HK', 'Hong Kong'),
  countryPair('HU', 'Hungary'),
  countryPair('IN', 'India'),
  countryPair('ID', 'Indonesia'),
  countryPair('IE', 'Ireland'),
  countryPair('IT', 'Italy'),
  countryPair('JP', 'Japan'),
  countryPair('LV', 'Latvia'),
  countryPair('LI', 'Liechtenstein'),
  countryPair('LT', 'Lithuania'),
  countryPair('LU', 'Luxembourg'),
  countryPair('MY', 'Malaysia'),
  countryPair('MT', 'Malta'),
  countryPair('MX', 'Mexico'),
  countryPair('NL', 'Netherlands'),
  countryPair('NZ', 'New Zealand'),
  countryPair('NO', 'Norway'),
  countryPair('PH', 'Philippines'),
  countryPair('PL', 'Poland'),
  countryPair('PT', 'Portugal'),
  countryPair('RO', 'Romania'),
  countryPair('SG', 'Singapore'),
  countryPair('SK', 'Slovakia'),
  countryPair('SI', 'Slovenia'),
  countryPair('ES', 'Spain'),
  countryPair('SE', 'Sweden'),
  countryPair('CH', 'Switzerland'),
  countryPair('TH', 'Thailand'),
  countryPair('AE', 'United Arab Emirates'),
];

/** Flat array — all supported countries in display order (priority first, then alphabetical). */
export const ALL_STRIPE_COUNTRIES: StripeCountry[] = [...PRIORITY_COUNTRIES, ...OTHER_COUNTRIES];

/** Set of allowed ISO codes — used for API-side validation. O(1) lookup. */
export const ALLOWED_STRIPE_COUNTRY_CODES = new Set(ALL_STRIPE_COUNTRIES.map(c => c.code));

/** Lookup by code — returns undefined if not supported. */
export function getStripeCountry(code: string): StripeCountry | undefined {
  return ALL_STRIPE_COUNTRIES.find(c => c.code === code.toUpperCase());
}
